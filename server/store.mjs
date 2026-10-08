import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,chmodSync,existsSync,renameSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomId,digest,passwordHash,fail,validId,validateJsonTree,sniffMime,plain,safeName} from './security.mjs';

export async function openStore({dataDir,seedPath,ownerPassword,model,basePath,maxProjectBytes=340*1024*1024,maxRestoreBytes=480*1024*1024}){
 mkdirSync(dataDir,{recursive:true,mode:0o700});chmodSync(dataDir,0o700);
 const filesDir=join(dataDir,'assets'),backupsDir=join(dataDir,'backups');
 for(const path of [filesDir,backupsDir]){mkdirSync(path,{recursive:true,mode:0o700});chmodSync(path,0o700);}
 const dbPath=join(dataDir,'project.sqlite');const db=new DatabaseSync(dbPath);chmodSync(dbPath,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS project(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL,revision INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,mime TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,name TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,role TEXT NOT NULL,share_id TEXT,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,label TEXT NOT NULL,json TEXT NOT NULL,revision INTEGER NOT NULL,asset_ids TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,response TEXT NOT NULL,created_at TEXT NOT NULL);`);
 let storedOwner=db.prepare("SELECT value FROM settings WHERE key='owner_password'").get();
 if(!storedOwner){
  const credentialsPath=join(dataDir,'owner-credentials.txt');let password=ownerPassword;
  if(!password&&existsSync(credentialsPath)){try{password=JSON.parse(readFileSync(credentialsPath,'utf8')).password;}catch{}}
  if(!password)password=randomId();
  if(typeof password!=='string'||password.length<12||password.length>500)throw Error('初始管理口令须为 12 至 500 个字符。');
  writeFileSync(credentialsPath,JSON.stringify({username:'owner',password,createdAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});chmodSync(credentialsPath,0o600);
  const hash=await passwordHash(password);db.prepare("INSERT INTO settings(key,value) VALUES('owner_password',?)").run(hash);storedOwner={value:hash};
 }
 if(!db.prepare('SELECT id FROM project WHERE id=1').get()){
  if(!seedPath||!existsSync(seedPath))throw Error('首次启动需要私有初始方案文件；请设置 XIAN_SEED_PATH 或在数据目录放置 initial-project.json。');
  const raw=JSON.parse(readFileSync(seedPath,'utf8'));validateJsonTree(raw);
  const project=model.normalizeProject?model.normalizeProject(raw):raw;
  if(!model.validateProject(project))throw Error('初始方案未通过项目模型校验。');
  if(project.assets?.length)throw Error('首次方案包含附件记录，请使用完整备份恢复来导入附件。');
  db.prepare('INSERT INTO project(id,json,revision) VALUES(1,?,0)').run(JSON.stringify(project));
 }
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 function current(){const row=db.prepare('SELECT json,revision FROM project WHERE id=1').get();return {project:JSON.parse(row.json),revision:row.revision};}
 function checkProject(project){validateJsonTree(project);if(!model.validateProject(project))throw fail(400,'项目格式或布局数据无效。');for(const asset of project.assets||[]){if(!validId(asset.id))throw fail(400,'附件编号无效。');const file=db.prepare('SELECT mime,size,sha256 FROM files WHERE id=?').get(asset.id);if(!file)throw fail(400,'项目引用了未上传的附件。',{assetId:asset.id});if(asset.mime!==undefined&&asset.mime!==file.mime)throw fail(400,'附件类型与已保存文件不一致。');}return project;}
 function checkBackupCapacity(project){
  const rows=db.prepare('SELECT json,asset_ids FROM snapshots').all(),ids=new Set(project.assets.map(a=>a.id));let metadata=Buffer.byteLength(JSON.stringify(project))+65536;
  for(const row of rows){metadata+=Buffer.byteLength(row.json)+4096;for(const id of JSON.parse(row.asset_ids))ids.add(id);}
  let originals=0,encoded=0;for(const id of ids){const row=db.prepare('SELECT size FROM files WHERE id=?').get(id);if(!row)throw fail(400,'方案引用了不存在的附件。');originals+=row.size;encoded+=Math.ceil(row.size/3)*4+2048;}
  if(originals>maxProjectBytes||metadata+encoded>Math.min(maxRestoreBytes,480*1024*1024))throw fail(413,'当前项目与固定版本超出完整备份容量；请先整理或另存项目。');
 }
 function expected(revision){if(!Number.isInteger(revision)||revision<0)throw fail(400,'缺少有效的 baseRevision。');const now=current();if(now.revision!==revision)throw fail(409,'方案已被另一窗口更新，请重新读取后再修改。',{revision:now.revision});return now;}
 function write(project,revision){checkBackupCapacity(project);db.prepare('UPDATE project SET json=?,revision=? WHERE id=1').run(JSON.stringify(project),revision);return {project,revision,role:'owner'};}
 function once(operationId,payload,action){if(!validId(operationId))throw fail(400,'缺少有效的 operationId。');const requestHash=digest(JSON.stringify(payload));return transaction(()=>{const previous=db.prepare('SELECT request_hash,response FROM operations WHERE id=?').get(operationId);if(previous){if(previous.request_hash!==requestHash)throw fail(409,'该 operationId 已用于不同请求。');return {...JSON.parse(previous.response),replayed:true};}const result=action();db.prepare('INSERT INTO operations(id,request_hash,response,created_at) VALUES(?,?,?,?)').run(operationId,requestHash,JSON.stringify(result),new Date().toISOString());return result;});}
 function fullBackup(){const now=current();const snapshots=db.prepare('SELECT * FROM snapshots ORDER BY created_at,id').all().map(row=>({id:row.id,label:row.label,project:JSON.parse(row.json),revision:row.revision,assetIds:JSON.parse(row.asset_ids),passwordHash:row.password_hash,createdAt:row.created_at}));const ids=new Set(now.project.assets.map(a=>a.id));for(const snapshot of snapshots)for(const id of snapshot.assetIds)ids.add(id);const files=[...ids].map(id=>{const row=db.prepare('SELECT * FROM files WHERE id=?').get(id);if(!row)throw fail(500,'备份附件记录缺失。');const bytes=readFileSync(join(filesDir,row.id));if(digest(bytes)!==row.sha256)throw fail(500,'附件完整性检查失败。');return {id:row.id,name:row.name,mime:row.mime,size:row.size,sha256:row.sha256,data:bytes.toString('base64')};});return {format:'xian-home-backup',version:1,exportedAt:new Date().toISOString(),revision:now.revision,project:now.project,snapshots,files};}
 function readSession(token){if(!token||token.length>300)return null;const row=db.prepare('SELECT role,share_id,expires_at FROM sessions WHERE token_hash=?').get(digest(token));if(!row||row.expires_at<Date.now())return null;if(row.role==='viewer'&&!db.prepare('SELECT id FROM snapshots WHERE id=?').get(row.share_id))return null;return {role:row.role,shareId:row.share_id||undefined,...(row.role==='viewer'?{publicView:false}:{})};}
 function snapshot(id){if(!validId(id))return null;return db.prepare('SELECT * FROM snapshots WHERE id=?').get(id)||null;}
 function projectFor(session){if(session.role==='owner')return {...current(),role:'owner'};if(session.publicView===true)return {...current(),role:'viewer',publicView:true};const row=snapshot(session.shareId);if(!row)throw fail(401,'查看会话已失效。');return {project:JSON.parse(row.json),revision:row.revision,role:'viewer',shareId:row.id,label:row.label,publicView:false};}
 function canReadAsset(session,id){if(!validId(id))return false;if(session.role==='owner')return !!db.prepare('SELECT id FROM files WHERE id=?').get(id);if(session.publicView===true)return current().project.assets.some(asset=>asset.id===id);const row=snapshot(session.shareId);return !!row&&JSON.parse(row.asset_ids).includes(id);}
 function assetFile(session,id){if(!canReadAsset(session,id))throw fail(404,'附件不存在。');const row=db.prepare('SELECT * FROM files WHERE id=?').get(id);if(!row)throw fail(404,'附件不存在。');return {...row,path:join(filesDir,id)};}
 return {
  db,dataDir,filesDir,model,current,ownerHash:storedOwner.value,readSession,snapshot,projectFor,assetFile,fullBackup,
  createSession(role,shareId){const token=randomId(),hours=role==='owner'?12:24;db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());db.prepare('INSERT INTO sessions(token_hash,role,share_id,expires_at) VALUES(?,?,?,?)').run(digest(token),role,shareId||null,Date.now()+hours*3600000);return {token,maxAge:hours*3600};},
  deleteSession(token){if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));},
  replace(body){return once(body.operationId,{method:'PUT',project:body.project,baseRevision:body.baseRevision},()=>{const now=expected(body.baseRevision);return write(checkProject(body.project),now.revision+1);});},
  operate(body){return once(body.operationId,{method:'OP',operation:body.operation,baseRevision:body.baseRevision},()=>{const now=expected(body.baseRevision);let project;try{project=model.applyOperation(now.project,body.operation);}catch(error){throw fail(400,error.message||'修改操作无效。');}return write(checkProject(project),now.revision+1);});},
  async createSnapshot({label,baseRevision}){if(typeof label!=='string'||!label.trim()||label.length>160)throw fail(400,'快照名称须为 1 至 160 个字符。');const id=randomId(),password=randomId(),hash=await passwordHash(password);const result=transaction(()=>{const now=expected(baseRevision),createdAt=new Date().toISOString();db.prepare('INSERT INTO snapshots(id,label,json,revision,asset_ids,password_hash,created_at) VALUES(?,?,?,?,?,?,?)').run(id,label.trim(),JSON.stringify(now.project),now.revision,JSON.stringify(now.project.assets.map(a=>a.id)),hash,createdAt);checkBackupCapacity(now.project);return {id,label:label.trim(),revision:now.revision,createdAt,url:basePath+'/?share='+id};});return {...result,password};},
  listSnapshots(){return db.prepare('SELECT id,label,revision,created_at AS createdAt FROM snapshots ORDER BY created_at DESC').all().map(row=>({...row,url:basePath+'/?share='+row.id}));},
  addAsset(bytes,declared,name,meta){
   const mime=sniffMime(bytes,declared);safeName(name);validateJsonTree(meta);if(!plain(meta))throw fail(400,'附件说明格式无效。');
   const id=randomId(),createdAt=new Date().toISOString(),sha256=digest(bytes);
   const asset={kind:'reference',space:'整体',floorId:'all',scope:'',note:'',...meta,id,name,mime,size:bytes.length,sha256,createdAt};
   const temp=join(filesDir,'.upload-'+id),target=join(filesDir,id);writeFileSync(temp,bytes,{mode:0o600});renameSync(temp,target);
   try{return transaction(()=>{db.prepare('INSERT INTO files(id,mime,size,sha256,name,created_at) VALUES(?,?,?,?,?,?)').run(id,mime,bytes.length,sha256,name,createdAt);const now=current();const referenced=new Set(now.project.assets.map(a=>a.id));for(const row of db.prepare('SELECT asset_ids FROM snapshots').all())for(const oldId of JSON.parse(row.asset_ids))referenced.add(oldId);const total=[...referenced].reduce((sum,oldId)=>sum+(db.prepare('SELECT size FROM files WHERE id=?').get(oldId)?.size||0),0);if(total+bytes.length>maxProjectBytes)throw fail(413,'项目附件总量超过备份容量限制；请先整理不再使用的附件。');const project=model.applyOperation(now.project,{type:'updateAsset',asset});const result=write(checkProject(project),now.revision+1);return {...result,asset};});}catch(error){try{unlinkSync(target);}catch{}if(!error.status)throw fail(400,error.message||'附件说明未通过校验。');throw error;}
  },
  restore(body){
   const backup=body.backup||body;
   if(!plain(backup)||backup.format!=='xian-home-backup'||backup.version!==1||!Array.isArray(backup.files)||backup.files.length>2000)throw fail(400,'备份格式无效。');
   validateJsonTree(backup.project);if(!model.validateProject(backup.project))throw fail(400,'备份项目无效。');
   const snapshots=backup.snapshots||[];if(!Array.isArray(snapshots)||snapshots.length>1000)throw fail(400,'备份版本清单无效。');
   const snapshotIds=new Set();for(const item of snapshots){
    validateJsonTree(item);if(!plain(item)||!validId(item.id)||snapshotIds.has(item.id)||typeof item.label!=='string'||!item.label.trim()||item.label.length>160||!model.validateProject(item.project)||!Number.isInteger(item.revision)||item.revision<0||typeof item.createdAt!=='string'||item.createdAt.length>50||!Number.isFinite(Date.parse(item.createdAt))||typeof item.passwordHash!=='string'||!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(item.passwordHash)||!Array.isArray(item.assetIds)||item.assetIds.some(id=>!validId(id)))throw fail(400,'备份版本内容无效。');
    snapshotIds.add(item.id);const expectedIds=item.project.assets.map(a=>a.id).sort();if(JSON.stringify([...item.assetIds].sort())!==JSON.stringify(expectedIds))throw fail(400,'备份版本附件清单不一致。');
    const old=snapshot(item.id);if(old&&(old.label!==item.label||old.json!==JSON.stringify(item.project)||old.revision!==item.revision||old.password_hash!==item.passwordHash||old.created_at!==item.createdAt||JSON.stringify(JSON.parse(old.asset_ids).sort())!==JSON.stringify(expectedIds)))throw fail(409,'备份版本编号与已发布版本冲突，不能改变旧链接内容。');
   }
   const supplied=new Map(),prepared=[];let total=0;
   for(const file of backup.files){
    if(!plain(file)||!validId(file.id)||supplied.has(file.id)||typeof file.data!=='string'||file.data.length>Math.ceil(32*1024*1024/3)*4||file.data.length%4!==0||/[^A-Za-z0-9+/=]/.test(file.data))throw fail(400,'备份附件格式无效。');
    safeName(file.name);const bytes=Buffer.from(file.data,'base64');if(bytes.toString('base64')!==file.data)throw fail(400,'备份附件编码无效。');total+=bytes.length;if(bytes.length>32*1024*1024||total>maxProjectBytes)throw fail(413,'备份附件超过大小限制。');
    const mime=sniffMime(bytes,file.mime),sha256=digest(bytes);if(file.sha256!==sha256||file.size!==bytes.length)throw fail(400,'备份附件校验失败。');
    const existing=db.prepare('SELECT sha256 FROM files WHERE id=?').get(file.id);if(existing&&existing.sha256!==sha256)throw fail(409,'备份附件编号与已有快照的文件冲突。');
    supplied.set(file.id,file);prepared.push({file,bytes,mime,sha256,existing:!!existing});
   }
   const ids=[...new Set([...backup.project.assets.map(a=>a.id),...snapshots.flatMap(item=>item.assetIds)])];if(ids.some(id=>!supplied.has(id))||supplied.size!==ids.length)throw fail(400,'备份附件与项目清单不一致。');
   const request={method:'RESTORE',project:backup.project,snapshots,files:backup.files.map(({id,name,mime,size,sha256})=>({id,name,mime,size,sha256})),baseRevision:body.baseRevision};
   return once(body.operationId,request,()=>{
    const now=expected(body.baseRevision);
    const oldBackup=fullBackup(),backupPath=join(backupsDir,Date.now()+'-'+randomId()+'.json');writeFileSync(backupPath,JSON.stringify(oldBackup),{mode:0o600});
    const created=[];
    try{for(const item of prepared){if(item.existing)continue;const temp=join(filesDir,'.restore-'+item.file.id),target=join(filesDir,item.file.id);writeFileSync(temp,item.bytes,{mode:0o600});renameSync(temp,target);created.push(target);db.prepare('INSERT INTO files(id,mime,size,sha256,name,created_at) VALUES(?,?,?,?,?,?)').run(item.file.id,item.mime,item.bytes.length,item.sha256,item.file.name,new Date().toISOString());}
     const retained=new Set(ids);for(const row of db.prepare('SELECT asset_ids FROM snapshots').all())for(const oldId of JSON.parse(row.asset_ids))retained.add(oldId);const retainedBytes=[...retained].reduce((sum,oldId)=>sum+(db.prepare('SELECT size FROM files WHERE id=?').get(oldId)?.size||0),0);if(retainedBytes>maxProjectBytes)throw fail(413,'恢复后的项目与保留版本附件超过备份容量限制。');for(const item of snapshots){checkProject(item.project);db.prepare('INSERT OR IGNORE INTO snapshots(id,label,json,revision,asset_ids,password_hash,created_at) VALUES(?,?,?,?,?,?,?)').run(item.id,item.label,JSON.stringify(item.project),item.revision,JSON.stringify(item.assetIds),item.passwordHash,item.createdAt);}const result=write(checkProject(backup.project),now.revision+1);return {...result,backupSaved:true,restoredSnapshotCount:snapshots.length};
    }catch(error){for(const path of created){try{unlinkSync(path);}catch{}}throw error;}
   });
  },
  close(){db.close();}
 };
}
