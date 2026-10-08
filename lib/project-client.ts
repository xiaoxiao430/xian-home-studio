import type {Asset,Project} from './project-model';
export const API=import.meta.env.BASE_URL+'api';
export const FAMILY_STATIC=import.meta.env.VITE_FAMILY_STATIC==='true';
export const OWNER_URL=FAMILY_STATIC?'https://jmryqyx.cn/xian-home/?admin=1':import.meta.env.BASE_URL+'?admin=1';
export type Envelope={project:Project;revision:number;role:'owner'|'viewer';shareId?:string;publicView?:boolean;staticSnapshot?:boolean;exportedAt?:string};
export class ApiError extends Error{status:number;detail:any;constructor(message:string,status:number,detail:any){super(message);this.status=status;this.detail=detail;}}
function sharedUrl(path:string){const url=new URL(API+path,location.origin),share=new URLSearchParams(location.search).get('share');if(new URLSearchParams(location.search).has('share'))url.searchParams.set('share',share||'');return url.href;}
export function assetUrl(asset:Asset,thumbnail=false){if(!FAMILY_STATIC)return sharedUrl('/assets/'+encodeURIComponent(asset.id)+(thumbnail?'/thumbnail':''));const path=thumbnail?(asset as Asset&{thumbnailUrl?:string}).thumbnailUrl||asset.url:asset.url;return new URL(path||'family/missing-asset',new URL(import.meta.env.BASE_URL,location.origin)).href;}
export async function api(path:string,init:RequestInit={}){
 const method=(init.method||'GET').toUpperCase();
 if(FAMILY_STATIC){
  if(method!=='GET')throw new ApiError('家人查看版本为只读，请前往管理入口调整。',403,{});
  if(path==='/session')return {role:'viewer',publicView:true,staticSnapshot:true};
  if(path!=='/project')throw new ApiError('发布版不提供此操作。',403,{});
 }
 const r=await fetch(FAMILY_STATIC?import.meta.env.BASE_URL+'family/project.json':sharedUrl(path),{...init,cache:'no-store',credentials:'same-origin',headers:{...(typeof init.body==='string'?{'Content-Type':'application/json'}:{}),...init.headers}});const text=await r.text();let body:any;try{body=JSON.parse(text);}catch{throw new ApiError('服务返回异常，请重试；本机草稿仍保留。',r.status,{});}if(!r.ok)throw new ApiError(body.error||'请求未完成',r.status,body);return body;
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
export function downloadJson(value:unknown,name:string){downloadBlob(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),name);}
export async function downloadProtected(path:string,name:string){if(FAMILY_STATIC)throw new ApiError('家人查看版本不提供管理备份。',403,{});const r=await fetch(sharedUrl(path));if(!r.ok)throw Error('下载失败，请检查登录及连接');downloadBlob(await r.blob(),name);}
