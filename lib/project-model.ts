import {clone,validateState,type State,type Floor,type Piece,type DimensionSource} from './model';
import {migrateState} from './measurement-model';
import {patchGroupedPiece,refreshIslandParts} from './scene-edit';

export type Variant={id:string;name:string;state:State;updatedAt:string;layoutRevision:number};
export type Asset={id:string;name:string;kind:'drawing'|'site'|'reference'|'render'|'construction';space:string;floorId:string;variantId?:string;objectId?:string;scope:string;note:string;mime:string;createdAt:string;url?:string;size?:number;sha256?:string};
export type Issue={id:string;title:string;note:string;floorId:string;variantId?:string;objectId?:string;status:'open'|'resolved';createdAt:string};
export type Render={id:string;assetId:string;variantId:string;floorId:string;layoutRevision:number;createdAt:string;stale:boolean;note:string};
export type Project={version:4;id:string;name:string;variants:Variant[];assets:Asset[];issues:Issue[];renders:Render[]};
export type Operation=
 |{type:'replaceVariant';variantId:string;state:State}
 |{type:'patchPiece';variantId:string;floorId:string;objectId:string;patch:Partial<Piece>;linked?:boolean}
 |{type:'cloneVariant';variantId:string;newId?:string;name?:string}
 |{type:'renameVariant';variantId:string;name:string}
 |{type:'updateAsset';asset:Asset}
 |{type:'addIssue';issue:Issue}
 |{type:'updateIssue';issueId:string;patch:Partial<Issue>}
 |{type:'deleteIssue';issueId:string}
 |{type:'addRender';render:Render};

const now=()=>new Date().toISOString();
const id=()=>globalThis.crypto.randomUUID();
const sources:DimensionSource[]=['drawing','measured','design','provisional'];

export function defaultPieceHeight(p:Piece,ceiling=3000){
 if(p.type==='zone')return 10;
 if(p.type==='wall'||p.type==='stair')return ceiling;
 if(p.type==='opening')return p.openingKind==='window'||p.name.includes('窗')?1500:2100;
 if(/冰箱|通顶|清洁柜|高柜|衣柜|衣帽/.test(p.name))return Math.max(1000,ceiling-50);
 if(/电视柜/.test(p.name))return 400;
 if(/电视/.test(p.name))return 900;
 if(/茶几/.test(p.name))return 400;
 if(/床/.test(p.name))return 550;
 if(/办公桌|书桌|餐桌/.test(p.name))return 750;
 if(/椅/.test(p.name))return 900;
 if(/沙发/.test(p.name))return 850;
 if(/厨房|餐岛|洗烘|池|餐边/.test(p.name))return 850;
 if(/柜/.test(p.name))return 2400;
 return 800;
}

/** Adds explicitly provisional vertical data; never changes existing plan geometry. */
export function augmentFloor(floor:Floor):Floor{
 floor.ceilingHeightMm??=3000;floor.heightSource??='provisional';
 for(const p of floor.pieces){
  const needsVerticalDefaults=p.heightMm===undefined||p.dimensionSource===undefined;
  p.heightMm??=defaultPieceHeight(p,floor.ceilingHeightMm);
  p.elevationMm??=p.type==='opening'&&(p.openingKind==='window'||p.name.includes('窗'))?900:0;
  p.dimensionSource??='provisional';
  if(needsVerticalDefaults&&p.type==='furniture'&&/柜/.test(p.name)&&!p.cabinet){
   const count=Math.max(1,Math.ceil(p.w/650)),width=p.w/count;
   p.cabinet={columns:Array.from({length:count},(_,i)=>({width,shelves:/书|通顶/.test(p.name)?4:2,drawers:/餐边|电视/.test(p.name)?2:0,open:false,hinge:i%2?'right':'left'})),plinthMm:80,topGapMm:20,doorOpen:false};
  }
  if(needsVerticalDefaults&&['f1-sofa','f1-desk','f1-office1','f1-office2'].includes(p.id))p.groupId??='f1-sofa-office';
  if(p.id==='f1-island'){
   p.partHeightsMm??={};
   for(const part of p.parts||[])p.partHeightsMm[part.id]??=part.id==='body'?p.heightMm:part.id==='extension'?750:850;
  }
 }
 return floor;
}

export function augmentState(input:State):State{
 const state=migrateState(input);state.floors.forEach(augmentFloor);return state;
}

