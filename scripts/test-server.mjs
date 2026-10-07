import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,readdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,resolve,extname,basename,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPrivateServer} from '../server/index.mjs';
import {loadProjectModel} from '../server/model-loader.mjs';
import {automaticBackupService} from '../server/automatic-backups.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),dir=mkdtempSync(join(tmpdir(),'xian-private-test-'));
let app;
try{
 const dataDir=join(dir,'private'),distDir=join(dir,'dist');mkdirSync(dataDir);mkdirSync(distDir);writeFileSync(join(distDir,'index.html'),'<!doctype html><title>Private viewer shell</title><main>请输入口令</main>');
 const model=await loadProjectModel(dataDir),seed=JSON.parse(readFileSync(join(root,'data/seed.json'),'utf8'));
 const project=model.normalizeProject(seed);writeFileSync(join(dataDir,'initial-project.json'),JSON.stringify(project));
 app=await createPrivateServer({dataDir,distDir,model,port:0,secure:false,basePath:'/xian-home'});const address=await app.listen(),origin=`http://127.0.0.1:${address.port}`;let prefix=origin+'/xian-home/api';
 const credentials=JSON.parse(readFileSync(join(dataDir,'owner-credentials.txt'),'utf8'));
 assert.equal(statSync(join(dataDir,'owner-credentials.txt')).mode&0o777,0o600);
 assert.equal(statSync(dataDir).mode&0o777,0o700);
 const request=async(path,options={},cookie)=>{const headers={...(options.body&&typeof options.body==='object'&&!Buffer.isBuffer(options.body)?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...options.headers};const body=options.body&&typeof options.body==='object'&&!Buffer.isBuffer(options.body)?JSON.stringify(options.body):options.body;const response=await fetch(prefix+path,{...options,headers,body});const type=response.headers.get('content-type')||'';return {status:response.status,headers:response.headers,body:type.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer())};};
 const login=async(password,shareId)=>{const result=await request('/session',{method:'POST',body:{password,...(shareId?{shareId}:{})}});assert.equal(result.status,200);const set=result.headers.get('set-cookie');assert.match(set,/HttpOnly/);assert.match(set,/SameSite=Strict/);return set.split(';')[0];};
 assert.deepEqual((await request('/health')).body,{ok:true,version:1});assert.equal((await request('/session')).body.role,null);
 for(const path of ['/project','/backup','/assets/test'])assert.equal((await request(path)).status,401);
 assert.equal((await request('/session',{method:'POST',body:{password:'wrong'}})).status,401);
 let owner=await login(credentials.password);let current=(await request('/project',{},owner)).body;assert.equal(current.role,'owner');assert.equal(current.revision,0);
 const next=structuredClone(current.project);next.name='Server test project';
 assert.equal((await request('/project',{method:'PUT',body:{project:next,baseRevision:4,operationId:'stale'}},owner)).status,409);
 const put={project:next,baseRevision:0,operationId:'put-1'};let saved=await request('/project',{method:'PUT',body:put},owner);assert.equal(saved.status,200);assert.equal(saved.body.revision,1);
 const repeat=await request('/project',{method:'PUT',body:put},owner);assert.equal(repeat.body.revision,1);assert.equal(repeat.body.replayed,true);
 const different={...put,project:{...next,name:'different'}};assert.equal((await request('/project',{method:'PUT',body:different},owner)).status,409);
 const variant=next.variants[0],floor=variant.state.floors[0],piece=floor.pieces.find(p=>p.type==='furniture');assert.ok(piece);
 const operation={operationId:'operation-1',baseRevision:1,operation:{type:'patchPiece',variantId:variant.id,floorId:floor.id,objectId:piece.id,patch:{x:piece.x+30}}};saved=await request('/operations',{method:'POST',body:operation},owner);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.revision,2);assert.equal((await request('/operations',{method:'POST',body:operation},owner)).body.replayed,true);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X4UYAAAAASUVORK5CYII=','base64');
 const meta={kind:'reference',space:'客厅',floorId:'f1',scope:'candidate',note:'Reference for test'};
 const upload=async(name= 'reference.png',body=png,contentType='image/png')=>request('/assets',{method:'POST',body,headers:{'Content-Type':contentType,'x-file-name':encodeURIComponent(name),'x-asset-meta':encodeURIComponent(JSON.stringify(meta))}},owner);
 const first=await upload();assert.equal(first.status,201,JSON.stringify(first.body));assert.equal(first.body.revision,3);const asset1=first.body.asset.id;
 const file=await request('/assets/'+asset1,{},owner);assert.equal(file.status,200);assert.ok(file.body.equals(png));const preview=await request('/assets/'+asset1+'/thumbnail',{},owner);assert.equal(preview.status,200);if(process.platform==='darwin'){assert.equal(preview.headers.get('content-type'),'image/jpeg');assert.equal(preview.headers.get('x-preview-fallback'),null);}
 const snapshot=await request('/snapshots',{method:'POST',body:{label:'Design snapshot',baseRevision:3}},owner);assert.equal(snapshot.status,201);assert.ok(snapshot.body.password);assert.equal(snapshot.body.revision,3);
 const list=await request('/snapshots',{},owner);assert.equal(list.body.items.length,1);assert.ok(!JSON.stringify(list.body).includes(snapshot.body.password));
 const viewer=await login(snapshot.body.password,snapshot.body.id);const view=(await request('/project',{},viewer)).body;assert.equal(view.role,'viewer');assert.equal(view.project.name,'Server test project');
 assert.equal((await request('/assets/'+asset1,{},viewer)).status,200);
 for(const [path,method,body] of [['/project','PUT',put],['/operations','POST',operation],['/snapshots','POST',{label:'bad',baseRevision:3}],['/restore','POST',{}],['/assets','POST',{}]])assert.equal((await request(path,{method,body},viewer)).status,403);
 for(const path of ['/backup','/snapshots'])assert.equal((await request(path,{},viewer)).status,403);
 current=(await request('/project',{},owner)).body;const changed=structuredClone(current.project);changed.name='Changed after snapshot';saved=await request('/project',{method:'PUT',body:{project:changed,baseRevision:3,operationId:'put-2'}},owner);assert.equal(saved.body.revision,4);
 const second=await upload('newer.png');assert.equal(second.status,201);assert.equal(second.body.revision,5);const asset2=second.body.asset.id;
 assert.equal((await request('/assets/'+asset2,{},viewer)).status,404);const frozen=(await request('/project',{},viewer)).body;assert.equal(frozen.revision,3);assert.equal(frozen.project.assets.length,1);assert.equal(frozen.project.name,'Server test project');
 assert.equal((await request('/project',{method:'PUT',body:put,headers:{Origin:'https://evil.invalid'}},owner)).status,403);
 assert.equal((await request('/session',{method:'POST',body:{password:credentials.password},headers:{Origin:'https://evil.invalid'}})).status,403);
 assert.equal((await upload('spoof.png',Buffer.from('%PDF-1.7\n'),'image/png')).status,415);assert.equal((await upload('../unsafe.png')).status,400);
 assert.equal((await request('/assets',{method:'POST',body:png,headers:{'Content-Type':'image/png','x-file-name':'ok.png','x-asset-meta':encodeURIComponent('{"__proto__":{"polluted":true}}')}},owner)).status,400);
 const backup=(await request('/backup',{},owner)).body;assert.equal(backup.files.length,2);assert.equal(backup.snapshots.length,1);assert.equal(backup.snapshots[0].id,snapshot.body.id);assert.equal(backup.format,'xian-home-backup');assert.ok(!JSON.stringify(backup).includes(credentials.password));
 current=(await request('/project',{},owner)).body;const cleared=structuredClone(current.project);cleared.assets=[];saved=await request('/project',{method:'PUT',body:{project:cleared,baseRevision:5,operationId:'clear-assets'}},owner);assert.equal(saved.body.revision,6);assert.equal((await request('/assets/'+asset1,{},viewer)).status,200);const historical=(await request('/backup',{},owner)).body;assert.equal(historical.project.assets.length,0);assert.equal(historical.files.length,1);assert.equal(historical.files[0].id,asset1);
 const restoreBody={backup,baseRevision:6,operationId:'restore-1'};saved=await request('/restore',{method:'POST',body:restoreBody},owner);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.revision,7);assert.equal(saved.body.project.assets.length,2);assert.ok(readdirSync(join(dataDir,'backups')).length>0);
 assert.equal((await request('/restore',{method:'POST',body:restoreBody},owner)).body.replayed,true);
 const mutatedSnapshot=structuredClone(backup);mutatedSnapshot.snapshots[0].project.name='Tampered';assert.equal((await request('/restore',{method:'POST',body:{backup:mutatedSnapshot,baseRevision:7,operationId:'tampered-snapshot'}},owner)).status,409);
 const corrupt=structuredClone(backup);corrupt.files[0].sha256='bad';assert.equal((await request('/restore',{method:'POST',body:{backup:corrupt,baseRevision:7,operationId:'bad-restore'}},owner)).status,400);assert.equal((await request('/project',{},owner)).body.revision,7);
 const removed=structuredClone(backup);removed.files.pop();assert.equal((await request('/restore',{method:'POST',body:{backup:removed,baseRevision:7,operationId:'missing-restore'}},owner)).status,400);
 const recoveredDir=join(dir,'recovered');mkdirSync(recoveredDir);writeFileSync(join(recoveredDir,'initial-project.json'),JSON.stringify(project));const recoveredApp=await createPrivateServer({dataDir:recoveredDir,distDir,model,port:0,secure:false,basePath:'/xian-home'});
 try{const recoveredAddress=await recoveredApp.listen(),target=`http://127.0.0.1:${recoveredAddress.port}/xian-home/api`;const call=async(path,method='GET',body,cookie)=>{const response=await fetch(target+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return response;};
  const admin=await call('/session','POST',{password:JSON.parse(readFileSync(join(recoveredDir,'owner-credentials.txt'),'utf8')).password});const adminCookie=admin.headers.get('set-cookie').split(';')[0];const restored=await call('/restore','POST',{backup,baseRevision:0,operationId:'new-server-restore'},adminCookie);assert.equal(restored.status,200);assert.equal((await restored.json()).restoredSnapshotCount,1);
  const reader=await call('/session','POST',{password:snapshot.body.password,shareId:snapshot.body.id});assert.equal(reader.status,200);const readerCookie=reader.headers.get('set-cookie').split(';')[0];assert.equal((await (await call('/project','GET',undefined,readerCookie)).json()).project.name,'Server test project');assert.equal((await call('/assets/'+asset1,'GET',undefined,readerCookie)).status,200);assert.equal((await call('/assets/'+asset2,'GET',undefined,readerCookie)).status,404);
 }finally{await recoveredApp.close();}
 const retentionDir=join(dir,'backup-retention');mkdirSync(retentionDir);const retention=automaticBackupService({dataDir:retentionDir,fullBackup:()=>backup});
 for(let day=1;day<=10;day++)retention.run({now:new Date(`2030-01-${String(day).padStart(2,'0')}T12:00:00Z`)});assert.equal(retention.items().length,7);assert.equal(retention.items()[0].id,'2030-01-10');assert.equal(retention.run({now:new Date('2030-01-10T12:00:00Z')}).created,false);assert.equal(statSync(retention.file('2030-01-10').path).mode&0o777,0o600);assert.deepEqual(JSON.parse(readFileSync(retention.file('2030-01-10').path,'utf8')).snapshots,backup.snapshots);retention.stop();
 const restarted=automaticBackupService({dataDir:retentionDir,fullBackup:()=>backup});assert.equal(restarted.run({now:new Date('2030-01-10T13:00:00Z')}).created,false);assert.equal(restarted.run({now:new Date('2030-01-11T12:00:00Z')}).created,true);assert.equal(restarted.items().length,7);restarted.stop();
 assert.equal((await request('/backups',{},viewer)).status,403);const daily=await request('/backups',{method:'POST',body:{}},owner);assert.equal(daily.status,201);assert.equal((await request('/backups/'+daily.body.id,{},owner)).body.files.length,2);
 const cliBackup=join(dir,'cli-backup.json');writeFileSync(cliBackup,JSON.stringify(backup));const cli=await promisify(execFile)(process.execPath,[join(root,'server/restore-backup.mjs'),cliBackup],{env:{...process.env,XIAN_DATA_DIR:dataDir,XIAN_PORT:String(address.port),XIAN_BASE_PATH:'/xian-home'},maxBuffer:16384});const cliResult=JSON.parse(cli.stdout);assert.equal(cliResult.restored,true);assert.equal(cliResult.restoredSnapshotCount,1);assert.ok(!cli.stdout.includes(credentials.password));
 symlinkSync(join(dataDir,'owner-credentials.txt'),join(distDir,'secret.js'));assert.equal((await fetch(origin+'/xian-home/secret.js')).status,404);assert.equal((await fetch(origin+'/xian-home/owner-credentials.txt')).status,404);assert.equal((await fetch(origin+'/xian-home/project.sqlite')).status,404);assert.equal((await fetch(origin+'/xian-home/')).status,200);
 assert.equal((await request('/session',{method:'DELETE'},viewer)).status,200);assert.equal((await request('/project',{},viewer)).status,401);
 if(process.env.XIAN_TEST_REAL_ASSETS_DIR){
  await app.close();app=null;const realDataDir=join(dir,'real-private');mkdirSync(realDataDir);writeFileSync(join(realDataDir,'initial-project.json'),JSON.stringify(project));
  app=await createPrivateServer({dataDir:realDataDir,distDir,model,port:0,secure:false,basePath:'/xian-home'});const realAddress=await app.listen();prefix=`http://127.0.0.1:${realAddress.port}/xian-home/api`;owner=await login(JSON.parse(readFileSync(join(realDataDir,'owner-credentials.txt'),'utf8')).password);
  const fixtureRoot=resolve(process.env.XIAN_TEST_REAL_ASSETS_DIR),allowed={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.heic':'image/heic','.pdf':'application/pdf'};
  const walk=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(directory,entry.name)):allowed[extname(entry.name).toLowerCase()]?[join(directory,entry.name)]:[]);
  const fixtureFiles=[...readdirSync(fixtureRoot).filter(name=>/^[1-6].*\.pdf$/i.test(name)).map(name=>join(fixtureRoot,name)),...walk(join(fixtureRoot,'各个空间参考')),...walk(join(fixtureRoot,'实拍图'))];
  let originalBytes=0,previewBytes=0,previewCount=0,heicPreviews=0;
  for(const path of fixtureFiles){const content=readFileSync(path),mime=content.toString('ascii',4,8)==='ftyp'?'image/heic':allowed[extname(path).toLowerCase()],fixtureMeta={kind:mime==='application/pdf'?'drawing':path.includes('实拍图')?'site':'reference',space:basename(dirname(path)),floorId:'all',scope:'candidate',note:'完整资料备份测试'};originalBytes+=content.length;
   const result=await request('/assets',{method:'POST',body:content,headers:{'Content-Type':mime,'x-file-name':encodeURIComponent(basename(path)),'x-asset-meta':encodeURIComponent(JSON.stringify(fixtureMeta))}},owner);assert.equal(result.status,201,basename(path)+': '+JSON.stringify(result.body));
   if(mime.startsWith('image/')){const preview=await request('/assets/'+result.body.asset.id+'/thumbnail',{},owner);assert.equal(preview.status,200);if(process.platform==='darwin'){assert.equal(preview.headers.get('content-type'),'image/jpeg',basename(path));assert.equal(preview.headers.get('x-preview-fallback'),null,basename(path));}previewBytes+=preview.body.length;previewCount++;if(mime==='image/heic')heicPreviews++;}
  }
  const full=(await request('/backup',{},owner)).body;assert.equal(full.files.length,fixtureFiles.length);const before=(await request('/project',{},owner)).body;
  const restored=await request('/restore',{method:'POST',body:{backup:full,baseRevision:before.revision,operationId:'real-assets-restore'}},owner);assert.equal(restored.status,200,JSON.stringify(restored.body));assert.equal(restored.body.project.assets.length,fixtureFiles.length);assert.equal(restored.body.revision,before.revision+1);
  if(process.env.XIAN_TEST_BACKUP_OUTPUT){const output=resolve(process.env.XIAN_TEST_BACKUP_OUTPUT);mkdirSync(dirname(output),{recursive:true,mode:0o700});writeFileSync(output,JSON.stringify(full),{mode:0o600});}
  console.log(JSON.stringify({realAssetTest:'passed',files:fixtureFiles.length,originalBytes,previewCount,previewBytes,heicPreviews,restoredAssets:restored.body.project.assets.length}));
 }
 let rateLimited=false;for(let i=0;i<22;i++){const result=await request('/session',{method:'POST',body:{password:'incorrect-password'}});if(result.status===429){rateLimited=true;break;}}assert.ok(rateLimited);
 console.log('Private server checks passed: authentication, viewer scope, CAS/idempotency, immutable snapshots, protected attachments, atomic restore, private paths, CSRF, rate limits, daily retention/restart and local restore command.');
}finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
