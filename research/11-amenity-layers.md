# 地图周边设施图层（2026-10-09）

> 本文保留首版三个分类、874 条地点的历史验收记录。当前扩展版为 21 个分类开关、15,726 条地点，查询证据见 `evidence/amenities/`，首版原始证据另存 `evidence/amenities-basic-v1/`；最新说明见 [学生生活地图扩展](12-student-amenities.md)。

## 范围与交互

在原有三维地图上增加「医院 / 便利店 / 商场」三个独立复选框，默认关闭。可同时勾选，取消只移除对应类别；切换城市保留类别选择并立即清掉上一城图层。首次勾选自动连接已配置的三维地图。

医院采用玫红色十字、便利店采用绿色店铺、商场采用紫色购物袋。密集标记按 Cesium 的屏幕空间聚合成数量，混合类别用蓝灰色，点击数量放大该组；「查看周边」取景已选类别的全部地点。「列表」提供可用键盘操作的同一批地点，按距大学的直线距离排列。

点击地点标记或列表条目，显示名称、来源地址、距所选公寓的**直线距离**以及 OSM 原始记录链接。选中地点使用独立、不聚合的图层，保证标记可见。设施详情暂时使用底部信息卡，关闭后恢复原房源 / 步行路线卡；路线折线持续保留，设施开关不会删除或重算路线。

## 数据及来源

数据来自 [OpenStreetMap](https://www.openstreetmap.org/copyright)，通过 [Overpass API](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) 收集。只查询五个固定大学坐标周边 3 公里，各城一次，之后保存复用；没有做整座城市或全球抓取，也不让访客直接请求公共 Overpass。

分类按官方标签：[amenity=hospital](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dhospital) 或 `healthcare=hospital`、[shop=convenience](https://wiki.openstreetmap.org/wiki/Tag:shop%3Dconvenience)、[shop=mall](https://wiki.openstreetmap.org/wiki/Tag:shop%3Dmall)。医院、便利店和商场分别查询，未将所有超市、诊所或零售店混为同一类别。

| 大学校区 | 医院类记录 | 便利店 | 商场 | 合计 |
| --- | ---: | ---: | ---: | ---: |
| 伦敦 UCL | 26 | 349 | 10 | 385 |
| 悉尼 USYD | 5 | 148 | 20 | 173 |
| 新加坡 NUS | 3 | 45 | 13 | 61 |
| 吉隆坡 UM | 9 | 117 | 15 | 141 |
| 香港 HKU | 8 | 81 | 25 | 114 |
| 合计 | 51 | 740 | 83 | 874 |

这些是**收录记录数**，不是已核验的完整设施普查。OSM 可能缺漏、重复或分类不准确，医院仍可能包含分院和院内医疗设施。已移除明确 `disused / abandoned / demolished=yes` 的对象，并排除名称明确是太平间、独立诊所、检验所、影像中心、大堂等且与医院分类明显冲突的记录；原始响应保留，可审计过滤结果。对同名、同类且相距不足 40 米的记录去重，不将不同连锁店分店合并。

节点保留原坐标，区域对象使用 Overpass 返回的包围盒中心，并在详情注明「区域中心，非入口」。无名称记录显示「未命名某类（OSM）」，不编造商户名。营业状态、服务范围、急诊、出入口和到达路线未核验；不按地点多少推导安全分或购物评分。

查询过程中遇到一次 HTTP 429 后停止该轮，保留已收集数据；后续使用更长顺序间隔及限流退避，补齐剩余两城，没有切换实例绕开限流。公开服务的[使用说明](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)不建议作为面向普通用户产品的持续后端；正式动态产品需要自建或有保障的 POI 服务。

## 文件与维护

- 前端数据：`app/public/amenities/<city>.json`，包含数据日期、OSM 数据基准时间、固定查询范围、OSM ID、类别标签及代表点。
- 原始证据和查询：[evidence/amenities/](evidence/amenities/)。派生数据库沿用 OpenStreetMap 的 ODbL 许可，界面显示来源及快照时间，详情可访问原记录。
- 渲染采用独立 `CustomDataSource`，与房源 / 路线实体分离；参考 [Cesium EntityCluster](https://cesium.com/learn/cesiumjs/ref-doc/EntityCluster.html)。

```sh
cd /Users/weiyuan/personal/rentApartment/app
npm run collect:amenities                 # 已保存数据直接复用
npm run collect:amenities -- --normalize   # 从本地原始证据重新规范化，不请求网络
npm run collect:amenities -- --refresh     # 明确需要新快照时才顺序查询
npm run test:amenities
npm run typecheck
npm run build
node scripts/share-preview.mjs reload     # 更新原临时分享地址
```

数据校验已通过：五城 874 条均有原始 OSM 证据，逐项核对原坐标和类别标签；拒绝错城、错误范围、无效经纬度、未知类别、标签冲突、重复 ID、恶意 ID 及无效日期。真实查询范围是大学周边 3 公里，移动地图到其他区域不会自动加载新地点。

## 本轮验收

- 五城通过实际国家 / 城市选择器切换，类别选择保留，数量依次匹配各城快照；伦敦、新加坡点击医院，香港手机端点击商场，名称、来源及直线距离正确显示。
- 伦敦多选三类显示 385 处，取消医院剩 359 处，只保留商场为 10 处，全部取消后地图设施标记清空，步行路线仍在。实际点击地图图标与数量聚合、使用地点列表定位均已检查。
- 检查悉尼、新加坡及香港的实景设施标记；吉隆坡在影像地形上显示，覆盖限制提示与筛选框不重叠。香港使用 390 × 844 手机视口，复选框、地点列表、底部设施卡及地图版权可用。
- 临时移走尚未读取的新加坡 JSON，确认显示读取错误且不保留悉尼地点；恢复同一文件后「重试」载入 61 处。文件已恢复，此验证产生的一次本地 404 为预期结果。
- TypeScript、变更文件 ESLint、设施数据校验、既有路线校验及生产构建通过；ESLint 仅保留已有 img 优化建议。通过现有隧道更新构建版服务，原分享地址保持不变。
- 公网构建版伦敦页面已实际检查：三类复选框均选中、显示 385 处，彩色设施图标与数量聚合和 741 米步行路线同时可见；浏览器未记录警告或错误。桌面截图保存在 `/private/tmp/rentApartment-amenities-public-desktop.jpg`。
