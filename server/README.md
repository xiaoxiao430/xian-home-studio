# 西安空间工作台私有服务

本服务只监听 `127.0.0.1`。静态程序可公开；项目、参考图、现场照片、快照、会话和完整备份均存放在独立数据目录，不进入静态发布目录或 Git。

需要 Node.js 22.13+（建议使用项目提供的 Node.js 24）。生产优先读取预构建的 `server/model.cjs`，因此运行时无需安装 esbuild。开发环境缺少该文件时，通过 esbuild 将统一的 `lib/project-model.ts` 编译到私有数据目录 `.runtime`；两者都沿用同一模型校验。

## 启动

先将初始方案 JSON 放入数据目录的 `initial-project.json`，然后运行：

```sh
node server/index.mjs
```

环境配置：

| 变量 | 默认 / 用途 |
| --- | --- |
| `XIAN_DATA_DIR` | `~/Library/Application Support/XianHomeStudio`，目录权限 700 |
| `XIAN_SEED_PATH` | 数据目录中的 `initial-project.json`，仅首次初始化读取 |
| `XIAN_DIST_DIR` | 仓库中的 `dist-studio`，只包含无私有数据的前端 |
| `XIAN_PORT` | `18892`，仅监听 127.0.0.1 |
| `XIAN_BASE_PATH` | `/xian-home` |
| `XIAN_PUBLIC_ORIGIN` | 公网 HTTPS 入口的完整 origin；反向代理上线时必须配置以核对修改请求来源 |
| `XIAN_PUBLIC_VIEW` | 默认 `false`；显式设为 `true` 后，家庭入口免口令读取当前项目与其附件，修改及备份仍需管理登录 |
| `XIAN_COOKIE_SECURE` | 默认为 `true`；仅本机 HTTP 调试可设置 `false` |
| `XIAN_MAX_PROJECT_BYTES` | 默认 340 MiB；当前项目及全部固定版本所引用原件的总量限制 |
| `XIAN_MAX_RESTORE_BYTES` | 默认 480 MiB；完整 JSON 恢复包大小限制 |
| `XIAN_OWNER_PASSWORD` | 可选，仅首次初始化设置管理口令，至少 12 字符；否则自动随机生成 |

首次随机管理口令只写入数据目录的 `owner-credentials.txt`（JSON，600 权限），不会写入 stdout。SQLite 保存 scrypt 哈希，不保存口令明文。管理员从受信任的本机或 SSH 读取该文件，使用口令登录；不要把该文件或 Cookie 放到 GitHub 或前端配置中。

后端不提供 CORS。公网入口应将前端与 `/xian-home/api` 通过同一个 HTTPS origin 反向代理到本服务。GitHub Pages 本身不能保护直接下载的项目文件或图片；公开入口不得包含私有 seed、照片或明文项目 JSON。

## 接口约定

API 前缀为 `XIAN_BASE_PATH + /api`。请求与响应均为 JSON，除附件上传 / 下载外。修改请求需使用同源请求；登录使用 HttpOnly、SameSite=Strict 会话 Cookie。

