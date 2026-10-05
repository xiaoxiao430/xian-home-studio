import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'home-measure-'));try{await build({entryPoints:['tests/measurements.test.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(dir,'test.cjs'),logLevel:'silent'});const r=spawnSync(process.execPath,[join(dir,'test.cjs')],{stdio:'inherit'});process.exitCode=r.status||0;}finally{rmSync(dir,{recursive:true,force:true});}
