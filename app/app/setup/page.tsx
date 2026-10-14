"use client";
import { LanguageSwitch } from "@/components/language-switch";
import { useLocale } from "@/components/locale-provider";
/* eslint-disable @next/next/no-html-link-for-pages -- Full document links avoid vinext production client-router failures. */

export default function SetupPage() {
  const {t} = useLocale();
  return <main className="document-page"><div className="document-language"><LanguageSwitch/></div>
    <a href="/?city=london" className="back-link">{t("← 返回远居")}</a>
    <span className="doc-kicker">CAMPUS ATLAS · CESIUM ION</span>
    <h1>{t("先用免费评估，")}<br/>{t("看看真实的城市。")}</h1>
    <p className="doc-lead">{t("这一轮使用 Cesium ion Community，连接 Google 实景三维城市。无需同时开通 Google Cloud 结算；先完成五城效果验证，再决定正式运营的方案。")}</p>
    <section id="agent">
      <h2>{t("AI 找房助手 · OpenAI 兼容接口")}</h2>
      <p>{t("在 app 目录将")} <code>.env.agent.example</code> {t("复制为")} <code>.env.agent.local</code>{t("，填写以下三个值，再重启服务：")}</p>
      <pre>{`ATLAS_AI_BASE_URL=https://your-provider.example/v1\nATLAS_AI_MODEL=your-model-name\nATLAS_AI_API_KEY=your-server-api-key`}</pre>
      <p>{t("模型需要支持 Chat Completions、流式输出和工具调用。这里的配置只在服务器读取；地图 token 不能用于 AI。不要将密钥放入 VITE_ 变量或聊天消息。")}</p>
      <p>{t("未配置模型时，右侧明确显示「工具体验」，仍可通过按钮验证附近设施、最近地点和真实步行路线。配置后可直接多轮提问，地图和列表随工具结果更新。")}</p>
      <p>{t("对话和地图条件保存在服务器 SQLite；当前浏览器通过匿名会话继续访问。同城可刷新续聊，各城市分别保存。更换浏览器或清除 Cookie 后会开启独立会话。")}</p>
    </section>
    <section>
      <h2>{t("01 · 注册免费账号")}</h2>
      <p>{t("打开")} <a href="https://ion.cesium.com/" target="_blank" rel="noreferrer">Cesium ion ↗</a>{t("，注册或登录，选择 Community 免费档。账号注册与条款确认由你在官方页面完成。")}</p>
      <p>{t("官方当前列出的 Google 实景三维额度为每月 1,000 次根瓦片请求，Community 还有每月 15 GB 流量等限额，实际使用以账号 Usage 为准。免费档适用于符合条件的评估；正式对外运营前再确认商业集成许可。")}</p>
      <p><a href="https://cesium.com/platform/cesium-ion/pricing/" target="_blank" rel="noreferrer">{t("查看官方套餐与评估条件 ↗")}</a> {t("· 2026-10-08 核对")}</p>
    </section>
    <section>
      <h2>{t("02 · 启用实景三维数据")}</h2>
      <p>{t("在 ion 的 Asset Depot 中找到")} <strong>Google Photorealistic 3D Tiles</strong>{t("，启用或添加到你的资产。确认可以在官方预览里看到实景建筑。")}</p>
      <p>{t("请选择这个带真实建筑纹理的数据集。普通地形和 OSM Buildings 不能达到我们要验证的实景效果。")}</p>
    </section>
    <section>
      <h2>{t("03 · 创建网站专用 token")}</h2>
      <p>{t("在")} <a href="https://ion.cesium.com/tokens" target="_blank" rel="noreferrer">Access Tokens ↗</a> {t("创建名为")} <code>rentApartment-local</code> {t("的 token：")}</p>
      <ul className="setup-list">
        <li>{t("Scopes：只选")} <code>assets:read</code>{t("。当前样本未使用地址搜索，不需要 geocode 权限。")}</li>
        <li>{t("Selected assets：只允许 Google Photorealistic 3D Tiles。")}</li>
        <li>{t("Allowed URLs：填写实际预览来源，例如")} <code>http://localhost:5174</code>{t("。如果使用 127.0.0.1，单独加上对应来源。上线时再添加部署网址。")}</li>
      </ul>
      <p>{t("这是浏览器使用的只读 token；不选写入、账号资料或 token 管理权限。不要在聊天里粘贴 token。")}</p>
    </section>
    <section>
      <h2>{t("04 · 填入已准备好的配置文件")}</h2>
      <p>{t("打开项目的")} <code>rentApartment/app/.env.local</code>{t("，只需在第二行等号后填入 token：")}</p>
      <pre>{`VITE_MAP_PROVIDER=cesium-ion\nVITE_CESIUM_ION_ACCESS_TOKEN=your-read-only-token`}</pre>
      <p>{t("保存后，在 app 目录运行：")}</p>
      <pre>{`npm run check:map\nnpm run dev -- --port 5174`}</pre>
      <p>{t("如果开发服务已经运行，先停止旧进程再重启。check:map 只检查本地配置，不发送网络请求，也不会打印 token。")}</p>
      <p>{t("回到城市页面，点击「加载实景 3D」才会请求地图。同一次页面停留中，切换五个城市会复用地图连接；刷新、重试或重新进入可能产生新的请求。")}</p>
    </section>
    <section>
      <h2>{t("接通后，一起验收五个城市")}</h2>
      <p>{t("伦敦、悉尼、新加坡、吉隆坡、香港：逐一检查大学周边是否有真实建筑纹理，拖动、缩放、旋转，再点击房源和大学定位。城市覆盖与清晰度仍需实际检查。")}</p>
      <p>{t("房源、位置和租金仍是演示数据；步行时间、安全和购物便利度需要后续单独核验。")}</p>
      <a className="primary-button" href="/?city=london">{t("返回样本，开始验证 →")}</a>
    </section>
    <details className="setup-alternative"><summary>{t("以后切换 Google Maps 直连")}</summary><p>{t("当前不会自动切换。需要时，在 Google Cloud 启用结算与 Map Tiles API，再明确修改配置：")}</p><pre>{`VITE_MAP_PROVIDER=google-maps\nVITE_GOOGLE_MAPS_API_KEY=your-browser-map-key`}</pre><p>{t("该方式按 Google 的免费额度和超额费率计费，填写来源与 API 限制后重启。仅填写 Google Key 不会改变当前 Cesium ion 方案。")}</p><a href="https://developers.google.com/maps/documentation/tile/get-api-key" target="_blank" rel="noreferrer">{t("Google 官方开通指南 ↗")}</a></details>
    <div className="doc-sources"><a href="https://cesium.com/learn/ion/cesium-ion-access-tokens/" target="_blank" rel="noreferrer">{t("token 官方说明 ↗")}</a><a href="https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/" target="_blank" rel="noreferrer">{t("实景三维官方指南 ↗")}</a></div>
  </main>;
}
