# 调查方法与来源索引

日期：2026-09-21（Asia/Shanghai）。GitHub 原始时间字段为 UTC。

同日需求更新：用户已确认实景城市，新增 [实景三维城市决定](07-photorealistic-city.md)，并同步调整主选技术栈和验收。补充核查了 Google 五个市场的三维可用标记、JavaScript 三维覆盖说明及 Cesium 官方实景接入教程。数据实测仍未进行。

## 1. 本轮实际做了什么

1. 通过互联网搜索 GitHub 上的三维地图、AI 地图、房产/租房模板、步行路由、空间检索和聊天组件项目。
2. 对 29 个候选地址请求 GitHub 公开 REST 元数据，28 个成功；一个旧 Airbnb clone 地址返回 404。
3. 对可访问候选读取根文件目录，保存能取得的 README 和许可证。后来补充的 Google 3D Area Explorer 通过独立元数据及源码读取保存。
4. 只读检查 Cesium AI starter、Property Pulse、safak estate、Google 3D Area Explorer 的部分关键源码。
5. 核查官方地图/路由文档和五个市场的公开区域资料入口，记录可用性与限制。
6. 基于用户需求提出产品、架构和分阶段验收方案，所有估算与建议均标明尚待验证。

没有运行候选应用、安装它们的依赖、调用付费生产接口、购买服务、部署网站或获取真实租房库存。本轮是调查交付。

## 2. 证据等级

| 等级 | 定义 | 本轮例子 |
| --- | --- | --- |
| E1：实时公开元数据 | API 取得的仓库属性 | 是否归档、最后推送、星数、默认分支 |
| E2：第一方文件/文档 | README、许可证、官方接口说明、政府数据页面 | Valhalla 反向等时圈、英国匿名化犯罪数据说明 |
| E3：只读源码检查 | 读到特定实现入口，没有运行 | 列表/地图使用相同数据、工具白名单 |
| E4：运行验证 | 实际部署、交互或 API 调用验证 | 本轮没有进行，列入后续阶段 A/D |

“官方示例声明可以运行”是 E2，不自动成为 E4。搜索摘要与实时源码有差异时，以本轮保存的源码/README 为准；不引用搜索引擎中的旧依赖版本当作当前版本建议。

## 3. 搜索方向记录

代表性检索式如下，后续从结果进入项目原仓库和官方文档：

- `site:github.com maplibre maplibre-gl-js 3d buildings`
- `site:github.com CesiumGS cesium 3d tiles globe`
- `site:github.com CesiumGS AI tool starter`
- `site:github.com real estate map nextjs open source`
- `site:github.com airbnb clone license`
- `site:github.com valhalla routing isochrones pedestrian`
- `site:github.com/GIScience/openrouteservice`
- `site:github.com/vercel/ai`、`site:github.com/assistant-ui/assistant-ui`
- `site:data.police.uk anonymisation`
- `site:bocsar.nsw.gov.au crime mapping data suburb`
- `site:onemap.gov.sg apidocs routing walk`
- `site:data.gov.my crime district`
- `site:data.gov.hk 3D-BIT00`
- `site:police.gov.hk crime statistics`、`site:police.gov.sg Annual Crime Brief 2025`

没有按星数简单选型。优先顺序为：需求适配、授权可核实、维护信号、可独立集成、数据及运行成本。代码公开、开源许可证、商业地图数据授权是三件不同的事。

## 4. 官方资料索引

仓库链接及其用途集中在 [GitHub 评估](02-github-projects.md)，完整机器可读评估在 [repository-assessments.json](repository-assessments.json)。以下补充非仓库资料。

