# GitHub Pages 地区可达性实测记录（2026-10-05）

正式网址：https://xiaoxiao430.github.io/xian-home-studio/

## 结论

本次真实地区探测中，新加坡 M1、ViewQwest、MyRepublic 三个运营商节点的首页、主 JavaScript、通道路由 Worker 和字体请求均返回 HTTP 200。中国大陆西安电信/联通、广州电信、上海联通、北京移动及补充的无锡移动样本也完成上述四项 HTTP 200 检查。

**上海移动 AS9808 存在可复现的异常：首轮主页返回 200，但主 JavaScript、Worker 和字体的 TCP 连接均在 30 秒后超时；随后串行复测这三项仍超时，复测主页则返回 200。** 因此，本次结果支持“新加坡和多个中国大陆网络实测可达”，不支持“所有中国大陆网络稳定可用”。不能仅凭首页 200 就认为整个编辑器在该节点可用。

本报告保留全部首轮失败与复测结果；未通过固定远端 IP、改 DNS 或代理绕过来生成通过结果。需要所有大陆网络更稳定时，仍需补充适合大陆访问的服务器或自有域名入口，并重新实测。

## 方法与范围

- 工具：Globalping 公共 API，使用平台实际位于中国大陆及新加坡的远端探针，不是仅在开发电脑出口访问。节点城市、网络、ASN 采用探测平台返回的 metadata。
- 首轮使用 9 个探针：中国大陆 6 个，覆盖电信、联通、移动；新加坡 3 个本地运营商。补充检查无锡移动 1 个探针。
- 首轮四类资源复用同一组探针；上海移动及无锡移动各自的后续检查复用单节点测量 ID，串行执行。
- 使用系统默认解析，HTTPS 443，单请求超时 30 秒。GET 的返回正文前缀分别确认为应用 HTML、JavaScript 及 Worker，非 403/拦截页面。
- 字体采用 HEAD，只验证状态与响应头，不表示下载完整的约 8 MB 字体文件。Globalping 不执行浏览器 JavaScript；功能和手机排版测试属于另行浏览器验收。
- 这些是特定时段、节点和运营商的抽样，不能外推至每个地区、手机网络或未来所有时段。
- 正式测量共 44 次请求：38 次 HTTP 200、6 次 TCP 超时；部署前线路基线的 404 不纳入此统计。
- 记录时间：2026-10-05 11:30:13 至 2026-10-05 11:37:47，以下全部为 UTC+8（中国/新加坡时间）。

官方接口说明：https://globalping.io/docs/api.globalping.io

## 测试路径与首轮公开报告

