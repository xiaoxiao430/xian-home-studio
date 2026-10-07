import {clone,type Floor,type Piece} from './model';
import {rectRing,type Part} from './measurement-model';

const turn=(angle:number)=>((angle%360)+360)%360;
const rotate=(x:number,y:number,angle:number)=>{const a=angle*Math.PI/180;return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)] as const;};
const center=(p:Piece)=>[p.x+p.w/2,p.y+p.h/2] as const;

/** A single-object copy starts a new independent object, never joins its source group. */
export function cloneStandalonePiece(piece:Piece,newId=globalThis.crypto.randomUUID()):Piece{
 const copy={...clone(piece),id:newId,name:piece.name+'副本',x:piece.x+250,y:piece.y+250};
 delete copy.original;delete copy.groupId;delete copy.stair;
 return copy;
}

function resizeCabinet(p:Piece){
 if(!p.cabinet)return;
 const total=p.cabinet.columns.reduce((n,c)=>n+c.width,0);
 if(total>0&&Number.isFinite(total)&&Math.abs(total-p.w)>.001){
  let used=0;p.cabinet.columns.forEach((c,i)=>{c.width=i===p.cabinet!.columns.length-1?p.w-used:Math.round(c.width/total*p.w*1000)/1000;used+=c.width;});
 }
 p.usage={...p.usage,open:p.cabinet.doorOpen,depth:Math.max(...p.cabinet.columns.filter(c=>!c.open&&c.hinge!=='none').map(c=>c.width),0),side:p.usage?.side||'bottom'};
}

// Resizing an island must not stretch its chairs, sink or extension mechanism.
export function refreshIslandParts(p:Piece){
 if(p.id!=='f1-island')return;
 const w=p.w,h=p.h;
 const workingWidth=p.islandWorkLengthMm??Math.min(w/2,Math.max(600,w-1600));
 if(workingWidth<=0||workingWidth>=w)throw Error('工作段长度必须小于餐岛总长，并留出餐桌段');
 const parts:Part[]=[{id:'body',name:'餐岛工作段',ring:rectRing(0,0,workingWidth,h)},{id:'table',name:'固定连接餐桌',ring:rectRing(workingWidth,0,w-workingWidth,h)},{id:'extension',name:'展开餐桌',ring:rectRing(w,0,600,h),when:'extended'}];
 const diningSpan=w-workingWidth;
 for(const [i,x] of [workingWidth+diningSpan*.25-275,workingWidth+diningSpan*.75-275].entries())for(const [side,y] of [['n',-600],['s',h+100]] as const){
  parts.push({id:`chair-${side}${i}`,name:side==='n'?'北侧餐椅':'南侧餐椅',ring:rectRing(x,y,550,500),when:'seated',estimated:true});
  parts.push({id:`stored-${side}${i}`,name:'收起餐椅',ring:rectRing(x,side==='n'?-180:h-320,550,500),when:'stored',estimated:true});
 }
 for(const [side,y] of [['n',-600],['s',h+100]] as const)parts.push({id:`extra-${side}`,name:'展开加座',ring:rectRing(w+5,y,550,500),when:'extra-chair',estimated:true});
 p.parts=parts;p.baseW=w;p.baseH=h;
 p.partHeightsMm={...p.partHeightsMm};
 for(const part of parts)p.partHeightsMm[part.id]=part.id==='body'?p.heightMm??850:['table','extension'].includes(part.id)?p.partHeightsMm[part.id]??750:p.partHeightsMm[part.id]??850;
}

function resizeGeometry(p:Piece,previous:Piece){
 if(p.w!==previous.w||p.h!==previous.h){
  if(p.id==='f1-island')refreshIslandParts(p);
  // Custom shaped counters scale in plan only; their vertical size is independent.
  resizeCabinet(p);
 }else if(p.cabinet)resizeCabinet(p);
}

function alignOffice(floor:Floor,source:Piece){
 const members=floor.pieces.filter(p=>p.groupId&&p.groupId===source.groupId);
 const sofa=members.find(p=>p.id.endsWith('-sofa')),desk=members.find(p=>p.id.endsWith('-desk'));
 if(!sofa||!desk||![sofa.id,desk.id].includes(source.id))return;
 const angle=source.rotation;
 const width=source.w;
 const other=source.id===sofa.id?desk:sofa,oldOther=clone(other);
 other.w=width;other.rotation=angle;
 const c=center(source),distance=(sofa.h+desk.h)/2;
 const v=rotate(0,source.id===sofa.id?-distance:distance,angle);
 other.x=c[0]+v[0]-other.w/2;other.y=c[1]+v[1]-other.h/2;
 resizeGeometry(other,oldOther);
 const sc=center(sofa),chairs=members.filter(p=>p.id.includes('-office')).sort((a,b)=>a.id.localeCompare(b.id));
 chairs.forEach((chair,i)=>{
  const fraction=chairs.length===1?.5:(i+.5)/chairs.length;
  const offset=rotate(width*(fraction-.5),-sofa.h/2-desk.h-5-chair.h/2,angle);
  chair.x=sc[0]+offset[0]-chair.w/2;chair.y=sc[1]+offset[1]-chair.h/2;chair.rotation=angle;
 });
}

/** Mutates a caller-owned Floor transaction and returns it. applyOperation clones first. */
export function patchGroupedPiece(floor:Floor,id:string,patch:Partial<Piece>,linked=true):Floor{
 const piece=floor.pieces.find(p=>p.id===id);if(!piece)throw Error('没有找到要修改的对象');
 if(patch.id!==undefined&&patch.id!==id)throw Error('对象标识不能更改');
 if(Object.keys(patch).some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('非法对象属性');
 const previous=clone(piece),before=new Map(floor.pieces.map(p=>[p.id,clone(p)]));
 const optional=['cabinet','groupId','partHeightsMm','architecturalKind','islandWorkLengthMm','usage','room','color','svg','parts','baseW','baseH'] as const;
 for(const key of optional)if(Object.prototype.hasOwnProperty.call(patch,key)&&patch[key]===undefined){delete piece[key];if(key==='cabinet'&&piece.usage){delete piece.usage.open;delete piece.usage.depth;}}
 Object.assign(piece,clone(patch));
 if(![piece.x,piece.y,piece.w,piece.h,piece.rotation].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('对象尺寸无效');
 piece.rotation=turn(piece.rotation);
 const group=linked&&piece.groupId?floor.pieces.filter(p=>p.groupId===piece.groupId&&p.id!==id):[];
 const a=center(previous),b=center(piece),delta=piece.rotation-previous.rotation;
 for(const member of group){
  const old=before.get(member.id)!,mc=center(old),v=rotate(mc[0]-a[0],mc[1]-a[1],delta);
  member.x=b[0]+v[0]-member.w/2;member.y=b[1]+v[1]-member.h/2;member.rotation=turn(old.rotation+delta);
 }
 resizeGeometry(piece,previous);
 if(piece.id==='f1-island'&&patch.islandWorkLengthMm!==undefined&&piece.w===previous.w&&piece.h===previous.h)refreshIslandParts(piece);
 if(group.length&&(piece.w!==previous.w||piece.h!==previous.h))alignOffice(floor,piece);
 // Height is an explicit vertical property; editing plan depth must never change it.
 if(patch.heightMm!==undefined&&piece.partHeightsMm&&piece.partHeightsMm.body!==undefined)piece.partHeightsMm.body=patch.heightMm;
 return floor;
}
