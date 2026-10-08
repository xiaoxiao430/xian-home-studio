// Anonymous, read-only QA. No login, project edits, uploads or deployments.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const args=process.argv.slice(2),value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const base=new URL(value('--url','http://127.0.0.1:18892/xian-home/'));
if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw Error('Supply an anonymous site root without credentials or query parameters.');
const isStatic=args.includes('--static'),blockApi=args.includes('--block-api')||isStatic;
const out=path.resolve(value('--out','/tmp/xian-family-browser-qa'));
fs.mkdirSync(out,{recursive:true});
const {chromium,devices}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/xiaoxiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],runtimeErrors=[],failedResponses=[],attemptedApi=[];
async function check(name,fn,page){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(error){results.push({name,ok:false,error:error.message});console.log('FAIL '+name+': '+error.message);if(page)await page.screenshot({path:path.join(out,`failure-${results.length}.png`),fullPage:true}).catch(()=>{});}}
function track(page,label){
 page.on('pageerror',e=>runtimeErrors.push({label,error:e.message}));
 page.on('response',r=>{if(r.status()>=400&&!/favicon\.ico/.test(r.url()))failedResponses.push({label,status:r.status(),url:r.url()});});
}
async function nav(page,title){await page.locator('.studio-nav').getByRole('button',{name:title,exact:true}).click();}
async function floor(page,n){await page.locator('.studio-floors').getByRole('button').nth(n-1).click();}
async function noOverflow(page){const widths=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert(widths.document<=widths.viewport+2&&widths.body<=widths.viewport+2,JSON.stringify(widths));}
async function waitForImage(img){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>new Promise((resolve,reject)=>{if(el.complete)return el.naturalWidth>0?resolve():reject(Error('Image failed'));el.addEventListener('load',resolve,{once:true});el.addEventListener('error',()=>reject(Error('Image failed')),{once:true});}));assert(await img.evaluate(el=>el.naturalWidth>0&&el.naturalHeight>0));}
async function openAnonymous(page){
 await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.studio-nav').waitFor({timeout:60000});
 assert.equal(await page.getByLabel('访问口令',{exact:true}).count(),0);
 assert.equal(await page.locator('.viewer-mode').count(),1);
 assert.equal(await page.locator('.editor-slot').count(),0);
 assert.equal(await page.getByRole('button',{name:'分享与备份',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'撤销项目修改',exact:true}).count(),0);
 assert.equal(await page.locator('.studio-status').getByRole('button',{name:'保存',exact:true}).count(),0);
 await page.getByRole('link',{name:'管理入口',exact:true}).waitFor();
}
try{
 for(const [label,options] of [['desktop',{viewport:{width:1440,height:1000}}],['mobile-wechat',{...devices['iPhone 13'],viewport:{width:390,height:844},userAgent:devices['iPhone 13'].userAgent+' MicroMessenger/8.0.60'}]]){
  const context=await browser.newContext({...options,acceptDownloads:true});
  if(blockApi)await context.route('**/api/**',route=>{attemptedApi.push(route.request().url());return route.abort('blockedbyclient');});
  const page=await context.newPage();page.setDefaultTimeout(25000);track(page,label);
  let opened=false;
  await check(`${label}: anonymous root and read-only controls`,async()=>{await openAnonymous(page);await noOverflow(page);opened=true;},page);
  if(!opened){await context.close();continue;}
  await check(`${label}: both floor plans and measurements`,async()=>{
   for(const n of [1,2]){await floor(page,n);await nav(page,'平面');const plan=page.locator('.readonly-workbench svg[aria-label]');await plan.waitFor();assert((await plan.locator('[data-piece]').count())>10);const all=page.getByRole('button',{name:'全屋尺寸',exact:true});if(!/\bprimary\b/.test(await all.getAttribute('class')||''))await all.click();await page.locator('.readonly-dimension').first().waitFor();assert((await page.locator('.readonly-dimension').count())>0);await noOverflow(page);await page.screenshot({path:path.join(out,`${label}-floor${n}.png`),fullPage:true});}
  },page);
  await check(`${label}: two independent comparison plans`,async()=>{await nav(page,'方案对比');assert.equal(await page.locator('.compare-grid article').count(),2);for(const n of [1,2]){const select=page.getByLabel('对比方案'+n,{exact:true});assert((await select.locator('option').count())>=2);}assert.equal(await page.locator('.compare-grid article svg[aria-label]').count(),2);await noOverflow(page);},page);
  await check(`${label}: effects on both floors load without login`,async()=>{
   for(const n of [1,2]){await floor(page,n);await nav(page,'效果图');const cards=page.locator('.asset-card');assert((await cards.count())>=1,`No renders on floor ${n}`);for(const img of await cards.locator('img').all())await waitForImage(img);await cards.first().click();const detail=page.locator('.asset-detail');await detail.waitFor();await waitForImage(detail.locator('img').first());const href=await detail.locator('a.asset-open').getAttribute('href');assert(href,'Original image link missing');const response=await context.request.get(new URL(href,page.url()).href);assert.equal(response.status(),200);assert(/image\//.test(response.headers()['content-type']||''));assert((await response.body()).byteLength>1000);await noOverflow(page);await page.screenshot({path:path.join(out,`${label}-renders${n}.png`),fullPage:true});}
  },page);
  await check(`${label}: reference thumbnails and disabled metadata`,async()=>{await nav(page,'资料库');const cards=page.locator('.asset-card');assert((await cards.count())>0);const img=cards.locator('img').first();if(await img.count())await waitForImage(img);await cards.first().click();const detail=page.locator('.asset-detail');await detail.waitFor();const input=detail.locator('fieldset input,fieldset textarea,fieldset select').first();assert(await input.isDisabled());assert.equal(await page.getByRole('button',{name:'添加资料',exact:true}).count(),0);await noOverflow(page);},page);
  await check(`${label}: reload remains password-free`,async()=>{await page.reload({waitUntil:'domcontentloaded'});await page.locator('.studio-nav').waitFor();assert.equal(await page.getByLabel('访问口令',{exact:true}).count(),0);},page);
  await context.close();
 }
 if(!isStatic){
  const context=await browser.newContext();
  await check('anonymous server access is read-only',async()=>{
   const prefix=new URL('api/',base);
   const session=await context.request.get(new URL('session',prefix).href);assert.equal(session.status(),200);assert.equal((await session.json()).role,'viewer');
   const project=await context.request.get(new URL('project',prefix).href);assert.equal(project.status(),200);const env=await project.json();assert(env.project?.variants?.length>=2);
   // Deliberately invalid body additionally prevents edits even if authorization regresses.
   const put=await context.request.put(new URL('project',prefix).href,{data:{},headers:{Origin:base.origin}});assert([401,403].includes(put.status()),`Anonymous PUT status ${put.status()}`);
   const backup=await context.request.get(new URL('backup',prefix).href);assert([401,403].includes(backup.status()),`Anonymous backup status ${backup.status()}`);
   const after=await(await context.request.get(new URL('project',prefix).href)).json();assert.equal(after.revision,env.revision);
  });
  await context.close();
 }
 if(blockApi)await check('static mirror makes no API requests',async()=>assert.deepEqual(attemptedApi,[]));
 await check('no uncaught browser errors or failed resources',async()=>{assert.deepEqual(runtimeErrors,[]);assert.deepEqual(failedResponses,[]);});
}finally{
 const summary={url:base.href,mode:isStatic?'static-family':'anonymous-server',completedAt:new Date().toISOString(),results,runtimeErrors,failedResponses,attemptedApi,mobile:'390px iPhone viewport with WeChat user-agent; not a physical WeChat device test'};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(summary,null,2));
 console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,out}));await browser.close();
}
if(results.some(r=>!r.ok))process.exitCode=1;
