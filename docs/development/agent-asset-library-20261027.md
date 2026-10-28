# LFAA-AGENT-ASSET-LIBRARY-20261027

<a id="lfaa-agent-asset-library-20261027"></a>

## 目标

AI Work 右侧菜单增加“资产库”，按当前对话绑定的 Agent Git 项目收纳 Agent 明确登记的最终产物，并提供醒目的 JAR 下载入口。Git 继续管理源代码、构建配置和差异；资产库只登记交付文件的元数据与来源，不复制源码、不把每项文件变更都当成交付物。Minecraft 插件和模组 JAR 要按真实类型分类；当前 UI 仅能显示真实登记/可下载状态，构建通过提示必须有执行器的成功回报支撑。

Agent 按用户目标和真实可用能力完成工作。需要 Minecraft 插件 JAR 时，小鱼可委派已登记的 `expert.minecraft-hosting`，由 Agent 检查项目和本机真实构建环境、生成/验证 JAR，并在文件确实存在后调用发布工具登记。没有构建工具、依赖或成功结果时必须如实报告，资产库不得制造“成功”记录。

## Owner 与边界

- `packages/deliverables/workspace-changes` 是账户隔离的产物登记 Owner：保存稳定资产 ID、账户、会话、Agent Git 仓库、项目相对路径、显示名、Minecraft 插件/模组/其他类型、文件摘要、大小和登记时间；同一仓库同一路径重复发布更新现有条目，不保存二进制副本。
- `packages/deliverables/tool-present` 登记 `deliverable_publish` Agent Tool。它只接受当前 Run 注入的本机 Agent Git 根目录和安全相对路径，复用 Project Files Owner 核验真实普通文件、大小与 SHA-256，再登记元数据；风险经现有 Permission Owner 判为写操作，不新增权限模式。
- `packages/host/project-files` 持有产物文件的路径、符号链接、数据根隔离及流式读取校验。下载必须按账户验证 Agent Git 仓库和产物记录，不能接受客户端绝对路径。
- `packages/api/agent-git-controller` 适配账户认证、资产列表和附件下载；`packages/client/connection` 只封装这些 API。
- `packages/client/ui-deliverables` 提供独立呈现界面；`packages/client/ui-workspace` 只装配 AI Work 右侧工具入口、活动仓库和响应式容器。
- SQLite 迁移 74/75 保存登记元数据和产物类型。资产库只能读取当前对话的仓库绑定，不得回退显示账户的其他项目。无新设置项；复用当前工作区/Agent Git 会话、账户认证、`permissions.mode` 和 Appearance 共享样式令牌。

## 验收

1. Agent 只能发布当前会话已绑定的本机 Agent Git 项目内现存普通文件；越界、符号链接、目录、数据目录、超大文件和缺失文件都拒绝，失败不产生记录。
2. 登记只含项目相对路径和元数据；替换同路径文件后重新发布刷新摘要、大小和时间。不同账户不可列出或下载彼此资产。
3. 右侧菜单可打开“资产库”；严格按当前会话绑定的 Agent Git 仓库展示项目产物，不能显示无关的首个仓库。Minecraft 插件/模组 JAR 在首屏显著呈现直接下载卡片；其他产物按类型归类，并显示真实名称、大小、登记时间与来源会话标题。无仓库/无产物/项目目录离线/文件已移动或删除均有准确状态。点击下载流式返回原文件；验证 JAR 文件名、长度和字节摘要。
4. 资产库仅展示 Agent 明确发布的最终产物；Git 变更列表和源码审阅不改变。对话开始但无可发布文件时显示空状态。
5. 直接回归覆盖账户隔离、边界校验、重复发布、删除/移动文件后的下载失败、流式字节完整性与界面状态；执行受影响包构建、类型/差异检查及 `sync:workspace` / `check:workspace`。
6. 用正式当前源码启动 Web，在内置浏览器 `/work` 检查常用桌面、窄分栏和短屏的入口、列表、空状态及真实下载交互；截图和运行版本指纹记入本合同。真实 Provider 或真实 Minecraft 插件构建不是本轮验收前提，不得宣称已测。若当前项目没有真实已发布 JAR，浏览器只验收空状态与响应式布局，JAR 分类/下载须用 Owner 层回归验证，不造生产假数据。

## 非目标

- 不把项目源码从 Git 移到资产库，不建立第二套版本控制。
- 不自动猜测并收集任意输出目录，不将通用 `project.files` 文件变更摘要等同于发布记录。
- 不新增 Maven/Gradle/JDK 下载器或 Minecraft 专用固定打包流程；编译仍由 Agent 基于用户项目和当前可用工具决策执行。
- 不将产物打包进会话迁移归档；项目文件仍由用户单独迁移并重连。

## 实施与验证记录

- 2026-10-27：核实 `expert.minecraft-hosting` 已登记；当前 AI Work 右侧工具工作区含 Git/应用/侧聊及扩展页，Session 文件变更摘要只显示修改/读取路径，没有发布登记和通用二进制下载；三个 `deliverables`/`ui-deliverables` 目录仍是不可执行占位。
- 2026-10-28：实现按当前对话 Agent Git 绑定归档的资产库、显著的插件/模组 JAR 下载卡、按真实类型分类的其他产物、全部文件列表、二进制下载 API 与 `deliverable_publish` 工具。Minecraft 专家提示要求先核验真实构建结果，成功后才发布 JAR；无 JAR 时不伪造成功状态。SQLite schema 从 74 升到 75，保存产物类型。资产库对未关联 Git 项目的旧会话显示明确空状态，没有退回到账户的首个或其他项目。
- 代码验证：UI 分类回归 2/2；Project Files 边界回归 2/2；相关 Storage、Deliverables、Connection、UI、Workspace、Controller、Domain Expert 包构建通过；Client/Host TypeScript 检查、Control Plane 与正式 Web 构建通过；`git diff --check` 通过。`pnpm sync:workspace` 仍报告原有 7 个无关文档链接/锚点问题（2 个缺失 hover 截图链接和 5 个 PROMPTS 锚点），本任务未改动这些无关文档。
- 浏览器验证：正式 LFAA `/work` 当前源码，内置浏览器桌面 1423×1244 与窄屏 390×640；资产库入口与未关联项目空状态可见，均无页面溢出，浏览器 Console error 0。桌面实页截图在本轮内置浏览器验收中检查；运行版本 `dist/apps/web/build-state.json` fingerprint 为 `02a01348234270c13001318201c983713b69865221f4f94bd9d27f9ec7def540`。本轮没有真实 Agent Git 绑定的 Minecraft 项目/JAR，因此没有真实下载交互或实际 Minecraft 编译验收；没有调用 Provider 或生成付费模型请求。
- 真实状态限制：右侧资产库可下载 Agent 成功编译并明确发布的真实 JAR；没有接入另一套 Maven/Gradle/JDK 安装器或专用构建器。该会话的旧插件任务当时缺少 Maven/JDK，故目前没有可供资产库下载的 JAR。资产库记录登记元数据和 Git 路径，不保存二进制快照，也未实现同路径多版本历史或“下载全部”压缩包。
