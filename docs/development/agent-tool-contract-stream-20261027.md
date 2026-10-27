# Agent 工具合同进入流式对话（2026-10-27）

<a id="lfaa-agent-tool-contract-stream-20261027"></a>

## 目标与边界

- 目标：用户在 AI Work 回复流中实时看见 Agent 当前调用的准确工具名、该 Owner 声明的使用说明、参数字段类型/必填状态/字段说明（不含参数值）、LFAA 操作规则、真实权限与执行 Owner，以及按序保留的工具调用阶段和安全结果摘要；工具完成后，过程记录仍可在回复历史中查看。
- 入口与唯一 Owner：`packages/core/agent-loop` 从本轮实际可用的 `AiBusinessTool` 创建活动事件；`packages/core/session` 持有活动数据合同与持久化/导出校验；`packages/api/session-controller` 与 Client Connection 转发现有 activity SSE；`packages/client/ui-chat` 将真实活动插入同一回复时间线并负责展示。工具描述与 JSON Schema 由各工具 Owner 维护，Agent Loop 不复制领域规则。
- 行为合同：活动在工具派发前开始流式发送；更新活动状态只更新同一活动 ID；工具名、用法说明及参数字段不随状态覆盖丢失。每条工具活动最多保留 8 个真实阶段：模型选择、参数校验、风险/权限检查、需要时的审批、派发到执行 Owner、真实回执；当前轮次未结束时，工具组和本轮各工具详情持续展开，即使某一工具已结束而模型仍在判断。成功/失败/未确认状态只采用执行 Owner 的真实回执。
- 安全边界：不显示原始 JSON 工具参数值、原始工具返回正文、凭据、截图/网页正文或模型隐藏推理；既有 Owner 生成的脱敏命令、查询和相对路径摘要仍遵循原展示合同。工具 `description` 与参数说明是不可信合同数据，只作为明确标注的文本展示，不能当作对话指令；字段列表从 JSON Schema 顶层 properties/required 派生并有界限长。HTML 由 React 文本节点转义，不解释远端富文本。
- 设置：复用 AI Work 当前消息流与既有外观共享令牌；本批没有新的用户偏好。按设置中心已接入的主题、字体、字号、颜色/对比度、遮罩/模糊与减少动态效果显示，不读取/修改权限设置。授权和执行仍由 Permission Owner 与各执行 Owner 负责。
- 性能/可维护性：沿用现有 SSE activity event，不加轮询、订阅或请求；不对每个 token 重新解析工具合同，只在新活动创建时构造一次有界元数据。每项工具最多公开 24 个参数字段，每字段说明最多 320 字符、阶段最多 8 项并各限 640 字符。活动详情区域限制高度、内部滚动并支持窄容器换行；收尾清理仍由既有流和组件生命周期负责。
- 验收：Session activity 校验/导入、UI 时间线与 SSE 回归；Agent Loop、Session、Connection、ui-chat 相关包构建及类型检查；源码工作区启动后在内置浏览器检查 `/work` 中真实运行活动及窄容器布局。若当前没有真实模型运行条件，另以真实 SSE fixture 验证活动更新和历史投影，并明确记录模型/浏览器未测边界。
- 允许：扩展 AiActivityItem 的有界、公开工具元数据；完善 Agent Loop 活动创建、Session 投影校验、Connection 类型和 AI Work 流式时间线展示；更新所涉包 README、架构和开发规范。
- 禁止：把隐藏推理/全部模型提示词塞进界面；把原始参数或工具返回内容作为默认活动；替工具 Owner 自行编写新的执行逻辑；改变工具选择、Permission Owner、权限模式、用户设置或 SSE 事件排序语义。

## 实施记录

### 改动

