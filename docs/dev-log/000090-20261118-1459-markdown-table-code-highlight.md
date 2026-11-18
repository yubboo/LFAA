# 000090-20261118-1459-markdown-table-code-highlight

- 时间：2026-11-18 14:59:00 +08:00
- 任务：为助手消息接入富文本 Markdown 渲染，消除原始 `**` / `-` 标记符，并新增精美表格排版与代码块语法高亮/一键复制功能

## 变更文件

- `A` [markdown-parser.ts](file:///e:/lfaa/packages/core/chat/client/markdown-parser.ts)
  - 新增流式安全 Markdown 块级解析器（支持标题、代码块、对齐表格、有序/无序列表、引用块、分割线与段落）及轻量代码词法分词器 `tokenizeCodeLine`（识别关键字、字符串、注释、数字、类型与函数）。
- `A` [MarkdownContent.tsx](file:///e:/lfaa/packages/core/chat/client/components/MarkdownContent.tsx)
  - 新增 `MarkdownContent` 与 `CodeBlockCard` 组件，渲染 `<strong>`、列表项、行内代码胶囊、安全外链、对齐表格及带语言标识与「`复制代码` / `已复制`」按钮的高亮代码块。
- `A` [MarkdownContent.module.css](file:///e:/lfaa/packages/core/chat/client/components/MarkdownContent.module.css)
  - 定义浅色/深色主题自适应的表格容器、代码块卡片、语法高亮色彩与行内代码样式。
- `M` [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)
  - 将助手消息正文切换为 `<MarkdownContent content={msg.content} isZh={locale.isZh} />`。
- `M` [ChatWorkspace.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.module.css)
  - 移除 `.assistantBody` 上的 `white-space: pre-wrap`，避免富文本块级元素产生多余空行。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`479ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 打开已有会话 `项目内测试新会话`，确认正文已渲染为 `<strong>`、`<ul>` / `<ol>` / `<li>` 与 `<code>`，无任何原始 `**` 或前导 `- ` 符号。
  - 新建对话发送表格与 TypeScript 代码块测试提示，确认渲染出 1 个含 `<thead>` / `<tbody>` 的 `<table>`、1 个带 `TYPESCRIPT` 顶栏与高亮 token 的代码块卡片，点击 `复制代码` 立即切换为 `已复制`。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
