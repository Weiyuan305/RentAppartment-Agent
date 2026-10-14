# 登录与中英文：开源选型及验证

日期：2026-10-12。范围：现有五城租房演示，真实邮箱/密码注册登录 + 游客体验；登录页和网站右上角切换中文 / English。继续使用现有 Cloudflare Pages + Workers + D1，不另建外部认证服务。

## GitHub 调研与选择

星数为本次页面观察的约数，会随时间变化，不代表安全审计结果。

| 项目 | 本次观察 | 用途与结论 |
| --- | --- | --- |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | 约 125.4k stars，MIT | 项目已使用这套组件；参考官方 [login-02 双栏布局](https://ui.shadcn.com/blocks/login)，左侧城市照片，右侧表单。复用 Field、InputGroup、Button、Alert、ToggleGroup 等组件，保留 Campus Atlas 视觉。无需引入整个 SaaS 模板。 |
| [Better Auth](https://github.com/better-auth/better-auth) | 约 30.3k stars，MIT | 提供邮箱/密码、会话、Cookie、CSRF 来源校验和持久限流。采用 1.7.7，适合当前真实账户需求，也能保留未来迁移 Node 服务器的路径。 |
| [Auth.js](https://github.com/nextauthjs/next-auth) | 本次查看官方仓库 | 成熟认证方案；当前需求包含完整密码注册、登录和账户存储，Better Auth 的现成功能更贴合，避免另写凭证注册流程。 |
| [i18next](https://github.com/i18next/i18next) | 约 8.6k stars，MIT | 使用 core 26.4.4 配合现有 React Context。中文源文案作回退，英文独立字典；固定语言翻译器避免服务端并发请求之间串语言。 |

认证参考：[安装](https://www.better-auth.com/docs/installation)、[Drizzle 适配器](https://better-auth.com/docs/adapters/drizzle)。Worker 使用 `better-auth/minimal`，避免标准入口携带不使用的 Kysely / `node:sqlite` 代码；Drizzle SQLite proxy 连接项目已有异步数据库接口。Cloudflare 使用 D1，普通 Node 使用持久 SQLite。

## 实现与边界

- `/login` 包含注册、登录、显示/隐藏密码、错误反馈、处理中状态和游客入口。登录后返回原城市/公寓路径，返回地址限制为本站相对路径。
- 新增 `auth_user`、`auth_session`、`auth_account`、`auth_verification`、`auth_rate_limit`；迁移为 `app/migrations/0002_auth.sql`，不覆盖既有聊天表。
- 密码采用 Better Auth 原生 scrypt；会话 Cookie 为 HttpOnly，HTTPS 下为 Secure，会话有效期 7 天。签名密钥只存本地忽略文件和 Worker Secret，不进入前端或 Git。
- 登录每个 IP 每分钟最多 6 次，注册每分钟最多 3 次，使用数据库持久化计数，避免 Worker 重建实例后重置计数。
- 账号聊天依据已校验的用户 ID 隔离；游客继续使用匿名 Cookie。游客旧聊天不自动合并进账号，收藏仍保存在当前浏览器。
- 中英文覆盖登录、城市选择、房源列表、详情、设施筛选、路线面板、助手状态/按钮和接入说明。语言偏好保存在 localStorage 与一年期语言 Cookie；SSR 读取 Cookie，刷新继续使用选择的语言。
- 切换语言不重建 Cesium Viewer，不清空选房和筛选。2026-10-13 起，AI 每轮按最新用户消息的主要语言回复，包括工具查询后的说明；界面语言不再决定 AI 回复语言。仅数字或表情等消息沿用最近一次可识别的用户消息语言，首次无法判断则默认中文。历史聊天不自动翻译。地图地点专名和已有路网原始指引保留来源原文。
- 当前实现是邮箱作为账号标识的真实密码认证，**未接入邮件发送**，不验证邮箱所有权、不提供邮件找回密码。正式运营前应接入邮件提供商，并配置验证/重置流程。
- 演示房源与地图覆盖限制仍适用；登录不使虚构房源变成可预订真实房源。

## 验证记录

截至本地验收：

- 12 项相关测试通过：认证与语言 2 项、agent 8 项、健康检查 2 项。认证覆盖注册、哈希存储、错误密码、会话、来源拒绝、不同身份聊天隔离、退出失效、重复注册、跨实例限流；agent fixture 验证当前语言进入模型指令及多轮工具联动。
- TypeScript 通过；针对改动组件的 ESLint 无错误，保留既有原生图片和地图 effect 提示。
- Node 构建通过；Cloudflare 构建通过，检查结果 `secretLeaks: 0 / sqliteImports: 0 / hasD1: true`。
- 在本地实际 Worker + D1 中，注册、登录、读会话、账号聊天会话、退出及旧 Cookie 失效均通过，不调用付费模型。
- 浏览器检查中/英文登录页、注册切换、登录后返回原公寓、账号菜单与退出、游客进入及语言保留、英文设施筛选。窄屏检查登录表单与主界面，修复英文导航挤压品牌的问题。

## Cloudflare 线上验收

- 入口：[登录页](https://campus-atlas-demo.pages.dev/login)、[主界面](https://campus-atlas-demo.pages.dev/?city=london&listing=london-2)。
- Worker 版本：`60c96e83-e593-4543-a86b-52cc05b1e9a0`；Pages 部署：`2ecd85f7`。D1 `0002_auth.sql` 已应用，认证 Secret 已写入服务端。
- 实际公网 API 验证：注册、登录、会话读取、账号聊天、退出及旧 Cookie 失效全部通过。使用合成 example.com 测试账户，不发送邮件。
- 实际浏览器验证：英文登录后返回 London / Chapter House；账号菜单与退出正常，登录及主界面的中英文可切换，窄屏表单和导航可用。
- 实际模型调用 1 轮：英文询问当前公寓 500 米内的便利店，回复为英文，地图勾选便利店并显示快照收录的 14 处地点。随后另一次登录恢复同一账号的两条消息、所选公寓、便利店类别和 500 米筛选；恢复检查没有再次调用模型。
- 三维地图首次连接失败，手动重连后恢复伦敦实景建筑和便利店标记；未据此断定首次失败的根因。中英文切换后同一画布及所选公寓/14 处设施保持可见。此轮只实看伦敦，不代表重新验收五城覆盖。
- `/login` 分别带中文、英文语言 Cookie 请求均为 HTTP 200，服务端 HTML 语言属性和标题文案正确。最终浏览器 error / warn 日志为空。
- 首次 Worker 发布遇到 Cloudflare API 的一次性令牌错误，查询版本时遇到 504；原站健康检查仍为 200，同一构建重试后发布成功。

非敏感验收摘要见 [evidence/auth-and-localization.json](evidence/auth-and-localization.json)。临时公网测试账号及其测试聊天已清理，清理后健康检查仍为 HTTP 200。本次没有提交任何密码、Cookie、签名密钥或 API 密钥。
