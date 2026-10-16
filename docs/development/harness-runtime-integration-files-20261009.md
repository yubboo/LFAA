# Harness 运行链修复：逐文件清单

日期：2026-10-09。当前 checkout：`H:/LFAA1`。仅列本轮实际修改的 85 个文件；工作树原有的大量变更继续保留，不将它们归为本轮成果。构建输出位于根 `dist/`，不列作源码变更。

## 规则与架构

| 绝对路径 | 本轮职责 |
| --- | --- |
| [H:/LFAA1/AGENTS.md](<../../AGENTS.md>) | 唯一三种权限模式及今后开发约束 |
| [H:/LFAA1/开发规范.md](<../../开发规范.md>) | 消除领域独立审批规则，明确统一授权流程 |
| [H:/LFAA1/docs/系统总体架构.md](<../../docs/系统总体架构.md>) | 更新 EULA、写作应用动作及 Owner 合同 |
| [H:/LFAA1/docs/PROMPTS.md](<../../docs/PROMPTS.md>) | 本轮入口、设置、Owner 与验收合同 |
| [H:/LFAA1/docs/development/harness-runtime-integration-20261009.md](<../../docs/development/harness-runtime-integration-20261009.md>) | 本轮发现、修复、验证和边界 |
| [H:/LFAA1/docs/development/harness-runtime-integration-files-20261009.md](<../../docs/development/harness-runtime-integration-files-20261009.md>) | 本轮完整逐文件绝对路径与职责 |

## 装配与依赖

| 绝对路径 | 本轮职责 |
| --- | --- |
| [H:/LFAA1/packages/boot/app-boot/src/index.ts](<../../packages/boot/app-boot/src/index.ts>) | 失败插件准确诊断 |
| [H:/LFAA1/packages/boot/app-boot/src/ai-host.ts](<../../packages/boot/app-boot/src/ai-host.ts>) | Skill 和压缩服务接入实际模型宿主 |
| [H:/LFAA1/packages/boot/app-boot/package.json](<../../packages/boot/app-boot/package.json>) | 声明 Skill/LLM 内部依赖 |
| [H:/LFAA1/packages/bundle/base/cordis.patch.yml](<../../packages/bundle/base/cordis.patch.yml>) | Skills、调度、Agent 上下文真实依赖装配 |
| [H:/LFAA1/packages/ssh/ssh/src/index.ts](<../../packages/ssh/ssh/src/index.ts>) | 导出可加载插件 |
| [H:/LFAA1/packages/ssh/fs-ssh/src/index.ts](<../../packages/ssh/fs-ssh/src/index.ts>) | 导出可加载插件 |
| [H:/LFAA1/packages/ssh/subprocess-ssh/src/index.ts](<../../packages/ssh/subprocess-ssh/src/index.ts>) | 导出可加载插件 |
| [H:/LFAA1/packages/ssh/sandbox-ssh/src/index.ts](<../../packages/ssh/sandbox-ssh/src/index.ts>) | 导出可加载插件 |
| [H:/LFAA1/scripts/build-harness.mjs](<../../scripts/build-harness.mjs>) | 控制端复制运行 assets，修复正式包缺失 Office 资源 |
| [H:/LFAA1/pnpm-lock.yaml](<../../pnpm-lock.yaml>) | 新增内部依赖与统一 js-yaml 声明的锁文件 |

## 设置

| 绝对路径 | 本轮职责 |
| --- | --- |
| [H:/LFAA1/packages/util/values/src/settings-contract.ts](<../../packages/util/values/src/settings-contract.ts>) | 共享配置类型和默认值 |
| [H:/LFAA1/packages/settings/settings/src/validation.ts](<../../packages/settings/settings/src/validation.ts>) | 新配置及不限次数的服务端校验 |
| [H:/LFAA1/packages/settings/settings/src/service.ts](<../../packages/settings/settings/src/service.ts>) | 持久化、旧客户端兼容及模型窗口信息 |
| [H:/LFAA1/packages/client/ui-settings/src/SettingsPage.tsx](<../../packages/client/ui-settings/src/SettingsPage.tsx>) | 配置控件、说明和 Skill 根目录草稿 |
| [H:/LFAA1/packages/util/launch-environment/src/config.ts](<../../packages/util/launch-environment/src/config.ts>) | 区分本机 CLI/桌面与远程控制端能力位置 |

