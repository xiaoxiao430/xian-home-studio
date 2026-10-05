import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,readdirSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const repo='https://github.com/xiaoxiao430/xian-home-studio.git';
const root=resolve('.'),output=join(root,'dist-pages');
if(!existsSync(join(output,'index.html')))throw Error('先运行 npm run build:pages。');
const dir=mkdtempSync(join(tmpdir(),'xian-pages-'));
function git(args,check=true){const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});if(check&&r.status!==0)throw Error(r.stderr||'Git failed');return r;}
try{
 git(['init','--initial-branch=gh-pages']);git(['remote','add','origin',repo]);
 const remote=git(['ls-remote','--heads','origin','gh-pages']);
 if(remote.stdout.trim()){git(['fetch','--depth=1','origin','gh-pages']);git(['reset','--hard','FETCH_HEAD']);}
 for(const name of readdirSync(dir))if(name!=='.git')rmSync(join(dir,name),{recursive:true,force:true});
 cpSync(output,dir,{recursive:true});writeFileSync(join(dir,'.nojekyll'),'');
 const source=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
 writeFileSync(join(dir,'deployment.json'),JSON.stringify({source,createdAt:new Date().toISOString()},null,2));
 git(['config','user.name','Xian Home Studio']);git(['config','user.email','xiaoxiao430@users.noreply.github.com']);
 git(['add','--all']);git(['commit','-m',`Deploy static editor from ${source.slice(0,12)}`]);git(['push','origin','HEAD:gh-pages']);
 console.log(JSON.stringify({branch:'gh-pages',source,commit:git(['rev-parse','HEAD']).stdout.trim(),url:'https://xiaoxiao430.github.io/xian-home-studio/'}));
}finally{rmSync(dir,{recursive:true,force:true});}
