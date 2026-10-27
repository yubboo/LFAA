# LFAA-CHATGPT-STYLE-MULTI-PROJECTS-20261027：ChatGPT 式多项目管理

## 用户目标

让 LFAA AI Work 按截图提供 ChatGPT Projects 式多项目管理：侧栏项目入口支持新建、选择和管理多个项目；用户选择一个本机父目录作为工作区分组，LFAA 本机 Host 在该目录下创建以项目名命名的项目文件夹。项目以名称归组会话，可关联多个额外本机源文件夹，可编辑项目指令，并选择“默认记忆”或“仅限项目的记忆”。主项目文件夹作为固定工作根；额外源文件夹只关联既有目录，不复制、移动或删除用户内容。

## Owner、入口与边界

- 运行入口：`/work` → `ui-workspace/ApplicationWorkspace` 的会话侧栏与项目导航 → Client Connection → 认证 Workspace Controller → `packages/workspace/workspace` 项目 Owner；源文件夹浏览、核验和文件访问经 `packages/host/project-files` 的 LFAA 本机 Host。
- 项目登记与物理项目文件夹由不同 Owner 持有：Workspace Owner 持久化项目名称、项目主目录、项目指令、记忆范围和额外源目录；Session Owner 持久化会话的项目归属。创建项目必须先选择现有本机父目录，Host 在其中创建项目同名文件夹，并把主目录固定为首个项目根。
- 新建、选择、编辑项目和浏览/创建本机目录不要求在线 Daemon，不查询节点、不派发 Daemon 任务、不创建/绑定 `nodeId`。Web 的目录浏览经认证 API 调用当前 LFAA Host；Electron/Tauri 可用原生文件夹选择器，再由同一 Host 核验。缺少本机 Host 时明确失败，不回退到 Daemon 或默认工作区。
- 项目文件工具只把当前项目已关联并由 LFAA 本机 Host 再次核验的目录作为该项目受信任根；模型明确选中一个根后在该根内操作。不得因没有关联目录而静默回退到默认 `general.taskFolder`。保留既有认证、Permission Owner、Host 路径/符号链接/data 根校验和 Agent Git 所有权。
- “默认记忆”沿用现有账户个性化记忆设置及授权，让项目会话按同一账户政策读取/更新账户记忆；“仅限项目的记忆”隔离账户记忆，只允许在同一项目内积累和提供记忆。项目记忆与会话所属项目需在服务端按当前账户校验；更改范围不重写历史会话。是否允许真正的云端工作继续遵循系统现有 Host/执行能力，不以 UI 标记伪造能力。
- 外观沿用现有 Appearance/Workbench 共享令牌；权限沿用设置中心 `permissions.mode`；账户记忆是否启用及工具对话记忆是否可保存沿用 `personalization.memoryEnabled`、`personalization.memoryFromToolChats`。项目记忆模式属于项目数据，不新增一份设置中心偏好。
- AI Work 新项目和项目管理不允许绑定 Daemon；旧节点项目数据保留作历史兼容，但不会出现在新的 AI Work 项目搜索、选择、更新和文件夹浏览流程中。Minecraft 仍沿用自己的节点目录流程。只在用户选定的父目录下新建项目文件夹；不改动已有同名文件夹，不复制、移动或删除既有目录内容，不更改默认工作区身份、已有文件、会话历史或权限偏好。

## 验收条件

1. AI Work 侧栏有独立的项目管理入口，能展示多个项目并将相关聊天归组；创建时选择本机工作区父目录，LFAA Host 在其下按项目名创建独立项目文件夹。
2. 项目主目录作为固定工作根；创建/编辑项目可通过本机文件夹选择器添加多个额外现有目录，编辑时只能增删额外目录，移除项目登记不删除磁盘内容。路径大小写按实际系统路径保存，产品自己的目录命名使用小写 `lfaa`。
3. 创建后可直接把项目设为当前项目或为其新建会话；刷新后项目和会话分组仍存在。改名/改项目指令/增删来源不会丢失聊天。
4. 设置“默认记忆”时，账户记忆仍受现有账户设置约束；设置“仅限项目的记忆”时不得读取或写入账户级记忆，项目记忆不会泄漏到其他项目或无项目聊天；项目记忆只由同项目会话更新。
5. 所有项目 CRUD 与目录关联均有账户隔离和服务端校验；本机目录操作经 Project Files Host；此流程不查询节点列表、不派发 Daemon 任务、不写入任何节点 ID。
6. 运行项目 Owner/Controller/Session/Agent 项目根定向回归及受影响 Client 类型和构建。Web/Desktop 共用 UI 需按开发规范启动当前源码 Web 服务，并在 ChatGPT 内置浏览器 `/work` 验证项目菜单、新建、选择文件夹、编辑/移除来源、会话归组及窄分栏/短屏；逐批记录视口、交互、截图及未测范围。

## 实施与验收记录

### 实施批次

1. **项目与目录 Owner / API**：新增项目元数据、项目记忆和多源本机目录结构；创建、搜索、编辑和目录浏览都由 LFAA 本机 Host 支持，AI Work 路由拒绝节点绑定。数据库迁移、Owner/API 定向回归和 Control Plane 构建已完成。
2. **Agent 项目上下文 / 文件审阅**：会话归属指向逻辑项目；工具根限定于已登记源文件夹；活动记录以稳定源目录 ID 让多根项目文件准确返回原根审阅。Session/Agent/文件工具相关定向回归均已完成。
3. **项目管理 UI**：侧栏项目入口、创建/编辑、项目说明、记忆范围、本机父目录选择、额外目录浏览/附加、移除与会话归组；原实页只覆盖逻辑项目流程，本轮补验父目录下实际创建项目文件夹。
4. **文档和最终验证**：Owner README/系统架构和本合同已更新。项目/Host 直接回归 10/10 通过；之前的项目、Session、Agent 联合回归 34/34 通过；Control Plane 当前构建通过。项目源码对应的上一版 Web 构建已通过并完成真实页面验收；随后共享工作区 Appearance 修改导致当前 Web 源码构建失败，不能声称当前 Web 构建通过。隔离账户没有配置模型，因此没有实发 AI 会话。

