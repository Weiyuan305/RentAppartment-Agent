# 学生租房规划功能交付记录

实现与本地验收：2026-10-14。沿用 B 方案、现有 Cesium 实景、AI SDK、SQLite/D1 和 Cloudflare 架构，没有新增付费服务。Git 与 Cloudflare 的最终版本以交付回复中的实际结果为准。

## 已实现范围

| 功能 | 行为与数据边界 |
| --- | --- |
| 大学 / 校区 / 楼栋 | 五个现有城市各一个示范校区，44 栋常用建筑；支持正式名称、部分中英文别名、教学 / 图书馆 / 服务 / 餐饮分类。并非每栋楼或完整多大学目录。 |
| 公寓到楼栋路线 | 264 条 Valhalla / OSM 步行快照；公寓起点、地图、回复、筛选、比较使用同一个楼栋 ID。15 个 OSM 标注主入口，其余为建筑轮廓顶点均值，明确显示入口未核验。 |
| 通勤筛选与范围 | 按选定楼栋实际路线时间筛选。132 个反向 pedestrian 10/20/30 分钟等时圈；不是直线圆。静态路网估计不保证实时通行、门禁或开放时间。 |
| 公寓比较 / 保存 / 分享 | 最多三套，比较房型、月租、账单、通勤、超市与公交站快照、演示入住条件；清单随会话保存。分享 URL 只携带同城公寓和目的地，不带私人费用、频次或聊天。 |
| 月支出 | 周租按 52/12 折算；包含账单时水电网不重复计费。交通、其他支出可编辑；空值保留未知，押金和一次性费用单列。 |
| 多个常去地点 | 最多五个已收录楼栋，按每周到访次数 × 单程路线时间 × 2 汇总；这不是连续多站线路或实习地点的全城搜索。 |
| 入住 / 租期 / 状态 | 日期、最短和最长租期、更新时间、可租状态及筛选均已实现；目前字段明确为演示，缺失值不按可租处理。没有接入真实出租库存。 |
| 公交 / 地铁 / 校车 | 伦敦通过服务端查询 TfL 当次行程，展示真实分段与已有几何；缓存五分钟、共享限额。其他四城提供官方规划、校园 / 校车资料与带起终点的外部行程入口，不伪造实时班次或时长。 |

楼栋数量：伦敦 UCL 20；悉尼大学、NUS、马来亚大学、香港大学各 6。来源见 `evidence/campus-planner/catalog-provenance.json`、`app/lib/student/data/campuses.json`；路线来源与计算时间保留在各快照中。

## 验证证据

- 自动化测试共 34 项通过：学生规划 16、已有 Agent 8、D1 3、认证 2、健康检查 2、Markdown 3。覆盖日期边界、未知费用、跨城 ID、重复清单、所有楼栋的路线和等时圈、旧会话兼容、入口和路线模式、导航状态恢复、指定公寓起点，以及 TfL 429 降级和密钥不回传。
- 类型检查通过；针对改动的 ESLint 无错误，保留既有图片和 Hook 依赖警告。Cloudflare 构建通过，守卫结果为 `secretLeaks=0 / sqliteImports=0 / hasD1=true`。
- 独立只读代码审查已完成。修复了筛选后费用仍引用旧公寓、旧路线模式未清除、入住筛选重置不全、详情链接丢失楼栋、旧保存覆盖 URL 目的地、空 / 单项比较清单恢复旧值的问题。最后的指定起点工具修改也已独立复审。
- 实际模型验收曾发现把当前公寓距离说成用户点名的 Chapter House 距离。已将新楼栋路线工具改为必传并校验公寓 ID，同步地图起点，返回 `origin` 公寓名称，并补充程序回归和模型指令。修复后中文与英文追问均返回 Chapter House → Student Centre **686 米 / 约 9 分钟**，地图同步为 Chapter House。
- 桌面实测 Wilkins 15 分钟筛选得到 3 套房源；公寓比较、分享、费用、频次、无结果重置、完整详情跳转后楼栋及私人规划保留均已观察。以每周 Wilkins 五次、Student Centre 两次为例，Academic / Chapter House 为 115 / 131 分钟往返通勤。
- 月费用实测：交通 60、其他 0、押金 1000、一次性 80，账单已包含时 Academic / Chapter House 月总额为 £1,446.67 / £1,728.33；Chapter House 首期资金 £2,808.33。刷新及详情返回后保留。
- 伦敦 TfL 浏览器实际查询成功。当次选中较近公寓，供应商首个结果为 11 分钟步行，页面如实显示，未将其包装为公交乘坐方案。
- 中英文桌面 UI 已操作；390×844 手机视口检查无页面横向溢出，规划截图已保存。设备模拟下点击坐标桥接不稳定，未据此宣称完成真实手机全流程手势验收。

