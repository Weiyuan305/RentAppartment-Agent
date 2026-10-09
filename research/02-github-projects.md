# GitHub 项目评估

核查日期：2026-09-21。共 29 个候选地址，28 个能取得公开仓库元数据，1 个原地址返回 404。调查包含地图、三维示例、路由、空间数据、AI UI、租房模板与交互组件。

当前决定：用户已确认实景效果，主选更新为 CesiumJS + Google Photorealistic 3D Tiles，详见 [实景三维城市方案](07-photorealistic-city.md)。

## 1. 如何阅读

星数和 `pushed_at` 来自本地保存的 GitHub REST API 快照。`pushed_at` 代表仓库收到推送的时间，不保证主分支最近发布、不保证代码质量或长期维护。下面日期统一取 UTC 日期。

许可证以实际文件和项目声明交叉检查，不只看 GitHub 自动识别。`NOASSERTION` 不等于没有许可证；反过来，README 自称 MIT 也不能替代缺失的完整授权文件。这里是技术选型记录，实际采用时保留对应组件和第三方的版权/许可证，并核对所选版本。

复用建议分为“首版候选”“条件采用”“参考思路”“暂不采用”。没有把代码公开但授权不清的模板当作可直接复制的开源底座。

## 2. 项目对照

### 地图与三维

