import http from 'node:http';
import {createReadStream,existsSync,statSync,realpathSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {loadProjectModel} from './model-loader.mjs';
import {openStore} from './store.mjs';
import {thumbnailService} from './media.mjs';
import {automaticBackupService} from './automatic-backups.mjs';
import {fail,passwordMatches,plain,validId,validateJsonTree} from './security.mjs';

const HERE=fileURLToPath(new URL('.',import.meta.url));
const mimeTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon'};
function config(overrides={}){
 const dataDir=resolve(overrides.dataDir||process.env.XIAN_DATA_DIR||join(homedir(),'Library/Application Support/XianHomeStudio'));
 const basePath=overrides.basePath??process.env.XIAN_BASE_PATH??'/xian-home';
 if(!/^\/[a-zA-Z0-9/_-]*$/.test(basePath)||basePath.endsWith('/'))throw Error('XIAN_BASE_PATH 须为不以斜线结尾的 URL 路径。');
 return {dataDir,basePath,seedPath:overrides.seedPath||process.env.XIAN_SEED_PATH||join(dataDir,'initial-project.json'),distDir:resolve(overrides.distDir||process.env.XIAN_DIST_DIR||join(HERE,'../dist-studio')),port:Number(overrides.port??process.env.XIAN_PORT??18892),secure:overrides.secure??(process.env.XIAN_COOKIE_SECURE!=='false'),publicOrigin:overrides.publicOrigin||process.env.XIAN_PUBLIC_ORIGIN||'',ownerPassword:overrides.ownerPassword||process.env.XIAN_OWNER_PASSWORD,model:overrides.model,maxRestoreBytes:Number(overrides.maxRestoreBytes??process.env.XIAN_MAX_RESTORE_BYTES??480*1024*1024),maxProjectBytes:Number(overrides.maxProjectBytes??process.env.XIAN_MAX_PROJECT_BYTES??340*1024*1024)};
}
function send(res,status,body,extra={}){const output=JSON.stringify(body);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(output);}
function cookieToken(req,name){for(const part of String(req.headers.cookie||'').split(';')){const index=part.indexOf('=');if(part.slice(0,index).trim()===name)return part.slice(index+1).trim();}return null;}
async function bytes(req,max){const length=Number(req.headers['content-length']);if(Number.isFinite(length)&&length>max)throw fail(413,'请求内容超过大小限制。');const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>max)throw fail(413,'请求内容超过大小限制。');chunks.push(chunk);}return Buffer.concat(chunks);}
async function json(req,max=12*1024*1024){if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw fail(415,'请求需使用 application/json。');const raw=await bytes(req,max);let body;try{body=JSON.parse(raw.toString('utf8'));}catch{throw fail(400,'JSON 格式无效。');}if(!plain(body))throw fail(400,'请求内容须为对象。');return body;}
function decodeHeader(value){try{return decodeURIComponent(String(value||''));}catch{throw fail(400,'附件说明编码无效。');}}

