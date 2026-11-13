# LFAA Agent 与 DSH 能力对照及 Worktree 工具接入

<a id="lfaa-agent-dsh-capability-parity-20261113"></a>

日期：2026-11-13  
LFAA 工作副本：`E:\lfaa1\lfaa`，开始时 HEAD `d3b127c`  
DSH 只读参考：`E:\lfaa1\deepseek-harness`，开始时 HEAD `1517a4dbca`

## 目标

沿当前运行入口对照 `packages/core/tools`、`packages/skill`、`packages/mcp`、`packages/llm` 与 `packages/plan`。区分 LFAA 已实现的等价能力、仅有占位的能力和可安全适配的缺口；把可安全复用的 LFAA Workspace Git Worktree 接入通用 AI Work 的 Agent Run，并继续由 Workspace、Session、Settings 与 Permission Owner 维护数据、会话绑定、配置和授权。兼查 LLM 流式工具回合，避免把 UI 滚动问题误诊成 Provider 派发问题。

DSH 仅作只读参考。本任务不复制整个 DSH 包树，不把 README 或目录存在等同于 LFAA 已运行，也不把上游运行时/执行器缺失包装成模型工具。

## 当前已确认的对照

- `core/tools` 是注册与执行框架，不是 DSH 全部产品工具清单。LFAA `lfaa-tools` 已有按需目录、准确 schema 加载、风险和执行 Owner 交接；领域工具继续由各自 Owner 登记。DSH 的 native 与 PTC 两种呈现中，LFAA 已有 native 工具循环；`run_code`/PTC 运行器仍缺。
- DSH Skill 注册表、文件系统发现、Office Skills 与 `tool-workspace-dependencies` 在 LFAA 分别有 `skill`、`skill-filesystem`、`skill-office` 和对应上游占位目录。LFAA Skill 工具支持目录发现、正文与资源按需读取；`packages/skill/tool-workspace-dependencies` 只有 `PLACEHOLDER.md`，没有运行时实现或消费者，不能宣称已装配。
- DSH MCP 支持 stdio/Streamable HTTP 和共享资源工具；LFAA `mcp-client` 实际实现本机 stdio 与受出站校验的 Streamable HTTP，资源/模板发现、读取、取消、连接回收及按需大目录。LFAA 不复制对端业务或绕过 Settings/Permission Owner。
- LFAA `llm` 经统一账户 Provider 与 `pi-ai`/领域 adapter 执行流式请求；文本/隐藏推理分开，增量 `tool_calls` 在响应完成并校验前只聚合、不派发，超时/EOF 后禁止重放半截工具，完整工具结果按 `tool_call_id` 进入下一模型回合。设置、账户与运行路径不同于 DSH DeepSeek 专用账户实现，不应复制其账户架构。
- DSH `plan-mode` 的进入/批准工具在 LFAA Agent Loop 中有对应合同，Session 事件负责恢复，计划状态下的写动作仍受 Agent Loop 与 Permission Owner 约束；无需创建第二份计划状态包。
- LFAA Git Worktree 原有 API/UI 通过唯一 Workspace Owner 执行，但缺少 Agent Run 的创建与切换工具；本次补为通用 AI Work 本机项目与 Minecraft 本机 Daemon 项目可调用。
- 明确未接入：DSH PTC `run_code` 需要真实代码执行器、资源限额和 OS 隔离；LFAA `ptc-runtime`、通用本机沙箱提供方仍是占位。DSH Workspace Dependencies 报告的是随应用封装的解释器；LFAA 对应目录仍是占位且未找到通用运行时 Owner。两者不能用 Shell/外部路径猜测伪造；需先建立真实 Owner/装配，再作为独立能力接入。

## 实施边界

- 新工具按需登记给 `workspace` 和 `minecraft`：AI Work 只操作当前会话绑定的本机 Workspace 项目；Minecraft 只操作当前会话绑定的当前本机 Daemon 项目。模型不能指定账户、项目 ID、路径或分支前缀；远程节点与嵌套 Worktree 拒绝。
- Git 操作与项目登记沿 Workspace/Host Git Owner；成功后由 Session Owner 条件更新当前会话项目，并更新当前 Run 的可信项目上下文。失败时返回实际状态；不把项目创建成功冒充会话切换成功。SQLite 迁移 81 让本机 Worktree 保存 `node_id = NULL`，迁移 82 保存 Session 的领域 App 上下文投影；原 Daemon Worktree 和 Session 记录完整保留。
- 工具按需发现；写入风险和审批摘要交给现有 Agent Loop 与 Permission Owner。沿用 `git.branchPrefix`；不新增、重置设置或另设白名单/审批。
- MCP、Skill、LLM 与计划模式只记录对照结论；已有实现不做无关迁移或重构。

## 验收条件

