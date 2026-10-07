import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const directory=mkdtempSync(join(tmpdir(),'home-project-'));
try{
 await build({entryPoints:['tests/project.test.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(directory,'test.cjs'),logLevel:'silent'});
 const result=spawnSync(process.execPath,[join(directory,'test.cjs')],{stdio:'inherit'});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}finally{rmSync(directory,{recursive:true,force:true});}