- `packages/core/agent-loop/src/execute-turn.ts`：从本轮实际登记的工具及 JSON Schema 构造有界使用说明；同一 SSE activity 按序追加模型选择、参数校验、风险/权限检查、审批、派发与真实结果阶段；结果摘要不复制原始返回正文、网页内容或截图。
- `packages/core/session/src/sessions.ts`、`packages/client/connection/src/api.ts`：新增有界工具说明和阶段合同，验证、持久化及导出时对说明文本中的本地路径脱敏。
- `packages/client/ui-chat/src/AiWorkChat.tsx`、`AiWorkResponse.tsx`、`ai-work-chat.css`：将工具用途、参数字段说明、操作约定与阶段事件放在原回复时间线；运行期间工具组和工具详情保持展开，终态可回看，字段说明可在窄容器换行。
- `apps/cli/tests/ai-work-response-timeline.test.mjs`、`session-kernel-persistence.test.mjs`、`agent-runtime.test.mjs`：覆盖展开状态、工具合同与阶段展示、Session 恢复，以及同一 SSE 活动阶段递增。
- `开发规范.md`、`docs/系统总体架构.md` 及四个受影响包 README：将“工具执行链与 AI Work 流式回复同批更新”写入工程规范并记录包职责。
- 未新增或修改设置项；沿用外观共享令牌、现有减少动态效果样式和 Permission Owner 的当前权限模式。

### 验证与边界

- `ai-work-response-timeline.test.mjs` 与 `session-kernel-persistence.test.mjs` 定向回归：23/23 通过；`git diff --check` 通过。
- Agent Loop、Session、Client Connection、ui-chat 能力包构建通过；`pnpm --filter lfaa-web run build` 的 Client 类型检查和 Web 构建通过，3887 个模块完成构建。Web 构建仍报告已有的大型分块提示。
- `agent-runtime.test.mjs` 的集成断言尚未执行：测试启动阶段因当前工作树另一批 Writing 迁移夹具未初始化而退出（`Writing 本地文件迁移结构未初始化`）。
- `pnpm run build:control-plane` 未通过，阻断位于本轮之外的 Browser Use 与 knowledge 工作树修改：可访问性节点 `boolean | "mixed"` 类型不匹配、`BrowserSnapshot.accessibilityTree` exact optional 类型不匹配、knowledge 的 `mainFile` 未使用。该构建未能生成当前 Control Plane 指纹。
- 页面检查：Vite 在 `http://127.0.0.1:5173/work` 可呈现 LFAA 页面外壳，但截图显示“控制端暂不可用”；隔离 Control Plane 无法通过构建/健康检查。该页视口尺寸未记录，未与登录态或真实工具活动交互，因此不能作为工具流验收；窄屏/短屏也未验收。现有内置浏览器 `http://127.0.0.1:3000/work` 在本次读取时被浏览器 URL 安全策略拒绝访问，未尝试绕过。未修改账户设置、权限模式或真实 Home 数据，也未安装能力。
- 因未能启动健康 Control Plane，没有真实 Provider、浏览器工具或桌面工具执行记录；结果阶段的实工具表现仍待可用隔离服务上的浏览器验收。

### 本轮涉及文件

- `apps/cli/tests/agent-runtime.test.mjs`：Agent Runtime SSE 阶段顺序回归。
- `apps/cli/tests/ai-work-response-timeline.test.mjs`：AI Work 工具说明卡片和流式展开回归。
- `apps/cli/tests/session-kernel-persistence.test.mjs`：工具活动合同和阶段恢复回归。
- `开发规范.md`、`docs/PROMPTS.md`、`docs/系统总体架构.md`：跨层流式显示规范、任务状态及系统架构合同。
- `docs/development/agent-tool-contract-stream-20261027.md`：任务范围、实施记录、验证证据与未测边界。
- `packages/core/agent-loop/README.md`、`packages/core/agent-loop/src/execute-turn.ts`：工具 Owner 合同投影与实时活动阶段。
- `packages/core/session/README.md`、`packages/core/session/src/sessions.ts`：Session 活动合同、边界校验与持久化/导出处理。
- `packages/client/connection/README.md`、`packages/client/connection/src/api.ts`：Client 流式事件类型。
- `packages/client/ui-chat/README.md`、`packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/AiWorkResponse.tsx`、`packages/client/ui-chat/src/ai-work-chat.css`：同回复时间线展示与窄容器样式。
