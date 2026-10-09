# Agent 回复 Markdown 渲染

2026-10-09。问题：原 `rental-chat.tsx` 将模型 text part 放进普通 span，Markdown 的 `**`、列表符号等作为纯文本显示；外层 `white-space: pre-wrap` 也不适合作为 Markdown 排版方式。

## 开源方案

| 方案 | 官方依据 | 本项目判断 |
| --- | --- | --- |
| [Vercel Streamdown](https://github.com/vercel/streamdown) | 专为 AI 流式 Markdown，使用 remend 处理未闭合语法，支持 GFM 表格和列表，提供中文插件 | 选用；保留原消息气泡，直接替换内容渲染 |
| [react-markdown](https://github.com/remarkjs/react-markdown) | React Markdown 组件，默认安全输出 React 元素；GFM 通过 remark-gfm 扩展 | 普通 Markdown 的成熟选择；流式未完成内容还需额外处理 |
| [AI Elements Message](https://elements.ai-sdk.dev/components/message) | MessageResponse 使用 Streamdown 渲染回复 | 适合同时引入整套消息 UI；本次已有自己的对话界面，只使用底层 Streamdown |

已核验并锁定 npm `streamdown@2.7.0`、`@streamdown/cjk@1.0.4`，均为 Apache-2.0。React peer 范围包含项目使用的 React 19。不引入代码高亮、数学公式或 Mermaid 插件。

## 实现

- 新增 `AssistantMarkdown`，只有助手回复进入 Markdown 渲染，用户输入仍按纯文本显示。历史消息原文和多轮会话存储无需迁移。
- Streamdown 按块渲染并处理未闭合 Markdown；中文插件处理中文标点旁的强调语法。使用语义 strong 标签表示加粗。
- 模块级稳定插件/组件配置及 memo 包装，避免输入框每次敲字重解析历史回复；渲染器按需加载，避免扩大首页主包。沿用 AI SDK 7 的消息 parts 和流式状态，未照搬网页文档中旧版 useChat 示例。
- 为段落、标题、列表、引用、表格、代码和链接设置局部样式；Markdown 内使用普通空白排版，代码块保留换行，宽表格和代码可横向滚动。
- 保留 sanitize 与 harden，取消原始 HTML 解析；HTML 作为文本而非元素执行，图片不生成 img，危险链接被拦截。正常来源链接使用库的 noopener/noreferrer 新标签行为。

## 验证

- 三项渲染测试覆盖实际租房回答、中文标点、GFM 表格和列表、未闭合流式加粗、模型 HTML/危险链接/图片处理。
- 页面检查使用已有真实模型历史，不依赖重新请求模型来重新生成旧回复。
- `npm run test:markdown`（3/3）、`npm run typecheck`、修改文件的 ESLint 检查及 `npm run build` 均通过。按需加载后构建没有超大主 chunk 警告。
- 本地真实页面 `/?city=london&listing=london-2`，1440×1000 桌面检查：历史回复含 17 个语义加粗元素、3 个无序列表，助手内容不再出现原始 `**`；地图和对话均正常显示，浏览器未记录 error/warn。
- 390×844 手机检查：切换到助手后，历史路线回答中的店名、119 米和 2 分钟均加粗；回复内容宽度与容器宽度相同，无横向溢出。截图保存在 `/tmp/rental-markdown-desktop.png`、`/tmp/rental-markdown-mobile.png`。
- 本轮未重新发送真实模型请求；未闭合流式语法和表格通过渲染测试验证，桌面与手机以已有真实历史回复验收。渲染不会补回历史回复原本缺失的内容。

官方参考：[用法](https://streamdown.ai/docs/usage)、[中文插件](https://streamdown.ai/docs/plugins/cjk)、[安全机制](https://streamdown.ai/docs/security)。
