# LFAA AI Work 聊天标题自动精简与重命名（2026-11-12）

<a id="lfaa-ai-work-session-short-titles-and-rename-20261112"></a>

## 用户目标与验收范围

- 用户指出聊天标题直接显示了过长的首条请求，希望像参考图中的聊天列表一样自动变成简短标题，并能双击对话打开“重命名聊天”编辑框。
- 顶栏与侧栏共用 Session Owner 保存的标题；标题以短标题为主，空间不足时仍需单行省略。
- 新会话创建时立即保存简短回退标题，再由当前已配置模型按首条用户请求生成最多 12 个汉字的概括。历史会话只在当前打开且原标题仍等于首条请求派生值时补生成；手动命名的标题不得自动覆盖。生成输入只包含有界首条用户文字，不提供工具或凭据；生成使用当前账户的已选模型与现有 AI Runtime 配置，并将真实返回用量计入会话。
- 手动重命名通过认证 API 调用唯一 Session Owner 持久化，并用标题比较防止并发生成覆盖手动修改。双击对话打开编辑框；会话菜单也提供可发现的重命名入口。

### 新增故障报告（2026-11-12）

- 用户截图显示一轮助手回答已完成后，页面提示“自动生成聊天标题未完成，已保留当前短标题。”；输入区显示已配置的 DeepSeek 模型。沿 Client → 认证 Session Controller → Agent Loop → Session Title/Session Owner 查明 HTTP 200、`generated=false` 是 Provider 输出被截断。
- 验收：以隔离账户、隔离存储和合成流式 Provider 重现 `finish_reason=length` 并回归修复；保留回退标题与失败状态，不伪报成功。第一次排查曾按现有页面逻辑重载截图对应会话并向已配置模型重发首条输入一次，未改偏好；修复后不再对真实会话重复请求。
- 保持账户/App 隔离、当前模型和 AI Runtime 配置、Session Owner CAS、无工具标题请求及 Permission Owner 原合同；不增加第二套模型选择或权限流程。
- UI Owner：Web/Desktop 共用 `packages/client/ui-workspace`。标题数据 Owner：`packages/core/session`；模型生成编排 Owner：`packages/core/agent-loop`；认证与参数校验入口：`packages/api/session-controller`；前端调用合同：`packages/client/connection`。
- 设置：沿用当前账户在 AI 与模型中的已选模型、AI Runtime token/上下文配置、`permissions.mode` 和外观设置映射；不新增设置、不更改偏好、不调用工具或产生领域副作用。
- 性能、安全、维护边界：只对当前打开且仍为自动标题的会话触发一次有界生成；同会话请求去重；提示输入上限 4,000 UTF-8 字节；不新增轮询/订阅；认证、账户隔离、App 归属和 Session JSONL 事务继续由原 Owner 校验。

## 验收条件

1. 新对话在首轮启动时即有简短标题；模型生成成功后持久化简洁摘要，当前标题已手动修改时生成结果不得覆盖。
2. 当前打开的历史长标题在确认仍等于首条请求派生值后自动生成；其他会话不批量触发模型请求。
3. 侧栏单/双击行为正常：单击只切换会话，双击打开“重命名聊天”编辑框；保存后顶栏、侧栏和重新加载后的标题一致，空标题/超长标题由服务端拒绝；取消不写入。
4. API 只修改当前账户所拥有的会话；不允许跨账户/App 修改。标题写入、自动生成条件和 JSONL `session/title` 事件来自 Session Owner。
5. Workspace、Session Controller、Agent Loop 与 Client 包直接构建/类型检查通过；内置浏览器在桌面及窄分栏/短屏验证标题、省略、双击、保存、取消和重新加载。构建与真实页面证据分开记录。
6. 记录实际 model title completion 用量；生成失败保留简短回退标题并报告为失败，不伪称模型总结成功。帧时间未测时明确说明。

## 实施与验收记录

状态：完成；自动精简与双击重命名均完成实现、直接构建/类型检查及内置浏览器实页验收。

### 预期文件

