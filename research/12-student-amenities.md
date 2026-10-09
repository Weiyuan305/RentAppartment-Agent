# 学生生活地图扩展（2026-10-09）

## 已实现的范围

在医院、便利店、商场基础上增加七组十八个开关，共二十一个类别。额外分类放在可滚动的「更多设施」面板，地图与选择器共用 Lucide 线条图标；聚合最多显示三个分类图标及总数，选中地点单独显示。

| 分组 | 新增开关 |
| --- | --- |
| 公共交通 | 地铁／铁路、公交站 |
| 买菜购物 | 超市、亚洲食品店 |
| 校园学习 | 大学建筑、图书馆、自习空间 |
| 日常医疗 | 药店、诊所 |
| 吃饭喝咖啡 | 餐厅、咖啡店、食堂／美食广场 |
| 运动休闲 | 健身房、球场／运动场、公园 |
| 生活服务 | 洗衣店、打印店、快递收寄 |

列表按所选演示公寓的直线距离排序，每次显示四十处。可选择直线 500 米、1 公里、2 公里范围；菜系筛选仅作用于餐厅、咖啡店、食堂，按 OSM 的 cuisine 标签识别，统一大小写后匹配。切换城市重置距离和菜系，但保留分类偏好。没有把直线距离换算成步行时间。

## 实际采集结果

通过 Overpass 保存五校周边三公里的 OSM 数据，先用包围框检索，再按归一化点坐标过滤到精确圆形范围。五城最终请求均由主站成功返回；失败、超时或带 remark 的不完整响应不作为快照。

| 城市 / 校区 | 唯一记录 |
| --- | ---: |
| 伦敦 / UCL | 7,005 |
| 悉尼 / USYD | 3,543 |
| 新加坡 / NUS | 1,579 |
| 吉隆坡 / UM | 1,885 |
| 香港 / HKU | 1,714 |
| 合计 | 15,726 |

每条记录保存 OSM ID、原始点或区域包围框中心、名称、分类依据标签、地址及来源时间。查询和原始响应位于 `evidence/amenities/`，前端数据位于 `../app/public/amenities/`。区域中心明确标为「非入口」。同类、同名、同 ref、四十米内的记录去重；不同 ref 的公交站不合并。

分类是可重叠的筛选面：亚洲食品超市也属于超市，官网确认的自习空间可以同时属于图书馆或大学建筑。因此分类计数相加不等于唯一记录数。

没有按名字猜测亚洲食品店；依据明确 cuisine / origin 标签。新加坡、吉隆坡、香港该项收录为零，表示标签证据不足，不表示当地没有。大学建筑可能包括教学、研究、行政用途；food_court 归为「食堂／美食广场」，不宣称都是校内食堂。站点网络资料只对交通类别展示，不代表实时班次。access、运营机构等按原始记录展示，使用资格与营业状态待核验。

采集按城市顺序进行，成功城市之间间隔十秒；默认跳过已有第二版快照，`--refresh` 才重取，`--normalize` 只从已保存证据重新归一化。访客只取本站 JSON，浏览地图不会请求 Overpass。

## 自习空间的官方补充依据

OSM 普遍缺少单独的自习空间标签。本轮逐校确认一处现有 OSM 地点与大学官网的学习空间介绍，在原坐标不变的前提下补充官方链接。该项不是全校空间普查，也不保证公众可以进入。

