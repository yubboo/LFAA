# LFAA-AGENT-ASSET-LIBRARY-20261027

<a id="lfaa-agent-asset-library-20261027"></a>

## 目标

AI Work 右侧菜单增加“资产库”，显示当前 Agent Git 项目中由 Agent 明确登记的最终产物，并提供原文件下载。Git 继续管理源代码、构建配置和差异；资产库只登记交付文件的元数据与来源，不复制源码、不把每项文件变更都当成交付物。

Agent 按用户目标和真实可用能力完成工作。需要 Minecraft 插件 JAR 时，小鱼可委派已登记的 `expert.minecraft-hosting`，由 Agent 检查项目和本机真实构建环境、生成/验证 JAR，并在文件确实存在后调用发布工具登记。没有构建工具、依赖或成功结果时必须如实报告，资产库不得制造“成功”记录。

## Owner 与边界

- `packages/deliverables/workspace-changes` 是账户隔离的产物登记 Owner：保存稳定资产 ID、账户、会话、Agent Git 仓库、项目相对路径、显示名、文件摘要、大小和登记时间；同一仓库同一路径重复发布更新现有条目，不保存二进制副本。
- `packages/deliverables/tool-present` 登记 `deliverable_publish` Agent Tool。它只接受当前 Run 注入的本机 Agent Git 根目录和安全相对路径，复用 Project Files Owner 核验真实普通文件、大小与 SHA-256，再登记元数据；风险经现有 Permission Owner 判为写操作，不新增权限模式。
- `packages/host/project-files` 持有产物文件的路径、符号链接、数据根隔离及流式读取校验。下载必须按账户验证 Agent Git 仓库和产物记录，不能接受客户端绝对路径。
- `packages/api/agent-git-controller` 适配账户认证、资产列表和附件下载；`packages/client/connection` 只封装这些 API。
- `packages/client/ui-deliverables` 提供独立呈现界面；`packages/client/ui-workspace` 只装配 AI Work 右侧工具入口、活动仓库和响应式容器。
- SQLite 迁移 74 保存登记元数据。无新设置项；复用当前工作区/Agent Git 会话、账户认证、`permissions.mode` 和 Appearance 共享样式令牌。

## 验收

1. Agent 只能发布当前会话已绑定的本机 Agent Git 项目内现存普通文件；越界、符号链接、目录、数据目录、超大文件和缺失文件都拒绝，失败不产生记录。
2. 登记只含项目相对路径和元数据；替换同路径文件后重新发布刷新摘要、大小和时间。不同账户不可列出或下载彼此资产。
3. 右侧菜单可打开“资产库”；按当前 Agent Git 仓库展示真实名称、文件类型、大小、登记时间与来源会话；无仓库/无产物/项目目录离线/文件已移动或删除均有准确状态。点击下载流式返回原文件；验证 JAR 文件名、长度和字节摘要。
4. 资产库仅展示 Agent 明确发布的最终产物；Git 变更列表和源码审阅不改变。对话开始但无可发布文件时显示空状态。
5. 直接回归覆盖账户隔离、边界校验、重复发布、删除/移动文件后的下载失败、流式字节完整性与界面状态；执行受影响包构建、类型/差异检查及 `sync:workspace` / `check:workspace`。
6. 用正式当前源码启动 Web，在内置浏览器 `/work` 检查常用桌面、窄分栏和短屏的入口、列表、空状态及真实下载交互；截图和运行版本指纹记入本合同。真实 Provider 或真实 Minecraft 插件构建不是本轮验收前提，不得宣称已测。

## 非目标

- 不把项目源码从 Git 移到资产库，不建立第二套版本控制。
- 不自动猜测并收集任意输出目录，不将通用 `project.files` 文件变更摘要等同于发布记录。
- 不新增 Maven/Gradle/JDK 下载器或 Minecraft 专用固定打包流程；编译仍由 Agent 基于用户项目和当前可用工具决策执行。
- 不将产物打包进会话迁移归档；项目文件仍由用户单独迁移并重连。

## 实施与验证记录

- 2026-10-27：核实 `expert.minecraft-hosting` 已登记；当前 AI Work 右侧工具工作区含 Git/应用/侧聊及扩展页，Session 文件变更摘要只显示修改/读取路径，没有发布登记和通用二进制下载；三个 `deliverables`/`ui-deliverables` 目录仍是不可执行占位。未修改产品源码，正在按以上 Owner 边界实现。
- 最终验证：待完成。
