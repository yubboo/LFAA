# 小鱼智能体统一交付与验收记录

2026-10-15；合同 LFAA-XIAOYU-SHARED-AGENT-20261014。以任务开始时保存的文件哈希区分本轮与此前工作，保留所有既有改动。用户已选择仅在独立验收环境创建超级管理员；该账户现已完成正常首次初始化与内置浏览器登录，原项目账号权限保持。未实测的扩展能力仍按后文保留边界。

## 已实现与本轮修复

所有 App 共用 /work 小鱼智能体；应用中心选择 App 后只进入常规功能。旧工作地址归一，旧会话/项目来源保留，账户目录统一展示，实际 Owner 和权限不合并。关联 App/Skill/Prompt/Expert 只保存有界引用，默认可空，不注入正文或授予执行权限；主/子 Agent 和领域工具沿原模型、Session、注册表与执行器。

浏览器验收补修：内置 Skill 引用不再被外部插件开关整体禁用；能力按显示名称搜索；关联目录可显式刷新项目/节点，旧请求取消；新增引用行造成短屏底部裁切，聊天容器现按自身高度滚动。真实模型验收补修：心跳合同登记两个已实现的文件能力；Daemon 详情与列表共用 20 秒有效期，避免详情误报在线。

## 设置中心实际使用

| 配置 | 接入/验证 |
| --- | --- |
| general.defaultMode/defaultStandaloneChat | 单一默认首页选项同时兼容旧字段；新账号保存工作，重新进入 / 后到 /work；原账号偏好保持 |
| general.taskFolder/integratedShell/navigationLayout/terminalPosition 与快捷键 | 原项目、终端、布局、快捷入口继续共用；不另存第二套配置 |
| Provider 账户、主/子 Agent 模型与 reasoning_mode | 原账户真实模型 deepseek-flash，整个执行保持同一模型；新账号不复制旧账号密钥 |
| aiRuntime 预算、promptSuggestions、通知、personalization | 沿用原 Agent/Session 控制与分支配置；本轮新账号仅当日暂停首次配置提醒 |
| plugins.enabled/skillDirectories/扩展/MCP | 目录返回真实元数据；引用不启用外部插件、不加载正文；bundled Skill 按原 Owner 例外可发现 |
| permissions.mode、computerControl.enabled、实际身份 | 原模型执行全程 full_access；新账号请求审批，普通管理员不得进入要求超级管理员且完全访问的文件操作 |
| Appearance 主题/颜色/字体/字号/对比度/壁纸/遮罩/模糊/减少动态效果 | 使用原共享令牌、ResizableWorkbench 和设置映射；浏览器实际显示当前账户外观，没有新偏好副本 |
| LFAA_DATA_DIR 与原 Data Directory Owner | 首次无配置默认 C:\Users\yu\.lfaa\data；推荐 H:\LFAA1\data；现有 .env 显式 data，当前使用 H:\LFAA1\data。分类都从一个根派生；未迁移真实数据 |

## 统一回归与正式运行

- 共享工作直接回归 58/58 通过（13 个文件）：xiaoyu-shared-agent、xiaoyu-shared-api、workspace-projects、package-owner-lazy-capabilities、session-kernel、session-kernel-persistence、session-branch-memory、general-agent-capabilities、minecraft-multicore、minecraft-setup-skill、client-ai-work-composer-responsive、client-workbench-responsive、client-session-restore。浏览器修复后另复验相关 12 项，再对整理后的 API 场景和聊天 CSS 复验 3/3；这些有重叠，不相加冒充全仓总数。
- 文件/存储重新执行 59/59：file-resources、system-file-library、file-manager-foundation、file-manager-api、data-directory-settings、data-directory、runtime-environment、writing-local-files、minecraft-multicore。
- Client/Host typecheck、22 个相关能力包串行构建、正式 Control Plane/Web、Daemon 语法/原生宿主构建、check:workspace（192 个包）、git diff --check 通过。输出全部在根 dist；正式 Web/Host 指纹返回 []。Web 保留已有 cpp chunk 501.30 kB 提示。
- 浏览器最终使用正常 apps/cli/bin/lfaa.mjs web 启动，3000 端口原先空闲；保留后台正式服务及其自有 Daemon。仅替换本任务自建验收进程，未重启他人的既有服务。正式账号、四个新实例和真实日志保留。本轮三个一次性维护启动脚本与新账号临时凭据副本的清理被自动审批策略拒绝，仅返回 blocked by policy；未换方式绕过，文件仍在根 dist/.tmp/xiaoyu-agent，凭据副本已限制为当前系统账户 ACL 可读。

