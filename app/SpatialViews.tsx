'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {BufferGeometry,Material as ThreeMaterial,Object3D} from 'three';
import type {Floor,Material} from '../lib/model';
import {defaultMaterial} from '../lib/model';
import {bbox} from '../lib/geometry';
import type {Ring} from '../lib/measurement-model';
import {elevationSvgContent,floorHeight,orientationLabels,projection,spatialFloorSlab,spatialVolumes,spatialWarnings,type Orientation} from '../lib/brief-export';
import './spatial.css';

export type SpatialViewsProps={floor:Floor;selected:string;onSelect:(id:string)=>void;mode:'elevation'|'3d'|'section';material?:Material;readOnly?:boolean};
type CameraMemory={position:[number,number,number];target:[number,number,number]};

function GeometryThree({floor,selected,onSelect,material}:{floor:Floor;selected:string;onSelect:(id:string)=>void;material:Material}){
 const container=useRef<HTMLDivElement>(null),cameraMemory=useRef<CameraMemory|null>(null),floorId=useRef(floor.id),selection=useRef(selected),select=useRef(onSelect),[error,setError]=useState(''),[ready,setReady]=useState(false),[hideWalls,setHideWalls]=useState(true),[reset,setReset]=useState(0);
 selection.current=selected;select.current=onSelect;
 useEffect(()=>{
  let disposed=false,cleanup=()=>{};setReady(false);setError('');
  if(floorId.current!==floor.id){cameraMemory.current=null;floorId.current=floor.id;}
  (async()=>{
   const [T,{OrbitControls},{RoundedBoxGeometry}]=await Promise.all([import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/geometries/RoundedBoxGeometry.js')]);
   if(disposed||!container.current)return;
   const host=container.current,scene=new T.Scene();scene.background=new T.Color('#eee8de');
   const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.setSize(host.clientWidth,host.clientHeight);host.appendChild(renderer.domElement);
   const b=bbox(floor.outline as Ring),cx=(b.x+b.w/2)/1000,cz=(b.y+b.h/2)/1000,size=Math.max(b.w,b.h)/1000;
   const camera=new T.PerspectiveCamera(42,Math.max(1,host.clientWidth)/Math.max(1,host.clientHeight),.02,150);
   const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=.6;controls.maxDistance=Math.max(30,size*5);
   if(cameraMemory.current){camera.position.fromArray(cameraMemory.current.position);controls.target.fromArray(cameraMemory.current.target);}else{camera.position.set(cx+size*.85,size*.9,cz+size*.95);controls.target.set(cx,.7,cz);}controls.update();
   scene.add(new T.HemisphereLight('#fff6e6','#8a796a',2.2));const light=new T.DirectionalLight('#fff4e2',2.2);light.position.set(cx-4,12,cz+3);scene.add(light);const fill=new T.DirectionalLight('#eff4fa',.7);fill.position.set(cx+6,6,cz-4);scene.add(fill);
   const selectable:Object3D[]=[],materials:ThreeMaterial[]=[],geometries:BufferGeometry[]=[];
   const addVolume=(polygon:Ring[],bottom:number,top:number,color:string,objectId:string,kind:string,roundedMm=0)=>{
    const shape=new T.Shape();polygon[0].forEach((p,i)=>i?shape.lineTo(p[0]/1000,-p[1]/1000):shape.moveTo(p[0]/1000,-p[1]/1000));shape.closePath();
    for(const ring of polygon.slice(1)){const path=new T.Path();ring.forEach((p,i)=>i?path.lineTo(p[0]/1000,-p[1]/1000):path.moveTo(p[0]/1000,-p[1]/1000));path.closePath();shape.holes.push(path);}
    let geometry:BufferGeometry;
    const ring=polygon[0],a=ring[0],b=ring[1],d=ring[3],isRect=polygon.length===1&&(ring.length===4||ring.length===5)&&d&&Math.abs((b[0]-a[0])*(d[0]-a[0])+(b[1]-a[1])*(d[1]-a[1]))<1;
    if(roundedMm&&isRect){const width=Math.hypot(b[0]-a[0],b[1]-a[1])/1000,depth=Math.hypot(d[0]-a[0],d[1]-a[1])/1000,height=(top-bottom)/1000;geometry=new RoundedBoxGeometry(width,height,depth,4,Math.min(roundedMm/1000,width*.2,depth*.2,height*.4));geometry.rotateY(-Math.atan2(b[1]-a[1],b[0]-a[0]));geometry.translate((b[0]+d[0])/2000,(bottom+top)/2000,(b[1]+d[1])/2000);}
    else{geometry=new T.ExtrudeGeometry(shape,{depth:(top-bottom)/1000,bevelEnabled:false,curveSegments:1});geometry.translate(0,0,bottom/1000);geometry.rotateX(-Math.PI/2);}
    geometries.push(geometry);
    const isWall=kind==='wall'||kind==='overhead',isWindow=kind==='opening',isMirror=kind==='mirror',transparent=isWindow||isWall&&hideWalls;
    const mat=new T.MeshStandardMaterial({color,roughness:isMirror?.18:roundedMm?.96:kind==='floor'?.48:.7,metalness:isMirror?.55:0,transparent,opacity:isWindow?.26:isWall&&hideWalls?.13:1,depthWrite:!transparent,side:T.DoubleSide});materials.push(mat);
    const mesh=new T.Mesh(geometry,mat);mesh.userData={objectId,kind,baseColor:color};scene.add(mesh);if(objectId&&kind!=='zone'&&!(isWall&&hideWalls))selectable.push(mesh);
    if(!roundedMm||objectId===selection.current){const edges=new T.EdgesGeometry(geometry,40),lineMat=new T.LineBasicMaterial({color:objectId===selection.current?'#ba753e':isWall?'#a89c8f':'#85725f',transparent:true,opacity:isWall&&hideWalls?.32:.32});materials.push(lineMat);geometries.push(edges);const line=new T.LineSegments(edges,lineMat);line.userData={objectId,edge:true};scene.add(line);}
    if(objectId===selection.current){mat.emissive.set('#896231');mat.emissiveIntensity=.18;}
   };
   for(const slab of spatialFloorSlab(floor))addVolume(slab,-55,0,material.floor,'','floor');
   for(const v of spatialVolumes(floor,material))addVolume(v.polygon,v.bottom,v.top,v.color,v.objectId,v.kind,v.roundedMm);
   const render=()=>{if(!disposed)renderer.render(scene,camera);};
   const remember=()=>{cameraMemory.current={position:camera.position.toArray(),target:controls.target.toArray()};render();};controls.addEventListener('change',remember);
   const resize=new ResizeObserver(()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);render();});resize.observe(host);
   let down=[0,0];const pointerDown=(event:PointerEvent)=>{down=[event.clientX,event.clientY];};
   const pointerUp=(event:PointerEvent)=>{if(Math.hypot(event.clientX-down[0],event.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(selectable,false)[0];if(hit?.object.userData.objectId)select.current(hit.object.userData.objectId);};
   renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.setAttribute('aria-label','当前楼层的尺寸几何三维；拖动旋转，滚轮缩放，点击选择对象');
   render();setReady(true);
   cleanup=()=>{controls.removeEventListener('change',remember);controls.dispose();resize.disconnect();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);for(const geometry of geometries)geometry.dispose();for(const mat of materials)mat.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  })().catch(e=>{if(!disposed)setError(e instanceof Error?e.message:'三维加载失败');});
  return ()=>{disposed=true;cleanup();};
 },[floor,material,hideWalls,reset,selected]);
 return <div className="spatial-three-wrap"><div className="spatial-three-tools"><label><input type="checkbox" checked={hideWalls} onChange={e=>setHideWalls(e.target.checked)}/> 墙体 / 顶部透视</label><button onClick={()=>{cameraMemory.current=null;setReset(v=>v+1);}}>恢复视角</button><span>拖动旋转 · 滚轮缩放 · 点选对象</span></div><div ref={container} className="spatial-three-canvas" role="img" aria-label="几何三维模型"/>{!ready&&!error&&<div className="spatial-loading">正在建立尺寸三维…</div>}{error&&<div className="spatial-error">三维未能加载：{error}。可继续使用平面、立面与剖面。</div>}<div className="spatial-three-caption">尺寸几何三维 · 楼梯踏步及二层留空为方案示意，楼板洞口与净高待复测 · 材质与软包为风格意向</div></div>;
}

export default function SpatialViews({floor,selected,onSelect,mode,material=defaultMaterial,readOnly=false}:SpatialViewsProps){
 const [orientation,setOrientation]=useState<Orientation>('north'),[focus,setFocus]=useState(false),[cutRatio,setCutRatio]=useState(.5);
 const limits=useMemo(()=>{const depths=floor.outline.map(p=>projection(p as [number,number],orientation)[1]);return {min:Math.min(...depths),max:Math.max(...depths)};},[floor.outline,orientation]);
 const cutline=limits.min+(limits.max-limits.min)*cutRatio;
 const view=useMemo(()=>elevationSvgContent({floor,orientation,selected,material,focus,cutlineMm:mode==='section'?cutline:undefined}),[floor,orientation,selected,material,focus,mode,cutline]);
 const warnings=useMemo(()=>spatialWarnings(floor),[floor]),piece=floor.pieces.find(p=>p.id===selected);
 function chooseObject(target:EventTarget|null){if(target instanceof Element){const object=target.closest('[data-object]')?.getAttribute('data-object');if(object)onSelect(object);}}
 return <section className="spatial-view" aria-label={mode==='3d'?'几何三维':mode==='section'?'尺寸剖面':'尺寸立面'}>
  <header className="spatial-toolbar"><div><strong>{mode==='3d'?'几何三维':mode==='section'?'尺寸剖面':'尺寸立面'}</strong><span>{floor.name} · 层高 {floorHeight(floor)} mm {floor.heightSource==='provisional'||!floor.heightSource?'（暂定）':''}{readOnly?' · 只读查看':''}</span></div>{mode!=='3d'&&<div className="spatial-view-controls"><label>视向<select value={orientation} onChange={e=>setOrientation(e.target.value as Orientation)}>{Object.entries(orientationLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label><input type="checkbox" checked={focus} disabled={!selected} onChange={e=>setFocus(e.target.checked)}/> 聚焦选中对象</label></div>}</header>
  {mode==='section'&&<div className="spatial-cut-controls"><label>剖切位置 <input type="range" min="0.001" max="0.999" step="0.001" value={cutRatio} onChange={e=>setCutRatio(Number(e.target.value))}/></label><span>视向深度坐标 {Math.round(cutline)} mm</span><button disabled={!piece} onClick={()=>{if(piece){const depth=projection([piece.x+piece.w/2,piece.y+piece.h/2],orientation)[1];setCutRatio(Math.max(.001,Math.min(.999,(depth-limits.min)/(limits.max-limits.min))));}}}>穿过选中对象</button></div>}
  {mode==='3d'?<GeometryThree floor={floor} selected={selected} onSelect={onSelect} material={material}/>:<div className="spatial-svg-wrap"><svg viewBox={view.viewBox.join(' ')} role="img" aria-label={mode==='section'?'按当前剖切位置计算的实体截面':'当前楼层投影立面，点击对象同步选择'} onClick={e=>chooseObject(e.target)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseObject(e.target);}}} dangerouslySetInnerHTML={{__html:view.body}}/><p>{mode==='section'?'只画剖切线穿过的真实占地截面；移动切线可查看 L 形转角。':'沿视向叠投，虚线轮廓表示高度暂定；前后重叠不等于实体碰撞。'}</p></div>}
  {warnings.length>0&&<details className="spatial-warnings"><summary>{warnings.length} 项高度与模型待确认</summary><ul>{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
 </section>;
}
export {SpatialViews};
