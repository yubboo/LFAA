# 通用 Agent 能力补全

## 本轮合同

用户要求整体补全，并明确指定只读参考 `H:/deepseek-harness/packages` 的 core、llm、mcp、sdk、shell、skill、session、session-query。LFAA 修改入口为当前 `H:/LFAA1`；保留所有既有未提交变更。发现电脑操控适配器只装在 Electron desktop，另有本机 Web 装配缺口；后由 [本机 Web 电脑操控合同](local-web-computer-use-20261009.md) 修复。

启动入口也已对账：`lfaa.bat` 菜单【2】默认【1】执行完整 Web（等价 `pnpm lfaa web`，自动托管本机 Daemon）；菜单【2】【2】是独立 Daemon 节点，需要持久化 `LFAA_DATA_DIR`；菜单【2】【4】只启动等待 3000 控制端的 Vite 前端。修复了完整 Web 启动前 PowerShell 使用 Node 内联 `--eval` 解析数据目录导致的 `[eval1]` 引号错误。菜单服务未重启，真实 Web 入口通过隔离编译启动回归验证。

目标：AI Work 模型根据用户语义选择已接入能力，发现关闭原因，按账户权限申请开启并在同一运行继续执行。打开现有本机软件不要求先安装该软件的 MCP 或 Skill。Web 的主机操作通过在线 Daemon，桌面电脑操控通过实际装配的适配器。

Owner：core/tools 管工具合同；agent-loop 管请求/执行/动态目录；settings 管账户配置；permission-presets 管审批；core/session 与 session-persistence-jsonl 管会话及事件；MCP 复用当前传输池；Skill 复用项目文件及写作 Owner；SDK 复用认证 API；Shell 复用 Daemon，禁止在控制端引入第二个主机执行器。

设置：沿用 plugins.enabled/mcpServers/prompts、computerControl.enabled（默认关闭）、permissions.mode（ask/approve_remembered/full_access）、general.integratedShell/taskFolder、aiRuntime 的请求、输出、工具及子 Agent/命令预算。新增 aiRuntime.requestRetries（默认 1，0–3）、retryDelaySeconds（默认 1 秒，0–30）并补齐类型/默认值/校验/持久化/现有设置页，旧偏好不重置。模型只可修改能力开关，不可修改权限、模型、凭据、节点或扩大继承工具范围；Web 本机屏幕另要求 Windows loopback profile 且设置中心授权开启。新增设置控件沿用当前外观组件，无新 CSS 变量。

允许实现以上 Owner 的直接依赖、真实能力包及入口装配、SDK 和长期回归；禁止更改上游 DSH、真实运行数据/偏好、重启正在使用的服务或 Minecraft、安装外部插件、发布或提交。所有构建仅写根 dist。

验收：关闭能力仍有状态/启用工具；ask 审批前不改设置，remembered 按已有范围，full_access 无新增逐项审批；拒绝不绕过；同一运行开启后新增工具、关闭/卸载后撤销；计划/子 Agent 范围仍生效；Skill 按需读取；MCP 资源与工具同租约并清理；Session 查询账户/App/项目隔离、分页有界，不返回内部提示词/隐藏推理或原始工具参数/结果；SDK 不绕过认证；Provider 非 SSE/空响应返回真实诊断或预算内恢复，不重放工具。运行相关回归、类型检查、职责构建、工作区 Gate 与差异检查。真实 Provider、桌面操作、浏览器帧时间及外部 MCP 未测时单列，不以合成夹具代替。

## 对话自动化纠偏（2026-10-09）

此前 `packages/workflow/tool-workflow` 为空壳，Agent 看不到已存在的 Workflow Owner。本次已在这个职责包内接入真实聊天工具；原有 Agent Loop 继续做模型请求与工具派发协调，Workflow Owner 和领域适配器继续持有图、运行与节点执行：

- 在 `packages/workflow/tool-workflow` 登记模型可调用的工作流目录、保存、运行、状态查询与取消工具。工具从当前运行的账户和 App 推导范围，不接受模型指定其他账户、App 或节点权限。
- 保存、启动和取消调用现有 Workflow Owner；图、运行记录、节点版本校验、执行引擎和领域副作用继续由现有包负责。Minecraft Agent 节点复用 Agent Loop、Tools、权限/审批和 Daemon，不建立第二个运行器。
- 所有写入经 `lfaa-tools` 与现有 `permissions.mode` 风险/审批处理。若流程涉及 Minecraft 开服并需接受 EULA，必须通过当前 Run 的既有问题通道向用户明确询问；模型不能用参数代替用户同意。
- 工作流节点 Agent 的澄清复用父对话当前 Run 的问题通道。取消父 Run 时请求取消 Workflow，并准确报告已派发的节点副作用可能仍在执行或结果未确认。
- 不新增设置、权限策略、存储、工作流引擎或假成功。对尚未注册节点的 App，模型只能看到只读目录，不得声称这些 App 已有可执行自动化。

