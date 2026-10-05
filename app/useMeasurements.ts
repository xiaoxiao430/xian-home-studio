'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Floor} from '../lib/model';
import {anchorPoint,computeScene,dimensionsFor,bbox,pointInMulti,toWorld} from '../lib/geometry';
import type {RouteRequest,RouteResult,RouteInput} from '../lib/routes';
import type {Point} from '../lib/measurement-model';
export function useMeasurements(floor:Floor,selected:string,all:boolean,routeEnabled:boolean,dragging:boolean){
 const scene=useMemo(()=>computeScene(floor),[floor]);const dimensions=useMemo(()=>dimensionsFor(floor,scene,selected,all),[floor,scene,selected,all]);const [routes,setRoutes]=useState<RouteResult[]>([]),[routeStatus,setRouteStatus]=useState(''),worker=useRef<Worker|null>(null),pending=useRef<RouteInput|null>(null),busy=useRef(false),seq=useRef(0),wasDragging=useRef(false);
 useEffect(()=>()=>worker.current?.terminate(),[]);
 useEffect(()=>{
  seq.current++;setRoutes([]);if(!routeEnabled||!scene.valid){worker.current?.terminate();worker.current=null;busy.current=false;setRouteStatus(scene.error||'');return;}
  const requests:RouteRequest[]=[];const stair=floor.pieces.find(p=>p.type==='stair'&&p.visible!==false);let start:Point=floor.id==='f1'?[1450,6050]:stair?[stair.x+stair.w/2,stair.y-550]:[floor.outline[0][0]+800,floor.outline[0][1]+800];
  if(floor.id==='f1'){const entry=floor.pieces.find(p=>p.id==='f1-入户门'&&p.visible!==false);if(entry)start=toWorld(entry,[1050+450*(entry.baseW||entry.w)/entry.w,581]);}
  for(const room of floor.rooms.filter(r=>r.name!=='楼梯'&&r.id!=='entry')){const name='入口 → '+room.name;const override=floor.routes?.find(r=>r.id==='auto:'+room.id);requests.push({id:'auto:'+room.id,name,points:[start,[room.x+room.w/2,room.y+room.h/2]],target:override?.target||900,automatic:true,targetBox:room});}
  if(stair)requests.push({id:'auto:stairs',name:'入口 → 楼梯',points:[start,[stair.x+stair.w/2,stair.y-500]],target:floor.routes?.find(r=>r.id==='auto:stairs')?.target||900,automatic:true});
  for(const r of floor.routes||[])if(!r.automatic){const points=r.points.map(a=>anchorPoint(floor,a));if(points.every(p=>p!==null))requests.push({id:r.id,name:r.name,points:points as Point[],target:r.target});}
  pending.current={requestId:seq.current,floorId:floor.id,free:scene.walking,outline:floor.outline as Point[],requests,resolution:dragging?25:10};setRouteStatus(dragging?'25 mm 拖动预估中':'10 mm 路线复核中');
  if(wasDragging.current&&!dragging){worker.current?.terminate();worker.current=null;busy.current=false;}wasDragging.current=dragging;
  const send=()=>{if(busy.current||!pending.current)return;if(!worker.current){worker.current=new Worker('/route-worker.js',{type:'module'});worker.current.onmessage=e=>{busy.current=false;const r=e.data;if(r.requestId===seq.current){setRoutes(r.results||[]);setRouteStatus(r.error||`${r.resolution} mm 网格${r.coarseOnly?'（范围较大，已降低精度）':' · 路线已更新'}`);}send();};worker.current.onerror=()=>{busy.current=false;setRouteStatus('路线计算暂未完成，请关闭后重试。');worker.current?.terminate();worker.current=null;};}const input=pending.current;pending.current=null;busy.current=true;worker.current.postMessage(input);};send();
 },[floor,scene,routeEnabled,dragging]);
 return {scene,dimensions,routes,routeStatus};
}