export async function createPrivateServer(overrides={}){
 const cfg=config(overrides),model=cfg.model||await loadProjectModel(cfg.dataDir),store=await openStore({...cfg,model});
 const prefix=cfg.basePath+'/api',cookieName='xian_home_session',attempts=new Map(),thumbnail=thumbnailService(cfg.dataDir),automaticBackup=automaticBackupService(store);
 function cookie(token,maxAge){return `${cookieName}=${token}; Path=${cfg.basePath||'/'}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${cfg.secure?'; Secure':''}`;}
 function sameOrigin(req){const origin=req.headers.origin;if(req.headers['sec-fetch-site']==='cross-site')throw fail(403,'不允许跨站修改。');if(origin){let acceptable;try{const url=new URL(origin);acceptable=url.origin;}catch{throw fail(403,'请求来源无效。');}const local=`http://${req.headers.host}`;if(acceptable!==(cfg.publicOrigin||local))throw fail(403,'不允许跨站修改。');}}
 function owner(session){if(!session)throw fail(401,'请先登录。');if(session.role!=='owner')throw fail(403,'该链接仅供查看。');return session;}
 function logged(session){if(!session)throw fail(401,'请先输入查看口令。');return session;}
 function guardLogin(req){const key=req.socket.remoteAddress||'local',now=Date.now(),record=attempts.get(key);if(record&&record.until>now&&record.count>=20)throw fail(429,'尝试过于频繁，请稍后再试。',{retryAfter:Math.ceil((record.until-now)/1000)});if(!record||record.until<=now)attempts.set(key,{count:1,until:now+10*60*1000});else record.count++;if(attempts.size>1000){for(const [k,v] of attempts)if(v.until<=now)attempts.delete(k);}return key;}
 async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  try{
   let pathname;try{pathname=new URL(req.url,'http://local').pathname;}catch{throw fail(400,'请求路径无效。');}
   if(pathname===prefix+'/health'&&req.method==='GET')return send(res,200,{ok:true,version:1});
   if(pathname.startsWith(prefix+'/')){
    res.setHeader('Cache-Control','no-store');const token=cookieToken(req,cookieName),session=store.readSession(token);
    if(['POST','PUT','PATCH','DELETE'].includes(req.method))sameOrigin(req);
    if(pathname===prefix+'/session'){
     if(req.method==='GET')return send(res,200,session||{role:null});
     if(req.method==='DELETE'){store.deleteSession(token);return send(res,200,{role:null},{'Set-Cookie':cookie('',0)});}
     if(req.method==='POST'){
      const key=guardLogin(req),body=await json(req,4096);validateJsonTree(body);if(typeof body.password!=='string'||body.password.length>500||body.password.length<1)throw fail(400,'请输入有效口令。');
      let role='owner',shareId,hash=store.ownerHash,exists=true;
      if(body.shareId!==undefined){if(!validId(body.shareId))throw fail(401,'口令或分享链接无效。');role='viewer';shareId=body.shareId;const row=store.snapshot(shareId);hash=row?.password_hash||store.ownerHash;exists=!!row;}
      const matches=await passwordMatches(body.password,hash);if(!matches||!exists)throw fail(401,'口令或分享链接无效。');
      attempts.delete(key);store.deleteSession(token);const created=store.createSession(role,shareId);return send(res,200,{role,...(shareId?{shareId}:{})},{'Set-Cookie':cookie(created.token,created.maxAge)});
     }
     throw fail(405,'不支持的请求方法。');
    }
    if(pathname===prefix+'/project'){
     if(req.method==='GET')return send(res,200,store.projectFor(logged(session)));
     if(req.method==='PUT'){owner(session);const body=await json(req);validateJsonTree(body);return send(res,200,store.replace(body));}
    }
    if(pathname===prefix+'/operations'&&req.method==='POST'){owner(session);const body=await json(req);validateJsonTree(body);if(!plain(body.operation))throw fail(400,'缺少 operation。');return send(res,200,store.operate(body));}
    if(pathname===prefix+'/snapshots'){
     owner(session);if(req.method==='GET')return send(res,200,{items:store.listSnapshots()});
     if(req.method==='POST'){const body=await json(req,4096);validateJsonTree(body);return send(res,201,await store.createSnapshot(body));}
    }
    if(pathname===prefix+'/assets'&&req.method==='POST'){
     owner(session);const name=decodeHeader(req.headers['x-file-name']);let meta;try{meta=JSON.parse(decodeHeader(req.headers['x-asset-meta']));}catch{throw fail(400,'附件说明格式无效。');}
     if(!plain(meta)||JSON.stringify(meta).length>12000)throw fail(400,'附件说明过长或无效。');
     const content=await bytes(req,32*1024*1024);if(!content.length)throw fail(400,'文件不能为空。');return send(res,201,store.addAsset(content,req.headers['content-type'],name,meta));
    }
    const assetMatch=pathname.match(new RegExp('^'+prefix+'/assets/([a-zA-Z0-9_-]{1,120})(?:/(?:thumbnail|thumb))?$'));
    if(assetMatch&&['GET','HEAD'].includes(req.method)){
     let file=store.assetFile(logged(session),assetMatch[1]);if(pathname.endsWith('/thumbnail')||pathname.endsWith('/thumb')){if(!file.mime.startsWith('image/'))throw fail(415,'该附件没有图片预览。');file={...file,...await thumbnail(file)};}
     res.writeHead(200,{'Content-Type':file.mime,'Content-Length':file.size,'Cache-Control':'private, no-store',...(file.fallback?{'X-Preview-Fallback':'original'}:{}),'Content-Disposition':`${file.mime==='application/json'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`});
     if(req.method==='HEAD')return res.end();const stream=createReadStream(file.path);stream.on('error',()=>res.destroy());stream.pipe(res);return;
    }
    if(pathname===prefix+'/backups'){
     owner(session);if(req.method==='GET')return send(res,200,{status:automaticBackup.status(),items:automaticBackup.items()});
     if(req.method==='POST'){await json(req,4096);return send(res,201,automaticBackup.run({force:true}));}
    }
    const backupMatch=pathname.match(new RegExp('^'+prefix+'/backups/(\\d{4}-\\d{2}-\\d{2})$'));
    if(backupMatch&&req.method==='GET'){owner(session);const file=automaticBackup.file(backupMatch[1]);res.writeHead(200,{'Content-Type':'application/json','Content-Length':file.size,'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="xian-home-'+backupMatch[1]+'.json"'});const stream=createReadStream(file.path);stream.on('error',()=>res.destroy());stream.pipe(res);return;}
    if(pathname===prefix+'/backup'&&req.method==='GET'){owner(session);return send(res,200,store.fullBackup(),{'Content-Disposition':'attachment; filename="xian-home-backup.json"'});}
    if(pathname===prefix+'/restore'&&req.method==='POST'){owner(session);const body=await json(req,cfg.maxRestoreBytes);const result=store.restore(body);automaticBackup.afterRestore();return send(res,200,result);}
    throw fail(404,'接口不存在。');
   }
   if(!['GET','HEAD'].includes(req.method))throw fail(405,'不支持的请求方法。');
   if(pathname===cfg.basePath){res.writeHead(308,{Location:cfg.basePath+'/'});return res.end();}
   if(!pathname.startsWith(cfg.basePath+'/'))throw fail(404,'页面不存在。');
   let relative;try{relative=decodeURIComponent(pathname.slice(cfg.basePath.length+1));}catch{throw fail(400,'路径编码无效。');}
   if(relative.includes('\0')||relative.split(/[\\/]/).some(p=>p==='..'||p.startsWith('.')))throw fail(404,'页面不存在。');
   let path=resolve(cfg.distDir,relative||'index.html');if(!path.startsWith(cfg.distDir+sep))throw fail(404,'页面不存在。');
   if(!extname(relative)&&!existsSync(path))path=join(cfg.distDir,'index.html');
   if(!existsSync(path)||!statSync(path).isFile()||!mimeTypes[extname(path)])throw fail(404,'页面不存在。');
   const real=realpathSync(path),distReal=realpathSync(cfg.distDir);if(!real.startsWith(distReal+sep)||real.startsWith(realpathSync(cfg.dataDir)+sep))throw fail(404,'页面不存在。');
   res.writeHead(200,{'Content-Type':mimeTypes[extname(path)],'Cache-Control':path.endsWith('.html')?'no-cache':'public, max-age=3600'});if(req.method==='HEAD')return res.end();const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch(error){if(res.headersSent){res.destroy();return;}const status=Number.isInteger(error.status)?error.status:500;send(res,status,{error:status===500?'服务暂时无法完成请求。':error.message,...(error.details||{})},status===429?{'Retry-After':String(error.details?.retryAfter||600)}:{});}
 }
 const server=http.createServer({maxHeaderSize:20000,requestTimeout:120000,headersTimeout:15000},handler);
 server.on('clientError',(_error,socket)=>{if(socket.writable)socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');});
 return {server,store,automaticBackup,config:cfg,async listen(){await new Promise((yes,no)=>{server.once('error',no);server.listen(cfg.port,'127.0.0.1',()=>{server.off('error',no);yes();});});automaticBackup.start();return server.address();},async close(){automaticBackup.stop();await new Promise(resolve=>server.close(resolve));store.close();}};
}
if(process.argv[1]&&realpathSync(resolve(process.argv[1]))===fileURLToPath(import.meta.url)){
 try{const app=await createPrivateServer();const address=await app.listen();console.log(`Xian Home Studio ready on 127.0.0.1:${address.port}${app.config.basePath} (private project service)`);for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{app.close().finally(()=>process.exit(0));});}catch(error){console.error('Xian Home Studio startup failed:',error.message);process.exitCode=1;}
}
