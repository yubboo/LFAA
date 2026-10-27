# LFAA AI Work 流式 Markdown 呈现修复（2026-10-27）

<a id="lfaa-ai-work-stream-markdown-presentation-20261027"></a>

## 目标与边界

- 用户反馈：当前流式输出只见连续、僵硬的文本，要求呈现接近 ChatGPT 的自然流式回复。
- 运行入口：AI Work `/work`，由 `AiWorkResponse` 消费 Connection 的真实 SSE 文本增量。
- Owner：`packages/client/ui-chat` 唯一持有聊天正文与 Markdown 展示；SSE、Agent Loop、Session 和模型选择沿用现有 Owner。
- 设置：沿用现有 `appearance` 共享主题、文字/代码字体及字号令牌和已保存的外观偏好；不新增、不重置设置。
- 权限与数据：不改变模型/Provider/权限配置或既有任务；真实浏览器恢复后可沿用用户先前“自行测试流式输出”的授权，使用不含私密信息的短提示验证实际生成展示。
- 允许范围：修复流式 Markdown 展示和对应长期回归，更新本包说明、当前架构事实及本合同验收记录。
- 禁止范围：不改变 SSE 节奏、回复分段、工具时间线、Provider/权限配置、对话滚动、其他 UI 布局或用户偏好；不把用户私密内容放入测试提示。

## 可观察验收

- 流式正文可见增长为正常段落；Markdown 标题、列表、引用、表格和围栏代码继续使用终态的同一解析/样式。
- 已提交段落在后续增量时保留缓存复用；当前段落连续变化时只更新当前块。
- 真实浏览器 `/work` 至少检查桌面宽度和一处窄分栏，正文自然换行、块间距/代码块可见、无横向溢出；截图与视口写入实施记录。
- 运行 Markdown 缓存回归、Client 类型检查、ui-chat 构建、Web 构建及源码/产物指纹；不得把构建代替实页验收或帧时间测量。

## 实施记录

### 实现

- `AiStreamingMarkdown` 与完成态共用同一 Markdown 分块解析器和外观令牌，段落、标题、列表、引用、表格及尚未闭合的围栏代码会随正文增量增长。
- Provider 的请求分段可能切在 Markdown 标记中间。时间线现在会合并相邻且没有工具/交互活动隔开的正文片段，再交给流式渲染器，避免把 `>` 或代码围栏拆开后当普通文字显示；活动记录仍保持原落点。
- 已完成 Markdown 块按固定 32 块分组缓存；只有当前正文块继续更新。缓存只读取新增内容，内容缩短时重置，不再保存并逐次扫描整份历史快照。
- 未新增设置项。回复沿用设置中心已有外观主题、正文/代码字体与字号共享令牌；不改变用户设置或模型/权限。

### 验收记录

- 直接回归：`node --import tsx --import ./register-package-loader.mjs --test tests/client-streaming-markdown.test.mjs tests/ai-work-response-timeline.test.mjs`（`apps/cli/`）通过，15/15；覆盖流式 Markdown 结构、缓存追加/缩短/CRLF/代码围栏，以及 Markdown 标记跨 Provider 分段。
- 性能回归：`node --import tsx --import ./register-package-loader.mjs --test --test-name-pattern="AI Work 流式正文使用共享 Markdown" tests/client-performance.test.mjs`（`apps/cli/`）通过，1/1。
- 类型检查：`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过。
- 包构建：`pnpm --filter lfaa-client-ui-chat run build` 通过，输出在根 `dist/packages/`。
- Web 构建：`pnpm run build:web` 通过，产物写入 `dist/apps/web/`；`node scripts/runtime-build-state.mjs web` 返回 `[]`，无过期运行指纹。
- 服务：已获用户授权后按正式入口重启，进程参数为 `web --no-local-daemon`；构建文件刷新后保护检查曾短暂让 `/work` 返回 503，按正式入口再次重启后健康接口与 `/work` 均恢复 200，内置浏览器重载到“LFAA 工作台”。未启动游戏 Daemon。
- 真实生成态：ChatGPT 内置浏览器 `/work` 选用已配置的 DeepSeek-V4.1-Flash，用无私密数据的 Markdown 提示实际生成。回复状态仍为“正在回复”时，实页截图已显示自然段落、标题、列表、引用样式和代码块，未出现裸露的 `>` 或围栏符号；5 秒后正常完成，输出 485 tokens、输入 27,643 tokens（缓存命中 27,392）。完成态 DOM 核对到列表 1 处、引用 1 处、代码块 1 处。
- 布局：内置浏览器实测 `1593×1244` 桌面视口。展开右侧栏后，共享 splitter 为 `360`，聊天容器 `clientWidth=930`、`scrollWidth=930`，横向溢出为 false；列表、引用和代码块仍可见并自然换行。验收后已收起临时侧栏与 Git 摘要。
- 未测帧时间；当前性能证据是缓存/无全历史重新解析的代码路径与定向回归，不等同于帧时间实测。

### 本轮涉及文件

- `packages/client/ui-chat/src/AiMarkdown.tsx`：共享终态/流式 Markdown 呈现。
- `packages/client/ui-chat/src/streaming-markdown.ts`：增量块缓存与复用。
- `packages/client/ui-chat/src/response-timeline.ts`：合并相邻 Provider 正文分段。
- `packages/client/ui-chat/src/ai-work-chat.css`：移除仅用于旧纯文本流式模式的样式。
- `apps/cli/tests/client-streaming-markdown.test.mjs`：Markdown 渲染及缓存回归。
- `apps/cli/tests/ai-work-response-timeline.test.mjs`：跨分段 Markdown 时间线回归。
- `apps/cli/tests/client-performance.test.mjs`：流式共享 Markdown 路径回归。
- `packages/client/ui-chat/README.md`：记录流式 Markdown 行为。
- `docs/系统总体架构.md`：同步 AI Work 现行流式呈现事实。
- `docs/PROMPTS.md`：更新本轮任务索引。
