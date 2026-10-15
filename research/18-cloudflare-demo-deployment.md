# Cloudflare 临时演示部署与验收

日期：2026-10-12。用户决定现阶段使用云端演示，后续租服务器运行。已完成部署；不是依赖本机的 Quick Tunnel。

## 访问地址与资源

- 推荐入口：[Campus Atlas](https://campus-atlas-demo.pages.dev/?city=london&listing=london-2)。固定项目域名，不随每次发布改变。
- Worker：`campus-atlas-demo`，业务 API、HTML 渲染和 Agent 在 Cloudflare 执行。
- Pages：`campus-atlas-demo`，图片、地图资源与数据文件直接分发；HTML/API 和 `/_next/static/*` 脚本样式通过内部 service binding 访问同一份 Worker 发布。框架资源读取失败时再尝试 Pages 自带副本，避免 Worker 已更新、Pages 尚未更新时脚本 404。细节见 [脚本加载修复](script-loading-reliability.md)。
- D1：`campus-atlas-demo`，APAC 区域，绑定名 `ATLAS_DB`，保存匿名会话、配额和成功路线缓存。未上传旧本地聊天数据库。
- Worker 当前版本：`bf5a157c-24a5-4d79-a2a4-745f6c99519e`；Pages 当前发布：`a1001dac`。本次更新增加只读健康接口，监控申请与激活边界见 [邮件监控说明](19-uptime-monitoring.md)；原始部署验收版本为 Worker `d5ba898c-5a39-47e7-8e24-23c967a64cfb`、Pages `c4b84ce7`。

电脑关机、开发服务退出不会停止这些云资源。项目没有设置自动过期删除，但仍受账号、平台政策、配额及外部数据服务可用性影响，不承诺永久无限或零故障。

最初发布的 `workers.dev` 域名从当前网络连接超时；因此增加 Pages 入口并完成其验收。部分早期静态文件请求也曾超时，随后五城完整检查通过；这不是对所有地区网络可达性或长期延迟的保证。优先分享固定 `pages.dev` 地址。

## 实现

共享会话逻辑改为异步 SQL 接口：Node 继续使用 SQLite，Worker 使用 D1。版本比较与处理租约防止并发、旧请求覆盖新状态；配额使用单条条件 UPSERT，跨实例生效。模型和地图工具、超时提示、原消息重试仍沿用原有实现。

设施及校园路线在 Cloudflare 构建时验证并导入，避免依赖本地文件系统。Worker 的 TypeScript 路径配置独立于 Node；构建检查防止误带 `node:sqlite` 或泄漏模型密钥。实时 OSRM 路线的每日配额与 1.1 秒调用间隔写入共享数据库，成功结果缓存 24 小时；相同实例内的相同请求共享正在执行的计算。

三项模型配置经用户明确授权上传为 Worker Secrets，未放入客户端或 Git。地图仍使用浏览器可见的 Cesium 只读配置，不改模型供应商，不自动启用付费套餐。

## 已验证

可复核摘要见 [验收 JSON](evidence/hosting/cloudflare-acceptance-2026-10-12.json)。

| 范围 | 证据 |
| --- | --- |
| 原有业务 | 8 项 Agent 回归通过，覆盖多轮工具、隔离、并发、超时、停止与重试 |
| 真实 D1 本地运行时 | 3 项测试通过：隔离与并发写、原子限额、重启后会话及缓存恢复 |
| Markdown 与路线 | 3 项 Markdown 测试及路线几何、缓存、去重、上游限流检查通过 |
| 两种运行方式 | Node 生产构建及 HTTP 页面/SQLite/工具恢复通过；Worker 生产构建通过 |
| 发布包 | 模型密钥泄漏 0，Worker SQLite 导入 0，D1 适配存在 |
| 五城公网接口 | 五城会话、便利店工具、校园路线工具、刷新恢复、设施与路线静态文件通过；跨站请求及跨城市输入被拒绝，匿名会话隔离通过 |
| 伦敦公网浏览器 | Chapter House 查询 500 米内便利店：回复 14 家，地图显示 14 处；追问最近一家：Sainsbury's Local，直线 77 米，地图仅显示 1 处 |
| 真实设施路线 | 第三轮“走过去怎么走”：OSRM 路线 119 米、约 2 分钟、3 段指引，地图与回复一致 |
| 实景及持久化 | Pages 域名下伦敦纹理三维建筑可见；刷新后上述三轮对话、地点选择与步行路线恢复 |

尚未进行负载测试、Worker CPU 分位指标采集，或其他四城真实模型及三维浏览器复验。不能以少量成功请求承诺高并发或免费 CPU 始终足够。吉隆坡原有实景覆盖限制、虚构房源和设施快照边界仍适用。

## 更新部署

在 `app/` 运行；地图配置保留在 `.env.local`，服务端模型配置保留在 `.env.agent.local`：

```sh
npx wrangler login
npm run db:cloudflare:remote
npm run build:cloudflare
npm run deploy:cloudflare
npm run secrets:cloudflare
npm run deploy:pages
```

首次换账号时，需要自行创建 D1/Pages 项目，更新 `cloudflare/wrangler.jsonc` 的 D1 ID。Worker 更名后同步 `cloudflare/pages/wrangler.jsonc` 的 service binding 与部署脚本。普通更新无需重建数据库。

API 检查器：`node scripts/verify-deployment.mjs https://campus-atlas-demo.pages.dev --storage=D1`。加 `--model` 会实际调用当前模型两轮及公共路线服务，会消耗相应额度；默认检查不调用模型。

`deploy:pages` 结束时自动执行 `verify:assets`：检查首页、登录页、配置页和详情页的 HTML，以及本次构建的全部 JavaScript/CSS（包括懒加载模块）的状态码、类型和内容哈希；检查失败时命令以非零状态结束。它不回滚已经发布的版本，也不替代浏览器首次打开与交互验收。

## 后续迁到服务器

保留 Node.js 22.13+、原有 Dockerfile、SQLite 适配及启动脚本。把源码、地图配置及服务端模型配置放到服务器，构建并启动：

```sh
npm ci
npm run build
npm run start -- --port 3000
```

数据库默认 `.data/rental-chat.sqlite`，应挂持久磁盘并备份；配置反向代理、HTTPS 和进程管理。Node 与 Cloudflare 构建共用 `dist/`，迁移前重做 Node 构建。若需要带走云端历史，再单独导出 D1、备份并验证导入 SQLite，不能假定历史自动同步。仅使用新服务器和空会话时不需要迁移云端历史。

Cloudflare、Cesium/Google、公共 OSRM 的免费条件见 [托管调研](17-long-term-free-hosting.md)。模型依旧按原供应商计费；当前演示的全局 AI 限额为滚动 24 小时 100 轮，每个匿名浏览器每分钟 6 轮。
