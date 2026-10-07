import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyOperation,createProject,normalizeProject,validateProject,type Project} from '../lib/project-model';
import {defaultMaterial,type Floor,type Piece,type State} from '../lib/model';
import {cloneStandalonePiece,patchGroupedPiece} from '../lib/scene-edit';
import {configureLinkedStairs,syncLinkedStairChange} from '../lib/stairs';
import {bbox,pieceShapes} from '../lib/geometry';

// Private plans may be supplied locally; public tests contain only synthetic geometry.
const floor=(id:string):Floor=>({id,name:id,outline:[[0,0],[12100,0],[12100,8500],[0,8500]],originalOutline:[[0,0],[12100,0],[12100,8500],[0,8500]],pieces:[],rooms:[],source:'integration test fixture',note:''});
const piece=(id:string,type:Piece['type'],x:number,y:number,w:number,h:number):Piece=>({id,name:id,type,x,y,w,h,rotation:0,original:{x,y,w,h}});
const state:State={version:2,floors:[floor('f1'),floor('f2')],materials:{f1:{...defaultMaterial},f2:{...defaultMaterial}},warnings:[]};
state.floors[0].pieces=[piece('f1-stairs','stair',2500,4500,1830,2250),piece('f1-sofa','furniture',7000,5000,2600,950)];
state.floors[1].pieces=[piece('f2-wall-06','wall',3210,99,198,604),piece('f2-wall-22','wall',3279,1821,129,1488),piece('f2-opening-13','opening',2209,3413,781,198),piece('f2-opening-14','opening',3210,3792,198,898),piece('f2-opening-11','opening',3469,3309,781,121),piece('f2-opening-12','opening',5121,3309,1191,121),piece('f2-opening-10','opening',7011,721,99,1190),piece('f2-wall-31','wall',7011,1911,99,2800),piece('f2-opening-18','opening',10411,1113,198,2748),piece('f2-stairs','stair',3408,4690,1834,2252)];
state.floors[1].pieces.push(piece('f2-opening-15','opening',6092,4690,807,125),piece('f2-opening-16','opening',7020,4897,112,1001));
let source=createProject(state);
if(process.env.MASTER_SUITE_FIXTURE){const doc=JSON.parse(readFileSync(process.env.MASTER_SUITE_FIXTURE,'utf8'));source=normalizeProject(doc.project||doc);}
assert(source.variants.some(v=>v.id==='a')&&source.variants.some(v=>v.id==='b'),'fixture must include saved base A/B');
const sourceBytes=JSON.stringify(source),sourceVariantBytes=new Map(source.variants.map(v=>[v.id,JSON.stringify(v)]));
const studies=applyOperation(source,{type:'createMasterStudies',variantIds:['a','b']});
assert.equal(JSON.stringify(source),sourceBytes,'creating studies must not mutate input project');
assert.equal(studies.variants.length,source.variants.length+4);
for(const v of source.variants)assert.equal(JSON.stringify(studies.variants.find(a=>a.id===v.id)),sourceVariantBytes.get(v.id),'base variants remain bytewise unchanged');
assert.deepEqual(studies.assets,source.assets,'existing private asset associations stay intact');