## 真实模型与 Minecraft

真实用户 yubboo 原配置：DeepSeek/deepseek-flash，节点 DESKTOP-26FQTU7，Permission Owner 读出 full_access。通过维护入口调用原 Agent Loop，非浏览器消息提交，未模拟 Provider、替换模型或跳过执行权限。只读能力验收 8 个 request/header、29 个 tool/call；模型自主发现 Skill/Prompt/Expert/Tools，加载实际 Minecraft Skill/Prompt/领域工具并读取真实节点与内核目录。

开服验收 36 个 request/header、61 个 tool/call（JSONL 唯一事件计数），模型自行选择 1.21.11、托管 Java 21、版本/构建与空闲端口，经原工具/Daemon 部署并就绪；EULA 动作明确描述且经同一权限模式。

| 独立新实例 | 实际核心/构建 | 端口 | 节点结果 |
| --- | --- | --- | --- |
| xiaoyu-acceptance-vanilla | Vanilla 1.21.11 release | 25567 | install succeeded，serverReady/locallyListening=true，正常 stop，forced=false、exitCode=0 |
| xiaoyu-acceptance-paper | Paper 1.21.11 build 132 | 25568 | 同上；实际启动无第三方插件 |
| xiaoyu-acceptance-fabric | Fabric 1.21.11，0.19.5-1.0.0 | 25569 | 同上；实际加载内置 loader 组件 |
| xiaoyu-acceptance-forge | Forge 1.21.11-61.1.16 | 25570 | 同上；正常完成核心初始化 |

Fabric 下载迟迟无日志时，模型通过真实节点 Shell 看见 Java 下载 I/O 和持续增长的工件，依据证据等待而没有重复安装；最后实际就绪。Forge 后段节点/Shell状态不一致时，模型查询节点并经 Minecraft Owner 正常停服，随后回读停止状态。此证据支持本次自主发现/执行/调整，不保证任意任务都能完成。单节点过期读取已补修并回归，未重新做第二轮四核心完整部署。

四个新实例的八个 install/stop 任务均 succeeded；最后数据库与浏览器为八个实例全部 stopped、活动任务 0，系统未发现 25565–25588 监听。既有四个实例保留。worldSaveConfirmed 为空，未额外证明世界存档一致性。未安装任意第三方插件/模组/整合包，未验证 LAN/公网/客户端登录；Paper/Fabric/Forge 核心运行不代表所有生态组合兼容。

真实证据保留于根 dist/.tmp/xiaoyu-agent：live-result/live-evidence、deployment-result、deployment-event-counts、verified-minecraft-state、回归/类型/构建/Gate 日志。真正的会话日志在 data/sessions 的原 JSONL Owner，游戏文件在 data/games/minecraft 的原实例目录；不写第二套产品数据源。

## 内置浏览器实际结果

- 新账户正常密码登录成功；应用中心 → 游戏库 → Minecraft 的地址是 /apps/minecraft/normal，工作按钮回到 /work。Minecraft 总览显示在线节点 1/1、运行 0/8、活动任务 0。
- 默认首页保存工作后重新进入 /，实际回到 /work；明确点击应用仍停留应用中心，不被默认设置反复拉回。
- 通过真实在线 Daemon 浏览 H:\LFAA1，并为新账号登记“LFAA1 · 小鱼验收”，回显真实项目。能力支持中文名称搜索、可选 Minecraft/Skill 引用；重新加载前未发送的新会话引用仍是草稿，不声称已持久化到 Session。
- 390×844、768×1024 无横向页面溢出，发送区域在可用高度内；560×400 的整体滚动使底部发送按钮进入视口（实测 bottom=381、height=400）。资源侧栏按原 Dock/Overlay 切换，可关闭后使用主工作区；尺寸覆写已重置。
- 设置页实际显示默认 .lfaa/data、推荐项目 data、当前 H:\LFAA1\data 和只读分类派生目录。正式启动入口可显示迁移输入；新账号尚非超级管理员，推荐按钮受原身份限制。未实际点击安排迁移。
- 文件页对新账号明确拒绝：需要超级管理员且完全访问。该安全边界是通过项；新账号的完整文件操作浏览器验收未执行。
- 原有 Wallpaper Engine renderWeIcon 在开发模式有 React SVG 属性/key 警告，页面可用；本轮不改外部插件源码，不声称控制台零警告。

截图：isolated-super-admin-browser.jpg、work-browser.jpg、work-mobile.jpg、work-short.jpg、settings-browser.jpg、storage-browser.jpg，均位于根 dist/.tmp/xiaoyu-agent。最终页面保持可继续查看。