验收：跨 App/账户范围来自真实 Run 上下文；模型能通过已登记工具发现节点与工作流、保存由 Workflow Owner 校验的图、启动并读取真实运行状态；Minecraft 节点结果回到同一对话，审批/问题/取消保持现有 Owner 边界；未知节点、旧版本和越权调用拒绝；Bundle 装配包含该真实工具包。合成 Provider 回归、相关包构建和工作区检查通过后，仍将真实 Provider、Daemon 与浏览器流程单独标为待验。

### 本次实现与验证（2026-10-09）

- `packages/workflow/tool-workflow` 已登记目录、列表/详情、保存、运行/等待、运行状态和取消工具。账户与 App 从当前工具上下文推导；保存/运行/取消使用现有三种权限模式，Minecraft EULA 和节点 Agent 澄清复用当前 Run 的问题通道。
- `lfaa_workflow_run` 先校验保存版本；等待期间每秒最多读取一次运行记录，只在状态变化时发布进度，最多等待 10 分钟。取消只请求 Workflow Owner 中止，并明确不回滚已派发副作用。
- 完整隔离 Harness 通过模型工具调用依次发现目录、保存工作流、启动运行；Minecraft Agent 节点调用真实注册的 `minecraft_list_nodes` 工具，结果经 Workflow Owner 回到同一对话。另验证拒绝 EULA 时未创建运行记录，以及账户/App 列表隔离。
- Workflow Core v44 迁移夹具原先缺少当时已存在的 `ai_tool_approvals` 和 `ai_host_tasks` 表；已补齐旧版表结构，保留迁移断言并通过独立回归。
- 上述四文件组合回归首次为 8/9：Agent Runtime、通用能力与完整 Harness 通过；Workflow Core 失败原因是 v44 隔离数据库漏建当时已有的审批表与 Daemon 任务表。补齐夹具结构后，`node --import tsx --import ./register-package-loader.mjs --test --test-concurrency=1 tests/workflow-core.test.mjs` 独立重跑 1/1 通过。
- `pnpm --filter lfaa-tool-workflow build`、`pnpm exec tsc --noEmit -p tsconfig.host.json` 与 `node scripts/check-workspace.mjs` 均通过；工作区检查识别 178 个实际包，类型路径/清单一致。`pnpm install --lockfile-only --offline` 通过当前 835 条供应链策略校验。
- 合成 Provider 和本地隔离数据库证明了代码闭环，不证明真实模型选工具、在线 Daemon 执行或浏览器/桌面交互；这些仍待现场验收。本次未重启现有服务。

## 上游对照与实施证据

| 用户指定上游组 | 已接入 LFAA 实现 | 权威边界 |
|---|---|---|
| core | 能力状态/开关工具、每步目录刷新、审批后派发复核、已有 Tool Registry 生命周期与结果回传 | 模型选择工具；设置、审批、执行仍归现有 Owner |
| llm | lfaa-llm 的唯一 SSE delta/message/JSON 请求与失败诊断；预算内有限恢复 | 同一模型、不重放工具、不公开隐藏推理 |
| mcp | lfaa-mcp-client 的工具和资源，HTTP/stdio 池、撤销与取消 | 共用账户/App/配置指纹、出站和权限合同 |
| sdk | 类型协议和认证 REST/SSE Client，提交/跟随/续问/回答/停止/审批/历史 | 复用 LFAA API，未复制 DSH 专属 stdio SessionProvider |
| shell | 独立工具包登记节点、命令、任务查询及取消 | 单一 Daemon 执行器；持久交互式 PTY 未接入 |
| skill | 统一 Skill 目录及按需正文 | 项目文件/写作 Owner 校验路径、风险和分页 |
| session | 既有 JSONL 事件及唯一 Session 范围接口，共用异步扫描 | 不新增存储或重写 DSH 格式 |
| session-query | 五项会话/结构事件工具与分页 | 当前账户/App/同项目；无项目仅自身，不暴露内部请求或原始工具参数/结果 |

新包均有真实实现及消费者，七个新包进入 111 个实际工作区包的依赖/类型映射/清单。实现目录的四个占位文件删除；旧 Provider/MCP Core 源码迁移后删除，历史记录只映射链接，不改写当时事实。逐文件绝对路径和职责见 [本次文件记录](general-agent-capabilities-files-20261009.md)，其中含本机 Web CUA 与 LFAA 0.0.8 候选构建的后续增补。上游只读，没有直接复制其专属 Session/UI/传输装配，也没有修改 DSH。

## 实际验证

均在当前工作区执行；真实数据与账户偏好未改变，运行中的服务未重启。

