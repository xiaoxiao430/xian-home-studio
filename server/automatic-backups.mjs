import {mkdirSync,chmodSync,existsSync,writeFileSync,renameSync,readdirSync,statSync,unlinkSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomId,fail} from './security.mjs';
const DATE=/^\d{4}-\d{2}-\d{2}$/;
export function automaticBackupService(store){
 const directory=join(store.dataDir,'automatic-backups');mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
 let interval,initial,deferred,stopped=false,busy=false,lastError='';
 const day=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 function items(){return readdirSync(directory).filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse().map(name=>{const stat=statSync(join(directory,name));return {id:name.slice(0,-5),createdAt:stat.mtime.toISOString(),bytes:stat.size};});}
 function file(id){if(!DATE.test(id))throw fail(404,'备份不存在。');const path=join(directory,id+'.json');if(!existsSync(path))throw fail(404,'备份不存在。');return {path,size:statSync(path).size};}
 function run({force=false,now=new Date()}={}){
  if(stopped||busy)return {created:false};const id=day(now),target=join(directory,id+'.json');if(!force&&existsSync(target))return {created:false,id};
  busy=true;const temporary=join(directory,'.'+id+'-'+randomId()+'.tmp');
  try{const backup=store.fullBackup();writeFileSync(temporary,JSON.stringify(backup),{mode:0o600});chmodSync(temporary,0o600);renameSync(temporary,target);for(const item of items().slice(7))unlinkSync(join(directory,item.id+'.json'));lastError='';return {created:true,id,bytes:statSync(target).size};}
  catch(error){try{unlinkSync(temporary);}catch{}lastError='自动备份未完成，请检查磁盘空间并下载备份。';throw error;}finally{busy=false;}
 }
 function safely(force=false){try{return run({force});}catch{return {created:false,error:lastError};}}
 return {
  run,file,items,
  status(){const list=items();return {lastSuccessfulAt:list[0]?.createdAt||null,error:lastError||null,count:list.length};},
  start(){stopped=false;initial=setTimeout(()=>safely(),2000);initial.unref();interval=setInterval(()=>safely(),60*60*1000);interval.unref();},
  afterRestore(){clearTimeout(deferred);deferred=setTimeout(()=>safely(true),1500);deferred.unref();},
  stop(){stopped=true;clearTimeout(initial);clearTimeout(deferred);clearInterval(interval);}
 };
}
