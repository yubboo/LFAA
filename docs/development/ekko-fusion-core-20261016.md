# Ekko 能力融合：编程协作核心第一项

日期：2026-10-16。当前仓库 H:/LFAA1；保留既有脏工作树，不提交、不发布。用户选择计划商用，优先由 LFAA 自主实现。参考来源、许可边界及后续 34 类能力清单见 [融合登记](ekko-capability-fusion.md) 和根 THIRD_PARTY_NOTICES.md；Ekko 仓库只读，没有复制源码、资产或提示词。

## 实际交付

原 lfaa_delegate_subagent 增加 foreground/background，默认前台；后台先支持原 in-process 驱动。后台立即返回真实任务及父会话标识，父回复正常结束不停止子任务。原 Session JSONL 记录状态和有界答案，lfaa_get_subagent_result 按账户/来源查询或等待；取消等待不取消执行。运行器丢失的未完成记录报告中断，不自动重放；已完成结果可读。数量、深度、项目、模型、权限和工具范围仍由原 Agent Loop 校验。

Shell 确认非零退出后，模型可在新的成功写入修复后通过原 retryAfterRecovery 再选同一命令；没有修复、超时/取消/未知结果及成功副作用仍保留防重。模型决定行动，产品没有写死测试/修复业务流程。第一方委派/控制工具的 coreManaged 标记保证第三方插件总开关不会隐藏系统基本执行能力，没有改变用户设置或操作权限。

## 设置、数据与性能

复用 Provider 激活账户；aiRuntime.subagentAccountId 为空时继承主模型，maxSubagents 默认 4/上限 16，maxDelegationDepth 默认 2，maxModelRequests/maxToolCalls/requestRetries/requestTimeoutSeconds/commandTimeoutSeconds 等预算仍来自 Settings。复用 permissions.mode 三模式、plugins.enabled/skillDirectories、general.followupBehavior/taskFolder/integratedShell；本轮没有新增配置或重置偏好。真实验收使用账户已有 deepseek-flash、完全权限和既有外观，未切换模型或权限。

任务状态与结果归 Session，句柄归 Subagent Manager，执行与取消归原 Loop/驱动/Shell/Daemon，项目与工作树归 Workspace/Git；没有第二套账户、会话、权限或运行内核。派生任务索引使用 WeakMap 增量读取，至多 64 项；句柄沿原 64 项上限，答案最多 64000 字符、诊断 4096 字符。结果等待使用已有 Promise 并撤销 AbortSignal 监听，没有新轮询、订阅或 Client 请求。日志历史仍沿原 JSONL 保留策略；长时间/超大任务性能、帧时间和压力曲线未测。

## 验证

- 新 subagent-background.test.mjs 最终 3/3 通过（包括嵌套真实 Shell 回归）：父任务结束后后台继续、前台等待、取消读者不取消子任务、账户/来源隔离、数量预算、结果持久化、运行器卸载及中断、取消不误记成功；真实 Shell 确认失败修复后可重验，超时后不能原样重放。
- agent-runtime.test.mjs + session-kernel-persistence.test.mjs + harness-runtime-wiring.test.mjs：同一批运行的其他 17 项通过；批次新增 Shell 子场景因未启用本机 Profile 最初失败，修正测试隔离环境为 loopback 本机模式后，新文件单独最终 3/3 通过。没有放宽产品认证/授权，也未删除断言。
- Harness 全链夹具原来手造未登记项目，被原项目 Owner 正确拒绝；改为通过真实节点/项目 Owner 注册，完整工具/Skill/委派/压缩/文件/调度/Workflow 验证通过。
- pnpm run typecheck：Client/Host 均通过。
- lfaa-session、lfaa-subagent、lfaa-tool-subagent、lfaa-tool-subagent-control、lfaa-agent-loop、lfaa-base、lfaa-tool-shell 直接包构建通过；pnpm run build:control-plane、pnpm run build:web 通过。Web 为 2261 模块，仍有既有 cpp chunk 大于 500 KB 提示。产物全部在根 dist/。
- pnpm run check:workspace：192 包通过；git diff --check 通过；node scripts/runtime-build-state.mjs web 返回 []。仓库没有 workspace-preflight 命令，未伪造执行。

## 真实账户、模型、节点与工作树

通过 ChatGPT 内置浏览器访问 http://127.0.0.1:3000/work，使用用户指定 yubboo 账户与已保存 DeepSeek / deepseek-flash。凭据只用于正常登录，没有写入源码、报告或夹具。

测试基线为 H:/LFAA1/dist/.tmp/agent-core-acceptance-20261016，seed commit 5d89352e537464f21a35e099067d24466a703765。只在此一次性验收仓库建立种子提交，没有提交 LFAA。通过正常项目 API 注册并在实际项目选择器创建 AI Worktree，路径 H:/LFAA1/data/git-worktrees/7892e570-8684-4aa0-888d-9bc9370b9f53，分支 codex/20261016-7892e570。

真实模型读取 README/测试/实现，复现 6 用例中 2 通过/4 失败，调用 lfaa_delegate_subagent 的 in-process/background 只读审阅，主 Agent 继续修复 src/score.mjs（乘 count，缺省使用 ?? 1 保留 0），运行验证、查看 diff，并用结果工具回收终态审阅。主任务约 90 秒。首轮同参数 npm test 被原防重拒绝后，模型根据真实反馈执行等价 node --test 得到 6/6；此问题随后按上文修复并经真实 Shell 回归。

