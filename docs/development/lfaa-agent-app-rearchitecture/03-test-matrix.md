# P0 回归、构建、浏览器与性能矩阵

本矩阵区分“验证命令通过”和“产品能力/实时性能验收”。所有测试在当前 checkout 执行；Session 数据回归由 CLI 隔离环境提供独立 Home/Data，Canvas 工具回归使用测试隔离数据和测试 Plugin Host，不调用真实 Provider、Daemon、Minecraft 服务或生产资源。

## 已执行检查

| 项目 | 命令/观察 | 结果 | 解释 |
|---|---|---|---|
| 通用 Work/Session/App 上下文/项目 | `node --import tsx --import ./apps/cli/register-package-loader.mjs --import ./apps/cli/tests/isolated-test-environment.mjs --test --test-concurrency=2 apps/cli/tests/ai-work-unified-chat-projects.test.mjs` | 4/4 通过 | 覆盖路由归一、Session 领域上下文持久化/空闲切换、AI Video 单例工具上下文和项目目录关联；属于当前未提交实现的定向测试 |
| Canvas 工具与当前缺口复现 | `node --import tsx --import ./apps/cli/register-package-loader.mjs --import ./apps/cli/tests/isolated-test-environment.mjs --test --test-concurrency=2 apps/cli/tests/canvas-tools.test.mjs` | 3/3 通过 | 含 `workspace`→Minecraft `canvas_list_projects` 的只读复现；“通过”表示测试确认当前拒绝行为，不表示跨 App 调用契约已满足 |
| Session/数据库迁移 | `node --import tsx --import ./apps/cli/register-package-loader.mjs --import ./apps/cli/tests/isolated-test-environment.mjs --test --test-concurrency=2 apps/cli/tests/database-migrations.test.mjs` | 9/9 通过 | 含 v81 Session 上下文迁移、旧版本连续升级到 schema v82、数据保留及重复启动 |
| 工作区包/依赖检查 | `pnpm run check:workspace` | 通过，226 包，版本 0.0.15 | 仅说明当前工作区依赖、版本和文档一致性 |
| Web 生产候选构建 | `pnpm --dir apps/web exec vite build --outDir ../../dist/.tmp/p0-web-candidate-20261113` | 通过，3,954 modules transformed；存在 >500 kB chunk 警告 | 只写入仓库根 `dist/.tmp/p0-web-candidate-20261113`，不更新正式运行构建指纹；包含现有工作树源码 |
| Control Plane 隔离构建 | `node scripts/build-harness.mjs host-staging` | 失败 | staging 编译被同一 Session 持久化文件类型错误阻断，目标为 `packages/session/session-persistence-jsonl/src/repository.ts:532`：`{} | null` 不能传给 SQLite `SQLInputValue`。该源文件在任务开始前已是未提交改动；本轮没有修改它 |
| 全仓类型检查 | `pnpm run typecheck` | 失败 | 报同一处 `repository.ts:532` 类型错误；Client/Web 类型检查随脚本的完成状态不能单独认定通过 |
| 正式 Web/Control Plane 当前指纹 | `node scripts/runtime-build-state.mjs web` | 检查结果在本轮中从 `host`、`web` 变为仅 `host`，随后最后一次复查再次为 `host`、`web` | 共享工作树同时新增 `packages/host/project-files/src/project-files.mjs` 差异与一个项目预览恢复文档，指纹对应的源码集合发生变化。候选构建不会写正式指纹，且构建时间早于该变化；最后正式 Web/host 均需构建。本轮没有覆盖正式输出目录，也未重启服务 |
| 变更空白检查 | `git diff --check` | 通过 | 对文本差异做空白/补丁格式检查 |

## Work 实页观察与限制

- 内置浏览器打开的实际路由为 `http://127.0.0.1:3000/work`。可访问性树显示 LFAA 工作台、通用工作区会话/项目区、小鱼 Agent 对话与工具资源区；页面上显示控制端已连接。
- 3000 端口属于一个 `node ... apps/cli/src/bin.ts web --no-local-daemon` 的 LFAA 进程，但无法从进程信息确认 cwd/工作副本。独立健康检查 `GET /health` 与 `/` 返回 503，构建状态接口可访问；最后 gate 显示正式 host/web 指纹均需构建。
- 因运行进程无法归属当前 checkout 且正式构建过期，本次页面只作为现状观察，不是当前源码的有效验收。没有重建正式目录、停止/重启进程、切换用户偏好或执行工作区操作。只检查一个桌面当前窗口状态，未取得截图证据；没有做窄分栏、短屏、App Canvas、人工编辑或交互/流式性能验收。

## 已知回归与尚未测项目

| 场景 | P0 状态 | 当前证据/后续验收 |
|---|---|---|
| `workspace` 目录列出并调用多 App Canvas 工具 | **失败（行为缺口已复现）** | 隔离只读测试确认执行上下文为 `workspace` 时目标 App `minecraft` 被 `assertCurrentApplication` 拒绝。修复属于后续能力上下文任务，须保留 Permission Owner、账户/App 校验与领域版本校验 |
| Session `contextApplicationId` 保存/切换/清空/账户隔离 | 代码合同与隔离回归通过 | `ai-work-unified-chat-projects` 4/4；还没有在当前源码内置浏览器验证真实设置/Session 往返 |
| AI Video 单 App Canvas 工具使用其业务上下文 | 工具合同回归通过 | 已测工具上下文解析；没有调用真实 Video/Canvas Provider 或写真实项目 |
| 手动 Canvas 编辑与 Agent 写入后的刷新 | 静态链路/Owner 检查通过；端到端未测 | 查到 409 与 dirty 本地变更保护、AbortSignal 与目标项目刷新；未执行 Agent 写入或真实 UI 的双向编辑验收 |
| Session 刷新、Run 恢复、取消/重试、审批拒绝 | 未测 | 需运行中的当前源码 Web/Control Plane 和专门事件/交互回归 |
| 设置中心默认值、保存与跨路由生效 | Owner/映射审计通过；行为未测 | 未写设置或真实用户偏好；下阶段 UI 测试须覆盖现有账户保存值不被默认值覆盖 |
| 账户/App 隔离与 `expectedUpdatedAt` 冲突保留 | 工具/Owner 定向回归含部分合同；完整 UI 场景未测 | 当前 Canvas 测试覆盖 Owner 隔离、非法参数与版本冲突合同；未做两个浏览器视图的实时竞争写入 |
| 四栏/窄分栏/短屏、交互延迟/内存/网络/React commit/FPS | 未测 | P0 未取得当前源码的可信运行实例；后续先建立同设置、同数据的基线，再决定 P1 门槛 |
| 真实 Provider、远程 Daemon、Minecraft 游戏服务 | 未测且按本批边界未调用 | 不以候选构建或静态合同代替真实能力验收 |

## 回退点

本轮没有改产品运行代码、数据库数据、用户设置、Provider 或领域 Owner。唯一新增的源码回归位于 `apps/cli/tests/canvas-tools.test.mjs`，可以单独撤销而不影响产品行为；四份 P0 文档与 `docs/PROMPTS.md` 索引只记录当前基线。既有 `contextApplicationId` 和其他工作树差异原样保留。