### 实施进度

- 已完成源码实现：迁移 v70、项目目录/项目记忆/多源目录 Owner、Workspace Controller 本机路由、AI Work 项目管理器、侧栏项目分组和源目录文件审阅传递。创建时必须选父目录，Host 新建项目同名文件夹；项目根固定保留，编辑只增删额外来源。
- 已确认项目 CRUD 的 AI Work 创建接口拒绝 `nodeId` 和节点路径；项目搜索不连接 `daemon_nodes` 表，GET 不列在线 Daemon；历史节点绑定项目不会通过 AI Work 的更新、删除或会话归组接口访问；Minecraft 节点目录 API 独立保留。
- 已补充空项目/空源列表、无节点 ID、多源目录、跨项目共享目录、稳定源 ID、API 仅经本机 Host 核验且不派发 Daemon 任务的回归。Owner、迁移、Session、Agent、本机文件工具及相关集成回归最终 **34/34 通过**；`git diff --check` 通过。
- 构建：Control Plane 构建通过；本机此前一次项目源码 Web 构建通过并用于下方实页验收。之后共享工作区中的 Appearance 设置源码继续变化，最新 `pnpm run build:web` 被 `AppearancePresetsPanel.tsx` 的预设联合类型及 `SettingsPage.tsx` 未使用导入错误阻断；Vite 单独重建也被 `SettingsPage.tsx` JSX 标签不匹配阻断。当前 `node scripts/runtime-build-state.mjs web` 返回 `["web"]`，不能把现有 Web 产物认作当前源码的有效构建。上述错误不在本项目管理改动范围内。之前由项目、Session、Agent 等组成的定向回归 34/34 通过；本轮 `workspace-projects.test.mjs` 与 `project-files.test.mjs` 10/10 通过。构建输出只写入仓库根 `dist/`。为使此前 Host 类型检查通过，另有一处外观预设嵌套类型的纯类型修正，详见变更文件清单。
- ChatGPT 内置浏览器实页：隔离 Home/Data、没有配置/启动 Daemon 的环境打开 `http://127.0.0.1:3000/work`。在 **1280×720** 完成创建及刷新后项目列表核对；项目管理器明确显示“创建项目不需要选择 Daemon”，列表显示新项目与 `D:\Documents\lfaa\default-workspace`。在 **390×844** 检查创建弹窗，内容可滚动至底部，取消与创建操作均在可用视口内，页面无横向溢出。浏览器控制台错误数为 0。
- 真实创建使用隔离父目录 `C:\Users\Administrator\AppData\Local\Temp` 和项目名“项目目录本机复验”；页面显示生成的 `C:\Users\Administrator\AppData\Local\Temp\项目目录本机复验`，本机文件系统确认该路径确为目录，刷新后项目记录仍显示相同路径。服务端以 `--no-local-daemon` 启动；请求日志只有本机项目浏览/创建路由，没有 Daemon 项目浏览路由或 Daemon 任务。截图已由内置浏览器工具捕获并展示在本轮工具结果中，没有另存为文件。
- 实际会话发送因隔离账户没有配置模型而不可用；Session/Agent 项目归组由直接回归覆盖。桌面安装包、真实模型会话、真实用户数据以及设备实测未覆盖。此前 `Failed to fetch` 是隔离 Web 服务退出后再次浏览导致；重启正式 Web 后父目录浏览、创建与刷新验收均通过。
- 本轮没有新增设置中心配置；沿用现有 Appearance/Workbench 主题令牌、`permissions.mode`、`personalization.memoryEnabled` 与 `personalization.memoryFromToolChats`。项目记忆范围作为项目数据单独持久化，不改变账户偏好。

### 2026-10-27 父目录建项目文件夹与本机 Host 边界修正

- 用户明确要求：工作区分组对应用户选择的本机父目录；项目目录是该目录下以项目名创建的独立子文件夹。AI Work 创建/选择项目不能绑定 Daemon，也不能要求先选在线节点。
- 代码审查确认：`workspace` 项目列表显式跳过节点枚举；创建 API 对 `nodeId`/节点 `path` 作合同拒绝，并只调用当前 LFAA Control Plane Host 的 `executeLocalProjectFile` 执行父目录核验与 `create_directory`。该能力由本机 loopback Web/Desktop Host 装配；没有本机 Host 时明确失败，不使用 Daemon 兜底。Minecraft 的节点目录路由保持分离。
- 真实页面与文件系统验收已完成（对应当时成功构建的 Web 产物）：在内置浏览器 `/work` 的 1280×720 视口选择隔离父目录并创建“项目目录本机复验”，项目列表显示完整主目录，本机检查确认子文件夹已创建，刷新后记录仍在；`--no-local-daemon` 下完成，浏览器控制台错误为 0。390×844 弹窗可滚动到底部，无横向溢出。项目和 Host 定向回归 10/10、Control Plane 构建通过。隔离账户无模型，故未发送会话消息；截图在浏览器工具结果中展示，未单独落盘。后续 Appearance 源码变化使当前 Web 指纹过期，最新源码 Web 构建尚未通过，具体见上文。
