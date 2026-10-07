import React,{useState} from 'react';
import Plan from './Plan';
import {configureLinkedStairs} from '../lib/stairs';
import {measureSpec,computeScene,pieceShapes,intersection,multiArea} from '../lib/geometry';
import type {State,Piece} from '../lib/model';
import type {Variant} from '../lib/project-model';

const length=(n:number)=>Math.round(n).toLocaleString('zh-CN');
export function SuiteSummary({variant}:{variant:Variant}){
 const kind=variant.suiteStudy?.makeup;if(!kind)return <p className="fine-note">保留的基础方案。新主卧研究稿在方案列表中单独保存。</p>;
 const floor=variant.state.floors.find(f=>f.id==='f2')!;
 const wardrobe=floor.pieces.filter(p=>p.visible!==false&&p.cabinet&&/衣帽|衣柜/.test(p.name));
 const cabinetLength=wardrobe.reduce((n,p)=>n+p.w,0),cabinetArea=wardrobe.reduce((n,p)=>n+p.w*p.h/1e6,0);
 const dimensions=(floor.measurements||[]).filter(m=>m.pinned).map(m=>measureSpec(floor,m));
 return <div className="suite-summary"><span className="studio-kicker">{kind==='dry'?'01 / 干区化妆 · 本版设计意图':'02 / 阳台化妆 · 本版设计意图'}</span><h3>{kind==='dry'?'洗漱、护理、更衣更集中':'墙垛化妆与窗边躺卧'}</h3>
 <p>{kind==='dry'?'坐式化妆台接在双台盆旁，有独立腿部空间；需要同时比较洗漱站位、化妆椅后退和衣帽柜容量。':'双台盆侧增加封闭收纳，化妆台位于阳台下端墙垛靠窗的一侧，躺椅放在阳台上端；浅台和紧凑椅需侧向离座，实际后退空间随调整显示。'}</p>
 <div className="suite-metrics"><span><b>{length(cabinetLength)} mm</b>衣帽柜总正面长度</span><span><b>{cabinetArea.toFixed(2)} ㎡</b>衣帽柜平面占地</span></div>
 <p className="fine-note">容量比较按柜长与占地计算，不能等同于实际挂衣数量。七块区域含原0.8㎡全部并入主卧，原图标注共39.2㎡，并非拆改后的实测净面积。公共饮水与储物改设在中部小间。床头、床尾已对调，床头靠图纸下方的对面墙；化妆位仍在原先指定的阳台窗侧墙垛旁。</p>
 {dimensions.length>0&&<details open><summary>固定尺寸 · 随当前布局更新</summary><dl className="suite-dimensions">{dimensions.map(d=><React.Fragment key={d.id}><dt>{d.name}</dt><dd>{d.status==='invalid'?'待修复':d.status==='overlap'?'重叠':d.value===null?'未正对':length(d.value)+' mm'}<small>{d.estimated?'估算轮廓':'方案几何'}{d.note?' · '+d.note:''}</small></dd></React.Fragment>)}</dl></details>}
 <p className="fine-note">共同待确认：原墙结构、湿区排水及防水、浴缸承载与照护操作、设备型号、阳台条件、层高和梁底。图中原墙拟拆只表示设计意图。</p></div>;
}

export function StairFields({piece,onChange,readOnly=false}:{piece:Piece;onChange:(patch:Partial<Piece>)=>void;readOnly?:boolean}){
 const s=piece.stair;if(!s)return <p className="fine-note">原楼梯占地。新主卧研究稿已加入两层关联参数；踏步需要实际复测。</p>;
 const number=(label:string,key:'extensionMm'|'riseMm'|'railHeightMm',min:number,max:number)=><label key={key}>{label}<input type="number" min={min} max={max} step="10" defaultValue={s[key]} key={key+':'+s[key]} onBlur={e=>{const value=Number(e.target.value);if(value>=min&&value<=max)onChange({stair:{...s,[key]:value}});else e.target.value=String(s[key]);}}/></label>;
 return <fieldset className="stair-fields" disabled={readOnly}><legend>同一部楼梯 · 两层关联</legend><label>占地研究<select value={s.footprintMode} onChange={e=>onChange({stair:{...s,footprintMode:e.target.value as 'original'|'expanded'|'custom'}})}><option value="custom" disabled>自由调整占地</option><option value="original">原约1830 × 2250占地</option><option value="expanded">向公共过厅扩展</option></select></label>{number('向过厅扩展 mm','extensionMm',0,1200)}{number('上下层高差 mm（默认示意）','riseMm',1500,6000)}{number('扶手高度 mm（方案）','railHeightMm',600,1500)}<label>复测记录状态<select value={s.surveyStatus} onChange={e=>onChange({stair:{...s,surveyStatus:e.target.value as any}})}><option value="unmeasured">尚未复测</option><option value="partial">资料部分补齐</option><option value="measured">复测资料已补齐，仍待设计</option></select></label><p>这里的梯段与踏步始终是形态示意。填写复测记录不等于施工设计已确认。</p></fieldset>;
}

