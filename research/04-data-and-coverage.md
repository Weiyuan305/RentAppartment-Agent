# 五个市场的数据来源与覆盖

核查日期：2026-09-21。本文区分“找到官方数据入口”和“已经验证服务可用于产品”：本轮完成前者，未持有或调用生产服务密钥，也未建立真实房源供应链。

## 1. 房源是首要外部依赖

GitHub 租房项目通常提供代码或演示记录，不提供英国、澳大利亚、新加坡、马来西亚、中国香港实时可租的房源、照片和库存授权。

建议供应路径按顺序验证：

1. 学生公寓运营商、持有授权的房源合作方提供 API、CSV 或定期 feed。
2. 自营/代理房源人工整理后批量导入，先支持有限城市。
3. 房东或机构提交并审核的房源，待真实运营需求出现后再做后台。

第三方租房平台页面只可用于产品研究；是否允许抓取、保存图片、再发布和展示报价需单独确认。不能把公开可看推断为可商用数据源。本轮没有抓取第三方房源库存或联系供应商。

每个供应源至少要提供：稳定房源 ID、房型、地址/入口或定位精度、币种与周期、按人/按套、租期、入住日期、费用项、图片使用权、库存状态、更新时间、下架方式。照片不能用 AI 生成图冒充真实房间。

以 `source + externalId` 做幂等导入；跨源去重候选可用地址、坐标和建筑名，但人工确认同楼不同房型，不能把真实独立报价合并丢失。报价失效时间按供应协议设置；过期报价从“可租”过滤中移除，详情可保留并标注。

## 2. 地图、建筑和 POI 的共用底座

用户已确认实景城市，主底图首选 Google Photorealistic 3D Tiles + CesiumJS。[实景覆盖与验收补充](07-photorealistic-city.md)记录五个目的地的最新官方可用性标记。下表中的普通矢量/自建瓦片仅保留作辅助方案研究。

