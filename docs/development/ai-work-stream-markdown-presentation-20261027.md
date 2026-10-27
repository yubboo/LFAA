# LFAA AI Work 流式 Markdown 呈现修复（2026-10-27）

<a id="lfaa-ai-work-stream-markdown-presentation-20261027"></a>

## 目标与边界

- 用户反馈：当前流式输出只见连续、僵硬的文本，要求呈现接近 ChatGPT 的自然流式回复。
- 运行入口：AI Work `/work`，由 `AiWorkResponse` 消费 Connection 的真实 SSE 文本增量。
- Owner：`packages/client/ui-chat` 唯一持有聊天正文与 Markdown 展示；SSE、Agent Loop、Session 和模型选择沿用现有 Owner。
- 设置：沿用现有 `appearance` 共享主题、文字/代码字体及字号令牌和已保存的外观偏好；不新增、不重置设置。
- 权限与数据：不改变模型/Provider/权限配置或既有任务；真实浏览器恢复后可沿用用户先前“自行测试流式输出”的授权，使用不含私密信息的短提示验证实际生成展示。
- 允许范围：修复流式 Markdown 展示、工具活动/调用合同的默认密度、生成时底部跟随及对应长期回归，更新本包说明、当前架构事实及本合同验收记录。
- 禁止范围：不改变 SSE 节奏、回复分段、Provider/权限配置或用户偏好；不把用户私密内容放入测试提示，不启动或部署 Minecraft 服务。

## 可观察验收

- 流式正文可见增长为正常段落；Markdown 标题、列表、引用、表格和围栏代码继续使用终态的同一解析/样式。
- 已提交段落在后续增量时保留缓存复用；当前段落连续变化时只更新当前块。
- 真实浏览器 `/work` 至少检查桌面宽度和一处窄分栏，正文自然换行、块间距/代码块可见、无横向溢出；截图与视口写入实施记录。
- 运行 Markdown 缓存回归、Client 类型检查、ui-chat 构建、Web 构建及源码/产物指纹；不得把构建代替实页验收或帧时间测量。
- 真实工具执行组和完整工具合同默认收起，但仍能手动展开查看；运行与完成记录均不得自动展开全部多步详情。
- 正文增量只在跟随最新回复时于绘制前同步滚动；用户上翻后不得抢夺位置，重复滚动同步不产生多余写入。

## 实施记录

### 2026-10-27 ChatGPT 式连续过程时间线追修

- 用户反馈：当前一轮助手过程折在正文外，正文与工具操作被拆开；模型请求、推理、接收回答等内部阶段重复出现，读起来不像一条自然回复流。
- 目标：不论运行中还是完成后，保持单一“小鱼助手 · 已处理/用时”固定标题和分隔线；助手公开输出、真实工具操作和最后答复按实际 `contentOffset` 连续出现。只把工具/操作详情收在各自真实活动的可展开摘要里；“正在思考”是不可点击的短状态，收到公开输出后显示“正在回复”，真实工具派发时显示可展开的执行摘要。
- 只隐藏重复的模型请求、模型推理、流式接收及准备阶段日志；保留实际工具/Skill/子 Agent、澄清/审批、真实错误和实际发生的上下文整理。公开的助手文本来自现有回复段，不投影 Provider 隐藏推理。工具执行、SSE、Session、权限和用户设置不变。
- 运行入口与 Owner：Web/Desktop 共用 `/work`；`packages/client/ui-chat` 唯一负责呈现，Agent Loop/Session/Connection 继续提供原始活动、公开正文及可靠落点。
- 设置与数据边界：继续使用设置中心既有主题、强调色、字体/字号、对比度和减少动态效果令牌；不新增设置、不改偏好，不新增请求或持久化数据。
- 验收：时间线回归证明阶段日志被合并/隐藏而真实工具和正文顺序保留；完成态正文不被整体折叠；思考状态不可交互、真实工具摘要可展开；类型检查、ui-chat/Web 构建和 `/work` 内置浏览器桌面与窄栏实页验证。帧时间未测时明确记录。

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

### 2026-10-27 流式任务活动密度与滚动抖动追修