export function StairStudy({variant,owner,onChange}:{variant:Variant;owner:boolean;onChange:(state:State)=>void}){
 const primary=(f:State['floors'][number])=>f.pieces.find(p=>p.id===f.id+'-stairs'&&p.visible!==false)||f.pieces.find(p=>p.type==='stair'&&p.stair?.sharedId==='main-stair'&&p.visible!==false);
 const stair=primary(variant.state.floors[0]);
 const [extension,setExtension]=useState(stair?.stair?.extensionMm??600);
 if(variant.state.floors.some(f=>!primary(f)))return <section className="studio-scroll"><h2>楼梯关联待恢复</h2><p>当前方案有一层缺少主楼梯，暂不能比较两层占地。请撤销删除或恢复该层的楼梯，再继续研究。</p></section>;
 const choices=(['original','expanded'] as const).map(mode=>({mode,state:configureLinkedStairs(variant.state,{footprintMode:mode,extensionMm:extension})}));
 return <section className="studio-scroll stair-study"><div className="studio-page-title"><div><span className="studio-kicker">同一部楼梯 / 两层一起比较</span><h2>扩大楼梯，占用了哪里？</h2><p>下方只预览占地取舍。点选应用后才修改当前方案，两层同步，其他方案保持独立。</p></div><label>研究扩展量 mm<input aria-label="楼梯研究扩展量" type="number" min="0" max="1200" step="50" value={extension} onChange={e=>{const n=Number(e.target.value);if(n>=0&&n<=1200)setExtension(n);}}/></label></div>
 <div className="compare-grid">{choices.map(({mode,state})=><article key={mode}><h3>{mode==='original'?'原占地研究':'向过厅扩展研究'}</h3>{state.floors.map(f=>{const p=primary(f)!,o=p.stair!.originalFootprint,scene=computeScene(f),stairRings=pieceShapes(p).filter(s=>s.kind==='stair').map(s=>[s.ring]);
 const collisions=Array.from(new Set(scene.shapes.filter(s=>s.kind==='wall'&&multiArea(intersection(stairRings,[[s.ring]]))>1).map(s=>s.name)));
 const measure=f.measurements?.find(m=>m.id===(f.id==='f2'?'f2-suite-stair-hall-clearance':'chair-stairs')),gap=measure?measureSpec(f,measure,scene):null;return <div key={f.id} className="stair-floor-preview"><h4>{f.name} · {length(p.w)} × {length(p.h)} mm</h4><Plan floor={f} selected={p.id} view={[o.x-1700,o.y-1900,o.w+4300,o.h+2700]} original labels={false} grid={false}/><p>{mode==='expanded'?`新增占地 ${(p.w*p.h/1e6-o.w*o.h/1e6).toFixed(2)}㎡ · 向过厅 ${length(extension)} mm`:'沿用该层原图坐标与占地'}</p>{gap&&<p className="stair-gap">{f.id==='f2'?'过厅分隔前缘 → 楼梯':'餐椅使用外沿 → 楼梯'}：<b>{gap.value===null?'未正对，需另看路线':gap.status==='overlap'?'重叠':length(gap.value)+' mm'}</b><br/><small>直接边缘尺寸，不等同于连续通道宽度。{gap.note}</small></p>}{collisions.length>0&&<p className="error-text">与现有墙段重叠：{collisions.join('、')}。须连同原墙和楼板洞口研究。</p>}</div>;})}<p className="fine-note">{mode==='expanded'?'扩展会侵入过厅，需同时检查中部饮水储物间的出入，也会减少一楼楼梯前空间。现有墙柱与梁不会自动消失，重叠提示需要设计师处理。':'紧凑占地可能限制踏步、平台和净高，不能仅凭本示意确认能做成图中的U形。'}</p>{owner&&<button className="primary" onClick={()=>onChange(state)}>应用{mode==='original'?'原占地':'扩展'}到当前方案两层</button>}</article>)}</div>
 <p className="stair-caution">需复测：实际层高、楼板洞口、梁底净高、梯段平台、扶手和上下层入口。两种研究都未获得结构及施工确认；示意开口不是实际楼板洞口。</p></section>;
}
