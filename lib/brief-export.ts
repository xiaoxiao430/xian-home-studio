import type {Floor, Material, Piece} from './model';
import {defaultMaterial} from './model';
import {assetUrl} from './assets';
import {bbox, computeScene, difference, intersection, pieceShapes, simpleRing, toWorld, union, type Multi} from './geometry';
import {rectRing, type Point, type Ring} from './measurement-model';
import {getStairConfig,getStairVolumes,getStairSurveyWarnings} from './stairs';

export type Orientation = 'north' | 'east' | 'south' | 'west';
export const orientationLabels: Record<Orientation, string> = {north:'看向图纸上侧',east:'看向图纸右侧',south:'看向图纸下侧',west:'看向图纸左侧'};
export const dimensionSourceLabels = {drawing:'原图标注',measured:'现场复尺',design:'方案尺寸',provisional:'暂定 · 待复尺'};
export type SpatialVolume = {objectId:string;partId:string;name:string;polygon:Multi[number];bottom:number;top:number;kind:string;color:string;provisional:boolean;detail?:boolean;roundedMm?:number};
export type BriefOptions = {floor:Floor;selected?:string;material?:Material;variantName?:string;revision?:number|string;format:'pdf'|'svg'|'png';orientation?:Orientation;cutlineMm?:number;roomName?:string};
const esc = (s:unknown) => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const positive = (n:unknown,fallback:number) => typeof n==='number' && Number.isFinite(n) && n>0 ? n : fallback;
const source = (p:Piece) => p.dimensionSource || 'provisional';

export function floorHeight(f:Floor){return positive(f.ceilingHeightMm,3000);}
export function pieceHeight(p:Piece,f?:Floor){
 if(p.type==='zone')return 10;
 if(p.type==='wall')return positive(p.heightMm,f?floorHeight(f):3000);
 if(p.type==='opening')return positive(p.heightMm,p.openingKind==='window'?1200:2100);
 if(p.type==='stair')return positive(p.heightMm,f?floorHeight(f):3000);
 const fallback=p.cabinet?2400:/桌|办公/.test(p.name)?750:/沙发/.test(p.name)?850:/椅/.test(p.name)?900:/床/.test(p.name)?550:/电视柜|茶几/.test(p.name)?420:/厨房|岛/.test(p.name)?850:800;
 return positive(p.heightMm,fallback);
}
export function pieceElevation(p:Piece){return typeof p.elevationMm==='number' && Number.isFinite(p.elevationMm)?Math.max(0,p.elevationMm):p.type==='opening'&&p.openingKind==='window'?900:0;}
export function spatialWarnings(f:Floor){
 const visible=f.pieces.filter(p=>p.visible!==false),warnings:string[]=[];
 if(!f.ceilingHeightMm||f.heightSource==='provisional'||!f.heightSource)warnings.push(`层高 ${floorHeight(f)} mm 暂定，梁底和吊顶高度待复尺`);
 const unverified=visible.filter(p=>p.type!=='zone'&&source(p)==='provisional');
 if(unverified.length)warnings.push(`${unverified.length} 个对象高度为暂定值，不能作为下单或施工尺寸`);
 const over=visible.filter(p=>p.type!=='stair'&&p.type!=='wall'&&pieceHeight(p,f)+pieceElevation(p)>floorHeight(f));
 if(over.length)warnings.push(`${over.map(p=>p.name).join('、')} 高于当前层高`);
 for(const p of visible)if(p.cabinet){const total=p.cabinet.columns.reduce((s,c)=>s+c.width,0);if(Math.abs(total-p.w)>1)warnings.push(`${p.name} 分格合计 ${Math.round(total)} 与柜宽 ${Math.round(p.w)} 不一致`);if(p.cabinet.plinthMm+p.cabinet.topGapMm>=pieceHeight(p,f))warnings.push(`${p.name} 踢脚与顶部留空超过柜高`);}
 for(const p of visible.filter(p=>p.type==='stair'))warnings.push(...getStairSurveyWarnings(p));
 return warnings;
}

/** The drawn upper-floor opening is a study footprint, not a surveyed slab opening. */
export function spatialFloorSlab(f:Floor):Multi{
 const holes=f.pieces.filter(p=>p.visible!==false&&p.type==='stair'&&getStairConfig(p,f.id).level==='upper').map(p=>rectRing(0,0,p.w,p.h).map(q=>toWorld({...p,baseW:p.w,baseH:p.h},q)));
 return difference([[f.outline as Ring]],union(holes));
}