const variant=(project:Project,id='a-suite-dry')=>project.variants.find(v=>v.id===id)!;
const get=(project:Project,floorId:string,id:string,variantId='a-suite-dry')=>variant(project,variantId).state.floors.find(f=>f.id===floorId)!.pieces.find(p=>p.id===id)!;
for(const sourceId of ['a','b'])for(const makeup of ['dry','window'] as const){
 const study=variant(studies,sourceId+'-suite-'+makeup),original=variant(source,sourceId);
 assert.deepEqual(study.suiteStudy,{baseVariantId:sourceId,baseLayoutRevision:original.layoutRevision,makeup});
 const f1=study.state.floors.find(f=>f.id==='f1')!,old=original.state.floors.find(f=>f.id==='f1')!;
 assert.deepEqual(f1.outline,old.outline);assert.deepEqual(f1.originalOutline,old.originalOutline);assert.deepEqual(f1.measurements,old.measurements);assert.deepEqual(f1.routes,old.routes);
 assert.equal(f1.pieces.length,old.pieces.length);
 for(const previous of old.pieces){const current=f1.pieces.find(p=>p.id===previous.id)!;
  for(const key of ['x','y','w','h','rotation','visible','locked','original'] as const)assert.deepEqual(current[key],previous[key],'first-floor owner geometry must stay intact');
  if(previous.type!=='stair')for(const key of ['parts','heightMm','elevationMm','cabinet','svg'] as const)assert.deepEqual(current[key],previous[key],'palette cannot alter first-floor objects');
 }
 assert.equal(study.state.materials.f1.wood,'#594335');assert.equal(study.state.materials.f2.floor,'#c7b5a0');
 assert(study.state.floors.every(f=>f.pieces.find(p=>p.id===f.id+'-stairs')?.stair));
 assert(study.state.floors[1].pieces.some(p=>p.id==='f2-suite-double-vanity'));
 assert(study.state.floors[1].measurements!.length>0&&study.state.floors[1].routes!.length>0);
}
assert(validateProject(studies));assert.deepEqual(normalizeProject(JSON.parse(JSON.stringify(studies))),studies,'serialize/reload preserves complete studies and parameters');
assert.throws(()=>applyOperation(studies,{type:'createMasterStudies',variantIds:['a','b']}),/已有两版主卧/,'repeat request cannot overwrite studied layouts');
assert.equal(JSON.stringify(source),sourceBytes);

const studyBytes=new Map(studies.variants.map(v=>[v.id,JSON.stringify(v)]));
const bed=get(studies,'f2','f2-suite-bed');
const bedMoved=applyOperation(studies,{type:'patchPiece',variantId:'a-suite-dry',floorId:'f2',objectId:bed.id,patch:{x:bed.x+120,w:bed.w+100}});
for(const v of bedMoved.variants)if(v.id!=='a-suite-dry')assert.equal(JSON.stringify(v),studyBytes.get(v.id),'one suite edit cannot leak into other combinations');
assert.equal(get(studies,'f2',bed.id).x,bed.x);

const first=get(studies,'f1','f1-stairs'),second=get(studies,'f2','f2-stairs');
const dragged=applyOperation(studies,{type:'patchPiece',variantId:'a-suite-dry',floorId:'f1',objectId:first.id,patch:{x:first.x+140,y:first.y-80,w:first.w+60}});
assert.equal(get(dragged,'f2',second.id).x,second.x+140);assert.equal(get(dragged,'f2',second.id).y,second.y-80);assert.equal(get(dragged,'f2',second.id).w,second.w+60);
assert.equal(get(dragged,'f1',first.id).stair!.footprintMode,'custom');
assert.equal(get(dragged,'f2',second.id).stair!.footprintMode,'custom');
assert.equal(bbox(pieceShapes(get(dragged,'f2',second.id))[0].ring).w,second.w+60);
const restored=applyOperation(dragged,{type:'replaceVariant',variantId:'a-suite-dry',state:variant(studies).state});
assert.deepEqual(variant(restored).state,variant(studies).state,'undo is one whole two-floor transaction');

const raw=structuredClone(variant(studies).state),upper=raw.floors[1].pieces.find(p=>p.id===second.id)!;upper.y-=90;upper.rotation=180;
const replaced=applyOperation(studies,{type:'replaceVariant',variantId:'a-suite-dry',state:raw});
assert.equal(get(replaced,'f1',first.id).y,first.y-90);assert.equal(get(replaced,'f1',first.id).rotation,180);
const alreadyReconciled=syncLinkedStairChange(variant(studies).state,raw);
const editorSaved=applyOperation(studies,{type:'replaceVariant',variantId:'a-suite-dry',state:alreadyReconciled});
assert.deepEqual(variant(editorSaved).state,alreadyReconciled,'Editor plus API reconciliation never applies the delta twice');

