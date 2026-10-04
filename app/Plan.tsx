import {Floor,Piece,transform,changedPiece} from '../lib/model';
import React from 'react';
export function PieceDrawing({p,selected=false,labels=true,ghost=false}:{p:Piece;selected?:boolean;labels?:boolean;ghost?:boolean}){
 const wall=p.type==='wall',struct=wall&&p.structural!=='nonload',fill=wall?(p.structural==='candidate'||p.structural==='confirmed'?'#334a50':'#959f9a'):p.type==='stair'?'#e9edf0':p.type==='opening'?'#dce9ed':p.type==='zone'?'#e6eddf':p.color||'#d9c3a5';
 const bw=p.baseW||p.w,bh=p.baseH||p.h;let body;
 if(p.svg)body=<g dangerouslySetInnerHTML={{__html:p.svg}}/>;
 else if(p.type==='opening'&&(p.openingKind==='door'||p.openingKind==='opening'||p.name.includes('门')))body=<><rect width={bw} height={bh} fill="#fffef9"/><path d={bw>bh?`M0 ${bh/2}H${bw}`:`M${bw/2} 0V${bh}`} stroke="#b8a88c" strokeWidth="9" strokeDasharray="50 40"/></>;
 else if(p.type==='opening')body=<><rect width={bw} height={bh} fill={fill} stroke="#7695a1" strokeWidth="14"/><path d={bw>bh?`M0 ${bh/3}H${bw}M0 ${bh*2/3}H${bw}`:`M${bw/3} 0V${bh}M${bw*2/3} 0V${bh}`} stroke="#86a1a9" strokeWidth="9"/></>;
 else body=<><rect width={bw} height={bh} rx={wall?0:p.type==='stair'?15:50} fill={fill} stroke={wall?'#566964':'#8c998f'} strokeWidth={wall?'5':'12'}/>{p.name.includes('床')&&<><rect x={bw*.06} y={bh*.08} width={bw*.88} height={bh*.78} rx="35" fill="#f5f3ec" stroke="#b1b4a9" strokeWidth="8"/><rect x={bw*.10} y={bh*.1} width={bw*.34} height={bh*.16} rx="32" fill="#ddd8ce"/><rect x={bw*.55} y={bh*.1} width={bw*.34} height={bh*.16} rx="32" fill="#ddd8ce"/></>}{p.name.includes('柜')&&<path d={`M${bw/2} 0V${bh}`} stroke="#ad9270" strokeWidth="8"/>}{p.name.includes('沙发')&&<rect x="65" y="100" width={Math.max(50,bw-130)} height={Math.max(50,bh-160)} fill="#ede6d9" rx="55" stroke="#ac9f8d" strokeWidth="12"/>}</>;
 return <g transform={transform(p)} opacity={ghost?.27:1} className={ghost?'ghost-object':undefined}>
 {ghost?<rect width={bw} height={bh} fill="none" stroke="#9e5f48" strokeDasharray="65 38" strokeWidth="16"/>:body}
 {!ghost&&labels&&p.type!=='wall'&&p.type!=='opening'&&<g style={{pointerEvents:'none'}}><text x={bw/2} y={bh/2-32} textAnchor="middle" dominantBaseline="middle" className="plan-label">{p.name}</text><text x={bw/2} y={bh/2+130} textAnchor="middle" className="plan-size">{Math.round(p.w)} × {Math.round(p.h)}</text></g>}
 {selected&&!ghost&&<rect x="-32" y="-32" width={bw+64} height={bh+64} fill="none" stroke="#247da0" strokeWidth="16" strokeDasharray="60 35"/>}
 {struct&&changedPiece(p)&&!ghost&&<rect width={bw} height={bh} fill="none" stroke="#bb6d34" strokeWidth="27"/>}
 </g>;
}
export default function Plan({floor,selected,view,grid,original,labels=true,boundary=false,onDown,onBackground,onVertex,onResize,svgRef,measure,previewWall}:{floor:Floor;selected:string;view:number[];grid:boolean;original:boolean;labels?:boolean;boundary?:boolean;onDown?:(e:React.PointerEvent,p:Piece)=>void;onBackground?:(e:React.PointerEvent)=>void;onVertex?:(e:React.PointerEvent,i:number)=>void;onResize?:(e:React.PointerEvent,p:Piece)=>void;svgRef?:React.RefObject<SVGSVGElement|null>;measure?:number[][];previewWall?:Piece|null}){
 const p=floor.pieces.find(p=>p.id===selected&&p.visible!==false);return <svg ref={svgRef} id="floor-plan" viewBox={view.join(' ')} xmlns="http://www.w3.org/2000/svg" tabIndex={0} aria-label={floor.name+'可编辑户型图'} onPointerDown={onBackground}>
 <defs><pattern id="planGrid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#b9cbd0" strokeWidth="3"/></pattern><pattern id="proposed" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V90" stroke="#b8763d" strokeWidth="12" opacity=".3"/></pattern></defs>
 <rect x="-100000" y="-100000" width="200000" height="200000" fill={grid?'url(#planGrid)':'#f3f6f7'}/>
 <polygon points={floor.outline.map(p=>p.join(',')).join(' ')} fill="#fffef9" stroke="#c7cfc7" strokeWidth="10"/>
 {original&&<polygon points={floor.originalOutline.map(p=>p.join(',')).join(' ')} fill="none" stroke="#bc8861" strokeDasharray="90 55" strokeWidth="16"/>}
 {floor.rooms.map(r=><g key={r.id} className="room-zone" pointerEvents="none"><rect x={r.x} y={r.y} width={r.w} height={r.h} fill={floor.id==='f2'?'#dfe8eb':'transparent'} fillOpacity=".28"/>{labels&&(floor.id==='f2'||['wc','entry','balcony'].includes(r.id))&&<text x={r.x+r.w/2} y={r.y+r.h/2} textAnchor="middle" className="room-label">{r.name}</text>}</g>)}
 {floor.pieces.map(item=><g key={item.id} data-piece={item.id} onPointerDown={e=>{e.stopPropagation();onDown?.(e,item);}} className={'piece '+(item.type==='wall'?'wall-piece':'')}>
 {(original||item.visible===false)&&item.original&&changedPiece(item)&&<PieceDrawing p={{...item,...item.original,rotation:0}} ghost/>}
 {item.visible!==false?<PieceDrawing p={item} selected={selected===item.id} labels={labels}/>:item.original&&<g className="removed-wall"><rect x={item.original.x} y={item.original.y} width={item.original.w} height={item.original.h} fill="url(#proposed)" stroke="#bd7046" strokeDasharray="35 30" strokeWidth="9"/></g>}
 </g>)}
 {p&&onResize&&<g transform={`translate(${p.x} ${p.y}) rotate(${p.rotation} ${p.w/2} ${p.h/2})`}><rect x={p.w-70} y={p.h-70} width="140" height="140" rx="18" fill="#fff" stroke="#267c9d" strokeWidth="23" className="resize-handle" data-resize="true" onPointerDown={e=>{e.stopPropagation();onResize(e,p);}}/></g>}
 {boundary&&floor.outline.map((q,i)=><g key={i}><circle cx={q[0]} cy={q[1]} r="82" fill="#fff" stroke="#287c99" strokeWidth="22" data-vertex={i} className="vertex" onPointerDown={e=>{e.stopPropagation();onVertex?.(e,i);}}/><text x={q[0]+105} y={q[1]-110} className="vertex-label">{i+1}</text></g>)}
 {measure&&measure.length===2&&<g pointerEvents="none"><path d={`M${measure[0].join(' ')}L${measure[1].join(' ')}`} stroke="#277c99" strokeWidth="18" strokeDasharray="65 30"/><circle cx={measure[0][0]} cy={measure[0][1]} r="42" fill="#277c99"/><circle cx={measure[1][0]} cy={measure[1][1]} r="42" fill="#277c99"/><text x={(measure[0][0]+measure[1][0])/2} y={(measure[0][1]+measure[1][1])/2-130} textAnchor="middle" className="measure-label">{Math.round(Math.hypot(measure[1][0]-measure[0][0],measure[1][1]-measure[0][1]))} mm</text></g>}
 {previewWall&&<PieceDrawing p={previewWall} selected labels={false}/>}
 </svg>
}
