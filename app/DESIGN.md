---
name: Campus Atlas — 城市漫游
description: 已选定并获生产集成批准的 B 方案；适用于租房工作区。
colors:
  primary: "#c1dfc0"
  shell: "#122326"
  surface: "#172f31"
  surface-soft: "#203c3b"
  foreground: "#ecf3e9"
  muted: "#b1c4bd"
  ink-secondary: "#c9d9d1"
  brand-soft: "#294f45"
  border: "#45605a"
  floating-panel: "#102c2df2"
  assistant-surface: "#f6f8f0f5"
  assistant-ink: "#203e33"
  assistant-primary: "#275944"
  dialog-surface: "#173432"
typography:
  display: {fontFamily: "Atlas Manrope, sans-serif", fontSize: "65px", fontWeight: 400, lineHeight: 1, letterSpacing: "-.04em"}
  headline: {fontFamily: "Atlas Manrope, sans-serif", fontSize: "27px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-.04em"}
  title: {fontFamily: "Atlas Manrope, sans-serif", fontSize: "15px", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-.025em"}
  body: {fontFamily: "Atlas Manrope, PingFang SC, Microsoft YaHei, sans-serif", fontSize: "12px", lineHeight: 1.85}
  label: {fontFamily: "Atlas Manrope, sans-serif", fontSize: "10px"}
  map-price: {fontFamily: "Atlas Manrope, PingFang SC, sans-serif", fontSize: "13px", fontWeight: 600, lineHeight: "19px", letterSpacing: "-.02em"}
  map-place: {fontFamily: "Atlas Manrope, PingFang SC, sans-serif", fontSize: "12px", fontWeight: 600, lineHeight: "19px", letterSpacing: "-.02em"}
rounded:
  control: "5px"
  photo: "10px"
  floating-panel: "14px"
  dialog: "16px"
spacing:
  compact: "8px"
  control-inline: "10px"
  panel-inline: "15px"
  panel-gap: "20px"
  workspace-block: "22px"
components:
  route-button: {backgroundColor: "#264a41", textColor: "#e0efda", rounded: "{rounded.control}", padding: "8px 10px", height: "34px"}
  route-button-selected: {backgroundColor: "{colors.primary}", textColor: "#173b30", rounded: "{rounded.control}", padding: "8px 10px", height: "34px"}
  route-button-selected-hover: {backgroundColor: "#d8ebce", textColor: "#173b30"}
  filter: {backgroundColor: "#1b3535", textColor: "#e0ece0", rounded: "{rounded.control}", height: "34px"}
  floating-panel: {backgroundColor: "{colors.floating-panel}", textColor: "{colors.foreground}", rounded: "{rounded.floating-panel}", padding: "20px 15px 0"}
  assistant-panel: {backgroundColor: "{colors.assistant-surface}", textColor: "{colors.assistant-ink}", rounded: "{rounded.floating-panel}"}
  map-price: {backgroundColor: "#fffdf7", textColor: "#244b3b", typography: "{typography.map-price}", rounded: "8px", padding: "6px 10px", height: "33px"}
  map-price-selected: {backgroundColor: "#245744", textColor: "#fffdf7", typography: "{typography.map-price}", rounded: "8px", padding: "6px 10px", height: "33px"}
  map-campus: {backgroundColor: "#fffdf7", textColor: "#334b3c", typography: "{typography.map-place}", rounded: "8px", padding: "6px 10px", height: "33px"}
  map-place: {backgroundColor: "#fffdf7", textColor: "#244b3b", typography: "{typography.map-place}", rounded: "8px", padding: "6px 9px", height: "33px"}
---

# Design System: Campus Atlas 租房工作区

## Overview
**Creative North Star: "城市漫游 · The Observatory"**
深青外壳让城市成为连续背景；房源与助手浮于地图两侧，照片、价格和路线承担主要信息层级。浅绿标记当前操作，助手保持独立浅色阅读面。
状态：**selected / production-approved**（2026-10-13）。用户已选定 B；本地生产集成已通过完成审查，并已发布 Cloudflare。
本规范仅约束租房工作区，不建立登录页或完整房源页的改版权威。项目没有 PRODUCT.md，本文仅记录已实现设计与已确认选择。
生产入口为 `app/page.tsx → components/rental-explorer.tsx → components/design-lab/design-lab.tsx`（`preview=false`）；根页固定 B，隐藏 A/B、样片播放栏与样片进度栏。普通状态地址为 `/?city=…&listing=…&route=walk`。
`/design-lab` 使用 `preview=true`，继续保留 A/B 比较与动效样片；其[候选记录](components/design-lab/DESIGN.md)是历史预览文档。
**Key Characteristics:**
- 连续城市背景与有层次的浮动工作面。
- 自托管 Manrope、紧凑操作与清晰照片。
- 真实路线几何、明确演示声明与可减少动态效果。

## Colors
主色为浅绿操作色；深青构成背景与容器，浅色助手承担长文阅读。
| 角色 | 规范 token | 使用位置 |
| --- | --- | --- |
| Primary | `{colors.primary}` / `{colors.brand-soft}` | 已选路线、收藏、定位与柔和状态底 |
| Neutral 深色 | `{colors.shell}` / `{colors.surface}` / `{colors.floating-panel}` | 外壳、表面与地图上浮层 |
| Neutral 文字 | `{colors.foreground}` / `{colors.muted}` / `{colors.ink-secondary}` | 主文、次文与辅助操作 |
| Neutral 阅读 | `{colors.assistant-surface}` / `{colors.assistant-ink}` | 助手阅读面；局部操作用 `{colors.assistant-primary}` |
| Neutral 分隔 | `{colors.border}` | 控件边线与分隔 |
**The 阅读分区 Rule.** 助手保留自己的浅色背景与深绿文字、操作色，不直接继承外壳的浅绿文字体系。

## Typography
英文及工作区正文使用自托管 Atlas Manrope（Manrope，400/600/800）；中文回退 PingFang SC / Microsoft YaHei。城市大标题、列表标题、房源标题与助手正文分别使用 frontmatter 的 display / headline / title / body。
中文桌面列表标题为 27px / 1.3、600；价格为 Manrope 25px / 1、600。详情标题为 Manrope 34px / 1.1、600；目的地选择弹层仍沿用现有衬线标题，不据此扩展整站字体规范。
来源及 OFL 许可见[字体清单](public/fonts/design-lab/sources.json)。
地图价格使用 13px / 19px、600；学校与已选设施使用 12px / 19px、600。≤600px 时价格为 12px，学校与设施为 11px；继续沿用 Atlas Manrope，数字等宽，不增加字体。

## Layout
桌面工作区为 `306px minmax(0,1fr) 310px`，间距 20px，内边距 `22px 20px`；地图铺满工作区，两侧浮层位于地图之上。宽度 ≥1500px 时两侧改为 330px、内边距 24px。
宽度 ≤1100px 切换房源/城市/助手单面板；房源先双列，≤600px 改单列。英文手机筛选保持单行、控件高 32px；390px 核对时两个选择器各 159×32px。桌面高度 ≤800px 启用紧凑照片与标题。
详情桌面为 `1.15fr 1fr` 双列，宽 `min(900px,calc(100vw - 40px))`；≤600px 单列、最大高 `calc(100dvh - 50px)`，内部滚动。
无有效城市参数时保留国家/城市选择；地图按需加载。路线取景避让两侧浮层、设施工具、路线信息与地图控件，尺寸变化重新适配。设施路线也使用紧凑标题与工具栏；信息卡最高 190px，完整指引、收起及来源操作保留在内部滚动区域。

## Elevation & Depth
深色浮层采用 18px 背景模糊与 `0 12px 32px #051d2c47,inset 0 1px 0 #cce2d927`；详情使用 `0 24px 80px #081e1d55`。列表单项保持透明底与分隔线。
**The 城市连续 Rule.** 桌面地图保持连续背景，深度由两侧浮层与浅色阅读面建立。

## Shapes
控件 5px、照片 10px、工作浮层 14px、详情 16px；桌面详情照片为 12px。键盘焦点为当前局部主色的 2px 外轮廓、偏移 4px；收藏、定位与筛选保留按下语义。

## Components
路线按钮以柔和深绿为默认底，选中后浅绿填充；桌面精细指针悬停强化状态。导航使用紧凑分段填充，手机改为三栏切换；房源信息标签以文字与间隔点呈现，照片房型标签保留小型浅色底。
助手输入保留浅色背景、9px 圆角、12px 内边距及独立深绿发送按钮。地图、聊天、API、认证、筛选、收藏与数据继续复用既有实现。
照片点击打开当前照片对应详情；开合飞行动效使用 WAAPI（280ms，`cubic-bezier(0.77,0,0.175,1)`），真实路线按既有坐标逐段显现（900ms），相机适配 1.2s。减少动态效果时不创建飞行副本、路线立即完整呈现、相机时长为 0；重复动画与卸载清理旧动画和副本。
照片保留“风格参考”，房源保留虚构演示、不可预订说明；[照片来源](public/photos/sources.json)及 Cesium / Google 署名继续保留。
地图价格、学校和已选设施使用原生 DOM 按钮与 Lucide SVG，8px 圆角、33px 高；默认米白底，当前房源为深绿底米白字，学校帽形图标为 `#9b793e`，设施图标沿用类别色。标签随 Cesium `postRender` 投影到整数 CSS 像素，地形高度最多每 500ms 重新采样；当前房源集最多显示 8 个原生标签，保留点击与键盘操作。未选设施为 32px SVG 徽章，源图按 3 倍尺寸生成，单层描边；紧凑聚合从 2 个设施起，保留原拾取 ID。
已选设施与当前价格相碰时，只移动设施标签；候选位置必须位于视口内并避让设施工具、信息卡和价格。细引线与地面点仍指向原坐标，点击回调保持原设施。画布启用原生像素密度、初始化缩放上限为 2 倍，保留硬件抗锯齿并关闭 FXAA；这不构成帧率承诺。
本轮标记精修已完成本地交互核对、类型检查、构建与定向审查（Resolved — ship），并发布至原 Cloudflare 地址；定向 lint 为 0 errors / 2 existing warnings。390×844 [线上手机证据](../research/evidence/map-markers/live-mobile.png)中 £385 与 Sainsbury's 标签互不重叠，引线可见；本地已核对价格点击、相机旋转、三类共 385 个设施、设施 Enter 操作。线上复验首次加载、大学定位、三类设施切换、直接点击医院图标、便利店选择与 119m / 约 2min 真实路线，健康检查正常且该验证标签页 warning/error 日志为空。未增加模型调用、图片、字体、数据、后端或认证改动；[本轮发布记录](../research/25-map-marker-clarity.md)。
本轮主代理已核对切图、收藏、Studio 筛选、详情、路线 URL、五市场选择与 Sydney→London、登录及游客返回；英文 390px 核对未见横向溢出。类型检查与 Cloudflare 构建通过，定向 lint 为 0 errors / 5 warnings（4 处 img 优化及 1 处既有 Hook 依赖提示），detector 为 `[]`；完成审查为本地范围 ship。
核对截图：[桌面](.impeccable/review/spatial-production/desktop.png)、[手机](.impeccable/review/spatial-production/mobile.png)、[用户视口](.impeccable/review/spatial-production/user-644.png)。
当前发布：Worker `021b26db-7fb0-4c76-a583-488ef37c0791`，Pages `e111ab87`；本轮标记清晰度验证见上述记录。此前 B 正式发布（Worker `12ee94e2-db29-4947-b19c-84adf7dc7a93`，Pages `55fde24f`）已核对根页为 B、无预览栏，验证通过五城市与 D1 持久化；这些后台路径本轮未改动、未重复执行全套检查。
线上两轮 AI 核对：英文最近 Sainsbury's（约 77m），随后中文真实步行路线（119m、约 2min），地图均同步；[线上证据](../research/evidence/spatial-production/live-chat.json)。设计值提取自[共享样式](app/design-lab/design-lab.css)。

## Do's and Don'ts
- Do 使用已选定 B 作为生产工作区，保留预览页的比较能力。
- Do 保留来源、地图署名、演示声明、键盘焦点与减少动态效果行为。
- Do 保留国家/城市选择、按需地图加载与普通生产 URL。
- Don't 将本规范扩展为登录页或完整房源页的改版结论。
- Don't 将本地核对、构建或审查结果写成已部署、全城三维覆盖或已测帧率。
