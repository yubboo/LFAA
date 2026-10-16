# 全包职责与按需能力修复记录

合同：`LFAA-PACKAGE-OWNER-LAZY-CAPABILITIES-20261014`。本报告记录本轮实现与验收，逐包职责以 [生成清单](../harness-packages.md) 为入口；占位职责是目标，不表示已实现。现有工作树改动保留，未操作真实用户实例、重启或发布。

## 当前实现

- 原包树 359 个目录，迁移后 368 个目录；192 个 workspace 包与 176 个占位目录。每个目录均有专属职责注解、实际源入口、静态调用方与 Bundle 声明；Gate 对包树逐项检查缺项及多余注解。
- 内置领域 Prompt、Expert、Skill 正文与领域工具合同各归独立职责包；Boot/Bundle 只装配，原领域服务、数据/权限 Owner 和稳定工具名保持。
- 系统消息不按 App 自动注入 Minecraft/写作全文和领域专家。模型按目标选择目录、正文、工具合同或专家委派；选中的工具仅进入本 Run，设置/卸载与子任务继承范围继续校验。
- Writing 初始只查询已选目标的轻量元数据，正文经 `writing_get_context` 明确读取；跨界面也只绑定当前账户真实已选作品，不接受模型注入目标 ID。项目文件/Skill 和节点 Shell 不按 App 分类增加第二套权限，缺少真实节点时仍拒绝回退本机。
- 复用原 Minecraft bundled Provider，并从 App 服务迁入 Skill 包，不创建平行实现。Writing 专职角色 ID 仍保存在作品偏好，但角色正文按模型选择加载。

## 设置和运行边界

复用 `plugins.enabled`、`plugins.skillDirectories`、Provider/模型、`aiRuntime` 的请求/输出/上下文/工具/委派预算、`permissions.mode`、`computerControl.enabled`、`general.taskFolder`/Shell、`minecraftRuntime`、设备存储位置与节点覆盖。本轮无新增设置或 UI，不重置用户偏好。领域执行、账户/作品/项目/节点隔离与取消/未知结果防重沿用原合同。

## 验证

直接回归覆盖 12 个测试文件：package-owner-lazy-capabilities、agent-runtime、harness-runtime-wiring、general-agent-capabilities、writing-local-files/catalog/book-profiles/edit-proposals/analysis-tools、minecraft-multicore/setup-skill、capability-prompt。最终 36/36 全部通过；完整 Profile 使用合成 Provider，不能冒充现场模型/浏览器/桌面/远端验收。

| 检查 | 最终结果 |
|---|---|
| Client/Host typecheck | 通过 |
| 21 个直接相关能力/组合包串行构建 | 通过，输出仅在根 dist/packages |
| 正式 Control Plane 构建 | 通过，根 dist/apps/control-plane |
| 正式 Web 构建 | 通过，2260 modules；根 dist/apps/web |
| sync:workspace / check:workspace | 192 包通过；368/368 目录有专属职责，176 占位仍不可执行 |
| git diff --check / 文档路径 | 通过；绝对路径仅为证据标签，导航链接采用当前 checkout 相对路径 |
| workspace-preflight | 未运行，根 scripts 没有该命令，不冒充其它检查 |
| 构建指纹与迁移资源 | web Profile staleRuntimeBuilds 为 []；正式树新资源齐全、Skill 摘要一致；旧 Prompt/Skill 挂载与 Runtime 工具副本不存在 |


性能证据来自实际发送给合成 Provider 的请求：初始系统消息 5231 字节；4276 字节 Minecraft 总控正文仅在明确加载后进入工具结果。Minecraft 完整工具合同由初始 0 项变为模型选择的 1 项，未选择的部署合同始终未提供。写作界面初始只读关系元数据，正文按需读取；不是现场费用/token 账单、长文件性能曲线或帧时间。