- `packages/session/session-title/src/normalize.ts` 与 `README.md`：提供简短且安全的本地回退标题规则。
- `packages/session/session-title-llm/src/index.ts`、`README.md` 与 `packages/session/session-title-first-prompt-llm/README.md`：限制模型标题长度、把首条输入作为待总结数据并说明适配边界。
- `packages/core/session/src/sessions.ts`、`src/kernel.ts`、`package.json` 与 `README.md`：新会话回退标题、自动标题候选/CAS 更新、手动重命名持久化及事件来源合同。
- `packages/core/agent-loop/src/runs.ts`、`package.json` 与 `README.md`：使用当前已配置模型自动生成标题、去重、限制输出并记录真实用量。
- `apps/cli/tests/session-title-generation.test.mjs`：隔离真实 Session/Agent Loop 与合成流式 Provider，覆盖输出截断后标题生成行为。
- `packages/api/session-controller/src/index.ts`、`README.md` 与 `packages/api/remotes/src/route-contracts.ts`、`README.md`：认证路由和标题参数校验。
- `packages/client/connection/src/api.ts` 与 `README.md`：自动标题与手动改名 API 客户端。
- `packages/client/ui-chat/src/AiWorkChat.tsx`、`README.md`：活动会话自动补标题并在不改变列表排序的情况下同步结果。
- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`、`src/css/center-workspace.css`、`src/css/secondary-navigation.css` 与 `README.md`：标题栏省略、双击/菜单重命名、移动端手势延迟收栏与编辑框。
- `pnpm-lock.yaml`、`docs/PROMPTS.md`、`docs/harness-packages.json`、`docs/harness-packages.md`、`docs/workspace-entry-map.md`：工作区依赖、合同索引和生成清单。
- 本合同：记录边界与实际证据。

### 设置与数据归属

没有新增设置项。模型账户/Provider 由 Agent Default Model 和 Settings Owner 解析；权限模式只传入通用 completion 请求，本次请求不带 Tools，不触发操作审批；标题、所有权和持久化由 Session Owner 唯一维护。

### 第一批：短标题与生成接入

- 源码：短标题回退、Session JSONL `title_source`/标题事件、候选比较写入、Agent Loop 当前模型生成、认证 API、Connection 调用和聊天打开时触发；标题模型提示最多接收 4,000 UTF-8 字节，输出限制 64 Token，进程内最多四个并行请求。失败保留回退标题；手动来源不会被自动结果覆盖。
- 构建：Session Title、Title LLM、First Prompt LLM、Session、Agent Loop、API Remotes、Session Controller、Connection、UI Chat、UI Workspace 十个包构建通过；`pnpm run typecheck` Client 与 Host 两项通过；`git diff --check` 通过。未运行测试。
- 正式 Web：由当前 checkout 的 `lfaa.bat` 菜单 2 → 完整 Web → 安全重启启动；旧服务健康接口 HTTP 200，菜单核对后安全停止 PID 29964，Control Plane/Harness 与 Web 重建后正式服务报告 `http://127.0.0.1:3000` 就绪；构建日志保留既有 Vite 大 chunk 提示。启动前源码状态为 `host` 指纹过期，Web 包含于启动流程强制重建；启动完成时菜单完成指纹复核。
- 内置浏览器：实际路由 `http://127.0.0.1:3000/work`。桌面视口 1593×869 显示短标题（如“真实画布生图”）；短屏/窄分栏 820×560 标题保持在中栏，页面 `scrollWidth` 与视口同为 820，无横向溢出。未在本批触发新对话或发送消息；真实 Provider 标题用量未单独复核，帧时间未测。截图观察已在本轮浏览器检查中留存。

### 2026-11-12 自动标题输出截断修复

