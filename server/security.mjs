import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export const randomId=()=>randomBytes(24).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64);return salt+':'+key.toString('hex');}
export async function passwordMatches(password,record){try{const [salt,hash]=record.split(':');const expected=Buffer.from(hash,'hex'),actual=await derive(password,salt,64);return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}}
export function fail(status,message,details={}){const error=new Error(message);error.status=status;error.details=details;return error;}
export function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function text(value,max=300){return typeof value==='string'&&value.length<=max;}
export function validId(value){return typeof value==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(value);}
export function validateJsonTree(value,depth=0){
 if(depth>80)throw fail(400,'数据层级过深。');
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value))throw fail(400,'数值无效。');return;}
 if(typeof value==='string'){if(value.length>2000000)throw fail(400,'文本内容过长。');return;}
 if(Array.isArray(value)){if(value.length>100000)throw fail(400,'数组过长。');for(const item of value)validateJsonTree(item,depth+1);return;}
 if(!plain(value))throw fail(400,'数据格式无效。');
 const entries=Object.entries(value);if(entries.length>10000)throw fail(400,'对象字段过多。');
 for(const [key,item] of entries){if(['__proto__','constructor','prototype'].includes(key))throw fail(400,'不支持的对象字段。');validateJsonTree(item,depth+1);}
}
export function sniffMime(buffer,declared){
 const mime=String(declared||'').split(';')[0].trim().toLowerCase();let actual;
 if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))actual='image/png';
 else if(buffer.length>=3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255)actual='image/jpeg';
 else if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')actual='image/webp';
 else if(buffer.length>=5&&buffer.toString('ascii',0,5)==='%PDF-')actual='application/pdf';
 else if(buffer.length>=16&&buffer.toString('ascii',4,8)==='ftyp'&&/heic|heix|hevc|hevx|mif1|msf1/.test(buffer.toString('ascii',8,Math.min(buffer.length,48))))actual='image/heic';
 else if(mime==='application/json'){try{const value=JSON.parse(buffer.toString('utf8'));validateJsonTree(value);actual='application/json';}catch{throw fail(415,'JSON 文件内容无效。');}}
 if(!actual||actual!==mime)throw fail(415,'文件内容与类型不符；仅支持 PNG、JPEG、WebP、PDF、HEIC 和 JSON。');
 return actual;
}
export function safeName(value){if(!text(value,240)||!value.trim()||/[\x00-\x1f\x7f/\\]/.test(value))throw fail(400,'文件名无效。');return value.trim();}
