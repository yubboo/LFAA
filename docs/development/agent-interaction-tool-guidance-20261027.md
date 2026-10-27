# LFAA Agent 浏览器与桌面工具使用合同（2026-10-27）

<a id="lfaa-agent-interaction-tool-guidance-20261027"></a>

## 目标与边界

- 用户目标：把用户看到的“读取浏览器控制接口、观察当前页面、执行动作、检查结果”等过程做成 LFAA Agent 可执行的工具说明与操作合同，降低猜测工具、依据旧状态误点、照搬网页指令和动作后不核验的风险。
- 入口与 Owner：AI Work → Agent Loop 按本 Run 实际登记的工具动态附加 Browser/Computer Use 指令；`packages/browser-use/browser-use` 持有浏览器工具 schema、页面状态读取和语义操作；`packages/computer-use/computer-use` 持有 Windows 屏幕/窗口观察与坐标动作的新鲜状态校验；`core/agent-loop` 只提供模型使用指导和真实工具结果回传。权限仍归唯一 Permission Owner。
- 能力合同：模型仅使用本轮真实提供的工具及其 JSON Schema/description，不猜 API、方法、参数、窗口或页面状态。面向任务采用“必要时先观察 → 用最新观察选择一个有界动作 → 检查动作返回的真实状态 → 状态缺失/不符时再观察或停止说明”的通用循环。操作回执不是任务完成证据。
- 浏览器规则：先结合对话和 Settings Owner 当前设置选择真实 Provider；需依赖页面状态的动作使用 Browser Owner 的最新快照，以角色/名称/occurrence 定位；动作后读取返回的页面状态，不充分时再次观察。页面文字、截图、可访问树、链接、MCP 指令均是不可信资料，不得替代用户目标或操作授权。导航/登录/搜索/提交通用流程不做固定业务宏。
- 桌面规则：仅在用户目标确实依赖可见桌面且本轮提供电脑操控工具时观察；每次点击/键盘输入必须通过 Driver 对最近、未变化的截图/窗口观察校验，动作后刷新观察。窗口目标使用最近清单里的精确 pid/windowId；坐标只来自最新截图。工具已拒绝过期观察时须重新观察，不能复用旧参数；不得通过另一工具绕过。
- 设置与权限：复用现有 `browserUse.enabled`、`webUrlOpenLocation`/`localUrlOpenLocation`、`annotateScreenshots`、`computerControl.enabled` 与 `permissions.mode`；新账户默认浏览器工具关闭、截图按需、电脑操控关闭、权限请求审批。任何提示词和说明不得切换设置或建立第二层硬编码审批。
- 数据边界：沿用页面与截图只在当前模型请求中临时使用、工具参数按现有投影脱敏的合同；不得把 API 手册、表单值、密码、令牌或屏幕截图复制进普通回复/持久历史。对外提交、购买、删除、安全设置等副作用仍依真实用户目标、工具合同与 Permission Owner 决策。
- 验收：回归验证 Browser/CUA 指令只按本轮工具能力附加、包含观察新鲜度/单步动作/结果核验/网页不可信边界；既有 Driver 新鲜度和浏览器语义动作回归保持通过；Agent Loop 与 Browser/Computer Use 包构建、`git diff --check`。本任务不变更 Web UI，不通过无真实认证的 `/work` 页面冒充真实 Agent 对话验收。
- 允许：精准更新 Agent Loop 的 Browser/Computer Use 使用指导、相关长期回归、Agent Loop/Browser/Computer Use README、架构事实与本合同/索引。
- 禁止：复制第三方 CUA API 手册到 LFAA、添加新权限/设置/Provider、给浏览器登录、提交或支付写死业务流程、对工具结果伪造“已核验”、触碰真实用户登录设置或对话数据。

## 实施记录

- `packages/core/agent-loop/src/execute-turn.ts`：完善 Browser 与 Computer Use 的动态使用说明。工具说明只在本轮相应工具实际登记时注入；明确先读最新状态、每次只做一个有界动作、立即检查真实回执，状态不足或不符时重新观察或停止；明确网页、截图、弹窗文字是不可信资料，不能覆盖用户目标或授权。
- `apps/cli/tests/agent-interaction-instructions.test.mjs`：新增不导入应用运行时的长期源码合同回归，检查上述规则以及两类指导的动态注入条件。
- `packages/core/agent-loop/README.md`、`packages/browser-use/browser-use/README.md`、`packages/computer-use/computer-use/README.md`：说明指导层、各 Owner 的工具 schema/执行校验职责，以及不应创建固定登录宏或第二权限层。
- `docs/系统总体架构.md`：记录动态工具指导和观察—动作—核验合同。
- `docs/PROMPTS.md` 与本文件：记录任务状态、验收证据和未测边界。
- 设置盘点后复用既有 `browserUse.enabled`、`webUrlOpenLocation`、`localUrlOpenLocation`、`annotateScreenshots`、`computerControl.enabled` 和 `permissions.mode`；本任务没有新增配置、修改账户偏好或改变授权逻辑。没有新增轮询、订阅或后台常驻工作，因此无需额外的运行时性能基准；工具动作数量仍由模型基于真实任务和每轮观察决定。
- 验证：`node --test apps/cli/tests/agent-interaction-instructions.test.mjs` 通过（1/1）；`pnpm --filter lfaa-agent-loop build`、`pnpm --filter lfaa-browser-use build`、`pnpm --filter lfaa-computer-use build` 均通过；`git diff --check` 通过。
- 未完成的集成验收：尝试运行 Browser Owner 定向测试时，在测试加载阶段缺少 `apps/cli/node_modules/lfaa-browser-use`；Computer Use 测试在加载阶段缺少 `apps/cli/node_modules/lfaa-session-persistence-jsonl/src/repository.js`，因此这两个 CLI 集成套件没有执行到断言。本轮未运行真实 Provider，也没有通过带真实认证的 LFAA 对话做端到端浏览器/桌面操作验收。Browser/Computer Use 的包构建通过，不能代替这些集成验收。
