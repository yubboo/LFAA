# Agent 实际任务审计、修复与验收（2026-10-14）

## 结论与范围

当前 LFAA 已有真实 Agent、Provider、Tools、Skills、权限、Session 和节点执行链；本轮没有另造框架。实际浏览器跑过构建修复、联网搜索、应用启动、Minecraft 部署/停服、失败续修和停止。构建、搜索、记事本、续修、停止取得真实证据；首次 Minecraft 虽然就绪/停服成功，但没有满足预检承诺的 Java 11，不能算全部约束通过。发现工具没有暴露领域服务已有的运行时参数后，补齐协议和真实要求查询；修复后的模型预检明确拒绝 Java 11 与 Paper 1.16.5 的冲突组合。没有再创建第二个实例来冒充指定环境开服已重验。

依据为当前 `H:/LFAA1` checkout、源码、正式 Profile、长期回归、JSONL 的公开事件字段与 ChatGPT 内置浏览器 `http://127.0.0.1:3000/`。分支为 `codex/agent-execution-validation-20261014`。开始时已有 9 个脏文件；本轮保留、审查并重新验证，新增相关修复。未提交、推送、发布或改用户权限/账户。附件 `D:/Downloads/writing-block.md` 是需求材料，其中角色、历史审查范围及提交要求没有被当作额外授权；本轮没有声称读取 GitHub 分支全部源码。DSH 只读核对了本机根规范、架构、Agent 工具取消/持久化片段，未修改 DSH。

真实模型使用用户已配置的 `deepseek / deepseek-flash`。没有读取/打印明文凭据，没有更换付费账户。Minecraft 法律许可通过本轮用户明确确认，范围仅为 `agent-acceptance-20261014` 隔离实例的部署、核查和停止。

## 调用链与能力矩阵

正式入口：共享 Client → Session Controller（认证、账户归属）→ Agent Run → Settings/默认模型 → LLM 原生请求 → 当前工具目录 → Permission Owner → 领域/本机/Daemon Owner → 工具结果 → 同一模型继续判断 → Session JSONL。网页连接只订阅 Run；取消由 Run 信号向执行器传播。

| 能力 | 状态与当前证据 | 权威位置/边界 |
|---|---|---|
| Provider 解析、流、原生工具及结果续接 | 已实现且本次真实 DeepSeek 通过；其他供应商未实测 | `packages/settings/settings/src/service.ts`、`packages/llm/llm/src/completion.ts`、`packages/core/agent-loop/src/execute-turn.ts` |
| DeepSeek | 真实文本、工具选择、多轮结果回送和电脑观察任务完成 | 单一当前账户；不据模型名称推断全部能力 |
| OpenAI、豆包/Ark 等通用 Provider | 已实现通用连接/目录；真实账户兼容性未验证 | 设置登记和 LLM 协议；合成 OpenAI 请求回归不能替代真实厂商验收 |
| Provider 错误/截断 | 合成回归通过：400/402、其他 HTTP 分类、错误 SSE、提前 EOF、推理续接来源隔离 | `apps/cli/tests/llm-completion.test.mjs`；没有实测所有供应商的 429/5xx/视觉/健康诊断组合 |
| 本机 Shell | 已实现且实际运行/退出码/取消通过 | `packages/shell/tool-shell/src/index.ts` → 本机 Shell；限真实可装配的本机 Profile |
| 目标节点 Shell、项目文件 | 已接线且隔离完整 Profile 回归通过 | Tool/Jobs/Daemon；项目 CRUD 和远程第二台主机未做本轮真实 Agent 验收 |
| Web 搜索/读取 | 实际搜索及官方来源链接通过 | `packages/web/tool-web`、`web-search-deepseek`、`web-fetch-http`；搜索辅助 Provider 费用未进入主 Run 用量汇总 |
| Skill | 正式目录、按需加载、卸载撤销回归通过 | `packages/skill/tool-skill`、Minecraft 随包 Skill；不是权限来源 |
| MCP | HTTP/stdio、资源、图像、账户/App 隔离、取消和回收回归通过 | `packages/mcp/mcp-client/src/runtime.ts`；用户真实外部 MCP 服务未实测，受设置/监听环境约束 |
| Subagent | 委派、独立 Run、权限/工具继承及取消的完整装配回归通过 | `packages/subagent` 和 Agent Run；真实付费子模型/外部 CLI 未测试，不能宣称并行调度已交付 |
| Minecraft | 实际下载/复用 Java、部署、就绪、监听、正常停服通过；指定 Java 原方案未通过 | 原核心/部署服务与 Daemon；新参数接线回归通过、真实冲突预检通过；有效指定 Java 的第二次完整部署未跑 |
| 本机电脑/应用 | 记事本实际发现、启动与进程/窗口核对通过 | `packages/computer-use/computer-use`；需本机 Windows、账户开关及统一权限。启动后自行恢复的旧标签未读写 |
| SteamCMD/完整游戏部署 | 本轮未验证 | 不把已有环境安装能力泛化为全部游戏运行能力 |
| 金额/Token/任务总时限等预算 | 主循环模型/工具预算及请求/命令时限已有回归；独立金额、总 Token 与完整任务时限治理仍缺失/未验证 | 不能把有限循环等同于全费用治理 |
| 统一能力诊断、视觉/结构化输出全厂商矩阵 | 当前有能力状态工具和 MCP 状态；完整六状态/供应商诊断覆盖未完成 | 不能把目录存在、Schema 存在或 HTTP 200 当能力成功 |

