# Campus Atlas：前端质感、布局与动效调研及修正

日期：2026-10-14。范围：保留已选 B「城市漫游」视觉和现有业务功能，改善工作区、地图浮层、聊天、详情与规划弹层。没有引入新的动画依赖。

## 调研结论和证据边界

对这个高频使用的找房工具，优先级应是：信息能看懂、操作好找到、状态明确、位置稳定，再用短动效解释变化。以下是具体来源，不是把论坛意见当成用户研究结论。

| 来源 | 可借鉴的建议 | 在本项目的应用 |
| --- | --- | --- |
| [Reddit / UXDesign：Feedback on UI](https://www.reddit.com/r/UXDesign/comments/1l1vbkg/feedback_on_ui_appreciate_any_thoughts/) | 评论指出同角色文字样式不一致、按钮形状混用、低对比和信息争夺注意力。属于社区个案意见。 | 同组图标按钮使用统一尺寸、圆角、中心轴；提升正文可读性。 |
| [Reddit / webdev：Pointless trends](https://www.reddit.com/r/webdev/comments/1m5big7/whats_the_most_pointless_trend_in_modern_web/) | 讨论批评滚动劫持、等待内容入场、无法打断的动画；也有人认可简短抽屉过渡。 | 不添加滚动劫持或反复播放的聊天入场；动效只辅助展开与反馈。 |
| [Hacker News：Invisible Details of Interaction Design](https://news.ycombinator.com/item?id=36669249) | 对微交互价值存在不同意见，但遮挡正文、低对比图标、丢失阅读位置是讨论中的实际抱怨。 | 保留已有聊天阅读位置修复；检查浮层、关闭按钮、可发现性与键盘路径。 |
| [Emil Kowalski：You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations) | 动效需要明确目的；频繁操作应更快、更克制；普通 UI 过渡通常应短于 300ms。 | 图层和路线详情采用 180ms、4px 的轻量展开；高频按钮即时反馈。 |
| [Rauno Freiberg：Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design) | 空间关系、可打断操作、使用频率和目标大小决定交互是否自然。 | 保持两侧面板的原有位置与开合方向，扩大命中区域，保留操作习惯。 |
| [Vercel：Web Interface Guidelines](https://vercel.com/design/guidelines) | 光学对齐、明确状态、图标可访问名称、键盘操作、长内容与本地化需要一起验证。 | 真实渲染测量间距，中英文和多断点检查，规划标签页补充键盘行为。 |
| [W3C：WCAG 2.2 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 最小目标原则为 24×24 CSS px，另有间距等例外。 | 本项目采用更宽松的设计目标：桌面图标按钮 36px、手机主要操作 44px；44px 是项目选择，不是把所有控件都称为 WCAG 强制要求。 |

### X / Twitter 的检查范围

检索了 `@emilkowalski`、`@raunofreiberg` 的界面与动效内容。搜索可见的 [Rauno 镜像摘要](https://w.twstalker.com/raunofreiberg)提到清晰层级、减少重复和保留操作习惯；这只是发现线索，未作为技术实现依据。直接打开 [Emil 的一条 X 原帖](https://x.com/emilkowalski/status/2016136390178636051) 返回 403，无法核实完整正文或视频，因此不声称完成 X 时间线或视频评测。实施建议以以上作者本人公开文章和官方规范交叉核实。

## 已发现并修正的问题

| 问题与实际原因 | 修正 |
| --- | --- |
| 左栏收起按钮实际 34px，排序 28px；旧 CSS 用 top:0/36px 绝对定位，空隙约 2px，排序还是圆形，视觉顺序与 DOM 顺序相反。 | 改为真实 actions 容器；同为 36×36px、9px 圆角、8px gap，顺序一致，排序增加按下状态。 |
| 左右面板按钮各自定义尺寸，右侧重置和收起样式不统一。 | 共用 control-size/radius/gap，增加明确的禁用、选中、悬停、焦点反馈。 |
| 手机聊天样式写到了不存在的 assistant-input / assistant-message，实际仍是小号文字。 | 改为实际 chat-form / chat-message；聊天正文 14px，手机输入 16px，标题及元信息重新分级。 |
| 手机筛选、导航、地图按钮和弹窗关闭入口命中范围偏小。 | 主要操作调整为 44px；小屏顶部保留紧凑排列，320px 单独防止登录按钮裁切。 |
| 深色壳的浅绿焦点环用在浅色地图浮层上，图层 summary 还不在统一焦点规则内。 | 浅色地图、聊天、规划表面使用深绿焦点色，覆盖 summary / input / select 和地图原生按钮。 |
| 快捷问题悬停修改 padding，会推动正文重新排版。 | 保持盒子和文字不动，仅对图标提供短位移反馈。 |
| 规划声明了 tab/tabpanel，却缺少方向键、Home/End、关联 ID 和单一 Tab 入口。 | 补充可访问关系、roving tabIndex 和键盘切换；窄屏选中项立即滚入可见范围。 |
| 规划、比较、资料弹层经 portal 挂载，未被页面的减少动态效果规则覆盖。 | 在共用 Dialog 的遮罩和内容上支持 motion-reduce。 |
| 图层标签、详情说明、首个房源标签仍被高优先级旧规则缩小；B 详情价格沿用 A 衬线。 | 修正有效选择器；增加阅读字号；B 价格与工作区使用同一字体与数字样式。 |

线上复验补充发现：桌面“对比公寓”固定按钮遮挡列表底部价格。已改为面板独立底部操作行，列表单独滚动；收起列表仍保留外部比较入口，手机沿用导航入口。

## 动效约束

- 图层正文与路线详情：180ms ease-out，opacity + translateY(-4px → 0)，说明内容从入口附近展开。
- 已有面板收放继续使用 transform/opacity，地图画布保持挂载，不逐帧改布局宽度。
- 按钮保留短按压反馈；快捷问题只移动小图标，不推挤文字。
- 不对流式每个 token 重放动画，不覆盖原有聊天跟随末尾/保留阅读位置逻辑。
- 系统选择减少动态效果时，工作区、图层、路线与共用弹窗禁用动画。
- 未测真实低端手机 FPS，不把 CSS 属性选择等同于帧率保证。

## 验证记录

本地浏览器已检查实际 CSS 视口 1600×1000、1280×720、768×900、390×844、320×800；中英文切换、价格排序、左右面板收放、专注模式恢复、图层展开、详情、比较表、规划标签页和英文手机登录页。按钮几何实测为 36px / 8px gap / 同轴，手机输入 16px、正文 14px、主要按钮 44px。规划方向键、Home/End 已在真实浏览器执行，减少动态效果下 Dialog 内容和遮罩 animation-name 均为 none。

类型检查通过；定向 ESLint 为 0 errors、2 个既有图片优化 warning；工作区、决策体验和 Markdown 共 9 项测试通过。机械设计扫描的 219 项均是颜色/圆角相对历史 DESIGN sidecar 的 advisory，包含预览 A 和历史样式；没有把这些提示等同于 219 个渲染缺陷，也没有为了消除提示重设计已有品牌。当前任务中的新增控件统一几何与浅色焦点配色是有意选择。

截图和临时构建日志放在 /tmp/campus-atlas-craft，不包含在 Git。Cloudflare 生产构建通过，构建守卫确认 0 secrets 泄漏、0 SQLite 导入并保留 D1。上线结果在发布完成后另行确认。
