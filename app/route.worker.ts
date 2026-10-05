import {analyzeRoutes,type RouteInput} from '../lib/routes';
const worker=globalThis as unknown as {onmessage:((e:MessageEvent<RouteInput>)=>void)|null;postMessage:(v:unknown)=>void};
worker.onmessage=e=>{try{worker.postMessage(analyzeRoutes(e.data));}catch{worker.postMessage({requestId:e.data.requestId,floorId:e.data.floorId,error:'路线计算未完成，请检查边界。',results:[]});}};