/** All views consume world-space polygons, including rotated L shapes and opening cuts. */
export function spatialVolumes(f:Floor,material:Material=defaultMaterial):SpatialVolume[]{
 const result:SpatialVolume[]=[],visible=f.pieces.filter(p=>p.visible!==false),openings=visible.filter(p=>p.type==='opening');
 const push=(p:Piece,polygon:Multi[number],bottom:number,top:number,partId:string,kind:string=p.type,color?:string,detail=false,roundedMm?:number)=>{
  if(top-bottom<.5||!polygon[0]||!simpleRing(polygon[0]))return;
  result.push({objectId:p.id,partId,name:p.name,polygon,bottom,top,kind,color:color||p.color||(kind==='wall'?material.wall:kind==='opening'?'#bed5d8':kind==='zone'?'#dce6ce':material.wood),provisional:source(p)==='provisional',detail,roundedMm});
 };
 for(const p of visible){
  const h=pieceHeight(p,f),z=pieceElevation(p);
  if(p.type==='stair'){result.push(...getStairVolumes(p,f.id));continue;}
  if(p.type==='zone'){push(p,[rectRing(0,0,p.baseW||p.w,p.baseH||p.h).map(q=>toWorld(p,q))],z,z+10,'zone','zone','#dce6ce');continue;}
  const shapes=pieceShapes(p).filter(s=>s.kind!=='operation');
  if(p.architecturalKind){for(const s of shapes)push(p,[s.ring],z,z+h,s.partId,'overhead',material.wall);continue;}
  if(p.type==='wall'){
   const hosts=openings.filter(o=>o.hostWallIds?.includes(p.id));
   const breaks=[z,z+h,...hosts.flatMap(o=>[pieceElevation(o),pieceElevation(o)+pieceHeight(o,f)])].filter(n=>n>=z&&n<=z+h).sort((a,b)=>a-b);
   const levels=[...new Set(breaks)];
   for(let i=1;i<levels.length;i++){
    const low=levels[i-1],high=levels[i],holes=hosts.filter(o=>pieceElevation(o)<high&&pieceElevation(o)+pieceHeight(o,f)>low).flatMap(o=>pieceShapes(o).filter(s=>s.kind!=='operation').map(s=>s.ring));
    for(const s of shapes)for(const polygon of difference([[s.ring]],union(holes)))push(p,polygon,low,high,s.partId+':band'+i);
   }
   continue;
  }
  const local=(ring:Ring)=>ring.map(q=>toWorld({...p,baseW:p.w,baseH:p.h},q));
  const ellipse=(x:number,y:number,w:number,d:number):Ring=>Array.from({length:32},(_,i)=>[x+w/2+Math.cos(i*Math.PI/16)*w/2,y+d/2+Math.sin(i*Math.PI/16)*d/2]);
  const box=(id:string,x:number,y:number,w:number,d:number,bottom:number,top:number,color:string,roundedMm?:number)=>push(p,[local(rectRing(x,y,w,d))],bottom,top,id,'furniture',color,true,roundedMm);
  if(/(?:^|-)tub$/.test(p.id)||/浴缸/.test(p.name)){
   const inset=Math.min(95,p.w*.1,p.h*.15),outer=local(rectRing(0,0,p.w,p.h)),inner=local(rectRing(inset,inset,p.w-inset*2,p.h-inset*2));
   push(p,[outer],z,z+85,'tub-base','furniture','#e5ded2');
   push(p,[outer,inner],z+85,z+h,'tub-rim','furniture','#f1ede5');
   push(p,[inner],z+86,z+95,'tub-well','furniture','#d4deda');
   box('tub-mixer',p.w*.48,12,80,35,z+h,z+h+100,'#6b6258');continue;
  }
  if(/double-vanity$/.test(p.id)||/双台盆/.test(p.name)){
   const holes=[.25,.75].map(cx=>local(ellipse(p.w*cx-Math.min(230,p.w*.13),p.h*.23,Math.min(460,p.w*.26),p.h*.55)));
   box('vanity-storage',0,0,p.w,p.h,z+100,z+h-180,material.wood);
   push(p,[local(rectRing(0,0,p.w,p.h)),...holes],z+h-65,z+h,'vanity-counter','furniture',material.stone);
   holes.forEach((hole,i)=>{push(p,[hole],z+h-165,z+h-155,`vanity-basin-${i}`,'furniture','#e6ece7');box(`vanity-tap-${i}`,p.w*(i?.75:.25)-15,30,30,40,z+h,z+h+140,'#796a57');});continue;
  }
  if(/(?:^|-)shower$/.test(p.id)||/独立淋浴/.test(p.name)){
   box('shower-tray',0,0,p.w,p.h,z,z+h,'#c9c4b8');
   box('shower-riser',p.w*.5-15,20,30,40,z+750,z+2100,'#756c60');
   box('shower-head',p.w*.5-120,20,240,260,z+2050,z+2080,'#827664');continue;
  }
  if(/(?:^|-)wc$/.test(p.id)||/马桶/.test(p.name)){
   box('wc-cistern',0,0,p.w,p.h*.25,z,z+h,'#e9e6dd',35);
   push(p,[local(ellipse(p.w*.06,p.h*.12,p.w*.88,p.h*.83))],z+90,z+430,'wc-bowl','furniture','#f0ede5');
   push(p,[local(ellipse(p.w*.10,p.h*.2,p.w*.8,p.h*.7)),local(ellipse(p.w*.23,p.h*.34,p.w*.54,p.h*.43))],z+430,z+470,'wc-seat','furniture','#d7d4c8');continue;
  }
  if(/mirror$/.test(p.id)||/化妆镜|台盆镜/.test(p.name)){for(const s of shapes)push(p,[s.ring],z,z+h,s.partId,'mirror','#b9c8c4');continue;}
  if(/(?:^|-)lounger$/.test(p.id)||/躺椅|贵妃椅/.test(p.name)){
   const seat=Math.min(440,h*.6),backLength=Math.min(600,p.h*.32),footHeight=Math.min(120,seat*.3);
   box('lounger-base',20,20,p.w-40,p.h-40,z+footHeight,z+seat*.7,material.wood,35);
   box('lounger-cushion',0,0,p.w,p.h,z+seat*.7,z+seat,'#cbbca9',65);
   for(let i=0;i<4;i++){const depth=backLength/4;box(`lounger-back-${i}`,20,i*depth,p.w-40,depth+6,z+seat-15,z+seat+(h-seat)*(1-i/4),'#d8c9b7',28);}
   for(const [x,y]of [[45,100],[p.w-80,100],[45,p.h-170],[p.w-80,p.h-170]])box(`lounger-foot-${x}-${y}`,x,y,35,45,z,z+footHeight,material.wood);
   continue;
  }
  if(/(?:^|-)bed$/.test(p.id)||/双人床|主卧床/.test(p.name)){
   box('bed-base',0,0,p.w,p.h,z+60,z+h*.5,material.wood,25);
   box('bed-mattress',20,35,p.w-40,p.h-55,z+h*.5,z+h*.82,'#d5c6b4',70);
   box('bed-headboard',0,0,p.w,110,z+h*.3,z+positive(p.partHeightsMm?.headboard,h),'#9b8a79',50);
   for(const i of [0,1])box(`bed-pillow-${i}`,p.w*(.08+i*.45),155,p.w*.37,420,z+h*.82,z+h,'#e7ded0',45);
   continue;
  }
  if(p.cabinet&&p.type==='furniture'){
   const c=p.cabinet,thick=Math.min(20,p.w/10,p.h/10),base=z+c.plinthMm,top=Math.max(base+thick,z+h-c.topGapMm);
   const rect=(x:number,y:number,w:number,d:number,lo:number,hi:number,id:string,color?:string)=>{if(w>0&&d>0)push(p,[rectRing(x,y,w,d).map(q=>toWorld({...p,baseW:p.w,baseH:p.h},q))],lo,hi,id,'furniture',color,true);};
   rect(0,0,p.w,thick,base,top,'cab-back');
   rect(0,0,thick,p.h,base,top,'cab-left');rect(p.w-thick,0,thick,p.h,base,top,'cab-right');
   rect(0,0,p.w,p.h,base,base+thick,'cab-bottom');rect(0,0,p.w,p.h,top-thick,top,'cab-top');
   if(c.plinthMm>0)rect(0,0,p.w,Math.max(thick,p.h-60),z,base,'cab-plinth','#766b5d');
   let x=0;
   c.columns.forEach((col,i)=>{
    const width=col.width;
    if(i>0)rect(x-thick/2,0,thick,p.h,base,top,`cab-divider-${i}`);
    const drawerHeight=Math.min(260,(top-base)/(Math.max(1,col.drawers)+1));
    for(let n=1;n<=col.drawers;n++){const dz=base+(n-1)*drawerHeight;rect(x+thick,p.h-thick,width-2*thick,thick,dz,dz+drawerHeight-3,`cab-drawer-${i}-${n}`,material.stone);}
    const shelfBottom=base+col.drawers*drawerHeight;
    for(let n=1;n<=col.shelves;n++){const sz=shelfBottom+(top-shelfBottom)*n/(col.shelves+1);rect(x+thick,0,width-2*thick,p.h-thick,sz,sz+thick,`cab-shelf-${i}-${n}`);}
    if(!col.open&&col.hinge!=='none'&&top>shelfBottom+thick){
     if(c.doorOpen){const hingeX=col.hinge==='right'?x+width-thick:x;rect(hingeX,p.h,thick,Math.max(thick,width-3),shelfBottom,top,`cab-door-open-${i}`,material.stone);}
     else rect(x+2,p.h-thick,width-4,thick,shelfBottom,top,`cab-door-${i}`,material.wood);
    }
    x+=width;
   });
   continue;
  }
  for(const s of shapes){
   const chair=/chair|stored|extra/.test(s.partId)||/椅/.test(p.name),sofa=/沙发/.test(p.name),table=(/桌|办公|餐岛|坐式化妆台/.test(p.name)||/makeup-desk$/.test(p.id))&&!chair&&!sofa,partHeight=positive(p.partHeightsMm?.[s.partId],chair&& !/椅/.test(p.name)?850:h);
   if(table){
    push(p,[s.ring],z+Math.max(0,partHeight-45),z+partHeight,s.partId+':top','furniture',material.stone);
    const b=bbox(s.ring),leg=Math.min(65,b.w/6,b.h/6);
    for(const q of s.ring.slice(0,4)){const cx=q[0]*.88+(b.x+b.w/2)*.12,cy=q[1]*.88+(b.y+b.h/2)*.12;const clipped=intersection([[rectRing(cx-leg/2,cy-leg/2,leg,leg)]],[[s.ring]]);for(const poly of clipped)push(p,poly,z,z+partHeight-45,s.partId+':leg','furniture');}
   }else if(chair||sofa){const seat=Math.min(sofa?450:460,partHeight*.55);push(p,[s.ring],z+(sofa?70:Math.max(0,seat-60)),z+seat,s.partId+':seat',p.type,sofa?'#cbbca9':undefined,false,sofa?80:28);const ring=s.ring,a=ring[0],b=ring[1],c=ring[2],d=ring[3]||ring.at(-1)!;const t=Math.min(.25,(sofa?200:45)/Math.max(1,Math.hypot(d[0]-a[0],d[1]-a[1])));const at=(u:number,v:number):Point=>[a[0]+(b[0]-a[0])*u+(d[0]-a[0])*v,a[1]+(b[1]-a[1])*u+(d[1]-a[1])*v];
    if(ring.length<=5)for(const [u,v]of [[.1,.12],[.86,.12],[.1,.84],[.86,.84]])push(p,[[at(u,v),at(u+.04,v),at(u+.04,v+.05),at(u,v+.05)]],z,z+(sofa?70:Math.max(0,seat-60)),s.partId+':foot-'+u+'-'+v,p.type,material.wood,true);
    if(sofa&&ring.length<=5){const count=Math.max(2,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/850));for(let i=0;i<count;i++){const l=i/count+.008,r=(i+1)/count-.008;push(p,[[at(l,.015),at(r,.015),at(r,t),at(l,t)]],z+seat-25,z+partHeight,s.partId+':cushion-'+i,p.type,'#d8c9b7',true,65);}for(const u of [0,.94])push(p,[[at(u,t),at(u+.06,t),at(u+.06,.92),at(u,.92)]],z+seat-80,z+seat+170,s.partId+':arm-'+u,p.type,'#c8b9a6',true,45);}
    else push(p,[[a,b,[b[0]+(c[0]-b[0])*t,b[1]+(c[1]-b[1])*t],[a[0]+(d[0]-a[0])*t,a[1]+(d[1]-a[1])*t]]],z+seat,z+partHeight,s.partId+':back',p.type,undefined,false,24);
   }
   else push(p,[s.ring],z,z+partHeight,s.partId,p.type);
  }
 }
 // When a hosted opening moves, the plan restores its old aperture. Reflect the same infill here.
 for(const s of computeScene(f).shapes.filter(s=>s.kind==='wall'&&s.key.includes(':filled:'))){const p=visible.find(p=>p.id===s.objectId);if(p)push(p,[s.ring],0,floorHeight(f),s.partId+':infill','wall',material.wall);}
 return result;
}

