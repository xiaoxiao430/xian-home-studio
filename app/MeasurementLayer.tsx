import React from 'react';
import type {Dimension,Scene} from '../lib/geometry';
import type {RouteResult} from '../lib/routes';
import type {Point,Anchor} from '../lib/measurement-model';
export const dimensionText=(d:Dimension)=>d.status==='invalid'?'待复核':d.status==='overlap'?'重叠':`${d.estimated?'≈':''}${Math.round(d.value||0)} mm`;
export function labelPositions(dims:Dimension[],unit:number,compact=false){const taken:{x:number;y:number;w:number;h:number}[]=[];return dims.map((d,i)=>{const x=(d.a[0]+d.b[0])/2,y=(d.a[1]+d.b[1])/2,text=compact?String(i+1):`${i+1} · ${dimensionText(d)}`,w=(compact?25:Math.max(84,text.length*7))*unit,h=22*unit;let box={x:x-w/2,y:y-h-10*unit,w,h};outer:for(let k=0;k<150;k++){const angle=k*2.399963,rad=(12+Math.sqrt(k)*21)*unit;box={x:x+Math.cos(angle)*rad-w/2,y:y+Math.sin(angle)*rad-h/2,w,h};if(!taken.some(b=>box.x<b.x+b.w+3*unit&&box.x+box.w>b.x-3*unit&&box.y<b.y+b.h+3*unit&&box.y+box.h>b.y-3*unit))break outer;}taken.push(box);return {x:box.x+w/2,y:box.y+h/2,w,h,text};});}
export default function MeasurementLayer({dimensions,scene,routes,view,all,focus,onPick,draft,onAnchor,editingAnchor}:{dimensions:Dimension[];scene:Scene;routes:RouteResult[];view:number[];all:boolean;focus:string;onPick?:(d:Dimension)=>void;draft?:Point[];onAnchor?:(e:React.PointerEvent,anchor:Anchor,measureId:string,end:'a'|'b')=>void;editingAnchor?:string}){
 const unit=view[2]/1000,labels=labelPositions(dimensions,unit,all);
 return <g className="measurement-layer">
 <g pointerEvents="none">{scene.rooms.filter(r=>r.polygon.length).map(r=>{const points=r.polygon[0][0];return <path key={r.id} d={points.map((p,i)=>`${i?'L':'M'}${p.join(' ')}`).join(' ')+'Z'} fill="none" stroke="#74978b" strokeWidth={unit} strokeDasharray={`${unit*6} ${unit*5}`} opacity={all?.55:0}/>;})}
 {routes.map(r=><g key={r.id}><polyline points={r.points.map(p=>p.join(',')).join(' ')} fill="none" stroke={r.status==='ok'?'#228270':r.status==='borderline'?'#b88422':'#bd5946'} strokeWidth={3*unit} strokeDasharray={`${unit*9} ${unit*5}`} opacity=".85"/>{r.bottleneck&&r.width!==null&&<><circle cx={r.bottleneck[0]} cy={r.bottleneck[1]} r={r.width/2} fill="#d7833115" stroke="#bb7639" strokeWidth={unit*1.5}/><text x={r.bottleneck[0]} y={r.bottleneck[1]-r.width/2-8*unit} textAnchor="middle" fill="#9a612d" stroke="#fff" strokeWidth={unit*4} paintOrder="stroke" fontSize={unit*13}>通行估算 {Math.round(r.width)} mm</text></>}</g>)}
 </g>
 {dimensions.map((d,i)=>{if(d.value===null)return null;const lab=labels[i],color=d.status==='overlap'?'#bd5946':d.id===focus?'#bc671d':d.category==='size'?'#788b92':'#267896',len=Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])||1,nx=-(d.b[1]-d.a[1])/len*unit*4,ny=(d.b[0]-d.a[0])/len*unit*4;return <g key={d.id} data-dimension={d.id} className="dimension-item" onPointerDown={e=>{e.stopPropagation();onPick?.(d);}}>
 <path d={`M${d.a.join(' ')}L${d.b.join(' ')} M${d.a[0]-nx} ${d.a[1]-ny}L${d.a[0]+nx} ${d.a[1]+ny} M${d.b[0]-nx} ${d.b[1]-ny}L${d.b[0]+nx} ${d.b[1]+ny}`} fill="none" stroke={color} strokeWidth={(d.id===focus?2:1.1)*unit}/>
 <path d={`M${(d.a[0]+d.b[0])/2} ${(d.a[1]+d.b[1])/2}L${lab.x} ${lab.y}`} fill="none" stroke={color} strokeWidth={unit*.65} opacity={all?.3:.65}/>
 <rect x={lab.x-lab.w/2} y={lab.y-lab.h/2} width={lab.w} height={lab.h} rx={unit*3} fill={d.id===focus?'#fff2db':'#fffffff0'} stroke={color} strokeWidth={unit*.65}/>
 <text x={lab.x} y={lab.y} dominantBaseline="central" textAnchor="middle" fill={color} fontFamily="Microsoft YaHei" fontSize={unit*13}>{lab.text}</text><title>{`${d.name}：${dimensionText(d)}；${d.note}`}</title>
 {d.spec&&editingAnchor===d.id&&(['a','b'] as const).map(end=><circle key={end} className="measure-anchor" cx={d[end][0]} cy={d[end][1]} r={7*unit} fill="#fff" stroke="#b77330" strokeWidth={2*unit} onPointerDown={e=>{e.stopPropagation();onAnchor?.(e,d.spec![end],d.id,end);}}/>)}
 </g>;})}
 {draft&&draft.length>0&&<g pointerEvents="none"><polyline points={draft.map(p=>p.join(',')).join(' ')} fill="#cfa15015" stroke="#b98842" strokeWidth={unit*2} strokeDasharray={`${unit*5} ${unit*3}`}/>{draft.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={unit*5} fill="#b98842"/>)}</g>}
 </g>;
}