## 独立环境新超级管理员（用户确认后完成）

用户明确选择“仅在独立验收环境创建，不改变现有账号权限”。使用原正式 CLI 的 web --no-local-daemon，以显式 LFAA_DATA_DIR=C:/Users/yu/.lfaa/xiaoyu-acceptance/data、SERVER_PORT=3315、SERVER_HOST=127.0.0.1 启动同一产品，未复制第二套实现。这个目录是本次隔离验收明确指定的自定义根，不是产品默认位置，也未改变 H:/LFAA1/data。

正常 POST /api/auth/setup 返回 201，Identity Owner 创建独立新账号 xiaoyu_super_admin_20261015（ID 024188b5-ab8a-4d61-8728-d49236344b7e，UID 1，role=super_admin）。随后在内置浏览器通过正常登录页输入已创建凭据，实际页面显示“超级管理员”。再次读取 setup-status 已为 requiresSetup=false；只读数据库确认独立环境恰有一位超级管理员、没有 Daemon 节点，未触碰既有游戏。

访问地址为 http://localhost:3315/。原环境保留 http://127.0.0.1:3000/，使用不同主机名避免两个端口共用同名登录 Cookie；原环境浏览器仍保持原账号登录。两库用户字段核对表明：yubboo 仍为原项目唯一 super_admin，先前创建的 xiaoyu_admin_20261015 仍为 admin；本轮没有转交、提升、降级或删除原项目账号。独立账号不继承原项目的 Provider、密钥、权限设置或会话。

初始密码只交付用户，不写入源代码、报告或新增明文凭据文件。此前被策略拒绝清理的临时文件仍保留原记录，本轮未重试或换方式清理。独立正式服务保留运行，便于用户继续验收。

新证据位于根 dist/.tmp/xiaoyu-agent/isolated-super-admin-evidence.json（不含密码/Token）与 isolated-super-admin-browser.jpg。设置仅使用显式验收数据根/端口/回环地址与原默认账户配置；未修改权限模式、Provider 或产品默认/推荐存储根。此次仅更新任务合同、架构事实、开发进度和本验收报告四份文档，不修改产品源码；正常 API 创建、持久化、浏览器登录/角色与原账号权限隔离通过。未重复运行上一轮 58/59 项回归、类型或包构建；本轮运行工作区/差异与既有构建指纹核对。

未运行：新账号真实 Provider 对话（无其自己的模型配置）、旧账号历史会话的浏览器续聊（正常回归已验证合同）、真实专家子 Agent 委派、任意第三方插件/模组、桌面封装/设备/帧时间/公网客户端验收。workspace-preflight 根脚本不存在，未运行。H:\LFAA1 登记可用于项目文件；Git 摘要因仓库包含 Daemon 数据目录被原安全围栏拒绝，未绕过、未声称 Git/Worktree 实机验收通过。四类开服与正常停止已经通过，不扩大为所有相关能力已验。

## 本轮全部变更文件

以下 69 个文件是与任务开始哈希相比的本轮源码/合同/测试变更；以前包职责与文件管理任务的完整清单仍见各自报告。运行数据、正式构建与证据分别列在上述 Owner 路径，不进入 Git 源码清单。

