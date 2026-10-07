import {mkdirSync,existsSync,chmodSync,readFileSync,renameSync,unlinkSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomId} from './security.mjs';
const execute=promisify(execFile);
export function thumbnailService(dataDir){
 const directory=join(dataDir,'thumbnails');mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
 const running=new Map(),waiting=[];let active=0;
 async function slot(){if(active>=2)await new Promise(resolve=>waiting.push(resolve));active++;}
 function release(){active--;waiting.shift()?.();}
 async function create(file){
  const target=join(directory,file.id+'.jpg');
  if(existsSync(target))return {path:target,mime:'image/jpeg',size:statSync(target).size};
  if(!existsSync('/usr/bin/sips'))return {...file,fallback:true};
  await slot();const temporary=join(directory,'.'+file.id+'-'+randomId()+'.jpg');
  try{
   await execute('/usr/bin/sips',['-s','format','jpeg','-s','formatOptions','75','-Z','1200',file.path,'--out',temporary],{timeout:30000,maxBuffer:16384});
   const signature=readFileSync(temporary).subarray(0,3);if(!signature.equals(Buffer.from([255,216,255])))throw Error('Invalid thumbnail');
   chmodSync(temporary,0o600);renameSync(temporary,target);return {path:target,mime:'image/jpeg',size:statSync(target).size};
  }catch{try{unlinkSync(temporary);}catch{}return {...file,fallback:true};}finally{release();}
 }
 return async file=>{if(running.has(file.id))return running.get(file.id);const task=create(file).finally(()=>running.delete(file.id));running.set(file.id,task);return task;};
}
