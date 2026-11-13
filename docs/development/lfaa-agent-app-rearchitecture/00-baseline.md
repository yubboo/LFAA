# LFAA 1.0 Agent-first 架构与体验重构：P0 基线合同

<a id="lfaa-agent-app-rearchitecture-p0-20261113"></a>

## 用户目标

严格依照《LFAA-1.0架构与体验重构实施计划》，先完成其明确要求的 P0 工程基线与真实调用链审计，为后续分批优化建立可核对的当前源码基线。P0 交付后暂停，不提前进入 P1 文件拆分或产品行为重构。

## 运行入口、Owner、设置与数据边界

- 目标入口：通用 `/work` 与 Session；App 来源上下文；App 手动操作；`/apps/<app>/canvas`；Canvas Agent 工具与跨 App 工具目录。
- 预期链路 Owner（以当前源码核实为准）：共享入口与界面由 `packages/client/**`；Session 由 `packages/core/session`；Agent Run 与工具调度由 `packages/core/agent-loop`、`packages/core/tools`；权限由既有 Permission Owner；Canvas/领域数据由对应领域 Owner 持有。
- 需核对的既有设置：`canvas`、`appearance`、`permissions.mode`、`aiRuntime`、`general.navigationLayout` 及 App 显隐/最近路由偏好。P0 只记录默认值、持久化与消费映射，不改动设置或用户偏好。
- 数据边界：保留现有 Session、Workspace 项目、Canvas 与领域资源格式；不迁移、覆盖或清理用户数据。需要写状态的回归须隔离 Home、Data 与临时项目，并只清理本轮唯一创建的数据。
- 权限边界：保留认证、目标 App/账户/版本校验及唯一 Permission Owner；不创建第二套授权，不运行会产生真实领域副作用的工具。

## 允许与禁止范围

- 允许：阅读当前 checkout 的源码、直接调用链、既有未提交差异、Owner/包说明、设置映射、测试与构建状态；新增本目录四份 P0 基线文档及必要索引；针对经证实的跨 App Canvas 问题补充隔离、非破坏性且长期有用的契约回归；运行直接相关的静态检查、类型/包构建/回归，以及不影响共享服务的实页基线检查。
- 禁止：拆分四个大型组件、重设计 UI、改变产品行为或权限、创建新 Agent/Session/Provider/工具运行时、迁移或删除真实数据、调用真实 Provider、操作 Minecraft/Daemon/远程节点、重启或停止既有服务、改动其他 checkout、创建分支或提交。
- 保留开始时 `main` 工作树中的所有既有改动；读取其差异用于现状判断，但本轮不编辑这些文件。编译产物仅可写入仓库根 `dist/`。

## 可观察验收与完成定义

在 `docs/development/lfaa-agent-app-rearchitecture/` 下交付：

1. `00-baseline.md`：本合同、源码/运行环境快照、当前状态、验收结果与未测边界。
2. `01-dependency-map.md`：指定入口到 Run、工具注册、权限、领域 Owner、结果回传/UI 刷新的实际链路图。
3. `02-split-plan.md`：四个热点文件的状态/副作用分组、真实依赖与可抽离边界；只给后续批次建议，不执行拆分。
4. `03-test-matrix.md`：已存在回归、隔离复现、构建/浏览器/设置/性能矩阵，并将通过、失败、未测分开。

同时更新 `docs/PROMPTS.md`。所有观察均对应当前 checkout，明确包括 `contextApplicationId` 在未提交差异中的实际落地情况、`workspace`→领域 Canvas 工具的真实 App 上下文行为、设置 Owner 映射、实际运行的命令和实页视口证据。完成后将合同标记为 P0 已交付并停止；不把未执行的 P1/P2 事项写成已完成。

## 实施记录

- 状态：P0 文档与定向复现已交付，按计划暂停；未开始 P1 文件拆分或产品行为修改。
- 源码快照：2026-11-13；checkout `E:\lfaa1\lfaa`，分支 `main`，HEAD `808ec53114ff97749b75b604928ba6a7a0180363`。开始时已有 33 个 tracked 文件带未提交改动，覆盖相关 Session、Work UI、数据库迁移、README 与合同；均作为当前工作树事实保留。另有 `C:\Users\Administrator\.codex\worktrees\agent-gap-fixes\lfaa`，本轮未进入、未修改。当前包版本 0.0.15，pnpm 11.17.0。
- 运行与构建：开始时 `runtime-build-state.mjs web` 报告 host/web 需构建；本轮后段连续检查一度仅报告 host，随后又报告 host/web。期间共享工作树新增了 `packages/host/project-files/src/project-files.mjs` 修改及 `docs/development/project-preview-error-recovery-20261113.md`，因此指纹与源码快照正在变化；最后一次 gate 结果为 `host`、`web` 均需构建。Web 候选构建成功于较早的工作树快照，输出仅写入 `dist/.tmp/p0-web-candidate-20261113`，不代表最终动态快照。Host staging 与全仓类型检查在各自执行时都被 Session JSONL SQLite 参数类型错误阻断；没有覆盖正式运行目录。
- 工作区与验证：`check:workspace` 226 包通过；Session/Work 定向回归 4/4、数据库迁移回归 9/9、Canvas 工具回归 3/3 通过。Canvas 工具回归新增一个只读用例，确认通用 `workspace` 调用带目标 App 的多 App Canvas 工具当前会被 App 上下文守卫拒绝；这是已证实的可用性缺口，不属于授权绕过。本轮没有修改任何产品运行代码。
- 页面证据：内置浏览器打开 `http://127.0.0.1:3000/work`，访问树显示 LFAA Work 工作区、会话/项目、Agent 聊天与工具区域。3000 端口进程为 LFAA CLI Web 启动命令，但 cwd 无法确认；健康检查 `/health` 与 `/` 返回 503，最后 gate 检查 host/web 指纹均需构建。因此该页面仅记为当前运行观察，不作为当前 checkout 源码验收。未检查窄分栏/短屏、Canvas 手动编辑、Provider/Daemon、实际 Run/审批、截图或性能指标。
- 工作区检查：最终 `git diff --check` 通过。Settings、用户偏好、项目/Session/Canvas 运行数据、Provider、Daemon 和 Minecraft 服务均未写入或操作。
- 验证残留：本轮 Windows 验证后出现 `apps/cli/Microsoft/Windows/PowerShell/ModuleAnalysisCache`，单文件 79,597 字节，是 PowerShell 模块分析缓存，不是产品数据。尝试移除该唯一文件时被自动安全审查拒绝；未改用其他删除方式，当前目录保留待后续安全清理。
- P0 文件：本目录 `00-baseline.md`、`01-dependency-map.md`、`02-split-plan.md`、`03-test-matrix.md`；同时更新 `docs/PROMPTS.md` 任务索引。直接相关的回归只增加在 `apps/cli/tests/canvas-tools.test.mjs`。
- 重要缺口与边界：Session `contextApplicationId` 已存在于任务开始时的未提交实现中，P0 仅审计其实际数据链；Canvas 跨 App 执行上下文缺口已复现但按计划留给后续批次；P1-A1 编号/目标文件与计划优先顺序不一致，已记录为未决项，开始 P1 前须统一。全仓类型错误、正式 host 运行指纹及有效当前源码页面验收均未解决。
- 下一步状态：P0 完成后停止。下一批应按计划发起单独的 P1-A1/P1-A 工作，只在明确任务合同后开始；不得将本记录视为 P1 授权。