function makeSchemeB(input:State):State{
 const state=clone(input),f=state.floors.find(f=>f.id==='f1')!;
 const edits:Record<string,Partial<Piece>>={
  'f1-tv':{x:6000,y:80,w:2600,h:400,rotation:180},
  'f1-sofa':{x:6000,y:2280,w:2600,h:950,rotation:180},
  'f1-desk':{x:6000,y:3230,w:2600,h:600,rotation:180},
  'f1-office1':{x:6290,y:3835,w:720,h:685,rotation:180},
  'f1-office2':{x:7590,y:3835,w:720,h:685,rotation:180},
  'f1-coffee':{x:6740,y:1200,w:1120,h:550,rotation:0},
  'f1-children':{x:6500,y:5550,w:2000,h:1200,rotation:0},
  'f1-bookcase':{x:5400,y:7790,w:3915,h:350,rotation:0},
  'f1-armchair':{x:4750,y:5500,w:850,h:850,rotation:0},
  // The working end touches the long kitchen arm. No detached bridge blocks the entry.
  'f1-island':{x:600,y:2250,w:2400,h:800,rotation:0,islandWorkLengthMm:800},
  'f1-cleaning':{x:9555,y:4015,w:700,h:350,rotation:270,name:'清洁工具浅柜（容量待核）'},
 };
 for(const [pieceId,patch] of Object.entries(edits))if(f.pieces.some(p=>p.id===pieceId))patchGroupedPiece(f,pieceId,patch,false);
 const kitchen=f.pieces.find(p=>p.id==='f1-kitchen');
 if(kitchen){
  kitchen.h=3050;kitchen.baseW=2510;kitchen.baseH=3050;
  kitchen.parts=[{id:'body',name:'连续大L操作台（末端衔接餐岛）',ring:[[0,0],[2310,0],[2310,80],[2510,80],[2510,600],[600,600],[600,3050],[0,3050]]}];
  kitchen.svg='<polygon points="'+kitchen.parts[0].ring.map(p=>p.join(',')).join(' ')+'" fill="#dce5df" stroke="#71837c" stroke-width="12"/><rect x="110" y="1550" width="390" height="650" rx="35" fill="#f4f7f3" stroke="#71837c" stroke-width="12"/><rect x="900" y="95" width="850" height="400" rx="20" fill="#f4f7f3" stroke="#71837c" stroke-width="12"/>';
 }
 const island=f.pieces.find(p=>p.id==='f1-island');
 if(island){refreshIslandParts(island);island.usage={table:'compact',chairs:'seated'};}
 const additions:Piece[]=[
  {id:'f1-b-transition',name:'餐边与电视过渡柜',type:'furniture',x:5610,y:80,w:390,h:400,rotation:180,source:'方案B初稿，待设计师深化'},
  // Local width is the cabinet facade, so shelf/door geometry rotates with it.
  {id:'f1-b-balcony-bookcase',name:'阳台侧独立浅高柜',type:'furniture',x:9305,y:5225,w:1200,h:350,rotation:90,source:'方案B初稿，独立摆放；高度及固定方式待确认'},
 ];
 for(const piece of additions)if(!f.pieces.some(p=>p.id===piece.id))f.pieces.push(piece);
 augmentFloor(f);
 const balconyCab=f.pieces.find(p=>p.id==='f1-b-balcony-bookcase');if(balconyCab)balconyCab.heightMm=2400;
 f.note='方案B概念初稿：餐边柜连接电视；沙发背双人办公；儿童区和原书柜向下方移。尺寸可调整，厨房进入动线、柜门开启与阳台条件仍待核验。';
 // Preserve semantic anchors after rotating the living room. Local edges rotate with objects.
 for(const m of f.measurements||[])if(m.id==='viewing'){
  m.a={kind:'local',objectId:'f1-sofa',point:[1300,350]};m.b={kind:'local',objectId:'f1-tv',point:[1300,100]};
 }
 state.warnings=Array.from(new Set([...state.warnings,'方案B为可编辑概念初稿，通道参考目标可以调整；实体重叠、未验证高度和未确定设备开启范围不能视为已通过。']));
 return state;
}

