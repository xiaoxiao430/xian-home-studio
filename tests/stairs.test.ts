import assert from 'node:assert/strict';
import {defaultMaterial,safeSvg,validateState,type Floor,type Piece,type State} from '../lib/model';
import {configureLinkedStairs,getStairConfig,getStairPlanSvg,getStairSurveyWarnings,getStairVolumes,stairFootprintStudies,syncLinkedStairChange} from '../lib/stairs';
import {bbox,computeScene,pieceShapes} from '../lib/geometry';
import {enrichPiece} from '../lib/measurement-model';

const stair=(floor:string,x:number,y:number,w:number,h:number):Piece=>({id:floor+'-stairs',name:'原楼梯',type:'stair',x,y,w,h,rotation:0,original:{x,y,w,h}});
const floor=(id:string,piece:Piece):Floor=>({id,name:id,outline:[[0,0],[12000,0],[12000,9000],[0,9000]],originalOutline:[[0,0],[12000,0],[12000,9000],[0,9000]],rooms:[],pieces:[piece],source:'测试几何',note:''});
const source:State={version:2,floors:[floor('f1',stair('f1',2500,4500,1830,2250)),floor('f2',stair('f2',3400,4700,1834,2252))],materials:{f1:{...defaultMaterial},f2:{...defaultMaterial}},warnings:[]};
source.floors.forEach(f=>f.pieces.forEach(enrichPiece));
const sourceCopy=structuredClone(source),get=(s:State,i:number)=>s.floors[i].pieces[0];
const linked=configureLinkedStairs(source);
assert.deepEqual(source,sourceCopy,'installing study must not mutate source A/B');
assert(validateState(linked));
for(let i=0;i<2;i++)for(const key of ['x','y','w','h'] as const)assert.equal(get(linked,i)[key],get(source,i)[key],'source footprint preserved separately');
assert.equal(get(linked,0).stair!.level,'lower');assert.equal(get(linked,1).stair!.level,'upper');
assert.notEqual(get(linked,0).stair!.originalFootprint,get(linked,1).stair!.originalFootprint,'no shared mutable anchor');

const expanded=configureLinkedStairs(linked,{footprintMode:'expanded',extensionMm:600});
for(let i=0;i<2;i++){const a=get(source,i),b=get(expanded,i);assert.equal(b.y,a.y-600);assert.equal(b.y+b.h,a.y+a.h,'expansion goes into north hall, south edge fixed');assert.equal(b.x,a.x);assert.equal(b.w,a.w);}
for(let i=0;i<2;i++){const piece=get(expanded,i);assert.deepEqual(bbox(pieceShapes(piece)[0].ring),{x:piece.x,y:piece.y,w:piece.w,h:piece.h},'direct measurement footprint matches expanded model');const obstacle=computeScene(expanded.floors[i]).shapes.find(s=>s.objectId===piece.id)!;assert.equal(bbox(obstacle.ring).h,piece.h,'route obstacle includes extension');}
assert.equal(stairFootprintStudies(get(expanded,0)).extraAreaM2,1.098);
const restored=configureLinkedStairs(expanded,{footprintMode:'original'});
for(let i=0;i<2;i++)for(const key of ['x','y','w','h'] as const)assert.equal(get(restored,i)[key],get(source,i)[key]);
const taller=configureLinkedStairs(expanded,{riseMm:3200});
for(let i=0;i<2;i++){assert.equal(get(taller,i).heightMm,3200);assert.equal(get(taller,i).h,get(expanded,i).h,'vertical rise never repurposes plan depth');}