截图：`evidence/campus-planner/comparison-en.png`、`costs-en.png`、`mobile-planner-en.png`。真实模型使用本地配置和隔离的临时验收数据库，不上传聊天数据库或凭据。

## 公网验收与 TfL 限制

代码已先上传 GitHub `main`（首个功能提交 `bef265582b3a3d0980d7abdd39c0af0e85d46ace`），随后发布 Cloudflare。公网五城的已有设施工具、默认校园路线、会话持久化、来源校验与健康检查通过。独立游客会话的真实模型也返回 Chapter House → Student Centre **686 米 / 9 分钟**，D1 保存的公寓、楼栋和地图路线状态一致，英文回答完成约 17 秒。公开比较页截图为 `evidence/campus-planner/cloudflare-comparison-en.png`。

TfL 本机成功不代表云端成功：公网测试与 Worker 诊断日志确认 TfL 对 Cloudflare 匿名出口返回 **HTTP 429**。这不是 D1 或几何解析错误；[TfL 官方产品页](https://api-portal.tfl.gov.uk/products) 写明匿名请求每分钟限额为 50。共享云端出口受限是根据本机成功、云端 429 作出的定位判断，尚未获得上游对具体出口限额的额外说明。

已实现明确的限流回退、当前起终点外部规划链接、可选服务端 `ATLAS_TFL_API_KEY`；AI 查询失败时返回 `external-planner` 和限制，不声称算出了实时公交时长或已画公交路线。服务端日志只记录错误类别和状态，不记录包含 Key 的请求 URL。用户已确认此阶段先使用官方规划入口。无 Key 时 API / AI 工具直接返回正常外部规划模式，不请求 TfL，也不会先展示限流错误；前端将带起终点的外部行程链接作为主操作。有 Key 后的 Cloudflare 内嵌公交查询仍需另行验收，本次不宣称已经恢复。

取得 TfL Key 后放入本地 `.env.agent.local` 的 `ATLAS_TFL_API_KEY`，再运行 `npm run secrets:cloudflare -- --transit-only` 上传到既有 Worker Secrets；不能填入前端环境变量或提交到 Git。当前没有新增 TfL 凭据，也没有上传该服务的密钥。

## 数据更新与复现

`npm run collect:campus` 是显式人工运行的数据采集入口，不在构建或访客浏览时自动抓取。目录脚本仅下载五个固定小范围的官方 OSM API XML；缓存默认 `/private/tmp`，可用 `ATLAS_CAMPUS_CACHE` 指定目录。已有缓存会复用，不自动删除；路由采集顺序执行、间隔至少 1.1 秒并复用成功结果。重新采集后运行 `npm run test:student`，核对名称、端点、吸附偏移及来源，再发布。公共 Valhalla 服务适合小量演示，正式上线需要有保障的路由服务。

其他官方入口：[SimplyGo 出行指南](https://www.simplygo.com.sg/travel-guide/)、[NUS 校车](https://uci.nus.edu.sg/campus-life/campus-services/transportation/internal-shuttle-bus/)、[悉尼大学交通](https://www.sydney.edu.au/about-us/campuses/getting-to-campus.html)、[MyRapid 规划](https://myrapid.com.my/journey-planner/)、[MTR 规划](https://www.mtr.com.hk/en/customer/jp/index.php)。MyRapid 在自动网页抓取时返回 403，因此不能宣称已完成该外部网站的交互验收。

## 正式服务仍需的数据

真实房源供给及入口、实时库存与合同条款；更多大学和校区、建筑入口与门禁核验；非伦敦城市的可用交通接口；更完整的无障碍和公共安全数据。现有代码具备演示交互，不代表这些数据已取得。