| 资料 | 支持的结论 | 本轮限制 |
| --- | --- | --- |
| [MapLibre 建筑三维示例](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/) | 建筑挤出与三维相机方案可行 | 未在五城实测该瓦片的建筑高度完整性 |
| [MapLibre 示例目录](https://maplibre.org/maplibre-gl-js/docs/examples/) | 控件、镜头、聚类、图层等可参考 | 示例不是完整租房产品 |
| [Valhalla Isochrone](https://valhalla.github.io/valhalla/api/isochrone/) | pedestrian 可达范围；reverse 可计算到达目标的范围 | 等时圈为近似，需实际矩阵/路线确认 |
| [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html) | geography 距离单位为米并可利用索引 | 只能预筛地理距离，不能算真实步行时间 |
| [Google 3D Tiles 概览](https://developers.google.com/maps/documentation/tile/3d-tiles-overview) | 可用第三方兼容三维渲染器显示 3D Tiles | 不等于每个城市每处校区有同样覆盖 |
| [Google 地图覆盖说明](https://developers.google.com/maps/coverage) | 需按产品、地区检查覆盖 | 国家级表不能证明具体位置有精细实景 |
| [Google JavaScript 三维覆盖页](https://developers.google.com/maps/documentation/javascript/3d/coverage) | 区分地形与建筑等地表三维，并提供交互覆盖图 | 属于 JavaScript 产品，不能替代选定 Tiles/ion 渠道的实测 |
| [Cesium 实景接入教程](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/) | CesiumJS 可加载 Google Photorealistic 3D Tiles | 未用本项目账号/token 运行 |
| [Google Map Tiles 政策](https://developers.google.com/maps/documentation/tile/policies) | 署名、缓存、机器解释等使用限制 | 具体采购仍按账号协议和当前条款 |
| [MapTiler 定价](https://www.maptiler.com/cloud/pricing/) | 托管瓦片服务是独立成本项 | 本轮没有锁定套餐和成本报价 |
| [OSM 版权说明](https://www.openstreetmap.org/copyright) | 地理数据为 ODbL，需遵守署名及数据使用条件 | 不替代具体衍生数据库/成品使用评估 |
| [Geofabrik](https://download.geofabrik.de/) | 可下载区域 OSM 提取，通常每日更新 | 未下载或构建五市场完整路由图 |
| [OSM 瓦片使用政策](https://operations.osmfoundation.org/policies/tiles/) | 公共瓦片服务容量有限、无 SLA、限制批量下载 | 不作为生产资源承诺 |
| [Nominatim 公共实例政策](https://operations.osmfoundation.org/policies/nominatim/) | 限速及禁止自动补全/系统性提取 | 不适用于自己部署实例的相同使用限制 |
| [英国 Police API](https://data.police.uk/docs/) | 存在 JSON 服务及街道级犯罪/结果资料 | 未取得具体房源区域的数据 |
| [英国数据说明](https://data.police.uk/about/) | 地域覆盖、月度发布、位置匿名化 | 不覆盖苏格兰，位置不是精确门牌 |
| [NSW 犯罪数据](https://bocsar.nsw.gov.au/statistics-dashboards/open-datasets/criminal-offences-data.html) | 有按 suburb 等粒度的数据集 | 只支持 NSW，其他州另核查 |
| [NSW 地图方法](https://bocsar.nsw.gov.au/statistics-dashboards/crime-and-policing/guide-for-the-crime-mapping-tool.html) | 行政区域、计数/率、人口不足等注意项 | 不能推断楼栋安全 |
| [OneMap 路由](https://www.onemap.gov.sg/apidocs/routing) | 新加坡 walk/drive/cycle 路由入口 | 动态页面正文提取有限；仅检索到官方说明，未用 token 测试 |
| [SPF 年度简报介绍](https://www.police.gov.sg/Media-Hub/Police-Life/2026/02/Physical-Crime-Cases-Saw-a-Minor-Uptick-Last-Year) | 有官方犯罪总体资料 | 本轮未核实街区级适用数据 |
| [马来西亚警区犯罪资料](https://data.gov.my/data-catalogue/crime_district) | 年度、警区、类别/数量、数据时间 | 页面显示截至 2023 年；口径与地理边界需核对 |
| [香港 3D-BIT00](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-hkms-digital-3d-bit00) | 存在官方三维空间数据入口 | 未下载转换或验证浏览器加载 |
| [香港各总区罪案数字](https://www.police.gov.hk/ppp_sc/09_statistics/map.html) | 有官方总区层面参考 | 不能解释为街道/具体房源的安全评分 |

以上均为第一方项目或官方机构来源。第三方博客、论坛讨论只作检索线索，没有用作技术选型或覆盖承诺的主要依据。

## 5. 本地证据结构

```text
research/
├── 01-product-and-ux.md
├── 02-github-projects.md
├── 03-architecture.md
├── 04-data-and-coverage.md
├── 05-delivery-plan.md
├── 06-sources-and-method.md
├── 07-photorealistic-city.md           # 用户已确认的实景要求与方案
├── repository-assessments.json
├── evidence/
│   ├── github-repositories.json       # 29 个候选的汇总
│   ├── source-manifest.json           # 批次读取的文件 URL、git blob SHA、SHA256
│   ├── inspected-files.json           # 重点源码及补充文件的读取结果、SHA256
│   ├── owner__repo.json               # 成功取得的公开 REST 元数据
│   └── owner__repo/                   # README、许可证、根文件列表、inspected/
└── scripts/
    ├── collect_github.py
    └── collect_sources.py
```

快照中的 `default_branch` 与源码 URL 可能随上游变化。保存的 SHA256 用于核验本次实际读取内容，不表示这些文件全都固定在同一个 commit。正式开发应以选定 release/commit 重新验证和锁定依赖。

## 6. 复核采集方法

两个脚本只用系统 Python 和 curl 读取公开 GitHub 数据，不读取本机账号 token、不安装依赖、不执行上游代码。运行顺序为：

```bash
python3 /Users/weiyuan/personal/rentApartment/research/scripts/collect_github.py
python3 /Users/weiyuan/personal/rentApartment/research/scripts/collect_sources.py
```

脚本需要可访问 GitHub 的网络，未认证 API 有额度限制；网络或配额错误要作为错误保留，不能解释成项目不存在。重新运行会刷新快照，若要保持本次历史证据，应先另存整个 `evidence` 目录。人工评估文件和文档不会随脚本自动更新。

首次用系统 Python TLS 时遇到本机证书链问题，采集脚本已改用系统 curl 的信任链，保留 TLS 校验后完成读取。不是通过禁用证书校验获取数据。

## 7. 尚未证明的事项

- 任一候选在当前本机或生产环境能完整运行。
- 五市场每个城市都有合法、准确、实时的房源库存。
- 指定瓦片/三维服务在所有目标校区的建筑高度、实景精度与设备性能。
- 路由结果与现实门禁、天桥、电梯、坡道和开放时间完全一致。
- 某个“安全分”能跨城市、跨国家比较。
- 真实月度运营费用和最终交付时间。

这些均在实施计划中设了验证步骤；本轮不会把文档分析冒充产品验收。