- `GET /session` → `{role:'owner'|'viewer'|null,shareId?,publicView?}`。开启家庭入口且无有效会话时，返回 `{role:'viewer',publicView:true}`，无需 Cookie。
- `POST /session`，`{password,shareId?}`；不传 `shareId` 为管理登录，传入为独立快照口令。
- `DELETE /session` 退出。
- `GET /project` → `{project,revision,role,shareId?,label?,publicView?}`。家庭查看者得到最新当前项目及实际 revision，附 `publicView:true`；持有原快照会话的查看者仍得到固定快照。
- `PUT /project`，`{project,baseRevision,operationId}` → 更新包络。
- `POST /operations`，`{operation,baseRevision,operationId}` → 通过统一 `applyOperation` 更新。
- `POST /snapshots`，`{label,baseRevision}` → `{id,label,revision,createdAt,url,password}`。独立查看口令只在创建时返回。
- `GET /snapshots` → `{items:[{id,label,revision,createdAt,url}]}`，仅管理者可读，不返回口令或哈希。
- `POST /assets` 原始二进制，`Content-Type` 为实际类型；`x-file-name` 为 URI 编码文件名，`x-asset-meta` 为 URI 编码 JSON 元数据。返回 `{asset,project,revision,role}`，自动将附件加入项目并增加 revision。
- `GET /assets/:id`、`GET /assets/:id/thumbnail`（也支持 `HEAD`）受当前项目或快照附件白名单保护。家庭入口仅能读取当前项目引用的附件，不能读取仅历史快照引用或已移除的附件。thumbnail 使用 macOS sips 生成最长边 1200 像素的 JPEG（包含 HEIC 转 JPEG），保存于私有缩略图目录。转换失败时才返回原件，并附 `X-Preview-Fallback: original`；非图片不提供该预览路径。
- `GET /backup` → `{format:'xian-home-backup',version:1,exportedAt,revision,project,snapshots,files:[{id,name,mime,size,sha256,data}]}`，`data` 为 base64。`snapshots` 含固定版本、原分享 ID、口令哈希及附件白名单，不包含会话或管理口令；files 同时包含固定版本仍引用的历史原件。
- `POST /restore`，`{backup,baseRevision,operationId}`，全量校验后恢复；先留存恢复前的完整备份，旧快照的附件保留。可在新服务器恢复固定版本及原分享口令；已有相同 ID 的固定版本若内容不同则拒绝恢复，避免旧链接改变含义。
- `GET /backups` 返回自动备份状态与清单；`GET /backups/YYYY-MM-DD` 下载指定每日备份；`POST /backups`（JSON `{}`）立即更新当天备份，均仅管理者可用。
- `GET /health` 只返回服务状态与接口版本。

固定分享页面须在 `/session`、`/project` 和附件读取请求中一致传入 `?share=<id>`。指定分享 ID 时必须持有该快照的有效查看会话或管理会话；未登录、失效或不匹配的会话不会回退到公共当前项目。管理者通过带 share 的读取请求也只读取该固定快照。开启家庭入口不会取消管理员口令，不创建可写的匿名会话，也不会开放快照列表、备份、恢复或附件上传。关闭 `XIAN_PUBLIC_VIEW` 并重启即可恢复原来的口令访问要求。

`operationId` 使用唯一随机字符串（UUID 可用）。同一 ID 重复提交同一请求返回原结果并附 `replayed:true`；使用同一 ID 提交不同内容返回 409。版本冲突返回 409 及当前 `revision`，调用方应重新读取并合并，不能盲目覆盖。

上传文件上限 32 MiB，仅允许 PNG、JPEG、WebP、PDF、HEIC、JSON，并核对内容签名。当前项目及全部固定版本原件总量默认 340 MiB，恢复 JSON 包默认 480 MiB，控制在 Node.js 单字符串容量附近。可通过环境配置调整，但提高配置并不能消除 JavaScript 大字符串限制，超大资料库应使用后续分卷或流式备份。已发布快照引用的原件仍保留并计入容量。项目与附件内容校验失败均不会覆盖当前项目。

已下载的明文导出文件不受后续查看口令控制，应只发给授权接收者；离线长期转存应使用加密备份。服务备份接口本身依靠管理员会话和 HTTPS 传输保护，不声称提供文件级加密。

## 自动备份与本机恢复

服务按北京时间每日生成一份完整备份，启动后补当天备份，每小时检查日期；恢复成功后也会更新当天副本。文件保存在私有数据目录 `automatic-backups`，以 600 权限原子写入，仅保留最近 7 份。不上传到 GitHub 或第三方。自动备份内容与手动完整备份相同，包含固定版本及其仍引用的原件。

从本机或 SSH 恢复（服务需正在运行）：

```sh
node server/restore-backup.mjs /absolute/path/to/backup.json
```

该命令从私有文件读取管理口令，不在终端显示。恢复前自动保存当前完整备份；网络结果不明确时会保留 `.restore-attempt.json`，再次运行同一备份会沿用 operationId 与原 baseRevision，避免重复覆盖。

## 测试

```sh
node scripts/test-server.mjs
node scripts/test-public-server.mjs
```

设置 `XIAN_TEST_REAL_ASSETS_DIR` 为原资料文件夹，可追加全部真实资料上传、缩略图及恢复验证；可选 `XIAN_TEST_BACKUP_OUTPUT` 将通过校验的完整备份保存到指定私人路径（600 权限）。

测试使用临时数据目录和随机本机端口，覆盖登录、只读权限、快照附件隔离、并发版本与重复提交、不可变快照、完整恢复、恢复失败不覆盖、路径隔离、CSRF、口令限速。不会使用真实项目口令，不会向公网发布。
