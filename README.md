# 西安的家 · 独立网页版

正式入口：https://xiaoxiao430.github.io/xian-home-studio/

这个入口由 GitHub Pages 提供，无需登录，不依赖 OpenAI Sites、ChatGPT、Cloudflare Workers 或外部 CDN。脚本、路由计算线程和字体均由同一站点提供。

## 编辑与保存

- 两层布局、实时尺寸、通道估算、区域面积及 DXF / PDF / SVG / CSV 导出均在浏览器运行。
- 方案保存在当前浏览器的 localStorage，参考图及说明保存在 IndexedDB。清理浏览器数据会删除本机副本，请定期导出。
- 跨设备或从旧站迁移：在原入口导出方案 JSON，再在新入口点右上角“导入方案”。新域名无法自动读取旧站的浏览器草稿或私人云端数据。
- 参考图可在“效果图”页连同平面与说明导出任务文件。静态入口不提供云端同步或自动 AI 生图，也不在浏览器中保存 API 密钥。
- 通道是网格估算；结构墙和阳台调整仅用于方案比较，施工条件仍需复核。

## 本地开发和发布

```bash
npm ci
npm run dev:pages
# 或验证真实部署子路径
npm run build:pages
npm run preview:pages
```

Pages 发布来源为 `gh-pages` 分支根目录，包含 `.nojekyll`。源码在 `main`；构建产物通过以下步骤发布：

```bash
npx tsc --noEmit
npm run test:measurements
npm run build:pages
git add .
git commit -m "Update standalone editor"
git push https://github.com/xiaoxiao430/xian-home-studio.git HEAD:main
npm run deploy:pages
```

`deploy:pages` 只在临时目录创建部署提交，不切换工作目录分支、不重写远端历史。需要已有 GitHub push 权限；部署身份从本机 Git 凭证读取。`deployment.json` 记录对应源码版本。

`vite.pages.config.ts` 独立于旧 Sites 构建。默认路径 `/xian-home-studio/`；换域名根目录可设置 `PAGES_BASE=/` 重新构建。旧 Sites 服务端源码保留，作为历史云端数据与原构建兼容代码；新入口不会向旧站发请求。

## 验证范围

浏览器验收包含拖动实时尺寸、970 mm 椅后净距基准、1800 mm 沙发至电视柜净距、两层切换、刷新恢复、四种导出、图片本机保存和手机布局。地区网络可达性是指定节点在指定时间的实测，不能保证所有网络永久可达。

正式文件使用微软雅黑；PDF嵌入字体，DXF指定对应文字样式。字体用于本项目文档与网页嵌入，不授予第三方独立字体再分发许可。
