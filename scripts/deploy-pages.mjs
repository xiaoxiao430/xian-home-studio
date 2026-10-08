import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,readdirSync,rmSync,writeFileSync,readFileSync,existsSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const repo='https://github.com/xiaoxiao430/xian-home-studio.git';
const root=resolve('.'),output=join(root,'dist-pages');
if(!existsSync(join(output,'index.html')))throw Error('先运行 npm run build:pages。');
const familyPath=join(output,'family/project.json'),manifestPath=join(output,'family/manifest.json');
if(!existsSync(familyPath)||!existsSync(manifestPath))throw Error('家人查看版本缺少完整方案及附件。请先运行 npm run build:family。');
const family=JSON.parse(readFileSync(familyPath,'utf8')),manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if(family.role!=='viewer'||family.publicView!==true||family.staticSnapshot!==true||!Number.isSafeInteger(family.revision)||family.revision!==manifest.revision||family.exportedAt!==manifest.exportedAt||family.project?.assets?.length!==manifest.assetCount)throw Error('家人查看方案与导出清单不一致，未部署。');
if(!Array.isArray(manifest.files)||manifest.files.some(file=>typeof file.path!=='string'||!/^family\/(assets|thumbnails)\/[a-zA-Z0-9_-]+\.(pdf|png|jpg|webp|heic)$/.test(file.path)||!existsSync(join(output,file.path))))throw Error('家人查看附件不完整，未部署。');
const dir=mkdtempSync(join(tmpdir(),'xian-pages-'));
function git(args,check=true){const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});if(check&&r.status!==0)throw Error(r.stderr||'Git failed');return r;}
try{
 git(['init','--initial-branch=gh-pages']);git(['remote','add','origin',repo]);
 // Borrow local objects so deployment does not download the same embedded fonts again.
 const objects=spawnSync('git',['rev-parse','--git-path','objects'],{cwd:root,encoding:'utf8'});
 const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
 if(objects.status===0&&head.status===0){mkdirSync(join(dir,'.git/objects/info'),{recursive:true});writeFileSync(join(dir,'.git/objects/info/alternates'),resolve(root,objects.stdout.trim())+'\n');git(['update-ref','refs/heads/build-source',head.stdout.trim()]);}
 const remote=git(['ls-remote','--heads','origin','gh-pages']);
 if(remote.stdout.trim()){git(['fetch','--depth=1','origin','gh-pages']);git(['reset','--hard','FETCH_HEAD']);}
 for(const name of readdirSync(dir))if(name!=='.git')rmSync(join(dir,name),{recursive:true,force:true});
 cpSync(output,dir,{recursive:true});writeFileSync(join(dir,'.nojekyll'),'');
 const source=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
 writeFileSync(join(dir,'deployment.json'),JSON.stringify({source,createdAt:new Date().toISOString(),revision:family.revision,exportedAt:family.exportedAt,assetCount:manifest.assetCount,readOnly:true},null,2));
 git(['config','user.name','Xian Home Studio']);git(['config','user.email','xiaoxiao430@users.noreply.github.com']);
 git(['add','--all']);git(['commit','-m',`Deploy family viewer V${family.revision} from ${source.slice(0,12)}`]);git(['push','origin','HEAD:gh-pages']);
 console.log(JSON.stringify({branch:'gh-pages',source,revision:family.revision,exportedAt:family.exportedAt,commit:git(['rev-parse','HEAD']).stdout.trim(),url:'https://xiaoxiao430.github.io/xian-home-studio/'}));
}finally{rmSync(dir,{recursive:true,force:true});}
