export type Kind='wall'|'furniture'|'opening'|'zone'|'stair';
export type Structural='candidate'|'unknown'|'nonload'|'confirmed';
export type Rect={x:number;y:number;w:number;h:number};
export type Piece=Rect & {id:string;name:string;type:Kind;rotation:number;structural?:Structural;source?:string;svg?:string;baseW?:number;baseH?:number;color?:string;original?:Rect;locked?:boolean;room?:string;visible?:boolean;openingKind?:'window'|'door'|'opening';};
export type Room=Rect & {id:string;name:string;};
export type Floor={id:string;name:string;outline:number[][];originalOutline:number[][];pieces:Piece[];rooms:Room[];source:string;note:string;balconyTopology?:{start:number;end:number;cutY:number};};
export type Material={style:string;wood:string;stone:string;wall:string;floor:string;light:string;notes:string;};
export type State={version:2;floors:Floor[];materials:Record<string,Material>;warnings:string[];};
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
 if(s.version!==2||!Array.isArray(s.floors)||s.floors.length!==2||!s.materials||typeof s.materials!=='object'||!Array.isArray(s.warnings)||s.warnings.length>1000||!s.warnings.every(t=>text(t,1000)))return false;
 if(new Set(s.floors.map(f=>f?.id)).size!==2||!s.floors.every(f=>f&&['f1','f2'].includes(f.id)))return false;
 for(const key of ['f1','f2']){const m=s.materials[key];if(!m||!['style','wood','stone','wall','floor','light','notes'].every(k=>text((m as any)[k],4000))||!['wood','stone','wall','floor'].every(k=>/^#[0-9a-fA-F]{6}$/.test((m as any)[k])))return false;}
 const allIds=new Set<string>();
 return s.floors.every(f=>text(f.name)&&text(f.source,1000)&&text(f.note,3000)&&points(f.outline)&&points(f.originalOutline)&&Array.isArray(f.rooms)&&f.rooms.length<100&&f.rooms.every(r=>r&&rect(r)&&text(r.id)&&text(r.name))&&Array.isArray(f.pieces)&&f.pieces.length<600&&f.pieces.every(p=>{
 if(!p||!['wall','furniture','opening','zone','stair'].includes(p.type)||!text(p.id)||!p.id||allIds.has(p.id)||!text(p.name)||!rect(p)||!num(p.rotation)||p.rotation>360||p.rotation<-360)return false;allIds.add(p.id);
 if(p.original&&!rect(p.original))return false;if(p.structural&&!['candidate','confirmed','unknown','nonload'].includes(p.structural))return false;
 if(p.svg!==undefined&&(typeof p.svg!=='string'||!safeSvg(p.svg)||!num(p.baseW)||!num(p.baseH)||p.baseW!<=0||p.baseH!<=0))return false;
 if(p.locked!==undefined&&typeof p.locked!=='boolean'||p.visible!==undefined&&typeof p.visible!=='boolean')return false;
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