| 数据层 | 可用入口 | 本项目用法 | 必须核查 |
| --- | --- | --- | --- |
| 道路、建筑轮廓、部分高度、POI | [OpenStreetMap](https://www.openstreetmap.org/copyright)、[Geofabrik 区域提取](https://download.geofabrik.de/) | 离线导入，构建路由与设施索引 | 目标城区覆盖、更新时间、ODbL 与署名要求 |
| 矢量瓦片 | [OpenMapTiles](https://github.com/openmaptiles/openmaptiles)、授权托管服务 | MapLibre 建筑与基础地图 | `building` 图层及高度字段、最大缩放级别、glyph/sprite 服务 |
| 瓦片存储与分发 | [PMTiles](https://github.com/protomaps/PMTiles)、[Martin](https://github.com/maplibre/martin) | 自有合法瓦片的静态或动态服务 | 并非数据内容来源；数据授权另算 |
| 实景三维 | [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles-overview)、[Cesium 生态](https://github.com/CesiumGS/cesium) | 已选主路线的实景底图 | 具体校区覆盖、数据更新时间、服务条款、计费、设备性能 |
| 地址/地点检索 | [Photon](https://github.com/komoot/photon)、自托管 [Nominatim](https://github.com/osm-search/Nominatim)、授权供应商 | 校区别名与地址解析的补充 | 开放实例政策、目标市场语言、商业 SLA |

OSM 建筑有轮廓不代表有高度，更不代表有实景纹理。不要默认所有瓦片 schema 都使用 `height` 字段，接入时验证真实字段；示意高度只能用于有明确标识的辅助视图，不能作为本项目实景主体验的替代。

普通栅格底图是图片，不能从中直接得到可挤出的建筑几何。地图、建筑、路网、POI 的版本可以不同，必须记录来源。

公共基础设施限制有实际影响：

- OSM 标准瓦片服务器是尽力服务，没有 SLA，限制批量下载；上线应选择可承载自身流量的服务或自建。[瓦片政策](https://operations.osmfoundation.org/policies/tiles/)
- 公共 Nominatim 实例有绝对最多 1 次/秒限制，禁止客户端自动补全和系统性 POI 抽取。这里推荐的是自托管软件或授权替代服务，不把公共实例配置为通用线上搜索后端。[使用政策](https://operations.osmfoundation.org/policies/nominatim/)
- Google 3D Tiles 是商业数据服务；地图可视化、署名、存储/缓存等有规定。不得把可视化瓦片直接交给 AI 做机器解读、物体识别或抽取楼房/安全数据。[官方政策](https://developers.google.com/maps/documentation/tile/policies)

## 3. 五地数据可行性

| 市场 | 地图/步行路线 | 安全资料的已核实入口 | 可支持的表达 | 尚待验证 |
| --- | --- | --- | --- | --- |
| 英国 GB | OSM 矢量与 pedestrian 路由方案；校区入口单独校验 | [data.police.uk](https://data.police.uk/about/)：英格兰、威尔士、北爱尔兰；月度匿名化位置 | 在有覆盖的城市显示统计期、类别和区域参考 | 警队缺报、匿名化误差；爱丁堡等苏格兰城市需另接来源 |
| 澳大利亚 AU | OSM/供应商步行图；不同校区实际步行可达性抽样 | [NSW BOCSAR 犯罪数据](https://bocsar.nsw.gov.au/statistics-dashboards/open-datasets/criminal-offences-data.html)与[地图方法](https://bocsar.nsw.gov.au/statistics-dashboards/crime-and-policing/guide-for-the-crime-mapping-tool.html) | 悉尼所在州可按 suburb 等区域和统计期展示资料 | 墨尔本及其他州要分别寻找并核实官方数据，不能套 NSW 数据 |
| 新加坡 SG | [OneMap 步行路由](https://www.onemap.gov.sg/apidocs/routing)可作为本地适配候选，另比较 OSM 路线 | [SPF 2025 年度犯罪简报介绍](https://www.police.gov.sg/Media-Hub/Police-Life/2026/02/Physical-Crime-Cases-Saw-a-Minor-Uptick-Last-Year) | 先提供官方总体背景，不能凭该简报给街区排名 | OneMap token/配额与生产使用条件；本轮未找到并核实可用于房源级比较的街区犯罪 API |
| 马来西亚 MY | OSM/授权地图；逐校区核查可步行道路、过街及园区入口 | [Crimes by District & Crime Type](https://data.gov.my/data-catalogue/crime_district) | 按官方警区、年度口径展示，明确数据时间 | 警区与行政区边界映射、较新数据、路网断点和实际通行条件 |
| 中国香港 HK | OSM 路由加本地数据核验；[地政总署 3D-BIT00](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-hkms-digital-3d-bit00)可作补充几何数据候选，尚未确认其可直接提供所需实景纹理 | [香港警务处各总区罪案数字](https://www.police.gov.hk/ppp_sc/09_statistics/map.html) | 显示总区统计及适用范围 | 天桥、室内通道、坡度、电梯/楼梯；3D 数据格式/坐标转换；未核实到楼栋级安全资料 |

这张表不承诺上述服务在每个房源点都准确。每座城市需有能力开关，例如：`hasVerifiedListings`、`hasBuildingHeights`、`hasWalkingRoutes`、`safetyGranularity`、`hasPhotorealisticTiles`。没有数据的功能显示限制，不能默认五地能力相同。

## 4. “安全”的产品边界

英国官方明确犯罪点是匿名化后的近似位置，不是事件发生的精确门牌。因此不能写“这栋公寓发生了 N 起案件”。[英国数据说明](https://data.police.uk/about/)

马来西亚页面本次显示数据截至 **2023-12-31**、更新于 **2024-10-16**，并区分警区与行政区。页面解释其统计口径与已定罪事件有关，因此也不能直接同英国报案/记录类数据混比。应在导入时复核当前数据和官方技术说明，不把页面曾列出的“下次更新时间”当作更新已经发生。[数据集](https://data.gov.my/data-catalogue/crime_district)

首版建议展示一个“区域资料”模块：来源、空间粒度、统计期、指标定义、覆盖/缺失说明。没有适当人口或其他分母时显示计数，不能称为犯罪率。旅游商业区常住人口分母也可能失真，因此同城排名也需方法验证。

不建立跨国统一“安全 93 分”；不以国籍、族群、宗教、语言构成等属性或其代理判断安全。警方/保安设施、门禁、照明等若有核验资料可以分别展示，但它们不是低犯罪的证明。资料不足不等于安全，也不等于危险。

可用文案示例：“该统计区在某统计期的公开记录为……，位置已匿名化；无法据此判断具体楼栋。该房源门禁信息由运营方于某日提供。”所有变量均应来自真实数据。

## 5. “购物方便”的可验证实现

把偏好拆成超市、便利店、商场、药店等类别，默认先关注日常超市。OSM 对应类别与商业供应商类别建立映射，保存来源与类别版本，去重后查询。

计算顺序：空间近邻预筛 → 房源入口到 POI 入口的步行路线 → 展示设施名称与时间。若只取得 POI 中心点或直线距离，明确标注近似/直线，不能显示为已核实的步行分钟数。

营业时间与是否仍营业是独立字段。未知时不声称“24 小时营业”；购物中心主体与内部多家商户不能重复堆高便利分。

## 6. 大学与校区

第一批学校建议从大学官方网站和官方校园地图人工建立高质量小目录：学校中英文名、缩写、城市、校区、主入口、可选教学楼、官网来源、核验时间。批量地址解析仅辅助定位。

校区面积大时，默认入口不一定适合所有学生。界面显示正在使用的入口，允许改成教学楼或常用门；校内步行、门禁及开放时段资料不完整时说明假设。

新加坡与香港同样需要这一层；同一个城市选对学校仍可能选错校区。

## 7. 上线前逐城市抽样

每市场先选 1 城、每城至少 1 个校区及约 20 条房源/地点样本，记录：

1. 房源坐标是否对应真实建筑和可步行入口，是否只有区域级地址。
2. 实景中是否有真实建筑结构与纹理；观察校区及周边连续街区，在目标缩放级别是否缺瓦片、模糊或明显错位。
3. 路线是否错误穿墙、跨河、走高速路或穿过不可通行的校园门。
4. 天桥、楼梯、坡道、夜间关闭通道是否改变结果；没有数据就记录限制。
5. 最近超市是否实际存在且可走到；“近”不自动等于“步行方便”。
6. 安全资料是否存在、粒度是什么、统计时间与来源如何展示。

把样本与校区官方地图、可信地图服务/合作方核验结果对照。得到服务资格、token 或正式数据前，这些是后续验证任务，不是本次已完成事项。
