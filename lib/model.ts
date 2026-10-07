import type {Part,Usage,MeasureSpec,RouteSpec,RegionSpec,Anchor} from './measurement-model';
import {validateMeasurementData} from './measurement-model';
export type Kind='wall'|'furniture'|'opening'|'zone'|'stair';
export type Structural='candidate'|'unknown'|'nonload'|'confirmed';
export type Rect={x:number;y:number;w:number;h:number};
export type DimensionSource='drawing'|'measured'|'design'|'provisional';
export type CabinetColumn={width:number;shelves:number;drawers:number;open:boolean;hinge:'left'|'right'|'none'};
export type Cabinet={columns:CabinetColumn[];plinthMm:number;topGapMm:number;doorOpen:boolean};
/** A shared stair keeps a separate drawing anchor for each floor. Geometry remains a design study. */
export type StairConfig={sharedId:string;level:'lower'|'upper';footprintMode:'original'|'expanded'|'custom';originalFootprint:Rect;riseMm:number;extensionMm:number;schematicSteps:number;railHeightMm:number;surveyStatus:'unmeasured'|'partial'|'measured'};
export type Piece=Rect & {id:string;name:string;type:Kind;rotation:number;structural?:Structural;source?:string;svg?:string;baseW?:number;baseH?:number;color?:string;original?:Rect;locked?:boolean;room?:string;visible?:boolean;openingKind?:'window'|'door'|'opening';parts?:Part[];usage?:Usage;hostWallIds?:string[];apertureOriginal?:Rect&{rotation:number};heightMm?:number;elevationMm?:number;dimensionSource?:DimensionSource;cabinet?:Cabinet;groupId?:string;partHeightsMm?:Record<string,number>;islandWorkLengthMm?:number;architecturalKind?:'beam'|'ceiling';stair?:StairConfig;};
export type Room=Rect & {id:string;name:string;};
export type Floor={id:string;name:string;outline:number[][];originalOutline:number[][];pieces:Piece[];rooms:Room[];source:string;note:string;balconyTopology?:{start:number;end:number;cutY:number};measurements?:MeasureSpec[];routes?:RouteSpec[];regions?:RegionSpec[];ceilingHeightMm?:number;heightSource?:DimensionSource;};
export type Material={style:string;wood:string;stone:string;wall:string;floor:string;light:string;notes:string;};
export type State={version:2|3;floors:Floor[];materials:Record<string,Material>;warnings:string[];};
export type Reference={id:string;floor_id:string;module:string;name:string;note:string;url:string;created_at:string;};
export const defaultMaterial:Material={style:'原木 · 奢石 · 意式收纳',wood:'#ad8157',stone:'#e2e1d9',wall:'#f2f0e9',floor:'#c9b99e',light:'自然光 + 3000K暖光',notes:''};
export const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
export function bounds(f:Floor){const p=f.outline;return {x:Math.min(...p.map(q=>q[0])),y:Math.min(...p.map(q=>q[1])),w:Math.max(...p.map(q=>q[0]))-Math.min(...p.map(q=>q[0])),h:Math.max(...p.map(q=>q[1]))-Math.min(...p.map(q=>q[1]))};}
export function viewBox(f:Floor){const b=bounds(f);return [b.x-900,b.y-700,b.w+1800,b.h+1600] as [number,number,number,number];}
export function changedPiece(p:Piece){const o=p.original;return !!o&&(Math.abs(p.x-o.x)>1||Math.abs(p.y-o.y)>1||Math.abs(p.w-o.w)>1||Math.abs(p.h-o.h)>1||p.rotation!==0);}
export function isStructural(p:Piece){return p.type==='wall'&&p.structural!=='nonload';}
export function transform(p:Piece){return `translate(${p.x} ${p.y}) rotate(${p.rotation||0} ${p.w/2} ${p.h/2}) scale(${p.w/(p.baseW||p.w)} ${p.h/(p.baseH||p.h)})`;}
export function validateState(v:unknown):v is State{
 if(!v||typeof v!=='object')return false;const s=v as State;
 const text=(v:unknown,max=200)=>typeof v==='string'&&v.length<=max;
 const num=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100000;
 const rect=(v:any)=>v&&[v.x,v.y,v.w,v.h].every(num)&&v.w>0&&v.h>0&&v.w<50000&&v.h<50000;
 const points=(v:unknown)=>Array.isArray(v)&&v.length>=4&&v.length<=100&&v.every(p=>Array.isArray(p)&&p.length===2&&p.every(num));
 if(![2,3].includes(s.version)||!Array.isArray(s.floors)||s.floors.length!==2||!s.materials||typeof s.materials!=='object'||!Array.isArray(s.warnings)||s.warnings.length>1000||!s.warnings.every(t=>text(t,1000)))return false;
 if(s.version===3&&!s.floors.every(f=>f&&Array.isArray(f.pieces)&&validateMeasurementData(f)))return false;
 if(new Set(s.floors.map(f=>f?.id)).size!==2||!s.floors.every(f=>f&&['f1','f2'].includes(f.id)))return false;
 for(const key of ['f1','f2']){const m=s.materials[key];if(!m||!['style','wood','stone','wall','floor','light','notes'].every(k=>text((m as any)[k],4000))||!['wood','stone','wall','floor'].every(k=>/^#[0-9a-fA-F]{6}$/.test((m as any)[k])))return false;}
 const allIds=new Set<string>();
 return s.floors.every(f=>text(f.name)&&text(f.source,1000)&&text(f.note,3000)&&points(f.outline)&&points(f.originalOutline)&&(f.ceilingHeightMm===undefined||num(f.ceilingHeightMm)&&f.ceilingHeightMm>0&&f.ceilingHeightMm<=20000)&&(f.heightSource===undefined||['drawing','measured','design','provisional'].includes(f.heightSource))&&Array.isArray(f.rooms)&&f.rooms.length<100&&f.rooms.every(r=>r&&rect(r)&&text(r.id)&&text(r.name))&&Array.isArray(f.pieces)&&f.pieces.length<600&&f.pieces.every(p=>{
 if(!p||!['wall','furniture','opening','zone','stair'].includes(p.type)||!text(p.id)||!p.id||allIds.has(p.id)||!text(p.name)||!rect(p)||!num(p.rotation)||p.rotation>360||p.rotation<-360)return false;allIds.add(p.id);
 if(p.original&&!rect(p.original))return false;if(p.structural&&!['candidate','confirmed','unknown','nonload'].includes(p.structural))return false;
 if(p.svg!==undefined&&(typeof p.svg!=='string'||!safeSvg(p.svg)||!num(p.baseW)||!num(p.baseH)||p.baseW!<=0||p.baseH!<=0))return false;
 if(p.locked!==undefined&&typeof p.locked!=='boolean'||p.visible!==undefined&&typeof p.visible!=='boolean')return false;
 if(p.heightMm!==undefined&&(!num(p.heightMm)||p.heightMm<0||p.heightMm>20000)||p.elevationMm!==undefined&&(!num(p.elevationMm)||p.elevationMm<0||p.elevationMm>20000))return false;
 if(p.dimensionSource!==undefined&&!['drawing','measured','design','provisional'].includes(p.dimensionSource)||p.groupId!==undefined&&(!text(p.groupId)||!p.groupId))return false;
 if(p.architecturalKind!==undefined&&!['beam','ceiling'].includes(p.architecturalKind)||p.islandWorkLengthMm!==undefined&&(!num(p.islandWorkLengthMm)||p.islandWorkLengthMm<=0||p.islandWorkLengthMm>=p.w))return false;
 if(p.partHeightsMm!==undefined&&(!p.partHeightsMm||typeof p.partHeightsMm!=='object'||Array.isArray(p.partHeightsMm)||Object.entries(p.partHeightsMm).some(([id,height])=>!text(id)||!num(height)||height<0||height>20000)))return false;
 if(p.stair!==undefined){const t=p.stair;if(p.type!=='stair'||!t||!text(t.sharedId)||!t.sharedId||t.level!==(f.id==='f2'?'upper':'lower')||!['original','expanded','custom'].includes(t.footprintMode)||!rect(t.originalFootprint)||!num(t.riseMm)||t.riseMm<500||t.riseMm>10000||!num(t.extensionMm)||t.extensionMm<0||t.extensionMm>2000||!Number.isInteger(t.schematicSteps)||t.schematicSteps<6||t.schematicSteps>48||!num(t.railHeightMm)||t.railHeightMm<500||t.railHeightMm>2000||!['unmeasured','partial','measured'].includes(t.surveyStatus))return false;}
 if(p.cabinet!==undefined){const c=p.cabinet;if(!c||!Array.isArray(c.columns)||!c.columns.length||c.columns.length>50||!c.columns.every(col=>col&&num(col.width)&&col.width>0&&Number.isInteger(col.shelves)&&col.shelves>=0&&col.shelves<=100&&Number.isInteger(col.drawers)&&col.drawers>=0&&col.drawers<=50&&typeof col.open==='boolean'&&['left','right','none'].includes(col.hinge))||Math.abs(c.columns.reduce((sum,col)=>sum+col.width,0)-p.w)>1||!num(c.plinthMm)||c.plinthMm<0||!num(c.topGapMm)||c.topGapMm<0||typeof c.doorOpen!=='boolean'||p.heightMm!==undefined&&c.plinthMm+c.topGapMm>=p.heightMm)return false;}
 return true;
 }));
}
export function riskText(p:Piece){if(p.type==='stair')return '楼梯连接两层，移动后应同时核对两层洞口、净高和结构。这里只修改方案。';if(p.structural==='confirmed')return '该墙已标为承重墙。方案移动或拆除不代表可施工；实施前须经结构设计核验。';return '这段原墙的承重性质尚未确认。深色原墙按疑似结构墙提示；请勿仅凭本平面图认定可拆。这里只修改方案。';}

const svgTags=new Set(['g','path','rect','circle','ellipse','line','polyline','polygon','text']);
const svgAttrs=new Set(['d','x','y','x1','y1','x2','y2','width','height','cx','cy','r','rx','ry','points','fill','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-opacity','opacity','transform','text-anchor','dominant-baseline','font-family','font-size','font-weight']);
export function safeSvg(s:string){if(s.length>100000||/url\s*\(|<!|<\?|&(?:#|[a-z])/i.test(s))return false;let rest=s;for(const match of s.matchAll(/<\/?([A-Za-z][\w:-]*)\b([^>]*)>/g)){if(!svgTags.has(match[1]))return false;let attrs=match[2].replace(/\/\s*$/,'');for(const a of attrs.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g)){if(!svgAttrs.has(a[1])||/[<>]/.test(a[2]))return false;attrs=attrs.replace(a[0],'');}if(attrs.trim())return false;rest=rest.replace(match[0],'');}return !/[<>]/.test(rest);}
export function balconyChange(f:Floor,section:string,amount:number){
 const t=f.balconyTopology;if(!t||!Number.isFinite(amount)||Math.abs(amount)>3000)throw Error('阳台边界不可用');
 const top=f.outline[t.start],bottom=f.outline[t.end];if(!top||!bottom)throw Error('请先检查阳台轮廓节点');
 const oldUpper=top[0],oldLower=bottom[0],newUpper=oldUpper+(section==='upper'||section==='all'?amount:0),newLower=oldLower+(section==='lower'||section==='all'?amount:0),cut=t.cutY;
 if(newUpper<Math.max(...f.outline.map(q=>q[0]))-4500||newLower<Math.max(...f.outline.map(q=>q[0]))-4500)throw Error('此收进距离过大');
 // The two parts own independent corner nodes at the shared Y level.
 const coast=[[newUpper,top[1]],[newUpper,cut],[newLower,cut],[newLower,bottom[1]]];
 const oldEnd=t.end,shift=3-(oldEnd-t.start),oldOutline=clone(f.outline);
 // Keep saved edge anchors on the same architectural edge when the coast gains a corner.
 const mapEdge=(edge:number)=>{if(edge<t.start)return edge;if(edge>=oldEnd)return edge+shift;
  const a=oldOutline[edge],b=oldOutline[edge+1];
  if(Math.abs(a[1]-b[1])<.01)return t.start+1;
  return (a[1]+b[1])/2<cut?t.start:t.start+2;
 };
 const migrateAnchor=(a:Anchor)=>{if(a.kind==='boundary')a.edge=mapEdge(a.edge);};
 for(const m of f.measurements||[]){if(/^boundary:\d+$/.test(m.id)){const edge=Number(m.id.split(':')[1]),mapped=mapEdge(edge);m.id='boundary:'+mapped;if(m.name==='外轮廓边 '+(edge+1))m.name='外轮廓边 '+(mapped+1);}migrateAnchor(m.a);migrateAnchor(m.b);}
 for(const r of f.routes||[])r.points.forEach(migrateAnchor);
 f.outline.splice(t.start,t.end-t.start+1,...coast);t.end=t.start+3;
 for(const p of f.pieces){const mid=p.y+p.h/2,upper=mid<cut,delta=upper?newUpper-oldUpper:newLower-oldLower,edge=upper?oldUpper:oldLower;if(!delta||mid<top[1]-2)continue;
 if(p.type==='opening'&&p.id!==f.id+'-balcony-joint'){
  if(p.h>p.w&&p.x>=edge-300)p.x+=delta;
  else if(p.w>=p.h&&Math.abs(p.x+p.w-edge)<220)p.w=Math.max(60,p.w+delta);
 }
 // Stretch boundary-parallel end walls only; original structural columns stay.
 if(p.type==='wall'&&p.w>p.h*2&&Math.abs(p.x+p.w-edge)<30)p.w=Math.max(60,p.w+delta);
 }
 f.pieces=f.pieces.filter(p=>p.id!==f.id+'-balcony-joint');
 if(Math.abs(newUpper-newLower)>2)f.pieces.push({id:f.id+'-balcony-joint',name:'阳台外推转折封窗',type:'opening',x:Math.min(newUpper,newLower),y:cut-120,w:Math.abs(newUpper-newLower),h:120,rotation:0});
}
