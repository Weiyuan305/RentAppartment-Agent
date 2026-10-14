# 演示网站故障邮件监控

日期：2026-10-12。监控由 UptimeRobot 云端执行，不依赖本机，也不额外租服务器。使用免费套餐的 5 分钟检查；邮件通知收件地址由用户在当前会话提供，不写入源码和 Git。

## 检查范围

1. 网站首页：`https://campus-atlas-demo.pages.dev/`，检查入口能否返回成功状态。
2. 后端健康接口：`https://campus-atlas-demo.pages.dev/api/health`，检查 D1 是否可访问、三个业务表是否存在、模型配置是否完整。正常返回 HTTP 200，检查失败返回 HTTP 503。

健康接口不缓存、不创建匿名会话、不写配额或聊天记录，不读取聊天内容，不调用模型和地图供应商。它确认的是后端、数据库与配置，不能证明模型实际推理、三维瓦片加载或所有地区的网络都正常。

## 开通方式与确认边界

最初尝试 [UptimeRobot 官方 Quick Monitor Setup](https://uptimerobot.com/quick-monitor-setup/) 的邮箱激活流程。脚本 `app/scripts/setup-uptime-monitor.mjs` 获取官方 proof-of-work challenge、计算并提交，随后需要由邮箱持有人打开激活邮件并点击页面上的 Activate。用户反馈未收到该邮件，最终改用 Google 登录后的账号后台创建两项监控。

请求回执仅存本地忽略目录 `app/.data/monitoring/`。官方接口使用统一 HTTP 200 响应，接受请求和某些静默拒绝返回相同结果；HTTP 200 不能证明邮件已投递或监控已启用。收到并完成两项激活后，才可标记为生效。

**当前状态：两项监控已启用，后台均显示 Up，每 5 分钟检查。** 首页监控 ID 为 `804245596`，后端监控 ID 为 `804245620`。两项均启用邮件通知，通知邮箱由用户明确改为其 Google 登录的 Gmail；完整地址及验收截图仅保存在忽略目录 `app/.data/monitoring/`。已从后端监控发起模拟 DOWN/UP 通知，用户确认两封测试邮件均收到。未人为中断生产站点，实际故障触发与恢复邮件没有另做破坏性演练。

排查结论：已核对请求参数和 proof-of-work 算法，与官方流程一致；官方说明限流、去重、功能关闭等拒绝也可能返回同样的 HTTP 200，无法据此区分服务端拒绝与邮件投递问题。没有把 QQ 邮箱拦截认定为原因，也没有反复重发。用户完成 Google 登录后，该账号监控列表为空；在后台实际创建两项监控、核对邮件开关和检查间隔，再按用户确认的 Gmail 进行收件验收。原 QQ 邮箱快捷申请未验证激活，不作为生效配置。[官方流程限制](https://uptimerobot.com/quick-monitor-setup/) · [官方通知测试说明](https://help.uptimerobot.com/en/articles/11602913-how-to-test-notifications-in-uptimerobot-quick-guide)。

后端健康接口已上线。Worker 版本为 `bf5a157c-24a5-4d79-a2a4-745f6c99519e`，Pages 发布为 `a1001dac`。2 项健康测试、类型检查、Worker 构建和公网五城检查通过。线上健康检查返回 HTTP 200、`status: ok`，数据库及模型配置检查均为 `ok`。证据见 [监控验收记录](evidence/hosting/monitoring-acceptance-2026-10-12.json) 和 [公网流程结果](evidence/hosting/monitoring-smoke-2026-10-12.json)。

## 验证与维护

- `npm run test:health`：正常数据库无副作用；缺表、数据库异常和缺配置返回 503，错误详情不会外泄。
- `npm run typecheck`、`npm run build:cloudflare`：类型和 Worker 构建检查。
- `node scripts/verify-deployment.mjs https://campus-atlas-demo.pages.dev --storage=D1`：包含健康接口与五城原有业务流程；默认不调用模型。
- 如果迁移到服务器，更新 UptimeRobot 的目标地址，保留 `/api/health`。监控无法自动修复故障，也不保证发现每次短于检查周期的中断。

官方参考：[套餐](https://uptimerobot.com/pricing/)、[API](https://uptimerobot.com/api/)、[邮箱开通流程](https://uptimerobot.com/quick-monitor-setup/)。
