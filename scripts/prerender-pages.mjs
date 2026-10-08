import {readFileSync,writeFileSync} from 'node:fs';
const path='dist-pages/index.html';
let html=readFileSync(path,'utf8');
html=html.replace(/<div id="root">[\s\S]*?<\/div><\/div>/,'<div id="root"><main style="padding:40px;font-family:Microsoft YaHei"><h1>西安的家 · 家人查看</h1><p>正在打开两层布局、尺寸和效果图，无需输入口令。</p><p>若此入口连接较慢，可使用 <a href="https://jmryqyx.cn/xian-home/">正式入口</a>。</p><p><a href="?legacy=1">旧版本机布局与图片迁移</a></p></main></div>');
writeFileSync(path,html);
