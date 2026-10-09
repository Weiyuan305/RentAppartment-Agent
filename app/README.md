# 远居 Campus Atlas · 五城租房验证样本

这一版用于验证「选国家 / 地区 → 选城市 → 房源列表 + 实景城市 + 找房助手」的交互。研究资料仍位于上一级 `research/`，应用源码在本目录。

## 启动

要求 Node.js 22.13+（当前已在 Node 25.5 上验证）。

```sh
npm ci
npm run dev
```

终端输出的 Local URL 为准；本次运行在 http://localhost:5174/ 。窄窗口用房源 / 城市 / 助手三个标签切换，宽屏并排显示三栏。

## 已实现

- 英国 / 伦敦、澳大利亚 / 悉尼、新加坡、马来西亚 / 吉隆坡、中国香港。
- 每城 6 套虚构演示房源，共 30 套；每套 3 张可切换的室内参考照片。
- 本地币种与周租 / 月租显示；房型、预算、价格排序、收藏及空结果状态。
- 收藏保存在本浏览器 localStorage；城市选择保存在 URL，可分享本地路径。
- 详情弹层和独立详情页 `/listing/[id]`；详情页可回到对应城市及选中房源。
- AI SDK 7 ToolLoopAgent 与 OpenAI 兼容流式接口：预算、房型、账单及校园步行时间筛选，附近设施查询、最近地点定位、真实步行路线。未配置模型时显示明确的工具体验入口。
- SQLite 保存按匿名浏览器与城市隔离的对话和地图条件，支持刷新与服务器重启后恢复。安全仍缺少可靠数据，不编造评分。
- CesiumJS 1.145 + Google Photorealistic 3D Tiles 接入代码；支持 Google Maps Key 或有权限的 Cesium ion token，包含地图拖动、缩放、旋转、大学与房源标记及点选联动。
- 公寓卡片、详情弹层及详情页的「到学校路线」：五城 30 套样本均保存了 Valhalla / OpenStreetMap 真实步行路网计算结果，显示贴合三维场景的路线、距离、预计时间及分段指引；支持查看全程、关闭路线、手机端跳到城市面板和 URL 恢复。
- 地图设施图层：共 21 个分类开关，保留医院、便利店、商场，并在「更多设施」中分组显示交通、买菜、学习、日常医疗、餐饮、运动和生活服务。五校周边 3 公里 OpenStreetMap 快照共 15,726 条；每城补充一处大学官网确认的自习空间。支持简单线条图标、聚合、列表、来源、公寓直线距离和原始标签菜系筛选。
- 点击设施后可按需计算「从公寓步行到这里」：本站 API 校验演示公寓及地点 ID，再调用 OSRM 步行服务，显示真实路网、时间和分段指引。详见上级 `research/12-student-amenities.md`。
- 不配置地图凭证时，显示明确标注的城市摄影预览、选中房源摘要和 `/setup` 接入说明。该状态不宣称真实三维已通过验收。
- 渐进增强的只读 WebMCP `get_rental_sample`，仅在支持的浏览器中注册；不连接外部业务数据，不预订。

## 模型与服务器配置

复制 `.env.agent.example` 为 `.env.agent.local`，填写 `ATLAS_AI_BASE_URL`、`ATLAS_AI_MODEL`、`ATLAS_AI_API_KEY` 并重启。模型必须支持流式 Chat Completions 和工具调用。运行 `npm run build` 后，可用 `npm run start -- --port 3000` 在普通 Node 服务器运行；数据库默认 `.data/rental-chat.sqlite`，必须保留持久磁盘。单进程样本不等同多实例正式部署。

## 当前方案：Cesium ion 免费评估

本轮已选用 Cesium ion Community 进行五城效果验证。只需要 Cesium ion 账号及获授权的只读 token，无需同时开通 Google Cloud 结算。

