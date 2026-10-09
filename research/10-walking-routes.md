# 公寓到学校的真实步行路线（2026-10-09）

## 目标与实现

房源卡片点击「到学校路线」→ 自动选中公寓并载入地图 → 显示沿道路计算的步行路线、距离、预计时间和分段指引。详情弹层和独立详情页也提供入口，手机端自动切换到城市面板。URL 的 `listing` 与 `route=walk` 支持刷新后恢复。

使用 [Valhalla 步行路由](https://valhalla.github.io/valhalla/api/route/api-reference/) 的 `costing: pedestrian`，道路来自 OpenStreetMap。步速设置为 5.1 km/h，距离及时间直接采用引擎响应；不使用驾车路线代替步行，也不以直线距离乘系数推算通勤。引擎原文指引为英文，保留道路名，不自行编造转向内容。

[官方公共演示说明](https://github.com/valhalla/valhalla/blob/master/README.md#demo-server) 提供全球路网，并要求公平使用和识别请求头。验证阶段手动顺序收集现有 30 套样本，每次间隔至少 1.1 秒，发送 `X-Client-Id: campus-atlas-rental-validation`。访客只读取本站保存的结果，不直接或经代理调用公共演示服务；本轮未向维护者发送消息。正式动态产品应采用自建 Valhalla 或有保障的商业服务，并按相应政策接入。

CesiumJS 使用独立 OSM 路线坐标。最初将粗描边折线分类到整个三维网格，出现屋顶、墙面被染色以及边缘破碎的问题；2026-10-09 根据视觉反馈改为独立的细折线。保留全部真实道路拐点，只沿原线段补充点，使用相机已加载网格的 `Scene.sampleHeight` 估计展示高度；邻近采样与高度尖峰抑制减少屋檐干扰，不额外请求最高精度瓦片。高度仅供展示，不是测绘路面高程，路线经纬度、距离、时间不变。遮挡段用 `depthFailMaterial` 淡色延续，避免将路线涂到建筑表面；起终点采用「起 / 终」圆标，路线模式隐藏重复租金及大学标签，相机在全程取景和旋转时为信息卡留空间。说明与原文指引收进「路线详情」，版权持续可见。

接口说明见 [Cesium PolylineGraphics](https://cesium.com/learn/cesiumjs/ref-doc/PolylineGraphics.html) 与 [Scene.sampleHeight](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#sampleHeight)。路线数据不从 Google 三维影像中提取。树冠、楼宇或影像网格仍可能影响高度估计；没有做逐路段现场核验。

## 来源及边界

- 本轮保存了 30 条真实路网计算结果，共 4,117 个路线坐标。标准化数据：`app/public/routes/*.json`；原始响应：[evidence/walking-routes/](evidence/walking-routes/)。每条保留请求的起终点、实际道路形状、计算日期、来源、道路吸附偏移和原文指引。
- 公寓名称、价格、位置仍是虚构样本，校区点仍是参考位置，均不代表已核验的出入口。展示的是这些坐标附近道路之间的路线，不能据此承诺真实公寓的到门通勤时间。
- 起终点保留道路吸附结果，不追加人为直线连接。偏移超过 40 米时显示具体偏移距离，并说明偏移路段未计入；大于 250 米的结果拒绝展示。
- 预计时间包含引擎道路模型影响，并非只按距离除步速。无实时封路、校门开放、楼内通行或无障碍核验；页面标明「非实时导航」及保存日期。
- 助手中的「步行 30 分钟以内」仍是待核验偏好，本轮只增加单房源路线展示，不扩大为自动通勤筛选。

每城第一套样本结果如下，全部为路网结果，不是实际房源广告：

| 城市 / 学校 | 距离 | 预计步行 | 道路起点 / 终点偏移 |
| --- | --- | --- | --- |
| 伦敦 UCL | 741 米 | 10 分钟 | 10 / 9 米 |
| 悉尼 USYD | 866 米 | 11 分钟 | 5 / 10 米 |
| 新加坡 NUS | 1,064 米 | 16 分钟 | 3 / 72 米 |
| 吉隆坡 UM | 1,160 米 | 15 分钟 | 124 / 1 米 |
| 香港 HKU | 800 米 | 13 分钟 | 8 / 14 米 |

## 验证

- `npm run test:routes` 通过：五城 30 条步行路线、坐标精度及经纬顺序、道路形状长度与距离一致性、来源、起终点匹配、错误房源 / 模式 / 坐标 / 时间的拒绝处理。
- `npm run test:sample`、TypeScript、生产构建通过；变更文件 ESLint 无错误，原有 img 优化建议保留。
- 使用 Codex 内置浏览器，桌面 1440 × 1000、手机 390 × 844。五城各第一套公寓均检查地图及路线：伦敦、悉尼、新加坡为实景建筑；吉隆坡保留影像地形限制；香港在手机端显示实景建筑及路线卡。
- 检查伦敦卡片入口、快速切换两套公寓、关闭路线后地图继续运行、指引展开、URL 刷新恢复，以及切换国家 / 城市后没有残留旧路线。
- 临时移走伦敦第三套路线文件，确认显示错误且不残留上一条路径；恢复后点击重试成功。测试文件已恢复，该开发验证产生的一次预期 404 与产品运行错误区分记录。
- 在原公网链接完成详情弹层的路线按钮、完整详情页、详情页返回城市自动载入路线；保留旧隧道，只重启构建版服务以使用新资源。
- 最终提高路线俯视角和描边宽度，复测公网 390 × 844 以及桌面全程取景：道路转弯可见、路线卡不遮挡全程，地图版权可见。最终公网浏览器警告 / 错误日志为空；页面身份正确、内容非空、没有框架错误覆盖层。早期公网默认尺寸为 1280 × 720，最终桌面截图为 1440 × 1000。
- 后续视觉优化轮次替换了上述粗描边投影：复查伦敦桌面、香港桌面及 390 × 844 手机，细折线连续、无整片屋顶染色、起终点圆标及版权可见；展开路线详情可查看来源、保存日期和高度展示边界。复查公网关闭后重新显示路线与全程取景；TypeScript、路线数据校验和生产构建通过，ESLint 无错误（保留原有 img 建议）。本轮未重做其余三城的渲染验收，早期截图仍对应旧渲染方式。

## 维护与分享

```sh
cd /Users/weiyuan/personal/rentApartment/app
npm run collect:routes                 # 已保存的结果直接复用
npm run collect:routes -- --refresh     # 明确需要重算时才运行
npm run test:routes
npm run build
node scripts/share-preview.mjs reload  # 更新构建版服务，保留运行中的隧道地址
```

当前演示：<https://provides-restrict-fall-cir.trycloudflare.com/?city=london&listing=london-1&route=walk>。链接持续条件沿用 [临时分享说明](09-temporary-sharing.md)。

浏览器截图：[悉尼](evidence/walking-routes/ui/sydney.jpg)、[新加坡](evidence/walking-routes/ui/singapore.jpg)、[吉隆坡](evidence/walking-routes/ui/kuala-lumpur.jpg)、[香港手机端](evidence/walking-routes/ui/hong-kong-mobile.jpg)、[伦敦公网](evidence/walking-routes/ui/london-public.jpg)、[伦敦公网手机端](evidence/walking-routes/ui/london-public-mobile.jpg)。其他城市截图记录功能验收时的视角，伦敦公网截图记录最终较高俯视角。