export function projection(q:Point,orientation:Orientation):Point{
 if(orientation==='north')return [q[0],q[1]];
 if(orientation==='south')return [-q[0],-q[1]];
 if(orientation==='east')return [-q[1],-q[0]];
 return [q[1],q[0]];
}
/** Intersect an actual polygon with a cut; concave outlines can yield multiple intervals. */
export function sectionIntervals(polygon:Multi[number],orientation:Orientation,cutlineMm:number):[number,number][]{
 const projected=polygon.map(r=>r.map(p=>projection(p,orientation))),crossings:number[]=[];
 for(const ring of projected)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[1]<=cutlineMm&&b[1]>cutlineMm)||(b[1]<=cutlineMm&&a[1]>cutlineMm))crossings.push(a[0]+(b[0]-a[0])*(cutlineMm-a[1])/(b[1]-a[1]));}
 crossings.sort((a,b)=>a-b);const intervals:[number,number][]=[];
 for(let i=1;i<crossings.length;i+=2)if(crossings[i]-crossings[i-1]>.01)intervals.push([crossings[i-1],crossings[i]]);
 return intervals;
}
export type ElevationItem = {volume:SpatialVolume;left:number;right:number;depth:number};
export function elevationItems(f:Floor,orientation:Orientation,cutlineMm?:number,material?:Material):ElevationItem[]{
 return spatialVolumes(f,material).flatMap(volume=>{const pts=volume.polygon[0].map(p=>projection(p,orientation));const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const spans=cutlineMm===undefined?[[Math.min(...xs),Math.max(...xs)] as [number,number]]:sectionIntervals(volume.polygon,orientation,cutlineMm);return spans.map(([left,right])=>({volume,left,right,depth:Math.max(...ys)}));}).sort((a,b)=>a.depth-b.depth);
}