维护者独立 npm test 为 6/6，git diff --check 通过，仅 src/score.mjs 变动（+4/-1），测试和脚本未改；原基线工作区干净、HEAD 未变化。子 Agent 的只读审阅和主修改发生时间交叠，它如实说明读取到了修改前后的实现；没有把它宣传成自动隔离/合并代码。

内置浏览器桌面 1446×682 实页可见最终回答、后台任务已 complete、Daemon Git 摘要 1 文件 +4/-1。截图：[真实验收](../../dist/reports/ekko-fusion-core-20261016/coding-acceptance.jpg)。本轮没有 Client UI 源码改动，未追加窄屏、手机、桌面安装包或主题切换验收。原输入草稿已恢复；验收会话/子会话与新项目/工作树保留供用户复核。仅重载本轮启动且已无任务的控制端/托管节点，加载最终构建，未操作游戏实例。

重载最终服务后，真实模型再次调用结果工具，成功读取任务 7120c5a6-65bb-4bce-9580-ceb98d2b41d8 的原完成状态、时间和答案，没有重派子任务、执行命令或改文件。此项约 6 秒，原会话、项目绑定、Git 摘要和草稿均恢复；[重载后结果读取截图](../../dist/reports/ekko-fusion-core-20261016/coding-acceptance-reloaded.jpg)。服务保持运行，供用户复核。

## 本轮变更文件

下列为本轮实际变更/重新生成的文件；同路径的既有改动保留，不表示整份 Git diff 都由本轮新增。

| 绝对路径 | 本轮职责 |
|---|---|
| H:/LFAA1/THIRD_PARTY_NOTICES.md | Ekko 参考声明与商业自主实现边界 |
| H:/LFAA1/docs/PROMPTS.md | 核心任务合同及实施/验收记录 |
| H:/LFAA1/docs/development/ekko-capability-fusion.md | 分阶段能力登记及来源/现状 |
| H:/LFAA1/docs/development/ekko-fusion-core-20261016.md | 本交付记录、完整文件与证据 |
| H:/LFAA1/docs/系统总体架构.md | 当前后台委派事实、Owner 与未实现边界 |
| H:/LFAA1/docs/开发计划.md | 融合顺序与第一项边界 |
| H:/LFAA1/docs/harness-packages.json | 重新生成包依赖/装配事实 |
| H:/LFAA1/docs/harness-packages.md | 重新生成包职责目录 |
| H:/LFAA1/packages/core/session/src/kernel.ts | 子任务事件类型与载荷校验 |
| H:/LFAA1/packages/core/session/src/known-event-types.ts | 持久化已知事件登记 |
| H:/LFAA1/packages/core/session/src/sessions.ts | 账户/来源校验、有界增量索引与保存 |
| H:/LFAA1/packages/core/session/README.md | Session 子任务持久化职责 |
| H:/LFAA1/packages/core/agent-loop/src/tool-outcome.ts | 取消/超时不能判成功 |
| H:/LFAA1/packages/core/agent-loop/README.md | 后台协作、结果及确认失败恢复合同 |
| H:/LFAA1/packages/subagent/subagent/src/manager.ts | 账户句柄查找、预取消和终态语义 |
| H:/LFAA1/packages/subagent/subagent/README.md | 驱动/句柄唯一 Owner |
| H:/LFAA1/packages/subagent/tool-subagent/src/index.ts | 前台/后台委派、真实结果观察/持久化 |
| H:/LFAA1/packages/subagent/tool-subagent/package.json | 声明 Session 依赖 |
| H:/LFAA1/packages/subagent/tool-subagent/README.md | 委派工具合同和后台范围 |
| H:/LFAA1/packages/subagent/tool-subagent-control/src/index.ts | 来源校验、状态/结果查询/等待及中断 |
| H:/LFAA1/packages/subagent/tool-subagent-control/package.json | 声明 Session 依赖 |
| H:/LFAA1/packages/subagent/tool-subagent-control/README.md | 控制/结果工具职责和边界 |
| H:/LFAA1/packages/shell/tool-shell/src/index.ts | 确认失败修复后的模型重验资格 |
| H:/LFAA1/packages/shell/tool-shell/README.md | 恢复条件、未知结果不重放说明 |
| H:/LFAA1/packages/bundle/base/cordis.patch.yml | 两个子 Agent 工具显式注入原 Session |
| H:/LFAA1/packages/bundle/base/README.md | Bundle 装配职责 |
| H:/LFAA1/apps/cli/tests/subagent-background.test.mjs | 长期隔离协作/持久化/取消/真实 Shell 回归 |
| H:/LFAA1/apps/cli/tests/fixtures/harness-runtime-wiring.mjs | 经真实 Owner 注册验收项目 |
| H:/LFAA1/pnpm-lock.yaml | 同步工作区 Session 依赖，下载依赖 0 |
| H:/LFAA1/tsconfig.client.json | workspace 同步重新生成类型路径 |
| H:/LFAA1/tsconfig.host.json | workspace 同步重新生成类型路径 |

## 明确尚未完成

独立 Coding 主运行时调度入口、完整专属 Agent 工作台、外部 CLI 后台、自动工作树分配/冲突合并/最终整合、多运行时群聊/工作流、Office/PDF 成果 Skills、自定义成果和应用面板模板均继续按登记实施。本轮没有真实外部 Codex/Claude CLI、远程节点、多平台、真实暂停中后台任务和多 Agent 并行修改冲突验收；不能称全部 Ekko 能力已经融合。
