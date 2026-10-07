import {mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

export async function loadProjectModel(dataDir){
 const bundled=fileURLToPath(new URL('./model.cjs',import.meta.url));
 let model;
 if(existsSync(bundled)){
  const namespace=await import(pathToFileURL(bundled).href);model=namespace.default||namespace;
 }else{
  const {build}=await import('esbuild');
  const runtime=join(dataDir,'.runtime');await mkdir(runtime,{recursive:true,mode:0o700});
  const source=fileURLToPath(new URL('../lib/project-model.ts',import.meta.url)),output=join(runtime,'project-model.mjs');
  await build({entryPoints:[source],outfile:output,bundle:true,platform:'node',format:'esm',target:'node22',logLevel:'silent'});
  model=await import(pathToFileURL(resolve(output)).href+'?t='+Date.now());
 }
 if(typeof model.validateProject!=='function'||typeof model.applyOperation!=='function')throw Error('项目模型缺少校验或操作接口。');
 return model;
}
