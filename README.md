# 西安的家 · 两层空间工作台

家人免登录查看：[Mac Studio 正式入口](https://jmryqyx.cn/xian-home/) · [GitHub 独立查看入口](https://xiaoxiao430.github.io/xian-home-studio/)。两层布局、参考资料与效果图均可只读浏览。正式入口读取当前方案；GitHub 显示明确标注版本及发布时间的独立副本。

[管理入口](https://jmryqyx.cn/xian-home/?admin=1) 仍验证管理口令。设计师固定快照继续验证各自口令，草稿修改不影响旧分享。数据库、会话、口令、备份与历史快照不会发布到 GitHub；经授权公开的当前方案及关联图片发布在 `gh-pages`。

[地区访问实测](docs/reachability-2026-10-07.md) · [本次升级与验收范围](docs/workbench-release-2026-10-07.md) · [服务与备份说明](server/README.md)

## 使用

- A、B 各自包含两层，支持拖动、旋转、数值编辑及独立复制。沙发、贴背办公桌和两把椅子可以联动，也可解除联动。
- 平面、立面、剖面和按需加载的 Three.js 三维共用毫米几何。柜体可编辑门板、层板、抽屉、开放格、踢脚、顶部收口与开门方向。
- 实时净距、固定测量、任意测量、观看距离、区域面积和后台通道估算继续保留。通道目标可逐条修改，设为 0 关闭参考；目标不改变实际尺寸。
- 未确认的层高使用 3000 mm 示意值，并显示待复测。方案中的墙体和阳台调整不是结构审批结论。
- 资料按原图、现状证据、格局及风格参考组织，可关联楼层、空间和对象。效果图可绑定布局版本；几何变化后标记待更新。
- 草稿自动保存，支持撤销和恢复。并发冲突保留本机副本，由用户另存独立方案，不覆盖对方调整。
- 管理者点击“确认并生成分享快照”后，生成独立链接和查看口令。设计师读取固定版本、查看与下载；之后草稿修改不影响已分享版本。
- DXF、PDF、SVG、CSV 以及按空间圈选的交底 PDF、手机图可导出。PDF 实际嵌入微软雅黑；DXF 使用毫米及可编辑 DIMENSION 实体。

## 旧版迁移

[GitHub Pages 旧版迁移](https://xiaoxiao430.github.io/xian-home-studio/?legacy=1) 保留本机数据导出和旧编辑器。使用原来编辑过的浏览器，导出两层布局和 IndexedDB 全部参考图片，再在新版“分享与备份”导入。导入另存为方案，现有 A/B 保留。

跨域网页不能直接读取旧浏览器数据。迁移不会清空旧存储；v2/v3 JSON 也可导入。完整备份另含所有方案、图片、测量、路线、问题、说明及固定版本。

## 开发和测试

需要 Node.js 22.13+，生产使用 Node.js 25；先 `npm ci`。

```sh
npm run build:studio
# 准备私有 XIAN_DATA_DIR/initial-project.json；见 server/README.md
XIAN_COOKIE_SECURE=false node server/index.mjs

npx tsc --noEmit
npm run test:measurements
npm run test:project
npm run test:spatial
npm run test:server
```

`npm run test:studio` 仅接受本机测试服务，**会修改测试项目**。通过环境变量指定私有测试凭据及 Playwright/Chrome 路径；不要指向正式项目。浏览器测试包含编辑、保存、冲突、查看权限、导出及移动端模拟。

正式构建在 `dist-studio`，基路径 `/xian-home/`；服务器只监听 `127.0.0.1:18892`，由同域 Nginx 转发。数据库、会话、口令和备份不放入构建或仓库；授权公开的当前方案附件仅进入独立的 Pages 发布分支，不进入源码分支。每日自动完整备份保留 7 份，详见服务说明。

## 当前对话修改项目

GPT 与网页使用同一个服务 API。先读取最新版本，再提交含方案 ID、基础版本和唯一操作 ID 的操作文件：

```sh
XIAN_URL=https://jmryqyx.cn/xian-home XIAN_CREDENTIALS=/private/credentials.json node scripts/studio-project.mjs get /private/latest.json
XIAN_URL=https://jmryqyx.cn/xian-home XIAN_CREDENTIALS=/private/credentials.json node scripts/studio-project.mjs apply /private/operation.json
```

凭据从私人文件读取，不写入前端。此工作台不新增内置聊天框，也不把几何三维称为写实效果图。

## 家人查看版发布

```sh
FAMILY_SOURCE_URL=https://jmryqyx.cn/xian-home/ FAMILY_CREDENTIALS_FILE=/private/credentials.json npm run build:family
npm run preview:pages
npm run deploy:pages
```

Pages 的 `gh-pages` 分支包含只读程序、当前方案以及关联附件，直接加载本地发布文件，无需访问 Mac Studio API。完整性校验及版本复核通过后才发布；`deployment.json` 记录源码版本、方案版本、发布时间。`build:pages` 单独运行仅编译界面，发布前还必须成功导出 family 数据。`?legacy=1` 保留旧版浏览器数据迁移。

Mac Studio 通过 `XIAN_PUBLIC_VIEW=true` 开启匿名只读，管理 API 保持认证。关闭该环境变量可恢复原口令模式。原 Sites 源码保留兼容历史，两个正式入口均不依赖 Sites。

验证：`node scripts/test-public-server.mjs`、`npm run test:family-export`；只读浏览器验证使用 `node scripts/test-family-browser.mjs --url <入口>`，GitHub 另加 `--static`，断开全部 API 验证独立运行。手机测试包括微信 UA 模拟，不等同于实体微信客户端实测。

正式文字使用微软雅黑；PDF 嵌入字体，DXF 指定相应文字样式。项目中的字体用于本项目网页及文档，不授予独立字体再分发许可。