export type ElevationOptions={floor:Floor;orientation?:Orientation;selected?:string;cutlineMm?:number;material?:Material;focus?:boolean};
export function elevationSvgContent({floor:f,orientation='north',selected='',cutlineMm,material=defaultMaterial,focus=false}:ElevationOptions){
 const items=elevationItems(f,orientation,cutlineMm,material),all=focus&&selected?items.filter(i=>i.volume.objectId===selected):items;
 const projected=f.outline.map(q=>projection(q as Point,orientation)),range=all.length&&focus?all.flatMap(i=>[i.left,i.right]):projected.map(p=>p[0]);
 const min=Math.min(...range),max=Math.max(...range),height=Math.max(floorHeight(f),...all.map(i=>i.volume.top)),bottomExtent=Math.min(0,...all.map(i=>i.volume.bottom)),pad=Math.max(focus?400:230,(max-min)/25),fontSize=Math.max(focus?140:52,(max-min)/105);
 let body=`<rect x="${min-pad}" y="${-height-pad*1.5}" width="${max-min+pad*3}" height="${height-bottomExtent+pad*4}" fill="#fffdf9"/><path d="M${min} 0H${max} M${min} ${-floorHeight(f)}H${max}" stroke="#a7aaa3" stroke-width="8" stroke-dasharray="40 22"/>`;
 // Architectural contours remain readable behind furniture in this orthographic overlay.
 const sorted=[...all.filter(i=>i.volume.kind==='wall'),...all.filter(i=>i.volume.kind!=='wall')];
 for(const i of sorted){const v=i.volume,isSelected=v.objectId===selected,wall=v.kind==='wall',window=v.kind==='opening';body+=`<g data-object="${esc(v.objectId)}" tabindex="0" role="button" aria-label="${esc(v.name)}"><title>${esc(v.name)} · 顶 ${Math.round(v.top)} / 底 ${Math.round(v.bottom)} mm${v.provisional?' · 高度暂定':''}</title><rect x="${i.left}" y="${-v.top}" width="${Math.max(1,i.right-i.left)}" height="${v.top-v.bottom}" fill="${esc(v.color)}" fill-opacity="${wall?.16:window?.3:.92}" stroke="${isSelected?'#b36732':wall?'#a6aaa4':'#6e776e'}" stroke-width="${isSelected?12:5}" ${v.provisional?'stroke-dasharray="26 12"':''}/></g>`;}
 const p=f.pieces.find(p=>p.id===selected&&p.visible!==false),selectedItems=all.filter(i=>i.volume.objectId===selected);
 if(p&&selectedItems.length){const left=Math.min(...selectedItems.map(i=>i.left)),right=Math.max(...selectedItems.map(i=>i.right)),top=p.type==='stair'?Math.max(...selectedItems.map(i=>i.volume.top)):pieceElevation(p)+pieceHeight(p,f),bottom=p.type==='stair'?Math.min(...selectedItems.map(i=>i.volume.bottom)):pieceElevation(p),lineY=-bottomExtent+pad*.8,x=right+pad*.5;body+=`<g fill="none" stroke="#b36732" stroke-width="7"><path d="M${left} ${-bottom+25}V${lineY+35}M${right} ${-bottom+25}V${lineY+35}M${left} ${lineY}H${right}M${left-25} ${lineY+25}l50 -50M${right-25} ${lineY+25}l50 -50${p.type==='stair'?'':`M${right} ${-top}H${x+35}M${right} ${-bottom}H${x+35}M${x} ${-top}V${-bottom}` }"/></g><text x="${(left+right)/2}" y="${lineY+fontSize*1.3}" text-anchor="middle" font-size="${fontSize}">投影宽 ${Math.round(right-left)}</text>${p.type==='stair'?'':`<text x="${x+fontSize*.2}" y="${-(top+bottom)/2}" font-size="${fontSize}">高 ${Math.round(pieceHeight(p,f))}</text>`}<text x="${left}" y="${-top-fontSize*.65}" font-size="${fontSize}" fill="#865123">${esc(p.name)} · ${p.type==='stair'?'踏步示意 · 层间高度待复测':esc(dimensionSourceLabels[source(p)])}</text>`;}
 body+=`<text x="${min}" y="${-bottomExtent+pad*2.5}" font-size="${focus?fontSize*.72:fontSize}">完成地面 ±0 · 层高 ${floorHeight(f)} · 单位 mm${bottomExtent<0?' · 下行梯段位于本层地面以下':''}</text>`;
 return {body,viewBox:[min-pad,-height-pad*1.5,max-min+pad*3,height-bottomExtent+pad*4] as [number,number,number,number]};
}