- 根因：当前运行日志在标题接口 HTTP 200 前记录 `AiOutputLimitError`。`packages/core/agent-loop/src/runs.ts` 把标题请求硬限制到 64 tokens；LLM Owner 在 Provider 以 `finish_reason=length` 结束时抛出该错误。推理型模型的隐藏推理会占用输出预算是与截图所选模型相符的解释，但本轮没有单独读取 Provider 的推理 token 分项。Client 将 `generated=false` 显示为截图中的通用失败提示。
- 修复：自动模式使用有界 512-token 标题预算；用户显式设置低于 512 的 `aiRuntime.maxOutputTokens` 继续收紧预算，模型目录的实际输出上限由 LLM Owner 继续执行。标题仍沿用当前账户/模型，不带工具，首条输入 4,000 UTF-8 字节上限、并发和 Session CAS 不变。没有新增/修改设置，也没有继续请求真实会话。
- 回归：更新 `apps/cli/tests/session-title-generation.test.mjs` 使合成 Provider 在请求上限低于 512 时返回 `finish_reason=length`。修改前该测试以 `AiOutputLimitError` 失败；修改后 `pnpm.cmd --filter @yubboo/lfaa test -- tests/session-title-generation.test.mjs` 通过，1/1。
- 构建：首次 `pnpm.cmd run build:control-plane` 被当前共享工作区的 `execute-turn.ts` 中 `settings` 作用域错误阻断。重新检查时该文件已变为先声明变量、获取设置后再初始化的形式；本轮没有重复修改该共享变更。重跑 `pnpm.cmd run build:control-plane` 通过，产物位于仓库根 `dist/apps/control-plane/`；`node scripts/runtime-build-state.mjs host` 返回 `[]`，`git diff --check` 通过。未重启当前服务，未在真实 Provider 上重试。
- 性能/边界：每个标题请求新增最大 512-token Provider 输出预算；仍受用户更低上限与模型目录上限约束，无新增并发、订阅或数据路径。真实 Provider、当前已运行服务加载新源码及帧时间未验。

### 第二批：双击重命名

- 源码：会话行双击打开重命名框；会话菜单同时提供“重命名”。保存只在认证 API 成功后更新列表并提示成功，取消/关闭不写入；标题限定 80 个 Unicode 字符。
- 构建：受影响的十个包构建通过，Client 与 Host 类型检查通过，`git diff --check` 通过；未运行测试。
- 正式 Web：用户授权安全重启后，通过当前 checkout 的 `lfaa.bat` 完整 Web 菜单和安全重启完成 Control Plane/Harness 与 Web 重建；菜单报告 `http://127.0.0.1:3000` 就绪，`/api/health` 返回 HTTP 200，Web 构建指纹检查为 `[]`。启动菜单随后显示 pnpm 外层任务退出码 `-1`，但其启动的 PID 34664 仍持有 3000 端口并持续返回健康响应；据此只确认服务和指纹，不将菜单外层任务记作成功。Vite 保留既有大 chunk 提示。
- 内置浏览器：`http://127.0.0.1:3000/work`，桌面 1593×869；侧栏显示简洁标题，双击“真实画布生图”后弹出“重命名聊天”，输入框保留当前标题并显示 `6/80`。会话菜单可见“重命名”。窄屏 390×640 时弹窗完整位于可视区，输入框与取消/确定按钮可见，页面 `scrollWidth` 为 390，没有横向溢出。点击取消后弹窗关闭，标题未变化。
- 保存及重载后的持久化没有用现有用户会话实际提交验证，以避免改写用户数据；认证路由、Owner 写入和 Client 类型/构建已检查。帧时间、真实设备未测。
- 工作区清单同步更新了包目录；`sync:workspace` 仍报告既有文档问题：旧合同引用的两张截图缺失，另有两个已有 PROMPTS 锚点缺失。本任务未改动这些无关条目。

### 2026-11-12 聊天组件源码恢复

- Web 构建排查发现 `packages/client/ui-chat/src/AiWorkChat.tsx` 在 commit `4e0fcff8` 中被一行 CSS 声明覆盖。已从父提交 `7c5a6406` 恢复组件，并补齐 `onSessionChange` 与活动会话标题生成接线；生成按账户/App/Session 去重且进程内最多保留 256 个键。组件已有的隐藏页面延迟触发和卸载监听清理保持生效。
- `pnpm --filter lfaa-client-ui-chat build`、`pnpm run build:web` 通过。内置浏览器实际打开 `/work`，当前为空白新会话，没有触发 Provider 标题生成；本轮不声称真实标题生成或会话持久化已验收。无新设置，继续使用当前模型配置和 Session Owner。
