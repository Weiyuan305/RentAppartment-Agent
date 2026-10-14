# UI/UX 与界面动效 Agent Skills 调研

调研日期：2026-10-13。对象：Campus Atlas 的 React / Next.js 租房演示，包括登录页、房源列表、Cesium 地图与聊天助手。

## 推荐

主选 **UI UX Pro Max**，负责视觉规范、排版、信息层级、响应式和交互状态；需要实现具体动效时搭配 **Emil Kowalski 的 `animate`**，完成后可用 `review-animations` 做针对性检查。一次设计任务使用一个主规范，避免同时套用多个 Skill 的字体、配色与动画规则。

**Impeccable** 是另一套完整方案，适合先审查现有界面，再分别处理布局、精修、国际化边界和动效。**Taste Skill** 更适合作为首页、登录页或品牌视觉方向的参考。此推荐是基于仓库源码与当前产品形态的判断，本次没有用候选 Skill 重做页面或比较生成效果。

## 高星候选

星数取自调研当天 GitHub 原仓库页面的四舍五入显示，属于整个仓库，不代表某个子 Skill 的独立星数。最新提交时间取公共 `commits/main.atom`，下表使用 UTC 日期。

| 仓库 | 约 Stars | 最新提交日期 | 许可证 | 主要价值 | 对本项目的适用范围 |
| --- | ---: | --- | --- | --- | --- |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 135.2k | 2026-10-12 | MIT | 可搜索的设计资料、设计系统生成、配色、字体、UX、技术栈指导与 GSAP 预设 | 首选主规范；统一三栏、卡片、筛选器、按钮和中英文响应式布局 |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 95.2k | 2026-10-11 | MIT | 视觉方向、排版、间距与可调的视觉变化、动效、密度参数 | 首页、登录页、视觉改版参考；默认 v2 标记为 experimental |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 80.3k | 2026-10-12 | Apache-2.0 | 一个 Skill 提供 audit、critique、polish、layout、harden、animate 等命令 | 适合改进已有应用；特别关注布局、国际化溢出、状态反馈与动效 |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | 45.7k | 2026-10-11 | MIT | 动画实现、缓动、时长、打断、退出、性能和减少动态效果偏好 | 首选动效补充；房源选中、面板展开、收藏反馈与弹层过渡 |

## 实际能力与接入区别

### UI UX Pro Max

- 已读取 [SKILL.md](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md) 与 README。
- 提供 React、Next.js、shadcn/ui 等栈指导，以及字体、配色、布局、可访问性和交互规则。Skill 内含动效强度参数与 GSAP 预设，不能将预设存在视为已经适配本项目。
- README 明确列出 Codex CLI 接入。完整功能需要配套数据与 Python 搜索脚本，仅复制一个 SKILL.md 会缺少检索能力。当前 README 推荐 CLI 包名为 `ui-ux-pro-max-cli`。

### Taste Skill

- 已读取 [上游 SKILL.md](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md)。默认安装名是 `design-taste-frontend`；README 同时提供原版 v1 与现有项目 redesign 变体。
- 布局、字体与动效方向比较鲜明；v2 默认版本仍处于实验阶段。对信息密集型产品，应按既有流程和密度约束选用，不能直接照搬展示页效果。
- 本机已有 `/Users/weiyuan/.codex/skills/taste-skill/SKILL.md`，名称也是 `design-taste-frontend`，其本地说明明确适用于营销或编辑型界面，不适用于仪表盘或多步骤产品流程。此本地文件不是对当前上游版本一致性的证明。

### Impeccable

- 已读取 README 和 [打包 Skill](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md)，文件标记版本为 4.5.2。
- `critique` 关注层级与清晰度，`audit` 关注技术质量，`polish` 负责收尾，`harden` 覆盖国际化、文本溢出与边界情况，`animate` 负责有目的的动效。适合现有应用分项改进。
- 当前版本包含配套启动器和引擎，并可能安装 Codex 项目 hooks；不应将其理解成只有一段提示词。安装前应明确项目级范围，检查与已有规则的配合。

### Emil Kowalski Skills

- 已读取 [animate](https://github.com/emilkowalski/skills/blob/main/skills/animate/SKILL.md) 与 [improve-animations](https://github.com/emilkowalski/skills/blob/main/skills/improve-animations/SKILL.md)。
- `animate` 实际写实现，按目的、工具、属性、缓动、时长、打断、退出的顺序决策；简单效果优先 CSS，需要弹簧、布局或手势时再考虑 Motion。
- `improve-animations` 主要生成审查与实施计划，不能把使用它等同于动画已经实现；`review-animations` 则用于检查已有改动。
- 其对减少动态效果偏好、触屏 hover 和可打断动画的关注，适合高频使用的找房工具。

## 建议应用顺序

以下是建议的后续实施范围，本次未实施。

1. **统一视觉规范**：明确字体层级、间距、颜色、边框、选中态与按钮层级，覆盖中英文长标签和窄屏。
2. **整理三栏信息层级**：突出房源价格与选择状态，降低地图设施控件的视觉竞争，让聊天输入、回答与工具状态易于区分。
3. **增加反馈动效**：房源选中、收藏、设施面板展开、详情弹层、移动端栏目切换采用短而清晰的过渡；图片切换强调连续性。
4. **保持地图稳定**：保留 Cesium Viewer 生命周期，用独立覆盖层处理 UI 动效；地图定位继续由现有相机控制处理。避免装饰动画干扰地图操作和聊天阅读。
5. **验证实际体验**：检查中英文、桌面与手机、快速重复点击和减少动态效果设置，并复查地图交互与聊天功能。安装 Skill 本身不代表页面已经美化或验证通过。

Skill 主要作用于开发过程；线上效果来自之后生成并验证的 CSS / React 实现，不需要让访客运行设计 Skill。动画库是否引入应按具体交互决定。

## 证据与边界

- 本次保存目录：[evidence/uiux-skills](./evidence/uiux-skills/manifest.json)，包含原仓库 README、所读 Skill、提交 Atom 记录与索引。
- GitHub REST 元数据请求返回 HTTP 403，因此没有声称拿到了精确 star 数或 API `pushed_at`；星数使用 GitHub 原仓库页面显示，维护时间使用成功读取的公开提交记录。
- 候选仓库文件只作资料读取，没有执行第三方脚本或安装这些候选工具。本次是调研，没有改动线上界面。