const expanded=applyOperation(studies,{type:'patchPiece',variantId:'a-suite-dry',floorId:'f2',objectId:second.id,patch:{stair:{...second.stair!,footprintMode:'expanded',extensionMm:500}}});
for(const floorId of ['f1','f2']){const a=get(studies,floorId,floorId+'-stairs'),b=get(expanded,floorId,a.id);assert.equal(b.y,a.stair!.originalFootprint.y-500);assert.equal(b.h,a.stair!.originalFootprint.h+500);}
const configState=configureLinkedStairs(variant(studies).state,{footprintMode:'expanded',extensionMm:750,riseMm:3100});
const configSaved=applyOperation(studies,{type:'replaceVariant',variantId:'a-suite-dry',state:configState});assert.deepEqual(variant(configSaved).state,configState,'comparison application survives API synchronization unchanged');
assert.throws(()=>applyOperation(studies,{type:'patchPiece',variantId:'a-suite-dry',floorId:'f2',objectId:second.id,patch:{stair:{...second.stair!,riseMm:-100}}}));
assert.throws(()=>applyOperation(studies,{type:'patchPiece',variantId:'a-suite-dry',floorId:'f2',objectId:second.id,patch:{stair:{...second.stair!,level:'lower'}}}));
assert.equal(JSON.stringify(studies.variants.find(v=>v.id==='a')),sourceVariantBytes.get('a'));

const copyState=structuredClone(variant(studies).state),copy=cloneStandalonePiece(first,'unlinked-copy');copyState.floors[0].pieces.push(copy);
assert.equal(copy.stair,undefined);assert.equal(copy.original,undefined);
const copied=applyOperation(studies,{type:'replaceVariant',variantId:'a-suite-dry',state:copyState});
const originalPair=[structuredClone(get(copied,'f1',first.id)),structuredClone(get(copied,'f2',second.id))];
const looseMoved=applyOperation(copied,{type:'patchPiece',variantId:'a-suite-dry',floorId:'f1',objectId:copy.id,patch:{x:copy.x+300}});
assert.deepEqual(get(looseMoved,'f1',first.id),originalPair[0]);assert.deepEqual(get(looseMoved,'f2',second.id),originalPair[1]);
const primaryMoved=applyOperation(looseMoved,{type:'patchPiece',variantId:'a-suite-dry',floorId:'f1',objectId:first.id,patch:{x:first.x+200}});
assert.deepEqual(get(primaryMoved,'f1',copy.id),get(looseMoved,'f1',copy.id),'linked pair cannot pull a standalone copy');
const copiedVariant=applyOperation(studies,{type:'cloneVariant',variantId:'a-suite-dry',newId:'independent-study-copy'});
const changedCopy=applyOperation(copiedVariant,{type:'patchPiece',variantId:'independent-study-copy',floorId:'f1',objectId:first.id,patch:{y:first.y-180}});
assert.deepEqual(variant(changedCopy).state,variant(studies).state,'shared stair ID is scoped to each variant');
assert(validateProject(normalizeProject(JSON.parse(JSON.stringify(changedCopy)))));

// Match Editor behavior: whole-state reconciliation after same-floor geometry mutation.
const edited=structuredClone(variant(studies).state);patchGroupedPiece(edited.floors[0],first.id,{h:first.h+170});
const inEditor=syncLinkedStairChange(variant(studies).state,edited),saved=applyOperation(studies,{type:'replaceVariant',variantId:'a-suite-dry',state:inEditor});
assert.equal(get(saved,'f2',second.id).h,second.h+170);assert.equal(bbox(pieceShapes(get(saved,'f2',second.id))[0].ring).h,second.h+170);
console.log('PASS master integration: originals preserved bytewise, four independent combinations, source geometry, linked edits/undo/copy, validation and round-trip persistence'+(process.env.MASTER_SUITE_FIXTURE?' (private latest-project fixture)':''));