迁移保持领域 Prompt/Skill/Expert ID 与可调用工具名；旧预设中的三个聚合 Tool 元数据标签退出，替换为原 Tools 注册表的真实逐工具目录，聚合标签本来不具有独立执行器，不作为可调用能力保留。旧核心 prompt.capability-honesty 与 skill.application-context ID 仍保留并引用唯一核心规则。

过程中修正了单元夹具未装配真实领域插件、已安装 Prompt 的动态开关条件、旧 Schema 版本断言和旧 App 隐藏断言。后者改为验证节点/本机工具明确分开且缺少真实节点拒绝执行，账户/作品/并发/取消断言保留，没有降低 Gate 或重写历史验证。

本轮未执行现场 Provider、登录浏览器、实际 Daemon/Minecraft 启停、桌面/设备及帧时间验收；没有重启运行服务。外部插件对旧内部源码路径的兼容未验，仓库内调用方已同步迁移。旧源码正文副本、旧挂载、旧空资源目录及本轮一次性迁移助手清理；正式源码/测试/备份和用户数据保留。

## 本轮文件

以下 115 个文件按本轮起始源码摘要对账，包含迁移源与目标；开始时已有其他任务的源文件未因本轮而被回退或清理。

| 状态 | 绝对路径 | 职责与本轮改动 |
|---|---|---|
| 修改 | [H:/LFAA1/apps/cli/tests/agent-runtime.test.mjs](../../apps/cli/tests/agent-runtime.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/capability-prompt.test.mjs](../../apps/cli/tests/capability-prompt.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 新增 | [H:/LFAA1/apps/cli/tests/fixtures/domain-tools.mjs](../../apps/cli/tests/fixtures/domain-tools.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/fixtures/harness-runtime-wiring.mjs](../../apps/cli/tests/fixtures/harness-runtime-wiring.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/harness-runtime-wiring.test.mjs](../../apps/cli/tests/harness-runtime-wiring.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/minecraft-multicore.test.mjs](../../apps/cli/tests/minecraft-multicore.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/minecraft-setup-skill.test.mjs](../../apps/cli/tests/minecraft-setup-skill.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 新增 | [H:/LFAA1/apps/cli/tests/package-owner-lazy-capabilities.test.mjs](../../apps/cli/tests/package-owner-lazy-capabilities.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/writing-analysis-tools.test.mjs](../../apps/cli/tests/writing-analysis-tools.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/writing-book-profiles.test.mjs](../../apps/cli/tests/writing-book-profiles.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/writing-catalog.test.mjs](../../apps/cli/tests/writing-catalog.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/apps/cli/tests/writing-edit-proposals.test.mjs](../../apps/cli/tests/writing-edit-proposals.test.mjs) | 直接回归/真实插件夹具；覆盖按需加载、范围、权限与领域服务，保留既有断言 |
| 修改 | [H:/LFAA1/docs/PROMPTS.md](../PROMPTS.md) | 本轮授权、边界、索引及实际验收记录 |
| 修改 | [H:/LFAA1/docs/development/harness-runtime-integration-files-20261009.md](harness-runtime-integration-files-20261009.md) | 历史证据保留，仅将源码导航映射到迁移后的当前 Owner |
| 新增 | [H:/LFAA1/docs/development/package-owner-lazy-capabilities-20261014.md](package-owner-lazy-capabilities-20261014.md) | 本轮完整改动、设置、验证、风险和逐文件绝对路径清单 |
| 修改 | [H:/LFAA1/docs/development/package-responsibilities.md](package-responsibilities.md) | 同步长期规范与当前架构事实，保留已有内容 |
| 修改 | [H:/LFAA1/docs/development/package-responsibilities.zh.md](package-responsibilities.zh.md) | 同步长期规范与当前架构事实，保留已有内容 |
| 修改 | [H:/LFAA1/docs/development/runtime-manual-repair-20261014.md](runtime-manual-repair-20261014.md) | 历史证据保留，仅将源码导航映射到迁移后的当前 Owner |
| 修改 | [H:/LFAA1/docs/harness-packages.json](../harness-packages.json) | 逐目录职责、源入口、静态消费者、组合声明与未验边界的生成清单 |
| 修改 | [H:/LFAA1/docs/harness-packages.md](../harness-packages.md) | 逐目录职责、源入口、静态消费者、组合声明与未验边界的生成清单 |
| 修改 | [H:/LFAA1/docs/系统总体架构.md](../系统总体架构.md) | 同步长期规范与当前架构事实，保留已有内容 |
| 新增 | [H:/LFAA1/packages/boot/app-boot/README.md](../../packages/boot/app-boot/README.md) | Cordis 启动、Profile 装配、配置和共享生命周期：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/boot/app-boot/src/ai-host.ts](../../packages/boot/app-boot/src/ai-host.ts) | 共享 Host 只转发目录和明确正文加载 |
| 新增 | [H:/LFAA1/packages/bundle/base/README.md](../../packages/bundle/base/README.md) | 共享 Control Plane 基础能力的有序组合：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/bundle/base/cordis.patch.yml](../../packages/bundle/base/cordis.patch.yml) | 有序装配独立内容/工具插件及真实领域依赖 |
| 修改 | [H:/LFAA1/packages/bundle/base/package.json](../../packages/bundle/base/package.json) | 共享 Control Plane 基础能力的有序组合：同步公开入口、依赖和运行登记 |
| 修改 | [H:/LFAA1/packages/core/agent-loop/README.md](../../packages/core/agent-loop/README.md) | 模型回合、按需能力选择、授权往返、执行结果与停止协调：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/core/agent-loop/src/execute-turn.ts](../../packages/core/agent-loop/src/execute-turn.ts) | Run 工具按需选择、跨界面写作目标、轻量上下文与明确专家选择 |
| 修改 | [H:/LFAA1/packages/core/agent-loop/src/runs.ts](../../packages/core/agent-loop/src/runs.ts) | 原子 Agent Run 将选择的专家正文交给子任务，保留共享权限/预算 |
| 修改 | [H:/LFAA1/packages/core/agent/README.md](../../packages/core/agent/README.md) | AI 扩展元数据与按需指令登记，Agent 类型/投影合同：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/core/agent/src/extension-registry.ts](../../packages/core/agent/src/extension-registry.ts) | 扩展摘要、延迟加载与卸载重验；只自动提供主 Agent 指引 |
| 修改 | [H:/LFAA1/packages/core/system-prompt/README.md](../../packages/core/system-prompt/README.md) | 核心指令/权限/上下文组合，不按 App 注入领域全文：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/core/system-prompt/package.json](../../packages/core/system-prompt/package.json) | 核心指令/权限/上下文组合，不按 App 注入领域全文：同步公开入口、依赖和运行登记 |
| 修改 | [H:/LFAA1/packages/core/system-prompt/src/index.ts](../../packages/core/system-prompt/src/index.ts) | 核心指令/权限/上下文组合，不按 App 注入领域全文：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/core/tools/README.md](../../packages/core/tools/README.md) | 公共工具合同、参数校验、可撤销注册与 Run 工具发现：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/core/tools/package.json](../../packages/core/tools/package.json) | 公共工具合同、参数校验、可撤销注册与 Run 工具发现：同步公开入口、依赖和运行登记 |
| 修改 | [H:/LFAA1/packages/core/tools/src/business-tools.ts](../../packages/core/tools/src/business-tools.ts) | 通用工具选择与权限范围；清除集中领域实现 |
| 新增 | [H:/LFAA1/packages/core/tools/src/discovery-tools.ts](../../packages/core/tools/src/discovery-tools.ts) | Run 内分页摘要目录与精确工具合同选择 |
| 修改 | [H:/LFAA1/packages/core/tools/src/index.ts](../../packages/core/tools/src/index.ts) | 公共工具合同、参数校验、可撤销注册与 Run 工具发现：生产登记/提供方及真实业务适配 |
| 修改 | [H:/LFAA1/packages/core/tools/src/project-tools.ts](../../packages/core/tools/src/project-tools.ts) | 跨界面项目文件合同，仍校验任务目录和真实节点 |
| 修改 | [H:/LFAA1/packages/core/tools/src/registry.ts](../../packages/core/tools/src/registry.ts) | 唯一工具登记/上下文工厂、合同校验和撤销保护 |
| 迁移/删除旧入口 | `H:/LFAA1/packages/core/tools/src/runtime-tools.ts` | 移至 [新 Owner](../../packages/games/tool-runtime/src/index.ts)；删除旧内容/挂载或自动组装入口 |
| 新增 | [H:/LFAA1/packages/core/tools/src/tool-contract.ts](../../packages/core/tools/src/tool-contract.ts) | 共享工具类型、参数/风险辅助和有界任务观察 |
| 新增 | [H:/LFAA1/packages/document/tool-writing/README.md](../../packages/document/tool-writing/README.md) | 绑定当前账户作品的写作读取/提案工具合同：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/document/tool-writing/package.json](../../packages/document/tool-writing/package.json) | 绑定当前账户作品的写作读取/提案工具合同：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/document/tool-writing/src/index.ts](../../packages/document/tool-writing/src/index.ts) | 绑定当前账户作品的写作读取/提案工具合同：生产登记/提供方及真实业务适配 |
| 修改 | [H:/LFAA1/packages/document/writing/README.md](../../packages/document/writing/README.md) | 作品、章节、资料、修订、提案事务与本机正文存储：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/document/writing/package.json](../../packages/document/writing/package.json) | 作品、章节、资料、修订、提案事务与本机正文存储：同步公开入口、依赖和运行登记 |
| 修改 | [H:/LFAA1/packages/document/writing/src/deepwrite-archive.ts](../../packages/document/writing/src/deepwrite-archive.ts) | 同步写作角色元数据来源，保留 ZIP 与账户校验 |
| 迁移/删除旧入口 | `H:/LFAA1/packages/document/writing/src/prompts.ts` | 移至 [新 Owner](../../packages/prompt/writing/src/prompts.ts)；删除旧内容/挂载或自动组装入口 |
| 修改 | [H:/LFAA1/packages/document/writing/src/service.ts](../../packages/document/writing/src/service.ts) | 原 Writing 业务 Owner；共享轻量目标元数据与明确正文读取 |
| 迁移/删除旧入口 | `H:/LFAA1/packages/document/writing/src/writing-prompt-library.ts` | 移至 [新 Owner](../../packages/prompt/writing/src/writing-prompt-library.ts)；删除旧内容/挂载或自动组装入口 |
| 迁移/删除旧入口 | `H:/LFAA1/packages/document/writing/src/writing-specialist-library.ts` | 移至 [新 Owner](../../packages/preset/domain-experts/src/writing-specialists.ts)；删除旧内容/挂载或自动组装入口 |
| 修改 | [H:/LFAA1/packages/games/minecraft/README.md](../../packages/games/minecraft/README.md) | Minecraft 核心、实例、部署与生命周期领域服务：职责、设置、生命周期和验收合同 |
| 迁移/删除旧入口 | `H:/LFAA1/packages/games/minecraft/assets/minecraft-server-setup/SKILL.md` | 移至 [新 Owner](../../packages/skill/minecraft/assets/minecraft-server-setup/SKILL.md)；删除旧内容/挂载或自动组装入口 |
| 修改 | [H:/LFAA1/packages/games/minecraft/package.json](../../packages/games/minecraft/package.json) | Minecraft 核心、实例、部署与生命周期领域服务：同步公开入口、依赖和运行登记 |
| 修改 | [H:/LFAA1/packages/games/minecraft/src/index.ts](../../packages/games/minecraft/src/index.ts) | Minecraft 核心、实例、部署与生命周期领域服务：生产登记/提供方及真实业务适配 |
| 迁移/删除旧入口 | `H:/LFAA1/packages/games/minecraft/src/minecraft-prompt-library.ts` | 移至 [新 Owner](../../packages/prompt/minecraft/src/minecraft-prompt-library.ts)；删除旧内容/挂载或自动组装入口 |
| 迁移/删除旧入口 | `H:/LFAA1/packages/games/minecraft/src/prompts.ts` | 移至 [新 Owner](../../packages/prompt/minecraft/src/minecraft-prompt-library.ts)；删除旧内容/挂载或自动组装入口 |
| 迁移/删除旧入口 | `H:/LFAA1/packages/games/minecraft/src/setup-skill.ts` | 移至 [新 Owner](../../packages/skill/minecraft/src/setup-skill.ts)；删除旧内容/挂载或自动组装入口 |
| 新增 | [H:/LFAA1/packages/games/tool-minecraft/README.md](../../packages/games/tool-minecraft/README.md) | Minecraft 模型工具与原业务服务适配，合同按需选择：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/games/tool-minecraft/package.json](../../packages/games/tool-minecraft/package.json) | Minecraft 模型工具与原业务服务适配，合同按需选择：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/games/tool-minecraft/src/index.ts](../../packages/games/tool-minecraft/src/index.ts) | Minecraft 模型工具与原业务服务适配，合同按需选择：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/games/tool-runtime/README.md](../../packages/games/tool-runtime/README.md) | 运行环境模型工具与 RuntimeManager 适配：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/games/tool-runtime/package.json](../../packages/games/tool-runtime/package.json) | 运行环境模型工具与 RuntimeManager 适配：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/games/tool-runtime/src/index.ts](../../packages/games/tool-runtime/src/index.ts) | 运行环境模型工具与 RuntimeManager 适配：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/games/tool-steamcmd/README.md](../../packages/games/tool-steamcmd/README.md) | SteamCMD 模型工具与原节点任务服务适配：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/games/tool-steamcmd/package.json](../../packages/games/tool-steamcmd/package.json) | SteamCMD 模型工具与原节点任务服务适配：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/games/tool-steamcmd/src/index.ts](../../packages/games/tool-steamcmd/src/index.ts) | SteamCMD 模型工具与原节点任务服务适配：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/preset/agent-preset/README.md](../../packages/preset/agent-preset/README.md) | 主/子 Agent 预设元数据登记，不持有领域正文：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/preset/agent-preset/package.json](../../packages/preset/agent-preset/package.json) | 主/子 Agent 预设元数据登记，不持有领域正文：同步公开入口、依赖和运行登记 |
| 修改 | [H:/LFAA1/packages/preset/agent-preset/src/builtin-catalog.ts](../../packages/preset/agent-preset/src/builtin-catalog.ts) | 主/子 Agent 预设元数据登记，不持有领域正文：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/preset/domain-experts/README.md](../../packages/preset/domain-experts/README.md) | 领域与写作角色元数据、稳定 ID 及按需专家正文：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/preset/domain-experts/package.json](../../packages/preset/domain-experts/package.json) | 领域与写作角色元数据、稳定 ID 及按需专家正文：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/preset/domain-experts/src/catalog.ts](../../packages/preset/domain-experts/src/catalog.ts) | 领域与写作角色元数据、稳定 ID 及按需专家正文：仅摘要与稳定 ID |
| 新增 | [H:/LFAA1/packages/preset/domain-experts/src/domain-instructions.ts](../../packages/preset/domain-experts/src/domain-instructions.ts) | 领域专家正文，仅选择后导入 |
| 新增 | [H:/LFAA1/packages/preset/domain-experts/src/index.ts](../../packages/preset/domain-experts/src/index.ts) | 领域与写作角色元数据、稳定 ID 及按需专家正文：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/preset/domain-experts/src/writing-catalog.ts](../../packages/preset/domain-experts/src/writing-catalog.ts) | 写作角色稳定 ID 与校验元数据，不加载正文 |
| 新增 | [H:/LFAA1/packages/preset/domain-experts/src/writing-specialists.ts](../../packages/preset/domain-experts/src/writing-specialists.ts) | 保留原六种写作角色方法，正文按需读取 |
| 新增 | [H:/LFAA1/packages/prompt/minecraft/README.md](../../packages/prompt/minecraft/README.md) | Minecraft 提示词正文 Owner、摘要及按需加载登记：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/prompt/minecraft/package.json](../../packages/prompt/minecraft/package.json) | Minecraft 提示词正文 Owner、摘要及按需加载登记：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/prompt/minecraft/src/catalog.ts](../../packages/prompt/minecraft/src/catalog.ts) | Minecraft 提示词正文 Owner、摘要及按需加载登记：仅摘要与稳定 ID |
| 新增 | [H:/LFAA1/packages/prompt/minecraft/src/index.ts](../../packages/prompt/minecraft/src/index.ts) | Minecraft 提示词正文 Owner、摘要及按需加载登记：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/prompt/minecraft/src/minecraft-prompt-library.ts](../../packages/prompt/minecraft/src/minecraft-prompt-library.ts) | Minecraft 提示词正文 Owner、摘要及按需加载登记：原正文及稳定 Prompt ID |
| 新增 | [H:/LFAA1/packages/prompt/prompt/README.md](../../packages/prompt/prompt/README.md) | 复用 AiExtensions 的 Prompt/Expert 目录、正文加载及账户安装提示词工具：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/prompt/prompt/package.json](../../packages/prompt/prompt/package.json) | 复用 AiExtensions 的 Prompt/Expert 目录、正文加载及账户安装提示词工具：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/prompt/prompt/src/index.ts](../../packages/prompt/prompt/src/index.ts) | 复用 AiExtensions 的 Prompt/Expert 目录、正文加载及账户安装提示词工具：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/prompt/prompt/src/installed-prompts.ts](../../packages/prompt/prompt/src/installed-prompts.ts) | 原账户/App 提示词与摘要校验迁入正确适配包 |
| 新增 | [H:/LFAA1/packages/prompt/writing/README.md](../../packages/prompt/writing/README.md) | 写作任务提示词正文 Owner、摘要及按需加载登记：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/prompt/writing/package.json](../../packages/prompt/writing/package.json) | 写作任务提示词正文 Owner、摘要及按需加载登记：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/prompt/writing/src/catalog.ts](../../packages/prompt/writing/src/catalog.ts) | 写作任务提示词正文 Owner、摘要及按需加载登记：仅摘要与稳定 ID |
| 新增 | [H:/LFAA1/packages/prompt/writing/src/index.ts](../../packages/prompt/writing/src/index.ts) | 写作任务提示词正文 Owner、摘要及按需加载登记：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/prompt/writing/src/prompts.ts](../../packages/prompt/writing/src/prompts.ts) | 写作任务提示词正文 Owner、摘要及按需加载登记：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/prompt/writing/src/writing-prompt-library.ts](../../packages/prompt/writing/src/writing-prompt-library.ts) | 写作任务提示词正文 Owner、摘要及按需加载登记：原正文及稳定 Prompt ID |
| 修改 | [H:/LFAA1/packages/shell/tool-shell/README.md](../../packages/shell/tool-shell/README.md) | 目标节点与本机 Shell 的模型工具合同：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/shell/tool-shell/src/index.ts](../../packages/shell/tool-shell/src/index.ts) | 目标节点与本机 Shell 的模型工具合同：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/skill/minecraft/README.md](../../packages/skill/minecraft/README.md) | Minecraft bundled SKILL.md 资源及独立按需 Provider：职责、设置、生命周期和验收合同 |
| 新增 | [H:/LFAA1/packages/skill/minecraft/assets/minecraft-server-setup/SKILL.md](../../packages/skill/minecraft/assets/minecraft-server-setup/SKILL.md) | 迁移原 Minecraft Skill 正文，保留有效内容和稳定名称 |
| 新增 | [H:/LFAA1/packages/skill/minecraft/package.json](../../packages/skill/minecraft/package.json) | Minecraft bundled SKILL.md 资源及独立按需 Provider：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/skill/minecraft/src/index.ts](../../packages/skill/minecraft/src/index.ts) | Minecraft bundled SKILL.md 资源及独立按需 Provider：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/skill/minecraft/src/setup-skill.ts](../../packages/skill/minecraft/src/setup-skill.ts) | 原 Minecraft Skill Provider 迁移，统一正文读取与摘要投影 |
| 修改 | [H:/LFAA1/packages/skill/tool-skill/README.md](../../packages/skill/tool-skill/README.md) | 共享 Skill 发现/加载工具及旧写作调用名适配：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/skill/tool-skill/package.json](../../packages/skill/tool-skill/package.json) | 共享 Skill 发现/加载工具及旧写作调用名适配：同步公开入口、依赖和运行登记 |
| 修改 | [H:/LFAA1/packages/skill/tool-skill/src/index.ts](../../packages/skill/tool-skill/src/index.ts) | 共享 Skill 发现/加载工具及旧写作调用名适配：生产登记/提供方及真实业务适配 |
| 新增 | [H:/LFAA1/packages/skill/writing/README.md](../../packages/skill/writing/README.md) | 内置写作方法正文、摘要及共享 Skill Provider：职责、设置、生命周期和验收合同 |
| 修改 | [H:/LFAA1/packages/skill/writing/package.json](../../packages/skill/writing/package.json) | 内置写作方法正文、摘要及共享 Skill Provider：同步公开入口、依赖和运行登记 |
| 新增 | [H:/LFAA1/packages/skill/writing/src/catalog.ts](../../packages/skill/writing/src/catalog.ts) | 内置写作方法正文、摘要及共享 Skill Provider：仅摘要与稳定 ID |
| 新增 | [H:/LFAA1/packages/skill/writing/src/index.ts](../../packages/skill/writing/src/index.ts) | 内置写作方法正文、摘要及共享 Skill Provider：生产登记/提供方及真实业务适配 |
| 修改 | [H:/LFAA1/packages/skill/writing/src/writing-skills.ts](../../packages/skill/writing/src/writing-skills.ts) | 内置写作方法正文、摘要及共享 Skill Provider：生产登记/提供方及真实业务适配 |
| 修改 | [H:/LFAA1/pnpm-lock.yaml](../../pnpm-lock.yaml) | pnpm 同步工作区依赖与包链接，不手改锁文件 |
| 修改 | [H:/LFAA1/scripts/check-workspace.mjs](../../scripts/check-workspace.mjs) | 原 Gate 增加全目录职责覆盖和 App/包消费者证据 |
| 新增 | [H:/LFAA1/scripts/package-responsibilities.mjs](../../scripts/package-responsibilities.mjs) | 每个实际目录的专属职责注解，不决定目录存在或可用状态 |
| 修改 | [H:/LFAA1/tsconfig.client.json](../../tsconfig.client.json) | 从唯一工作区清单同步 TypeScript 包路径 |
| 修改 | [H:/LFAA1/tsconfig.host.json](../../tsconfig.host.json) | 从唯一工作区清单同步 TypeScript 包路径 |
| 修改 | [H:/LFAA1/开发规范.md](../../开发规范.md) | 同步长期规范与当前架构事实，保留已有内容 |
