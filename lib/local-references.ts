import type {Reference} from './model';
type StoredReference=Omit<Reference,'url'>&{blob:Blob};
const STORE='references';
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('xian-home-studio',1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('本机图片存储不可用，请允许浏览器存储。'));});}
async function run<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>){const db=await database();return new Promise<T>((resolve,reject)=>{const tx=db.transaction(STORE,mode),request=operation(tx.objectStore(STORE));let result:T;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(new Error('本机参考图保存失败，请检查浏览器存储空间。'));};});}
const urls=new Map<string,string>();
function view(r:StoredReference):Reference{const previous=urls.get(r.id);if(previous)URL.revokeObjectURL(previous);const url=URL.createObjectURL(r.blob);urls.set(r.id,url);const {blob,...meta}=r;return {...meta,url};}
export async function listLocalReferences(){const rows=await run<StoredReference[]>('readonly',s=>s.getAll());return rows.sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(view);}
export async function addLocalReference(blob:Blob,name:string,floor_id:string,module:string){const row:StoredReference={id:crypto.randomUUID(),name,floor_id,module,note:'',created_at:new Date().toISOString(),blob};await run('readwrite',s=>s.put(row));}
export async function updateLocalReference(id:string,patch:Partial<Reference>){const row=await run<StoredReference|undefined>('readonly',s=>s.get(id));if(!row)throw Error('参考图不存在');await run('readwrite',s=>s.put({...row,note:patch.note??row.note,module:patch.module??row.module,name:patch.name??row.name}));}
export async function deleteLocalReference(id:string){await run('readwrite',s=>s.delete(id));const url=urls.get(id);if(url)URL.revokeObjectURL(url);urls.delete(id);}