const drag=structuredClone(expanded);get(drag,0).x+=123;get(drag,0).y-=91;get(drag,0).rotation=90;get(drag,0).w+=150;
const synced=syncLinkedStairChange(expanded,drag);
assert.equal(get(synced,1).x-get(expanded,1).x,123);assert.equal(get(synced,1).y-get(expanded,1).y,-91);
assert.equal(get(synced,1).rotation,90);assert.equal(get(synced,1).w-get(expanded,1).w,150);
assert.equal(get(synced,1).stair!.footprintMode,'custom');assert.equal(get(synced,0).stair!.footprintMode,'custom');
assert.equal(Math.round(bbox(pieceShapes(get(synced,1))[0].ring).h),Math.round(get(synced,1).w),'rotation measurement footprint follows the edited width');
assert.deepEqual(syncLinkedStairChange(synced,expanded),expanded,'undo both floors is not applied twice');
assert.deepEqual(syncLinkedStairChange(expanded,synced),synced,'complete transaction is not applied twice');
const riseEdit=structuredClone(linked);get(riseEdit,1).heightMm=3150;
const riseSync=syncLinkedStairChange(linked,riseEdit);assert.equal(get(riseSync,0).stair!.riseMm,3150);assert.equal(get(riseSync,1).stair!.riseMm,3150);
const modeEdit=structuredClone(linked);get(modeEdit,1).stair!.footprintMode='expanded';
const modeSync=syncLinkedStairChange(linked,modeEdit);assert.equal(get(modeSync,0).y,get(linked,0).y-600);assert.equal(get(modeSync,1).y,get(linked,1).y-600);

const lower=getStairVolumes(get(linked,0)),upper=getStairVolumes(get(linked,1)),treads=(vs:typeof lower)=>vs.filter(v=>v.partId.startsWith('tread-'));
assert.equal(treads(lower).length,18);assert.equal(treads(upper).length,18);
assert.equal(Math.max(...treads(lower).map(v=>v.top)),3000);assert.equal(Math.max(...treads(upper).map(v=>v.top)),0,'upper treads arrive at datum and do not invent a third floor');
for(let i=0;i<treads(lower).length;i++)assert.equal(treads(lower)[i].top-treads(upper)[i].top,3000,'both floor diagrams represent the same stair');
assert(upper.some(v=>v.top<0));assert(lower.every(v=>v.provisional)&&upper.every(v=>v.provisional));
const oldUpper=getStairVolumes(get(source,1),'f2');assert.equal(Math.max(...treads(oldUpper).map(v=>v.top)),0,'legacy upper stair is resolved from floor context without storage migration');
assert.equal(getStairConfig(get(source,1),'f2').level,'upper');assert.deepEqual(source,sourceCopy);
const legacyMoved=structuredClone(source);get(legacyMoved,0).x+=300;get(legacyMoved,0).h+=180;const retained=configureLinkedStairs(legacyMoved);assert.equal(get(retained,0).x,get(legacyMoved,0).x);assert.equal(get(retained,0).h,get(legacyMoved,0).h);assert.equal(get(retained,0).stair!.footprintMode,'custom','initialization preserves existing user edits');
const rotated=getStairVolumes(get(synced,0));assert(rotated.every(v=>v.polygon.flat().every(p=>p.every(Number.isFinite))));
assert(safeSvg(getStairPlanSvg(get(linked,0))));assert(getStairPlanSvg(get(linked,0)).includes('上行'));assert(getStairPlanSvg(get(source,1),'f2').includes('下行'));
assert(getStairSurveyWarnings(get(linked,0)).some(s=>s.includes('紧凑')));
const measured=configureLinkedStairs(linked,{surveyStatus:'measured'});assert(getStairSurveyWarnings(get(measured,0)).some(s=>s.includes('方案示意')));assert(getStairVolumes(get(measured,0)).every(v=>v.provisional),'survey status never promotes schematic treads to construction approval');

const broken=structuredClone(linked);get(broken,0).stair!.riseMm=NaN;assert(!validateState(broken));
const wrongKind=structuredClone(linked);get(wrongKind,0).type='furniture';assert(!validateState(wrongKind));
const wrongFloor=structuredClone(linked);get(wrongFloor,1).stair!.level='lower';assert(!validateState(wrongFloor),'an upper-floor stair cannot be persisted as a new upward flight');
assert.throws(()=>configureLinkedStairs(linked,{extensionMm:-100}));assert.throws(()=>configureLinkedStairs(linked,{riseMm:NaN}));
console.log('PASS linked stairs: independent source anchors, footprint comparison, two-floor edit/undo, provisional U geometry and descending upper-floor model');
