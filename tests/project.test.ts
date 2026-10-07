import assert from 'node:assert/strict';
import {createProject,validateProject,normalizeProject,applyOperation,type Asset,type Project} from '../lib/project-model';
import {patchGroupedPiece,cloneStandalonePiece} from '../lib/scene-edit';
import {defaultMaterial,validateState,type State,type Floor,type Piece} from '../lib/model';
import {computeScene,measureSpec,pieceShapes,intersection,multiArea,dist} from '../lib/geometry';

// Synthetic two-floor fixture: no private plan or site photographs are bundled into tests.
const furniture=(id:string,name:string,x:number,y:number,w:number,h:number):Piece=>({id,name,type:'furniture',x,y,w,h,rotation:0,original:{x,y,w,h}});
const floor=(id:string):Floor=>({id,name:id==='f1'?'一楼':'二楼',outline:[[0,0],[12000,0],[12000,9000],[0,9000]],originalOutline:[[0,0],[12000,0],[12000,9000],[0,9000]],pieces:[],rooms:[],source:'测试用几何',note:'测试'});
const fixture:State={version:2,floors:[floor('f1'),floor('f2')],materials:{f1:{...defaultMaterial},f2:{...defaultMaterial}},warnings:[]};
fixture.floors[0].pieces=[
 furniture('f1-kitchen','大L厨房',0,0,2510,3280),furniture('f1-island','餐岛一体',1600,2250,2800,800),
 furniture('f1-sofa','沙发',6100,5000,2600,950),furniture('f1-desk','双人办公桌',6100,4400,2600,600),
 furniture('f1-office1','办公椅一',6390,3710,720,685),furniture('f1-office2','办公椅二',7690,3710,720,685),
 furniture('f1-tv','电视柜',6100,7750,2600,400),furniture('f1-bookcase','通顶书柜',5610,80,3915,350),
 furniture('f1-sideboard','餐边柜',3510,80,2100,600),furniture('f1-coffee','茶几',6840,6480,1120,550),
 furniture('f1-armchair','单人沙发',9580,6560,850,850),
 {id:'f1-children',name:'儿童活动区',type:'zone',x:7100,y:1000,w:2000,h:1200,rotation:0},
];
fixture.floors[1].pieces=[furniture('f2-bed','床',1000,1000,1800,2000)];
const original=structuredClone(fixture);
assert(validateState(fixture));
const project=createProject(fixture);
assert(validateProject(project));assert.deepEqual(fixture,original,'migration must not mutate existing layout');
const a=project.variants[0],b=project.variants[1];
for(const f of original.floors)for(const p of f.pieces){const actual=a.state.floors.find(q=>q.id===f.id)!.pieces.find(q=>q.id===p.id)!;for(const key of ['x','y','w','h','rotation'] as const)assert.equal(actual[key],p[key],'A geometry remains unchanged');}
assert.equal(a.state.floors[0].ceilingHeightMm,3000);assert.equal(a.state.floors[0].heightSource,'provisional');
assert.equal(a.state.floors[0].pieces.find(p=>p.id==='f1-desk')!.heightMm,750);
assert.deepEqual(normalizeProject(project),project);assert(validateProject(normalizeProject(fixture)));

const sofa=a.state.floors[0].pieces.find(p=>p.id==='f1-sofa')!;
const updated=applyOperation(project,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:sofa.id,patch:{x:sofa.x+130,y:sofa.y+40},linked:true});
assert.deepEqual(updated.variants[1],b,'A edits cannot change B');
assert.deepEqual(updated.variants[0].state.floors[1],a.state.floors[1],'first floor cannot change second floor');
assert.equal(updated.variants[0].layoutRevision,1);
assert.equal(project.variants[0].layoutRevision,0,'operations are pure');
for(const id of ['f1-desk','f1-office1','f1-office2']){const old=a.state.floors[0].pieces.find(p=>p.id===id)!,p=updated.variants[0].state.floors[0].pieces.find(p=>p.id===id)!;assert.equal(p.x-old.x,130);assert.equal(p.y-old.y,40);}

