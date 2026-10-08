// Local browser mocks only. Never authenticates to or writes a live project.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
if(!process.env.XIAN_AUTH_FIXTURE)throw Error('Set XIAN_AUTH_FIXTURE to a local project envelope fixture.');
const fixture=JSON.parse(readFileSync(process.env.XIAN_AUTH_FIXTURE,'utf8'));
assert(fixture.project?.variants?.length&&Number.isInteger(fixture.revision));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/xiaoxiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const ports=[4186,4188],servers=[],base='http://127.0.0.1:4186/xian-home/',staticBase='http://127.0.0.1:4188/xian-home-studio/';
let browser;
const results=[],errors=[],foreignRequests=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function start(config,port){
 const child=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'preview','--config',config,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});servers.push(child);
 let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Local preview failed: '+output);if(output.includes('http://127.0.0.1:'))return;await sleep(100);}
 throw Error('Local preview did not start.');
}
async function context(){const ctx=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&ports.includes(Number(u.port)))return route.continue();foreignRequests.push(u.origin);return route.abort('blockedbyclient');});const page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));return {ctx,page};}
async function mock(ctx,initialRole='owner'){
 const state={expired:false,gets:0,writes:0,sessionQueries:[]};
 await ctx.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname.split('/api')[1];
  const reply=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path==='/session'&&request.method()==='GET'){state.sessionQueries.push(url.search);return reply(200,url.searchParams.has('share')?{role:null}:{role:initialRole,...(initialRole==='viewer'?{publicView:true}:{})});}
  if(path==='/project'&&request.method()==='GET'){state.gets++;return reply(200,{...fixture,role:state.expired||initialRole==='viewer'?'viewer':'owner',publicView:state.expired||initialRole==='viewer'});}
  if(request.method()!=='GET'){state.writes++;return reply(401,{error:'Local mocked session expiry'});}
  return reply(404,{error:'No local mocked resource'});
 });return state;
}
async function frozenOwner(){const {ctx,page}=await context(),state=await mock(ctx);const now=Date.now();await page.clock.install({time:now});await page.clock.pauseAt(now+1000);await page.goto(base+'?admin=1',{waitUntil:'domcontentloaded'});await page.locator('.editor-slot').waitFor();return {ctx,page,state};}
async function addDraft(page,marker){await page.locator('.studio-nav').getByRole('button',{name:/^待确认/}).dispatchEvent('click');await page.getByLabel('问题标题',{exact:true}).fill(marker);await page.locator('.issue-form').evaluate(form=>form.requestSubmit());await page.getByRole('heading',{name:marker,exact:true}).waitFor();assert(await page.evaluate(marker=>JSON.parse(localStorage.getItem('xian-home-v4-recovery'))?.project.issues.some(issue=>issue.title===marker),marker));}
async function expiredAssertions(page,marker){await page.getByRole('link',{name:'重新管理登录',exact:true}).waitFor();assert.equal(await page.locator('.editor-slot').count(),0);assert.equal(await page.locator('.viewer-mode').count(),1);assert.equal(await page.locator('.studio-status').getByRole('button',{name:'保存',exact:true}).count(),0);assert.match(await page.locator('.studio-status [role=status]').textContent(),/管理登录已失效/);assert(await page.evaluate(marker=>JSON.parse(localStorage.getItem('xian-home-v4-recovery'))?.project.issues.some(issue=>issue.title===marker),marker));}
async function check(name,action){try{await action();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false});console.log('FAIL '+name+': '+error.message);}}
try{
 await Promise.all([start('vite.studio.config.ts',ports[0]),start('vite.pages.config.ts',ports[1])]);
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 await check('owner poll detects public viewer response, preserves pending draft, cancels writes',async()=>{
  const {ctx,page,state}=await frozenOwner();try{
   await page.clock.runFor(19750);await addDraft(page,'local-poll-expiry-marker');state.expired=true;
   await page.clock.runFor(350);await expiredAssertions(page,'local-poll-expiry-marker');assert.equal(state.gets,2);assert.equal(state.writes,0);
   await page.clock.runFor(60000);assert.equal(state.writes,0);await expiredAssertions(page,'local-poll-expiry-marker');
   const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'下载本机调整',exact:true}).dispatchEvent('click');const download=await downloadEvent;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const backup=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert(backup.project.issues.some(issue=>issue.title==='local-poll-expiry-marker'));assert.equal(backup.baseRevision,fixture.revision);
  }finally{await ctx.close();}
 });
 await check('owner PUT 401 stops retries and keeps recovery copy',async()=>{
  const {ctx,page,state}=await frozenOwner();try{await addDraft(page,'local-write-expiry-marker');state.expired=true;await page.clock.runFor(1000);await expiredAssertions(page,'local-write-expiry-marker');assert.equal(state.writes,1);await page.clock.runFor(60000);assert.equal(state.writes,1);await expiredAssertions(page,'local-write-expiry-marker');}finally{await ctx.close();}
 });
 await check('anonymous admin query presents password form without fetching project',async()=>{
  const {ctx,page}=await context();try{const state=await mock(ctx,'viewer');await page.goto(base+'?admin=1',{waitUntil:'domcontentloaded'});await page.getByLabel('访问口令',{exact:true}).waitFor();assert.equal(await page.locator('.studio-nav').count(),0);assert.equal(state.gets,0);assert.equal(state.writes,0);}finally{await ctx.close();}
 });
 await check('empty share is invalid and retained in session request',async()=>{
  const {ctx,page}=await context();try{const state=await mock(ctx,'viewer'),sessionResponse=page.waitForResponse(response=>response.url().includes('/api/session?share='));await page.goto(base+'?share=',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'分享链接无效',exact:true}).waitFor();await sessionResponse;assert.equal(await page.locator('.studio-nav').count(),0);assert.equal(state.gets,0);assert(state.sessionQueries.includes('?share='));}finally{await ctx.close();}
 });
 await check('static share links to exact formal fixed snapshot instead of password form',async()=>{
  const {ctx,page}=await context();try{await page.goto(staticBase+'?share=local-fixed-snapshot',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'固定分享版本',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'打开正式分享入口',exact:true}).getAttribute('href'),'https://jmryqyx.cn/xian-home/?share=local-fixed-snapshot');assert.equal(await page.getByLabel('访问口令',{exact:true}).count(),0);assert.equal(await page.locator('.studio-nav').count(),0);}finally{await ctx.close();}
 });
 assert.deepEqual(errors,[]);assert.deepEqual(foreignRequests,[]);
 console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,uncaughtErrors:errors.length,externalNetworkRequests:foreignRequests.length,mocked:true}));
}finally{if(browser)await browser.close();for(const child of servers)child.kill('SIGTERM');}
if(results.some(result=>!result.passed))process.exitCode=1;
