---
name: Campus Atlas /design-lab — DRAFT A/B
description: 仅记录独立预览路线的两个候选世界；尚未选择生产方案。
colors:
  editorial-bg: "#f2f0e9"
  editorial-surface: "#fcfbf7"
  editorial-ink: "#233d32"
  editorial-muted: "#687267"
  editorial-primary: "#275944"
  editorial-soft: "#e8eddf"
  editorial-border: "#dbdfd2"
  spatial-bg: "#122326"
  spatial-surface: "#172f31"
  spatial-ink: "#ecf3e9"
  spatial-muted: "#b1c4bd"
  spatial-primary: "#c1dfc0"
  spatial-soft: "#294f45"
  spatial-border: "#45605a"
typography:
  editorial-display: {fontFamily: "Atlas Editorial, Songti SC, serif", fontSize: "44px", fontWeight: 400, lineHeight: 0.98, letterSpacing: "-.025em"}
  spatial-display: {fontFamily: "Atlas Manrope, sans-serif", fontSize: "27px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-.04em"}
  body: {fontFamily: "Atlas Manrope, PingFang SC, Microsoft YaHei, sans-serif"}
rounded:
  control: "5px"
  photo-map: "12px"
  floating-panel: "14px"
  dialog: "16px"
spacing:
  editorial-gap: "22px"
  spatial-gap: "20px"
components:
  editorial-route-selected: {backgroundColor: "{colors.editorial-primary}", textColor: "#fff", rounded: "{rounded.control}", padding: "8px 10px"}
  spatial-route-selected: {backgroundColor: "{colors.spatial-primary}", textColor: "#173b30", rounded: "{rounded.control}", padding: "8px 10px"}
---

# Design System: Campus Atlas /design-lab（DRAFT）

> 2026-10-13 状态更新：本文保留为历史 A/B 双候选预览记录；用户现已选择 B「城市漫游」用于生产工作区。当前生产规范见 [根 DESIGN.md](../../DESIGN.md)，`/design-lab` 仍保留两案比较。下文候选 token 与当时验收记录不作改写。

## Overview
**Creative North Star: "A 生活杂志 / B 城市漫游"**
两套可操作的候选世界同处 `/design-lab`，切换时地图保持挂载。A 以暖白纸张、深绿文字、建筑摄影和衬线标题呈现生活杂志；B 以深色外壳、浅绿操作色、完整城市背景与浮动面板呈现城市漫游。
**局部草案边界。** 本文与 sidecar 仅约束该预览目录，不建立全站设计权威；两案尚未选作生产方案。共享后端、AI、认证及主应用源码沿用现有实现，本轮未部署。AI 与地图正常使用仍消耗既有服务账户额度。
来源：[CSS](../../app/design-lab/design-lab.css)、[交互实现](./design-lab.tsx)、[地图](./concept-city-map.tsx)、[路线显示](./route-display.ts)、[样片与核对记录](../../../research/23-visual-concept-preview.md)。下列值为现有代码提取值。

## Colors
| 角色 / CSS token | A · 生活杂志 | B · 城市漫游 |
| --- | --- | --- |
| 页面 `--background` | `{colors.editorial-bg}` | `{colors.spatial-bg}` |
| 表面 `--surface` | `{colors.editorial-surface}` | `{colors.spatial-surface}` |
| 主文 `--foreground` | `{colors.editorial-ink}` | `{colors.spatial-ink}` |
| 次文 `--muted-foreground` | `{colors.editorial-muted}` | `{colors.spatial-muted}` |
| 操作 `--primary` / 柔和底 `--brand-soft` | `{colors.editorial-primary}` / `{colors.editorial-soft}` | `{colors.spatial-primary}` / `{colors.spatial-soft}` |
| 分隔 `--border` | `{colors.editorial-border}` | `{colors.spatial-border}` |
B 的助手是独立浅色阅读面（`#f6f8f0f5`），内部文字为深绿（`#203e33`），并局部恢复深绿操作色（`#275944`）。

