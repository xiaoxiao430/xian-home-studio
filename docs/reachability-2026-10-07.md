# 自有域名地区可达性实测（2026-10-07）

正式入口：[西安空间工作台](https://jmryqyx.cn/xian-home/)

## 当前构建结论

**最终构建的登录页与主 JavaScript，已在中国大陆 6 个节点（电信、联通、移动各 2 座城市）和新加坡 M1、ViewQwest、MyRepublic 3 个节点取得 HTTP 200，并通过响应类型与正文前缀核对。** 当前主脚本为 `index-BxpMhwyC.js`。通道 Worker、字体、三维模块文件未随最后补丁改变，沿用本次较早的同文件测量证据。

全部历史共 86 条平台结果：82 次实际网络请求中 81 次通过、1 次首字节等待超时；另外 4 条是原广州探针离线，未发起网站请求。唯一网站请求失败发生在首次构建的新加坡 ViewQwest 主 JS，原节点复测成功，最终构建的两项测量也成功。原失败与离线记录全部保留。结果支持这些地区样本可达，不保证每条线路长期稳定。

测量时段：2026-10-07 17:44:41 至 2026-10-07 17:53:08，UTC+8。

## 当前资源与最终构建证据

| 对象 | 方法 / 当前路径 | 证据与版本 |
| --- | --- | --- |
| 登录页 | GET `/xian-home/` | [公开报告](https://globalping.io/?measurement=2M0oVzQgsyMffTmgc00021GwB) · [原始 JSON](https://api.globalping.io/v1/measurements/2M0oVzQgsyMffTmgc00021GwB)；最终构建 |
| 主 JavaScript | GET `/xian-home/assets/index-BxpMhwyC.js` | [公开报告](https://globalping.io/?measurement=2GKrPFvFaOA8ToBqW00021GwB) · [原始 JSON](https://api.globalping.io/v1/measurements/2GKrPFvFaOA8ToBqW00021GwB)；最终构建 |
| 通道 Worker | GET `/xian-home/route-worker.js` | [公开报告](https://globalping.io/?measurement=29yz7BAeSKoOzCukO00021Gw5) · [原始 JSON](https://api.globalping.io/v1/measurements/29yz7BAeSKoOzCukO00021Gw5)；文件未改变，较早测量 |
| 微软雅黑字体 HEAD | HEAD `/xian-home/fonts/yahei-full.woff2` | [公开报告](https://globalping.io/?measurement=2rpxaDf9Y2Tq6QnwU00021Gw5) · [原始 JSON](https://api.globalping.io/v1/measurements/2rpxaDf9Y2Tq6QnwU00021Gw5)；文件未改变，较早测量 |
| 三维模块 | GET `/xian-home/assets/three.module-DlqJz16g.js` | [公开报告](https://globalping.io/?measurement=2zK44iEKBV6eYTmL600021Gw5) · [原始 JSON](https://api.globalping.io/v1/measurements/2zK44iEKBV6eYTmL600021Gw5)；文件未改变，较早测量 |

当前首页／主 JS 的其他节点证据：
- 南京电信与长沙联通：[公开报告](https://globalping.io/?measurement=2LNST0rmu4epGYB8v00021GwB) · [原始 JSON](https://api.globalping.io/v1/measurements/2LNST0rmu4epGYB8v00021GwB)（首页）；[公开报告](https://globalping.io/?measurement=2GxWEN5nFabigueIO00021GwC) · [原始 JSON](https://api.globalping.io/v1/measurements/2GxWEN5nFabigueIO00021GwC)（主 JS）。
- 广州电信重新选择兼容探针：[公开报告](https://globalping.io/?measurement=2PSAI85H4Z1dqSjyp00021GwD) · [原始 JSON](https://api.globalping.io/v1/measurements/2PSAI85H4Z1dqSjyp00021GwD)（首页）；[公开报告](https://globalping.io/?measurement=2rDLQ1DgLplMygbPy00021GwD) · [原始 JSON](https://api.globalping.io/v1/measurements/2rDLQ1DgLplMygbPy00021GwD)（主 JS）。

## 最终构建：九个地区与运营商样本

| 地区 / 城市 / 网络 | ASN | 登录页 | 当前主 JS |
| --- | --- | --- | --- |
| 中国大陆 / Shanghai / China Unicom Shanghai network | AS17621 | 200 / 93 ms | 200 / 114 ms |
| 中国大陆 / Shanghai / China Mobile Communications Group | AS9808 | 200 / 158 ms | 200 / 169 ms |
| 中国大陆 / Beijing / China Mobile Communicaitons | AS56048 | 200 / 179 ms | 200 / 268 ms |
| 新加坡 / Singapore / MobileOne Ltd. Mobile/Internet Service Provider Singapore | AS4773 | 200 / 1854 ms | 200 / 1428 ms |
| 新加坡 / Singapore / ViewQwest | AS18106 | 200 / 5873 ms | 200 / 5553 ms |
| 新加坡 / Singapore / MYREPUBLIC | AS56300 | 200 / 874 ms | 200 / 846 ms |
| 中国大陆 / Nanjing / Chinanet Backbone | AS4134 | 200 / 691 ms | 200 / 633 ms |
| 中国大陆 / Changsha / CHINA UNICOM China169 Backbone | AS4837 | 200 / 112 ms | 200 / 73 ms |
| 中国大陆 / Guangzhou / Chinanet Backbone | AS4134 | 200 / 117 ms | 200 / 92 ms |

南京电信节点带有平台 `datacenter-network` 标签，其余所选节点带有 `eyeball-network` 标签。运营商、城市和 ASN 均取自 Globalping 元数据，不代表这些城市每个家庭或手机网络均已测试。

## 构建变化与历史结果

首次构建主脚本是 `index-BrmKRX89.js`。PDF 剪裁及复制对象分组修复发布后，主脚本变为 `index-BxpMhwyC.js`；旧文件已移除。首次构建的 52 次实际请求完整保留，其中 51 次通过、1 次超时。随后复用原已成功节点检查新版首页和主 JS，不把旧脚本结果当作新版结果。

| 首次构建对象 | 原始证据 |
| --- | --- |
| 登录页 | [公开报告](https://globalping.io/?measurement=2mVET0lS24YgJk09a00021Gw4) · [原始 JSON](https://api.globalping.io/v1/measurements/2mVET0lS24YgJk09a00021Gw4) |
| 主 JavaScript | [公开报告](https://globalping.io/?measurement=2gyJNrTLdQ1Idzw8000021Gw4) · [原始 JSON](https://api.globalping.io/v1/measurements/2gyJNrTLdQ1Idzw8000021Gw4) |
| 通道 Worker | [公开报告](https://globalping.io/?measurement=29yz7BAeSKoOzCukO00021Gw5) · [原始 JSON](https://api.globalping.io/v1/measurements/29yz7BAeSKoOzCukO00021Gw5) |
| 微软雅黑字体 HEAD | [公开报告](https://globalping.io/?measurement=2rpxaDf9Y2Tq6QnwU00021Gw5) · [原始 JSON](https://api.globalping.io/v1/measurements/2rpxaDf9Y2Tq6QnwU00021Gw5) |
| 三维模块 | [公开报告](https://globalping.io/?measurement=2zK44iEKBV6eYTmL600021Gw5) · [原始 JSON](https://api.globalping.io/v1/measurements/2zK44iEKBV6eYTmL600021Gw5) |

首次补充的南京／长沙五类资源均通过，见 [10 次补充原始记录](network-checks/2026-10-07/alternate)。

## 失败、离线与未分配探针

- **首次 ViewQwest 超时：** 新加坡 AS18106 获取旧主 JS 时，30,001 ms 内未收到首字节（`Request timed out while waiting for the first response byte.`）。证据：[公开报告](https://globalping.io/?measurement=2gyJNrTLdQ1Idzw8000021Gw4) · [原始 JSON](https://api.globalping.io/v1/measurements/2gyJNrTLdQ1Idzw8000021Gw4)。复用同组探针后 7/7 成功：[公开报告](https://globalping.io/?measurement=24ZHOVacEy1p48mPc00021Gw5) · [原始 JSON](https://api.globalping.io/v1/measurements/24ZHOVacEy1p48mPc00021Gw5)。最终新版首页与主 JS 也成功。
- **最终构建广州旧探针离线：** 平台先后为首页与主 JS 的首测、复测返回 `This probe is currently offline. Please try again later.`，共 4 条。这不是网站返回错误。随后重新按广州 AS4134 选择兼容探针，两个新版资源均通过；没有把离线结果抹掉。
  - 登录页第 1 轮：[公开报告](https://globalping.io/?measurement=2M0oVzQgsyMffTmgc00021GwB) · [原始 JSON](https://api.globalping.io/v1/measurements/2M0oVzQgsyMffTmgc00021GwB)。
  - 主 JavaScript第 1 轮：[公开报告](https://globalping.io/?measurement=2GKrPFvFaOA8ToBqW00021GwB) · [原始 JSON](https://api.globalping.io/v1/measurements/2GKrPFvFaOA8ToBqW00021GwB)。
  - 登录页第 2 轮：[公开报告](https://globalping.io/?measurement=25KbeFVT6q7ZHKiou00021GwB) · [原始 JSON](https://api.globalping.io/v1/measurements/25KbeFVT6q7ZHKiou00021GwB)。
  - 主 JavaScript第 2 轮：[公开报告](https://globalping.io/?measurement=2RnqRASFPXt0bPfUI00021GwC) · [原始 JSON](https://api.globalping.io/v1/measurements/2RnqRASFPXt0bPfUI00021GwC)。
- **西安／武汉未分配：** 平台在申请西安电信、武汉联通时返回 `No matching IPv4 probes available.`。见 [422 原始请求记录](network-checks/2026-10-07/supplement/homepage-request.json)。未计入实际网站请求，也不声称已验证西安或武汉；用南京电信、长沙联通补足第二城市样本。

## 方法、权限与验证范围

- 使用 [Globalping 官方 API](https://globalping.io/docs/api.globalping.io) 的真实远端探针，不是仅在开发电脑出口测试。首组后续资源复用首测 ID `2mVET0lS24YgJk09a00021Gw4`；南京／长沙组复用 `2JnaacYBJm3WWCntC00021Gw8`。最终构建也由这两组原探针开始复测，广州离线后另选同城同 ASN 的兼容探针。
- 仅请求公开登录 HTML、公开 JS、Worker、字体 HEAD 和三维模块。未向第三方提交任何口令、Cookie、分享链接查询参数、私有方案、照片或个人资料。
- HTTPS 443、默认 DNS、每次 30 秒超时；不固定 IP 或绕过失败线路。GET 对照正式远端文件的正文前 180 字符及 Content-Type，避免把 200 拦截页误认成应用；保留原始正文前缀及平台返回的截断标记。
- 字体 HEAD 只验证状态与响应头，不能代替完整字体下载。Globalping 不执行 JavaScript，不能证明当地手机已经登录、载入私人布局或成功渲染三维。功能、私有权限与手机页面另由浏览器验收。
- 所有首轮失败、离线、复测及平台未分配记录均保留；结论只针对该时段与节点，不外推至全部地区或未来每个时段。

## 原始归档

完整请求、响应、正文前缀、两个构建的资源清单，以及分类总计见 [network-checks/2026-10-07](network-checks/2026-10-07)，总汇为 [combined-results.json](network-checks/2026-10-07/combined-results.json)。公开报告可能受平台历史保留策略影响，因此同时保留仓库副本。
