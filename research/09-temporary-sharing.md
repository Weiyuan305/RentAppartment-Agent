# 临时公网分享（2026-10-08）

2026-10-12 补充：下文记录的是依赖本机运行的临时隧道方案。关闭电脑后仍可访问的托管选择及当前 Agent / SQLite 适配要求，见 [长期免费公网托管调研](17-long-term-free-hosting.md)。

用户希望让别人临时查看当前样本。现有 Vinext / Cloudflare 构建可以沿用；本轮选择构建版本地服务加 Cloudflare Quick Tunnel，避免为一次演示迁移框架。

## 当前状态

- 构建版服务在 `http://127.0.0.1:5175`，与 5174 开发预览分开。
- 已在构建版浏览器中检查房源筛选、详情弹层、进入完整详情页、返回相应城市并选中房源。
- 已从构建版加载伦敦实景三维并保留返回详情页的选中房源；[待分享版本截图](evidence/live-3d/share-ready.jpg)。新公网来源的地图权限仍待生成地址后确认。
- 发现 Vinext 生产构建客户端路由报 `RSC prefetch setup error` / `TypeError: ... is not a function`。样本的跨页面链接改为普通文档导航后，重启构建版服务并实测跳转成功。
- TypeScript 和生产构建通过；定向 ESLint 无错误，参考照片使用 img 的建议仍保留。
- 用户已明确确认公开临时演示及其中浏览器可见的 Cesium token，随后建立隧道。
- 公网地址：<https://provides-restrict-fall-cir.trycloudflare.com/?city=london>，于北京时间 2026-10-08 20:38 左右启动。HTTP 200；浏览器已从该来源加载伦敦实景三维建筑，并完成房源弹层 → 完整详情 → 返回城市并选中 Chapter House 的流程。
- [公网验收截图](evidence/live-3d/share-public.jpg)。本轮浏览器未发现警告或错误。其他城市的三维覆盖范围沿用五城验证记录；未因发布而宣称吉隆坡已有完整实景建筑。
- 网站、隧道及 caffeinate 均为独立后台进程，已观察到父进程为 PID 1，启动命令退出后仍在运行；macOS 的 `PreventUserIdleSystemSleep` 断言已生效。

## 分享方式

[Cloudflare Quick Tunnels 官方说明](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)：无需账号或域名，生成随机 `trycloudflare.com` 地址。没有固定的几分钟或几小时到期时间，也没有可用性保证；持有链接的人可以访问，隧道进程停止后地址失效。重新创建隧道会换地址。

本次不设置自动关闭时间，结束对话不会主动停止后台进程。演示期间阻止电脑因空闲而休眠，隧道停止后该防休眠进程也会退出。电脑关机、重启、合盖休眠或断网仍会中断访问；这不等于不依赖电脑的云端部署。

本地运行构建版：

```sh
npm run build
npm run start -- --port 5175
```

已有构建和已校验的 cloudflared 后，在 `rentApartment/app` 运行分享管理脚本：

```sh
node scripts/share-preview.mjs status
node scripts/share-preview.mjs reload
node scripts/share-preview.mjs stop
node scripts/share-preview.mjs start
```

`status` 查看地址及三个进程状态；构建后运行 `reload` 只重启网站服务，保留当前隧道地址；`stop` 结束该脚本创建的进程并恢复普通空闲休眠行为；`start` 在没有运行中的分享时创建新链接，使用 HTTP/2 连接隧道。脚本记录进程启动时间和命令，停止前核对身份，避免误停重用 PID 的其他程序。日志和状态均在被忽略的 `app/.sites-runtime/share-preview/` 下；不提交客户端 token、运行日志或工具二进制。

官方工具完整性：使用 [Cloudflare 2026.10.0 发布](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.0) 的 macOS arm64 文件。下载压缩包 SHA256 为 `a2f79ff7b9420aa537d74af239f376da170bbabeb529aec416002adac6a72e70`，与官方 GitHub asset digest 相符；解压程序 SHA256 为 `72edfd3eea463aef4d5cb89e2e209cecb048cc756c2b01915de2e0ad7cb39830`，与发布正文相符。Wrangler 自动安装器误将后者用于压缩包校验而失败；分别验证两者后使用原版程序，未关闭 TLS 或跳过摘要核验。工具位于 `app/.sites-runtime/bin/cloudflared-2026.10.0`，启动脚本每次启动仍核对程序摘要。

不转发 5174 开发服务器。通过正常构建服务提供页面和资源，不开放源代码目录、环境文件或调试端口。

地图 token 仍是客户端凭证，访问者可读取并消耗其地图额度；应使用只读资产权限。本次生成的公网来源已经实测可加载地图，未改动 token 权限。以后若新地址不在 token 的 Allowed URLs 中，需要在 Cesium 官方控制台配置该来源。

若希望电脑关闭后仍可访问，可另部署到 Cloudflare Workers。当前构建已采用 Cloudflare Vite 插件，部署仍需确认账号、项目和地图来源配置，不能把本地构建通过等同于部署成功。