## Typography
| 用途 | A | B |
| --- | --- | --- |
| 英文列表标题 | Atlas Editorial，400，44px/.98 | Atlas Manrope，600，27px/1.1 |
| 中文列表标题 | Songti SC / STSong / SimSun，32px/1.25 | Atlas Manrope / PingFang SC，600，27px/1.3 |
| 价格 | Atlas Editorial，400，33px/1 | Atlas Manrope，600，25px/1 |
正文与操作使用 Atlas Manrope；Atlas Editorial 对应 Instrument Serif。两者均自托管；[字体来源](../../public/fonts/design-lab/sources.json)、[Instrument Serif OFL](../../public/fonts/design-lab/instrument-serif-OFL.txt)、[Manrope OFL](../../public/fonts/design-lab/manrope-OFL.txt)记录来源与许可。

## Layout
| 桌面默认结构 | A | B |
| --- | --- | --- |
| 工作区列 / 间距 / 内边距 | `322px minmax(0,1fr) 300px` / 22px / `24px 30px 18px` | `306px minmax(0,1fr) 310px` / 20px / `22px 20px` |
| 空间关系 | 平面房源栏、独立画框地图、纸张色助手 | 地图绝对定位铺满工作区；两侧面板浮于地图之上 |
断点为宽度 1500px、1300px、1100px、600px，另有桌面高度 800px 的紧凑规则。1100px 及以下改为房源/城市/助手单面板切换；房源先为双列，600px 及以下单列。手机筛选为单行，英文控件高 32px；详情改为单列，最大高 `calc(100dvh - 50px)`，内部可滚动。
**可见路线规则。** 路线相机按真实东西/南北跨度适配，避让设施工具栏、路线信息、地图控件及 B 的两侧浮层；尺寸变化重新取景，几何与距离不变。

## Elevation & Depth
| 材质 | 实际值 / 用途 |
| --- | --- |
| A 房源栏 | 无阴影、无外卡片背景；边线分段，地图独立成框 |
| B 浮层 | `#102c2df2`、`blur(18px)`；`0 12px 32px #051d2c47,inset 0 1px 0 #cce2d927` |
| 详情弹层 | `0 24px 80px #081e1d55`，将图片与信息置于同一表面 |

## Shapes
操作控件圆角 5px；A 照片与地图 12px；B 照片 10px、浮层 14px；详情 16px。A 导航通过底线标记当前页，B 导航通过浅绿填充标记。预览内键盘焦点为主色 2px 外轮廓、偏移 4px；保留收藏、定位与方案按钮的按下语义。

## Components
**图片—详情—路线签名。** 样片选择当前结果第二套房源（仅一套时取第一套），将当前照片飞入详情并收回，再展示真实到校路线。图片使用 Web Animations API（280ms，`cubic-bezier(0.77,0,0.175,1)`）；路线沿既有坐标逐段显现（900ms），适配相机为 1.2s。详情保留完整详情、城市定位、到校路线三个入口。
停止、手动指针操作、非 Tab 键操作、切换方案/城市/筛选或 AI 状态应用会中止后续样片步骤；详情 Escape 关闭也会停止样片。飞行图片正常收尾；重复动效取消旧动画并移除旧 clone，卸载清理样片、动画与 clone，路线清理取消 RAF 和监听。
减少动态效果时，CSS 动画/过渡关闭，图片不创建飞行 clone，路线立即完整呈现，路线适配相机用 0s，样片列表定位直接滚动。照片保留“风格参考”标记，房源保留虚构样本说明；照片复用现有资产，详见[照片来源](../../public/photos/sources.json)，未复制调研网站摄影或商标。地图保留 Cesium / Google 署名及既有配置。
定向复核结论：键盘取消、路线取景与设施 CTA 裁切已处理，可交付隔离预览。主代理本地核对了切图、收藏/取消、Studio 筛选；真实 AI 返回最近 Sainsbury's Local（直线约 77m），地图同步 1 处；Chapter House → UCL 真实路线为 844m、约 11min。1280×720 与 390×844 未观察到横向溢出；减少动态效果下图片过渡 0s、无飞行 clone；本次核心流程 warning/error 均为 `[]`。

## Do's and Don'ts
- **Do** 保持两个 DRAFT 世界可原位比较，优先让照片、价格、路线与助手阅读清楚。
- **Do** 保留来源、地图署名、演示声明与取消/减少动态效果行为。
- **Don't** 将本文提升为主应用或全站规范；选定生产世界需要后续明确决定。
- **Don't** 将本地核心流程核对扩写为已部署、全城三维覆盖或已测帧率；本轮未测 FPS、低端设备功耗及全部城市覆盖。