| 项目 | Stars | 最后推送（UTC） | 许可证核查 | 本项目用途与取舍 |
| --- | ---: | --- | --- | --- |
| [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) | 11709 | 2026-09-20 | BSD-3-Clause；含第三方声明 | 辅助方案研究：用户已确认实景；本次挤出路线不满足主体验，仅留作辅助地图候选 |
| [visgl/react-map-gl](https://github.com/visgl/react-map-gl) | 8504 | 2026-09-03 | MIT；含 BSD 代码声明 | 辅助方案研究：随 MapLibre 路线保留；不进入 Cesium 实景主栈 |
| [CesiumGS/cesium](https://github.com/CesiumGS/cesium) | 15759 | 2026-09-18 | Apache-2.0 | 首版主选：已确认实景效果；加载授权摄影测量三维数据并叠加业务图层 |
| [CesiumGS/cesiumjs-ai-starter-app](https://github.com/CesiumGS/cesiumjs-ai-starter-app) | 8 | 2026-09-15 | Apache-2.0 | 优先研究：官方三维＋聊天工具调用；新项目，尚未运行验证 |
| [CesiumGS/cesium-ai-integrations](https://github.com/CesiumGS/cesium-ai-integrations) | 89 | 2026-08-19 | Apache-2.0 | 暂不采用：README 已弃用，转向新 starter，勿仅看未归档状态 |
| [reearth/resium](https://github.com/reearth/resium) | 884 | 2026-09-20 | MIT | 条件采用：已选 Cesium 的 React 绑定候选；也可直接管理 Viewer 生命周期 |
| [visgl/deck.gl](https://github.com/visgl/deck.gl) | 14602 | 2026-09-21 | MIT | 条件采用：大量空间数据和复杂可视化；首版原生图层可先满足 |
| [NASA-AMMOS/3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) | 2470 | 2026-09-18 | Apache-2.0 | 条件采用：Three.js 生态三维瓦片；相机/GIS/UI 需自行组合 |
| [googlemaps-samples/js-3d-area-explorer](https://github.com/googlemaps-samples/js-3d-area-explorer) | 38 | 2024-04-17；已归档 | Apache-2.0 | 参考思路：三维区域与 POI 展示；已归档，勿直接当当前底座 |

### 地图数据与分发

| 项目 | Stars | 最后推送（UTC） | 许可证核查 | 本项目用途与取舍 |
| --- | ---: | --- | --- | --- |
| [protomaps/PMTiles](https://github.com/protomaps/PMTiles) | 3045 | 2026-09-16 | 实现 BSD-3-Clause；规范 CC0/公有领域 | 辅助方案研究：用于自有合法辅助瓦片；不作为 Google 实景数据镜像方案 |
| [maplibre/martin](https://github.com/maplibre/martin) | 3931 | 2026-09-20 | Apache-2.0、MIT 文件；按组件核对 | 辅助方案研究：自有矢量/动态瓦片需要明确后再引入；不加入首版实景主栈 |
| [openmaptiles/openmaptiles](https://github.com/openmaptiles/openmaptiles) | 3169 | 2026-07-29 | 代码 BSD-3-Clause；设计 CC-BY-4.0 | 辅助方案研究：矢量地图及其 schema；不提供本需求的实景城市纹理 |
| [postgis/postgis](https://github.com/postgis/postgis) | 2234 | 2026-09-17 | GPL-2.0-or-later；第三方见 LICENSE.TXT | 首版候选：空间索引、范围和距离预筛；步行时间仍靠路由 |
| [Turfjs/turf](https://github.com/Turfjs/turf) | 10491 | 2026-09-07 | MIT | 条件采用：前端 GeoJSON 辅助运算；不能从缓冲圆得出真实通勤 |
| [osm-search/Nominatim](https://github.com/osm-search/Nominatim) | 4488 | 2026-09-16 | GPL-3.0 | 条件采用：自托管地址检索；公共实例限制不适合通用自动补全 |
| [komoot/photon](https://github.com/komoot/photon) | 3064 | 2026-09-17 | Apache-2.0 | 条件采用：地点搜索/补全候选；生产自建或使用授权服务 |

### 路径与通勤

| 项目 | Stars | 最后推送（UTC） | 许可证核查 | 本项目用途与取舍 |
| --- | ---: | --- | --- | --- |
| [valhalla/valhalla](https://github.com/valhalla/valhalla) | 6233 | 2026-09-21 | MIT（COPYING） | 首版候选：pedestrian、等时圈、矩阵与路线 |
| [GIScience/openrouteservice](https://github.com/GIScience/openrouteservice) | 1973 | 2026-09-21 | GPL-3.0；另含 LGPL 文件，按模块核对 | 替代候选：路径、等时圈和矩阵；公共服务与开源引擎分开评估 |
| [graphhopper/graphhopper](https://github.com/graphhopper/graphhopper) | 6696 | 2026-09-18 | Apache-2.0 | 替代候选：路由与等时圈；商业 Matrix API 不等于开源组件 |
| [Project-OSRM/osrm-backend](https://github.com/Project-OSRM/osrm-backend) | 8093 | 2026-09-13 | BSD-2-Clause | 替代候选：路线与 table；需步行 profile/路网和补充等时圈流程 |

### AI 与交互

| 项目 | Stars | 最后推送（UTC） | 许可证核查 | 本项目用途与取舍 |
| --- | ---: | --- | --- | --- |
| [vercel/ai](https://github.com/vercel/ai) | 26869 | 2026-09-21 | Apache-2.0（LICENSE） | 首版候选：结构化工具和流式回答；自建真实房源查询工具 |
| [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) | 12232 | 2026-09-21 | MIT | 首版候选：聊天界面和工具反馈；可按需要选用而非强制 |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 42057 | 2026-09-20 | MIT | 暂不优先：长流程状态编排；首版确定性搜索无需复杂 Agent 图 |
| [davidjerleke/embla-carousel](https://github.com/davidjerleke/embla-carousel) | 8419 | 2026-09-18 | MIT | 首版候选：图片横向切换；独立处理图片控件与卡片点击 |
| [pmndrs/zustand](https://github.com/pmndrs/zustand) | 58712 | 2026-09-18 | MIT | 首版候选：三栏共享选择/筛选；服务端注意会话隔离 |

### 租房及市场模板

| 项目 | Stars | 最后推送（UTC） | 许可证核查 | 本项目用途与取舍 |
| --- | ---: | --- | --- | --- |
| [bradtraversy/property-pulse-nextjs](https://github.com/bradtraversy/property-pulse-nextjs) | 126 | 2025-10-05 | README 称 MIT，正文未核实 | 参考思路：租房卡片、图片、详情；需重设计学生长租报价模型 |
| [safak/full-stack-estate](https://github.com/safak/full-stack-estate) | 221 | 2024-07-25 | 未确认许可证 | 参考思路：列表＋二维地图布局；不直接复制代码 |
| [sharetribe/sharetribe](https://github.com/sharetribe/sharetribe) | 2447 | 2026-05-11 | Sharetribe Community Public Licence | 暂不采用：source-available、自定义限制，README 说明不再主动维护 |
| [AntonioErdeljac/next13-airbnb-clone](https://github.com/AntonioErdeljac/next13-airbnb-clone) | — | 不可访问 | 无法核查，原地址 404 | 排除：不使用搜索结果中的 fork 冒充原仓库 |

## 3. 最贴近需求的项目：CesiumJS AI Starter

[仓库](https://github.com/CesiumGS/cesiumjs-ai-starter-app)已提供三维地球/地图和聊天界面，通过结构化工具控制浏览器中的地图。模型密钥放在 Node 服务端。其 Vite/React + Express 分层可借鉴，但不必让最终项目完全沿用这套目录。

重点源码入口，本次已下载并只读检查：

- [shared/src/enabled-tools.ts](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/shared/src/enabled-tools.ts)：前后端共同使用的工具白名单。
- [frontend/src/components/ChatPanel.tsx](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/frontend/src/components/ChatPanel.tsx)：接收工具调用、检查是否启用、调用浏览器执行器。
- [backend/src/app.ts](https://github.com/CesiumGS/cesiumjs-ai-starter-app/blob/main/backend/src/app.ts)：工具注册、聊天入口、限流及部分可选能力的会话管理。

针对本项目的改造：把 `flyTo` 一类镜头操作收敛为“定位已存在的房源/校区”；增加受约束的房源搜索、步行路线和区域资料工具。业务事实来自自己的服务，LLM 不生成任意经纬度来冒充已核实房源。

模板也含代码生成、外部 MCP 等能力，本需求无须全部启用。调查时该仓库仅 8 stars，属于较新的官方示例；已核实功能入口，但本轮未运行，不把其生产就绪描述当成性能或可靠性结论。

## 4. MapLibre 路线的历史对比（不作为已确认需求的主选）

用户已确认实景城市，首版采用 **CesiumJS + 授权实景三维数据 + Zustand + Embla**。下面保留 MapLibre 的调查价值，其建筑挤出方案不满足本次主体验要求。

优先复用这些已有能力：

- [立体建筑示例](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/)：建筑挤出、图层顺序与高度字段。
- [MapLibre 官方示例目录](https://maplibre.org/maplibre-gl-js/docs/examples/)：标记、聚类、相机、控件及范围控制。
- [react-map-gl](https://github.com/visgl/react-map-gl)：通过 `react-map-gl/maplibre` 使用 MapLibre，保持 React 与地图事件集成。
- [Embla Carousel](https://github.com/davidjerleke/embla-carousel)：可横向滑动的卡片图片；业务点击区域与轮播控件自行清晰区分。

原生地图图层通常足以显示房源、大学、等时圈和单条路线。若后续需要大量统计网格、复杂三维覆盖或分析可视化，再引入 deck.gl，减少首版叠加复杂度。

## 5. 两个租房模板能借鉴到什么

### Property Pulse

[仓库](https://github.com/bradtraversy/property-pulse-nextjs)包含房源、图片、搜索、地图等页面与业务示例。适合研究长租卡片/详情的内容组织。

已检查 [models/Property.js](https://github.com/bradtraversy/property-pulse-nextjs/blob/main/models/Property.js)：它把 `nightly/weekly/monthly`、地址、设施和图片放在一个 Property 内。本项目需要扩展为建筑—房型—报价，显式存币种、按人/整套、租期、可租日期和来源；不应原样沿用。

已检查 [components/PropertyMap.jsx](https://github.com/bradtraversy/property-pulse-nextjs/blob/main/components/PropertyMap.jsx)，可参考房源位置展示。它不是已经完成“真实步行范围＋AI 筛选＋三维城市”的系统。

README 声明 MIT 并链接 `LICENSE.md`，但仓库根文件清单没有该文件，本轮也未成功获取正文。因此先借鉴思路，取得明确授权前不直接搬代码。这个不确定性记录在原始证据中。

### safak/full-stack-estate

[列表源码](https://github.com/safak/full-stack-estate/blob/main/client/src/routes/listPage/listPage.jsx)让列表和地图共用 `postResponse`，与本需求的左右联动有参考价值。[地图源码](https://github.com/safak/full-stack-estate/blob/main/client/src/components/map/Map.jsx)使用 React Leaflet，是普通二维地图，不能直接满足三维交互。

它缺少本次已核实的根许可证，API license 为空，最后推送时间为 2024-07-25。只作为布局和数据流研究对象；不要把其公共 OSM 瓦片地址直接当作本产品的长期生产服务配置。

## 6. 路由引擎如何选

| 引擎 | 可借鉴能力 | 本项目判断 |
| --- | --- | --- |
| [Valhalla](https://github.com/valhalla/valhalla) | 步行成本、等时圈、时间矩阵与路线 | 默认选择；先验证当地路网与托管/自建成本 |
| [openrouteservice](https://github.com/GIScience/openrouteservice) | directions、isochrones、matrix | 很好的替代路线；托管额度与自建部署分开评估 |
| [GraphHopper](https://github.com/graphhopper/graphhopper) | 路由、步行 profile、等时圈 | 可替代；开源引擎与商业 Directions/Matrix 服务不能混为一谈 |
| [OSRM](https://github.com/Project-OSRM/osrm-backend) | 路线、table、match 等服务 | 若团队已有 OSRM 经验可用；步行需对应 profile/图，等时圈需求还要补充实现 |

不对未实测的引擎给出“香港最准确”或“最快”等排名。性能取决于路网、profile、图构建、服务配置与候选规模。

## 7. 明确不作为起点的项目

- [Cesium AI Integrations](https://github.com/CesiumGS/cesium-ai-integrations)：README 明确 deprecated，并指向新的 starter。即使 API `archived=false`，也不应误判为应选的活跃入口。
- [Google 3D Area Explorer](https://github.com/googlemaps-samples/js-3d-area-explorer)：三维区域＋POI 的展示很相关，但已归档。可参考 [src/utils/cesium.js](https://github.com/googlemaps-samples/js-3d-area-explorer/blob/main/src/utils/cesium.js) 的组织思路，用当前 API 重新验证，不直接作为长期底座。
- [Sharetribe Go](https://github.com/sharetribe/sharetribe)：README 声明不再主动维护，采用自定义 source-available 许可。不是拿来即可当宽松开源租房系统使用的方案；其市场交易能力也超出当前核心需求。
- `AntonioErdeljac/next13-airbnb-clone`：本轮原地址及 API 返回 404。检索中存在引用该地址的 fork，但没有把 fork 伪装成原作者当前可用仓库。
- LangGraph、NASA 3DTilesRendererJS、deck.gl 等仍有各自价值，但首版无需同时装进技术栈。组件多不等于闭环更完整。

## 8. 结论与复用边界

本次未找到经核实可一键部署并同时覆盖五市场、学生长租、三维城市、30 分钟步行与安全解释的完整项目。更稳妥的方案是复用维护中的基础组件，自己实现房源和地理数据之间的业务关系。

调查副本位于 [evidence](evidence/)，包含 API 原始数据、许可证、README 与少量重点源码；这里只做阅读和核查，没有安装或运行这些项目。正式采用时固定版本/commit，完成该版本许可证与依赖核查后再集成。