for(const sourceId of ['f1-sofa','f1-desk']){
 const copiedFloor=structuredClone(a.state.floors[0]),source=copiedFloor.pieces.find(p=>p.id===sourceId)!;
 const originalGroup=structuredClone(copiedFloor.pieces.filter(p=>p.groupId===source.groupId));
 const copy=cloneStandalonePiece(source,'standalone-copy');copiedFloor.pieces.push(copy);
 assert.equal(copy.groupId,undefined);assert.equal(source.groupId,'f1-sofa-office');
 patchGroupedPiece(copiedFloor,copy.id,{x:copy.x+400,rotation:90,w:3000},true);
 for(const originalMember of originalGroup)assert.deepEqual(copiedFloor.pieces.find(p=>p.id===originalMember.id),originalMember,'editing a single copy must not move or resize the original group');
 const detachedAfterEdit=structuredClone(copy);
 patchGroupedPiece(copiedFloor,'f1-sofa',{x:sofa.x+200},true);
 assert.deepEqual(copy,detachedAfterEdit,'moving the source group must not move a detached copy');
 assert.equal(copiedFloor.pieces.find(p=>p.id==='f1-desk')!.x,a.state.floors[0].pieces.find(p=>p.id==='f1-desk')!.x+200,'the original group still moves together');
}

const rot=applyOperation(project,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:'f1-sofa',patch:{rotation:90},linked:true});
const center=(p:Piece)=>[p.x+p.w/2,p.y+p.h/2] as [number,number];
for(const id of ['f1-desk','f1-office1','f1-office2']){const before=a.state.floors[0].pieces.find(p=>p.id===id)!,after=rot.variants[0].state.floors[0].pieces.find(p=>p.id===id)!;assert.equal(after.rotation,90);assert(Math.abs(dist(center(before),center(sofa))-dist(center(after),center(rot.variants[0].state.floors[0].pieces.find(p=>p.id===sofa.id)!)))<.001);}
const resized=applyOperation(rot,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:'f1-desk',patch:{w:3200,h:700},linked:true});
const editedFloor=resized.variants[0].state.floors[0];
assert.equal(editedFloor.pieces.find(p=>p.id==='f1-sofa')!.w,3200);
assert.equal(editedFloor.pieces.find(p=>p.id==='f1-desk')!.heightMm,750,'depth is not vertical height');
for(const id of ['f1-office1','f1-office2']){const chair=editedFloor.pieces.find(p=>p.id===id)!;assert.equal(chair.w,720);assert.equal(chair.h,685);}
const desk=editedFloor.pieces.find(p=>p.id==='f1-desk')!,nextSofa=editedFloor.pieces.find(p=>p.id==='f1-sofa')!;
assert(Math.abs(dist(center(desk),center(nextSofa))-(desk.h+nextSofa.h)/2)<.001,'desk stays against sofa after rotation and resize');
const height=applyOperation(resized,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:'f1-desk',patch:{heightMm:780,dimensionSource:'design'},linked:false});
assert.equal(height.variants[0].state.floors[0].pieces.find(p=>p.id==='f1-desk')!.h,700);

const cab=applyOperation(project,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:'f1-bookcase',patch:{w:4500},linked:true});
const cabinet=cab.variants[0].state.floors[0].pieces.find(p=>p.id==='f1-bookcase')!;
assert(Math.abs(cabinet.cabinet!.columns.reduce((n,c)=>n+c.width,0)-4500)<.001);
const open=applyOperation(cab,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:cabinet.id,patch:{cabinet:{...cabinet.cabinet!,doorOpen:true}},linked:false});
assert.equal(open.variants[0].state.floors[0].pieces.find(p=>p.id===cabinet.id)!.usage!.open,true);
const uncab=applyOperation(open,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:cabinet.id,patch:{cabinet:undefined},linked:false});
assert.equal(uncab.variants[0].state.floors[0].pieces.find(p=>p.id===cabinet.id)!.cabinet,undefined);
const persisted=applyOperation(uncab,{type:'replaceVariant',variantId:'a',state:uncab.variants[0].state});
assert.equal(persisted.variants[0].state.floors[0].pieces.find(p=>p.id===cabinet.id)!.cabinet,undefined,'saving must not recreate a deliberately removed cabinet');

