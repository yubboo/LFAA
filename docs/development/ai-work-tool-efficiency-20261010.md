# AI Work 本机应用启动效率合同

## 目标、运行入口与 Owner

入口为 AI Work `/tasks`，目标 Profile 是允许本机 CUA 的 Windows `web` 或 Electron `desktop`。模型仍负责理解用户目标、选择已登记 Tool 和根据真实结果继续判断；Agent Loop 统一执行权限、Tool 派发和结果回传。本机应用清单、唯一候选匹配、启动与本机窗口观察归 `packages/computer-use/computer-use`。

本轮针对已观察到的 PCL2 类请求重复查询、Shell 递归搜盘及过多模型往返。直接启动工具可接收自然语言应用名，在本机 Owner 内解析为唯一高置信已发现候选并按原权限合同启动；如果存在多项同等合理候选或结果不可靠，只返回公开候选并保持未启动。搜索已登记程序时，只有未命中才执行现有有界便携查找，避免已找到应用仍耗费磁盘扫描。

## 设置、权限与数据

- 沿用 `computerControl.enabled`（默认关闭）与 `permissions.mode` 三种模式；直接名称启动仍是同一个 dangerous Computer-Use Tool，不新增审批策略。
- 沿用 `aiRuntime.maxModelRequests`、`maxToolCalls`、`contextWindowTokens` 和现有自动上下文管理；本轮不增加每轮 Token 预算或硬封顶。
- 路径、候选 ID 和进程参数继续由 Computer-Use Owner 验证。模型只看到显示名、来源、可选文件夹别名和不透明 ID，不得到可执行路径。
- 不读写应用日志、游戏实例数据或账户凭据来完成普通启动；真实启动后仍以本机观察确认可见状态。

## 修改边界

允许修改：`packages/computer-use/computer-use/src/index.ts`、`local-apps.ts`，直接相关的 `apps/cli/tests/computer-use.test.mjs`，`packages/computer-use/computer-use/README.md`，系统架构和开发计划中的本机应用 Tool 合同，以及本任务登记。

禁止修改：Provider 选择、模型路由、统一权限 Owner、Daemon/游戏节点 Shell、账户/设置数据、任意 Shell 或路径执行、产品特定 PCL2 关键词分支、歧义候选自动选定、全盘无界搜索、运行中服务重启、真实游戏操作、无关工作树文件。

## 验收

1. 模型对用户明确指定的应用名可调用现有启动 Tool 的 `query` 入口；Owner 只在唯一高置信匹配时启动，未命中、歧义或低置信时不派发进程。
2. 旧 `id` 路径继续要求当前 Agent Run 搜索/推荐候选，并在派发前重新验证。
3. 已登记 Windows/Start Menu/Steam/PATH 目标命中时，不启动便携 EXE 扫描；只在没有已登记候选时运行现有 2.5 秒有界查找。
4. 模型可见说明要求命中即继续启动、不重复查询；不要用 Shell/文件工具递归扫盘定位同一应用，必要时只做有边界的已知位置查询。
5. 运行 `computer-use.test.mjs` 定向回归、computer-use 包构建、`pnpm --dir apps/cli typecheck`、实际存在的工作区 Gate 和 `git diff --check`。不为本轮重启 Web/Control Plane 或操作用户桌面。

## 实施与验证记录

已实现：增加危险启动工具的名称 `query` 入口，一次发现内解析、重检查设置授权并派发；唯一高置信目标启动，歧义、低置信、无结果或扫描受限均不启动。旧 ID 路径仍按当前 Run 候选重发现。已登记来源匹配时跳过便携扫描；精确路径工具不再提示按名称转 Shell 搜索。沿用 `computerControl.enabled`、`permissions.mode` 与既有 Agent 请求/工具预算，未新增 Token 上限或设置项。

验证：`apps/cli/tests/computer-use.test.mjs` 定向回归 1/1 通过，覆盖单次发现与启动、PCL2 首字母匹配、歧义不启动、已登记命中跳过便携扫描、路径不泄露；computer-use 包构建、`pnpm --dir apps/cli typecheck`、`pnpm run check:workspace`（178 包）和 `git diff --check` 通过。当前仓库没有 `workspace-preflight` 脚本。真实 Provider 选择、审批 UI、Windows 实机启动/观察、平均 Token 节省和帧时间未测；不据静态回归宣称其已验收。
