import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
export const runtime=env as unknown as {DB?:D1Database;BUCKET?:R2Bucket;OPENAI_API_KEY?:string;OPENAI_IMAGE_MODEL?:string};
export async function owner(){const user=await getChatGPTUser();if(!user)throw new Error('AUTH_REQUIRED');return user.userId;}
export function db(){if(!runtime.DB)throw new Error('STORAGE_UNAVAILABLE');return runtime.DB;}
export function bucket(){if(!runtime.BUCKET)throw new Error('STORAGE_UNAVAILABLE');return runtime.BUCKET;}
export function errorResponse(e:unknown){const msg=e instanceof Error?e.message:'请求失败';console.error('home-studio:',msg);return Response.json({error:msg==='AUTH_REQUIRED'?'请先登录后再保存。':msg==='STORAGE_UNAVAILABLE'?'保存服务暂时不可用，当前编辑仍保留在页面中。':'操作暂未完成，请重试。'},{status:msg==='AUTH_REQUIRED'?401:503});}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('ORIGIN_REJECTED');}