function panel(title:string,x:number,y:number,w:number,h:number,content:string){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#ffffff" stroke="#dedfd6"/><text x="${x+22}" y="${y+33}" font-size="19" font-weight="700">${esc(title)}</text>${content}`;}
function fitSvg(body:string,viewBox:number[],x:number,y:number,w:number,h:number){return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox.join(' ')}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;}
function wrapText(text:string,max=44){const chars=Array.from(text),lines:string[]=[];for(let i=0;i<chars.length;i+=max)lines.push(chars.slice(i,i+max).join(''));return lines;}
export function spatialBriefSvg(options:Omit<BriefOptions,'format'>,fontBase64?:string){
 const {floor:f,material=defaultMaterial,selected='',orientation='north',revision='草稿',variantName='当前方案'}=options,b=bbox(f.outline as Ring),scene=computeScene(f);
 if(!scene.valid)throw Error(scene.error||'平面几何无效，请先修复边界');
 const room=options.roomName&&options.roomName!=='整体'?f.rooms.find(r=>r.name===options.roomName):undefined;
 if(options.roomName&&options.roomName!=='整体'&&!room)throw Error('当前楼层没有该空间，请重新选择交底范围。');
 const scopeRing=room?rectRing(room.x,room.y,room.w,room.h):undefined;
 const scopedPieces=scopeRing?f.pieces.filter(p=>p.visible!==false&&(p.type==='zone'?intersection([[rectRing(p.x,p.y,p.w,p.h)]],[[scopeRing]]).length:pieceShapes(p).some(s=>intersection([[s.ring]],[[scopeRing]]).length))):f.pieces;
 const scopedFloor=room?{...f,pieces:scopedPieces,outline:scopeRing!,rooms:[room]}:f;
 const p=scopedPieces.find(p=>p.id===selected&&p.visible!==false),font=fontBase64?`@font-face{font-family:'Microsoft YaHei';src:url(data:font/woff2;base64,${fontBase64}) format('woff2');}`:'';
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="1188" viewBox="0 0 1680 1188"><style>${font}text{font-family:'Microsoft YaHei';fill:#334b43}*{box-sizing:border-box}</style><rect width="1680" height="1188" fill="#f4f3ed"/><rect x="35" y="35" width="7" height="78" fill="#557665"/><text x="60" y="65" font-size="27" font-weight="700">${esc(f.name)} · ${esc(variantName)}${room?' · '+esc(room.name):''} · 空间交底参考</text><text x="60" y="94" font-size="15">版本 ${esc(revision)} · ${esc(new Date().toLocaleString('zh-CN'))} · 尺寸 mm · 供设计师查看深化，未签发施工</text>`;
 let plan=`<polygon points="${f.outline.map(p=>p.join(',')).join(' ')}" fill="#faf8f2" stroke="#66786c" stroke-width="15"/>`;
 for(const s of scene.shapes.filter(s=>s.kind!=='operation'&&s.kind!=='stair'))plan+=`<polygon points="${s.ring.map(q=>q.join(',')).join(' ')}" fill="${s.kind==='overhead'?'none':s.objectId===p?.id?'#d2a574':s.kind==='wall'?'#526059':s.kind==='opening'?'#c7d9df':'#e0d7c6'}" stroke="#7b847c" stroke-width="8"${s.kind==='overhead'?' stroke-dasharray="65 35"':''}/>`;
 // Vector top views share the same fixture and stair parts as the elevations and 3D.
 const signed=(ring:Ring)=>ring.reduce((sum,a,i)=>{const next=ring[(i+1)%ring.length];return sum+a[0]*next[1]-next[0]*a[1];},0);
 for(const v of spatialVolumes(f,material).filter(v=>['furniture','stair','mirror'].includes(v.kind)).sort((a,b)=>a.top-b.top)){
  const outerSign=signed(v.polygon[0]);const d=v.polygon.map((ring,i)=>{const points=i&&signed(ring)*outerSign>0?[...ring].reverse():ring;return 'M'+points.map(q=>q.join(' ')).join(' L')+' Z';}).join(' ');
  plan+=`<path d="${d}" fill="${v.color}" stroke="${v.objectId===p?.id?'#af7141':'#817467'}" stroke-width="8"/>`;
 }
 for(const stair of f.pieces.filter(p=>p.visible!==false&&p.type==='stair')){
  const c=getStairConfig(stair,f.id),local={...stair,baseW:stair.w,baseH:stair.h},q=(x:number,y:number)=>toWorld(local,[stair.w*x,stair.h*y]);
  const down=c.level==='upper',left=down?.75:.25,right=down?.25:.75,points=[q(left,.12),q(left,.8),q(right,.8),q(right,.09)],tip=q(right,.09),arrow=[tip,q(right-.035,.15),q(right+.035,.15)],label=q(.5,.96);
  plan+=`<path d="M${points.map(q=>q.join(' ')).join(' L')}" fill="none" stroke="#486a58" stroke-width="24"/><polygon points="${arrow.map(q=>q.join(',')).join(' ')}" fill="#486a58"/><text x="${label[0]}" y="${label[1]}" font-size="115" text-anchor="middle">${down?'下行':'上行'} · U 形示意</text>`;
 }
 for(const zone of f.pieces.filter(p=>p.type==='zone'&&p.visible!==false))plan+=`<polygon points="${rectRing(0,0,zone.w,zone.h).map(q=>toWorld({...zone,baseW:zone.w,baseH:zone.h},q)).map(q=>q.join(',')).join(' ')}" fill="#dce6ce" fill-opacity=".7"/>`;
 if(room)plan+=`<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="#d4a977" fill-opacity=".14" stroke="#ad6b37" stroke-width="22" stroke-dasharray="90 45"/><text x="${room.x+70}" y="${room.y+200}" font-size="175" fill="#9a592c">${esc(room.name)} · 交底圈选范围</text>`;
 const outlineTextSize=Math.max(180,b.w/70),labelBoxes:{x:number;y:number;w:number;h:number}[]=[],occupied=scene.shapes.filter(s=>['wall','furniture','stair'].includes(s.kind)).map(s=>bbox(s.ring));
 const textUnits=(s:string)=>Array.from(s).reduce((sum,c)=>sum+(/[\x00-\x7f]/.test(c)?.58:1.05),0),overlaps=(a:{x:number;y:number;w:number;h:number},q:{x:number;y:number;w:number;h:number})=>a.x<q.x+q.w&&a.x+a.w>q.x&&a.y<q.y+q.h&&a.y+a.h>q.y;
 let selectedLabel='';
 if(p){
  const points=pieceShapes(p).filter(s=>s.kind!=='operation').flatMap(s=>s.ring),pb=points.length?bbox(points):p,text=`${p.name} ${Math.round(p.w)}×${Math.round(p.h)}`,fontSize=Math.min(outlineTextSize*1.1,(b.w+360)/Math.max(1,textUnits(text))),width=textUnits(text)*fontSize;
  const x=Math.max(b.x-180+width/2,Math.min(b.x+b.w+180-width/2,pb.x+pb.w/2)),minY=b.y-300+fontSize*1.25,maxY=b.y+b.h+540;
  const candidates=[pb.y-120,pb.y-fontSize*2,pb.y+pb.h+fontSize*1.25,minY].map(y=>Math.max(minY,Math.min(maxY,y)));
  const y=candidates.find(y=>!occupied.some(q=>overlaps({x:x-width/2,y:y-fontSize*1.1,w:width,h:fontSize*1.35},q)))??minY;
  labelBoxes.push({x:x-width/2,y:y-fontSize*1.1,w:width,h:fontSize*1.35});
  selectedLabel=`<text x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}">${esc(text)}</text>`;
 }
 for(const room of f.rooms){
  const width=textUnits(room.name)*outlineTextSize+80,height=outlineTextSize*1.35;if(width>room.w-100||height>room.h-100)continue;
  for(const [u,v]of [[.5,.5],[.5,.72],[.5,.28],[.28,.5],[.72,.5],[.28,.72],[.72,.72],[.28,.28],[.72,.28]]){
   const x=room.x+room.w*u,y=room.y+room.h*v,box={x:x-width/2,y:y-height*.5,w:width,h:height};
   if(box.x<room.x+50||box.x+box.w>room.x+room.w-50||box.y<room.y+50||box.y+box.h>room.y+room.h-50||[...occupied,...labelBoxes].some(q=>overlaps(box,q)))continue;
   labelBoxes.push(box);plan+=`<text x="${x}" y="${y+outlineTextSize*.35}" text-anchor="middle" font-size="${outlineTextSize}">${esc(room.name)}</text>`;break;
  }
 }
 plan+=selectedLabel;
 const arrowY=b.y+b.h+260;plan+=`<path d="M${b.x} ${arrowY}h2000" stroke="#486a58" stroke-width="28"/><text x="${b.x}" y="${arrowY+190}" font-size="150">0 — 2000 mm</text>`;
 svg+=panel('01 全层定位'+(room?' / '+room.name+'圈选范围':''),35,135,710,675,fitSvg(plan,[b.x-250,b.y-300,b.w+500,b.h+900],55,190,670,600));
 const e=elevationSvgContent({floor:scopedFloor,orientation,selected:p?.id||'',material,focus:!!p,cutlineMm:options.cutlineMm});
 svg+=panel(`02 ${p?p.name+' · ':room?room.name+'圈选 · ':''}${options.cutlineMm===undefined?'投影立面':'尺寸剖面'} / ${orientationLabels[orientation]}`,765,135,880,430,fitSvg(e.body,e.viewBox,780,191,850,355));
 const details=[p?p.type==='stair'?`${p.name}：占地 ${Math.round(p.w)} × ${Math.round(p.h)}；层间高度 ${getStairConfig(p,f.id).riseMm}（示意）`:`${p.name}：宽 ${Math.round(p.w)} × 深 ${Math.round(p.h)} × 高 ${Math.round(pieceHeight(p,f))}`:'选择对象后可导出其外尺寸、底标高和柜体分格',p?p.type==='stair'?`${getStairConfig(p,f.id).level==='upper'?'二层到达 / 下行，梯段位于本层地面以下':'一层上行'}；踏步、扶手及楼板洞口待复测`:`底标高 +${pieceElevation(p)}；顶标高 +${pieceElevation(p)+pieceHeight(p,f)}；${dimensionSourceLabels[source(p)]}`:`当前层高 ${floorHeight(f)}；来源 ${f.heightSource?dimensionSourceLabels[f.heightSource]:'暂定 · 待复尺'}`,`风格：${material.style}`,`木色 ${material.wood} / 石材 ${material.stone} / 墙面 ${material.wall}`,`照明意向：${material.light}`];
 if(p?.cabinet)details.push(`柜体：${p.cabinet.columns.length} 列；踢脚 ${p.cabinet.plinthMm}；顶部留空 ${p.cabinet.topGapMm}`,`分格宽：${p.cabinet.columns.map(c=>Math.round(c.width)).join(' / ')}`,`层板 ${p.cabinet.columns.map(c=>c.shelves).join(' / ')}；抽屉 ${p.cabinet.columns.map(c=>c.drawers).join(' / ')}；柜门${p.cabinet.doorOpen?'开启':'关闭'}`);
 if(room){const furniture=scopedPieces.filter(p=>p.type==='furniture');details.push(`圈选家具 ${furniture.length} 件：${furniture.map(p=>p.name).join('、')}`);}
 const lines=details.flatMap(t=>wrapText(t,51)).slice(0,10);svg+=panel('03 尺寸与材料意向',765,580,880,230,lines.map((s,i)=>`<text x="787" y="${632+i*19}" font-size="14">${esc(s)}</text>`).join(''));
 const warnings=[...(room?[`${room.name}为交底圈选范围 ${Math.round(room.w)}×${Math.round(room.h)} mm，不代表已实测的闭合房间；跨界对象按相交归入。`]:[]),...spatialWarnings(scopedFloor),'墙体结构性质、门窗高度、设备安装及检修条件由设计师结合现场复核。','材质色号为意向，实际品牌、型号、工艺和封样待确认。','楼梯梯段、平台与扶手为转向示意；二层按当前占地示意留空，不代表楼板洞口已复核。'];
 if(material.notes)warnings.push('材料说明：'+material.notes);
 const noteLines=warnings.flatMap(s=>wrapText('• '+s,95)).slice(0,11);svg+=panel('04 待确认事项与使用说明',35,830,1610,275,noteLines.map((s,i)=>`<text x="57" y="${887+i*19}" font-size="15">${esc(s)}</text>`).join(''));
 svg+=`<text x="40" y="1153" font-size="14">A3 横向 · 按图示比例尺读取；本页为设计沟通资料，具体施工节点由设计师深化。</text><text x="1640" y="1153" font-size="14" text-anchor="end">01 / 01</text></svg>`;return svg;
}

let fontPromise:Promise<ArrayBuffer>|undefined,woffPromise:Promise<ArrayBuffer>|undefined;
async function loadFont(kind:'ttf'|'woff2'){const promise=fetch(assetUrl(kind==='ttf'?'fonts/yahei.ttf':'fonts/yahei-full.woff2')).then(r=>{if(!r.ok)throw Error('微软雅黑字体未加载，无法导出');return r.arrayBuffer();});return promise;}
function b64(bytes:ArrayBuffer){let s='';const b=new Uint8Array(bytes);for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);}
async function pngFromSvg(svg:string){
 const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('交底图渲染失败'));image.src=url;});const canvas=document.createElement('canvas');canvas.width=3360;canvas.height=2376;const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器不支持画布导出');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG 导出失败')),'image/png'));}finally{URL.revokeObjectURL(url);}
}
/** Draw the same small SVG vocabulary as vectors; every visible PDF label uses embedded YaHei. */
export async function spatialBriefPdf(options:Omit<BriefOptions,'format'>){
 const [{PDFDocument,rgb,pushGraphicsState,popGraphicsState,rectangle,clip,endPath},fontkit]=await Promise.all([import('pdf-lib'),import('@pdf-lib/fontkit')]);
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit.default);const font=await doc.embedFont(await(fontPromise??=loadFont('ttf')),{subset:true});
 const W=1190.55,H=841.89,page=doc.addPage([W,H]),root=new DOMParser().parseFromString(spatialBriefSvg(options),'image/svg+xml').documentElement;
 type Paint={fill:string;stroke:string;width:number;opacity:number;fontSize:number};
 const color=(s:string)=>{const hex=s.replace('#','');const v=hex.length===3?hex.split('').map(c=>c+c).join(''):hex;return rgb(parseInt(v.slice(0,2),16)/255||0,parseInt(v.slice(2,4),16)/255||0,parseInt(v.slice(4,6),16)/255||0);};
 const number=(el:Element,key:string,fallback=0)=>{const v=Number(el.getAttribute(key));return el.hasAttribute(key)&&Number.isFinite(v)?v:fallback;};
 function visit(el:Element,tx:number,ty:number,scale:number,inherited:Paint){
  const tag=el.localName;if(['style','title','defs'].includes(tag))return;
  const paint={fill:el.getAttribute('fill')||inherited.fill,stroke:el.getAttribute('stroke')||inherited.stroke,width:number(el,'stroke-width',inherited.width),opacity:number(el,'fill-opacity',inherited.opacity),fontSize:number(el,'font-size',inherited.fontSize)};
  const nested=tag==='svg'&&el!==root;
  if(nested){const vb=(el.getAttribute('viewBox')||'0 0 1 1').split(/\s+/).map(Number),w=number(el,'width'),h=number(el,'height'),ratio=Math.min(w/vb[2],h/vb[3]);page.pushOperators(pushGraphicsState(),rectangle(tx+number(el,'x')*scale,H-ty-(number(el,'y')+h)*scale,w*scale,h*scale),clip(),endPath());tx+=(number(el,'x')+(w-vb[2]*ratio)/2-vb[0]*ratio)*scale;ty+=(number(el,'y')+(h-vb[3]*ratio)/2-vb[1]*ratio)*scale;scale*=ratio;}
  const fill=paint.fill==='none'?undefined:color(paint.fill),stroke=paint.stroke==='none'?undefined:color(paint.stroke),borderWidth=stroke?paint.width*scale:0;
  if(tag==='rect'){page.drawRectangle({x:tx+number(el,'x')*scale,y:H-ty-(number(el,'y')+number(el,'height'))*scale,width:number(el,'width')*scale,height:number(el,'height')*scale,color:fill,borderColor:stroke,borderWidth,opacity:paint.opacity});}
  if(tag==='path'||tag==='polygon'){
   const d=tag==='path'?el.getAttribute('d')||'':`M${(el.getAttribute('points')||'').trim().split(/\s+/).join(' L')} Z`;
   if(d.length>2)page.drawSvgPath(d,{x:tx,y:H-ty,scale,color:fill,borderColor:stroke,borderWidth,borderDashArray:el.hasAttribute('stroke-dasharray')?el.getAttribute('stroke-dasharray')!.split(/[\s,]+/).map(v=>Number(v)*scale):undefined,opacity:paint.opacity});
  }
  if(tag==='text'){
   const text=el.textContent||'',size=paint.fontSize*scale,width=font.widthOfTextAtSize(text,size),anchor=el.getAttribute('text-anchor');let x=tx+number(el,'x')*scale;if(anchor==='middle')x-=width/2;if(anchor==='end')x-=width;page.drawText(text,{x,y:H-ty-number(el,'y')*scale,size,font,color:el.hasAttribute('fill')?color(el.getAttribute('fill')!):rgb(.2,.294,.263)});
  }
  for(const child of Array.from(el.children))visit(child,tx,ty,scale,paint);
  if(nested)page.pushOperators(popGraphicsState());
 }
 visit(root,0,0,W/1680,{fill:'#000000',stroke:'none',width:1,opacity:1,fontSize:16});
 doc.setTitle(options.floor.name+'空间交底参考');doc.setSubject('方案几何与材料意向；设计师深化前不作施工依据');return doc.save();
}
export async function exportSpatialBrief(options:BriefOptions){
 let blob:Blob;
 if(options.format==='pdf')blob=new Blob([await spatialBriefPdf(options) as BlobPart],{type:'application/pdf'});
 else{const font=await(woffPromise??=loadFont('woff2')),svg=spatialBriefSvg(options,b64(font));blob=options.format==='svg'?new Blob([svg],{type:'image/svg+xml'}):await pngFromSvg(svg);}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${options.floor.name}-${options.variantName||'当前方案'}-空间交底-V${options.revision||'草稿'}.${options.format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
