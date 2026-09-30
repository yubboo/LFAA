# LFAA Harness 迁移交付记录

> 这是首轮迁移的历史记录，文件路径、哈希及验证对应当时的版本。后续节点入口改名、测试支持发布隔离和临时文件删除以 [本轮整理记录](harness-cleanup.md) 为准；本页提及的临时快照和日志不再作为长期保留文件。

## 结果与当前骨架

本次按用户授权，将现有产品实现迁入对标 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的职责包。目录基准提交为 `639ed015397290b3745d163aafe02ffee4aa3f84`。上游 316 个两级包目录全部原名保留；当前 62 个包含实际代码或装配配置，其余仅用 `.gitkeep` 占位。逐项状态见 [完整目录树](harness-packages.md)。这不是 DSH 全部能力的实现承诺。

```text
H:/LFAA/
├─ apps/
│  ├─ cli/                         命令行、命名配置与开发/生产包加载
│  ├─ web/                         Vite 工具与静态资源
│  ├─ daemon/                      独立节点启动
│  ├─ desktop-electron/            既有 Electron 外壳
│  ├─ desktop-tauri/               既有 Tauri 外壳
│  └─ {desktop,desktop-host}/      上游应用目录占位
├─ packages/
│  ├─ boot/{app-boot,hmr}/         Cordis 启动和开发重载
│  ├─ bundle/{base,web-app,daemon-app}/  普通组合包与补丁
│  ├─ client/
│  │  ├─ {web,modules,connection}/ 浏览器装配、模块登记和 API
│  │  ├─ ui-chat/                  AI Work 聊天与 Markdown
│  │  ├─ ui-commands/              原快捷键匹配
│  │  ├─ ui-settings/              原设置中心主页面
│  │  ├─ ui-settings-{account,general,models}/
│  │  ├─ ui-shortcuts/             快捷键设置控件
│  │  ├─ ui-{renderer,layout,workspace,dockkit}/
│  │  ├─ ui-{sidebar,sidebar-files,primitives,theme}/
│  │  └─ ui-{minecraft,writing}/   LFAA 专属界面
│  ├─ api/                        Gateway 和可撤销控制器
│  ├─ core/{agent,agent-loop,session,tools}/
│  ├─ {settings,storage,identity,credentials}/
│  ├─ interaction/permission-presets/
│  ├─ host/{webserver,daemon}/
│  ├─ games/{minecraft,steamcmd}/
│  ├─ document/writing/
│  ├─ skill/writing/
│  └─ …                           全部上游同名分类和包目录
├─ native/system/                 原 Windows Sandbox Host
├─ server/data/                   历史运行数据，保留原位置
└─ dist/                          唯一构建及中间产物根目录
```

源码已实际迁走。浏览器包通过 `./client` 插件入口登记懒加载模块；API 控制器向 Gateway 登记子 Router，随插件卸载撤销。控制端所有服务与 AI 扩展共用 Context，Daemon 在独立进程使用自己的 Context。Bundle 是普通 workspace 包，Profile 是配置文件，没有另建自定义 Profile/Plugin 源码层。装配顺序为 Bundle 列表、Profile 补丁、可选 Home 补丁、显式 `--patch`；必需行不能由普通补丁停用或替换。

构建路径：能力包 `dist/packages/<领域>/<包>`，Web `dist/frontend`，控制端及节点 JS 树 `dist/server`，原生 Sandbox Host `dist/daemon/target`，桌面 `dist/apps/<外壳>`，临时组装 `dist/.tmp/<用途>`。Tauri 的源码 `gen` 是指向根 `dist/apps/desktop-tauri/gen` 的目录链接，生成文件实际写入根 dist。

## 设置中心配置盘点

没有新增设置项。本次继续使用既有 General、Appearance、Shortcuts、AI Runtime、Permissions、Plugins 共 71 项叶子配置。原类型、默认值、Joi 校验、账户隔离 SQLite 持久化、前端令牌/映射保留；应用偏好、布局栏宽/展开状态、通知及 Provider 账户/模型目录也沿用原实现。数据位置继续使用 `LFAA_DATA_DIR` 和原固定盘/可移动盘解析规则。三个项目权限模式保持原语义，`full_access` 不增加逐项审批。

配置职责：

- [服务端默认值与持久化](../packages/settings/settings/src/service.ts)
- [前端类型](../packages/client/connection/src/api.ts)
- [前端默认值](../packages/client/ui-settings-general/src/default-settings.ts)
- [设置控件](../packages/client/ui-settings/src/SettingsPage.tsx)
- [接口校验](../packages/api/remotes/src/route-contracts.ts) 与 [设置控制器](../packages/api/settings-controller/src/index.ts)
- [主题映射](../packages/client/ui-layout/src/Workbench.tsx) 与 [字体映射](../packages/client/ui-theme/src/fonts.ts)
- [通知偏好](../packages/client/resources/src/notification-runtime.ts)、[布局偏好](../packages/client/ui-dockkit/src/workbench-preferences.ts)、[业务应用偏好](../packages/settings/settings/src/preferences/service.ts)

| 设置路径 | 原默认值 |
|---|---|
| `general.defaultMode` | `"normal"` |
| `general.showServiceStatus` | `true` |
| `general.showBottomPanelControl` | `true` |
| `general.taskFolder` | `""` |
| `general.fileOpenLocation` | `"system"` |
| `general.agentEnvironment` | `"system"` |
| `general.integratedShell` | `"system"` |
| `general.language` | `"system"` |
| `general.defaultFullView` | `true` |
| `general.navigationLayout` | `"three-column"` |
| `general.terminalPosition` | `"bottom"` |
| `general.plainTextEditor` | `true` |
| `general.sendShortcut` | `"enter"` |
| `general.followupBehavior` | `"queue"` |
| `general.popupShortcut` | `""` |
| `general.defaultStandaloneChat` | `false` |
| `general.completionNotification` | `"unfocused"` |
| `general.permissionNotifications` | `true` |
| `general.questionNotifications` | `true` |
| `general.sessionIssueNotifications` | `true` |
| `general.notificationSound` | `"default"` |
| `general.setupReminderEnabled` | `true` |
| `general.confettiEnabled` | `false` |
| `appearance.theme` | `"system"` |
| `appearance.accentColor` | `"#3457d5"` |
| `appearance.sidebarColor` | `"auto"` |
| `appearance.backgrounds.login` | `"forest-bridge-evening"` |
| `appearance.backgrounds.appCenter` | `"cherry-blossom-shore"` |
| `appearance.backgrounds.steamcmd` | `"ocean-cliff-sunset"` |
| `appearance.backgrounds.minecraft` | `"cherry-blossom-village"` |
| `appearance.backgrounds.writing` | `"snowy-cabin-interior"` |
| `appearance.backgrounds.settings` | `"lakeside-pagoda-morning"` |
| `appearance.overlay` | `37` |
| `appearance.blur` | `14` |
| `appearance.advanced.interfaceFontSize` | `14` |
| `appearance.advanced.codeFontSize` | `12` |
| `appearance.advanced.reducedMotion` | `"system"` |
| `appearance.advanced.separateModes` | `false` |
| `appearance.advanced.fonts.interface` | `"system"` |
| `appearance.advanced.fonts.content` | `"system"` |
| `appearance.advanced.fonts.code` | `"system"` |
| `appearance.advanced.modeStyles.light.accentColor` | `"#3457d5"` |
| `appearance.advanced.modeStyles.light.fonts.interface` | `"system"` |
| `appearance.advanced.modeStyles.light.fonts.content` | `"system"` |
| `appearance.advanced.modeStyles.light.fonts.code` | `"system"` |
| `appearance.advanced.modeStyles.dark.accentColor` | `"#3457d5"` |
| `appearance.advanced.modeStyles.dark.fonts.interface` | `"system"` |
| `appearance.advanced.modeStyles.dark.fonts.content` | `"system"` |
| `appearance.advanced.modeStyles.dark.fonts.code` | `"system"` |
| `appearance.advanced.translucentSidebar` | `false` |
| `appearance.advanced.contrast` | `60` |
| `appearance.advanced.diffMarkers` | `"color"` |
| `appearance.advanced.pointerCursor` | `false` |
| `shortcuts.openSettings` | `["Ctrl+,"]` |
| `shortcuts.openHome` | `["Alt+0"]` |
| `shortcuts.openSteamcmd` | `["Ctrl+Alt+1"]` |
| `shortcuts.openMinecraft` | `["Ctrl+Alt+2"]` |
| `shortcuts.openWriting` | `["Ctrl+Alt+3"]` |
| `shortcuts.toggleSidebar` | `["Ctrl+B"]` |
| `shortcuts.toggleContextPanel` | `["Ctrl+Alt+B"]` |
| `shortcuts.toggleBottomPanel` | `["Ctrl+J"]` |
| `shortcuts.openTerminal` | `["Ctrl+`"]` |
| `shortcuts.switchNormalMode` | `["Alt+1"]` |
| `shortcuts.switchAiWorkMode` | `["Alt+2"]` |
| `aiRuntime.speed` | `"balanced"` |
| `aiRuntime.promptSuggestions` | `true` |
| `aiRuntime.showContextUsage` | `false` |
| `aiRuntime.requestTimeoutSeconds` | `90` |
| `aiRuntime.maxOutputTokens` | `2048` |
| `permissions.mode` | `"ask"` |
| `plugins.enabled` | `false` |

## 实际验证

| 执行内容 | 实际结果 |
|---|---|
| `pnpm install --offline --ignore-scripts` | 68 个工作区项目的锁文件与依赖解析完成；存在已有 peer/deprecated 提示 |
| `pnpm run build:harness` | 62 个能力包构建通过，输出只在根 `dist/packages` |
| `pnpm run build:server` | TypeScript 编译通过，输出根 `dist/server` |
| `pnpm run build:frontend` | TypeScript 与 Vite 通过，1619 个模块，输出根 `dist/frontend` |
| `pnpm run build:daemon` | 原生 Sandbox Host release 构建及节点语法检查通过，输出根 `dist/daemon/target` |
| Tauri `cargo check` 与 `cargo check --release` | debug、release 均通过；release 有 1 处既有 unused_mut 警告；未生成安装包 |
| 编译后插件生命周期隔离检查 | HTTP 200，控制器动态登记 200、卸载后 404；关闭 HTTP、撤销共享服务；Daemon 配置启动与关闭通过 |
| 源码入口与补丁检查 | 移出旧依赖后源码包解析及 Web Profile 启动通过；停用必需 storage 的补丁被拒绝 |
| Electron 生产依赖部署与运行树组装 | 独立运行树启动通过；HTTP、静态页面、账户、外观设置保存/读取与 Daemon 配置通过，不依赖源码工作区 |
| Electron Windows x64 未安装打包 | `electron-builder --win --x64 --dir` 通过，产物 `H:/LFAA/dist/apps/desktop-electron/win-unpacked/`；实际包内 Node、HTTP、页面和 Daemon 配置运行通过；未执行安装或 GUI 启动 |
| 浏览器隔离账户查看 | 应用中心、设置中心、写作页面可加载；写作页未捕获浏览器 error 日志；外观映射读数为 dark、强调色 #8956bb、serif 字体、界面 16px、代码 15px、遮罩 42%、模糊 9px、对比度增量 5%、减少动态 on，壁纸 URL 沿用原资源 |
| 迁移前后合同核对 | 316 个上游目录齐全；114 个路由语句、16 份 CSS、数据库实现、前后端默认值保持原内容（忽略注释、导入和换行）；包依赖无循环 |
| `pnpm test` | 17 项：12 通过、5 失败；不是全绿 |
| JS 语法、PowerShell 解析、`git diff --check` | 通过 |
| 迁移后源码备份 | `H:/LFAA/dist/backups/LFAA 0.1.1 (2).zip`，3,316 个文件、36.85 MB，ZIP 文件数量/总大小校验通过；排除根 dist、依赖、活动与历史数据、真实 .env 和目录链接 |

### 既有验证失败

迁移前原源码快照复现同样的 5 项失败：v8 两个数据库夹具缺少 `ai_accounts`，v10 夹具缺少 `updated_at`，v22 夹具缺少 `ai_messages`，实时节点夹具未提供 `dataRoot`，SQLite 第 6 个绑定参数无值。本次没有更改数据库迁移链来掩盖这些失败。原始和本次日志保留在 `H:/LFAA/dist/.tmp/`。

真实游戏安装/启动、实际 Provider 推理、Windows Hello、完整浏览器交互、桌面 GUI 和两个外壳的安装包验收未执行。Electron 已生成未安装封装目录，Tauri 只做了编译检查。所有运行检查使用根 dist 中的隔离数据目录，没有改动用户数据库和设置。

### 旧目录保留与自动审核

自动审批审核拒绝了删除旧依赖缓存，只返回 `blocked by policy`，未给出具体原因。随后采用保留文件的可逆归档：旧依赖和空源码目录完整移至 `H:/LFAA/dist/.tmp/harness-legacy-directories/`，没有删除它们。原源码快照在 `H:/LFAA/dist/.tmp/harness-migration-original/`。原 `server/data`、活动数据目录及用户 Home 中的数据保留原位置。本次前已存在的临时 SQLite 和失败 ZIP 也未清理。

## 每个变更文件的绝对路径、职责与改动

