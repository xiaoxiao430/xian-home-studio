# 自有域名地区可达性实测（2026-10-07）

正式入口：[西安空间工作台](https://jmryqyx.cn/xian-home/)

## 实测结论

本次 18 次远端公开资源请求中，16 次通过 HTTP 状态、响应类型及正文前缀核对，2 次未通过。全部失败及复测保留如下；不能宣称所有网络稳定可用。

## 方法与边界

- 使用 [Globalping 官方 API](https://globalping.io/docs/api.globalping.io) 实际远端探针，未使用开发电脑出口代替地区测试。
- 测试时间为 2026-10-07 23:37:14 至 2026-10-07 23:38:25，UTC+8。
- 首页先选定 6 个探针，其余资源与失败复测使用测量 ID 28d3Xy7u0EnpkDKBz00021H1l 复用同一批探针。
- 本轮远端只请求公开登录页与最终版本主 JavaScript；没有向平台提供口令、Cookie、分享口令、私有方案或照片。
- 每次 HTTPS 请求采用默认 DNS 解析、443 端口、30 秒超时；没有固定 IP 或绕过失败线路。
- GET 检查 HTTP 200、Content-Type 及正文前 180 字符，与正式远端资源比对，防止把拦截页的 200 当作成功。原始响应正文可能被平台截断。
- 这不是中国大陆或新加坡实体手机的登录浏览器测试，平台不执行 JavaScript、不验证三维渲染或私有数据登录；实际功能验收另行进行。
- 结果仅代表这些时刻和探针，不保证所有移动网络、地区或未来时段。

## 正式资源及证据

| 资源 | 方法 / 路径 | 首测报告 |
| --- | --- | --- |
| 登录页 | GET /xian-home/ | [公开报告](https://globalping.io/?measurement=28d3Xy7u0EnpkDKBz00021H1l) · [原始 JSON](https://api.globalping.io/v1/measurements/28d3Xy7u0EnpkDKBz00021H1l) |
| 主 JavaScript | GET /xian-home/assets/index-DbGJmBi7.js | [公开报告](https://globalping.io/?measurement=2HgyvwqREcLzfyJfs00021H1l) · [原始 JSON](https://api.globalping.io/v1/measurements/2HgyvwqREcLzfyJfs00021H1l) |

## 首轮完整结果

| 地区 / 城市 / 网络 | ASN | 登录页 | 主 JavaScript |
| --- | --- | --- | --- |
| 中国大陆 / Nanjing / Chinanet Backbone | AS4134 | 200 / 534 ms | 200 / 362 ms |
| 中国大陆 / Shanghai / China Unicom Shanghai network | AS17621 | 200 / 91 ms | 200 / 83 ms |
| 中国大陆 / Shanghai / China Mobile Communications Group | AS9808 | 200 / 210 ms | 200 / 183 ms |
| 新加坡 / Singapore / MobileOne Ltd. Mobile/Internet Service Provider Singapore | AS4773 | 200 / 2609 ms | 200 / 891 ms |
| 新加坡 / Singapore / ViewQwest | AS18106 | 无 HTTP / 30001 ms / 未通过 | 200 / 11083 ms |
| 新加坡 / Singapore / MYREPUBLIC | AS56300 | 200 / 3146 ms | 200 / 866 ms |

## 失败与复测

首轮失败保留，不以复测覆盖。
- 登录页第 2 轮：[公开报告](https://globalping.io/?measurement=2VUZxukJtJQkyLHqX00021H1m)，5/6 通过。
- homepage 第 1 轮，Singapore AS18106：Request timed out during the TLS handshake.；HTTP 未返回，远端 218.64.194.16。
- homepage 第 2 轮，Nanjing AS4134：The measurement timed out during DNS resolution.；HTTP 未返回，远端 未知。

## 连接阶段核对

两次失败均发生在HTTP响应之前。ViewQwest首轮DNS约911 ms、TCP约19493 ms，TLS未完成；复测首页200但总时长16220 ms，其中TLS约11050 ms。南京第二轮停在DNS阶段，未取得解析IP；同一节点首轮首页534 ms、JS362 ms成功。

成功解析的探针都访问218.64.194.16，未发现指向不同服务器的记录。没有本轮403或应用报错证据，也不能仅凭这些探针区分跨境链路、解析器、中间设备或服务端连接层原因。

## 原始记录

全部请求、返回报告、正文前缀与汇总保存在 [network-checks/2026-10-07-master-suite-final](network-checks/2026-10-07-master-suite-final)。公开测量链接可能受平台历史保留策略影响，因此同时保留仓库归档。
