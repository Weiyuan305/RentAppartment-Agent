"use client";
import { LanguageSwitch } from "@/components/language-switch";
import { useLocale } from "@/components/locale-provider";

const sections = [
  ["商家资料与咨询", "Partner listings and enquiries", "商家入驻的联系信息和管理权说明仅供平台审核。审核通过的房源地址、图片、价格和条款公开显示，并可供 AI 查询。学生主动发送的咨询和预约只对本人、对应商家可见；举报仅供平台处理。商家无法查看学生的收藏名单、私人看房记录或 AI 对话。草稿暂存在当前设备，显式保存后同步服务器；照片保存在 Cloudflare 数据库中。默认城市跟账号保存；点击地址查询会将房源地址、邮编和城市发送到 OpenStreetMap Nominatim，并缓存查询结果；地图选点加载 OpenStreetMap 瓦片。不发送商家联系资料或审核材料。", "Partner contact and property-authority evidence are private to platform review. Approved addresses, photos, prices and terms are public and available to the AI. Enquiries and viewing requests are visible only to the sender and host; reports go to the platform. Hosts cannot read students’ saved-home lists, private viewing notes or AI chats. Drafts are saved on the current device and sync to the server when explicitly saved; photos are stored in the Cloudflare database. Your default city is saved to your account. Clicking address search sends the property address, postcode and city to OpenStreetMap Nominatim and caches results; the location picker loads OpenStreetMap map tiles. Contact details and review evidence are not sent."],
  ["登录资料", "Sign-in information", "使用 Google 登录时，我们接收你的 Google 账号标识、姓名、邮箱、邮箱验证状态和头像（如有），用于创建或关联 Campus Atlas 账号。我们不请求读取 Gmail、通讯录或云盘。邮箱注册使用你填写的姓名、邮箱和经哈希处理的密码。", "When you sign in with Google, we receive your Google account identifier, name, email, email verification status and profile picture (if available) to create or link your Campus Atlas account. We do not request access to Gmail, contacts or Drive. Email registration stores the name and email you provide and a hashed password."],
  ["收藏、记录与对话", "Saved homes, records and conversations", "登录后的收藏、看房记录和对话按账号存储，以便继续使用和跨设备访问。游客的收藏和看房记录保存在浏览器；游客对话通过浏览器会话标识访问服务端记录。AI 助手会将你提交的消息和相关找房上下文发送给配置的模型服务，请不要在对话中提交密码、证件或支付信息。", "Saved homes, viewing records and conversations are associated with your signed-in account so you can continue across devices. Guest saved homes and viewing records remain in the browser; guest conversations use a browser session identifier to access server records. The AI assistant sends your messages and relevant rental context to the configured model provider. Do not submit passwords, identity documents or payment information in chat."],
  ["服务提供商", "Service providers", "网站及数据库托管在 Cloudflare。Google 提供登录认证；Cesium 和 Google 提供实景地图，路线和设施查询可能使用其他地图服务。加载这些功能会向相应提供商发送必要的网络请求。我们不出售 Google 登录资料，也不将它用于广告投放。", "Cloudflare hosts this website and its database. Google provides sign-in authentication; Cesium and Google supply photorealistic maps, and other map services may supply routes and places. Loading these features sends necessary network requests to the relevant provider. We do not sell Google sign-in data or use it for advertising."],
  ["Cookie 与本地存储", "Cookies and browser storage", "我们使用必要的 Cookie 维护登录和访客会话，并在浏览器保存语言、界面偏好及游客记录。退出登录会结束当前登录会话；清除浏览器数据可能删除游客记录。", "Necessary cookies maintain signed-in and guest sessions. Browser storage holds language and interface preferences and guest records. Signing out ends the current login session; clearing browser data may remove guest records."],
  ["管理与删除", "Manage or delete your data", "你可以在 Google 账号的第三方连接设置中撤销对本应用的授权。撤销 Google 授权不会自动删除 Campus Atlas 内的账号和记录。如需访问、更正或删除账号及相关数据，请联系下方邮箱；目前没有站内自助删除入口。", "You can revoke this app's access in your Google Account third-party connections. Revoking Google access does not automatically delete your Campus Atlas account or records. To access, correct or delete your account and related data, contact the email below; there is currently no self-service account deletion page."],
];

export default function PrivacyPage() {
  const {locale}=useLocale();
  const en=locale === "en";
  return <main className="document-page">
    <div className="document-language"><LanguageSwitch/></div>
    <a className="back-link" href="/login">{en ? "← Back to sign in" : "← 返回登录"}</a>
    <span className="doc-kicker">CAMPUS ATLAS</span>
    <h1>{en ? "Privacy notice" : "隐私说明"}</h1>
    <p className="doc-lead">{en ? "This notice describes how this student rental demo handles information. Updated 16 October 2026." : "本说明介绍这个留学生租房演示网站如何处理信息。更新于 2026 年 10 月 16 日。"}</p>
    {sections.map(([zhTitle,enTitle,zhBody,enBody])=><section key={enTitle}><h2>{en ? enTitle : zhTitle}</h2><p>{en ? enBody : zhBody}</p></section>)}
    <section><h2>{en ? "Contact" : "联系我们"}</h2><a href="mailto:xuweiyuan0305@gmail.com">xuweiyuan0305@gmail.com</a></section>
  </main>;
}
