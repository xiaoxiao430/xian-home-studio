import {readFileSync,writeFileSync,existsSync,unlinkSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';

const filename=process.argv[2];
if(!filename){console.error('Usage: node server/restore-backup.mjs /absolute/path/to/backup.json [operation-id]');process.exitCode=2;}
else{
 let cookie,prefix;
 try{
  const dataDir=resolve(process.env.XIAN_DATA_DIR||join(homedir(),'Library/Application Support/XianHomeStudio'));
  const credentials=JSON.parse(readFileSync(join(dataDir,'owner-credentials.txt'),'utf8'));
  prefix=`http://127.0.0.1:${Number(process.env.XIAN_PORT||18892)}${process.env.XIAN_BASE_PATH||'/xian-home'}/api`;
  const login=await fetch(prefix+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:credentials.password})});
  if(!login.ok)throw Error('管理登录失败。');cookie=login.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('管理会话未建立。');
  const state=await fetch(prefix+'/project',{headers:{Cookie:cookie}});if(!state.ok)throw Error('当前版本读取失败。');const current=await state.json();
  const raw=readFileSync(resolve(filename)),checksum=createHash('sha256').update(raw).digest('hex'),backup=JSON.parse(raw.toString('utf8')),pendingPath=join(dataDir,'.restore-attempt.json');
  let attempt;if(existsSync(pendingPath)){try{attempt=JSON.parse(readFileSync(pendingPath,'utf8'));}catch{}}
  if(attempt&&(attempt.checksum!==checksum||process.argv[3]&&attempt.operationId!==process.argv[3]))throw Error('仍有另一份恢复请求等待确认；请先核对 .restore-attempt.json 与当前项目。');
  if(!attempt){attempt={checksum,operationId:process.argv[3]||randomUUID(),baseRevision:current.revision,backupPath:resolve(filename),createdAt:new Date().toISOString()};writeFileSync(pendingPath,JSON.stringify(attempt),{mode:0o600});chmodSync(pendingPath,0o600);}
  const result=await fetch(prefix+'/restore',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({backup,baseRevision:attempt.baseRevision,operationId:attempt.operationId})});const body=await result.json();
  if(!result.ok){if(result.status>=400&&result.status<500)unlinkSync(pendingPath);throw Error(body.error||'恢复失败。');}
  unlinkSync(pendingPath);console.log(JSON.stringify({restored:true,revision:body.revision,restoredSnapshotCount:body.restoredSnapshotCount,replayed:!!body.replayed,operationId:attempt.operationId}));
 }catch(error){console.error('Restore failed:',error.message);process.exitCode=1;}
 finally{if(cookie&&prefix){try{await fetch(prefix+'/session',{method:'DELETE',headers:{Cookie:cookie}});}catch{}}}
}