| 城市 | 地点 / OSM ID | 官方依据 |
| --- | --- | --- |
| 伦敦 | Student Centre / way/681098586 | [UCL Student Centre](https://www.ucl.ac.uk/library/using-library/libraries-and-study-spaces/student-centre) |
| 悉尼 | Fisher Library / way/16784706 | [USYD Study spaces](https://www.sydney.edu.au/students/study-spaces.html) |
| 新加坡 | 中央图书馆 / way/54583490 | [NUS Central Library](https://www.nus.edu.sg/nuslibraries/spaces/our-libraries/central-library) |
| 吉隆坡 | Perpustakaan Peringatan Za'ba / way/995983168 | [UM Study spaces](https://umlib.um.edu.my/study-spaces) |
| 香港 | 香港大學圖書館總館 / way/898471121 | [HKU Main Library study places](https://lib.hku.hk/mainlib/studyplace.html) |

映射保存在 `../app/lib/study-space-references.ts`。悉尼 Fisher 原标签仅为大学建筑，结合官网将其基础类别纠正为图书馆；校验脚本允许且仅允许这条有来源的覆盖。

## 公寓到设施的真实步行路线

点击「从公寓步行到这里」后，本站 `/api/amenity-route` 校验同城的样本公寓和已收录 OSM ID，再调用 [FOSSGIS OSRM 公共步行服务](https://routing.openstreetmap.de/about.html)。它与已有、预先保存的 Valhalla 校园路线分别标明来源。

显示服务返回的 GeoJSON 路网折线、实际距离、引擎预计时间和分段指引，不按直线或自设速度估算。道路吸附偏移超过四十米会显示说明；偏移超过二百五十米或响应异常则拒绝当作有效路线。演示公寓坐标和场所中心仍不是核验过的入口。

根据公共服务的使用政策，设置明确客户端识别头，单进程一次只请求一条路线，启动间隔至少 1.1 秒，每 UTC 日最多一百次上游请求；相同在途请求合并，成功结果缓存一天。界面及 API 都校验来源、城市、目标、经纬度、距离、时间和步骤；不接受任意 URL 或坐标作为代理。地图保留 OSM 署名和纠错入口。

这是临时单进程体验的保护措施，进程重启会重置内存配额，多实例部署前需共享配额或改用自建／有保障的路线服务。没有新增付费 API 或保存用户当前位置。

实测样本：伦敦 Chapter House → Lidl，直线 229 米，步行路网 280 米，约四分钟；香港样本公寓 → HKU 总馆，直线 430 米，步行路网 624 米，约九分钟。回归测试的医院路线原始响应见 `evidence/amenity-routes/london-2-hospital.json`。

## 验证与边界

- 数据校验：五城 15,726 条逐项匹配原始坐标、标签和证据，覆盖新增类别、自习空间官方映射及无效数据拒绝。
- 路线校验：真实 OSRM 夹具的三十个点、目标和来源守卫、相同请求合并、缓存、上游请求限流通过；原有三十条学校路线仍通过。
- 浏览器：五城逐个切换并检查七组数量与官方自习地点；伦敦检查直线范围、菜系、地点定位、地点路线和学校路线恢复；香港检查 390 × 844 面板滚动、无横向溢出、路线详情和地图署名。桌面视口为 1440 × 1000。
- TypeScript、变更文件 ESLint、生产构建通过；ESLint 仅有既存图片优化建议。构建版接口拒绝跨城市组合并返回 400；公网版本实际显示扩展分类，列表由四十条增加到八十条，Lidl 步行路线返回 280 米／约四分钟，浏览器未记录警告或错误。
- 原临时分享地址已更新，隧道及防休眠进程保持运行。验收截图位于 `evidence/student-amenities/`；手机地点路线卡限制高度并可滚动，展开资料前保留地图可视区域。

数据不是实时设施普查，超出校区三公里不自动搜索。吉隆坡三维细节覆盖限制沿用既有提示。治安／夜间安全图层仍需单独验证各地官方数据；例如 [英国街道犯罪 API](https://data.police.uk/docs/method/crime-street/) 的数据按月更新且位置匿名化，不能把点位或缺失数据直接变成某条步行路线的「安全分」。本轮不增加未经验证的安全评分。

分类依据参考：[OSM 亚洲超市](https://wiki.openstreetmap.org/wiki/Asian_supermarket)、[OSM 大学](https://wiki.openstreetmap.org/wiki/University)、[OSM 图书馆](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dlibrary)、[Overpass API 与公共实例](https://wiki.openstreetmap.org/wiki/Overpass_API)。