## Skill

| 绝对路径 | 本轮职责 |
| --- | --- |
| [H:/LFAA1/packages/skill/skill/src/index.ts](<../../packages/skill/skill/src/index.ts>) | 账户/目录缓存隔离与撤销失效 |
| [H:/LFAA1/packages/skill/skill-filesystem/src/index.ts](<../../packages/skill/skill-filesystem/src/index.ts>) | 按需有界读取、失效监听、启动超时与清理 |
| [H:/LFAA1/packages/skill/skill-filesystem/package.json](<../../packages/skill/skill-filesystem/package.json>) | 统一 js-yaml 依赖声明 |
| [H:/LFAA1/packages/skill/tool-skill/src/index.ts](<../../packages/skill/tool-skill/src/index.ts>) | Provider 摘要和按需加载正文接入模型工具 |
| [H:/LFAA1/packages/skill/tool-skill/package.json](<../../packages/skill/tool-skill/package.json>) | 声明实际使用的 Skill、设置与环境依赖 |
| [H:/LFAA1/packages/skill/writing/src/writing-skills.ts](<../../packages/skill/writing/src/writing-skills.ts>) | 写作保存共用三种权限 |
| [H:/LFAA1/packages/skill/skill-office/src/index.ts](<../../packages/skill/skill-office/src/index.ts>) | 依赖能力以实际主机发现为准，移除禁止使用现有渲染器的规则 |
| [H:/LFAA1/packages/skill/skill-office/package.json](<../../packages/skill/skill-office/package.json>) | 统一 js-yaml 依赖声明 |
| [H:/LFAA1/packages/skill/skill-office/assets/office-docx/SKILL.md](<../../packages/skill/skill-office/assets/office-docx/SKILL.md>) | Word 方法允许按权限发现/准备真实依赖 |
| [H:/LFAA1/packages/skill/skill-office/assets/office-pptx/SKILL.md](<../../packages/skill/skill-office/assets/office-pptx/SKILL.md>) | 幻灯片方法允许按权限发现/准备真实依赖 |
| [H:/LFAA1/packages/skill/skill-office/assets/office-xlsx/SKILL.md](<../../packages/skill/skill-office/assets/office-xlsx/SKILL.md>) | 表格方法允许按权限发现/准备真实依赖 |

## Agent、上下文与委派

| 绝对路径 | 本轮职责 |
| --- | --- |
| [H:/LFAA1/packages/core/agent-loop/src/execute-turn.ts](<../../packages/core/agent-loop/src/execute-turn.ts>) | 真实 Skill 摘要、压缩、预算、继承范围、图片输入及统一领域授权 |
| [H:/LFAA1/packages/core/agent-loop/src/runs.ts](<../../packages/core/agent-loop/src/runs.ts>) | 子 Run 继承项目/工具/模型/深度/共享预算和取消 |
| [H:/LFAA1/packages/core/agent-loop/src/index.ts](<../../packages/core/agent-loop/src/index.ts>) | 调度交付真实 Run，补齐插件上下文依赖 |
| [H:/LFAA1/packages/core/agent-loop/src/runtime-context.ts](<../../packages/core/agent-loop/src/runtime-context.ts>) | 相同数组不误判压缩重写 |
| [H:/LFAA1/packages/core/agent-loop/package.json](<../../packages/core/agent-loop/package.json>) | 调度和运行环境依赖 |
| [H:/LFAA1/packages/core/system-prompt/src/index.ts](<../../packages/core/system-prompt/src/index.ts>) | 统一三种模式与两次批准记忆语义 |
| [H:/LFAA1/packages/compaction/compaction-basic/src/index.ts](<../../packages/compaction/compaction-basic/src/index.ts>) | 摘要复用当前 Run 请求器 |
| [H:/LFAA1/packages/compaction/compaction-basic/src/region.ts](<../../packages/compaction/compaction-basic/src/region.ts>) | 单个长任务也可压缩早期工具往返 |
| [H:/LFAA1/packages/compaction/compaction/src/tool-pairing.ts](<../../packages/compaction/compaction/src/tool-pairing.ts>) | 以工具对真实闭合点选择边界 |
| [H:/LFAA1/packages/subagent/subagent/src/types.ts](<../../packages/subagent/subagent/src/types.ts>) | 可信子 Run 启动接缝 |
| [H:/LFAA1/packages/subagent/subagent/src/manager.ts](<../../packages/subagent/subagent/src/manager.ts>) | 完成记录有界淘汰、结果标识与观察者清理 |
| [H:/LFAA1/packages/subagent/subagent-in-process-driver/src/index.ts](<../../packages/subagent/subagent-in-process-driver/src/index.ts>) | 复用父任务委派合同 |
| [H:/LFAA1/packages/subagent/subagent-in-process-driver/package.json](<../../packages/subagent/subagent-in-process-driver/package.json>) | 移除新建独立根 Run 的旧依赖 |
| [H:/LFAA1/packages/subagent/tool-subagent/src/index.ts](<../../packages/subagent/tool-subagent/src/index.ts>) | 使用已保存的真实模型账户，增加安全模型目录 |
| [H:/LFAA1/packages/subagent/tool-subagent/src/invariant.ts](<../../packages/subagent/tool-subagent/src/invariant.ts>) | 接受账户 UUID 及真实模型标识 |
| [H:/LFAA1/packages/subagent/tool-subagent/package.json](<../../packages/subagent/tool-subagent/package.json>) | 设置与本机能力依赖 |

