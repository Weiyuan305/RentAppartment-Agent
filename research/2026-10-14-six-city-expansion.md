# Campus Atlas 六城扩展

扩展范围：英国新增 Manchester、Edinburgh、Liverpool、Birmingham；澳大利亚新增 Melbourne、Canberra。保留 London、Sydney、Singapore、Kuala Lumpur、Hong Kong。现在共 5 个国家/地区、11 座城市、66 套虚构演示房源。

## 大学与来源

| 城市 | 默认大学/校区 | 大学官方来源 |
| --- | --- | --- |
| 曼彻斯特 | University of Manchester / Oxford Road | https://www.manchester.ac.uk/about/maps/ |
| 爱丁堡 | University of Edinburgh / Central Area | https://www.ed.ac.uk/maps/maps |
| 利物浦 | University of Liverpool / City Centre | https://www.liverpool.ac.uk/about/visit-us/maps/ |
| 伯明翰 | University of Birmingham / Edgbaston | https://www.birmingham.ac.uk/contact/campus-map |
| 墨尔本 | University of Melbourne / Parkville | https://maps.unimelb.edu.au/ |
| 堪培拉 | Australian National University / Acton | https://services.anu.edu.au/campus-environment/facilities-maps/maps-way-finding |

每城首批收录 4 栋常用楼栋，来自 OSM 官方地图小范围提取，包括教学楼、图书馆/学习中心、学生服务等；不表示学校全部楼栋。名称/位置来源保留在 `evidence/city-expansion-2026-10-14/*-campus-source.json`，可重复采集配置在 `app/scripts/expanded-campus-config.json`。原有 44 栋楼和 5 个校区保持逐字段不变。

## 数据接入

- 共用 `cityIds` 同步城市类型和 Agent Zod schema，避免 UI 能选、Agent 会话不接受。
- 国家选择器按 5 个国家/地区分组；英国展示 5 城，澳大利亚展示 3 城，其余各 1 城。中英文、手机卡片、登录页城市计数同步更新。
- 每城 6 套演示房源。房源名称、位置、租金、入住日期均为虚构样本，不代表真实可订库存或市场报价。堪培拉的样本偏移避开湖面。
- 新增 36 条到默认大学的真实 Valhalla/OSM 步行路线，并同步前端通勤索引。
- 新增 24 栋建筑对应 144 条公寓到楼栋路线、72 个反向步行圈（10/20/30 分钟）。入口若未验证，继续明确说明。
- 周边设施按大学周围 3km 采集，原始 OSM 响应、查询和时间戳保留；新六城共 13,886 条，全部十一城共 29,612 条。官方图书馆/学习空间来源关联保留。
- 伯明翰 3km 快照中商场分类为 0；堪培拉医院与亚超分类为 0、利物浦打印店分类为 0。缺少记录不等于当地没有该设施，保留原有界面提示，不为了填满图层而造点。
- 公交接入现有“官方/外部规划”模式，分别链接 Bee Network/TfGM、Lothian、Merseytravel、TfWM、Transport Victoria、Transport Canberra。本站不冒充已获取实时公交班次。
- 每城使用核对城市地点及 Unsplash License 的真实预览照片；摄影师与来源见 `app/public/photos/sources.json`。

## 验证边界

数据解析、来源和路网距离一致性自动验证覆盖十一城；Cesium / Google 的实景三维清晰度和覆盖需逐城浏览器观察，不能由配置或照片代替。建筑入口、开放资格、设施营业状态仍未实地核验。


## 代码审查与本地验证

主代理审查：城市类型与服务端枚举已统一，避免新城市无法创建 Agent 会话；默认大学路线索引由同一批已验证文件生成，避免新城步行时间筛选为空；原有 44 栋/5 校区保持逐字段不变；采集器保留旧索引，采集完成才写入新汇总，网络中断不会先清空旧数据。多城卡片采用内容高度网格和内部滚动，修复了裁切文字；切换城市重置房源滚动与悬停。

- TypeScript 检查通过；定向 ESLint 0 errors / 4 个 img 优化建议。
- 30 项回归测试通过，包括新城会话、枚举、分组、图片、设施、大学通勤筛选和全部 144 个新公寓/楼栋组合。
- `test:sample`、`test:routes`、`test:amenities` 通过，验证 66 条默认大学路线、29,612 条设施记录与原始来源一致。
- Cloudflare 生产构建通过，模型密钥泄漏=0、误打包 SQLite=0、D1 binding 存在。
- 已逐城打开六城实景地图，确认城市切换、真实建筑/影像、对应大学与房源价格；英国五城选择、澳大利亚三城选择、390px 英文手机卡片已核对。
- 曼彻斯特第一套样本到默认大学：9 分钟 / 720m；堪培拉第一套到 JB Chifley Building：7 分钟 / 561m，并展示 20 分钟步行圈。
- Melbourne → 手机尺寸 → Canberra 期间 Cesium canvas 节点保持 308，没有重建 Viewer。场景清晰度仍取决于供应商、镜头距离和瓦片加载，不能承诺每个街区相同。
- 官方链接 HTTP 检查保留在 `official-links.json`；部分站点对自动请求返回 403，已用官网搜索结果核对来源，不能把自动请求受阻等同于链接失效。

截图见 `evidence/city-expansion-2026-10-14/ui/`；线上交付证据以发布后的检查为准。
