# rentApartment · 留学生海外租房网站

最初调研日期：2026-09-21。用户已确认：城市地图必须是带真实建筑外观和纹理的实景三维。五城验证样本位于 `app/`；2026-10-09 已按 [Agent 框架选型](research/13-agent-framework-selection.md) 接入 AI SDK `ToolLoopAgent`、业务工具、地图联动与服务器会话存储，并完成伦敦真实模型对话验证。新环境需要自行填写本地模型及地图配置，配置模板随项目提供，实际凭据与聊天数据库不进入 Git。见 [启动说明](app/README.md)和[接入与部署说明](research/14-agent-map-integration.md)。

## 建议怎么做

做一个以**校区和生活需求为中心的找房工作台**：先选国家/地区，再选城市，然后进入“房源列表＋可旋转的实景三维城市地图＋AI 对话”三栏页面。AI 每次筛选都应同步更新房源、地图和条件标签，并说明推荐依据。

当前首选采用 **React / Next.js + CesiumJS + Google Photorealistic 3D Tiles + PostgreSQL / PostGIS + Valhalla + AI SDK**。这是一项待原型验证的工程建议，不是已经跑通的集成。

- **已确认的效果**：真实街区和建筑纹理，能放大缩小、平移、旋转和改变俯仰角。主体验按实景三维验收。
- **实景实现**：CesiumJS 加载 Google Photorealistic 3D Tiles，在上面叠加自有房源、校区和路线。Google 的官方表已列出五个目的地的三维支持，具体校区覆盖、清晰度和成本仍需实测。[接入教程](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/) · [覆盖表](https://developers.google.com/maps/coverage)
- **步行 30 分钟**：依照房源入口到所选校区入口的步行路网计算，地图显示可达范围，最终用路线时间确认。[Valhalla 等时圈](https://valhalla.github.io/valhalla/api/isochrone/)
- **安全、购物方便**：安全展示有出处的区域资料；购物展示超市、商场等配套及步行时间。数据不足时明确显示未知，不让 AI 猜测。

## 最值得借鉴的项目

| 项目 | 对本需求的价值 | 建议 |
| --- | --- | --- |
| [CesiumJS AI Starter](https://github.com/CesiumGS/cesiumjs-ai-starter-app) | 官方“三维地图＋聊天＋结构化工具调用”示例 | 优先研究交互架构；项目较新，不直接等同成熟租房产品 |
| [CesiumJS](https://github.com/CesiumGS/cesium) | 实景三维渲染、房源图层、镜头控制 | 首版主地图引擎 |
| [Valhalla](https://github.com/valhalla/valhalla) | 步行路径、等时圈、时间矩阵 | 通勤筛选引擎 |
| [AI SDK](https://github.com/vercel/ai) | 流式回答、结构化工具调用 | 对话与业务查询编排 |
| [Property Pulse](https://github.com/bradtraversy/property-pulse-nextjs) | 租房卡片、详情、图片、地图 | 借鉴业务界面；README 声明 MIT，但本次未找到其所链接的许可证正文 |
| [safak/full-stack-estate](https://github.com/safak/full-stack-estate) | 列表和地图共同消费同一批房源数据 | 借鉴布局和数据流；未确认仓库授权，不直接复制 |

本次共调查 **29 个 GitHub 候选地址：28 个可访问、1 个原地址返回 404**。可访问不代表都是可直接商用的开源软件；已分别记录许可证、维护信号、适用性和限制。没有发现一个已经核实、可直接满足全部需求的成品项目。

## 文档导航

- [学生租房规划功能交付](research/28-student-planner-release.md)：校园楼栋导航、比较分享、路网等时圈、支出、频次、入住条件与公共交通的数据覆盖和验收。
- [Cloudflare 演示部署与验收](research/18-cloudflare-demo-deployment.md)：固定 Pages 地址、Worker + D1、多轮和实景地图验收，以及迁回服务器的步骤。
- [长期免费公网托管](research/17-long-term-free-hosting.md)：Vercel + Neon、Cloudflare + D1 的免费边界、现有代码适配与公网验收。
- [Agent 超时与消息恢复](research/16-agent-timeout-recovery.md)：失败提示、刷新恢复及原消息重试。
- [Agent 回复 Markdown 渲染](research/15-agent-markdown-rendering.md)：Streamdown 选型、实现及验证。
- [Agent、地图联动与服务器部署](research/14-agent-map-integration.md)：工具、多轮持久化、模型配置、Node 运行与验收边界。
- [最新 Agent 框架选型](research/13-agent-framework-selection.md)：六个 GitHub 项目、正式版本与许可核对，以及与房源／地图联动的工具设计。
- [学生生活地图扩展](research/12-student-amenities.md)：21 个类别开关、五城地点快照与公寓到设施的步行路线。

**先看最新决定：[实景三维城市方案](research/07-photorealistic-city.md)。** 已同步更新以下选型与验收文档。

1. [产品流程与三栏交互](research/01-product-and-ux.md)：页面、房源卡片、详情、地图和聊天如何一起工作。
2. [GitHub 项目评估](research/02-github-projects.md)：29 个项目的对照、重点源码入口、推荐与淘汰原因。
3. [技术架构与 AI 找房流程](research/03-architecture.md)：已确定的实景路线、数据结构、API、筛选与排序。
4. [五个市场的数据来源](research/04-data-and-coverage.md)：房源、大学、地图、路线、购物、安全数据及覆盖限制。
5. [开发顺序与验收标准](research/05-delivery-plan.md)：从技术验证到五市场可用产品，含工作量估算和成本测算方法。
6. [调查方法与来源索引](research/06-sources-and-method.md)：证据等级、官方资料链接和复核方法。

## 开工建议

先用伦敦一个明确校区做技术验证，验证真实建筑纹理及连续覆盖、步行路网、房源定位和对话筛选是否连通；同时从第一天保留英国、澳大利亚、新加坡、马来西亚、中国香港五个入口的数据模型。然后按各市场的数据就绪情况扩展，最终仍覆盖约定的五个目的地。

真正影响上线的三个前提是：**合法且能更新的房源来源、目标校区实景覆盖、各城市可用的数据服务**。在这些尚未确定时，可以先用明确标注的演示房源验证界面，不能把演示价格、库存或区域评价当作真实结果。

## 项目资料

`research/evidence/` 保存 GitHub API 元数据、README/许可证快照和少量关键源码的只读调查副本；`research/scripts/` 保存公开元数据采集脚本。上游文件保留各自版权，调查副本不代表项目已决定采用或有权复制所有代码。

本轮未安装候选项目依赖、未运行候选网站，也未验证生产数据接口。文档中的性能指标和开发时间是后续验收目标及估算。

## 可操作验证样本

应用位于 [app/](app/)，覆盖伦敦、悉尼、新加坡、吉隆坡、香港。启动与地图密钥配置见 [样本说明](app/README.md)，验证记录见 [08-validation-sample.md](research/08-validation-sample.md)。

已有 Cesium ion 实景、校园步行路线、设施图层及 Agent 工具联动；范围与覆盖限制见 [样本说明](app/README.md)。未配置模型时右侧显示工具体验；配置后使用服务器 Agent 处理多轮对话，不能把固定测试响应作为真实模型理解能力的验收。