export function createProject(input:State):Project{
 if(!validateState(input))throw Error('原布局数据无效，未创建项目');
 const a=augmentState(input),stamp=now();
 const project:Project={version:4,id:id(),name:'西安的家',variants:[{id:'a',name:'方案 A · 原布局',state:a,updatedAt:stamp,layoutRevision:0},{id:'b',name:'方案 B · 客厅与儿童区换向',state:makeSchemeB(a),updatedAt:stamp,layoutRevision:0}],assets:[],issues:[],renders:[]};
 const add=(title:string,note:string,floorId:string,variantId?:string,objectId?:string)=>project.issues.push({id:id(),title,note,floorId,...(variantId?{variantId}:{}),...(objectId?{objectId}:{}),status:'open',createdAt:stamp});
 for(const floor of a.floors)if(floor.heightSource==='provisional'||floor.pieces.some(p=>p.dimensionSource==='provisional'))add('补充竖向实测资料','层高、梁底、窗台、门洞和家具高度目前使用明确标识的示意值；未实测项目不能作为已核实的施工尺寸。',floor.id);
 add('复核厨房与餐岛使用动线','餐岛工作端已与L台面实体连接，800工作段＋1600餐桌段，展开再加600。进入厨房仍需绕餐岛东端，六人展开比日常四人绕行更长；该研究稿不代表最终动线已确认。厨房台面长边3050是方案初值，水电、设备开启及接合做法待复核。','f1','b','f1-island');
 add('确认阳台侧柜及生活设备通行','浅高柜独立放在阳台侧，清洁工具柜改为350深、面朝外窗侧，闭门时外窗侧几何净距约948。柜门打开后通行会收窄；清洁设备能否装入350深柜、设备检修、采光和固定方式均待现场确认。','f1','b','f1-b-balcony-bookcase');
 add('确认儿童及办公收纳分配','原通顶书柜迁至儿童区后侧，阳台侧补独立浅高柜；柜内分格为示意，需按书籍、玩具、办公用品逐项确认容量与取用高度。','f1','b','f1-bookcase');
 add('确认建筑与拆改依据','阳台外推、原墙和楼梯变化均为概念研究；承重性质、外推条件与专业设计依据需要单独确认。','all');
 if(!validateProject(project))throw Error('项目初始化校验失败');
 return project;
}

const text=(v:unknown,max=200)=>typeof v==='string'&&v.length<=max;
const ident=(v:unknown)=>text(v,128)&&!!v&&/^[\w:-]+$/.test(v as string);
const stamp=(v:unknown)=>text(v,64)&&Number.isFinite(Date.parse(v as string));
const floorId=(v:unknown)=>['f1','f2','all',''].includes(v as string);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const unique=(items:{id:string}[])=>new Set(items.map(v=>v.id)).size===items.length;
function safeData(v:unknown,depth=0):boolean{
 if(depth>24)return false;
 if(Array.isArray(v))return v.length<=20000&&v.every(x=>safeData(x,depth+1));
 if(record(v))return Object.entries(v).every(([key,val])=>!['__proto__','prototype','constructor'].includes(key)&&safeData(val,depth+1));
 return v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||v===undefined;
}

export function validateProject(value:unknown):value is Project{
 try{
  if(!record(value)||!safeData(value))return false;
  const p=value as unknown as Project;
  if(p.version!==4||!ident(p.id)||!text(p.name)||!p.name.trim()||!Array.isArray(p.variants)||!p.variants.length||p.variants.length>30||!Array.isArray(p.assets)||p.assets.length>3000||!Array.isArray(p.issues)||p.issues.length>10000||!Array.isArray(p.renders)||p.renders.length>2000)return false;
  if(!p.variants.every(v=>record(v)&&ident(v.id)&&text(v.name)&&!!v.name.trim()&&stamp(v.updatedAt)&&Number.isInteger(v.layoutRevision)&&v.layoutRevision>=0&&validateState(v.state)&&v.state.floors.every(f=>f.ceilingHeightMm!==undefined&&sources.includes(f.heightSource!)&&f.pieces.every(o=>o.heightMm!==undefined&&o.elevationMm!==undefined&&sources.includes(o.dimensionSource!)))))return false;
  const hasVariant=(variantId:unknown)=>variantId===undefined||p.variants.some(v=>v.id===variantId);
  if(!p.assets.every(a=>record(a)&&ident(a.id)&&text(a.name,500)&&['drawing','site','reference','render','construction'].includes(a.kind)&&text(a.space)&&floorId(a.floorId)&&hasVariant(a.variantId)&&(a.objectId===undefined||text(a.objectId))&&text(a.scope)&&text(a.note,30000)&&text(a.mime,200)&&stamp(a.createdAt)&&(a.url===undefined||text(a.url,3000)&&!/^\s*(?:javascript|data|vbscript):/i.test(a.url))&&(a.size===undefined||Number.isSafeInteger(a.size)&&a.size>=0)&&(a.sha256===undefined||/^[a-f\d]{64}$/i.test(a.sha256))))return false;
  if(!p.issues.every(i=>record(i)&&ident(i.id)&&text(i.title,500)&&!!i.title.trim()&&text(i.note,30000)&&floorId(i.floorId)&&hasVariant(i.variantId)&&(i.objectId===undefined||text(i.objectId))&&['open','resolved'].includes(i.status)&&stamp(i.createdAt)))return false;
  if(!p.renders.every(r=>record(r)&&ident(r.id)&&ident(r.assetId)&&p.assets.some(a=>a.id===r.assetId)&&hasVariant(r.variantId)&&p.variants.some(v=>v.id===r.variantId)&&['f1','f2'].includes(r.floorId)&&Number.isSafeInteger(r.layoutRevision)&&r.layoutRevision>=0&&stamp(r.createdAt)&&typeof r.stale==='boolean'&&text(r.note,30000)))return false;
  return [p.variants,p.assets,p.issues,p.renders].every(unique);
 }catch{return false;}
}