1. 在 [Cesium ion](https://ion.cesium.com/) 注册或登录，选择 Community。
2. 在 Asset Depot 启用 Google Photorealistic 3D Tiles。
3. 在 Access Tokens 创建网站专用 token：只选 `assets:read`，限定该 Google 3D 资产，Allowed URLs 加入 `http://localhost:5174`（按实际运行来源调整）。
4. 在已准备的 `.env.local` 第二行填入 token：

```dotenv
VITE_MAP_PROVIDER=cesium-ion
VITE_CESIUM_ION_ACCESS_TOKEN=你的只读token
```

运行 `npm run check:map` 检查是否填写，然后重启开发服务 `npm run dev -- --port 5174`。检查不会发送网络请求、输出 token，也不能证明权限或实际城市覆盖。

地图会等用户点击「加载实景 3D」、路线按钮或助手地图工具后才请求数据，同一次页面停留中的城市切换复用连接，刷新、重试、离开后重进可能产生新请求。配额以 ion Usage 为准；没有在本地把点击次数当作供应商真实用量。

截至 2026-10-08，[官方套餐](https://cesium.com/platform/cesium-ion/pricing/)列出 Community 含每月 1,000 次 Google 3D 根瓦片请求及每月 15 GB 流量等额度，允许符合条件的探索评估；正式对外运营时另核对商业集成许可。这里的免费是账号套餐与使用条件，不是代码对费用的承诺。

`.env.local` 已忽略 Git。`VITE_` 配置是浏览器可见的客户端凭证，不得使用有写入或账号管理权限的 token。生产环境修改配置需要重新构建。

以后若选择 Google Maps 直连，必须明确设置 `VITE_MAP_PROVIDER=google-maps` 并填写 `VITE_GOOGLE_MAPS_API_KEY`；没有 token 或遇到错误时不会自动切换到该服务。只填 Google Key 不会覆盖当前 ion 方案。

三维引擎由 `predev` / `prebuild` 从已安装 npm 包复制到 `public/cesium`，无需浏览器加载第三方脚本 CDN。地图本身仍向 Google / Cesium 请求授权数据，不下载或持久缓存瓦片；保留引擎和数据供应方署名。独立标记坐标来自演示样本，不从 Google 模型提取。

官方说明：
- [Google Map Tiles 开通](https://developers.google.com/maps/documentation/tile/get-api-key)
- [用量与配额](https://developers.google.com/maps/documentation/tile/usage-and-billing)
- [Cesium 实景三维集成](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/)
- [Google 数据使用政策](https://developers.google.com/maps/documentation/tile/policies)
- [WebMCP API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)

## 当前边界

2026-10-08 已使用本地 Cesium ion token 在浏览器实测：伦敦 UCL、悉尼大学、新加坡 NUS、香港大学周边可显示带立面纹理的实景三维建筑；吉隆坡马来亚大学周边当前只看到影像地形，建筑细节不足，页面已标明。结果仅针对样本视野，不代表整座城市覆盖。

已实际验证地图放大、缩小、旋转、拖动、大学定位、房源列表定位、地图标记选择和筛选后标记更新。尚未进行低配设备性能基准测试，不能据此承诺帧率。

房源名称、面积、价格、位置、账单条件为虚构；街区名字及大学名字仅作场景背景。图片是来自不同房间的库存照片，不能当作同一套真实房源。摄影师和授权见 `public/photos/sources.json`，图片共约 1.7MB。

2026-10-09 的步行路线来自真实路网服务，按现有样本坐标计算并保存于 `public/routes/`。路线几何及距离、时间来自 Valhalla，非直线连点或按直线推算；原始响应见上级 `research/evidence/walking-routes/`。时间以 5.1 km/h 步速及引擎道路模型估算，非实时导航；道路吸附偏移超过 40 米时显示具体说明，偏移路段未计入。公寓坐标及校区点不是核验过的楼门、校门，不能当作真实房源的到门通勤承诺。

到学校的路线由访客读取本站保存结果；`npm run collect:routes` 顺序请求尚未保存的样本、每次间隔至少 1.1 秒并发送识别请求头，只在需要重算时手动运行 `npm run collect:routes -- --refresh`，不在构建时自动刷新。新增设施路线按明确点击请求 OSRM，单进程每次间隔至少 1.1 秒、只允许一个上游请求、每日最多 100 次，成功结果缓存一天；筛选和移动地图不会计算路线。公共服务适合小量验证，正式产品需共享限流、自建或使用有保障的路线服务并核验出入口。助手工具中的「30 分钟以内」依据 30 套样本的校园路线时间实际筛选。配额和成功路线缓存保存到 SQLite，重启后保留。

设施快照由 `npm run collect:amenities` 手动采集，访客读取本站 JSON，不触发 Overpass 查询。数据已接入，营业状态、无障碍和进入资格未现场核验；移动地图不会加载校区范围外的新地点。

本轮未接入真实房源供应方、治安数据，也未实现预订和支付。AI 接口与工具已实现，2026-10-09 使用本地配置的真实模型完成伦敦设施查询、最近地点追问及步行路线验证。新环境需在 `.env.agent.local` 填写 Base URL、模型和密钥后重启。服务器默认用 Node 运行，模型配置只在服务端读取，不能使用 VITE_ 前缀。详见 [接入、部署与验收说明](../research/14-agent-map-integration.md)。

## 验证

```sh
npm run typecheck
npm run test:sample
npm run test:agent
npm run test:routes
npm run test:amenities
npm run test:amenity-routes
npm run build
```

构建输出位于 `dist/`。完整交互验收记录及待开通后的检查项见上级 `research/08-validation-sample.md`。