装配实读 `packages/bundle/base/cordis.patch.yml`、app-boot 与各能力入口；Shell/Web/Skill/Subagent 均有注册与实际执行路径，未据空目录判断未接线。工具在请求和派发边界按最新设置、插件合同和继承范围对账，权限仍唯一。

## 已修复的问题

1. **事务前准备失败被误当未知副作用。** 原工作树已将核心工件准备异常标为 Owner 确认的 `not_started`；本轮重新验证。只有来源连接失败允许恢复，在新的成功检查结果后才能同参数再试。已派发未知操作、成功写入、无新证据重复仍拦截。Minecraft 真实来源故障 → 构建/HTTP 核查 → 重试 → 就绪轨迹证实接线有效。
2. **失败/停止缺少主模型汇总用量。** 终态也保存一次实际 usage，未知分量保留 null。真实停止轮次保存 17,102/195 tokens，未伪装成零费用。后台记忆与 Web 搜索等辅助调用的全面费用归因仍有缺口。
3. **任务头覆盖外层 unknown。** Shell 返回任务头和外层 result 时，原判定得到 complete；新增回归先失败，修复为同时检查两处未知结果。cancelled/interrupted 也不当成功。
4. **指定 Java 的协议断点。** `provisionMinecraftServer` 原本接受并校验 `javaRuntimeId`，AI Schema/解析却没有该字段。现模型可以传入真实运行时 ID；不匹配在创建任务前返回未开始。新增只读 `minecraft_resolve_core_artifact` 复用同一 `resolveMinecraftCoreArtifact`，不复制 Java 规则。PHP 的历史 Java 列不当 Java 要求。
5. **失败/取消轨迹缺少协议配对。** 参数解析或范围拒绝也记录 `tool/call(dispatched=false)`；拒绝审批不触发执行。执行器抛 AbortError 时先保存真实未知/未开始结果与调用配对，再停止，不派发下一项。两类独立回归先复现，再通过。历史事件不补造、不改写。

初始浏览器的项目列表、设置附属读取和提交返回 500，模型没有开始。只读核查原 4 实例全部停止、无活动开服任务/Java 进程后，重启控制端加载正式构建，入口恢复。**旧进程 500 的根因没有确定，重启恢复不是根因修复证明。** 后续更新加载也在无活动游戏/Agent 任务时完成。

