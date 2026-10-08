import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildFamilyExport} from './build-family-export.mjs';
import {loadProjectModel} from '../server/model-loader.mjs';

const directory=await mkdtemp(join(tmpdir(),'xian-family-export-test-'));
const credentialsFile=join(directory,'private-credentials.json'),outputDir=join(directory,'output');
const password='private-owner-value-must-not-be-published';
await writeFile(credentialsFile,JSON.stringify({password}),{mode:0o600});
const model=await loadProjectModel(directory),seed=JSON.parse(await readFile(new URL('../data/seed.json',import.meta.url),'utf8'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const pdf=Buffer.from('%PDF-1.7\n%%EOF\n');
const project=model.createProject(seed);
project.assets=[['image1','image/png',png],['drawing1','application/pdf',pdf]].map(([id,mime,bytes])=>({id,name:id,kind:mime==='application/pdf'?'drawing':'render',space:'整体',floorId:'f1',scope:'test',note:'',mime,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),createdAt:new Date().toISOString()}));
let scenario='good',reads=0,logouts=0,transient=0;
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const send=(status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(typeof body==='string'?body:JSON.stringify(body));};
 if(path==='/xian-home/api/session'&&req.method==='POST'){
  const chunks=[];for await(const c of req)chunks.push(c);assert.equal(JSON.parse(Buffer.concat(chunks)).password,password);
  return send(200,{role:'owner'},{'Set-Cookie':'xian_home_session=test-owner; HttpOnly; Path=/xian-home'});
 }
 if(req.headers.cookie!=='xian_home_session=test-owner')return send(401,{error:'test auth required'});
 if(path==='/xian-home/api/session'&&req.method==='DELETE'){logouts++;return send(200,{ok:true});}
 if(path==='/xian-home/api/project'){
  reads++;const source=structuredClone(project);
  if(scenario==='unsafe')source.assets[0].id='../outside';
  if(scenario==='checksum')source.assets[0].sha256='0'.repeat(64);
  return send(200,{project:source,revision:scenario==='changed'&&reads>1?8:7,role:'owner',snapshots:[{passwordHash:'never-publish'}],ownerPassword:password});
 }
 if(path==='/xian-home/api/assets/image1'&&scenario==='good'&&transient++===0)return send(503,{error:'temporary'});
 if(path.startsWith('/xian-home/api/assets/')){
  const bytes=path.endsWith('drawing1')?pdf:png;
  res.writeHead(200,{'Content-Type':bytes===pdf?'application/pdf':'image/png','Content-Length':bytes.length});return res.end(bytes);
 }
 return send(404,{error:'test route missing'});
});
await new Promise(yes=>server.listen(0,'127.0.0.1',yes));
const sourceUrl=`http://127.0.0.1:${server.address().port}/xian-home/`;
const run=()=>buildFamilyExport({sourceUrl,credentialsFile,outputDir,validateProject:model.validateProject});
try{
 const result=await run();assert.equal(result.revision,7);assert.equal(result.assetCount,2);
 const output=join(outputDir,'family'),saved=await readFile(join(output,'project.json'),'utf8'),snapshot=JSON.parse(saved);
 assert.equal(snapshot.role,'viewer');assert.equal(snapshot.publicView,true);assert.equal(snapshot.staticSnapshot,true);
 assert.ok(snapshot.exportedAt);assert.ok(!saved.includes(password));assert.ok(!saved.includes('passwordHash'));assert.ok(!saved.includes('snapshots'));
 assert.equal(snapshot.project.assets[0].url,'family/assets/image1.png');assert.equal(snapshot.project.assets[0].thumbnailUrl,'family/thumbnails/image1.png');
 assert.equal(snapshot.project.assets[1].thumbnailUrl,undefined);
 assert.deepEqual(await readFile(join(output,'assets','image1.png')),png);
 assert.deepEqual(await readFile(join(output,'thumbnails','image1.png')),png);
 assert.equal((JSON.parse(await readFile(join(output,'manifest.json'),'utf8'))).files.length,3);
 assert.equal(logouts,1);assert.ok(transient>=2,'transient GET failure retried');
 for(const [mode,pattern] of [['changed',/changed during export/],['checksum',/integrity mismatch/],['unsafe',/model validation|attachment ID/]]){
  scenario=mode;reads=0;await assert.rejects(run,pattern);
  assert.equal(await readFile(join(output,'project.json'),'utf8'),saved,`${mode} must preserve complete snapshot`);
  assert.deepEqual((await readdir(outputDir)).sort(),['family'],'failed staging folders removed');
 }
 assert.equal(logouts,4);
 await assert.rejects(()=>buildFamilyExport({sourceUrl:'http://example.com/xian-home/',credentialsFile,outputDir,validateProject:model.validateProject}),/requires HTTPS/);
 console.log('Family export tests passed: current assets, thumbnails, hashes, revision consistency, safe paths, retries, credential exclusion and complete-bundle preservation.');
}finally{
 await new Promise(yes=>server.close(yes));await rm(directory,{recursive:true,force:true});
}
