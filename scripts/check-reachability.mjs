import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2),value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const date=value('--date','2026-10-07'),target=new URL(value('--url','https://jmryqyx.cn/xian-home/'));
if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash)throw Error('Only public HTTPS entry URLs without credentials or query strings are allowed.');
const output=resolve(value('--out','docs/network-checks/'+date)),api='https://api.globalping.io/v1/measurements';
let locations=[{country:'CN',city:"Xi'an",asn:4134,limit:1},{country:'CN',city:'Guangzhou',asn:4134,limit:1},{country:'CN',city:'Wuhan',asn:4837,limit:1},{country:'CN',city:'Shanghai',asn:17621,limit:1},{country:'CN',city:'Shanghai',asn:9808,limit:1},{country:'CN',city:'Beijing',asn:56048,limit:1},{country:'SG',asn:4773,limit:1},{country:'SG',asn:18106,limit:1},{country:'SG',asn:56300,limit:1}];
if(args.includes('--locations'))locations=JSON.parse(readFileSync(resolve(value('--locations')),'utf8'));
const reportPath=value('--report','docs/reachability-'+date+'.md');
const cached=value('--probes','/tmp/xian-network-probes.json');
if(existsSync(cached)){const probes=JSON.parse(readFileSync(cached,'utf8'));for(const loc of locations)if(!probes.some(p=>p.location.country===loc.country&&p.location.asn===loc.asn&&(!loc.city||p.location.city===loc.city)))throw Error('Requested probe absent from supplied probe list: '+JSON.stringify(loc));}
if(!args.includes('--run')){console.log(JSON.stringify({prepared:true,url:target.href,locations,publicResources:['login HTML','current main JavaScript','route-worker.js','Microsoft YaHei font HEAD','current three.module JavaScript'],note:'No target or measurement request sent. Run only after final deployment READY.'},null,2));process.exit(0);}
mkdirSync(output,{recursive:true});
const userAgent='XianHomeStudioReachability/1.0 (+https://github.com/xiaoxiao430/xian-home-studio)';
const headers={'User-Agent':userAgent,'Accept-Encoding':'gzip'};
const write=(name,object)=>writeFileSync(join(output,name),JSON.stringify(object,null,2)+'\n');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function publicFetch(url,method='GET'){
 const parsed=new URL(url);if(parsed.origin!==target.origin||!parsed.pathname.startsWith(target.pathname)||parsed.pathname.includes('/api/')||parsed.search)throw Error('Refusing non-public resource path.');
 const response=await fetch(parsed,{method,headers,redirect:'error',signal:AbortSignal.timeout(45000)});const body=method==='HEAD'?'':await response.text();
 if(response.status!==200)throw Error(`Formal deployment resource is not ready: ${response.status} ${parsed.pathname}`);
 return {path:parsed.pathname,url:parsed.href,method,status:response.status,headers:Object.fromEntries(response.headers),body};
}
const homepage=await publicFetch(target.href);
if(!/<html|<!doctype/i.test(homepage.body)||!/id=["']root["']/.test(homepage.body)||/Sorry, you have been blocked|Access Denied/i.test(homepage.body))throw Error('Public entry is not the expected app shell.');
const scriptPath=[...homepage.body.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(m=>m[1]).find(p=>/\/assets\/index-[^/]+\.js$/.test(p));if(!scriptPath)throw Error('Cannot find current main JavaScript from final remote HTML.');
const main=await publicFetch(new URL(scriptPath,target).href);
const threePath=main.body.match(/(?:\.\/)?(three\.module-[a-zA-Z0-9_-]+\.js)/)?.[1];if(!threePath)throw Error('Cannot find three.module dynamic chunk in current remote main JavaScript.');
const allResources=[{id:'homepage',name:'登录页',...homepage},{id:'javascript',name:'主 JavaScript',...main},{id:'worker',name:'通道 Worker',...await publicFetch(new URL('route-worker.js',target).href)},{id:'font',name:'微软雅黑字体 HEAD',...await publicFetch(new URL('fonts/yahei-full.woff2',target).href,'HEAD')},{id:'three',name:'三维模块',...await publicFetch(new URL(threePath,main.url).href)}];
const resourceIds=value('--resources','homepage,javascript,worker,font,three').split(',');
const resources=allResources.filter(r=>resourceIds.includes(r.id));if(!resources.length||resources[0].id!=='homepage')throw Error('Requested resource subset must begin with homepage.');
write('public-resources.json',resources.map(({body,...entry})=>({...entry,sha256:body?createHash('sha256').update(body).digest('hex'):null,bodyPrefix:body.slice(0,600)})));
write('planned-locations.json',locations);
const reports=[];
function summarize(report,resource,round){return {id:report.id,resource:resource.id,name:resource.name,path:resource.path,method:resource.method,round,createdAt:report.createdAt,status:report.status,results:(report.results||[]).map(({probe,result:r})=>{
 const body=r.rawBody||'',contentType=r.headers?.['content-type']||'',prefix=resource.body.slice(0,Math.min(180,resource.body.length));
 const bodyMatches=resource.method==='HEAD'?null:!!prefix&&body.startsWith(prefix);
 const typeMatches=resource.id==='homepage'?/text\/html/i.test(contentType):resource.id==='font'?/font|woff|octet-stream/i.test(contentType):/javascript|ecmascript/i.test(contentType);
 const success=r.statusCode===200&&typeMatches&&(resource.method==='HEAD'||bodyMatches);
 return {country:probe.country,city:probe.city,asn:probe.asn,network:probe.network,status:r.status,statusCode:r.statusCode??null,success,typeMatches,bodyMatches,contentType,contentLength:r.headers?.['content-length']??null,remoteAddress:r.resolvedAddress??null,totalMs:r.timings?.total??null,error:r.message||r.error||(!r.statusCode?r.rawOutput:'')||null,bodyPrefix:body.slice(0,600)};
})};}
async function measurement(resource,probeSelector,round){
 const request={type:'http',target:target.hostname,locations:probeSelector,timeout:30,measurementOptions:{protocol:'HTTPS',port:443,request:{path:resource.path,method:resource.method}}};
 const registered=await fetch(api,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(45000)});
 const response=await registered.json();const stem=resource.id+(round===1?'':'-repeat-'+round);
 write(stem+'-request.json',{sentAt:new Date().toISOString(),request,status:registered.status,response});
 if(!registered.ok||!response.id)throw Error('Globalping refused request: '+JSON.stringify(response));
 let report,etag;
 for(let poll=0;poll<24;poll++){
  await pause(poll<3?2000:5000);
  const result=await fetch(api+'/'+response.id,{headers:{...headers,...(etag?{'If-None-Match':etag}:{})},signal:AbortSignal.timeout(45000)});
  if(result.status===304)continue;if(!result.ok)throw Error('Globalping report failed: '+result.status);etag=result.headers.get('etag');report=await result.json();
  if(report.status==='finished')break;
 }
 if(!report)throw Error('Globalping returned no report.');
 write(stem+'-report.json',report);const summary=summarize(report,resource,round);write(stem+'-summary.json',summary);reports.push(summary);
 console.log(JSON.stringify({resource:resource.id,round,id:report.id,status:report.status,probes:summary.results.length,passed:summary.results.filter(r=>r.success).length,failed:summary.results.filter(r=>!r.success).map(r=>({city:r.city,asn:r.asn,status:r.statusCode,error:r.error}))}));
 return summary;
}
const first=await measurement(resources[0],value('--reuse',null)||locations,1);
for(const resource of resources.slice(1))await measurement(resource,first.id,1);
for(const resource of resources){if(reports.some(r=>r.resource===resource.id&&r.round===1&&r.results.some(p=>!p.success)))await measurement(resource,first.id,2);}
const all=reports.flatMap(r=>r.results.map(result=>({...result,resource:r.resource,round:r.round,measurementId:r.id}))),failures=all.filter(r=>!r.success),successes=all.filter(r=>r.success);
write('all-results.json',{url:target.href,completedAt:new Date().toISOString(),reports,requests:all.length,passed:successes.length,failed:failures.length});
const localTime=value=>new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'});
const cell=r=>r?`${r.statusCode??'无 HTTP'} / ${r.totalMs??'—'} ms${r.success?'':' / 未通过'}`:'无样本';
const firstReports=reports.filter(r=>r.round===1),probes=first.results;
const country=r=>r.country==='CN'?'中国大陆':'新加坡';
const lines=[`# 自有域名地区可达性实测（${date}）`,'',`正式入口：[西安空间工作台](${target.href})`,'','## 实测结论','',failures.length?`本次 ${all.length} 次远端公开资源请求中，${successes.length} 次通过 HTTP 状态、响应类型及正文前缀核对，${failures.length} 次未通过。全部失败及复测保留如下；不能宣称所有网络稳定可用。`:`本次 ${all.length} 次远端公开资源请求全部通过 HTTP 状态与响应类型核对；GET 资源正文前缀也与正式版本一致。中国大陆和新加坡所选样本均能取得这些公开资源。`,'','## 方法与边界','',`- 使用 [Globalping 官方 API](https://globalping.io/docs/api.globalping.io) 实际远端探针，未使用开发电脑出口代替地区测试。`,`- 测试时间为 ${localTime(reports[0].createdAt)} 至 ${localTime(new Date())}，UTC+8。`,`- 首页先选定 ${probes.length} 个探针，其余资源与失败复测使用测量 ID ${first.id} 复用同一批探针。`,`- 本轮远端只请求${resources.map(r=>r.name).join("、")}；没有向平台提供口令、Cookie、分享口令、私有方案或照片。`,`- 每次 HTTPS 请求采用默认 DNS 解析、443 端口、30 秒超时；没有固定 IP 或绕过失败线路。`,`- GET 检查 HTTP 200、Content-Type 及正文前 180 字符，与正式远端资源比对，防止把拦截页的 200 当作成功。原始响应正文可能被平台截断。`,...(resources.some(r=>r.id==='font')?[`- 字体使用 HEAD，只证明状态和响应头可达，不代表完整字体已下载。`]:[]),`- 这不是中国大陆或新加坡实体手机的登录浏览器测试，平台不执行 JavaScript、不验证三维渲染或私有数据登录；实际功能验收另行进行。`,`- 结果仅代表这些时刻和探针，不保证所有移动网络、地区或未来时段。`,'','## 正式资源及证据','', '| 资源 | 方法 / 路径 | 首测报告 |','| --- | --- | --- |',...resources.map(resource=>{const report=firstReports.find(r=>r.resource===resource.id);return `| ${resource.name} | ${resource.method} ${resource.path} | [公开报告](https://globalping.io/?measurement=${report.id}) · [原始 JSON](https://api.globalping.io/v1/measurements/${report.id}) |`;}),'','## 首轮完整结果','',`| 地区 / 城市 / 网络 | ASN | ${resources.map(r=>r.name).join(' | ')} |`,`| --- | --- | ${resources.map(()=>'---').join(' | ')} |`,...probes.map(probe=>`| ${country(probe)} / ${probe.city} / ${probe.network} | AS${probe.asn} | ${resources.map(resource=>cell(firstReports.find(r=>r.resource===resource.id)?.results.find(r=>r.country===probe.country&&r.city===probe.city&&r.asn===probe.asn))).join(' | ')} |`),'','## 失败与复测','',...(failures.length?['首轮失败保留，不以复测覆盖。',...reports.filter(r=>r.round>1).map(r=>`- ${r.name}第 ${r.round} 轮：[公开报告](https://globalping.io/?measurement=${r.id})，${r.results.filter(p=>p.success).length}/${r.results.length} 通过。`),...failures.map(r=>`- ${r.resource} 第 ${r.round} 轮，${r.city} AS${r.asn}：${r.error||'响应状态、类型或正文不符'}；HTTP ${r.statusCode??'未返回'}，远端 ${r.remoteAddress||'未知'}。`)]:['本次没有失败请求，因此没有额外复测。']),'','## 原始记录','',`全部请求、返回报告、正文前缀与汇总保存在 [${relative(dirname(resolve(reportPath)),output)}](${relative(dirname(resolve(reportPath)),output)})。公开测量链接可能受平台历史保留策略影响，因此同时保留仓库归档。`,''];
writeFileSync(resolve(reportPath),lines.join('\n'));
console.log(JSON.stringify({completed:true,requests:all.length,passed:successes.length,failed:failures.length,report:reportPath}));