| 命令 | 结果 |
|---|---|
| pnpm install --offline --ignore-scripts | 工作区链接/锁文件同步成功，没有下载新库；既有 peer/deprecation 提示保留 |
| pnpm run typecheck | Client、Host 均通过 |
| node scripts/check-workspace.mjs | 111 个包，版本 0.0.8，依赖/入口/映射/文档一致 |
| node --import tsx --import ./apps/cli/register-package-loader.mjs --test apps/cli/tests/{general-agent-capabilities,agent-runtime,mcp-tools,execution-control,ai-model-thinking-controls,settings-contract,harness-agent-api}.test.mjs（执行时使用逐个展开路径） | 30/30 通过；包括三种权限、拒绝/继承范围、同 Run 启停、思考期间撤销、请求恢复不重放、认证 SDK、MCP 资源 |
| 同一 Node/loader 调用，capability-mcp、capability-skill、computer-use、session-cache 四个文件 | 7/7 通过；真实协议/项目 Owner，CUA Driver 为隔离夹具 |
| 同一 Node/loader 调用，session-kernel、session-kernel-persistence、dsh-client-session-scope 三个文件 | 16/16 通过；持久化/恢复/fork/计划及隔离 |
| 同一 Node/loader 调用，client-requests.test.mjs | 6/6 通过；设置请求可独立取消，不污染其他组件的默认共享查询 |
| pnpm run build（首次源码构建） | 110 个产品能力包、Web、控制端及 npm CLI 运行树全部构建成功；版本更新后的最终重建见下项 |
| node --test scripts/tests/compiled-web-startup.test.mjs | 1/1 通过；正式编译 CLI 在独立端口、隔离 dist/.tmp 数据启动，健康/前端/401/首次账户认证/新设置默认值核验，IPC 正常退出码 0 |
| node --test scripts/tests/resolve-data-directory.test.mjs | 2/2 通过；PowerShell 菜单改为调用解析器文件；Node 解析命令分别从 PowerShell 7 与 Windows PowerShell 5.1 调用成功，不再拼接 `--eval` 源码 |
| pnpm run build:desktop:electron:win | LFAA 0.0.8 Windows x64 NSIS 候选构建、包内 CUA Driver 导入/工具注册、安装器/blockmap/latest.yml 版本与哈希检查通过；Authenticode 为 NotSigned，未安装或启动桌面候选 |
| pnpm run build（版本同步后） | 重建 110 个能力包、正式 Web、Control Plane 与 npm CLI；随后 Web 构建指纹为 `[]` |
| git diff --check | 通过 |

上述是 60 项直接回归，不包含此前已运行重复用例。最后补齐设置对账 fetch 的 AbortSignal 后重新执行 Client/Host 类型检查和能力包/Web 构建，并重新组装 CLI。初次回归发现迁移后测试 import 和 MCP 配置规范化夹具不匹配，修复后重新运行通过，未跳过失败。交付文件清单最初使用机器绝对链接导致文档 Gate 拒绝，改为“绝对路径记录＋仓库相对链接”后重新通过。构建保留既有 Vite >500 kB 的 chunk 提示；没有把构建成功当成帧时间结果。当前仓库没有 workspace-preflight 命令，未运行该名称的 Gate，实际工作区 Gate 如上。

## 性能、安全与尚未实测项

- 动态目录在请求/派发边界刷新，不新增后台轮询；MCP 指纹不变不重连，旧租约释放，所有工具与资源复用唯一协议 Owner。计时/流/观察的撤销仍使用原生命周期。
- 前端配置失效按 Run 合并为串行读取；活动 token 不触发重复设置请求，卸载/账户/App 切换通过 AbortController 与代数校验撤销迟到结果。此项为静态检查，浏览器帧时间未测。
- Session 查询只保留单个扫描事件及 limit+1 投影；每页异步单次校验完整 SHA 链，不复制完整 Kernel。CPU/磁盘读取仍随日志增长，索引、压缩、沉降及真实大数据曲线未完成。
- Provider 恢复只重复尚未产出回答/工具的请求；工具副作用不自动重放。拒绝/过期仍锁住本任务写操作，计划与子 Agent 工具范围不因启用而扩大。
- 未调用用户真实 DeepSeek/豆包模型，没有实测桌面“打开豆包”、用户 MCP、远端 Daemon 或浏览器交互帧时间。Windows 0.0.8 安装候选已构建并通过随包 Driver 与发行文件检查，但未安装、启动或目视验证桌面界面。已安装桌面及当前运行中的进程未自动加载此改动；Web 需要重新启动后才装配本机 CUA。本轮不宣称 DSH 的全部未来模块已移植。
- 正式构建后运行 `node scripts/runtime-build-state.mjs web` 返回 `[]`，当前 Web/控制端源码指纹均与构建一致。自动审批检查拒绝删除本轮先前失败回归遗留的 `H:/LFAA1/dist/.tmp/lfaa-general-agent-capabilities-di15qf`，返回原因只有“blocked by policy”；未重试或绕过，目录保留，不进入产品装配。