- 复核用户提供的 Minecraft 多步骤任务截图及其流式提示词：实际可见问题是工具活动组和工具合同默认展开，完整用途/Schema/阶段说明把回复正文挤成狭窄的断续块；正文增长时 ResizeObserver 事后追底又与滚动锚定叠加，换行处出现滚动落后一拍再跳动。
- `AiWorkResponse` 将活动组及合同设为默认收起的原生可访问 disclosure，仍保留真实函数名、状态、当前动作；具体用途、参数结构和执行阶段按需展开。没有改动模型、SSE/Agent/工具执行行为，也不执行真实 Minecraft 操作。
- `AiWorkChat` 在消息布局提交后的绘制前同步跟随，并复用“用户是否仍在底部跟随”的现有判定；ResizeObserver 只在布局确实改变时作补偿，`overflow-anchor: none` 避免浏览器锚定与应用跟随互相竞争。用户手动上翻时不写滚动位置。
- 新增长期回归覆盖多步骤运行中/完成态默认折叠、完整合同仍可用、流式提交只在跟随时滚动和抵达底部后不重复写值；外观继续使用主题/字体令牌和已有减少动态效果配置，不增加设置。
- ChatGPT 内置浏览器 `/work`，桌面视口 `1593×1244`：查看一条已有的 Minecraft 多步骤会话后，Agent 活动组默认收起；展开后显示简短的真实动作摘要（如“查询 Daemon 节点 · 调用 LFAA 工具 · 2 项”），函数合同仍可按需展开。最新只读验收回复在正文中自然显示节点状态、Paper 目录版本和列表，没有把 Schema/参数说明铺进回复。
- 窄分栏：同一视口打开右侧工作区上下文栏，splitter 值 `360`；聊天正文仍自然换行，页面无横向溢出。检查后收起了临时右侧栏并折回手动展开的工具组，回到底部显示最终回复。
- 真实 Provider 只读验收：向 LFAA 小鱼发送了只查询当前节点状态和 Paper 核心目录的提示。节点 `WIN-20250328BHE` 返回在线，Paper 目录返回 68 个正式版/RC/预览版本条目。未创建、启动或停止服务器，未下载/安装文件，未改设置/端口，未接受 EULA。
- 首轮 36 秒后实页显示“已停止”，最后一个 Provider 请求处于“结果待确认”，Paper 查询尚未完成；随后同一会话出现后续用户消息“你好”，助手继续执行只读查询，并在 25 秒内完成，显示最终正文和工具状态。浏览器控制台没有 warning/error，Web 健康接口返回 `status: ok`。停止原因未能从现有页面和日志定位，因此不把首轮标为通过，也不归因给本次 UI 呈现改动；这仍是待单独复现的运行问题。
- 类型检查、ui-chat/Web 构建、Markdown/时间线与滚动定向回归通过；构建刚完成时 Web 指纹为 `[]`。之后共享工作区的其他任务更新了 Agent/LLM 与会话项目代码；最终检查 `node scripts/runtime-build-state.mjs web` 返回 `host/web` 过期。由于 Provider 超时重试任务仍在索引中标为实施中，本轮没有重建/重启这批并行源码；已验收页面对应本轮成功构建并实时运行的 UI 快照，后续需待并行改动稳定后统一重建。
- 性能证据包括针对重复滚动写入的定向回归和布局检查，未测真实帧时间、设备性能或长时间运行资源曲线。

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

### 2026-10-27 工具活动密度与滚动稳定追修文件

- `packages/client/ui-chat/src/AiWorkResponse.tsx`：将工具活动组和完整工具合同改成默认收起、可访问的原生 disclosure，摘要保留真实动作与函数名。
- `packages/client/ui-chat/src/ai-work-chat.css`：为紧凑合同摘要提供工作区主题/字体样式，并尊重减少动态效果设置；关闭浏览器滚动锚定以免与应用跟随重复校正。
- `packages/client/ui-chat/src/conversation-scroll.ts` 与 `packages/client/ui-chat/src/AiWorkChat.tsx`：流式布局提交后只在用户仍跟随最新回复时同步到底部，且避免写入相同滚动位置。
- `apps/cli/tests/ai-work-response-timeline.test.mjs` 与 `apps/cli/tests/client-performance.test.mjs`：覆盖工具默认折叠、合同按需展开、绘制前跟随、用户上翻不抢滚动及不重复写入。
- `packages/client/ui-chat/README.md`、`docs/development/agent-tool-contract-stream-20261027.md`、`docs/系统总体架构.md` 与 `docs/PROMPTS.md`：记录当前展示行为、验收边界与真实页面结果。

### 2026-10-27 流式状态位置修复

- 用户指出“正在思考/正在回复”被单独渲染在工具活动摘要下方；状态应当在同一活动摘要位置变化。
- `AiWorkResponse` 现在将与工具组相邻的实时状态嵌入该组可展开的 `<summary>`，保留工具真实摘要和箭头；合并后的状态不再在下方重复一行。非相邻状态仍保持原时间线落点，避免把状态错误附到前序操作。
- 定向回归增加“工具行 + 正在回复”渲染断言；`ai-work-response-timeline.test.mjs` 通过 11/11，Client 类型检查、ui-chat 包构建、Web Vite 生产构建、`git diff --check` 通过。Web 构建写入根 `dist/apps/web/`；`runtime-build-state.mjs web` 返回 `[]`，健康接口 `status: ok`。
- ChatGPT 内置浏览器 `/work` 已重启并打开当前版本。桌面 `1423×1244`、窄屏 `390×844` 无页面横向溢出；当前展示的是已完成历史会话，不能在该静态会话中看到动态状态切换，状态与工具摘要合并由上述 Server Render 回归验证。帧时间未测。
