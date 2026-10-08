import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPrivateServer} from '../server/index.mjs';
import {loadProjectModel} from '../server/model-loader.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dir=mkdtempSync(join(tmpdir(),'xian-public-test-')),dataDir=join(dir,'private'),distDir=join(dir,'dist');
let app,base;
try{
 mkdirSync(dataDir);mkdirSync(distDir);writeFileSync(join(distDir,'index.html'),'<!doctype html><title>Family viewer</title>');
 const model=await loadProjectModel(dataDir),project=model.normalizeProject(JSON.parse(readFileSync(join(root,'data/seed.json'),'utf8')));
 writeFileSync(join(dataDir,'initial-project.json'),JSON.stringify(project));
 const start=async publicView=>{app=await createPrivateServer({dataDir,distDir,model,port:0,secure:false,basePath:'/xian-home',publicView});const address=await app.listen();base=`http://127.0.0.1:${address.port}/xian-home/api`;};
 const request=async(path,options={},cookie)=>{const jsonBody=options.body&&typeof options.body==='object'&&!Buffer.isBuffer(options.body);const response=await fetch(base+path,{...options,headers:{...(jsonBody?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...options.headers},body:jsonBody?JSON.stringify(options.body):options.body});return {status:response.status,headers:response.headers,body:options.method==='HEAD'?null:(response.headers.get('content-type')||'').includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer())};};
 const login=async(password,shareId)=>{const response=await request('/session',{method:'POST',body:{password,...(shareId?{shareId}:{})}});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
 await start(false);
 assert.deepEqual((await request('/session')).body,{role:null});assert.equal((await request('/project')).status,401);
 await app.close();app=null;await start(true);
 const anonymous=await request('/session');assert.deepEqual(anonymous.body,{role:'viewer',publicView:true});assert.equal(anonymous.headers.get('set-cookie'),null);
 assert.deepEqual((await request('/session',{},'xian_home_session=expired')).body,anonymous.body);
 const initial=(await request('/project')).body;assert.equal(initial.role,'viewer');assert.equal(initial.publicView,true);assert.equal(initial.revision,0);assert.equal(initial.shareId,undefined);
 const password=JSON.parse(readFileSync(join(dataDir,'owner-credentials.txt'),'utf8')).password,owner=await login(password);
 assert.equal((await request('/session',{},owner)).body.role,'owner');assert.equal((await request('/project',{},owner)).body.publicView,undefined);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X4UYAAAAASUVORK5CYII=','base64');
 const upload=async name=>request('/assets',{method:'POST',body:png,headers:{'Content-Type':'image/png','x-file-name':encodeURIComponent(name),'x-asset-meta':encodeURIComponent(JSON.stringify({kind:'reference',space:'客厅',floorId:'f1',scope:'candidate',note:'Public access test'}))}},owner);
 const first=await upload('historical.png');assert.equal(first.status,201);const historicalId=first.body.asset.id;
 const snapshot=await request('/snapshots',{method:'POST',body:{label:'Fixed private design',baseRevision:1}},owner);assert.equal(snapshot.status,201);
 const second=await upload('current.png');assert.equal(second.status,201);const currentId=second.body.asset.id;
 const third=await upload('orphan.png');assert.equal(third.status,201);const orphanId=third.body.asset.id;
 const changed=structuredClone(third.body.project);changed.name='Latest family draft';changed.assets=changed.assets.filter(asset=>asset.id===currentId);
 const update=await request('/project',{method:'PUT',body:{project:changed,baseRevision:3,operationId:'publish-latest'}},owner);assert.equal(update.status,200);
 const current=(await request('/project')).body;assert.equal(current.revision,4);assert.equal(current.project.name,'Latest family draft');assert.equal(current.publicView,true);assert.deepEqual(current.project.assets.map(asset=>asset.id),[currentId]);
 for(const method of ['GET','HEAD']){
  for(const suffix of ['', '/thumbnail','/thumb'])assert.equal((await request(`/assets/${currentId}${suffix}`,{method})).status,200);
  for(const id of [historicalId,orphanId,'missing'])for(const suffix of ['', '/thumbnail'])assert.equal((await request(`/assets/${id}${suffix}`,{method})).status,404);
 }
 for(const [path,method,body] of [['/project','PUT',{}],['/operations','POST',{}],['/snapshots','POST',{}],['/assets','POST',{}],['/restore','POST',{}],['/backups','POST',{}]])assert.equal((await request(path,{method,body})).status,401,path);
 for(const path of ['/backup','/backups','/backups/2030-01-01','/snapshots'])assert.equal((await request(path)).status,401,path);
 for(const share of [snapshot.body.id,'not-a-real-share','', '%2F']){
  assert.deepEqual((await request('/session?share='+share)).body,{role:null});
  assert.equal((await request('/project?share='+share)).status,401);
  assert.equal((await request(`/assets/${currentId}?share=${share}`)).status,401);
 }
 const viewer=await login(snapshot.body.password,snapshot.body.id),shareQuery='?share='+snapshot.body.id;
 for(const query of ['',shareQuery]){
  const fixed=(await request('/project'+query,{},viewer)).body;assert.equal(fixed.role,'viewer');assert.equal(fixed.revision,1);assert.equal(fixed.shareId,snapshot.body.id);assert.equal(fixed.publicView,false);assert.notEqual(fixed.project.name,current.project.name);
  assert.equal((await request('/assets/'+historicalId+query,{},viewer)).status,200);assert.equal((await request('/assets/'+currentId+query,{},viewer)).status,404);
 }
 assert.deepEqual((await request('/session?share=wrong-share',{},viewer)).body,{role:null});assert.equal((await request('/project?share=wrong-share',{},viewer)).status,401);
 const ownerShare=(await request('/project'+shareQuery,{},owner)).body;assert.equal(ownerShare.role,'viewer');assert.equal(ownerShare.revision,1);assert.equal(ownerShare.shareId,snapshot.body.id);assert.equal(ownerShare.publicView,false);assert.equal((await request('/session'+shareQuery,{},owner)).body.publicView,false);
 for(const [path,method,body] of [['/project','PUT',{}],['/operations','POST',{}],['/snapshots','POST',{}],['/assets','POST',{}],['/restore','POST',{}],['/backups','POST',{}]])assert.equal((await request(path+shareQuery,{method,body},owner)).status,403,path);
 for(const path of ['/backup','/backups','/snapshots'])assert.equal((await request(path+shareQuery,{},owner)).status,403,path);
 assert.equal((await request('/assets/'+currentId+shareQuery,{},owner)).status,404);assert.equal((await request('/assets/'+historicalId,{},owner)).status,200);
 assert.equal((await request('/project',{method:'PUT',body:{}},viewer)).status,403);
 assert.equal((await request('/session',{method:'DELETE'},viewer)).status,200);
 assert.equal((await request('/project'+shareQuery,{},viewer)).status,401);assert.equal((await request('/project',{},viewer)).body.publicView,true);
 await app.close();app=null;await start(false);
 assert.equal((await request('/project')).status,401);assert.equal((await request('/assets/'+currentId)).status,401);assert.equal((await request('/project',{},owner)).body.role,'owner');
 console.log('Public family server checks passed: opt-in current read-only view, live revision, no-cookie access, protected writes and backups, current asset whitelist, historical/orphan isolation, explicit-share isolation, owner access, logout and flag-off rollback.');
}finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