| 对象 | 请求方式与路径 | 发起时间（UTC+8） | 证据 |
| --- | --- | --- | --- |
| 首页 | `GET /xian-home-studio/` | 2026-10-05 11:30:14 | [公开报告](https://globalping.io/?measurement=2EM9Uha9NSqFygHTj00021G5a) · [原始 JSON](https://api.globalping.io/v1/measurements/2EM9Uha9NSqFygHTj00021G5a) |
| 主 JavaScript | `GET /xian-home-studio/assets/index-BvamD62s.js` | 2026-10-05 11:30:13 | [公开报告](https://globalping.io/?measurement=2BEmbZezIneKxepLj00021G5a) · [原始 JSON](https://api.globalping.io/v1/measurements/2BEmbZezIneKxepLj00021G5a) |
| 通道路由 Worker | `GET /xian-home-studio/route-worker.js` | 2026-10-05 11:30:14 | [公开报告](https://globalping.io/?measurement=2oeHqobOTdZ5SnDDi00021G5a) · [原始 JSON](https://api.globalping.io/v1/measurements/2oeHqobOTdZ5SnDDi00021G5a) |
| 微软雅黑字体 | `HEAD /xian-home-studio/fonts/yahei-full.woff2` | 2026-10-05 11:30:14 | [公开报告](https://globalping.io/?measurement=2h5tH9PXiCJjaqI1k00021G5a) · [原始 JSON](https://api.globalping.io/v1/measurements/2h5tH9PXiCJjaqI1k00021G5a) |

## 首轮各节点完整结果

单元格依次为：**HTTP 状态或错误 / 请求耗时 / 实际远端 IP**。TCP 超时没有收到 HTTP 状态码。

| 节点与运营商 | ASN | 首页 GET | 主 JS GET | Worker GET | 字体 HEAD |
| --- | --- | --- | --- | --- | --- |
| 中国大陆 · 西安 · 中国电信 | AS4134 | 200 / 532 ms / 185.199.108.153 | 200 / 384 ms / 185.199.108.153 | 200 / 452 ms / 185.199.108.153 | 200 / 715 ms / 185.199.108.153 |
| 中国大陆 · 西安 · 中国联通 | AS4837 | 200 / 749 ms / 185.199.110.153 | 200 / 813 ms / 185.199.111.153 | 200 / 765 ms / 185.199.108.153 | 200 / 1081 ms / 185.199.108.153 |
| 中国大陆 · 广州 · 中国电信 | AS4134 | 200 / 366 ms / 185.199.110.153 | 200 / 382 ms / 185.199.111.153 | 200 / 472 ms / 185.199.108.153 | 200 / 700 ms / 185.199.111.153 |
| 中国大陆 · 上海 · 中国联通 | AS17621 | 200 / 891 ms / 185.199.108.153 | 200 / 883 ms / 185.199.108.153 | 200 / 887 ms / 185.199.110.153 | 200 / 983 ms / 185.199.108.153 |
| 中国大陆 · 上海 · 中国移动 | AS9808 | 200 / 327 ms / 185.199.109.153 | TCP 超时 / 29999 ms / 185.199.110.153 | TCP 超时 / 30001 ms / 185.199.110.153 | TCP 超时 / 30000 ms / 185.199.110.153 |
| 中国大陆 · 北京 · 中国移动 | AS56048 | 200 / 290 ms / 185.199.108.153 | 200 / 319 ms / 185.199.108.153 | 200 / 337 ms / 185.199.109.153 | 200 / 1607 ms / 185.199.109.153 |
| 新加坡 · M1 (MobileOne) | AS4773 | 200 / 254 ms / 185.199.109.153 | 200 / 304 ms / 185.199.108.153 | 200 / 283 ms / 185.199.111.153 | 200 / 1594 ms / 185.199.110.153 |
| 新加坡 · ViewQwest | AS18106 | 200 / 260 ms / 185.199.108.153 | 200 / 285 ms / 185.199.109.153 | 200 / 276 ms / 185.199.109.153 | 200 / 1583 ms / 185.199.110.153 |
| 新加坡 · MyRepublic | AS56300 | 200 / 226 ms / 185.199.108.153 | 200 / 284 ms / 185.199.108.153 | 200 / 308 ms / 185.199.108.153 | 200 / 1545 ms / 185.199.108.153 |

## 上海移动串行复测（AS9808）

以下复测采用上海移动节点，后续三项使用首项测量 ID 复用同一探针。首轮异常全部保留在上一表中。

| 对象 | 发起时间（UTC+8） | HTTP 状态或错误 / 耗时 / 远端 IP | 证据 |
| --- | --- | --- | --- |
| 主 JS GET | 2026-10-05 11:31:07 | TCP 超时 / 30002 ms / 185.199.110.153 | [公开报告](https://globalping.io/?measurement=2UqasKYclwybb3Udm00021G5b) · [原始 JSON](https://api.globalping.io/v1/measurements/2UqasKYclwybb3Udm00021G5b) |
| Worker GET | 2026-10-05 11:31:51 | TCP 超时 / 30000 ms / 185.199.108.153 | [公开报告](https://globalping.io/?measurement=2q358uQtaOrcl828D00021G5b) · [原始 JSON](https://api.globalping.io/v1/measurements/2q358uQtaOrcl828D00021G5b) |
| 字体 HEAD | 2026-10-05 11:32:23 | TCP 超时 / 30001 ms / 185.199.108.153 | [公开报告](https://globalping.io/?measurement=2WUJrm4GbOoz7jkbQ00021G5c) · [原始 JSON](https://api.globalping.io/v1/measurements/2WUJrm4GbOoz7jkbQ00021G5c) |
| 首页 GET | 2026-10-05 11:32:56 | 200 / 1000 ms / 185.199.111.153 | [公开报告](https://globalping.io/?measurement=2uPGL1KYlrxMyx8rl00021G5c) · [原始 JSON](https://api.globalping.io/v1/measurements/2uPGL1KYlrxMyx8rl00021G5c) |

超时原文为 `Request timed out while establishing the TCP connection.`。首轮失败远端均为 `185.199.110.153`；串行复测还在 `185.199.108.153` 上失败，不能仅归因于一个 IP。两次主页成功分别连接 `185.199.109.153` 和 `185.199.111.153`。这是线路/连接层面的观测，尚不能从抽样独立确定运营商策略或其他根因。

## 无锡移动对照（AS56046）

为判断是否所有移动网络均失败，补充同一无锡移动探针的四项检查，均返回 HTTP 200。该结果不抵消上海移动的失败。

| 对象 | 发起时间（UTC+8） | HTTP 状态 / 耗时 / 远端 IP | 证据 |
| --- | --- | --- | --- |
| 主 JS GET | 2026-10-05 11:31:59 | 200 / 600 ms / 185.199.109.153 | [公开报告](https://globalping.io/?measurement=2Z3L7whMpXkAhHmz000021G5b) · [原始 JSON](https://api.globalping.io/v1/measurements/2Z3L7whMpXkAhHmz000021G5b) |
| Worker GET | 2026-10-05 11:37:34 | 200 / 2512 ms / 185.199.110.153 | [公开报告](https://globalping.io/?measurement=2oPlv44hAiglIWZvt00021G5h) · [原始 JSON](https://api.globalping.io/v1/measurements/2oPlv44hAiglIWZvt00021G5h) |
| 字体 HEAD | 2026-10-05 11:37:40 | 200 / 463 ms / 185.199.110.153 | [公开报告](https://globalping.io/?measurement=2K41CtPq5O0H3O7MN00021G5h) · [原始 JSON](https://api.globalping.io/v1/measurements/2K41CtPq5O0H3O7MN00021G5h) |
| 首页 GET | 2026-10-05 11:37:43 | 200 / 2951 ms / 185.199.110.153 | [公开报告](https://globalping.io/?measurement=2gtfMXICbjiFi6MwT00021G5h) · [原始 JSON](https://api.globalping.io/v1/measurements/2gtfMXICbjiFi6MwT00021G5h) |

## 可复核原始记录

各公开报告链接均对应本次实际请求。原始响应包含探针城市、ASN、网络、解析 IP、状态码、HTTP 头、耗时及错误文本；仓库归档位于 [network-checks/2026-10-05](network-checks/2026-10-05)，包含 `*-report.json`、`*-request.json` 及便于阅读的 `*-summary.json`。公开平台的历史保留策略可能变化，交付报告与原始 JSON 应一并保留。

## 浏览器功能验收

另在未登录浏览器中直接访问正式网址，验证两层切换、拖动净距更新、刷新恢复、固定尺寸、自定义尺寸、通道 Worker、手机尺寸视口，以及 PDF/SVG/DXF/CSV 导出；参考图本机上传、备注、刷新恢复、删除及任务打包通过。网络请求记录未出现 OpenAI Sites、ChatGPT 或后端 API 依赖。PDF 检查确认嵌入 Microsoft YaHei；DXF 重新读入为毫米且审计无错误。浏览器功能验收不等同于当地实体手机全流程测试。

部署源码：`7a97ff156016ab78aec6b749e49e2511349e52ed`；Pages 分支：`9788802d36ac5aef6d59c43343fa1e993c633bbe`。
