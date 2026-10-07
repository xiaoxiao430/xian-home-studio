# 西安的家 · 两层空间工作台

正式入口：[jmryqyx.cn/xian-home](https://jmryqyx.cn/xian-home/)，需要访问口令。GitHub 保存程序代码；两层方案、私人照片、原图和分享版本存放在独立服务的数据目录。

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

[GitHub Pages 旧入口](https://xiaoxiao430.github.io/xian-home-studio/) 保留本机数据导出和旧编辑器。使用原来编辑过的浏览器，导出两层布局和 IndexedDB 全部参考图片，再在新版“分享与备份”导入。导入另存为方案，现有 A/B 保留。

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

正式构建在 `dist-studio`，基路径 `/xian-home/`；服务器只监听 `127.0.0.1:18892`，由同域 Nginx 转发。原图、照片、数据库、会话、口令和备份都不放入构建或仓库。每日自动完整备份保留 7 份，详见服务说明。

## 当前对话修改项目

GPT 与网页使用同一个服务 API。先读取最新版本，再提交含方案 ID、基础版本和唯一操作 ID 的操作文件：

```sh
XIAN_URL=https://jmryqyx.cn/xian-home XIAN_CREDENTIALS=/private/credentials.json node scripts/studio-project.mjs get /private/latest.json
XIAN_URL=https://jmryqyx.cn/xian-home XIAN_CREDENTIALS=/private/credentials.json node scripts/studio-project.mjs apply /private/operation.json
```

凭据从私人文件读取，不写入前端。此工作台不新增内置聊天框，也不把几何三维称为写实效果图。

## 旧入口发布

```sh
npm run build:pages
npm run preview:pages
npm run deploy:pages
```

Pages 的 `gh-pages` 分支只存迁移入口及此前已公开的旧版程序。`deployment.json` 记录源码版本。独立服务的构建、Node 服务和 SQLite 与 Pages 分离，旧 Sites 源码作为兼容历史保留，新工作台不向其发请求。

正式文字使用微软雅黑；PDF 嵌入字体，DXF 指定相应文字样式。项目中的字体用于本项目网页及文档，不授予独立字体再分发许可。