## 浏览器实测与轨迹

| 场景 | 实际结果 | 主循环请求/工具记录 | 主循环输入/输出 tokens |
|---|---|---:|---:|
| 隔离构建修复 | 语法错误退出 1 → 模型补右括号 → 构建/运行退出 0、输出 10；随后独立 pnpm 核对相同结果 | 7 / 10 | 136226 / 2488 |
| 联网搜索 | 真实搜索、读取 Node.js 官方来源；披露未核实的最新 Stability/补丁版本细节 | 6 / 7 | 193880 / 4660 |
| Windows 记事本 | 发现、启动、再次观察与真实进程核对；无文件参数，不修改旧标签 | 6 / 6 | 113877 / 2390 |
| Minecraft 预检 | 节点/版本/端口查询；但把已安装 Java 11 当作需求，预检承诺错误 | 5 / 10 | 135049 / 4262 |
| Minecraft 部署/停服 | 来源准备失败确认无任务 → 新检查 → 再试；Paper 794 就绪、25585 监听，随后非强制停服退出 0 | 10 / 12 | 237255 / 4523 |
| 40 秒停止试验 | 点击前已完成，确实读取了时间；模型明确没有发生停止。这不是有效的取消验收样本 | 3 / 2 | 52323 / 726 |
| 120 秒停止试验 | 约 57 秒点击停止；aborted=true、空输出、退出码未知；Run interrupted，无后续调用 | 1 / 1 | 17102 / 195 |
| 续修前诊断 | 构建退出 0，但运行因 valuez 未定义退出 1；保持文件不变，不把构建通过当任务通过 | 7 / 8 | 135487 / 2320 |
| “刚才失败，继续修复” | 同 Session 核对旧哈希/现状 → 唯一变量名修改 → pnpm 构建/运行退出 0、输出 10；独立复验一致 | 6 / 5 | 116860 / 1895 |
| 修复后 Java 冲突预检 | 实际调用新工件 Tool，得到 javaMajor=16；明确拒绝 Java 11，不部署、不改偏好 | 3 / 5 | 58837 / 2296 |

可复现成功轨迹：Session `ab0e4fc7-d1ce-4c86-8472-7d06766b5680` / Run `250ecbe8-0272-4673-98c6-2e4dd6a8c778`，真实模型读取项目说明/配置，复现语法失败，修改并验证输出。该请求发到已有会话，包含无关旧历史，不能拿它当新会话成本基准。续修 Session `2f43cb0a-8005-422c-841a-90db3426453c`，修复 Run `db33d7c4-48d6-4119-b028-bb864f2d62b3`。

复现夹具可在新的根 `dist/.tmp/` 子目录重建：package.json 的 scripts 为 `{"build":"node --check index.js","test":"node index.js"}`，type 为 module；index.js 的失败基线为 `const values = [2, 3, 5]; console.log(values.reduce((sum, value) => sum + value, 0);`。README 约定构建/运行均退出 0 且输出 10，任务只允许改该目录。向 Agent 提出构建修复目标后，验证它补齐右括号并真实执行两项脚本。恢复夹具改成合法语法但 `valuez.reduce(...)` 未定义，先只读诊断，再在同会话要求继续修复；这能区分构建成功和运行成功。真实 API 使用本机已保存配置，按当前权限/预算执行，不把复现指令当额外部署授权。

新 Minecraft 实例 ID `29c52fd9-ed3e-4d41-ad7d-e2cf9fcef6e6`；安装任务 `aaa8ca43-b0f0-4afe-9014-450c432fa25d` 的 result 为 processStarted/serverReady/locallyListening=true，javaMajor=16，coreBuild=794；停止任务 `4ff197cc-5a76-42c7-8d26-dd0a14639f95` 为 stopped=true、forced=false、exitCode=0。独立数据库/进程/端口核对：实例 stopped，25585 无监听，无 Java 进程；原 4 实例仍全部 stopped。保留真实新实例/存档，未删除原有用户数据。局域网、公网、客户端登录和单独世界保存确认未测。