以下列出整个迁入源码树、全部目录占位，以及相对迁移快照有变化的原有文件，保留此前未提交的工作。快照建立期间已经生成的目录占位也完整列入；未改动的原有其他文件不列为本次修改。机器可读完整清单见 [harness-migration-files.json](harness-migration-files.json)。新报告本身不记录自引用哈希。旧位置的删除/迁出单列于表后。

| 绝对路径 | 职责 | 本次改动 | 原位置 |
|---|---|---|---|
| [H:/LFAA/.env.example](<H:/LFAA/.env.example>) | 架构规范、开发说明或构建/运行路径规则 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/.gitignore](<H:/LFAA/.gitignore>) | 架构规范、开发说明或构建/运行路径规则 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/cli/config/profiles/daemon/package.json](<H:/LFAA/apps/cli/config/profiles/daemon/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/cli/config/profiles/desktop/package.json](<H:/LFAA/apps/cli/config/profiles/desktop/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/cli/config/profiles/web/package.json](<H:/LFAA/apps/cli/config/profiles/web/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/cli/data/ai-runtime-smoke/credentials/jwt-secret](<H:/LFAA/apps/cli/data/ai-runtime-smoke/credentials/jwt-secret>) | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/cli/data/ai-runtime-smoke/database/lfaa.sqlite](<H:/LFAA/apps/cli/data/ai-runtime-smoke/database/lfaa.sqlite>) | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/cli/package-loader.mjs](<H:/LFAA/apps/cli/package-loader.mjs>) | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/cli/package.json](<H:/LFAA/apps/cli/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/package.json |
| [H:/LFAA/apps/cli/register-package-loader.mjs](<H:/LFAA/apps/cli/register-package-loader.mjs>) | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/cli/src/index.ts](<H:/LFAA/apps/cli/src/index.ts>) | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/cli/tests/data-directory.test.mjs](<H:/LFAA/apps/cli/tests/data-directory.test.mjs>) | 迁入的既有验证用例，仅调整包导入与位置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/test/data-directory.test.mjs |
| [H:/LFAA/apps/cli/tests/database-migrations.test.mjs](<H:/LFAA/apps/cli/tests/database-migrations.test.mjs>) | 迁入的既有验证用例，仅调整包导入与位置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/test/database-migrations.test.mjs |
| [H:/LFAA/apps/cli/tests/file-manager-api.test.mjs](<H:/LFAA/apps/cli/tests/file-manager-api.test.mjs>) | 迁入的既有验证用例，仅调整包导入与位置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/test/file-manager-api.test.mjs |
| [H:/LFAA/apps/cli/tests/minecraft-task-leases.test.mjs](<H:/LFAA/apps/cli/tests/minecraft-task-leases.test.mjs>) | 迁入的既有验证用例，仅调整包导入与位置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/test/minecraft-task-leases.test.mjs |
| [H:/LFAA/apps/cli/tests/realtime-socket.test.mjs](<H:/LFAA/apps/cli/tests/realtime-socket.test.mjs>) | 迁入的既有验证用例，仅调整包导入与位置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/test/realtime-socket.test.mjs |
| [H:/LFAA/apps/cli/tsconfig.json](<H:/LFAA/apps/cli/tsconfig.json>) | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/daemon/package.json](<H:/LFAA/apps/daemon/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/daemon/package.json |
| [H:/LFAA/apps/daemon/src/index.mjs](<H:/LFAA/apps/daemon/src/index.mjs>) | 独立节点进程入口及原生 Host 构建 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/desktop-electron/package.json](<H:/LFAA/apps/desktop-electron/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/desktop-electron/scripts/prepare-runtime.mjs](<H:/LFAA/apps/desktop-electron/scripts/prepare-runtime.mjs>) | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/desktop-electron/src/main.mjs](<H:/LFAA/apps/desktop-electron/src/main.mjs>) | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/desktop-electron/src/preload.cjs](<H:/LFAA/apps/desktop-electron/src/preload.cjs>) | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/desktop-tauri/scripts/package-windows.mjs](<H:/LFAA/apps/desktop-tauri/scripts/package-windows.mjs>) | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/desktop-tauri/src-tauri/build.rs](<H:/LFAA/apps/desktop-tauri/src-tauri/build.rs>) | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/desktop-tauri/src-tauri/src/main.rs](<H:/LFAA/apps/desktop-tauri/src-tauri/src/main.rs>) | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/web/index.html](<H:/LFAA/apps/web/index.html>) | Web 开发入口、Vite 与类型检查配置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/index.html |
| [H:/LFAA/apps/web/package.json](<H:/LFAA/apps/web/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/package.json |
| [H:/LFAA/apps/web/public/backgrounds/minecraft-world.jpg](<H:/LFAA/apps/web/public/backgrounds/minecraft-world.jpg>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/backgrounds/minecraft-world.jpg |
| [H:/LFAA/apps/web/public/backgrounds/service-room.jpg](<H:/LFAA/apps/web/public/backgrounds/service-room.jpg>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/backgrounds/service-room.jpg |
| [H:/LFAA/apps/web/public/backgrounds/steamcmd-world.jpg](<H:/LFAA/apps/web/public/backgrounds/steamcmd-world.jpg>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/backgrounds/steamcmd-world.jpg |
| [H:/LFAA/apps/web/public/backgrounds/writing-desk.jpg](<H:/LFAA/apps/web/public/backgrounds/writing-desk.jpg>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/backgrounds/writing-desk.jpg |
| [H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-shore.png](<H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-shore.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/cherry-blossom-shore.png |
| [H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-village.png](<H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-village.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/cherry-blossom-village.png |
| [H:/LFAA/apps/web/public/images/minecraft/flower-meadow-castle.png](<H:/LFAA/apps/web/public/images/minecraft/flower-meadow-castle.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/flower-meadow-castle.png |
| [H:/LFAA/apps/web/public/images/minecraft/forest-bridge-evening.png](<H:/LFAA/apps/web/public/images/minecraft/forest-bridge-evening.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/forest-bridge-evening.png |
| [H:/LFAA/apps/web/public/images/minecraft/golden-wheat-field.png](<H:/LFAA/apps/web/public/images/minecraft/golden-wheat-field.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/golden-wheat-field.png |
| [H:/LFAA/apps/web/public/images/minecraft/lakeside-pagoda-morning.png](<H:/LFAA/apps/web/public/images/minecraft/lakeside-pagoda-morning.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/lakeside-pagoda-morning.png |
| [H:/LFAA/apps/web/public/images/minecraft/ocean-cliff-sunset.png](<H:/LFAA/apps/web/public/images/minecraft/ocean-cliff-sunset.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/ocean-cliff-sunset.png |
| [H:/LFAA/apps/web/public/images/minecraft/rainy-grassland.png](<H:/LFAA/apps/web/public/images/minecraft/rainy-grassland.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/rainy-grassland.png |
| [H:/LFAA/apps/web/public/images/minecraft/snowy-cabin-interior.png](<H:/LFAA/apps/web/public/images/minecraft/snowy-cabin-interior.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/snowy-cabin-interior.png |
| [H:/LFAA/apps/web/public/images/minecraft/tropical-coast-day.png](<H:/LFAA/apps/web/public/images/minecraft/tropical-coast-day.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/public/images/minecraft/tropical-coast-day.png |
| [H:/LFAA/apps/web/scripts/wait-for-server.mjs](<H:/LFAA/apps/web/scripts/wait-for-server.mjs>) | Web 开发入口、Vite 与类型检查配置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/scripts/wait-for-server.mjs |
| [H:/LFAA/apps/web/src/.gitkeep](<H:/LFAA/apps/web/src/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/apps/web/src/main.tsx](<H:/LFAA/apps/web/src/main.tsx>) | Web 开发入口、Vite 与类型检查配置 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/web/tsconfig.json](<H:/LFAA/apps/web/tsconfig.json>) | Web 开发入口、Vite 与类型检查配置 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/apps/web/vite.config.ts](<H:/LFAA/apps/web/vite.config.ts>) | Web 开发入口、Vite 与类型检查配置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/vite.config.ts |
| [H:/LFAA/docs/harness-packages.json](<H:/LFAA/docs/harness-packages.json>) | 架构、实施状态、任务合同或完整迁移清单 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/docs/harness-packages.md](<H:/LFAA/docs/harness-packages.md>) | 架构、实施状态、任务合同或完整迁移清单 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/docs/PROMPTS.md](<H:/LFAA/docs/PROMPTS.md>) | 架构、实施状态、任务合同或完整迁移清单 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/docs/开发计划.md](<H:/LFAA/docs/开发计划.md>) | 架构、实施状态、任务合同或完整迁移清单 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/docs/系统总体架构.md](<H:/LFAA/docs/系统总体架构.md>) | 架构、实施状态、任务合同或完整迁移清单 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/native/system/Cargo.lock](<H:/LFAA/native/system/Cargo.lock>) | 原 Windows Sandbox Host 原生实现与 Cargo 依赖 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/daemon/sandbox-host/Cargo.lock |
| [H:/LFAA/native/system/Cargo.toml](<H:/LFAA/native/system/Cargo.toml>) | 原 Windows Sandbox Host 原生实现与 Cargo 依赖 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/daemon/sandbox-host/Cargo.toml |
| [H:/LFAA/native/system/src/main.rs](<H:/LFAA/native/system/src/main.rs>) | 原 Windows Sandbox Host 原生实现与 Cargo 依赖 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/daemon/sandbox-host/src/main.rs |
| [H:/LFAA/package.json](<H:/LFAA/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/acp/acp/.gitkeep](<H:/LFAA/packages/acp/acp/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/api/account-controller/package.json](<H:/LFAA/packages/api/account-controller/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/account-controller/src/index.ts](<H:/LFAA/packages/api/account-controller/src/index.ts>) | 登记 account-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/account-controller） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/gateway/package.json](<H:/LFAA/packages/api/gateway/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/gateway/src/express.d.ts](<H:/LFAA/packages/api/gateway/src/express.d.ts>) | 为 Express 请求增加通过服务端会话校验的身份信息。（api/gateway） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/types/express.d.ts |
| [H:/LFAA/packages/api/gateway/src/health-controller.ts](<H:/LFAA/packages/api/gateway/src/health-controller.ts>) | 登记 gateway 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/gateway） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/gateway/src/index.ts](<H:/LFAA/packages/api/gateway/src/index.ts>) | 提供可组合的 HTTP 路由服务。（api/gateway） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/job-controller/package.json](<H:/LFAA/packages/api/job-controller/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/job-controller/src/index.ts](<H:/LFAA/packages/api/job-controller/src/index.ts>) | 登记 job-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/job-controller） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/minecraft-controller/package.json](<H:/LFAA/packages/api/minecraft-controller/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/minecraft-controller/src/index.ts](<H:/LFAA/packages/api/minecraft-controller/src/index.ts>) | 登记 minecraft-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/minecraft-controller） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/remotes/package.json](<H:/LFAA/packages/api/remotes/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/remotes/src/rate-limit.ts](<H:/LFAA/packages/api/remotes/src/rate-limit.ts>) | 限制同一来源短时间内的敏感请求数量。（api/remotes） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/middleware/rate-limit.ts |
| [H:/LFAA/packages/api/remotes/src/route-contracts.ts](<H:/LFAA/packages/api/remotes/src/route-contracts.ts>) | 定义 HTTP 请求校验和共享响应合同。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/remotes） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/remotes/src/socket-server.ts](<H:/LFAA/packages/api/remotes/src/socket-server.ts>) | 为已登录的 LFAA 页面提供 Minecraft 实时变更通知。（api/remotes） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/realtime/socket-server.ts |
| [H:/LFAA/packages/api/session-controller/package.json](<H:/LFAA/packages/api/session-controller/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/session-controller/src/index.ts](<H:/LFAA/packages/api/session-controller/src/index.ts>) | 登记 session-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/session-controller） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/settings-controller/package.json](<H:/LFAA/packages/api/settings-controller/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/settings-controller/src/index.ts](<H:/LFAA/packages/api/settings-controller/src/index.ts>) | 登记 settings-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/settings-controller） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/steamcmd-controller/package.json](<H:/LFAA/packages/api/steamcmd-controller/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/steamcmd-controller/src/index.ts](<H:/LFAA/packages/api/steamcmd-controller/src/index.ts>) | 登记 steamcmd-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/steamcmd-controller） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/terminal-controller/.gitkeep](<H:/LFAA/packages/api/terminal-controller/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/api/workspace-controller/.gitkeep](<H:/LFAA/packages/api/workspace-controller/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/api/workspace-files/package.json](<H:/LFAA/packages/api/workspace-files/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/workspace-files/src/index.ts](<H:/LFAA/packages/api/workspace-files/src/index.ts>) | 登记 workspace-files 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/workspace-files） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/api/writing-controller/package.json](<H:/LFAA/packages/api/writing-controller/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/api/writing-controller/src/index.ts](<H:/LFAA/packages/api/writing-controller/src/index.ts>) | 登记 writing-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/writing-controller） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/api/routes.ts |
| [H:/LFAA/packages/attachment/attachment/.gitkeep](<H:/LFAA/packages/attachment/attachment/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/attachment/attachment-local/.gitkeep](<H:/LFAA/packages/attachment/attachment-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/boot/app-boot/package.json](<H:/LFAA/packages/boot/app-boot/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/boot/app-boot/src/ai-host.ts](<H:/LFAA/packages/boot/app-boot/src/ai-host.ts>) | 创建和关闭 LFAA 后端 AI 插件宿主。（boot/app-boot） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/host.ts |
| [H:/LFAA/packages/boot/app-boot/src/index.ts](<H:/LFAA/packages/boot/app-boot/src/index.ts>) | 启动 LFAA Harness 的共享 Cordis 上下文。（boot/app-boot） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/boot/cmdline/.gitkeep](<H:/LFAA/packages/boot/cmdline/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/boot/config-editor/.gitkeep](<H:/LFAA/packages/boot/config-editor/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/boot/hmr/package.json](<H:/LFAA/packages/boot/hmr/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/boot/hmr/src/index.ts](<H:/LFAA/packages/boot/hmr/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（boot/hmr） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/boot/plugin-manager/.gitkeep](<H:/LFAA/packages/boot/plugin-manager/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/browser-use/browser-use/.gitkeep](<H:/LFAA/packages/browser-use/browser-use/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/bundle/acp-app/.gitkeep](<H:/LFAA/packages/bundle/acp-app/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/bundle/base/cordis.patch.yml](<H:/LFAA/packages/bundle/base/cordis.patch.yml>) | bundle/base 的能力实现、类型或装配补丁 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/bundle/base/package.json](<H:/LFAA/packages/bundle/base/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/bundle/base/src/index.ts](<H:/LFAA/packages/bundle/base/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（bundle/base） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/bundle/daemon-app/cordis.patch.yml](<H:/LFAA/packages/bundle/daemon-app/cordis.patch.yml>) | bundle/daemon-app 的能力实现、类型或装配补丁 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/bundle/daemon-app/package.json](<H:/LFAA/packages/bundle/daemon-app/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/bundle/headless/.gitkeep](<H:/LFAA/packages/bundle/headless/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/bundle/sdk-app/.gitkeep](<H:/LFAA/packages/bundle/sdk-app/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/bundle/sdk-minimal/.gitkeep](<H:/LFAA/packages/bundle/sdk-minimal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/bundle/web-app/cordis.patch.yml](<H:/LFAA/packages/bundle/web-app/cordis.patch.yml>) | bundle/web-app 的能力实现、类型或装配补丁 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/bundle/web-app/package.json](<H:/LFAA/packages/bundle/web-app/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/bundle/web-app/src/index.ts](<H:/LFAA/packages/bundle/web-app/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（bundle/web-app） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/connection/package.json](<H:/LFAA/packages/client/connection/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/connection/src/api.ts](<H:/LFAA/packages/client/connection/src/api.ts>) | 定义前端与 LFAA 控制端之间的 API 类型和请求函数。（client/connection） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/api.ts |
| [H:/LFAA/packages/client/connection/src/minecraft-socket.ts](<H:/LFAA/packages/client/connection/src/minecraft-socket.ts>) | 建立 Minecraft 工作台到同源 LFAA 控制端的实时连接。（client/connection） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/realtime/minecraft-socket.ts |
| [H:/LFAA/packages/client/file-upload/.gitkeep](<H:/LFAA/packages/client/file-upload/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/hmr/.gitkeep](<H:/LFAA/packages/client/hmr/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/locale/.gitkeep](<H:/LFAA/packages/client/locale/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/modules/package.json](<H:/LFAA/packages/client/modules/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/modules/src/client/index.ts](<H:/LFAA/packages/client/modules/src/client/index.ts>) | 提供浏览器模块登记服务。作用：按包加载界面并在插件卸载时撤销登记。关联文件：各 ui 包的 client/index.ts、client/web。（client/modules） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/modules/src/index.ts](<H:/LFAA/packages/client/modules/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/modules） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/product-analytics/.gitkeep](<H:/LFAA/packages/client/product-analytics/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/resources/package.json](<H:/LFAA/packages/client/resources/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/resources/src/notification-runtime.ts](<H:/LFAA/packages/client/resources/src/notification-runtime.ts>) | 管理 LFAA 前端的系统通知和提示音。（client/resources） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/shared/notification-runtime.ts |
| [H:/LFAA/packages/client/shortcuts/.gitkeep](<H:/LFAA/packages/client/shortcuts/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/store/package.json](<H:/LFAA/packages/client/store/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/store/src/scroll-restoration.ts](<H:/LFAA/packages/client/store/src/scroll-restoration.ts>) | 保存并恢复前端滚动区域的位置。（client/store） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/shared/scroll-restoration.ts |
| [H:/LFAA/packages/client/ui-agent-preset/.gitkeep](<H:/LFAA/packages/client/ui-agent-preset/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-approval/.gitkeep](<H:/LFAA/packages/client/ui-approval/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-attachment/.gitkeep](<H:/LFAA/packages/client/ui-attachment/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-brand-official/.gitkeep](<H:/LFAA/packages/client/ui-brand-official/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-chat/package.json](<H:/LFAA/packages/client/ui-chat/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-chat/src/ai-work-chat.css](<H:/LFAA/packages/client/ui-chat/src/ai-work-chat.css>) | 定义 AI Work 对话画布、悬停式提问锚点、消息、权限模式弹层和输入区的布局与样式。（client/ui-chat） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/ai-work-chat.css |
| [H:/LFAA/packages/client/ui-chat/src/AiMarkdown.tsx](<H:/LFAA/packages/client/ui-chat/src/AiMarkdown.tsx>) | 渲染 AI 回复中的常用 Markdown 内容。（client/ui-chat） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/AiMarkdown.tsx |
| [H:/LFAA/packages/client/ui-chat/src/AiWorkChat.tsx](<H:/LFAA/packages/client/ui-chat/src/AiWorkChat.tsx>) | 提供 SteamCMD、Minecraft 和写作工作区的 AI Work 流式聊天。（client/ui-chat） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/AiWorkChat.tsx |
| [H:/LFAA/packages/client/ui-chat/src/client/index.ts](<H:/LFAA/packages/client/ui-chat/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-chat） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-chat/src/index.ts](<H:/LFAA/packages/client/ui-chat/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-chat） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-commands/package.json](<H:/LFAA/packages/client/ui-commands/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-commands/src/client/index.ts](<H:/LFAA/packages/client/ui-commands/src/client/index.ts>) | 提供浏览器快捷键匹配能力。作用：沿用账户快捷键合同，随插件卸载撤销服务。关联文件：shortcuts.ts、client/web、ui-layout。（client/ui-commands） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-commands/src/index.ts](<H:/LFAA/packages/client/ui-commands/src/index.ts>) | 声明命令界面包。作用：供 Host 登记浏览器包，匹配实现由 client 入口提供。关联文件：client/index.ts、shortcuts.ts。（client/ui-commands） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-commands/src/shortcuts.ts](<H:/LFAA/packages/client/ui-commands/src/shortcuts.ts>) | 提供 lfaa-client-ui-commands 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-commands） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/frontend/src/components/Workbench.tsx |
| [H:/LFAA/packages/client/ui-conversation/.gitkeep](<H:/LFAA/packages/client/ui-conversation/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-deliverables/.gitkeep](<H:/LFAA/packages/client/ui-deliverables/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-directory-picker-browse/.gitkeep](<H:/LFAA/packages/client/ui-directory-picker-browse/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-directory-picker-native/.gitkeep](<H:/LFAA/packages/client/ui-directory-picker-native/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-dockkit/package.json](<H:/LFAA/packages/client/ui-dockkit/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-dockkit/src/client/index.ts](<H:/LFAA/packages/client/ui-dockkit/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-dockkit） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-dockkit/src/index.ts](<H:/LFAA/packages/client/ui-dockkit/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-dockkit） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-dockkit/src/ResizableWorkbench.tsx](<H:/LFAA/packages/client/ui-dockkit/src/ResizableWorkbench.tsx>) | 提供左栏 / 中间区 / 右栏 / 底部面板的纯布局容器，并实现拖拽缩放与吸附收起。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/workbench/ResizableWorkbench.tsx |
| [H:/LFAA/packages/client/ui-dockkit/src/ui-resize/damped-motion.ts](<H:/LFAA/packages/client/ui-dockkit/src/ui-resize/damped-motion.ts>) | 给 Resize/Snap 提供与帧率无关的指数阻尼步进，避免 pointer 尺寸直接跳变产生僵硬/顿挫感。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/workbench/ui-resize/damped-motion.ts |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench-interaction.config.ts](<H:/LFAA/packages/client/ui-dockkit/src/workbench-interaction.config.ts>) | 集中定义 Workbench 拖拽、吸附、反向释放与键盘缩放的交互参数，避免把手感数字散落在 TSX / CSS。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/workbench/workbench-interaction.config.ts |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.config.ts](<H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.config.ts>) | 集中定义 Workbench 的响应式几何变量和计算公式，避免把 280px / 360px 这类魔法数字散落在组件里。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/workbench/workbench-layout.config.ts |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.types.ts](<H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.types.ts>) | 定义 ResizableWorkbench 的布局参数和受控状态接口。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/workbench/workbench-layout.types.ts |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench-preferences.ts](<H:/LFAA/packages/client/ui-dockkit/src/workbench-preferences.ts>) | 读取并保存工作台共用的左侧栏宽度。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/workbench/workbench-preferences.ts |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench.css](<H:/LFAA/packages/client/ui-dockkit/src/workbench.css>) | ResizableWorkbench 的纯几何布局和吸附/收起视觉状态。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/workbench/workbench.css |
| [H:/LFAA/packages/client/ui-goal/.gitkeep](<H:/LFAA/packages/client/ui-goal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-input-trigger/.gitkeep](<H:/LFAA/packages/client/ui-input-trigger/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-jobs/.gitkeep](<H:/LFAA/packages/client/ui-jobs/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-layout/package.json](<H:/LFAA/packages/client/ui-layout/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-layout/src/client/index.ts](<H:/LFAA/packages/client/ui-layout/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-layout） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-layout/src/index.ts](<H:/LFAA/packages/client/ui-layout/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-layout） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-layout/src/pages.css](<H:/LFAA/packages/client/ui-layout/src/pages.css>) | 定义应用能力页和账户列表的共用样式。（client/ui-layout） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/styles/pages.css |
| [H:/LFAA/packages/client/ui-layout/src/workbench.css](<H:/LFAA/packages/client/ui-layout/src/workbench.css>) | 定义应用中心、工作台页脚和首次配置提醒弹窗样式。（client/ui-layout） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/styles/workbench.css |
| [H:/LFAA/packages/client/ui-layout/src/Workbench.tsx](<H:/LFAA/packages/client/ui-layout/src/Workbench.tsx>) | 呈现现有工作台。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。（client/ui-layout） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/Workbench.tsx |
| [H:/LFAA/packages/client/ui-message-feedback/.gitkeep](<H:/LFAA/packages/client/ui-message-feedback/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-minecraft/package.json](<H:/LFAA/packages/client/ui-minecraft/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-minecraft/src/assets/minecraftScenes.ts](<H:/LFAA/packages/client/ui-minecraft/src/assets/minecraftScenes.ts>) | client/ui-minecraft 的能力实现、类型或装配补丁 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/assets/minecraftScenes.ts |
| [H:/LFAA/packages/client/ui-minecraft/src/client/index.ts](<H:/LFAA/packages/client/ui-minecraft/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-minecraft） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-minecraft/src/index.ts](<H:/LFAA/packages/client/ui-minecraft/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-minecraft） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.css](<H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.css>) | 定义 Minecraft 常规工作台内容区、实例视图和操作表单的样式。（client/ui-minecraft） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/MinecraftWorkspace.css |
| [H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.tsx](<H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.tsx>) | 呈现 Minecraft 常规模式的真实管理工作台。（client/ui-minecraft） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/MinecraftWorkspace.tsx |
| [H:/LFAA/packages/client/ui-model-selection/.gitkeep](<H:/LFAA/packages/client/ui-model-selection/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-open-in-app/.gitkeep](<H:/LFAA/packages/client/ui-open-in-app/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-permission-presets/.gitkeep](<H:/LFAA/packages/client/ui-permission-presets/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-plan/.gitkeep](<H:/LFAA/packages/client/ui-plan/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-plugin-manager/.gitkeep](<H:/LFAA/packages/client/ui-plugin-manager/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-primitives/package.json](<H:/LFAA/packages/client/ui-primitives/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-primitives/src/.gitkeep](<H:/LFAA/packages/client/ui-primitives/src/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-primitives/src/client/index.ts](<H:/LFAA/packages/client/ui-primitives/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-primitives） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-primitives/src/index.ts](<H:/LFAA/packages/client/ui-primitives/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-primitives） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-primitives/src/ServiceStatus.tsx](<H:/LFAA/packages/client/ui-primitives/src/ServiceStatus.tsx>) | 展示控制端当前的连通状态。（client/ui-primitives） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/ServiceStatus.tsx |
| [H:/LFAA/packages/client/ui-primitives/src/settings-controls.tsx](<H:/LFAA/packages/client/ui-primitives/src/settings-controls.tsx>) | 提供 lfaa-client-ui-primitives 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-primitives） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/frontend/src/components/SettingsPage.tsx |
| [H:/LFAA/packages/client/ui-primitives/src/WorkbenchIcon.tsx](<H:/LFAA/packages/client/ui-primitives/src/WorkbenchIcon.tsx>) | 提供工作台壳层使用的轻量线性 SVG 图标集合。（client/ui-primitives） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/workbench/shared/WorkbenchIcon.tsx |
| [H:/LFAA/packages/client/ui-reference/.gitkeep](<H:/LFAA/packages/client/ui-reference/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-renderer/package.json](<H:/LFAA/packages/client/ui-renderer/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-renderer/src/App.tsx](<H:/LFAA/packages/client/ui-renderer/src/App.tsx>) | 管理 LFAA 前端认证状态、路由、服务状态和账户设置。（client/ui-renderer） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/App.tsx |
| [H:/LFAA/packages/client/ui-renderer/src/client/index.ts](<H:/LFAA/packages/client/ui-renderer/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-renderer） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-renderer/src/index.ts](<H:/LFAA/packages/client/ui-renderer/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-renderer） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-renderer/src/render.tsx](<H:/LFAA/packages/client/ui-renderer/src/render.tsx>) | 挂载 LFAA React 前端。（client/ui-renderer） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/main.tsx |
| [H:/LFAA/packages/client/ui-schedule/.gitkeep](<H:/LFAA/packages/client/ui-schedule/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-session/.gitkeep](<H:/LFAA/packages/client/ui-session/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-settings/package.json](<H:/LFAA/packages/client/ui-settings/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings/src/client/index.ts](<H:/LFAA/packages/client/ui-settings/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings/src/index.ts](<H:/LFAA/packages/client/ui-settings/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings/src/SettingsPage.css](<H:/LFAA/packages/client/ui-settings/src/SettingsPage.css>) | 定义 LFAA 设置中心的导航、分类面板、表单和账户卡片样式。（client/ui-settings） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/SettingsPage.css |
| [H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx](<H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx>) | 呈现现有设置中心。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。（client/ui-settings） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/SettingsPage.tsx |
| [H:/LFAA/packages/client/ui-settings-account/package.json](<H:/LFAA/packages/client/ui-settings-account/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings-account/src/AdminUsersPage.tsx](<H:/LFAA/packages/client/ui-settings-account/src/AdminUsersPage.tsx>) | 呈现设置中心里的本机账户管理。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/AdminUsersPage.tsx |
| [H:/LFAA/packages/client/ui-settings-account/src/auth.css](<H:/LFAA/packages/client/ui-settings-account/src/auth.css>) | 定义登录页、首次初始化页和密码恢复页的专属样式。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/styles/auth.css |
| [H:/LFAA/packages/client/ui-settings-account/src/AuthView.tsx](<H:/LFAA/packages/client/ui-settings-account/src/AuthView.tsx>) | 呈现超级管理员首次初始化、登录和恢复密码表单。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/AuthView.tsx |
| [H:/LFAA/packages/client/ui-settings-account/src/client/index.ts](<H:/LFAA/packages/client/ui-settings-account/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings-account） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings-account/src/index.ts](<H:/LFAA/packages/client/ui-settings-account/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings-account） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings-account/src/PasskeyManager.tsx](<H:/LFAA/packages/client/ui-settings-account/src/PasskeyManager.tsx>) | 管理当前账户已登记的 WebAuthn 通行密钥。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/PasskeyManager.tsx |
| [H:/LFAA/packages/client/ui-settings-account/src/PasskeySetupPrompt.tsx](<H:/LFAA/packages/client/ui-settings-account/src/PasskeySetupPrompt.tsx>) | 在账户尚无通行密钥时显示可跳过的安全设置提示。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/PasskeySetupPrompt.tsx |
| [H:/LFAA/packages/client/ui-settings-account/src/PasswordStrengthIndicator.tsx](<H:/LFAA/packages/client/ui-settings-account/src/PasswordStrengthIndicator.tsx>) | 显示密码和恢复密钥的实时强度。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/PasswordStrengthIndicator.tsx |
| [H:/LFAA/packages/client/ui-settings-agent-loop/.gitkeep](<H:/LFAA/packages/client/ui-settings-agent-loop/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-settings-general/package.json](<H:/LFAA/packages/client/ui-settings-general/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings-general/src/client/index.ts](<H:/LFAA/packages/client/ui-settings-general/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings-general） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings-general/src/default-settings.ts](<H:/LFAA/packages/client/ui-settings-general/src/default-settings.ts>) | 提供 lfaa-client-ui-settings-general 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-settings-general） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/frontend/src/components/SettingsPage.tsx |
| [H:/LFAA/packages/client/ui-settings-general/src/index.ts](<H:/LFAA/packages/client/ui-settings-general/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings-general） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings-general/src/setup-reminder.ts](<H:/LFAA/packages/client/ui-settings-general/src/setup-reminder.ts>) | 维护首次配置提醒的本地“今日暂停”状态。（client/ui-settings-general） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/shared/setup-reminder.ts |
| [H:/LFAA/packages/client/ui-settings-general/src/SetupReminder.tsx](<H:/LFAA/packages/client/ui-settings-general/src/SetupReminder.tsx>) | 提示用户完成首次配置。（client/ui-settings-general） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/SetupReminder.tsx |
| [H:/LFAA/packages/client/ui-settings-models/package.json](<H:/LFAA/packages/client/ui-settings-models/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-settings-models/src/model-options.ts](<H:/LFAA/packages/client/ui-settings-models/src/model-options.ts>) | 提供 lfaa-client-ui-settings-models 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-settings-models） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/frontend/src/components/SettingsPage.tsx |
| [H:/LFAA/packages/client/ui-settings-plugin-inventory/.gitkeep](<H:/LFAA/packages/client/ui-settings-plugin-inventory/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-settings-plugins/.gitkeep](<H:/LFAA/packages/client/ui-settings-plugins/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-settings-session-log/.gitkeep](<H:/LFAA/packages/client/ui-settings-session-log/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-settings-shell/.gitkeep](<H:/LFAA/packages/client/ui-settings-shell/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-settings-subagent/.gitkeep](<H:/LFAA/packages/client/ui-settings-subagent/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-settings-web-search/.gitkeep](<H:/LFAA/packages/client/ui-settings-web-search/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-shortcuts/package.json](<H:/LFAA/packages/client/ui-shortcuts/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-shortcuts/src/settings-shortcuts.tsx](<H:/LFAA/packages/client/ui-shortcuts/src/settings-shortcuts.tsx>) | 提供 lfaa-client-ui-shortcuts 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-shortcuts） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/frontend/src/components/SettingsPage.tsx |
| [H:/LFAA/packages/client/ui-sidebar/package.json](<H:/LFAA/packages/client/ui-sidebar/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-sidebar/src/client/index.ts](<H:/LFAA/packages/client/ui-sidebar/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-sidebar） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-sidebar/src/GlobalNavigationRail.tsx](<H:/LFAA/packages/client/ui-sidebar/src/GlobalNavigationRail.tsx>) | 提供应用工作区、文件页和设置中心共用的全局导航轨。（client/ui-sidebar） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/GlobalNavigationRail.tsx |
| [H:/LFAA/packages/client/ui-sidebar/src/index.ts](<H:/LFAA/packages/client/ui-sidebar/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-sidebar） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-sidebar-browser/.gitkeep](<H:/LFAA/packages/client/ui-sidebar-browser/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-sidebar-documentpreview/.gitkeep](<H:/LFAA/packages/client/ui-sidebar-documentpreview/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-sidebar-files/package.json](<H:/LFAA/packages/client/ui-sidebar-files/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-sidebar-files/src/client/index.ts](<H:/LFAA/packages/client/ui-sidebar-files/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-sidebar-files） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.css](<H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.css>) | 定义通用文件管理工作台的布局、目录表格、任务提示和在线文本编辑器样式。（client/ui-sidebar-files） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/FileManagerPage.css |
| [H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.tsx](<H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.tsx>) | 呈现各应用共用的 daemon 文件管理工作台。（client/ui-sidebar-files） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/FileManagerPage.tsx |
| [H:/LFAA/packages/client/ui-sidebar-files/src/index.ts](<H:/LFAA/packages/client/ui-sidebar-files/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-sidebar-files） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-sidebar-right/.gitkeep](<H:/LFAA/packages/client/ui-sidebar-right/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-sidebar-terminal/.gitkeep](<H:/LFAA/packages/client/ui-sidebar-terminal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-skill/.gitkeep](<H:/LFAA/packages/client/ui-skill/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-slots/.gitkeep](<H:/LFAA/packages/client/ui-slots/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-subagent/.gitkeep](<H:/LFAA/packages/client/ui-subagent/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-theme/package.json](<H:/LFAA/packages/client/ui-theme/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-theme/src/base.css](<H:/LFAA/packages/client/ui-theme/src/base.css>) | 定义文档级默认样式。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/styles/base.css |
| [H:/LFAA/packages/client/ui-theme/src/common.css](<H:/LFAA/packages/client/ui-theme/src/common.css>) | 定义多个独立前端组件共用的状态样式。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/styles/common.css |
| [H:/LFAA/packages/client/ui-theme/src/fonts.ts](<H:/LFAA/packages/client/ui-theme/src/fonts.ts>) | 提供 lfaa-client-ui-theme 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-theme） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/frontend/src/components/Workbench.tsx |
| [H:/LFAA/packages/client/ui-theme/src/login-background.ts](<H:/LFAA/packages/client/ui-theme/src/login-background.ts>) | 管理登录页在未认证状态下使用的内置背景。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/shared/login-background.ts |
| [H:/LFAA/packages/client/ui-theme/src/responsive.css](<H:/LFAA/packages/client/ui-theme/src/responsive.css>) | 定义前端各页面的响应式断点和减少动效规则。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/styles/responsive.css |
| [H:/LFAA/packages/client/ui-theme/src/tokens.css](<H:/LFAA/packages/client/ui-theme/src/tokens.css>) | 定义 LFAA 全局共用的颜色、字号、间距和字体变量。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/styles/tokens.css |
| [H:/LFAA/packages/client/ui-tool/.gitkeep](<H:/LFAA/packages/client/ui-tool/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-trajectory/.gitkeep](<H:/LFAA/packages/client/ui-trajectory/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-user-questions/.gitkeep](<H:/LFAA/packages/client/ui-user-questions/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-workflow-run/.gitkeep](<H:/LFAA/packages/client/ui-workflow-run/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/client/ui-workspace/package.json](<H:/LFAA/packages/client/ui-workspace/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-workspace/src/application-workspace.css](<H:/LFAA/packages/client/ui-workspace/src/application-workspace.css>) | 定义应用内三栏工作区和可调整侧栏样式。（client/ui-workspace） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/styles/application-workspace.css |
| [H:/LFAA/packages/client/ui-workspace/src/ApplicationWorkspace.tsx](<H:/LFAA/packages/client/ui-workspace/src/ApplicationWorkspace.tsx>) | 装配 SteamCMD、Minecraft、写作应用内部的工作台界面。（client/ui-workspace） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/ApplicationWorkspace.tsx |
| [H:/LFAA/packages/client/ui-workspace/src/client/index.ts](<H:/LFAA/packages/client/ui-workspace/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-workspace） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-workspace/src/index.ts](<H:/LFAA/packages/client/ui-workspace/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-workspace） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-workspace/src/module-workbench.css](<H:/LFAA/packages/client/ui-workspace/src/module-workbench.css>) | 定义共享全局导航轨，以及应用工作区的浮动卡片、侧栏和内容区域样式。（client/ui-workspace） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/components/module-workbench.css |
| [H:/LFAA/packages/client/ui-writing/package.json](<H:/LFAA/packages/client/ui-writing/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.css](<H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.css>) | 定义写作 AI Work 右侧创作上下文的排版与状态样式。（client/ui-writing） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/apps/writing/ai-work/WritingAiContext.css |
| [H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.tsx](<H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.tsx>) | 展示写作应用当前作品、章节与模式上下文。（client/ui-writing） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/apps/writing/ai-work/WritingAiContext.tsx |
| [H:/LFAA/packages/client/ui-writing/src/client/index.ts](<H:/LFAA/packages/client/ui-writing/src/client/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-writing） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-writing/src/index.ts](<H:/LFAA/packages/client/ui-writing/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-writing） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.css](<H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.css>) | 定义写作常规模式的作品、卷、章节目录和正文编辑区样式。（client/ui-writing） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/apps/writing/normal/WritingWorkspace.css |
| [H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.tsx](<H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.tsx>) | 提供写作空间常规模式的作品大纲、卷、章节与中央编辑区。（client/ui-writing） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/src/apps/writing/normal/WritingWorkspace.tsx |
| [H:/LFAA/packages/client/web/package.json](<H:/LFAA/packages/client/web/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/web/src/index.ts](<H:/LFAA/packages/client/web/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/web） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/client/web/src/main.tsx](<H:/LFAA/packages/client/web/src/main.tsx>) | 启动浏览器 Harness。作用：先装配界面插件，再挂载现有 React 界面。关联文件：client/modules、各 ui 包、ui-renderer/render.tsx。（client/web） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/compaction/command-compact/.gitkeep](<H:/LFAA/packages/compaction/command-compact/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/compaction/compaction/.gitkeep](<H:/LFAA/packages/compaction/compaction/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/compaction/compaction-basic/.gitkeep](<H:/LFAA/packages/compaction/compaction-basic/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/compaction/compaction-image-offload/.gitkeep](<H:/LFAA/packages/compaction/compaction-image-offload/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/compaction/compaction-tool-result-pruner/.gitkeep](<H:/LFAA/packages/compaction/compaction-tool-result-pruner/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/computer-use/computer-use/.gitkeep](<H:/LFAA/packages/computer-use/computer-use/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/context/agent-instructions/.gitkeep](<H:/LFAA/packages/context/agent-instructions/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/context/file-reference/.gitkeep](<H:/LFAA/packages/context/file-reference/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/context/file-reference-local/.gitkeep](<H:/LFAA/packages/context/file-reference-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/context/session-reference/.gitkeep](<H:/LFAA/packages/context/session-reference/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/context/time-context/.gitkeep](<H:/LFAA/packages/context/time-context/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/context/tmux-context/.gitkeep](<H:/LFAA/packages/context/tmux-context/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/core/agent/package.json](<H:/LFAA/packages/core/agent/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/core/agent/src/extension-registry.ts](<H:/LFAA/packages/core/agent/src/extension-registry.ts>) | 提供 Cordis 插件使用的 AI 扩展登记服务。（core/agent） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/plugins/extension-registry.ts |
| [H:/LFAA/packages/core/agent/src/index.ts](<H:/LFAA/packages/core/agent/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（core/agent） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/core/agent-default-model/.gitkeep](<H:/LFAA/packages/core/agent-default-model/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/core/agent-loop/package.json](<H:/LFAA/packages/core/agent-loop/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/core/agent-loop/src/index.ts](<H:/LFAA/packages/core/agent-loop/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（core/agent-loop） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/core/agent-loop/src/runtime.ts](<H:/LFAA/packages/core/agent-loop/src/runtime.ts>) | 通过当前用户已激活的 Provider 执行流式 AI Work 对话。（core/agent-loop） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/runtime.ts |
| [H:/LFAA/packages/core/agent-tool-presentation/.gitkeep](<H:/LFAA/packages/core/agent-tool-presentation/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/core/scope/.gitkeep](<H:/LFAA/packages/core/scope/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/core/session/package.json](<H:/LFAA/packages/core/session/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/core/session/src/index.ts](<H:/LFAA/packages/core/session/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（core/session） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/core/session/src/sessions.ts](<H:/LFAA/packages/core/session/src/sessions.ts>) | 管理按用户隔离的 AI Work 会话、消息和实际 Provider 用量。（core/session） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/sessions.ts |
| [H:/LFAA/packages/core/system-prompt/.gitkeep](<H:/LFAA/packages/core/system-prompt/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/core/tools/package.json](<H:/LFAA/packages/core/tools/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/core/tools/src/business-tools.ts](<H:/LFAA/packages/core/tools/src/business-tools.ts>) | 定义 AI Work 可调用的业务工具目录。（core/tools） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/business-tools.ts |
| [H:/LFAA/packages/core/tools/src/index.ts](<H:/LFAA/packages/core/tools/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（core/tools） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/credentials/authorization/package.json](<H:/LFAA/packages/credentials/authorization/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/credentials/authorization/src/middleware.ts](<H:/LFAA/packages/credentials/authorization/src/middleware.ts>) | 验证浏览器登录 Cookie 并执行角色授权。（credentials/authorization） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/middleware/auth.ts |
| [H:/LFAA/packages/credentials/credentials/.gitkeep](<H:/LFAA/packages/credentials/credentials/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/credentials/credentials-local/.gitkeep](<H:/LFAA/packages/credentials/credentials-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/credentials/deepseek-account/.gitkeep](<H:/LFAA/packages/credentials/deepseek-account/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/credentials/deepseek-account-platform/.gitkeep](<H:/LFAA/packages/credentials/deepseek-account-platform/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/deliverables/tool-present/.gitkeep](<H:/LFAA/packages/deliverables/tool-present/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/deliverables/workspace-changes/.gitkeep](<H:/LFAA/packages/deliverables/workspace-changes/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/document/office-to-pdf/.gitkeep](<H:/LFAA/packages/document/office-to-pdf/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/document/writing/package.json](<H:/LFAA/packages/document/writing/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/document/writing/src/index.ts](<H:/LFAA/packages/document/writing/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（document/writing） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/document/writing/src/prompts.ts](<H:/LFAA/packages/document/writing/src/prompts.ts>) | 构造写作 App 的 LFAA AI Work System Prompt。（document/writing） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/prompts/writing.ts |
| [H:/LFAA/packages/document/writing/src/service.ts](<H:/LFAA/packages/document/writing/src/service.ts>) | 管理账户自己的写作作品、大纲、卷、章节、自动保存修订和当前编辑位置。（document/writing） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/writing/service.ts |
| [H:/LFAA/packages/experimental/agent-team/.gitkeep](<H:/LFAA/packages/experimental/agent-team/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/agent-team-profile/.gitkeep](<H:/LFAA/packages/experimental/agent-team-profile/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/api-speech-to-text/.gitkeep](<H:/LFAA/packages/experimental/api-speech-to-text/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/auto-review/.gitkeep](<H:/LFAA/packages/experimental/auto-review/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/browser-use-chrome-devtools-mcp/.gitkeep](<H:/LFAA/packages/experimental/browser-use-chrome-devtools-mcp/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/browser-use-playwright-mcp/.gitkeep](<H:/LFAA/packages/experimental/browser-use-playwright-mcp/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/browser-use-runtime/.gitkeep](<H:/LFAA/packages/experimental/browser-use-runtime/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/browser-use-stagehand-native/.gitkeep](<H:/LFAA/packages/experimental/browser-use-stagehand-native/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/client-ui-agent-team/.gitkeep](<H:/LFAA/packages/experimental/client-ui-agent-team/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/client-ui-voice-input/.gitkeep](<H:/LFAA/packages/experimental/client-ui-voice-input/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/computer-use-cua-driver-mcp/.gitkeep](<H:/LFAA/packages/experimental/computer-use-cua-driver-mcp/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/computer-use-cua-driver-native/.gitkeep](<H:/LFAA/packages/experimental/computer-use-cua-driver-native/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/inspector/.gitkeep](<H:/LFAA/packages/experimental/inspector/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/ptc-runtime-python/.gitkeep](<H:/LFAA/packages/experimental/ptc-runtime-python/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/schedule-bundle/.gitkeep](<H:/LFAA/packages/experimental/schedule-bundle/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/speech-to-text/.gitkeep](<H:/LFAA/packages/experimental/speech-to-text/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/speech-to-text-sensevoice/.gitkeep](<H:/LFAA/packages/experimental/speech-to-text-sensevoice/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/tool-agent-team/.gitkeep](<H:/LFAA/packages/experimental/tool-agent-team/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/voice-input-bundle/.gitkeep](<H:/LFAA/packages/experimental/voice-input-bundle/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/webworker-packer/.gitkeep](<H:/LFAA/packages/experimental/webworker-packer/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/experimental/webworker-runtime/.gitkeep](<H:/LFAA/packages/experimental/webworker-runtime/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/extensions/cordis-client-runner/.gitkeep](<H:/LFAA/packages/extensions/cordis-client-runner/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/extensions/cordis-host-runner/.gitkeep](<H:/LFAA/packages/extensions/cordis-host-runner/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/extensions/tool-cordis/.gitkeep](<H:/LFAA/packages/extensions/tool-cordis/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/extensions/ui-cordis/.gitkeep](<H:/LFAA/packages/extensions/ui-cordis/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/feedback/command-feedback/.gitkeep](<H:/LFAA/packages/feedback/command-feedback/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/feedback/message-feedback/.gitkeep](<H:/LFAA/packages/feedback/message-feedback/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/fs/fs/package.json](<H:/LFAA/packages/fs/fs/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/fs/fs/src/index.ts](<H:/LFAA/packages/fs/fs/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（fs/fs） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/fs/fs/src/queue.ts](<H:/LFAA/packages/fs/fs/src/queue.ts>) | 保存并派发 daemon 节点文件管理任务。（fs/fs） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/files/queue.ts |
| [H:/LFAA/packages/fs/fs-local/.gitkeep](<H:/LFAA/packages/fs/fs-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/fs/fs-observation-policy/.gitkeep](<H:/LFAA/packages/fs/fs-observation-policy/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/fs/fs-sandbox/.gitkeep](<H:/LFAA/packages/fs/fs-sandbox/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/fs/tool-fs/.gitkeep](<H:/LFAA/packages/fs/tool-fs/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/fs/tool-fs-search/.gitkeep](<H:/LFAA/packages/fs/tool-fs-search/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/fs/tool-str-replace-editor/.gitkeep](<H:/LFAA/packages/fs/tool-str-replace-editor/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/games/minecraft/package.json](<H:/LFAA/packages/games/minecraft/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/games/minecraft/src/catalog.ts](<H:/LFAA/packages/games/minecraft/src/catalog.ts>) | 读取 Mojang 官方 Minecraft Java 版本清单与 Vanilla 服务端工件信息。（games/minecraft） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/games/minecraft/catalog.ts |
| [H:/LFAA/packages/games/minecraft/src/index.ts](<H:/LFAA/packages/games/minecraft/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（games/minecraft） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/games/minecraft/src/service.ts](<H:/LFAA/packages/games/minecraft/src/service.ts>) | 实现 Minecraft Vanilla 实例目录、生命周期操作与受支持的服务器配置规则。（games/minecraft） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/games/minecraft/service.ts |
| [H:/LFAA/packages/games/steamcmd/package.json](<H:/LFAA/packages/games/steamcmd/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/games/steamcmd/src/index.ts](<H:/LFAA/packages/games/steamcmd/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（games/steamcmd） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/games/steamcmd/src/service.ts](<H:/LFAA/packages/games/steamcmd/src/service.ts>) | 管理 SteamCMD 专项配置、游戏存储路径并派发安装任务。（games/steamcmd） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/games/steamcmd/service.ts |
| [H:/LFAA/packages/goal/command-goal/.gitkeep](<H:/LFAA/packages/goal/command-goal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/goal/goal/.gitkeep](<H:/LFAA/packages/goal/goal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/goal/goal-round-driver/.gitkeep](<H:/LFAA/packages/goal/goal-round-driver/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/goal/tool-goal/.gitkeep](<H:/LFAA/packages/goal/tool-goal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/guard/repeat-tool-reminder/.gitkeep](<H:/LFAA/packages/guard/repeat-tool-reminder/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/guard/timeout-policy/.gitkeep](<H:/LFAA/packages/guard/timeout-policy/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/hooks/hook-protocol/package.json](<H:/LFAA/packages/hooks/hook-protocol/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/hooks/hook-protocol/src/index.ts](<H:/LFAA/packages/hooks/hook-protocol/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（hooks/hook-protocol） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/hooks/hook-protocol/src/runtime-hooks.ts](<H:/LFAA/packages/hooks/hook-protocol/src/runtime-hooks.ts>) | 提供只读、类型化的 AI 推理生命周期钩子。（hooks/hook-protocol） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/plugins/runtime-hooks.ts |
| [H:/LFAA/packages/hooks/hooks-claude-code/.gitkeep](<H:/LFAA/packages/hooks/hooks-claude-code/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/hooks/hooks-codex/.gitkeep](<H:/LFAA/packages/hooks/hooks-codex/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/daemon/package.json](<H:/LFAA/packages/host/daemon/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/host/daemon/src/index.ts](<H:/LFAA/packages/host/daemon/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（host/daemon） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/host/daemon/src/local-daemon.ts](<H:/LFAA/packages/host/daemon/src/local-daemon.ts>) | 维护本机 Windows Daemon 的登记、心跳与运行能力。（host/daemon） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/nodes/local-daemon.ts |
| [H:/LFAA/packages/host/daemon/src/minecraft-daemon.mjs](<H:/LFAA/packages/host/daemon/src/minecraft-daemon.mjs>) | 运行本机 Windows x64 Daemon，并执行 SteamCMD、Minecraft、Java、文件管理与 AI 主机命令任务。（host/daemon） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/daemon/src/task-runner/minecraft-daemon.mjs |
| [H:/LFAA/packages/host/directory-picker/.gitkeep](<H:/LFAA/packages/host/directory-picker/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/directory-picker-auto/.gitkeep](<H:/LFAA/packages/host/directory-picker-auto/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/directory-picker-browse/.gitkeep](<H:/LFAA/packages/host/directory-picker-browse/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/directory-picker-native/.gitkeep](<H:/LFAA/packages/host/directory-picker-native/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/frontend-static/.gitkeep](<H:/LFAA/packages/host/frontend-static/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/open-in-app/.gitkeep](<H:/LFAA/packages/host/open-in-app/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/plugin-inventory/.gitkeep](<H:/LFAA/packages/host/plugin-inventory/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/product-telemetry-otel/.gitkeep](<H:/LFAA/packages/host/product-telemetry-otel/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/host/webserver/package.json](<H:/LFAA/packages/host/webserver/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/host/webserver/src/index.ts](<H:/LFAA/packages/host/webserver/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（host/webserver） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/host/webserver/src/server.ts](<H:/LFAA/packages/host/webserver/src/server.ts>) | 启动 LFAA 控制端 HTTP 服务。（host/webserver） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/server/src/index.ts |
| [H:/LFAA/packages/identity/anonymous-user-id/.gitkeep](<H:/LFAA/packages/identity/anonymous-user-id/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/identity/auth/package.json](<H:/LFAA/packages/identity/auth/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/identity/auth/src/.gitkeep](<H:/LFAA/packages/identity/auth/src/.gitkeep>) | 保留上游同名目录位置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/auth/.gitkeep |
| [H:/LFAA/packages/identity/auth/src/index.ts](<H:/LFAA/packages/identity/auth/src/index.ts>) | 集中导出账户与会话业务服务。（identity/auth） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/auth/index.ts |
| [H:/LFAA/packages/identity/auth/src/passkeys.ts](<H:/LFAA/packages/identity/auth/src/passkeys.ts>) | 管理 LFAA 用户的 WebAuthn 通行密钥与认证挑战。（identity/auth） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/auth/passkeys.ts |
| [H:/LFAA/packages/identity/auth/src/password-policy.ts](<H:/LFAA/packages/identity/auth/src/password-policy.ts>) | 定义登录密码与恢复密钥的强度判定规则。（identity/auth） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/auth/password-policy.ts |
| [H:/LFAA/packages/identity/auth/src/service.ts](<H:/LFAA/packages/identity/auth/src/service.ts>) | 实现账户、角色和登录会话的持久化业务规则。（identity/auth） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/auth/service.ts |
| [H:/LFAA/packages/interaction/commands/.gitkeep](<H:/LFAA/packages/interaction/commands/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/interaction/permission-presets/package.json](<H:/LFAA/packages/interaction/permission-presets/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/interaction/permission-presets/src/index.ts](<H:/LFAA/packages/interaction/permission-presets/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（interaction/permission-presets） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/interaction/permission-presets/src/permissions.ts](<H:/LFAA/packages/interaction/permission-presets/src/permissions.ts>) | 提供由 server 核心持有的 AI 工具授权、单次审批和记忆授权。（interaction/permission-presets） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/permissions.ts |
| [H:/LFAA/packages/interaction/tool-ask-user/.gitkeep](<H:/LFAA/packages/interaction/tool-ask-user/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/interaction/user-approval/.gitkeep](<H:/LFAA/packages/interaction/user-approval/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/interaction/user-questions/.gitkeep](<H:/LFAA/packages/interaction/user-questions/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/jobs/jobs/package.json](<H:/LFAA/packages/jobs/jobs/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts](<H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts>) | 保存 AI Work 的主机 Shell 命令并通过在线 Daemon 节点派发执行。（jobs/jobs） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/nodes/ai-host-tasks.ts |
| [H:/LFAA/packages/jobs/jobs/src/index.ts](<H:/LFAA/packages/jobs/jobs/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（jobs/jobs） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/jobs/jobs/src/minecraft-queue.ts](<H:/LFAA/packages/jobs/jobs/src/minecraft-queue.ts>) | 保存并派发 Minecraft 节点任务及控制台日志。（jobs/jobs） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/tasks/minecraft-queue.ts |
| [H:/LFAA/packages/jobs/jobs-local/.gitkeep](<H:/LFAA/packages/jobs/jobs-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/jobs/tool-jobs/.gitkeep](<H:/LFAA/packages/jobs/tool-jobs/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/deepseek-llm-api-extensions/.gitkeep](<H:/LFAA/packages/llm/deepseek-llm-api-extensions/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/llm/.gitkeep](<H:/LFAA/packages/llm/llm/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/llm-deepseek/.gitkeep](<H:/LFAA/packages/llm/llm-deepseek/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/llm-deepseek-account/.gitkeep](<H:/LFAA/packages/llm/llm-deepseek-account/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/llm-deepseek-api-key/.gitkeep](<H:/LFAA/packages/llm/llm-deepseek-api-key/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/llm-pi-ai/.gitkeep](<H:/LFAA/packages/llm/llm-pi-ai/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/llm-retry/.gitkeep](<H:/LFAA/packages/llm/llm-retry/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/plugin-package-inventory-deepseek/.gitkeep](<H:/LFAA/packages/llm/plugin-package-inventory-deepseek/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/llm/token-meter/.gitkeep](<H:/LFAA/packages/llm/token-meter/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/lsp/lsp/.gitkeep](<H:/LFAA/packages/lsp/lsp/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/lsp/lsp-stdio/.gitkeep](<H:/LFAA/packages/lsp/lsp-stdio/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/lsp/tool-lsp/.gitkeep](<H:/LFAA/packages/lsp/tool-lsp/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/mcp/mcp-client/.gitkeep](<H:/LFAA/packages/mcp/mcp-client/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/mcp/mcp-resources/.gitkeep](<H:/LFAA/packages/mcp/mcp-resources/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/plan/plan-mode/.gitkeep](<H:/LFAA/packages/plan/plan-mode/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/preset/agent-preset/package.json](<H:/LFAA/packages/preset/agent-preset/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts](<H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts>) | 注册 LFAA 首期受信任的 AI Agent、子 Agent、领域专家、Skills、提示词和业务工具元数据。（preset/agent-preset） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/plugins/builtin-catalog.ts |
| [H:/LFAA/packages/preset/agent-preset/src/index.ts](<H:/LFAA/packages/preset/agent-preset/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（preset/agent-preset） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/preset/agent-preset-registry/.gitkeep](<H:/LFAA/packages/preset/agent-preset-registry/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/preset/persona/.gitkeep](<H:/LFAA/packages/preset/persona/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/ptc-runtime/ptc-runtime/.gitkeep](<H:/LFAA/packages/ptc-runtime/ptc-runtime/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/ptc-runtime/ptc-runtime-node/.gitkeep](<H:/LFAA/packages/ptc-runtime/ptc-runtime-node/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/runtime-diagnostics/invariants/.gitkeep](<H:/LFAA/packages/runtime-diagnostics/invariants/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/sandbox/sandbox/.gitkeep](<H:/LFAA/packages/sandbox/sandbox/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/sandbox/sandbox-local/.gitkeep](<H:/LFAA/packages/sandbox/sandbox-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/sandbox/sandbox-policy/.gitkeep](<H:/LFAA/packages/sandbox/sandbox-policy/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/sandbox/sandbox-windows-acl/.gitkeep](<H:/LFAA/packages/sandbox/sandbox-windows-acl/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/schedule/schedule/.gitkeep](<H:/LFAA/packages/schedule/schedule/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/sdk/client/.gitkeep](<H:/LFAA/packages/sdk/client/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/sdk/protocol/.gitkeep](<H:/LFAA/packages/sdk/protocol/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/sdk/server/.gitkeep](<H:/LFAA/packages/sdk/server/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-checkpoint-policy/.gitkeep](<H:/LFAA/packages/session/session-checkpoint-policy/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-format/.gitkeep](<H:/LFAA/packages/session/session-format/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-format-catalog/.gitkeep](<H:/LFAA/packages/session/session-format-catalog/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-format-v0-to-v1/.gitkeep](<H:/LFAA/packages/session/session-format-v0-to-v1/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-format-v1-to-v2/.gitkeep](<H:/LFAA/packages/session/session-format-v1-to-v2/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-format-v2-to-v3/.gitkeep](<H:/LFAA/packages/session/session-format-v2-to-v3/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-format-v3-to-v4/.gitkeep](<H:/LFAA/packages/session/session-format-v3-to-v4/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-log-deepseek/.gitkeep](<H:/LFAA/packages/session/session-log-deepseek/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-persistence/.gitkeep](<H:/LFAA/packages/session/session-persistence/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-persistence-jsonl/.gitkeep](<H:/LFAA/packages/session/session-persistence-jsonl/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-projection/.gitkeep](<H:/LFAA/packages/session/session-projection/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-projection-cache/.gitkeep](<H:/LFAA/packages/session/session-projection-cache/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-stats/.gitkeep](<H:/LFAA/packages/session/session-stats/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-telemetry/.gitkeep](<H:/LFAA/packages/session/session-telemetry/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-telemetry-otel/.gitkeep](<H:/LFAA/packages/session/session-telemetry-otel/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-title/.gitkeep](<H:/LFAA/packages/session/session-title/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-title-all-prompts-llm/.gitkeep](<H:/LFAA/packages/session/session-title-all-prompts-llm/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-title-first-prompt-llm/.gitkeep](<H:/LFAA/packages/session/session-title-first-prompt-llm/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-title-llm/.gitkeep](<H:/LFAA/packages/session/session-title-llm/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session/session-turn-outline/.gitkeep](<H:/LFAA/packages/session/session-turn-outline/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session-query/session-log-export/.gitkeep](<H:/LFAA/packages/session-query/session-log-export/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session-query/session-query/.gitkeep](<H:/LFAA/packages/session-query/session-query/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session-query/session-query-sqlite/.gitkeep](<H:/LFAA/packages/session-query/session-query-sqlite/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/session-query/tool-session-query/.gitkeep](<H:/LFAA/packages/session-query/tool-session-query/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/settings/settings/package.json](<H:/LFAA/packages/settings/settings/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/settings/settings/src/index.ts](<H:/LFAA/packages/settings/settings/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（settings/settings） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/settings/settings/src/preferences/index.ts](<H:/LFAA/packages/settings/settings/src/preferences/index.ts>) | 集中导出应用偏好业务服务。（settings/settings） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/preferences/index.ts |
| [H:/LFAA/packages/settings/settings/src/preferences/service.ts](<H:/LFAA/packages/settings/settings/src/preferences/service.ts>) | 保存和读取当前用户的应用中心偏好。（settings/settings） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/preferences/service.ts |
| [H:/LFAA/packages/settings/settings/src/service.ts](<H:/LFAA/packages/settings/settings/src/service.ts>) | 保存用户设置并安全管理 AI Provider 账户与模型目录。（settings/settings） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/settings/service.ts |
| [H:/LFAA/packages/shell/bash-local/.gitkeep](<H:/LFAA/packages/shell/bash-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/bash-sandbox/.gitkeep](<H:/LFAA/packages/shell/bash-sandbox/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/pwsh-local/.gitkeep](<H:/LFAA/packages/shell/pwsh-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/pwsh-sandbox/.gitkeep](<H:/LFAA/packages/shell/pwsh-sandbox/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/shell/.gitkeep](<H:/LFAA/packages/shell/shell/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/shell-env/.gitkeep](<H:/LFAA/packages/shell/shell-env/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/tool-bash/.gitkeep](<H:/LFAA/packages/shell/tool-bash/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/tool-bash-persistent/.gitkeep](<H:/LFAA/packages/shell/tool-bash-persistent/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/tool-pwsh/.gitkeep](<H:/LFAA/packages/shell/tool-pwsh/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/shell/tool-pwsh-persistent/.gitkeep](<H:/LFAA/packages/shell/tool-pwsh-persistent/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/skill/skill/.gitkeep](<H:/LFAA/packages/skill/skill/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/skill/skill-badge/.gitkeep](<H:/LFAA/packages/skill/skill-badge/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/skill/skill-filesystem/.gitkeep](<H:/LFAA/packages/skill/skill-filesystem/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/skill/skill-office/.gitkeep](<H:/LFAA/packages/skill/skill-office/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/skill/tool-skill/.gitkeep](<H:/LFAA/packages/skill/tool-skill/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/skill/tool-workspace-dependencies/.gitkeep](<H:/LFAA/packages/skill/tool-workspace-dependencies/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/skill/writing/package.json](<H:/LFAA/packages/skill/writing/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/skill/writing/src/writing-skills.ts](<H:/LFAA/packages/skill/writing/src/writing-skills.ts>) | 定义 LFAA 写作 Agent 可按需加载的内置创作方法。（skill/writing） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/ai/skills/writing-skills.ts |
| [H:/LFAA/packages/spill/spill/.gitkeep](<H:/LFAA/packages/spill/spill/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/spill/spill-local/.gitkeep](<H:/LFAA/packages/spill/spill-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/spill/spill-policy/.gitkeep](<H:/LFAA/packages/spill/spill-policy/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/ssh/fs-ssh/.gitkeep](<H:/LFAA/packages/ssh/fs-ssh/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/ssh/sandbox-ssh/.gitkeep](<H:/LFAA/packages/ssh/sandbox-ssh/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/ssh/ssh/.gitkeep](<H:/LFAA/packages/ssh/ssh/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/ssh/subprocess-ssh/.gitkeep](<H:/LFAA/packages/ssh/subprocess-ssh/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/storage/storage/.gitkeep](<H:/LFAA/packages/storage/storage/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/storage/storage-domain/.gitkeep](<H:/LFAA/packages/storage/storage-domain/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/storage/storage-json/.gitkeep](<H:/LFAA/packages/storage/storage-json/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/storage/storage-sqlite/package.json](<H:/LFAA/packages/storage/storage-sqlite/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/storage/storage-sqlite/src/database.ts](<H:/LFAA/packages/storage/storage-sqlite/src/database.ts>) | 打开控制端 SQLite 数据库并依次执行结构迁移。（storage/storage-sqlite） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/database.ts |
| [H:/LFAA/packages/storage/storage-sqlite/src/index.ts](<H:/LFAA/packages/storage/storage-sqlite/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（storage/storage-sqlite） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/subagent/subagent/.gitkeep](<H:/LFAA/packages/subagent/subagent/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/subagent-acp/.gitkeep](<H:/LFAA/packages/subagent/subagent-acp/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/subagent-claude-code/.gitkeep](<H:/LFAA/packages/subagent/subagent-claude-code/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/subagent-codex/.gitkeep](<H:/LFAA/packages/subagent/subagent-codex/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/subagent-dsh-sdk/.gitkeep](<H:/LFAA/packages/subagent/subagent-dsh-sdk/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/subagent-fork-in-process/.gitkeep](<H:/LFAA/packages/subagent/subagent-fork-in-process/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/subagent-in-process-driver/.gitkeep](<H:/LFAA/packages/subagent/subagent-in-process-driver/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/subagent-spawn-in-process/.gitkeep](<H:/LFAA/packages/subagent/subagent-spawn-in-process/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/tool-subagent/.gitkeep](<H:/LFAA/packages/subagent/tool-subagent/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subagent/tool-subagent-control/.gitkeep](<H:/LFAA/packages/subagent/tool-subagent-control/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subprocess/subprocess/.gitkeep](<H:/LFAA/packages/subprocess/subprocess/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subprocess/subprocess-local/.gitkeep](<H:/LFAA/packages/subprocess/subprocess-local/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/subprocess/win32-process/.gitkeep](<H:/LFAA/packages/subprocess/win32-process/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/telemetry/logger/package.json](<H:/LFAA/packages/telemetry/logger/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/telemetry/logger/src/logger.ts](<H:/LFAA/packages/telemetry/logger/src/logger.ts>) | 创建控制端结构化日志器。（telemetry/logger） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/logger.ts |
| [H:/LFAA/packages/telemetry/otel/.gitkeep](<H:/LFAA/packages/telemetry/otel/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/terminal/terminal/.gitkeep](<H:/LFAA/packages/terminal/terminal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/terminal/terminal-bash/.gitkeep](<H:/LFAA/packages/terminal/terminal-bash/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/terminal/tool-terminal/.gitkeep](<H:/LFAA/packages/terminal/tool-terminal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/test-support/agent-loop-testkit/.gitkeep](<H:/LFAA/packages/test-support/agent-loop-testkit/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/test-support/api/package.json](<H:/LFAA/packages/test-support/api/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/test-support/api/src/router.ts](<H:/LFAA/packages/test-support/api/src/router.ts>) | 装配各能力包的 HTTP 接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（test-support/api） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/test-support/client-runtime/.gitkeep](<H:/LFAA/packages/test-support/client-runtime/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/test-support/llm-mock-server/.gitkeep](<H:/LFAA/packages/test-support/llm-mock-server/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/test-support/llm-replay/.gitkeep](<H:/LFAA/packages/test-support/llm-replay/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/test-support/loader-smoke/.gitkeep](<H:/LFAA/packages/test-support/loader-smoke/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/test-support/remote-mock/.gitkeep](<H:/LFAA/packages/test-support/remote-mock/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/test-support/session-snapshot/.gitkeep](<H:/LFAA/packages/test-support/session-snapshot/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/todo/tool-todo/.gitkeep](<H:/LFAA/packages/todo/tool-todo/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/typert/generator/.gitkeep](<H:/LFAA/packages/typert/generator/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/typert/loader/.gitkeep](<H:/LFAA/packages/typert/loader/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/typert/protocol/.gitkeep](<H:/LFAA/packages/typert/protocol/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/typert/registry/.gitkeep](<H:/LFAA/packages/typert/registry/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/atomic-write/.gitkeep](<H:/LFAA/packages/util/atomic-write/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/brand/.gitkeep](<H:/LFAA/packages/util/brand/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/chunked-list/.gitkeep](<H:/LFAA/packages/util/chunked-list/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/code-language/.gitkeep](<H:/LFAA/packages/util/code-language/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/crypto/.gitkeep](<H:/LFAA/packages/util/crypto/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/deque/.gitkeep](<H:/LFAA/packages/util/deque/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/home-paths/package.json](<H:/LFAA/packages/util/home-paths/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/util/home-paths/src/index.d.mts](<H:/LFAA/packages/util/home-paths/src/index.d.mts>) | util/home-paths 的能力实现、类型或装配补丁 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/util/home-paths/src/index.mjs](<H:/LFAA/packages/util/home-paths/src/index.mjs>) | 定位开发或桌面运行根目录。（util/home-paths） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/util/home-paths/src/resolve-data-directory.d.mts](<H:/LFAA/packages/util/home-paths/src/resolve-data-directory.d.mts>) | util/home-paths 的能力实现、类型或装配补丁 | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/scripts/resolve-data-directory.d.mts |
| [H:/LFAA/packages/util/home-paths/src/resolve-data-directory.mjs](<H:/LFAA/packages/util/home-paths/src/resolve-data-directory.mjs>) | 解析 LFAA server 与 Daemon 共用的数据根目录。（util/home-paths） | 从原实现按职责拆分，保留原业务或设置合同 | H:/LFAA/scripts/resolve-data-directory.mjs |
| [H:/LFAA/packages/util/http-proxy/.gitkeep](<H:/LFAA/packages/util/http-proxy/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/launch-environment/package.json](<H:/LFAA/packages/util/launch-environment/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/util/launch-environment/src/config.ts](<H:/LFAA/packages/util/launch-environment/src/config.ts>) | 读取并校验控制端运行配置。（util/launch-environment） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/config.ts |
| [H:/LFAA/packages/util/lazy-require/.gitkeep](<H:/LFAA/packages/util/lazy-require/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/native-command/.gitkeep](<H:/LFAA/packages/util/native-command/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/output-retention/.gitkeep](<H:/LFAA/packages/util/output-retention/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/package-manifest/.gitkeep](<H:/LFAA/packages/util/package-manifest/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/time/.gitkeep](<H:/LFAA/packages/util/time/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/timeout/.gitkeep](<H:/LFAA/packages/util/timeout/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/util/values/package.json](<H:/LFAA/packages/util/values/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/util/values/src/http-error.ts](<H:/LFAA/packages/util/values/src/http-error.ts>) | 定义可安全返回给 API 调用方的业务错误。（util/values） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/api/http-error.ts |
| [H:/LFAA/packages/util/workspace-path/.gitkeep](<H:/LFAA/packages/util/workspace-path/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/web/tool-web/.gitkeep](<H:/LFAA/packages/web/tool-web/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/web/web/.gitkeep](<H:/LFAA/packages/web/web/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/web/web-fetch-http/.gitkeep](<H:/LFAA/packages/web/web-fetch-http/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/web/web-search-deepseek/.gitkeep](<H:/LFAA/packages/web/web-search-deepseek/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/web/web-search-exa/.gitkeep](<H:/LFAA/packages/web/web-search-exa/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/web/web-search-perplexity/.gitkeep](<H:/LFAA/packages/web/web-search-perplexity/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/webhook/webhook/.gitkeep](<H:/LFAA/packages/webhook/webhook/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/webhook/webhook-github/.gitkeep](<H:/LFAA/packages/webhook/webhook-github/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/workflow/tool-ralph/.gitkeep](<H:/LFAA/packages/workflow/tool-ralph/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/workflow/tool-workflow/.gitkeep](<H:/LFAA/packages/workflow/tool-workflow/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/workflow/workflow/.gitkeep](<H:/LFAA/packages/workflow/workflow/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/workflow/workflow-ptc/.gitkeep](<H:/LFAA/packages/workflow/workflow-ptc/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/packages/workspace/data-directory/package.json](<H:/LFAA/packages/workspace/data-directory/package.json>) | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/workspace/data-directory/src/index.ts](<H:/LFAA/packages/workspace/data-directory/src/index.ts>) | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（workspace/data-directory） | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/packages/workspace/data-directory/src/service.ts](<H:/LFAA/packages/workspace/data-directory/src/service.ts>) | 管理 Windows 本地开发环境和桌面端的数据根目录迁移请求。（workspace/data-directory） | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/src/modules/data-directory/service.ts |
| [H:/LFAA/packages/workspace/workspace/.gitkeep](<H:/LFAA/packages/workspace/workspace/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/pnpm-lock.yaml](<H:/LFAA/pnpm-lock.yaml>) | 工作区依赖或 TypeScript 包映射与根 dist 输出配置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/pnpm-workspace.yaml](<H:/LFAA/pnpm-workspace.yaml>) | 工作区依赖或 TypeScript 包映射与根 dist 输出配置 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/README.md](<H:/LFAA/README.md>) | 架构规范、开发说明或构建/运行路径规则 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/scripts/apply-data-directory-migration.mjs](<H:/LFAA/scripts/apply-data-directory-migration.mjs>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/scripts/backup-project.ps1](<H:/LFAA/scripts/backup-project.ps1>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/scripts/build-harness.mjs](<H:/LFAA/scripts/build-harness.mjs>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/scripts/configure-tauri-output.mjs](<H:/LFAA/scripts/configure-tauri-output.mjs>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/scripts/harness-workspace.d.mts](<H:/LFAA/scripts/harness-workspace.d.mts>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/scripts/harness-workspace.mjs](<H:/LFAA/scripts/harness-workspace.mjs>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 新增包实现、配置或目录占位 | — |
| [H:/LFAA/scripts/install-dependencies.ps1](<H:/LFAA/scripts/install-dependencies.ps1>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/scripts/resolve-data-directory.mjs](<H:/LFAA/scripts/resolve-data-directory.mjs>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/scripts/start-dev.ps1](<H:/LFAA/scripts/start-dev.ps1>) | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/tsconfig.client.json](<H:/LFAA/tsconfig.client.json>) | 工作区依赖或 TypeScript 包映射与根 dist 输出配置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/frontend/tsconfig.json |
| [H:/LFAA/tsconfig.host.json](<H:/LFAA/tsconfig.host.json>) | 工作区依赖或 TypeScript 包映射与根 dist 输出配置 | 迁移原实现并修正包导入/关联路径 | H:/LFAA/server/tsconfig.json |
| [H:/LFAA/开发规范.md](<H:/LFAA/开发规范.md>) | 架构规范、开发说明或构建/运行路径规则 | 修改现有入口、路径或文档 | — |
| [H:/LFAA/docs/harness-migration.md](<H:/LFAA/docs/harness-migration.md>) | 架构、实施状态、任务合同或完整迁移清单 | 新增完整交付及逐文件绝对路径清单 | — |
| [H:/LFAA/docs/harness-migration-files.json](<H:/LFAA/docs/harness-migration-files.json>) | 架构、实施状态、任务合同或完整迁移清单 | 新增完整交付及逐文件绝对路径清单 | — |