- Owner 单一实现可供现有 API/UI 和 Agent 工具共用，保持当前项目/账户/App/本机 Daemon 校验、源项目不变及登记失败后的清理语义。
- 合成回归覆盖 Workspace Host 与 Minecraft 本机 Daemon 创建、Session 切换、跨项目授权范围隔离、远程/嵌套拒绝和取消；SQLite 80→82、81→82 回归核实原记录保留、节点可空、领域上下文可空、外键有效与重复启动幂等。
- 流式回归核实正常结束、无换行 `[DONE]`、异常 EOF 和工具调用截断不得派发；不因滚动/页面更新额外发出 Provider 请求。
- 直接相关包构建、类型检查、回归与 `git diff --check` 通过后记录实际命令和结果。未连接真实 Provider、未安装依赖、未改模型账户、设置或权限偏好；PTC 与 workspace-dependencies 仍未装配。

## 实施与验证记录

### 本轮实现

- `packages/core/tools/src/project-tools.ts` 将 `workspace_create_worktree` 暴露给通用 Workspace Agent Run 和 Minecraft；只使用当前会话绑定的项目，不接受模型传入项目、路径或分支前缀。Workspace 走本机 Host；Minecraft 走当前本机 Daemon；远程项目、嵌套 Worktree、错误 App/账户和会话变化会拒绝，成功后由 Session Owner 更新当前会话项目。
- `packages/workspace/workspace/src/index.ts` 与 `git-worktree-operations.ts` 维护唯一 Worktree/项目 Owner 和 Host/Daemon 执行边界；`packages/host/git/src/git-workspace.mjs` 为本机 Host 提供同一 Git Workspace 执行合同。`packages/api/workspace-controller/src/index.ts` 的既有 API 复用该 Owner。
- `packages/storage/storage-sqlite/src/database.ts` 支持版本 82，v81 为 Worktree 的 `node_id` 加入合法 NULL 本机归属并重建远程/本机唯一索引；v82 为 Session 增加可空领域上下文投影。`packages/storage/storage-domain/src/migration.ts` 在两条启动/恢复迁移路径都显式执行 v80/v81/v82 后续迁移。修复前程序已能写到 v82，却仍把 81 当作最高兼容版本，第二次启动因此拒绝打开数据库；现已对齐版本上限。
- 更新上述包 README、`apps/cli/tests/workspace-worktree-tool.test.mjs` 和 `apps/cli/tests/database-migrations.test.mjs`。没有修改 LLM 请求行为；只审计其流式结束、工具参数聚合与工具结果回写边界。

### 验证结果

- `tests/database-migrations.test.mjs` 全文件 9/9 通过，包含 v61、v72 历史库升级到 v82 后重复启动；`tests/workspace-worktree-tool.test.mjs` 与 Worktree v80 迁移定向回归通过。
- AI Work 主/内层滚动回归：8/8 通过，覆盖绘制前最终消息提交贴底、恢复位置、用户上翻保护、滚轮归属、六条活动门槛和长会话帧合并。
- `pnpm --filter lfaa-storage-sqlite run build`、`pnpm --filter lfaa-storage-domain run build`、`pnpm --filter lfaa-workspace-workspace run build`、`pnpm --filter lfaa-tools run build`、`pnpm --filter lfaa-api-workspace-controller run build` 和 `pnpm exec tsc --noEmit -p tsconfig.host.json`：通过。
- `pnpm run build:web`：成功，3954 个模块；`node scripts/runtime-build-state.mjs web`：返回 `["host","web"]`，Web 和 Host 构建指纹有效；`git diff --check`：通过。
- 真实 ChatGPT 内置浏览器 `/work` 验收已由滚动合同记录：桌面 1472×873 与窄短 900×640 主消息区离底均小于 1px，页面/消息区水平溢出为 0，滚动条在轨道底端；未发送消息或触发 Provider/工具。

### 未完成与边界

- DSH PTC `run_code` 需要隔离执行器、资源上限和可审计结果；LFAA 对应 `ptc-runtime` 与通用本机沙箱 Provider 仍是占位。DSH Workspace Dependencies 所需的随应用解释器能力在 LFAA 也没有实现 Owner。当前不通过普通 Shell 或外部路径猜测来冒充这两项能力；需先建设并装配真实执行运行时，才能接入模型工具目录。
- 已修复 v61/v72 测试夹具：补齐其版本号所代表、且 v74/v76/v77/v78/v81/v82 后续迁移所需的历史结构，并将重启断言推进到当前版本82；没有放宽或跳过数据迁移校验。
- 已修复 `check:workspace` 的文档问题：旧 hover 合同不再链接到缺失的临时图片，三个 PROMPTS 合同补上对应锚点；随后运行 `pnpm run sync:workspace` 更新生成的包目录清单。`pnpm run check:workspace` 通过：226 个包，依赖/路径映射/文档一致。
- 未连接真实 Provider、未触发真实 Daemon 或 Host 上的用户项目操作；没有测量帧时间/长任务，也未在物理触屏设备验收。构建与合成回归不能代替这些运行时验证。