export function normalizeProject(input:unknown):Project{
 if(validateProject(input))return clone(input);
 if(validateState(input))return createProject(input);
 throw Error('项目文件无效或版本不受支持');
}

export function applyOperation(input:Project,op:Operation):Project{
 if(!validateProject(input)||!record(op)||!safeData(op))throw Error('项目或修改指令无效');
 const project=clone(input),timestamp=now();
 const variant=(variantId:string)=>{const v=project.variants.find(v=>v.id===variantId);if(!v)throw Error('未找到方案');return v;};
 const changed=(v:Variant)=>{v.updatedAt=timestamp;v.layoutRevision++;for(const render of project.renders)if(render.variantId===v.id)render.stale=true;};
 switch(op.type){
  case 'replaceVariant':{if(!validateState(op.state))throw Error('布局数据无效');const v=variant(op.variantId);v.state=augmentState(op.state);changed(v);break;}
  case 'patchPiece':{const v=variant(op.variantId),floor=v.state.floors.find(f=>f.id===op.floorId);if(!floor||!record(op.patch))throw Error('楼层或对象修改无效');patchGroupedPiece(floor,op.objectId,op.patch,op.linked!==false);changed(v);break;}
  case 'cloneVariant':{const source=variant(op.variantId),copy=clone(source);copy.id=op.newId||id();if(project.variants.some(v=>v.id===copy.id))throw Error('方案标识已存在');copy.name=op.name||source.name+' · 副本';copy.updatedAt=timestamp;project.variants.push(copy);for(const issue of input.issues.filter(i=>i.variantId===source.id))project.issues.push({...clone(issue),id:id(),variantId:copy.id,createdAt:timestamp});break;}
  case 'renameVariant':{const v=variant(op.variantId);v.name=op.name;v.updatedAt=timestamp;break;}
  case 'updateAsset':{const index=project.assets.findIndex(a=>a.id===op.asset?.id);if(index<0)project.assets.push(clone(op.asset));else project.assets[index]=clone(op.asset);break;}
  case 'addIssue':{if(project.issues.some(i=>i.id===op.issue?.id))throw Error('问题标识已存在');project.issues.push(clone(op.issue));break;}
  case 'updateIssue':{const issue=project.issues.find(i=>i.id===op.issueId);if(!issue||!record(op.patch))throw Error('问题不存在');if(op.patch.id!==undefined&&op.patch.id!==issue.id)throw Error('问题标识不能更改');Object.assign(issue,clone(op.patch));break;}
  case 'deleteIssue':{if(!project.issues.some(i=>i.id===op.issueId))throw Error('问题不存在');project.issues=project.issues.filter(i=>i.id!==op.issueId);break;}
  case 'addRender':{if(project.renders.some(r=>r.id===op.render?.id))throw Error('效果图标识已存在');const render=clone(op.render),v=variant(render.variantId);render.stale=render.stale||render.layoutRevision!==v.layoutRevision;project.renders.push(render);break;}
  default:throw Error('不支持的修改指令');
 }
 if(!validateProject(project))throw Error('修改后数据无效，原方案已保留');
 return project;
}
