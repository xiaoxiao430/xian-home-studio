import type {Floor,Piece,State} from './model';
export type Point=[number,number];
export type Ring=Point[];
export type Part={id:string;name:string;ring:Ring;when?:'extended'|'seated'|'stored'|'extra-chair';estimated?:boolean};
export type Anchor={kind:'boundary';edge:number;t?:number}|{kind:'point';point:Point}|{kind:'object';objectId:string;partId?:string;edge?:number;t?:number}|{kind:'local';objectId:string;point:Point};
export type MeasureSpec={id:string;name:string;a:Anchor;b:Anchor;mode:'shortest'|'horizontal'|'vertical'|'direct';pinned:boolean;sizeId?:string};
export type RouteSpec={id:string;name:string;points:Anchor[];target:number;automatic?:boolean};
export type RegionSpec={id:string;name:string;points:Point[];closed:boolean};
export type Usage={table?:'compact'|'extended';chairs?:'seated'|'stored';open?:boolean;depth?:number;side?:'top'|'bottom'|'left'|'right'};
export const rectRing=(x:number,y:number,w:number,h:number):Ring=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const object=(objectId:string,partId?:string):Anchor=>({kind:'object',objectId,...(partId?{partId}:{})});
export function enrichPiece(p:Piece){
 if(p.type==='opening'&&!p.openingKind)p.openingKind=p.name.includes('门')?'door':p.name.includes('洞口')?'opening':'window';
 if(p.parts)return;
 if(p.id==='f1-kitchen'){p.baseW=2510;p.baseH=3280;p.parts=[{id:'body',name:'连续L台面',ring:[[0,0],[2310,0],[2310,80],[2510,80],[2510,600],[600,600],[600,3280],[0,3280]]}];}
 else if(p.id==='f1-island'){
  p.baseW=2800;p.baseH=800;p.usage={table:'compact',chairs:'seated',...p.usage};
  p.parts=[{id:'body',name:'餐岛台面',ring:rectRing(0,0,2800,800)},{id:'extension',name:'展开台面',ring:rectRing(2800,0,600,800),when:'extended'}];
  for(const [i,x] of [1325,2125].entries())for(const [side,y] of [['n',-600],['s',900]] as const){p.parts.push({id:`chair-${side}${i}`,name:side==='n'?'北侧餐椅':'南侧餐椅',ring:rectRing(x,y,550,500),when:'seated',estimated:true});p.parts.push({id:`stored-${side}${i}`,name:'收起餐椅',ring:rectRing(x,side==='n'?-180:480,550,500),when:'stored',estimated:true});}
  for(const [side,y] of [['n',-600],['s',900]] as const)p.parts.push({id:`extra-${side}`,name:'展开加座',ring:rectRing(2805,y,550,500),when:'extra-chair',estimated:true});
 }
 else if(p.id==='f1-保留窗户'){p.baseW=885;p.baseH=4244;p.parts=[{id:'upper',name:'厨房西窗',ring:rectRing(686.523,0,198.617,1753.009)},{id:'lower',name:'公卫西窗',ring:rectRing(0,2892.897,198.617,1351.458)}];}
 else if(p.id==='f1-入户门'){p.baseW=951;p.baseH=1162;p.parts=[{id:'body',name:'入户门洞',ring:rectRing(851,1,199,1161)}];}
 else if(p.type!=='zone'){p.parts=[{id:'body',name:p.name,ring:rectRing(0,0,p.baseW||p.w,p.baseH||p.h),estimated:!!p.svg&&p.type==='furniture'}];p.baseW||=p.w;p.baseH||=p.h;}
}
export function migrateState(input:State):State{
 const state=JSON.parse(JSON.stringify(input)) as State;
 if(state.version===3)return state;
 state.version=3;
 for(const f of state.floors){
  for(const p of f.pieces)enrichPiece(p);
  if(f.id==='f1')for(const p of [{id:'f1-wc-door',name:'公卫门洞',x:695,y:4283,w:125,h:799},{id:'f1-balcony-door',name:'阳台洞口',x:9525,y:937,w:203,h:2772}])if(!f.pieces.some(q=>q.id===p.id)){const q:Piece={...p,type:'opening',openingKind:'opening',rotation:0,source:'按原墙间隙推导，待复核'};enrichPiece(q);f.pieces.push(q);}
  for(const p of f.pieces.filter(p=>p.type==='opening')){
   const vertical=p.h>p.w;
   p.hostWallIds=f.pieces.filter(w=>w.type==='wall'&&(vertical?Math.abs(w.x-p.x)<30&&(Math.abs(w.y+w.h-p.y)<35||Math.abs(w.y-p.y-p.h)<35):Math.abs(w.y-p.y)<30&&(Math.abs(w.x+w.w-p.x)<35||Math.abs(w.x-p.x-p.w)<35))).map(w=>w.id);
   if(p.id==='f1-入户门')p.hostWallIds=['f1-wall-3','f1-wall-8'];
   p.apertureOriginal={x:p.x,y:p.y,w:p.w,h:p.h,rotation:p.rotation};
  }
  f.measurements=[];f.routes=[];f.regions=[];
  if(f.id==='f1')f.measurements=[
   {id:'sofa-tv',name:'沙发前沿 → 电视柜前沿',a:{kind:'object',objectId:'f1-sofa',edge:2},b:{kind:'object',objectId:'f1-tv',edge:0},mode:'vertical',pinned:true},
   {id:'sofa-coffee',name:'沙发 → 茶几',a:object('f1-sofa'),b:object('f1-coffee'),mode:'vertical',pinned:false},
   {id:'coffee-tv',name:'茶几 → 电视柜',a:object('f1-coffee'),b:object('f1-tv'),mode:'vertical',pinned:false},
   {id:'chair-cabinet',name:'北侧椅后 → 餐边柜',a:object('f1-island','chair-n1'),b:object('f1-sideboard'),mode:'vertical',pinned:true},
   {id:'chair-stairs',name:'南侧椅后 → 楼梯',a:object('f1-island','chair-s0'),b:object('f1-stairs'),mode:'vertical',pinned:false},
   {id:'viewing',name:'眼位 → 电视屏幕（可调锚点）',a:{kind:'local',objectId:'f1-sofa',point:[1300,350]},b:{kind:'local',objectId:'f1-tv',point:[1300,100]},mode:'direct',pinned:false}
  ];
 }
 return state;
}
export function activeParts(p:Piece){enrichPiece(p);return (p.parts||[]).filter(part=>!part.when||part.when==='extended'&&p.usage?.table==='extended'||part.when==='seated'&&p.usage?.chairs!=='stored'||part.when==='stored'&&p.usage?.chairs==='stored'||part.when==='extra-chair'&&p.usage?.table==='extended').map(part=>part.when==='stored'?{...part,id:part.id.replace('stored-','chair-')}:part);}
export function validateMeasurementData(f:Floor){
 const str=(v:unknown)=>typeof v==='string'&&v.length<300;
 const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<100000;
 const point=(v:any)=>Array.isArray(v)&&v.length===2&&v.every(num);
 const ring=(v:any)=>Array.isArray(v)&&v.length>=3&&v.length<=300&&v.every(point);
 const anchor=(v:any)=>v&&((v.kind==='boundary'&&Number.isInteger(v.edge)&&v.edge>=0&&v.edge<100&&(v.t===undefined||num(v.t)&&v.t>=0&&v.t<=1))||(v.kind==='point'&&point(v.point))||(v.kind==='local'&&str(v.objectId)&&point(v.point))||(v.kind==='object'&&str(v.objectId)&&(v.partId===undefined||str(v.partId))&&(v.edge===undefined||Number.isInteger(v.edge)&&v.edge>=0&&v.edge<300)&&(v.t===undefined||num(v.t)&&v.t>=0&&v.t<=1)));
 if(!Array.isArray(f.measurements)||f.measurements.length>800||!f.measurements.every(m=>str(m.id)&&str(m.name)&&anchor(m.a)&&anchor(m.b)&&['shortest','horizontal','vertical','direct'].includes(m.mode)&&typeof m.pinned==='boolean'))return false;
 if(!Array.isArray(f.routes)||f.routes.length>60||!f.routes.every(r=>str(r.id)&&str(r.name)&&Array.isArray(r.points)&&r.points.length>=2&&r.points.length<=25&&r.points.every(anchor)&&num(r.target)&&r.target>=0))return false;
 if(!Array.isArray(f.regions)||f.regions.length>100||!f.regions.every(r=>str(r.id)&&str(r.name)&&ring(r.points)&&typeof r.closed==='boolean'))return false;
 return f.pieces.every(p=>p&&(!p.parts||Array.isArray(p.parts)&&p.parts.length<100&&p.parts.every(q=>str(q.id)&&str(q.name)&&ring(q.ring)&&(!q.when||['extended','seated','stored','extra-chair'].includes(q.when))))&&(!p.hostWallIds||Array.isArray(p.hostWallIds)&&p.hostWallIds.length<100&&p.hostWallIds.every(str))&&(!p.usage||(!p.usage.table||['compact','extended'].includes(p.usage.table))&&(!p.usage.chairs||['stored','seated'].includes(p.usage.chairs))&&(p.usage.depth===undefined||num(p.usage.depth)&&p.usage.depth>=0&&p.usage.depth<10000)&&(!p.usage.side||['top','bottom','left','right'].includes(p.usage.side))));
}
