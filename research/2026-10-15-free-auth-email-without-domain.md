# 无自有域名的免费验证邮件与密码重置方案

调研日期：2026-10-15。范围：保留 Campus Atlas 当前演示阶段的免费 Cloudflare 部署，比较无需购买域名、能向普通注册用户发送邮件的方案。

## 结论

不买域名也可以实现邮箱验证和忘记密码。此前“需要域名”的结论适用于 Resend 的正式发信路径，不适用于所有邮件服务。

针对当前项目，建议优先验证 **Better Auth + Cloudflare Worker + 专用 Gmail 邮箱的 Gmail API**。账号及业务数据继续在现有系统中，Gmail 只负责发信。它需要配置 Google Cloud 项目和邮箱 OAuth 授权，不能只填写一个普通 API Key。适合少量演示用户，不作为大规模邮件服务的替代。

本次完成官方资料与本地代码核对，未注册供应商账号、未连接邮箱、未发送测试邮件、未修改认证代码或部署。下文免费额度与限制以调研日官方页面为准；不代表已通过当前账号的准入审核或真实收信验收。

## 当前项目条件

- `app/lib/auth.ts` 使用 Better Auth、Drizzle 和当前数据库适配器；`requireEmailVerification` 当前为 `false`，没有配置验证邮件与重置邮件回调。
- `app/cloudflare/wrangler.jsonc` 使用 Worker、D1 和 `nodejs_compat`，公共认证地址为 `https://campus-atlas-demo.pages.dev`。
- Better Auth 支持提供 `sendVerificationEmail` 和 `sendResetPassword` 发信函数，因此邮件供应商可以单独替换，不必迁移登录系统。[Better Auth 邮件文档](https://better-auth.com/docs/concepts/email)
- Worker 支持通过 `fetch` 调用外部 HTTPS API；Gmail API、Brevo API 的 HTTP 接入与当前运行环境相符。这是架构可行性判断，尚未验证实际授权和送达。[Cloudflare Fetch 文档](https://developers.cloudflare.com/workers/runtime-apis/fetch/)

## 对比

| 方案 | 不购买域名 | 免费范围 | 对当前项目的影响 | 判断 |
| --- | --- | --- | --- | --- |
| 专用 Gmail + Gmail API | 可以，使用邮箱自身的 `@gmail.com` 地址 | 标准 API 用量在免费阈值内；同时受 Gmail 邮箱发信及风控限制 | 接发信适配器，保留 Better Auth 和 D1 | 少量演示优先验证 |
| Brevo 免费版 + 单邮箱验证 | 官方有临时共享域名替换机制 | 每天 300 封；免费套餐没有固定到期时间 | HTTPS API + API Key，保留现有认证 | 备选；需激活事务邮件，不能把临时机制视为长期承诺 |
| Firebase Authentication Spark | 可以，内置邮件使用 Firebase 提供的域名 | 验证邮件 1,000 封/天；密码重置 150 封/天 | 更换认证及会话验证，并处理既有用户和业务关联 | 功能完整，但当前改造成本高 |

## 1. Gmail API：保留现有架构

由专用于网站的 Gmail 邮箱发送验证和重置链接，发件人显示名可以使用网站名称，实际地址仍为 Gmail 地址。收件用户不需要登录 Google，也不要求使用 Gmail；授权操作由发信邮箱的持有人完成。

请求路径：网页触发 Better Auth → Worker 生成并处理验证/重置流程 → Gmail API 发信 → 用户点击现有网站的链接。

官方说明与实际限制：

- Gmail API 支持发送邮件；当前标准使用在免费阈值内，不等于无限制发送。[发送指南](https://developers.google.com/workspace/gmail/api/guides/sending)、[API 用量与费用阈值](https://developers.google.com/workspace/gmail/api/reference/quota)
- 个人 Gmail 官方说明：一天发送超过 500 封邮件等情况可能触发限制，通常需等待 1–24 小时恢复；退信和风控也可能限制发送。这个数字不是为网站承诺的每日可用配额。[邮箱发信限制](https://support.google.com/mail/answer/22839?hl=en)
- 需要 Google Cloud 项目、OAuth 客户端、发信邮箱授权与可刷新的凭据；只申请 `gmail.send`，不需要读取访客或发信邮箱的收件箱。[权限范围](https://developers.google.com/workspace/gmail/api/auth/scopes)
- OAuth 的 External + Testing 配置通常导致 refresh token 在 7 天后到期。实施时必须明确授权模式及适用审核要求，不能把测试 token 当作长期凭据。[OAuth 令牌生命周期](https://developers.google.com/identity/protocols/oauth2)
- Google 对个人使用和开发测试等列出审核例外；这不等于所有公网应用都自动豁免。当前方案只让网站的发信邮箱授权，访客不参与 Google OAuth；接入时仍需核实项目配置及适用政策。正式对外开放 Google 账号授权时需重新评估。[审核与例外](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)

适合当前少量演示，但应使用专用邮箱；授权撤销、风控和配额错误要能在服务端识别并向用户给出重试提示。

## 2. Brevo：可试用的无域名发信路径

Brevo 免费套餐包含事务邮件，每天 300 封、无固定试用到期时间；无需信用卡。[套餐说明](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)、[免费限制](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)

可以添加一个邮箱地址并通过发到该邮箱的验证码验证发件人。[添加发件人](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email)

针对免费邮箱或未认证域名，官方说明会临时替换为符合要求的发信地址，事务邮件示例为 `mycompany@5000001.t-sender-sib.com`。官方明确称之为临时措施，并建议改用自有认证域名，不能据此承诺永远无域名可用。[发信地址替换政策](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders)

事务邮件平台需要激活，未激活的新账号可能需要联系客服申请。即使获得 API Key，也不能把“账号已注册”当作“已能对外发信”。[事务邮件激活与排错](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP)

如果采用，先核实当前新账号能否获准使用此路径并测试 Gmail、QQ 等实际收件，再启用强制邮箱验证。

## 3. Firebase Authentication：内置发信，但涉及认证迁移

Firebase 提供 `sendEmailVerification`、`sendPasswordResetEmail`，支持语言和回跳地址设置；其默认发信身份使用 `noreply@PROJECT_ID.firebaseapp.com`，无需购买自有域名。[功能说明](https://firebase.google.com/docs/auth/web/manage-users)、[默认发件人域名的官方说明](https://firebase.google.com/docs/auth/web/apple)

Spark 免费计划目前验证邮件 1,000 封/天、密码重置 150 封/天。不要与“邮箱链接直接登录”混淆，后者免费额度只有 5 封/天。[认证限制](https://firebase.google.com/docs/auth/limits)

这是认证服务，不是可以直接套在 Better Auth 用户上的通用邮件网关。采用时必须迁移/衔接用户、密码、会话以及收藏/看房记录/聊天记录的用户标识；既有密码哈希兼容性需要单独验证。页面和业务仍可部署 Cloudflare，但认证链路会改变。

## 不应误判为满足需求的免费服务

- **Resend 默认测试域名**：只能发给自己的 Resend 账号邮箱，不满足普通用户注册。[限制](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- **Supabase 默认邮件服务**：只发送到项目团队成员等预授权地址，当前为 2 封/小时；向普通访客发送需要自定义 SMTP，迁移过去并不会自动解决免费发信问题。[限制](https://supabase.com/docs/guides/auth/auth-smtp)
- **MailerSend 测试域名**：最多 100 封、2 个不同收件人，适合接口验证，不适合开放注册。[限制](https://www.mailersend.com/help/getting-started)
- **SMTP2GO 单发件人验证**：确实有不操作 DNS 的验证方式，但受发件人域名 DMARC 限制，不能直接认定任意 Gmail/QQ 地址及新账号都可用；不列为本次首选。[限制](https://support.smtp2go.com/hc/en-gb/articles/115004408567-Verified-Senders)

## 下一步验收范围（待确认实施后执行）

先验证发信邮箱授权与真实送达，再接入注册验证、重置密码、中英文提示及重发流程。至少验证：新账号验证成功、过期链接和重复点击、重置后旧密码失效、按策略注销旧会话、游客继续可用、既有账号不被突然锁出，以及发信失败/额度耗尽时不会向用户显示虚假的发送成功。

不应把供应商 API 返回成功当作收件箱已收到；分别记录 API 接受、收信、点击链接和完成认证的证据。当前文档仅为调研结果。
