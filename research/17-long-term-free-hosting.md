# 长期免费公网托管调研

核对日期：2026-10-12。目标：让别人通过固定网址持续访问五城租房样本，关闭开发者电脑后仍能使用实景地图、AI 多轮对话、设施查询和真实步行路线。

初轮完成官方资料核对和适配分析，代码基线为 `main` / `a360a24f30ce60a40402535772d302f7c515143a`。随后用户选择以 Cloudflare 作为临时演示环境，已完成 Worker + D1 和 Pages 入口部署；实际地址与验收见 [18-cloudflare-demo-deployment.md](18-cloudflare-demo-deployment.md)。下文保留当时的候选比较，不代表仍待用户选择。

## 建议

**个人、非商业演示优先考虑 Vercel Hobby + Neon Free。** 它们有持续免费套餐，不是短期试用；网址和后端由云端托管，电脑关机后仍可访问。需要先增加 Vinext 的 Nitro 部署适配，并把本地 SQLite 改为云端 PostgreSQL。额度以内可以长期保留，但不能承诺永久免费或永不故障。[Vercel Hobby](https://vercel.com/docs/plans/hobby)、[Neon 价格页](https://neon.com/pricing)

**如果项目用于商业推广或运营，则不能默认使用 Vercel Hobby。** 官方将销售产品或服务的广告等也列为商业使用，并非只有收款才算。此时优先验证 Cloudflare Workers + D1 免费版；如果 AI 工具计算超过其免费 CPU 限制，需优化或选择付费运行环境。[Vercel 公平使用规则](https://vercel.com/docs/limits/fair-use-guidelines)

选择 Vercel 是针对当前演示需求的工程判断，尚不是云端运行验收结果。Cloudflare 与现有框架的原生集成更直接，但免费版 CPU 余量对本应用更值得关注。

## 为什么临时网址不够用

目前 Quick Tunnel 把公网请求转发到本机 Node 服务。电脑睡眠或关机、网络断开、隧道或应用进程退出，都会使访问失败；托管平台则在云端运行应用。旧方案和历史验收见 [09-temporary-sharing.md](09-temporary-sharing.md)。

迁云能去掉本机依赖，不能单独解决模型供应商超时、地图额度耗尽或访客网络无法连接第三方服务等问题；这些仍需分别观察。

## 候选方案

| 方案 | 持续免费条件及访问特征 | 对当前项目的影响 | 判断 |
| --- | --- | --- | --- |
| Vercel Hobby + Neon Free | 个人非商业用途、用量以内；平台提供域名。函数和数据库可能冷启动 | 增加 Nitro；云端数据库；核对静态数据打包与 SSE | 个人演示首选候选 |
| Cloudflare Workers Free + D1 | 每天 10 万次动态请求，单次 10 ms CPU；静态资源请求免费。无需保活本机 | 原生 Vinext 部署路径；迁 D1；适配文件读取；测 CPU | 免费备选，必须先做工具流实测 |
| Render Free | 闲置 15 分钟后休眠，唤醒约一分钟；免费实例不能挂持久盘 | Node/Docker 较容易接入，但仍需外置数据库 | 不适合追求随时打开的分享体验 |
| Koyeb Free | 闲置一小时后缩到零；免费实例不支持持久卷 | 可运行 Node，但需外置数据库和冷启动验收 | 次选，不优先投入 |
| Railway Free | 试用后每月 $1 使用额度，不是无限资源 | 接近现有 Node/容器方式；要核算实际常驻资源 | 不能据此承诺全天运行免费 |
| Oracle Always Free VM | 有持续免费资源，但闲置实例可能被回收，创建也受资源供应影响 | 可沿用 Node + SQLite + 持久盘；自行运维和备份 | 代码改动少，运维和回收风险更高 |

表中费用、休眠与资源事实来自：[Vercel](https://vercel.com/docs/plans/hobby)、[Neon](https://neon.com/pricing)、[Workers](https://developers.cloudflare.com/workers/platform/pricing/)、[Render](https://render.com/docs/free)、[Koyeb](https://www.koyeb.com/docs/reference/instances)、[Railway](https://docs.railway.com/pricing/free-trial)、[Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)。适合程度为结合本仓库的判断，未逐一部署测试。

单独把页面放到 GitHub Pages 或其他静态托管，不能运行本项目的服务器 Agent 和会话存储；只迁前端、后端仍在本机，也不能实现这次目标。

## Vercel + Neon 的具体适配

### 构建与函数

当前虽然使用 Next.js API，但实际构建器是 Vinext/Vite，`npm run build` 走 `scripts/run-framework.mjs`，输出 `dist/`，并非标准 `next build`。不能按“普通 Next.js 项目导入即可”判断完成。

Vinext 官方提供 `vinext()` + `nitro()` 的 Vite 插件组合，Nitro 支持 Vercel，因而**不需要先重写现有页面和地图**。需要选择与当前依赖兼容的 Nitro 版本，生成平台需要的构建输出，并验证项目自有构建插件、Cesium 资源复制以及 API 路由。[Vinext 官方部署说明](https://github.com/cloudflare/vinext#other-platforms-via-nitro)、[Nitro Vercel 说明](https://nitro.build/deploy/providers/vercel)

Vercel 项目 Root Directory 应设为 `app`。具体 Build Command / Output Directory 以适配后生成的输出为准，不能直接把现有 `dist/` 当成只有静态文件的网站发布。

Hobby 的 Node 函数在 Fluid compute 下默认和最大时长均为 300 秒，流式响应也计入总时长。本项目 Agent 自设 90 秒截止时间，平台时长本身不是直接阻塞项；仍需在实际生成的函数上核对配置、SSE 首包与中断处理。[函数限制](https://vercel.com/docs/functions/limitations)

### 会话存储

`lib/agent/store.ts` 使用 `node:sqlite` 写 `.data/rental-chat.sqlite`，其中保存会话、版本号、处理租约、配额和路线缓存。Vercel 函数没有适合作为这个共享数据库的永久本地文件存储；把数据库搬到 `/tmp` 不能解决持久化和多实例一致性。[Vercel SQLite 说明](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)

迁移需要把同步 SQL 改成异步 PostgreSQL 存储层，同时保留：

- 按匿名访客与城市隔离会话，刷新恢复历史消息和地图状态。
- 版本条件更新和处理租约，防止重复请求及旧请求覆盖新一轮状态。
- 原子配额扣减、失败状态与原消息重试，不能仅迁移聊天文字。
- 路线缓存；跨实例的外部路线请求节流，替换目前只在单进程内有效的 `pending` / `lastRequest`。

Neon 当前官方价格页和套餐文档均列出：Free 每项目 100 CU-hours/月、1 GB PostgreSQL 存储、5 GB 公网传输；闲置 5 分钟暂停计算，下一次查询需唤醒。计算暂停不等于删除数据库。计算或流量额度耗尽会暂停计算至下个周期或升级；存储上限会阻止增加存储的操作。[价格页](https://neon.com/pricing)、[套餐文档](https://neon.com/docs/introduction/plans)

注意：检索到的较早官方文章仍写 0.5 GB；本报告采用本轮直接读取的当前价格页与套餐文档的 1 GB，并在证据清单中记录差异。创建账户时仍应复核控制台。

### 地图、文件与配置

地图主要在浏览器运行，可以继续使用 Cesium 和现有地图工具协议。需要把 Cesium 的静态脚本、Workers、纹理、照片和公共 JSON 正确发布；当前 `public/cesium` 约 22 MB，应由静态资源服务承担，不要强行塞进 Agent 函数。

`lib/agent/catalog.ts` 从 `process.cwd()/public/amenities` 和 `public/routes` 读取数据，需要确认 Nitro 输出包含这些服务器读取的文件，或改成明确的构建期数据导入。仅看到浏览器能下载 JSON，不能证明函数端读取也成功。

服务端模型配置迁到平台环境变量：`ATLAS_AI_BASE_URL`、`ATLAS_AI_MODEL`、`ATLAS_AI_API_KEY`，并确认接口可从云环境访问。实际密钥与本地聊天数据库继续排除在 Git 之外。地图 token 按现有 `VITE_` 构建期配置处理，它本来就是浏览器可见的凭据，应检查上线域名限制和最小权限。

## Cloudflare 免费方案的边界

Vinext 的原生部署目标是 Workers；项目已有条件开启的 Cloudflare Vite 插件，但现有本地 binding 配置并不等于已完成生产部署。还要配置真实 D1 binding、迁移脚本和运行入口。[Cloudflare 框架指南](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

Workers Free 的 **10 ms 是 CPU 执行时间，不是模型等待时间**。HTTP 请求在客户端保持连接时可持续流式响应，但解析数据、设施距离计算、排序、消息序列化和 SSR 都会消耗 CPU。不能用“每天只有几个访客”推断每次请求必然达标。需要记录实际 Workers 的 CPU 指标并验证冷实例与多轮工具请求。[CPU 与持续时间限制](https://developers.cloudflare.com/workers/platform/limits/)

D1 Free 为每日 500 万行读、10 万行写，账户共 5 GB，**单库最大 500 MB**；行读是扫描行数，不能当作 API 请求数。超出读写额度后查询会报错，需等待重置或升级。[D1 计费](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 限制](https://developers.cloudflare.com/d1/platform/limits/)

Workers 的 `node:sqlite` 兼容项是 stub，不能把当前 SQLite 文件数据库直接搬过去。`node:fs` 的虚拟文件系统也是内存型，不能当成永久数据库目录。迁 D1 还需保持事务、版本检查和配额的语义；设施和路线文件可以通过静态资源 binding 或构建期导入适配。[兼容说明](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#enable-nodesqlite-module)、[文件系统](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)

如果免费 CPU 不够，Workers Paid 当前从 $5/月起，另外按超额使用计费；这是低成本后续方案，不计入“完全免费”的承诺。[官方价格](https://developers.cloudflare.com/workers/platform/pricing/)

### 是否可以全部使用 Cloudflare 免费分享

2026-10-12 补充核对：**网站、业务 API 和聊天数据库都可以放在 Cloudflare，使用 Workers Static Assets + Workers + D1，迁移后不再依赖开发者电脑，也不必额外使用 Vercel 或 Neon。** 静态资源直接命中时请求免费且无限，SSR/API 执行仍受 Workers 免费额度和 CPU 限制；不能把所有访问都当作静态资源。[静态资源计费](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

AI 推理也有 Cloudflare 选项：Workers AI 当前每天提供 10,000 Neurons 免费额度。这是算力量，不是 10,000 条消息；消耗随模型、输入历史、输出长度和工具调用轮次变化。免费计划超额后调用失败，部分模型要求付费方式，不能把整个模型目录都算作免费。是否能满足本项目的中文多轮和地图工具调用，需要另行测试，不能假定替换模型后效果相同。[Workers AI 计费](https://developers.cloudflare.com/workers-ai/platform/pricing/)

如果保留用户目前配置的 OpenAI 兼容接口，其费用仍由原供应商计算，Cloudflare 托管不会免除它的费用。若严格要求所有数据服务也来自 Cloudflare，则当前样本不满足：实景建筑来自 Cesium/Google，实时设施路线来自外部 OSRM。Cloudflare 可以托管我们的代码、地点快照和已有路线文件，但不能替代这些服务的数据与许可。

因此，**小规模演示可以把“Cloudflare 托管费用为零”作为验证目标；完整保留实景和实时路线时，不能承诺“所有服务均为 Cloudflare、永久无限免费”。** 最先应验证免费 Worker 的真实工具流 CPU 和 D1 会话持久化。保留当前模型还是测试 Workers AI，是独立选项，本轮未切换任何配置。

## 网站免费与外部服务费用分开

- **AI**：当前调用用户配置的 OpenAI 兼容接口。免费网页托管不会赠送该供应商的模型额度；公开分享要沿用并验证服务端配额。
- **实景三维**：Cesium ion Community 当前包含 Google Photorealistic 3D Tiles 每月 1,000 次 root tiles、15 GB/月 streaming；不是 1,000 位用户。其个人/评估适用范围和商业条件需要单独满足。[Cesium 价格与 FAQ](https://cesium.com/platform/cesium-ion/pricing/)
- **路线**：现有实时设施路线调用外部公共 OSRM 服务。迁云后仍受该服务可用性影响；本轮不把它视为已验证的生产保障。
- **域名**：可以先用平台分配的 `vercel.app` / `workers.dev` 地址，独立域名另行购买。保留项目的固定访问地址即可，无需每次构建换链接。[Vercel 域名](https://vercel.com/docs/domains/working-with-domains)、[Workers 域名](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## 建议实施顺序与验收

1. 明确演示用途是否符合 Vercel Hobby；符合则选 Vercel + Neon，否则先验证 Workers + D1。
2. 抽出异步存储接口，迁移会话、配额、路线缓存及并发控制。使用测试数据验证，旧本地聊天记录是否迁移单独决定。
3. 接入平台构建输出、服务器环境变量和静态资源；经授权后再创建云资源和发布。
4. 用公网地址验证真实模型的“预算及通勤筛选 → 附近便利店计数 → 地图设施 → 步行路线”多轮流程，验证超时重试和刷新恢复。
5. 关闭本机开发服务与隧道，换另一台设备访问同一网址；闲置后再次访问，检查首屏、数据库唤醒、实景加载、会话保留及额度指标。确认公开网址无需访客登录托管平台。

完成以上公网验收后，才能报告“已脱离本机、可长期分享”。本轮仅完成方案调研，不把官方支持列表或本地构建通过当成该结果。

主要来源、关键额度与直接抓取记录见 [hosting-sources.json](evidence/hosting/hosting-sources.json)。