const bf=b.state.floors[0],scene=computeScene(bf);assert(scene.valid);
const attached=measureSpec(bf,{id:'connection',name:'厨房连接',a:{kind:'object',objectId:'f1-kitchen'},b:{kind:'object',objectId:'f1-island',partId:'body'},mode:'shortest',pinned:false},scene);
assert.equal(attached.status,'contact');assert.equal(attached.value,0);
const shapes=pieceShapes(bf.pieces.find(p=>p.id==='f1-kitchen')!);
const islandShapes=pieceShapes(bf.pieces.find(p=>p.id==='f1-island')!);
assert.equal(multiArea(intersection([[shapes[0].ring]],[[islandShapes[0].ring]])),0,'connected counters touch without overlap');
const expanded=structuredClone(bf),island=expanded.pieces.find(p=>p.id==='f1-island')!;island.usage!.table='extended';
assert.equal(pieceShapes(island).filter(s=>s.partId.startsWith('extra-')).length,2,'six-seat state keeps extra chair footprints');
patchGroupedPiece(expanded,'f1-island',{w:3000},false);
const chair=pieceShapes(island).find(s=>s.partId==='chair-n0')!;
assert(Math.abs(dist(chair.ring[0],chair.ring[1])-550)<.001,'chair widths do not scale when island stretches');
patchGroupedPiece(expanded,'f1-island',{islandWorkLengthMm:1100},false);
assert.equal(island.parts!.find(p=>p.id==='body')!.ring[1][0],1100);
assert(Math.abs(dist(pieceShapes(island).find(s=>s.partId==='chair-n0')!.ring[0],pieceShapes(island).find(s=>s.partId==='chair-n0')!.ring[1])-550)<.001);
const beam=applyOperation(project,{type:'patchPiece',variantId:'a',floorId:'f2',objectId:'f2-bed',patch:{architecturalKind:'beam',elevationMm:2600,heightMm:400},linked:false});
assert(validateProject(beam));
assert.throws(()=>applyOperation(project,{type:'patchPiece',variantId:'a',floorId:'f2',objectId:'f2-bed',patch:{architecturalKind:'invalid' as any}}));

const asset:Asset={id:'ref-1',name:'参考图',kind:'reference',space:'客厅',floorId:'f1',scope:'candidate',note:'仅参考关系',mime:'image/png',createdAt:new Date().toISOString()};
let media=applyOperation(project,{type:'updateAsset',asset});
media=applyOperation(media,{type:'addRender',render:{id:'render-1',assetId:asset.id,variantId:'a',floorId:'f1',layoutRevision:0,createdAt:asset.createdAt,stale:false,note:'概念图'}});
const change=applyOperation(media,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:'f1-sofa',patch:{x:6200}});
assert.equal(change.renders[0].stale,true);assert.equal(media.renders[0].stale,false);
const copy=applyOperation(project,{type:'cloneVariant',variantId:'b',newId:'c',name:'比较副本'});
assert.equal(copy.variants.length,3);assert.notEqual(copy.variants[2].state,copy.variants[1].state);
assert(copy.issues.some(i=>i.variantId==='c'),'clone copies unresolved design issues');

for(const damage of [(p:Project)=>{p.variants[0].state.floors[0].pieces[0].heightMm=NaN;},(p:Project)=>{p.variants[0].state.floors[0].heightSource='unknown' as any;},(p:Project)=>{p.variants[0].state.floors[0].pieces.find(x=>x.cabinet)!.cabinet!.columns[0].width=1;},(p:Project)=>{p.variants.push(structuredClone(p.variants[0]));},(p:Project)=>{p.variants[0].layoutRevision=-1;}]){const invalid=structuredClone(project);damage(invalid);assert.equal(validateProject(invalid),false);}
assert.throws(()=>applyOperation(project,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:'f1-sofa',patch:{heightMm:-1}}));
assert.throws(()=>applyOperation(project,{type:'patchPiece',variantId:'a',floorId:'f1',objectId:'missing',patch:{x:10}}));
assert.throws(()=>normalizeProject({version:4}));
assert.throws(()=>applyOperation(project,JSON.parse('{"type":"patchPiece","variantId":"a","floorId":"f1","objectId":"f1-sofa","patch":{"__proto__":{"polluted":true}}}')));
console.log('PASS project migration, variants, grouped rotations and resizing, vertical dimensions, cabinet widths, media revisions and validation');
