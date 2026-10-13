# 本机可执行文件路径启动

## 目标与验收

当用户在受支持的 Windows 本机 Profile 中用自然语言提出启动目标时，AI Work 按用户意图选择现有登记应用搜索/启动链；若用户明确提供某个 `.exe` 的绝对路径，则把它作为精确目标直接启动，不再先搜索登记目录，也不通过浏览器或桌面搜索框输入路径。路径启动入口对所有符合校验的用户目标通用，没有 PCL 专用分支。启动成功仅指 Windows 接收了进程创建请求；Agent 随后必须观察桌面，再报告实际可见结果。

工具只接受绝对 `.exe` 路径，不接受目录、Shell 命令、启动参数、相对路径或模型补全的可执行路径。执行前验证扩展名、规范路径与普通文件；通过既有高风险操作授权后，使用 `shell:false`、空参数并以可执行文件所在目录作为工作目录启动。工具不触发 UI 输入，所以不需要先截图；启动后仍调用现有观察工具核验。异常、缺文件或非 Windows 环境均明确失败，不重试启动。

## Owner、入口与设置

- Owner：`packages/computer-use/computer-use` 的 Windows 本机应用启动 Runtime；Agent 指引由 `packages/core/agent-loop` 持有；工具审批、执行状态与会话脱敏沿用现有 Core Tool Registry / Session Owner。
- 入口：Windows Electron `desktop` Profile，以及仅绑定 loopback 的本机 Windows CLI `web` Profile；远程 Web 和远程 Daemon 不执行此本机进程。
- 配置：复用账户级 `computerControl.enabled`（默认关闭）、`permissions.mode` 和当前 App/工具范围，不增加设置项、不修改已有偏好。启动工具沿用 `dangerous` 风险；`ask` 请求审批，`approve_remembered` 仅复用相同目标范围，`full_access` 按现有权限直接执行。
- 数据：不保存完整本机路径到 AI Work 工具参数或结果历史；审批摘要显示足以识别的实际目标。无额外持久化、订阅或后台任务。

## 范围与回归

- 保留应用目录 ID 启动及其同轮候选校验；新路径入口只服务用户直接给出的明确 `.exe` 绝对路径，不扩大目录扫描。
- 复用进程启动器，保持 `shell:false`、隐藏控制台、分离 GUI 生命周期；新路径以实际 EXE 所在目录作工作目录，不传参数。
- 增加定向回归：精确 EXE 路径、缺文件/相对路径/非 EXE 拒绝、无参数与 EXE 工作目录、审批目标摘要、账户开关与会话脱敏、受支持 Profile 工具目录。
- 权限风险标记复用既有 Owner：`ask` 进入原审批流程，`approve_remembered` 只放行精确匹配授权，`full_access` 由既有授权器直接允许，不添加额外弹窗或确认层。
- 运行直接相关回归、类型检查、能力包/工作区及根构建与差异检查；真实 Provider、真实 UI 审批交互、Windows 桌面进程窗体/画面核验按本轮实际是否运行分别记录。
- 所有构建产物仅写根目录 `dist/`。性能边界为单次路径规范化、属性查询和进程派发；不添加全盘扫描、轮询或额外 UI 订阅。

## 初始状态

确认现有 `computer_use_launch_local_app` 仅接受当前 Run 搜索/推荐回传 ID；应用登记目录不覆盖所有便携应用。用户给出 PCL 等任意便携应用的绝对 EXE 路径仍会被旧指引导向 CUA 搜索界面，因此焦点错误会阻断目标。此任务补足适用于任意用户指定 EXE 的本机启动工具，沿用三种现有权限模式，不创建另一套通用 Shell 能力。

## 实际验证与交付边界

- `node --import tsx --import ./apps/cli/register-package-loader.mjs --test apps/cli/tests/computer-use.test.mjs`：1/1 通过；覆盖路径校验、无启动参数、工作目录、开关、参数/结果脱敏及 `ask` / `approve_remembered` / `full_access` 的授权判定。首次执行发现原有游戏测试在同一 Agent Run 内用后续空查询清掉早先候选；测试查询现拆到独立 Run，没有改变产品候选撤销规则。
- `pnpm --filter lfaa-computer-use build`：通过；能力包输出到根 `dist/packages`。
- `pnpm run typecheck`：客户端与 Host 类型检查通过。
- `pnpm run build`：110 能力包、Web、Control Plane、npm CLI 产品运行树构建通过；Web 仍有既有 501.30 kB C++ 分块提示。
- `node scripts/check-workspace.mjs`：111 包检查通过，版本 0.0.8。
- `node scripts/runtime-build-state.mjs web`：输出 `[]`，已构建 Web 与当前源码指纹一致。生成的 Control Plane 包含新工具及 Agent 指引。
- `git diff --check`：通过。
- 未重启当前运行中的 LFAA 服务，未通过当前 Provider 执行真实 PCL，也未验证审批界面、真实 Windows 窗口与屏幕帧时间。构建产物已更新；运行中进程仍需在安全时机按产品正常流程重启后才会加载新能力。

## 文件职责

- `packages/computer-use/computer-use/src/local-apps.ts`：绝对 EXE 规范路径/文件验证、无参数 `shell:false` 启动及 EXE 目录工作目录。
- `packages/computer-use/computer-use/src/index.ts`：通用路径启动 Tool schema、权限范围摘要、执行器登记。
- `packages/core/agent-loop/src/execute-turn.ts`：自然语言目标选择指引、调用活动名称和完整路径历史脱敏。
- `apps/cli/tests/computer-use.test.mjs`：路径、权限模式、进程选项、设置开关和脱敏回归。
- `packages/computer-use/computer-use/README.md`：本机应用目录和精确路径启动能力说明。
- `docs/系统总体架构.md`、`docs/开发计划.md`：当前 Owner、功能范围与实际运行边界。
- `docs/PROMPTS.md`、`docs/development/local-executable-path-launch-20261009.md`、`docs/development/local-computer-activity-20261009.md`、`docs/development/local-web-computer-use-20261009.md`：本轮合同、既有规则补充与 Web 工具目录数量同步。

## 后续补充：自然语言应用发现

精确绝对路径是可选快捷方式，不是启动应用的前提。当前通用自然语言理解、便携 EXE 有界查找及“替我审批”重复记忆语义见[本机应用意图发现合同](local-app-intent-discovery-20261009.md)；该合同补充了同轮候选搜索/校验及可撤销记忆，不改变本合同的无参数、`shell:false` 精确路径启动边界。
