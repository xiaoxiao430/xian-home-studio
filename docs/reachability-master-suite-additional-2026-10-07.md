# 自有域名地区可达性实测（2026-10-07）

正式入口：[西安空间工作台](https://jmryqyx.cn/xian-home/)

## 实测结论

本次 15 次远端公开资源请求全部通过 HTTP 状态与响应类型核对；GET 资源正文前缀也与正式版本一致。中国大陆和新加坡所选样本均能取得这些公开资源。

## 方法与边界

- 使用 [Globalping 官方 API](https://globalping.io/docs/api.globalping.io) 实际远端探针，未使用开发电脑出口代替地区测试。
- 测试时间为 2026-10-07 23:19:11 至 2026-10-07 23:20:04，UTC+8。
- 首页先选定 3 个探针，其余资源与失败复测使用测量 ID 2KQQsy0YpilCbfhrz00021H1T 复用同一批探针。
- 只请求公开登录页、公开 JavaScript、通道 Worker、字体 HEAD 与三维模块；没有向平台提供口令、Cookie、分享口令、私有方案或照片。
- 每次 HTTPS 请求采用默认 DNS 解析、443 端口、30 秒超时；没有固定 IP 或绕过失败线路。
- GET 检查 HTTP 200、Content-Type 及正文前 180 字符，与正式远端资源比对，防止把拦截页的 200 当作成功。原始响应正文可能被平台截断。
- 字体使用 HEAD，只证明状态和响应头可达，不代表完整字体已下载。
- 这不是中国大陆或新加坡实体手机的登录浏览器测试，平台不执行 JavaScript、不验证三维渲染或私有数据登录；实际功能验收另行进行。
- 结果仅代表这些时刻和探针，不保证所有移动网络、地区或未来时段。

## 正式资源及证据

| 资源 | 方法 / 路径 | 首测报告 |
| --- | --- | --- |
| 登录页 | GET /xian-home/ | [公开报告](https://globalping.io/?measurement=2KQQsy0YpilCbfhrz00021H1T) · [原始 JSON](https://api.globalping.io/v1/measurements/2KQQsy0YpilCbfhrz00021H1T) |
| 主 JavaScript | GET /xian-home/assets/index-YPI5bBJs.js | [公开报告](https://globalping.io/?measurement=2eed4tMc0oIS0NvyX00021H1T) · [原始 JSON](https://api.globalping.io/v1/measurements/2eed4tMc0oIS0NvyX00021H1T) |
| 通道 Worker | GET /xian-home/route-worker.js | [公开报告](https://globalping.io/?measurement=2hO5xeJBqyEaHiQYB00021H1T) · [原始 JSON](https://api.globalping.io/v1/measurements/2hO5xeJBqyEaHiQYB00021H1T) |
| 微软雅黑字体 HEAD | HEAD /xian-home/fonts/yahei-full.woff2 | [公开报告](https://globalping.io/?measurement=2Ip2OhgPK0b8Nw9Zp00021H1T) · [原始 JSON](https://api.globalping.io/v1/measurements/2Ip2OhgPK0b8Nw9Zp00021H1T) |
| 三维模块 | GET /xian-home/assets/three.module-DlqJz16g.js | [公开报告](https://globalping.io/?measurement=2hnXUcpK9AEW8rUXs00021H1T) · [原始 JSON](https://api.globalping.io/v1/measurements/2hnXUcpK9AEW8rUXs00021H1T) |

## 首轮完整结果

| 地区 / 城市 / 网络 | ASN | 登录页 | 主 JS | Worker | 字体 HEAD | 三维模块 |
| --- | --- | --- | --- | --- | --- | --- |
| 中国大陆 / Nanjing / Chinanet Backbone | AS4134 | 200 / 6299 ms | 200 / 662 ms | 200 / 3550 ms | 200 / 3258 ms | 200 / 395 ms |
| 中国大陆 / Guilin / China Telecom | AS4134 | 200 / 194 ms | 200 / 170 ms | 200 / 181 ms | 200 / 114 ms | 200 / 154 ms |
| 新加坡 / Singapore / ViewQwest | AS18106 | 200 / 3833 ms | 200 / 8189 ms | 200 / 1380 ms | 200 / 2682 ms | 200 / 15412 ms |

## 失败与复测

本次没有失败请求，因此没有额外复测。

## 原始记录

全部请求、返回报告、正文前缀与汇总保存在 [network-checks/2026-10-07](network-checks/2026-10-07)。公开测量链接可能受平台历史保留策略影响，因此同时保留仓库归档。
