// Publishes only the current project and its referenced files, never backup/snapshot credentials.
import {readFile,mkdir,mkdtemp,writeFile,rename,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {loadProjectModel} from '../server/model-loader.mjs';
import {sniffMime,validId} from '../server/security.mjs';

const extensions={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/heic':'heic'};
const digest=value=>createHash('sha256').update(value).digest('hex');
const delay=ms=>new Promise(yes=>setTimeout(yes,ms));
const MAX_FILE_BYTES=95*1024*1024;
const MAX_PUBLISH_BYTES=900*1024*1024;

async function pooled(items,work,concurrency){
 let cursor=0;
 const results=await Promise.allSettled(Array.from({length:Math.min(concurrency,items.length)},async()=>{
  while(cursor<items.length){const index=cursor++;await work(items[index],index);}
 }));
 const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
}

export async function buildFamilyExport({sourceUrl,credentialsFile,outputDir,concurrency=4,validateProject,onProgress=()=>{}}){
 const source=new URL(sourceUrl);
 if(source.username||source.password||source.search||source.hash||!['https:','http:'].includes(source.protocol))throw Error('Source must be an HTTP(S) site URL without credentials or query parameters.');
 if(source.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(source.hostname))throw Error('Owner authentication requires HTTPS except for a local test server.');
 const base=source.href.replace(/\/$/,''),output=resolve(outputDir),target=join(output,'family');
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw Error('Download concurrency must be between 1 and 8.');
 const credentials=JSON.parse(await readFile(credentialsFile,'utf8'));
 if(typeof credentials.password!=='string'||!credentials.password)throw Error('Credentials file does not contain an owner password.');
 let cookie='',stage='',modelDirectory='';
 async function request(path,{method='GET',body,retry=method==='GET'}={}){
  for(let attempt=0;;attempt++){
   try{
    const response=await fetch(base+'/api'+path,{method,redirect:'error',signal:AbortSignal.timeout(120000),headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    if(!response.ok){await response.body?.cancel();const error=Error(`Source request failed (${response.status}) for ${path}.`);error.retryable=response.status===429||response.status>=500;throw error;}
    return response;
   }catch(error){if(!retry||attempt>=2||error.retryable===false)throw error;await delay(500*(attempt+1));}
  }
 }
 async function readBytes(path,expectedMime){
  for(let attempt=0;;attempt++)try{
   const response=await request(path,{retry:false}),declared=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
   const invalid=message=>{const error=Error(message);error.retryable=false;return error;};
   if(!extensions[declared]||expectedMime&&declared!==expectedMime){await response.body?.cancel();throw invalid(`Attachment type mismatch for ${path}.`);}
   const stated=Number(response.headers.get('content-length')||0);
   if(stated>MAX_FILE_BYTES){await response.body?.cancel();throw invalid(`Attachment exceeds GitHub Pages file limit: ${path}.`);}
   const chunks=[];let count=0;
   for await(const chunk of response.body){count+=chunk.length;if(count>MAX_FILE_BYTES)throw invalid(`Attachment exceeds GitHub Pages file limit: ${path}.`);chunks.push(chunk);}
   const bytes=Buffer.concat(chunks);sniffMime(bytes,declared);return {bytes,mime:declared};
  }catch(error){if(attempt>=2||error.retryable===false||error.status===415)throw error;await delay(500*(attempt+1));}
 }
 try{
  const auth=await request('/session',{method:'POST',body:{password:credentials.password}}),session=await auth.json();
  cookie=auth.headers.get('set-cookie')?.split(';')[0]||'';
  if(session.role!=='owner'||!cookie)throw Error('Owner authentication did not establish an owner session.');
  const envelope=await(await request('/project')).json();
  if(envelope.role!=='owner'||!Number.isSafeInteger(envelope.revision)||envelope.revision<0)throw Error('Source project revision is invalid.');
  if(!validateProject){modelDirectory=await mkdtemp(join(tmpdir(),'xian-family-model-'));({validateProject}=await loadProjectModel(modelDirectory));}
  if(!validateProject(envelope.project))throw Error('Source project failed model validation.');
  const project=structuredClone(envelope.project),assetIds=new Set();
  for(const asset of project.assets){
   if(!validId(asset.id)||assetIds.has(asset.id)||!extensions[asset.mime])throw Error('Source has an unsupported attachment ID or MIME type.');
   assetIds.add(asset.id);
  }
  await mkdir(output,{recursive:true});stage=await mkdtemp(join(output,'.family-export-'));
  await Promise.all([mkdir(join(stage,'assets')),mkdir(join(stage,'thumbnails'))]);
  let bytesWritten=0,completed=0;
  const files=[];
  await pooled(project.assets,async asset=>{
   const original=await readBytes('/assets/'+asset.id,asset.mime),hash=digest(original.bytes);
   if(asset.sha256&&asset.sha256!==hash||asset.size!==undefined&&asset.size!==original.bytes.length)throw Error(`Attachment integrity mismatch: ${asset.id}.`);
   const filename=asset.id+'.'+extensions[original.mime];asset.url='family/assets/'+filename;
   // Explicitly replace any old URL fields; the bundle never points back to authenticated files.
   delete asset.thumbnailUrl;
   await writeFile(join(stage,'assets',filename),original.bytes);
   asset.size=original.bytes.length;asset.sha256=hash;
   files.push({path:asset.url,sha256:hash,size:original.bytes.length});bytesWritten+=original.bytes.length;
   if(asset.mime.startsWith('image/')){
    const thumbnail=await readBytes('/assets/'+asset.id+'/thumbnail');
    const thumbName=asset.id+'.'+extensions[thumbnail.mime];asset.thumbnailUrl='family/thumbnails/'+thumbName;
    await writeFile(join(stage,'thumbnails',thumbName),thumbnail.bytes);
    files.push({path:asset.thumbnailUrl,sha256:digest(thumbnail.bytes),size:thumbnail.bytes.length});bytesWritten+=thumbnail.bytes.length;
   }
   if(bytesWritten>MAX_PUBLISH_BYTES)throw Error('Family export exceeds the 900 MiB publishing budget.');
   onProgress({completed:++completed,total:project.assets.length,bytes:bytesWritten});
  },concurrency);
  const latest=await(await request('/project')).json();
  if(latest.revision!==envelope.revision||digest(JSON.stringify(latest.project))!==digest(JSON.stringify(envelope.project)))throw Error('The project changed during export. No family snapshot was replaced; export the latest revision again.');
  const exportedAt=new Date().toISOString();
  const snapshot={project,revision:envelope.revision,role:'viewer',publicView:true,staticSnapshot:true,exportedAt,sourceUrl:base+'/'};
  await writeFile(join(stage,'project.json'),JSON.stringify(snapshot));
  const manifest={format:'xian-family-static',version:1,revision:envelope.revision,exportedAt,assetCount:project.assets.length,bytes:bytesWritten,files:files.sort((a,b)=>a.path.localeCompare(b.path))};
  await writeFile(join(stage,'manifest.json'),JSON.stringify(manifest,null,2));
  // A failed download or concurrent project edit leaves any previous complete bundle intact.
  const previous=join(output,'.family-previous-'+Date.now());let hadPrevious=false;
  try{await rename(target,previous);hadPrevious=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  try{await rename(stage,target);stage='';}catch(error){if(hadPrevious)await rename(previous,target);throw error;}
  if(hadPrevious)await rm(previous,{recursive:true,force:true});
  return {revision:manifest.revision,exportedAt,assetCount:manifest.assetCount,bytes:bytesWritten,output:target};
 }finally{
  if(cookie)try{await request('/session',{method:'DELETE'});}catch{}
  if(stage)await rm(stage,{recursive:true,force:true});
  if(modelDirectory)await rm(modelDirectory,{recursive:true,force:true});
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const credentialsFile=process.env.FAMILY_CREDENTIALS_FILE||process.env.XIAN_CREDENTIALS;
 if(!credentialsFile)throw Error('Set FAMILY_CREDENTIALS_FILE to a private owner-credentials JSON file. Credentials are used only for download and are never exported.');
 const result=await buildFamilyExport({sourceUrl:process.env.FAMILY_SOURCE_URL||process.env.XIAN_URL||'https://jmryqyx.cn/xian-home/',credentialsFile,outputDir:process.env.FAMILY_OUTPUT_DIR||'dist-pages',onProgress:status=>{if(status.completed%20===0||status.completed===status.total)console.log(`Family export: ${status.completed}/${status.total} files downloaded.`);}});
 console.log(JSON.stringify(result));
}
