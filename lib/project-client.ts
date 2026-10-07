import type {Project} from './project-model';
export const API=import.meta.env.BASE_URL+'api';
export type Envelope={project:Project;revision:number;role:'owner'|'viewer';shareId?:string};
export class ApiError extends Error{status:number;detail:any;constructor(message:string,status:number,detail:any){super(message);this.status=status;this.detail=detail;}}
export async function api(path:string,init:RequestInit={}){const r=await fetch(API+path,{...init,credentials:'same-origin',headers:{...(typeof init.body==='string'?{'Content-Type':'application/json'}:{}),...init.headers}});const text=await r.text();let body:any;try{body=JSON.parse(text);}catch{throw new ApiError('服务返回异常，请重试；本机草稿仍保留。',r.status,{});}if(!r.ok)throw new ApiError(body.error||'请求未完成',r.status,body);return body;}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
export function downloadJson(value:unknown,name:string){downloadBlob(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),name);}
export async function downloadProtected(path:string,name:string){const r=await fetch(API+path);if(!r.ok)throw Error('下载失败，请检查登录及连接');downloadBlob(await r.blob(),name);}