| 绝对路径（当前工作副本） | 职责 |
| --- | --- |
| [H:/LFAA1/apps/cli/tests/fixtures/xiaoyu-shared-api.mjs](../../apps/cli/tests/fixtures/xiaoyu-shared-api.mjs) | 长期测试子进程场景，不进入产品装配 |
| [H:/LFAA1/apps/cli/tests/package-owner-lazy-capabilities.test.mjs](../../apps/cli/tests/package-owner-lazy-capabilities.test.mjs) | 初始元数据/正文按需加载与共享引用回归 |
| [H:/LFAA1/apps/cli/tests/workspace-projects.test.mjs](../../apps/cli/tests/workspace-projects.test.mjs) | 共享同账户项目与实际 schema/隔离回归 |
| [H:/LFAA1/apps/cli/tests/xiaoyu-shared-agent.test.mjs](../../apps/cli/tests/xiaoyu-shared-agent.test.mjs) | 共享路由、严格引用、JSONL 分支和节点过期回归 |
| [H:/LFAA1/apps/cli/tests/xiaoyu-shared-api.test.mjs](../../apps/cli/tests/xiaoyu-shared-api.test.mjs) | 正常认证 API 与真实 Profile 的隔离回归入口 |
| [H:/LFAA1/docs/PROMPTS.md](../../docs/PROMPTS.md) | 任务合同、索引和实际完成/未验状态 |
| [H:/LFAA1/docs/development/file-resources-20261014.md](../../docs/development/file-resources-20261014.md) | 保留前任务历史，追加本轮统一复验证据 |
| [H:/LFAA1/docs/development/xiaoyu-agent-20261015.md](../../docs/development/xiaoyu-agent-20261015.md) | 本轮逐文件、设置、真实验收与剩余动作交付记录 |
| [H:/LFAA1/docs/development/xiaoyu-agent.md](../../docs/development/xiaoyu-agent.md) | 英文入口导读 |
| [H:/LFAA1/docs/development/xiaoyu-agent.zh.md](../../docs/development/xiaoyu-agent.zh.md) | 实现前登记的完整开发提示词与验收边界 |
| [H:/LFAA1/docs/harness-packages.json](../../docs/harness-packages.json) | 生成包职责清单 |
| [H:/LFAA1/docs/harness-packages.md](../../docs/harness-packages.md) | 生成逐目录职责导读 |
| [H:/LFAA1/docs/开发计划.md](../../docs/开发计划.md) | 共享入口及统一验收进度 |
| [H:/LFAA1/docs/系统总体架构.md](../../docs/系统总体架构.md) | 共享工作与真实 Owner 的当前架构事实 |
| [H:/LFAA1/packages/api/remotes/README.md](../../packages/api/remotes/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/api/remotes/src/route-contracts.ts](../../packages/api/remotes/src/route-contracts.ts) | 严格引用校验与真实 Daemon 文件能力心跳登记 |
| [H:/LFAA1/packages/api/session-controller/README.md](../../packages/api/session-controller/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/api/session-controller/src/index.ts](../../packages/api/session-controller/src/index.ts) | 认证且空闲的会话关联写入 API |
| [H:/LFAA1/packages/api/settings-controller/README.md](../../packages/api/settings-controller/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/api/settings-controller/package.json](../../packages/api/settings-controller/package.json) | 声明该包所用真实依赖和根 dist 构建入口 |
| [H:/LFAA1/packages/api/settings-controller/src/index.ts](../../packages/api/settings-controller/src/index.ts) | 只返回可发现 Skill 摘要，不暴露路径/正文 |
| [H:/LFAA1/packages/api/workspace-controller/README.md](../../packages/api/workspace-controller/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/api/workspace-controller/src/index.ts](../../packages/api/workspace-controller/src/index.ts) | 共享账户项目 API，保持真实来源/节点/权限校验 |
| [H:/LFAA1/packages/bundle/web-app/README.md](../../packages/bundle/web-app/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/bundle/web-app/cordis.patch.yml](../../packages/bundle/web-app/cordis.patch.yml) | 原 Web Bundle 的 Skill 服务装配 |
| [H:/LFAA1/packages/client/connection/README.md](../../packages/client/connection/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/client/connection/src/api.ts](../../packages/client/connection/src/api.ts) | 关联/Skill 摘要的原 Connection SDK 合同 |
| [H:/LFAA1/packages/client/ui-chat/README.md](../../packages/client/ui-chat/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/client/ui-chat/package.json](../../packages/client/ui-chat/package.json) | 声明该包所用真实依赖和根 dist 构建入口 |
| [H:/LFAA1/packages/client/ui-chat/src/AiWorkChat.tsx](../../packages/client/ui-chat/src/AiWorkChat.tsx) | 可选应用/能力引用、原会话续用及共享项目输入 |
| [H:/LFAA1/packages/client/ui-chat/src/WorkspaceProjectPicker.tsx](../../packages/client/ui-chat/src/WorkspaceProjectPicker.tsx) | 账户项目选择、目录登记与显式节点刷新 |
| [H:/LFAA1/packages/client/ui-chat/src/ai-work-chat.css](../../packages/client/ui-chat/src/ai-work-chat.css) | 关联控件随容器换行、短屏整体滚动 |
| [H:/LFAA1/packages/client/ui-layout/README.md](../../packages/client/ui-layout/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/client/ui-layout/src/GameLibraryPage.tsx](../../packages/client/ui-layout/src/GameLibraryPage.tsx) | 游戏库常规入口与共享小鱼按钮 |
| [H:/LFAA1/packages/client/ui-layout/src/Workbench.tsx](../../packages/client/ui-layout/src/Workbench.tsx) | 唯一工作入口、单份会话/草稿、通知与默认首页消费 |
| [H:/LFAA1/packages/client/ui-renderer/README.md](../../packages/client/ui-renderer/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/client/ui-renderer/src/App.tsx](../../packages/client/ui-renderer/src/App.tsx) | 共享路由与正常 App 入口保护、导航写入顺序 |
| [H:/LFAA1/packages/client/ui-renderer/src/workbench-preload.ts](../../packages/client/ui-renderer/src/workbench-preload.ts) | 预热共享工作代码 |
| [H:/LFAA1/packages/client/ui-settings/README.md](../../packages/client/ui-settings/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/client/ui-settings/src/SettingsPage.tsx](../../packages/client/ui-settings/src/SettingsPage.tsx) | 应用/工作默认首页及原设置中心映射 |
| [H:/LFAA1/packages/client/ui-sidebar-files/README.md](../../packages/client/ui-sidebar-files/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/client/ui-sidebar-files/src/FileManagerPage.tsx](../../packages/client/ui-sidebar-files/src/FileManagerPage.tsx) | 文件页共享工作导航；原文件 Owner 保持 |
| [H:/LFAA1/packages/client/ui-sidebar/README.md](../../packages/client/ui-sidebar/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/client/ui-sidebar/src/GlobalNavigationRail.tsx](../../packages/client/ui-sidebar/src/GlobalNavigationRail.tsx) | 统一工作入口和会话导航显示 |
| [H:/LFAA1/packages/client/ui-workspace/README.md](../../packages/client/ui-workspace/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/client/ui-workspace/src/ApplicationWorkspace.tsx](../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx) | 账户项目/会话查询、真实能力目录及请求取消 |
| [H:/LFAA1/packages/core/agent-loop/README.md](../../packages/core/agent-loop/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/core/agent-loop/src/execute-turn.ts](../../packages/core/agent-loop/src/execute-turn.ts) | 模型参考引用和真实共享项目上下文；按需加载不变 |
| [H:/LFAA1/packages/core/agent-loop/src/runs.ts](../../packages/core/agent-loop/src/runs.ts) | 原主/子 Run 共享项目与可选引用接入 |
| [H:/LFAA1/packages/core/session/README.md](../../packages/core/session/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/core/session/package.json](../../packages/core/session/package.json) | 声明该包所用真实依赖和根 dist 构建入口 |
| [H:/LFAA1/packages/core/session/src/kernel.ts](../../packages/core/session/src/kernel.ts) | JSONL 关联事件校验 |
| [H:/LFAA1/packages/core/session/src/known-event-types.ts](../../packages/core/session/src/known-event-types.ts) | 唯一已知事件清单登记关联事件 |
| [H:/LFAA1/packages/core/session/src/sessions.ts](../../packages/core/session/src/sessions.ts) | 关联持久化、空闲/账户约束与分支时点继承 |
| [H:/LFAA1/packages/core/system-prompt/README.md](../../packages/core/system-prompt/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/core/system-prompt/src/index.ts](../../packages/core/system-prompt/src/index.ts) | 小鱼统一身份与参考来源，不自动加载领域正文 |
| [H:/LFAA1/packages/host/daemon/README.md](../../packages/host/daemon/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/host/daemon/src/local-daemon.ts](../../packages/host/daemon/src/local-daemon.ts) | 详情与列表统一心跳有效期 |
| [H:/LFAA1/packages/host/webserver/README.md](../../packages/host/webserver/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/host/webserver/src/server.ts](../../packages/host/webserver/src/server.ts) | 正式 Host 注入实际 Skill Owner |
| [H:/LFAA1/packages/preset/agent-preset/README.md](../../packages/preset/agent-preset/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/preset/agent-preset/src/builtin-catalog.ts](../../packages/preset/agent-preset/src/builtin-catalog.ts) | 主 Agent 显示名；稳定 ID 不变 |
| [H:/LFAA1/packages/skill/minecraft/README.md](../../packages/skill/minecraft/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/skill/minecraft/assets/minecraft-server-setup/SKILL.md](../../packages/skill/minecraft/assets/minecraft-server-setup/SKILL.md) | 原 Minecraft Skill 的通用发现、真实执行和插件/模组边界 |
| [H:/LFAA1/packages/util/values/README.md](../../packages/util/values/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/packages/util/values/src/agent-associations.ts](../../packages/util/values/src/agent-associations.ts) | 纯引用的类型、长度、数量与唯一性约束 |
| [H:/LFAA1/packages/util/values/src/application-id.ts](../../packages/util/values/src/application-id.ts) | 共享 /work 与旧工作路由兼容合同 |
| [H:/LFAA1/packages/workspace/workspace/README.md](../../packages/workspace/workspace/README.md) | 受影响包的唯一 Owner、共享消费者与装配/验收边界 |
| [H:/LFAA1/pnpm-lock.yaml](../../pnpm-lock.yaml) | 同步真实包依赖，不另建实现 |
