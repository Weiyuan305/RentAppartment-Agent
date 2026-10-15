# 首次访问脚本加载失败：排查与修复

## 已验证的故障机制

2026-10-15 的浏览器曾报告 `Failed to fetch dynamically imported module`，目标为 `/_next/static/chunks/layout-segment-context-bCObbqiV.js`。当时失败请求的完整响应没有保留下来；后来直接请求该脚本已是 HTTP 200，因此不能把那一次请求的具体状态码当作已知事实。

通过上一份 Pages 发布 `d7d913e7.campus-atlas-demo.pages.dev` 可以稳定复现发布版本错配：

- 首页 HTTP 200，HTML 来自当前 Worker，并引用 `index-DiHwxDNW.js`、`layout-segment-context-bCObbqiV.js` 等新版模块。
- 同一入口请求 `layout-segment-context-bCObbqiV.js` 返回 HTTP 404；当前 Pages 主域名则返回 HTTP 200、正确 JavaScript MIME。
- 原 `_routes.json` 只让 HTML/API 经过 Worker，脚本直接读取该 Pages 发布的静态快照。先更新 Worker、后更新 Pages 的间隔必然存在“新 HTML + 旧脚本库”，旧发布入口也会持续复现。
- 当前 HTML 已使用 `Cache-Control: no-store, must-revalidate`，不存在需要靠全面禁用资源缓存解决的问题。

这是已复现、已修复的发布链路缺陷，符合此前发布后刷新恢复的症状；不能据此把所有网络断连、地图供应商失败都归为这一原因。

## 修改

1. `/_next/static/*` 交给 Pages 入口转发到与 HTML 相同的 Worker。Worker 显式绑定并提供自身的 `ASSETS`，避免静态路径落到 SSR 的 HTML 错误页。
2. Worker 资源不存在、类型不对或读取失败时，尝试当前 Pages 发布的本地副本；这也照顾 Worker 刚切换、仍打开旧页面的用户。
3. 两边都不可用时返回不缓存的 404/503，拒绝把 HTML 当作 JavaScript/CSS 长期缓存。正常资源仍保留原缓存语义。响应头 `X-Atlas-Asset-Source` 标识 `worker` 或 `pages-fallback`，便于诊断。
4. API、登录、聊天流原样转发，不重试 POST、不缓存私有响应；界面和业务功能不变。
5. Pages 发布命令增加完整构建资源检查；健康接口正常不再是前端发布成功的唯一依据。

## 验证与边界

- 回归测试覆盖新 Worker/旧 Pages、旧模块回退、资源读取异常、HTML 错误响应、聊天流与 Cookie 透传，以及发布检查器识别缺失懒加载文件、错误类型、错误内容和旧 HTML。
- 使用本地 Cloudflare 运行时验证真实 Worker 静态资源和 service binding。当前 Miniflare 多资源目录共用 `assets:storage` 磁盘服务；测试仅将旧 Pages 副本建模为独立 fetch 服务，避免把模拟器目录冲突误判为生产行为。
- 本地生产构建检查 4 个 HTML 路由与 33 个 JS/CSS 文件；本地浏览器首次进入后可切换语言。该环境未配置生产模型密钥和完整 D1 数据，云端 API 与首次访问仍需发布后验收。
- Pages 函数现在会接收框架资源请求，计入现有 Workers/Pages Functions 请求额度；图片、Cesium 文件、路线数据继续走直接静态分发。未开通新付费服务。
- 回退只保证仍存在于当前 Worker 或当前 Pages 的文件可读，不承诺永久保存任意历史发布的所有懒加载模块；断网或额度耗尽也无法靠本修复消除。

官方参考：[Worker 代码与静态资产共同发布](https://developers.cloudflare.com/workers/static-assets/)、[资源绑定](https://developers.cloudflare.com/workers/static-assets/binding/)、[请求计费边界](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)。
