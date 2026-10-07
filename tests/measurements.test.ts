import assert from 'node:assert/strict';
import seed from '../data/seed.json';
import {migrateState,rectRing} from '../lib/measurement-model';
import {validateState,balconyChange,type State,type Floor} from '../lib/model';
import {computeScene,measureSpec,pieceShapes,pointInRing,dimensionsFor,ringArea,toWorld} from '../lib/geometry';
import {analyzeRoutes,annotateRouteUse} from '../lib/routes';
import {dxfDrawing,csvDrawing,svgDrawing} from '../lib/designer-export';
import fs from 'node:fs';
const s=migrateState(seed as State),f=s.floors[0];assert.equal(s.version,3);assert(validateState(s));assert.deepEqual(migrateState(s),s);
const scene=computeScene(f);assert(scene.valid);const get=(id:string)=>measureSpec(f,f.measurements!.find(m=>m.id===id)!,scene);
assert.equal(get('chair-cabinet').value,970);assert.equal(get('chair-stairs').value,931);assert.equal(get('sofa-tv').value,1800);assert.match(get('sofa-tv').note,/中间有障碍/);assert.equal(get('sofa-coffee').value,530);assert.equal(get('coffee-tv').value,720);
const kitchen=pieceShapes(f.pieces.find(p=>p.id==='f1-kitchen')!)[0].ring;assert.equal(ringArea(kitchen),3098000);assert(!pointInRing([1000,2000],kitchen));assert(pointInRing([300,2000],kitchen));
assert.equal(pieceShapes(f.pieces.find(p=>p.id==='f1-保留窗户')!).length,2);
const moved=structuredClone(f);moved.pieces.find(p=>p.id==='f1-island')!.y-=100;assert.equal(measureSpec(moved,moved.measurements!.find(m=>m.id==='chair-cabinet')!).value,870);
for(const rot of [0,45,90]){const p={id:'test',name:'test',x:0,y:0,w:1000,h:500,type:'furniture' as const,rotation:rot};const points=pieceShapes(p)[0].ring;assert(Math.abs(ringArea(points)-500000)<.01);}
const stored=structuredClone(f);stored.pieces.find(p=>p.id==='f1-island')!.usage!.chairs='stored';assert.equal(measureSpec(stored,stored.measurements!.find(m=>m.id==='chair-cabinet')!).value,1390);
const cabinet={id:'cab',name:'cab',x:0,y:0,w:1000,h:1200,baseW:1000,baseH:600,type:'furniture' as const,rotation:0,usage:{open:true,depth:600,side:'bottom' as const}};const operation=pieceShapes(cabinet).find(s=>s.kind==='operation')!;assert.equal(Math.max(...operation.ring.map(p=>p[1]))-Math.min(...operation.ring.map(p=>p[1])),600);
for(const section of ['all','upper','lower']){const balcony=structuredClone(f);balconyChange(balcony,section,300);assert(computeScene(balcony).valid,'balcony '+section);balconyChange(balcony,section,-300);assert(computeScene(balcony).valid,'balcony restore '+section);}
for(const original of s.floors){const balcony=structuredClone(original),edge=balcony.balconyTopology!.end;
 const m={id:'boundary:'+edge,name:'固定南边',a:{kind:'boundary' as const,edge,t:0},b:{kind:'boundary' as const,edge,t:1},mode:'direct' as const,pinned:true};balcony.measurements!.push(m);
 balcony.routes!.push({id:'anchor-test',name:'路线端点',points:[{kind:'boundary',edge,t:.25},{kind:'point',point:[0,0]}],target:900});
 const before=measureSpec(balcony,m).value!;balconyChange(balcony,'lower',300);assert(Math.abs(measureSpec(balcony,m).value!-before-300)<.001,'pinned boundary follows same wall');assert.equal(balcony.routes!.at(-1)!.points[0].kind==='boundary'&&(balcony.routes!.at(-1)!.points[0] as any).edge,balcony.balconyTopology!.end);balconyChange(balcony,'lower',-300);assert(Math.abs(measureSpec(balcony,m).value!-before)<.001);
}
const expanded=structuredClone(f);expanded.pieces.find(p=>p.id==='f1-island')!.usage!.table='extended';const size=measureSpec(expanded,{id:'size:f1-island:0',sizeId:'size:f1-island:0',name:'岛台长',a:{kind:'local',objectId:'f1-island',point:[0,0]},b:{kind:'local',objectId:'f1-island',point:[2800,0]},mode:'direct',pinned:true});assert.equal(size.value,3400);
const f2=computeScene(s.floors[1]);assert(f2.valid);assert(Math.abs(f2.outerArea-88.944379)<1e-6);
const invalid=structuredClone(f);invalid.outline=[[0,0],[2000,2000],[0,2000],[2000,0]];assert(!computeScene(invalid).valid);
const start=performance.now(),dims=dimensionsFor(f,scene,'',true);console.log('all dimensions',dims.length,'ms',Math.round(performance.now()-start));assert(dims.length>100);
const routeStart=performance.now();const route=analyzeRoutes({requestId:1,floorId:'test',outline:rectRing(0,0,4000,2000),free:[[rectRing(0,0,4000,2000)]],resolution:10,requests:[{id:'open',name:'open',points:[[800,1000],[3200,1000]],target:900}]});assert.equal(route.results[0].status,'ok');assert(route.results[0].width!>=900);console.log('route ms',Math.round(performance.now()-routeStart));
const blocked=analyzeRoutes({requestId:2,floorId:'test',outline:rectRing(0,0,4000,2000),free:[[rectRing(0,0,1800,2000)],[rectRing(2000,0,2000,2000)]],resolution:25,requests:[{id:'b',name:'b',points:[[800,1000],[3200,1000]],target:900}]});assert.equal(blocked.results[0].status,'blocked');
const output=process.env.TEST_OUTPUT||'/tmp/xian-measure-checks';fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/first-floor.dxf',dxfDrawing(f,scene,dims,[],1));fs.writeFileSync(output+'/first-floor.csv',csvDrawing(f,dims,[],1));fs.writeFileSync(output+'/first-floor.svg',svgDrawing(f,scene,dims,[],1));fs.writeFileSync(output+'/migrated.json',JSON.stringify(s));console.log('PASS geometry, migration, rotations, clearances, routes and export fixtures');

const unrated=analyzeRoutes({requestId:3,floorId:'test',outline:rectRing(0,0,4000,2000),free:[[rectRing(0,0,4000,2000)]],resolution:25,requests:[{id:'u',name:'no target',points:[[800,1000],[3200,1000]],target:0}]});assert.equal(unrated.results[0].status,'unrated');assert(unrated.results[0].width!>0);
const zoneFloor=structuredClone(f);zoneFloor.pieces=[{id:'children',name:'儿童活动区',type:'zone',x:1700,y:500,w:500,h:1000,rotation:30}];const across=annotateRouteUse(zoneFloor,{...unrated.results[0],points:[[800,1000],[3200,1000]]});assert.match(across.note,/儿童活动区/);console.log('PASS optional route targets and route crossing child space');
