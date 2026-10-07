import {clone, type Piece, type Rect, type StairConfig, type State} from './model';
import type {Point} from './measurement-model';

export type StairPatch=Partial<Pick<StairConfig,'footprintMode'|'riseMm'|'extensionMm'|'schematicSteps'|'railHeightMm'|'surveyStatus'>>;
export type StairVolume={objectId:string;partId:string;name:string;polygon:Point[][];bottom:number;top:number;kind:string;color:string;provisional:boolean;detail?:boolean};
export const STAIR_SHARED_ID='main-stair';
export const STAIR_SURVEY_ITEMS=['实际层高','楼板洞口','梁底净高','梯段与平台','扶手及栏杆','上下层入口'] as const;
const rect=(p:Rect):Rect=>({x:p.x,y:p.y,w:p.w,h:p.h});
const rectRing=(x:number,y:number,w:number,h:number):Point[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const n=(v:number)=>Math.round(v*100)/100;

export function stairConfig(piece:Piece,floorIdOrLevel:string='lower'):StairConfig{
 const level=floorIdOrLevel==='f2'||floorIdOrLevel==='upper'?'upper':'lower';
 const original=rect(piece.original||piece),adjusted=Math.abs(piece.x-original.x)>.001||Math.abs(piece.y-original.y)>.001||Math.abs(piece.w-original.w)>.001||Math.abs(piece.h-original.h)>.001||Math.abs(piece.rotation)>.001;
 return piece.stair||{sharedId:STAIR_SHARED_ID,level,footprintMode:adjusted?'custom':'original',originalFootprint:original,riseMm:3000,extensionMm:600,schematicSteps:18,railHeightMm:1000,surveyStatus:'unmeasured'};
}
export const getStairConfig=stairConfig;

function checkPatch(patch:StairPatch){
 if(patch.footprintMode!==undefined&&!['original','expanded','custom'].includes(patch.footprintMode))throw Error('楼梯占地方案无效');
 if(patch.riseMm!==undefined&&(!Number.isFinite(patch.riseMm)||patch.riseMm<500||patch.riseMm>10000))throw Error('示意层高应在 500–10000 mm 内');
 if(patch.extensionMm!==undefined&&(!Number.isFinite(patch.extensionMm)||patch.extensionMm<0||patch.extensionMm>2000))throw Error('向过厅扩展值应在 0–2000 mm 内');
 if(patch.schematicSteps!==undefined&&(!Number.isInteger(patch.schematicSteps)||patch.schematicSteps<6||patch.schematicSteps>48))throw Error('示意级数无效');
 if(patch.railHeightMm!==undefined&&(!Number.isFinite(patch.railHeightMm)||patch.railHeightMm<500||patch.railHeightMm>2000))throw Error('示意扶手高度无效');
 if(patch.surveyStatus!==undefined&&!['unmeasured','partial','measured'].includes(patch.surveyStatus))throw Error('楼梯复测状态无效');
}

function refreshFootprint(piece:Piece){
 piece.baseW=piece.w;piece.baseH=piece.h;
 // Measurements and routing must use the same enlarged footprint as the visual model.
 piece.parts=[{id:'body',name:'楼梯研究占地',ring:rectRing(0,0,piece.w,piece.h),estimated:true}];
}

function useFootprint(piece:Piece){
 const c=piece.stair!,o=c.originalFootprint;
 if(c.footprintMode==='custom')return;
 const extra=c.footprintMode==='expanded'?c.extensionMm:0;
 // Source plans have different anchors and small drawing-rounding differences.
 piece.x=o.x;piece.y=o.y-extra;piece.w=o.w;piece.h=o.h+extra;piece.rotation=0;
 refreshFootprint(piece);
}

/** Creates the linked model on legacy plans, or updates it without sharing mutable references. */
export function configureLinkedStairs(state:State,patch:StairPatch={},sharedId=STAIR_SHARED_ID):State{
 checkPatch(patch);
 const next=clone(state);
 for(const floor of next.floors){
  const existing=floor.pieces.filter(p=>p.type==='stair'&&p.stair?.sharedId===sharedId);
  const primary=floor.pieces.find(p=>p.id===floor.id+'-stairs')||floor.pieces.find(p=>p.type==='stair'&&!p.stair);
  const pieces=existing.length?existing:primary?[primary]:[];
  for(const piece of pieces){
   const c=stairConfig(piece,floor.id==='f2'?'upper':'lower');
   piece.stair={...clone(c),...patch,sharedId,level:floor.id==='f2'?'upper':'lower'};
   // Configuring a height or survey field must not reset a user-moved footprint.
   if(patch.footprintMode!==undefined||patch.extensionMm!==undefined&&piece.stair.footprintMode==='expanded')useFootprint(piece);
   refreshFootprint(piece);
   piece.heightMm=piece.stair.riseMm;piece.dimensionSource='provisional';
  }
 }
 return next;
}

const changed=(a:Piece,b:Piece)=>['x','y','w','h','rotation','heightMm'].some(k=>a[k as keyof Piece]!==b[k as keyof Piece])||JSON.stringify(a.stair)!==JSON.stringify(b.stair);

/** Reconciles a one-floor drag/property edit onto its partner using drawing-local deltas.
 * Both-floor transactions (configure, undo, restore) are already complete and remain untouched.
 */
export function syncLinkedStairChange(previous:State,nextState:State):State{
 const next=clone(nextState),before=new Map(previous.floors.flatMap(f=>f.pieces.map(p=>[p.id,p] as const)));
 const groups=new Map<string,Piece[]>();
 for(const floor of next.floors)for(const piece of floor.pieces)if(piece.type==='stair'&&piece.stair){const group=groups.get(piece.stair.sharedId)||[];group.push(piece);groups.set(piece.stair.sharedId,group);}
 for(const [sharedId,members] of groups){
  const edits=members.filter(p=>before.get(p.id)?.stair&&changed(before.get(p.id)!,p));
  if(edits.length!==1)continue;
  const source=edits[0],old=before.get(source.id)!,c=source.stair!,oc=old.stair!;
  const patch:StairPatch={footprintMode:c.footprintMode,riseMm:c.riseMm,extensionMm:c.extensionMm,schematicSteps:c.schematicSteps,railHeightMm:c.railHeightMm,surveyStatus:c.surveyStatus};
  if(source.heightMm!==old.heightMm&&c.riseMm===oc.riseMm)patch.riseMm=source.heightMm;
  checkPatch(patch);
  const configFootprint=c.footprintMode!==oc.footprintMode||c.extensionMm!==oc.extensionMm;
  const dx=source.x-old.x,dy=source.y-old.y,dw=source.w-old.w,dh=source.h-old.h,dr=source.rotation-old.rotation;
  const geometryChanged=[dx,dy,dw,dh,dr].some(d=>Math.abs(d)>.001);
  if(geometryChanged&&!configFootprint)patch.footprintMode='custom';
  for(const piece of members){
   piece.stair={...piece.stair!,...patch,sharedId};
   piece.heightMm=piece.stair.riseMm;piece.dimensionSource='provisional';
   if(configFootprint)useFootprint(piece);
   else if(piece!==source&&geometryChanged){piece.x+=dx;piece.y+=dy;piece.w+=dw;piece.h+=dh;piece.rotation=((piece.rotation+dr)%360+360)%360;}
   if(geometryChanged||configFootprint)refreshFootprint(piece);
  }
 }
 return next;
}

export function stairFootprintStudies(piece:Piece){
 const c=stairConfig(piece),o=c.originalFootprint;
 return {original:{...o,areaM2:o.w*o.h/1e6},expanded:{x:o.x,y:o.y-c.extensionMm,w:o.w,h:o.h+c.extensionMm,areaM2:o.w*(o.h+c.extensionMm)/1e6},extraAreaM2:o.w*c.extensionMm/1e6,extensionMm:c.extensionMm,current:rect(piece)};
}

function shape(piece:Piece,floorId?:string){
 const c=stairConfig(piece,floorId),gap=Math.min(100,piece.w*.06),flight=(piece.w-gap)/2;
 const landing=Math.min(flight,piece.h*.4),run=Math.max(1,piece.h-landing);
 const leftCount=Math.floor(c.schematicSteps/2),rightCount=c.schematicSteps-leftCount;
 return {c,gap,flight,landing,run,leftCount,rightCount};
}

export function getStairSurveyWarnings(piece:Piece):string[]{
 const {c,flight,run,leftCount,rightCount}=shape(piece);
 const result=[c.surveyStatus==='unmeasured'?`楼梯层高 ${n(c.riseMm)} mm 为示意值；踏步、平台及楼板洞口均待复测`:c.surveyStatus==='partial'?'楼梯复测资料未齐全；当前踏步仍为方案示意':'楼梯复测状态已登记；当前 U 形踏步仍为方案示意，须由设计师核定'];
 result.push('梯段、扶手、上下层入口及梁底净高未完成专业核验，不作为施工踏步图');
 if(c.footprintMode==='expanded')result.push(`向公共过厅扩展 ${n(c.extensionMm)} mm，需同时核对两层过厅、饮水柜及连续通路`);
 if(c.footprintMode==='custom')result.push('楼梯占地已自由调整；两层按各自原图锚点联动，需核对真实楼板洞口');
 // These are an explanatory fit warning, not a standards/compliance result.
 if(flight<900||Math.min(run/leftCount,run/rightCount)<250)result.push('当前占地的 U 形示意较紧凑；图示级数用于表达转向，不能据此确认踏步可施工');
 return result;
}

/** Local 0..w / 0..h drawing. This intentionally contains no construction tread labels. */
export function getStairPlanSvg(piece:Piece,floorId?:string):string{
 const {c,flight,gap,landing,run,leftCount,rightCount}=shape(piece,floorId),w=piece.w,h=piece.h;
 const fill='#e1d6c6',line='#76614d',arrow='#526960',font=Math.max(80,Math.min(112,w*.058));
 const out=[`<rect x="0" y="0" width="${n(w)}" height="${n(h)}" fill="${fill}" stroke="${line}" stroke-width="18"/>`,`<rect x="${n(flight)}" y="0" width="${n(gap)}" height="${n(run)}" fill="#f4efe6" stroke="${line}" stroke-width="12"/>`,`<line x1="0" y1="${n(run)}" x2="${n(w)}" y2="${n(run)}" stroke="${line}" stroke-width="18"/>`];
 for(let i=1;i<leftCount;i++){const y=n(run*i/leftCount);out.push(`<line x1="0" y1="${y}" x2="${n(flight)}" y2="${y}" stroke="${line}" stroke-width="10"/>`);}
 for(let i=1;i<rightCount;i++){const y=n(run*i/rightCount);out.push(`<line x1="${n(flight+gap)}" y1="${y}" x2="${n(w)}" y2="${y}" stroke="${line}" stroke-width="10"/>`);}
 const left=flight*.5,right=w-flight*.5,turnY=run+landing*.5,startY=Math.min(180,run*.15),endY=Math.min(85,run*.07),goingUp=c.level==='lower';
 const sx=goingUp?left:right,ex=goingUp?right:left;
 out.push(`<path d="M ${n(sx)} ${n(startY)} L ${n(sx)} ${n(turnY)} L ${n(ex)} ${n(turnY)} L ${n(ex)} ${n(endY)}" fill="none" stroke="${arrow}" stroke-width="23" stroke-linejoin="round"/>`,`<polygon points="${n(ex)},${n(endY)} ${n(ex-65)},${n(endY+135)} ${n(ex+65)},${n(endY+135)}" fill="${arrow}"/>`);
 // Rails frame the flights and turn; arrows remain distinct from these outlines.
 out.push(`<path d="M 38 35 L 38 ${n(h-38)} L ${n(w-38)} ${n(h-38)} L ${n(w-38)} 35" fill="none" stroke="#534439" stroke-width="24"/>`);
 if(c.footprintMode==='expanded')out.push(`<rect x="8" y="${n(c.extensionMm)}" width="${n(w-16)}" height="${n(h-c.extensionMm-8)}" fill="none" stroke="#b77941" stroke-width="15" stroke-dasharray="60 40"/>`);
 out.push(`<rect x="${n(w*.1)}" y="${n(turnY-font*.7)}" width="${n(w*.8)}" height="${n(font*1.5)}" rx="25" fill="#f4efe6" fill-opacity=".95"/>`,`<text x="${n(w/2)}" y="${n(turnY+font*.35)}" font-family="Microsoft YaHei" font-size="${n(font)}" font-weight="600" text-anchor="middle" fill="${line}">${goingUp?'上行':'下行'} · U 形示意</text>`);
 return out.join('');
}

function world(piece:Piece,p:Point):Point{
 const angle=(piece.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),x=p[0]-piece.w/2,y=p[1]-piece.h/2;
 return [piece.x+piece.w/2+x*c-y*s,piece.y+piece.h/2+x*s+y*c];
}

/** Same U-turn parts as the plan. The upper-floor model descends below its own floor datum. */
export function getStairVolumes(piece:Piece,floorId?:string):StairVolume[]{
 const {c,flight,gap,landing,run,leftCount,rightCount}=shape(piece,floorId),base=c.level==='upper'?-c.riseMm:0;
 const volumes:StairVolume[]=[],riser=c.riseMm/c.schematicSteps,landingZ=base+riser*leftCount;
 const box=(id:string,label:string,x:number,y:number,w:number,h:number,bottom:number,top:number,color:string,detail=false)=>{
  if(w<=0||h<=0||top<=bottom)return;
  volumes.push({objectId:piece.id,partId:id,name:`${piece.name} · ${label}（示意）`,polygon:[rectRing(x,y,w,h).map(p=>world(piece,p))],bottom,top,kind:'stair',color,provisional:true,detail});
 };
 const rail=(side:'left'|'right',y:number,depth:number,z:number,index:number)=>{
  const x=side==='left'?22:piece.w-57,post=28;
  box(`rail-post-${side}-${index}`,'扶手立柱',x,y+depth*.5-post*.5,post,post,z,z+c.railHeightMm,'#5b493b',true);
  box(`rail-${side}-${index}`,'扶手',x-4,y,36,depth+2,z+c.railHeightMm-30,z+c.railHeightMm,'#5b493b',true);
 };
 for(let i=0;i<leftCount;i++){
  const depth=run/leftCount,y=depth*i,z=base+riser*(i+1);
  box(`tread-left-${i}`,'左梯段踏步',0,y,flight,depth,z-75,z,'#c2aa8e');rail('left',y,depth,z,i);
 }
 box('turn-landing','转向平台',0,run,piece.w,landing,landingZ-100,landingZ,'#c9b195');
 box('landing-rail','平台扶手',20,piece.h-50,piece.w-40,35,landingZ+c.railHeightMm-35,landingZ+c.railHeightMm,'#5b493b',true);
 for(let i=0;i<rightCount;i++){
  const depth=run/rightCount,y=run-depth*(i+1),z=landingZ+riser*(i+1);
  box(`tread-right-${i}`,'右梯段踏步',flight+gap,y,flight,depth,z-75,z,'#c2aa8e');rail('right',y,depth,z,i);
 }
 return volumes;
}