## 迁出或撤下的原文件位置

| 原绝对路径 | 变化 | 去向 |
|---|---|---|
| H:/LFAA/daemon/package.json | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/daemon/package.json |
| H:/LFAA/daemon/sandbox-host/Cargo.lock | 原路径移出，目标包提供实际实现 | H:/LFAA/native/system/Cargo.lock |
| H:/LFAA/daemon/sandbox-host/Cargo.toml | 原路径移出，目标包提供实际实现 | H:/LFAA/native/system/Cargo.toml |
| H:/LFAA/daemon/sandbox-host/src/main.rs | 原路径移出，目标包提供实际实现 | H:/LFAA/native/system/src/main.rs |
| H:/LFAA/daemon/src/connection/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/daemon/src/connection/.gitkeep |
| H:/LFAA/daemon/src/monitoring/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/daemon/src/monitoring/.gitkeep |
| H:/LFAA/daemon/src/process-manager/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/daemon/src/process-manager/.gitkeep |
| H:/LFAA/daemon/src/runners/minecraft/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/daemon/src/runners/minecraft/.gitkeep |
| H:/LFAA/daemon/src/runners/steamcmd/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/daemon/src/runners/steamcmd/.gitkeep |
| H:/LFAA/daemon/src/task-runner/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/daemon/src/task-runner/.gitkeep |
| H:/LFAA/daemon/src/task-runner/minecraft-daemon.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/host/daemon/src/minecraft-daemon.mjs |
| H:/LFAA/daemon/src/terminal/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/daemon/src/terminal/.gitkeep |
| H:/LFAA/frontend/index.html | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/index.html |
| H:/LFAA/frontend/package.json | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/package.json |
| H:/LFAA/frontend/public/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/public/.gitkeep |
| H:/LFAA/frontend/public/backgrounds/minecraft-world.jpg | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/backgrounds/minecraft-world.jpg |
| H:/LFAA/frontend/public/backgrounds/service-room.jpg | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/backgrounds/service-room.jpg |
| H:/LFAA/frontend/public/backgrounds/steamcmd-world.jpg | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/backgrounds/steamcmd-world.jpg |
| H:/LFAA/frontend/public/backgrounds/writing-desk.jpg | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/backgrounds/writing-desk.jpg |
| H:/LFAA/frontend/public/fonts/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/public/fonts/.gitkeep |
| H:/LFAA/frontend/public/images/minecraft/cherry-blossom-shore.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-shore.png |
| H:/LFAA/frontend/public/images/minecraft/cherry-blossom-village.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-village.png |
| H:/LFAA/frontend/public/images/minecraft/flower-meadow-castle.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/flower-meadow-castle.png |
| H:/LFAA/frontend/public/images/minecraft/forest-bridge-evening.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/forest-bridge-evening.png |
| H:/LFAA/frontend/public/images/minecraft/golden-wheat-field.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/golden-wheat-field.png |
| H:/LFAA/frontend/public/images/minecraft/lakeside-pagoda-morning.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/lakeside-pagoda-morning.png |
| H:/LFAA/frontend/public/images/minecraft/ocean-cliff-sunset.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/ocean-cliff-sunset.png |
| H:/LFAA/frontend/public/images/minecraft/rainy-grassland.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/rainy-grassland.png |
| H:/LFAA/frontend/public/images/minecraft/snowy-cabin-interior.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/snowy-cabin-interior.png |
| H:/LFAA/frontend/public/images/minecraft/tropical-coast-day.png | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/public/images/minecraft/tropical-coast-day.png |
| H:/LFAA/frontend/scripts/wait-for-server.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/scripts/wait-for-server.mjs |
| H:/LFAA/frontend/src/App.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-renderer/src/App.tsx |
| H:/LFAA/frontend/src/api.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/connection/src/api.ts |
| H:/LFAA/frontend/src/app-shell/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/app-shell/.gitkeep |
| H:/LFAA/frontend/src/apps/minecraft/ai-work/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/apps/minecraft/ai-work/.gitkeep |
| H:/LFAA/frontend/src/apps/minecraft/normal/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/apps/minecraft/normal/.gitkeep |
| H:/LFAA/frontend/src/apps/steamcmd/ai-work/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/apps/steamcmd/ai-work/.gitkeep |
| H:/LFAA/frontend/src/apps/steamcmd/normal/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/apps/steamcmd/normal/.gitkeep |
| H:/LFAA/frontend/src/apps/writing/ai-work/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/apps/writing/ai-work/.gitkeep |
| H:/LFAA/frontend/src/apps/writing/ai-work/WritingAiContext.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.css |
| H:/LFAA/frontend/src/apps/writing/ai-work/WritingAiContext.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.tsx |
| H:/LFAA/frontend/src/apps/writing/normal/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/apps/writing/normal/.gitkeep |
| H:/LFAA/frontend/src/apps/writing/normal/WritingWorkspace.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.css |
| H:/LFAA/frontend/src/apps/writing/normal/WritingWorkspace.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.tsx |
| H:/LFAA/frontend/src/assets/minecraftScenes.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-minecraft/src/assets/minecraftScenes.ts |
| H:/LFAA/frontend/src/components/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/components/.gitkeep |
| H:/LFAA/frontend/src/components/AdminUsersPage.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings-account/src/AdminUsersPage.tsx |
| H:/LFAA/frontend/src/components/AiMarkdown.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-chat/src/AiMarkdown.tsx |
| H:/LFAA/frontend/src/components/AiWorkChat.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-chat/src/AiWorkChat.tsx |
| H:/LFAA/frontend/src/components/ApplicationWorkspace.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-workspace/src/ApplicationWorkspace.tsx |
| H:/LFAA/frontend/src/components/AuthView.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings-account/src/AuthView.tsx |
| H:/LFAA/frontend/src/components/FileManagerPage.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.css |
| H:/LFAA/frontend/src/components/FileManagerPage.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.tsx |
| H:/LFAA/frontend/src/components/GlobalNavigationRail.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-sidebar/src/GlobalNavigationRail.tsx |
| H:/LFAA/frontend/src/components/MinecraftWorkspace.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.css |
| H:/LFAA/frontend/src/components/MinecraftWorkspace.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.tsx |
| H:/LFAA/frontend/src/components/PasskeyManager.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings-account/src/PasskeyManager.tsx |
| H:/LFAA/frontend/src/components/PasskeySetupPrompt.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings-account/src/PasskeySetupPrompt.tsx |
| H:/LFAA/frontend/src/components/PasswordStrengthIndicator.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings-account/src/PasswordStrengthIndicator.tsx |
| H:/LFAA/frontend/src/components/ServiceStatus.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-primitives/src/ServiceStatus.tsx |
| H:/LFAA/frontend/src/components/SettingsPage.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings/src/SettingsPage.css |
| H:/LFAA/frontend/src/components/SettingsPage.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx |
| H:/LFAA/frontend/src/components/SetupReminder.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings-general/src/SetupReminder.tsx |
| H:/LFAA/frontend/src/components/Workbench.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-layout/src/Workbench.tsx |
| H:/LFAA/frontend/src/components/ai-work-chat.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-chat/src/ai-work-chat.css |
| H:/LFAA/frontend/src/components/module-workbench.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-workspace/src/module-workbench.css |
| H:/LFAA/frontend/src/components/workbench/shared/WorkbenchIcon.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-primitives/src/WorkbenchIcon.tsx |
| H:/LFAA/frontend/src/main.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-renderer/src/render.tsx |
| H:/LFAA/frontend/src/realtime/minecraft-socket.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/connection/src/minecraft-socket.ts |
| H:/LFAA/frontend/src/shared/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/shared/.gitkeep |
| H:/LFAA/frontend/src/shared/login-background.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-theme/src/login-background.ts |
| H:/LFAA/frontend/src/shared/notification-runtime.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/resources/src/notification-runtime.ts |
| H:/LFAA/frontend/src/shared/scroll-restoration.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/store/src/scroll-restoration.ts |
| H:/LFAA/frontend/src/shared/setup-reminder.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings-general/src/setup-reminder.ts |
| H:/LFAA/frontend/src/styles/application-workspace.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-workspace/src/application-workspace.css |
| H:/LFAA/frontend/src/styles/auth.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-settings-account/src/auth.css |
| H:/LFAA/frontend/src/styles/base.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-theme/src/base.css |
| H:/LFAA/frontend/src/styles/common.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-theme/src/common.css |
| H:/LFAA/frontend/src/styles/pages.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-layout/src/pages.css |
| H:/LFAA/frontend/src/styles/responsive.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-theme/src/responsive.css |
| H:/LFAA/frontend/src/styles/tokens.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-theme/src/tokens.css |
| H:/LFAA/frontend/src/styles/workbench.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-layout/src/workbench.css |
| H:/LFAA/frontend/src/terminal/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/frontend/src/terminal/.gitkeep |
| H:/LFAA/frontend/src/workbench/ResizableWorkbench.tsx | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-dockkit/src/ResizableWorkbench.tsx |
| H:/LFAA/frontend/src/workbench/ui-resize/damped-motion.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-dockkit/src/ui-resize/damped-motion.ts |
| H:/LFAA/frontend/src/workbench/workbench-interaction.config.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-dockkit/src/workbench-interaction.config.ts |
| H:/LFAA/frontend/src/workbench/workbench-layout.config.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.config.ts |
| H:/LFAA/frontend/src/workbench/workbench-layout.types.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.types.ts |
| H:/LFAA/frontend/src/workbench/workbench-preferences.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-dockkit/src/workbench-preferences.ts |
| H:/LFAA/frontend/src/workbench/workbench.css | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/client/ui-dockkit/src/workbench.css |
| H:/LFAA/frontend/tsconfig.json | 原路径移出，目标包提供实际实现 | H:/LFAA/tsconfig.client.json |
| H:/LFAA/frontend/vite.config.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/web/vite.config.ts |
| H:/LFAA/packages/harness/kernel/README.md | 撤下原自定义内核，原文件保存在快照；由 app-boot 负责新装配 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-kernel/README.md |
| H:/LFAA/packages/harness/kernel/package.json | 撤下原自定义内核，原文件保存在快照；由 app-boot 负责新装配 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-kernel/package.json |
| H:/LFAA/packages/harness/kernel/src/index.ts | 撤下原自定义内核，原文件保存在快照；由 app-boot 负责新装配 | H:/LFAA/dist/.tmp/harness-migration-original/packages/harness/kernel/src/index.ts |
| H:/LFAA/packages/harness/kernel/tsconfig.json | 撤下原自定义内核，原文件保存在快照；由 app-boot 负责新装配 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-kernel/tsconfig.json |
| H:/LFAA/server/package-loader.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/cli/package-loader.mjs |
| H:/LFAA/server/package.json | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/cli/package.json |
| H:/LFAA/server/register-package-loader.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/cli/register-package-loader.mjs |
| H:/LFAA/server/scripts/python/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/server/scripts/python/.gitkeep |
| H:/LFAA/server/src/ai/agent/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/ai/agent/.gitkeep |
| H:/LFAA/server/src/ai/business-tools.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/core/tools/src/business-tools.ts |
| H:/LFAA/server/src/ai/host.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/boot/app-boot/src/ai-host.ts |
| H:/LFAA/server/src/ai/llm/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/ai/llm/.gitkeep |
| H:/LFAA/server/src/ai/permissions.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/interaction/permission-presets/src/permissions.ts |
| H:/LFAA/server/src/ai/plugins/builtin-catalog.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts |
| H:/LFAA/server/src/ai/plugins/extension-registry.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/core/agent/src/extension-registry.ts |
| H:/LFAA/server/src/ai/plugins/runtime-hooks.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/hooks/hook-protocol/src/runtime-hooks.ts |
| H:/LFAA/server/src/ai/prompts/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/ai/prompts/.gitkeep |
| H:/LFAA/server/src/ai/prompts/writing.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/document/writing/src/prompts.ts |
| H:/LFAA/server/src/ai/runtime.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/core/agent-loop/src/runtime.ts |
| H:/LFAA/server/src/ai/sessions.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/core/session/src/sessions.ts |
| H:/LFAA/server/src/ai/skills/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/ai/skills/.gitkeep |
| H:/LFAA/server/src/ai/skills/writing-skills.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/skill/writing/src/writing-skills.ts |
| H:/LFAA/server/src/ai/subagents/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/ai/subagents/.gitkeep |
| H:/LFAA/server/src/ai/tools/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/ai/tools/.gitkeep |
| H:/LFAA/server/src/api/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/api/.gitkeep |
| H:/LFAA/server/src/api/http-error.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/util/values/src/http-error.ts |
| H:/LFAA/server/src/api/routes.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/api/gateway/src/index.ts |
| H:/LFAA/server/src/config.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/util/launch-environment/src/config.ts |
| H:/LFAA/server/src/database.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/storage/storage-sqlite/src/database.ts |
| H:/LFAA/server/src/index.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/host/webserver/src/server.ts |
| H:/LFAA/server/src/logger.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/telemetry/logger/src/logger.ts |
| H:/LFAA/server/src/middleware/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/middleware/.gitkeep |
| H:/LFAA/server/src/middleware/auth.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/credentials/authorization/src/middleware.ts |
| H:/LFAA/server/src/middleware/rate-limit.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/api/remotes/src/rate-limit.ts |
| H:/LFAA/server/src/modules/auth/.gitkeep | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/identity/auth/src/.gitkeep |
| H:/LFAA/server/src/modules/auth/index.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/identity/auth/src/index.ts |
| H:/LFAA/server/src/modules/auth/passkeys.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/identity/auth/src/passkeys.ts |
| H:/LFAA/server/src/modules/auth/password-policy.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/identity/auth/src/password-policy.ts |
| H:/LFAA/server/src/modules/auth/service.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/identity/auth/src/service.ts |
| H:/LFAA/server/src/modules/data-directory/service.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/workspace/data-directory/src/service.ts |
| H:/LFAA/server/src/modules/files/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/files/.gitkeep |
| H:/LFAA/server/src/modules/files/queue.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/fs/fs/src/queue.ts |
| H:/LFAA/server/src/modules/games/catalog/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/games/catalog/.gitkeep |
| H:/LFAA/server/src/modules/games/config/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/games/config/.gitkeep |
| H:/LFAA/server/src/modules/games/deployment/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/games/deployment/.gitkeep |
| H:/LFAA/server/src/modules/games/instances/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/games/instances/.gitkeep |
| H:/LFAA/server/src/modules/games/minecraft/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/games/minecraft/.gitkeep |
| H:/LFAA/server/src/modules/games/minecraft/catalog.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/games/minecraft/src/catalog.ts |
| H:/LFAA/server/src/modules/games/minecraft/service.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/games/minecraft/src/service.ts |
| H:/LFAA/server/src/modules/games/steamcmd/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/games/steamcmd/.gitkeep |
| H:/LFAA/server/src/modules/games/steamcmd/service.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/games/steamcmd/src/service.ts |
| H:/LFAA/server/src/modules/monitoring/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/monitoring/.gitkeep |
| H:/LFAA/server/src/modules/nodes/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/nodes/.gitkeep |
| H:/LFAA/server/src/modules/nodes/ai-host-tasks.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts |
| H:/LFAA/server/src/modules/nodes/local-daemon.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/host/daemon/src/local-daemon.ts |
| H:/LFAA/server/src/modules/preferences/index.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/settings/settings/src/preferences/index.ts |
| H:/LFAA/server/src/modules/preferences/service.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/settings/settings/src/preferences/service.ts |
| H:/LFAA/server/src/modules/settings/service.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/settings/settings/src/service.ts |
| H:/LFAA/server/src/modules/tasks/minecraft-queue.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/jobs/jobs/src/minecraft-queue.ts |
| H:/LFAA/server/src/modules/writing/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/modules/writing/.gitkeep |
| H:/LFAA/server/src/modules/writing/service.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/document/writing/src/service.ts |
| H:/LFAA/server/src/realtime/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/realtime/.gitkeep |
| H:/LFAA/server/src/realtime/socket-server.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/api/remotes/src/socket-server.ts |
| H:/LFAA/server/src/types/express.d.ts | 原路径移出，目标包提供实际实现 | H:/LFAA/packages/api/gateway/src/express.d.ts |
| H:/LFAA/server/src/utils/.gitkeep | 源码迁入目标包；原占位保存在迁移快照 | H:/LFAA/dist/.tmp/harness-migration-original/obsolete-placeholders/utils/.gitkeep |
| H:/LFAA/server/test/data-directory.test.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/cli/tests/data-directory.test.mjs |
| H:/LFAA/server/test/database-migrations.test.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/cli/tests/database-migrations.test.mjs |
| H:/LFAA/server/test/file-manager-api.test.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/cli/tests/file-manager-api.test.mjs |
| H:/LFAA/server/test/minecraft-task-leases.test.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/cli/tests/minecraft-task-leases.test.mjs |
| H:/LFAA/server/test/realtime-socket.test.mjs | 原路径移出，目标包提供实际实现 | H:/LFAA/apps/cli/tests/realtime-socket.test.mjs |
| H:/LFAA/server/tsconfig.json | 原路径移出，目标包提供实际实现 | H:/LFAA/tsconfig.host.json |
