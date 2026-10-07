# 自有域名地区可达性实测（2026-10-07）

正式入口：[西安空间工作台](https://jmryqyx.cn/xian-home/)

## 实测结论

本次 30 次远端公开资源请求中，28 次通过 HTTP 状态、响应类型及正文前缀核对，2 次未通过。全部失败及复测保留如下；不能宣称所有网络稳定可用。

## 方法与边界

- 使用 [Globalping 官方 API](https://globalping.io/docs/api.globalping.io) 实际远端探针，未使用开发电脑出口代替地区测试。
- 测试时间为 2026-10-07 23:15:37 至 2026-10-07 23:17:08，UTC+8。
- 首页先选定 5 个探针，其余资源与失败复测使用测量 ID 28fzndI3iFfUadCFv00021H1P 复用同一批探针。
- 只请求公开登录页、公开 JavaScript、通道 Worker、字体 HEAD 与三维模块；没有向平台提供口令、Cookie、分享口令、私有方案或照片。
- 每次 HTTPS 请求采用默认 DNS 解析、443 端口、30 秒超时；没有固定 IP 或绕过失败线路。
- GET 检查 HTTP 200、Content-Type 及正文前 180 字符，与正式远端资源比对，防止把拦截页的 200 当作成功。原始响应正文可能被平台截断。
- 字体使用 HEAD，只证明状态和响应头可达，不代表完整字体已下载。
- 这不是中国大陆或新加坡实体手机的登录浏览器测试，平台不执行 JavaScript、不验证三维渲染或私有数据登录；实际功能验收另行进行。
- 结果仅代表这些时刻和探针，不保证所有移动网络、地区或未来时段。

## 正式资源及证据

| 资源 | 方法 / 路径 | 首测报告 |
| --- | --- | --- |
| 登录页 | GET /xian-home/ | [公开报告](https://globalping.io/?measurement=28fzndI3iFfUadCFv00021H1P) · [原始 JSON](https://api.globalping.io/v1/measurements/28fzndI3iFfUadCFv00021H1P) |
| 主 JavaScript | GET /xian-home/assets/index-YPI5bBJs.js | [公开报告](https://globalping.io/?measurement=2UuazeGOnvQUvCBvC00021H1P) · [原始 JSON](https://api.globalping.io/v1/measurements/2UuazeGOnvQUvCBvC00021H1P) |
| 通道 Worker | GET /xian-home/route-worker.js | [公开报告](https://globalping.io/?measurement=2LM9DFVkEWLf6yXeI00021H1P) · [原始 JSON](https://api.globalping.io/v1/measurements/2LM9DFVkEWLf6yXeI00021H1P) |
| 微软雅黑字体 HEAD | HEAD /xian-home/fonts/yahei-full.woff2 | [公开报告](https://globalping.io/?measurement=2EjTvXst8gruq8nEf00021H1Q) · [原始 JSON](https://api.globalping.io/v1/measurements/2EjTvXst8gruq8nEf00021H1Q) |
| 三维模块 | GET /xian-home/assets/three.module-DlqJz16g.js | [公开报告](https://globalping.io/?measurement=2FZyS60SoUNgLhNbo00021H1Q) · [原始 JSON](https://api.globalping.io/v1/measurements/2FZyS60SoUNgLhNbo00021H1Q) |

## 首轮完整结果

| 地区 / 城市 / 网络 | ASN | 登录页 | 主 JS | Worker | 字体 HEAD | 三维模块 |
| --- | --- | --- | --- | --- | --- | --- |
| 中国大陆 / Shanghai / China Unicom Shanghai network | AS17621 | 200 / 110 ms | 200 / 84 ms | 200 / 76 ms | 200 / 79 ms | 200 / 86 ms |
| 中国大陆 / Shanghai / China Mobile Communications Group | AS9808 | 200 / 230 ms | 200 / 162 ms | 200 / 166 ms | 200 / 172 ms | 200 / 153 ms |
| 新加坡 / Singapore / MobileOne Ltd. Mobile/Internet Service Provider Singapore | AS4773 | 200 / 4586 ms | 200 / 4311 ms | 200 / 918 ms | 200 / 878 ms | 200 / 906 ms |
| 新加坡 / Singapore / ViewQwest | AS18106 | 200 / 3824 ms | 200 / 543 ms | 无 HTTP / 30001 ms / 未通过 | 200 / 512 ms | 200 / 11268 ms |
| 新加坡 / Singapore / MYREPUBLIC | AS56300 | 200 / 974 ms | 200 / 906 ms | 200 / 868 ms | 200 / 875 ms | 200 / 2693 ms |

## 失败与复测

首轮失败保留，不以复测覆盖。
- 通道 Worker第 2 轮：[公开报告](https://globalping.io/?measurement=23P47piwx9QUsu74s00021H1Q)，4/5 通过。
- worker 第 1 轮，Singapore AS18106：Request timed out while waiting for the first response byte.；HTTP 未返回，远端 218.64.194.16。
- worker 第 2 轮，Singapore AS18106：Request timed out while waiting for the first response byte.；HTTP 未返回，远端 218.64.194.16。

## 原始记录

全部请求、返回报告、正文前缀与汇总保存在 [network-checks/2026-10-07](network-checks/2026-10-07)。公开测量链接可能受平台历史保留策略影响，因此同时保留仓库归档。