## 文件、Shell、终端与桌面

| 绝对路径 | 本轮职责 |
| --- | --- |
| [H:/LFAA1/packages/core/tools/src/business-tools.ts](<../../packages/core/tools/src/business-tools.ts>) | 写作应用工具与领域授权说明 |
| [H:/LFAA1/packages/core/tools/src/project-tools.ts](<../../packages/core/tools/src/project-tools.ts>) | 通用文件别名统一交给 Daemon 文件 Owner |
| [H:/LFAA1/packages/fs/tool-fs/src/index.ts](<../../packages/fs/tool-fs/src/index.ts>) | 列目录和图片工具真实节点接线 |
| [H:/LFAA1/packages/fs/tool-fs/src/read.ts](<../../packages/fs/tool-fs/src/read.ts>) | 文本读取参数与元数据 |
| [H:/LFAA1/packages/fs/tool-fs/src/write.ts](<../../packages/fs/tool-fs/src/write.ts>) | 写入参数与元数据 |
| [H:/LFAA1/packages/fs/tool-fs-search/src/index.ts](<../../packages/fs/tool-fs-search/src/index.ts>) | 检索工具转交统一文件 Owner |
| [H:/LFAA1/packages/fs/tool-str-replace-editor/src/index.ts](<../../packages/fs/tool-str-replace-editor/src/index.ts>) | 替换工具转交统一文件 Owner |
| [H:/LFAA1/packages/host/daemon/src/project-files.mjs](<../../packages/host/daemon/src/project-files.mjs>) | 分页、图片、文件名搜索、摘要校验和替换真实执行 |
| [H:/LFAA1/packages/host/daemon/src/daemon.mjs](<../../packages/host/daemon/src/daemon.mjs>) | 控制台参数校验不另设生命周期命令禁令 |
| [H:/LFAA1/packages/shell/tool-shell/src/index.ts](<../../packages/shell/tool-shell/src/index.ts>) | 本机能力位置、任务目录、账户超时及统一审批 |
| [H:/LFAA1/packages/shell/tool-shell/package.json](<../../packages/shell/tool-shell/package.json>) | 运行环境依赖 |
| [H:/LFAA1/packages/shell/pwsh-local/src/index.ts](<../../packages/shell/pwsh-local/src/index.ts>) | 命令超时 0 真正保持不限时 |
| [H:/LFAA1/packages/terminal/tool-terminal/src/index.ts](<../../packages/terminal/tool-terminal/src/index.ts>) | 闭包注入服务、账户/Run 会话、设置和清理 |
| [H:/LFAA1/packages/terminal/tool-terminal/package.json](<../../packages/terminal/tool-terminal/package.json>) | 设置、Shell 和本机环境依赖 |
| [H:/LFAA1/packages/terminal/terminal/src/index.ts](<../../packages/terminal/terminal/src/index.ts>) | 退出淘汰与卸载关闭全部会话 |
| [H:/LFAA1/packages/computer-use/computer-use/src/index.ts](<../../packages/computer-use/computer-use/src/index.ts>) | 真实窗口目录及键盘精确目标，允许查询核实的 EXE 路径 |
| [H:/LFAA1/packages/computer-use/computer-use/src/local-apps.ts](<../../packages/computer-use/computer-use/src/local-apps.ts>) | 发现后按用户目标选择启动，无额外等待用户选定规则 |
| [H:/LFAA1/packages/computer-use/computer-use/README.md](<../../packages/computer-use/computer-use/README.md>) | 窗口定位、通用发现与三种权限的能力边界 |