Java 16 是当前领域 Owner 对此构建的要求；[Paper 官方要求](https://docs.papermc.io/paper/getting-started/#requirements)也将 1.16.5 的推荐运行版本列为 Java 16。这里验证的是本项目实际采用的合同，不声称在所有 JVM 上绝对不能运行。

公开事件快照及截图在 `H:/LFAA1/dist/.tmp/agent-acceptance-20261014/`：`acceptance-evidence.json`、`search-browser.png`、`application-browser.png`、`minecraft-preflight-browser.png`、`minecraft-browser.png`、`stop-browser.png`、`recovery-browser.png`、`java-conflict-browser.png`。快照仅导出本轮调用名、状态、次数、用量与 Run/Session ID，没有 request/context、providerReplay、工具参数、截图字节或凭据。源 JSONL 仍为原 Session Owner 的权威记录；导出不是第二套产品存储。

## 四项长期指标的判定口径

| 指标 | 长期口径 | 本轮可报告样本 |
|---|---|---|
| 任务成功率 | 独立验证所有目标/约束通过的任务 ÷ 可评测任务；停止按“不再派发”的目标判断，环境阻塞单列 | 原六类严格判定 5/6（83.3%）；Minecraft 指定 Java 承诺不满足。修复后冲突预检通过，未用预检代替第二次指定环境开服 |
| 失败恢复成功率 | 已产生真实失败、在原范围完成目标并重验的任务 ÷ 可恢复失败任务；不把无限重放计恢复 | 明确“继续修复”的代码样本 1/1；Minecraft 来源恢复有真实证据，但原 Java 约束仍未满足，单独列出 |
| 每个成功任务平均 API 成本 | 同一任务全部模型、重试、子任务、压缩、搜索/记忆费用 ÷ 独立成功任务；包含成功前失败开销，区分账单/估算，缺 Usage/价格则未知 | 金额未知，不能计算可靠平均值。10 轮共 54 次主循环请求；已知 ledger 合计 1,200,588 输入/26,330 输出 tokens，包含两条已记录后台记忆用量，不包含全部失败辅助请求或搜索辅助模型 Usage。不得冒充完整账单 |
| 未验证就宣称成功的比例 | 含“目标完成”表述、但证据不足或约束未满足的交付 ÷ 含完成表述的业务交付；核对内容而非只读 Run complete | 按严格完整目标口径，五条业务完成交付中 Minecraft 一条首句称验收完成但 Java 约束未满足：1/5（20%）。正文已披露偏差，不是伪造启动证据；仍应避免宽泛完成表述 |

这是人工标注的受控小样本，不是全系统长期统计；故障预检、取消未发生的那轮、额外只读纠偏不混入六类目标成功率。`Run complete` 表示模型循环正常结束，不能直接当任务成功。当前尚无全面金额预算/辅助调用账本和自动目标验收，不能宣称成本浪费已经消除。后续应在原 Session/用量 Owner 补齐辅助请求归因，用相同任务/模型/权限/环境比较前后，不按包数或提示词长度衡量智能程度。

## 设置、性能、安全与验证

无新增设置、无重置偏好、无新增 UI/CSS。所有行为继续读取 Settings Owner 与共享合同；默认值只是新账户基线，真实运行按用户保存值。相关持久化为账户设置文件、Provider 加密配置及项目/节点存储配置；Client 使用既有 Connection/设置映射，本轮没有新映射。

| 配置 | 默认值与使用 |
|---|---|
| Provider/激活账户/modelId/reasoning_mode | 当前账户选择，默认思考参数遵循 Provider；未改账户/密钥或静默降级 |
| permissions.mode | 默认 ask；本轮用户已有 full_access；所有 Tools/MCP/子任务复用 Permission Owner |
| aiRuntime.maxModelRequests/maxToolCalls | 0 表示产品上限 64/128，正数收紧；错误恢复仍计预算 |
| requestTimeoutSeconds/requestRetries/retryDelaySeconds | 90/1/1；只恢复尚无输出/工具选择的请求 |
| maxOutputTokens/speed/commandTimeoutSeconds | 0/balanced/0；输出遵循目录与偏好，命令取消保留真实终态 |
| autoCompaction/contextWindowTokens | true/32768；使用原上下文管理，不能以压缩删持久历史 |
| subagentAccountId/maxSubagents/maxDelegationDepth | 空串/4/2；本轮真实任务未委派，隔离回归验证继承与限制 |
| general.taskFolder/integratedShell | 空串/system；测试显式给定隔离目录，本机工具实际使用 PowerShell；不改默认任务目录 |
| plugins.enabled/mcpServers/skillDirectories/applicationIds | 默认 false/空列表/空列表，按保存开关和 App 范围提供能力；实际 Minecraft 新工具是已有业务 Owner 的第一方能力 |
| computerControl.enabled | 默认 false；真实任务沿用户已有设置及本机适配器执行，没有扩大授权 |
| personalization.memoryEnabled/memoryFromToolChats | 默认 false/false；已有用户启用后出现后台记忆请求，已知用量与未记录失败另列 |
| minecraftRuntime | 默认 Paper/native、4096 MB、25565/19132；就绪/停止/下载/安装超时 120/30/1800/900 秒；本次用户授权参数显式 1024 MB/25585，既有默认未改 |
| 项目/节点 runtimeDirectory、downloadCacheDirectory、temporaryDirectory、instanceDirectory、logsDirectory | 使用已保存存储位置；默认 data/environments、cache、tmp、games/minecraft、logs，不搬迁环境或存档 |
| appearance 全部映射 | 主题、颜色、字体/字号、对比度、壁纸/遮罩/模糊、减少动态效果继续原 UI；本轮不改界面，未宣称移动设备/帧时间验收 |

性能证据：新增工件查询仅模型按需调用，普通自动部署不增加强制请求；筛选目标核心减少无关目录结果，但非 Paper 仍可能查询其他来源，不宣称消除所有源请求。恢复/签名记录受 64/128 预算约束；不新增轮询、事件订阅或主线程处理。真实轮次的请求/工具/Token 已列，成本仍明显偏高；没有测浏览器帧时间、长会话内存曲线或所有设备流畅度。安全保留服务端认证、实时授权、节点归属、参数/工件摘要、运行实例互斥与取消边界。新 runtime ID 仍由部署 Owner 校验，未加第二套审批。

实际运行的回归批次（重复不累加为新覆盖）：

- `pnpm exec node --import tsx --import ./register-package-loader.mjs --test tests/agent-runtime.test.mjs tests/minecraft-multicore.test.mjs tests/mcp-tools.test.mjs tests/computer-use.test.mjs`：初始 20/20。
- 同启动器的 `harness-runtime-wiring / local-shell-runtime / settings-contract / minecraft-setup-skill`：9/9。
- `agent-runtime / llm-completion / ai-run-stop-guard / harness-agent-api`：15/15。
- 新 Java 回归的 `minecraft-multicore / minecraft-setup-skill`：11/11；外层 unknown、缺工具参数/证据及协议配对均先复现失败，再修复。
- 最后协议修复的 `agent-runtime / mcp-tools`：10/10；完整 `harness-runtime-wiring` 1/1、`harness-agent-api` 1/1。依赖编译入口的 API 测试与重建并行曾失败，原因是编译目录在重建时暂缺；构建完成后串行重跑通过，没有删除断言。本轮覆盖 39 项不同测试，重复不扩充覆盖数；不把合成 Provider/MCP 写成厂商真实集成。

Client/Host `pnpm run typecheck` 通过；正式 `pnpm run build` 完成 Harness、Web、Control Plane 与 CLI 打包准备，均根 dist，未 npm 发布；Web 有既有约 501 kB chunk 提示。修改后分别重建 Agent/Tools/Minecraft 包与 Control Plane。`check:workspace` 初始通过；增加架构链接、报告尚未写入时曾因缺链接失败，报告落盘后重验。`workspace-preflight` 当前不存在，没有冒充执行；没有桌面包、多平台、远端 CI 或实际外部 MCP 验收。

最终 Client/Host 类型、Agent 包/Control Plane/Web 构建再次通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，源码/正式构建指纹一致。最终 workspace Gate 与差异检查通过。最后协议配对补丁的行为证据是回归；六类付费浏览器轨迹在此前构建采集，不冒充该末次补丁的重新付费验收。

最终控制端已重新加载该构建，3000 端口就绪、Daemon 已连接；内置浏览器刷新后恢复原 Java 冲突预检记录。此次刷新只验证页面与持久记录恢复，没有重新发起付费 Agent 请求。仍保留当前服务的 `control-loaded.stdout.log`/`control-loaded.stderr.log`，不删除被运行进程占用的日志。

## 逐文件变更与职责

| 绝对路径 | 职责与本轮结果 |
|---|---|
| H:/LFAA1/packages/core/agent-loop/src/execute-turn.ts | 保留/验证准备失败恢复、失败用量；补拒绝/取消调用结果配对，权限/防重/预算不变 |
| H:/LFAA1/packages/core/agent-loop/src/tool-outcome.ts | 保留取消状态判定，补外层 unknown 优先级 |
| H:/LFAA1/packages/core/tools/src/business-tools.ts | 保留准备结果与核心筛选；补真实工件查询和 javaRuntimeId Schema/解析，复用领域服务 |
| H:/LFAA1/packages/games/minecraft/src/deployment-service.ts | 保留事务前准备/停止保护；指定运行时不匹配明确未开始 |
| H:/LFAA1/packages/games/minecraft/assets/minecraft-server-setup/SKILL.md | 说明预检真实要求、安装状态与指定运行时的区别，不改变权限 |
| H:/LFAA1/apps/cli/tests/agent-runtime.test.mjs | 保留恢复/失败用量回归；补外层 unknown、参数拒绝与取消协议配对和停止派发断言 |
| H:/LFAA1/apps/cli/tests/minecraft-multicore.test.mjs | 保留准备失败/停止/目录筛选；补实际 ID 传递、只读工件与 mismatch 零任务回归 |
| H:/LFAA1/apps/cli/tests/computer-use.test.mjs | 保留既有迁移版本断言 51→56，重新验证实际现行迁移 |
| H:/LFAA1/apps/cli/tests/mcp-tools.test.mjs | 保留隔离测试正式初始化顺序，重新验证 MCP；不跳过数据校验 |
| H:/LFAA1/packages/core/agent-loop/README.md | 更新恢复、unknown/取消和用量合同 |
| H:/LFAA1/packages/games/minecraft/README.md | 更新真实要求查询、运行时参数及事务前边界 |
| H:/LFAA1/docs/PROMPTS.md | 当前任务范围、已有改动、真实证据和实施/验收记录 |
| H:/LFAA1/docs/系统总体架构.md | 当前调用链修复事实与本报告入口 |
| H:/LFAA1/docs/development/agent-execution-validation-20261014.md | 本报告、矩阵、六场景、指标口径及逐文件清单 |

临时故障项目位于根 `dist/.tmp/agent-acceptance-20261014` 及 `recovery` 子目录，结束删除其 JS/package/README，仅保留必要截图/公开证据和当前服务占用的日志；没有测试支持进入产品装配。长期回归与夹具保留。真实 Session、Minecraft 新测试实例/存档和原有数据保留，不清理其他历史临时文件。
