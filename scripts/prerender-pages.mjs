import {build} from 'esbuild';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'xian-prerender-'));
try{
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import Plan from './app/Plan';import seed from './data/seed.json';import {viewBox} from './lib/model';import {migrateState} from './lib/measurement-model';const floor=migrateState(seed).floors[0];process.stdout.write(renderToStaticMarkup(<main className="initial-plan"><h1>西安的家 · 两层空间工作台</h1><p>正在载入编辑工具；布局已显示。首次打开可能需要等待字体和脚本下载。</p><Plan floor={floor} selected="" view={viewBox(floor)} grid={false} original={false} labels={true}/></main>));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'render.cjs'),logLevel:'silent'});
 const result=spawnSync(process.execPath,[join(dir,'render.cjs')],{encoding:'utf8',maxBuffer:3e6});if(result.status!==0)throw Error(result.stderr);
 const file='dist-pages/index.html',html=readFileSync(file,'utf8');writeFileSync(file,html.replace(/<div id="root">[\s\S]*?<\/div><\/div>/,`<div id="root">${result.stdout}</div>`));
 if(!readFileSync(file,'utf8').includes('data-piece="f1-island"'))throw Error('静态布局预渲染未完成。');
}finally{rmSync(dir,{recursive:true,force:true});}