## 领域与调度

| 绝对路径 | 本轮职责 |
| --- | --- |
| [H:/LFAA1/packages/games/minecraft/src/service.ts](<../../packages/games/minecraft/src/service.ts>) | 控制台动作仅校验真实参数，不建立另一套授权禁令 |
| [H:/LFAA1/packages/games/minecraft/src/minecraft-prompt-library.ts](<../../packages/prompt/minecraft/src/minecraft-prompt-library.ts>) | EULA、生命周期与通用工具统一权限 |
| [H:/LFAA1/packages/document/writing/src/prompts.ts](<../../packages/prompt/writing/src/prompts.ts>) | 保存目标可生成并应用提案 |
| [H:/LFAA1/packages/document/writing/src/writing-prompt-library.ts](<../../packages/prompt/writing/src/writing-prompt-library.ts>) | 专项方法移除强制界面应用门槛 |
| [H:/LFAA1/packages/preset/agent-preset/src/builtin-catalog.ts](<../../packages/preset/agent-preset/src/builtin-catalog.ts>) | 内置顾问使用真实工具与统一权限 |
| [H:/LFAA1/packages/schedule/schedule/src/index.ts](<../../packages/schedule/schedule/src/index.ts>) | 实例持有调度服务及交付器，卸载等待清理 |
| [H:/LFAA1/packages/schedule/schedule/src/targets.ts](<../../packages/schedule/schedule/src/targets.ts>) | 持久化真实账户/App/会话与工具范围 |
| [H:/LFAA1/packages/schedule/schedule/src/tools.ts](<../../packages/schedule/schedule/src/tools.ts>) | 创建绑定目标并唤醒调度器 |
| [H:/LFAA1/packages/schedule/schedule/src/runtime.ts](<../../packages/schedule/schedule/src/runtime.ts>) | 真实派发、单计时器与关闭等待 |
| [H:/LFAA1/packages/schedule/schedule/src/store.ts](<../../packages/schedule/schedule/src/store.ts>) | 每次最多读取 100 个到期任务 |
| [H:/LFAA1/packages/schedule/schedule/src/client.ts](<../../packages/schedule/schedule/src/client.ts>) | 记录真实 Run ID，无交付器明确失败 |
| [H:/LFAA1/packages/identity/auth/src/service.ts](<../../packages/identity/auth/src/service.ts>) | 后台触发时读取当前账户角色 |

## 长期回归

| 绝对路径 | 本轮职责 |
| --- | --- |
| [H:/LFAA1/apps/cli/tests/harness-agent-api.test.mjs](<../../apps/cli/tests/harness-agent-api.test.mjs>) | 完整 Profile 工具数与认证/后台运行回归 |
| [H:/LFAA1/apps/cli/tests/agent-runtime.test.mjs](<../../apps/cli/tests/agent-runtime.test.mjs>) | 预算 0 合法、负数非法，保留运行与权限回归 |
| [H:/LFAA1/apps/cli/tests/writing-edit-proposals.test.mjs](<../../apps/cli/tests/writing-edit-proposals.test.mjs>) | 授权应用、作品隔离、冲突和修订历史 |
| [H:/LFAA1/apps/cli/tests/computer-use.test.mjs](<../../apps/cli/tests/computer-use.test.mjs>) | 精确窗口键盘目标与三种模式、通用应用发现回归 |
| [H:/LFAA1/apps/cli/tests/harness-runtime-wiring.test.mjs](<../../apps/cli/tests/harness-runtime-wiring.test.mjs>) | 完整 Profile 隔离入口及资源清理 |
| [H:/LFAA1/apps/cli/tests/fixtures/harness-runtime-wiring.mjs](<../../apps/cli/tests/fixtures/harness-runtime-wiring.mjs>) | 真实服务/队列/Run 加合成 Provider 的七阶段回归 |
| [H:/LFAA1/scripts/tests/compiled-web-startup.test.mjs](<../../scripts/tests/compiled-web-startup.test.mjs>) | 正式编译入口、认证、新设置读写和退出回归 |

