# Harness 交付绝对文件清单

本表记录生成时工作树相对 HEAD 的已跟踪变化和未跟踪项目文件，并补充本轮已删除的三项占位文件；并行任务单独标注，不认领其实现或验收。Git 未提交；删除和重命名同时列出旧路径。生成产物与运行数据不纳入源码清单，见交付记录。

实际验证与设置盘点见 [交付记录](harness-delivery.md)；逐项机器记录见 [JSON](harness-delivery-files.json)。

| 绝对文件路径 | Git 状态/旧路径 | 职责 | 本次变化 | 归属 |
|---|---|---|---|---|
| [H:/LFAA/.env.example](<H:/LFAA/.env.example>) | M | 架构规范、开发说明或构建/运行路径规则 | 修改现有入口、路径或文档 | 本轮 CLI/存储 |
| [H:/LFAA/.gitignore](<H:/LFAA/.gitignore>) | M | 架构规范、开发说明或构建/运行路径规则 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/AGENTS.md](<H:/LFAA/AGENTS.md>) | M | 项目配置或迁移文件 | 按新包架构维护入口、实现或引用 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/bin/lfaa.mjs](<H:/LFAA/apps/cli/bin/lfaa.mjs>) | A | CLI 命令 | 源码/npm 统一启动、环境解析、持久数据目录与本机生产校验 | 本轮 CLI/存储 |
| [H:/LFAA/apps/cli/config/profiles/daemon/package.json](<H:/LFAA/apps/cli/config/profiles/daemon/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/config/profiles/desktop/package.json](<H:/LFAA/apps/cli/config/profiles/desktop/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/config/profiles/web/package.json](<H:/LFAA/apps/cli/config/profiles/web/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/package-loader.mjs](<H:/LFAA/apps/cli/package-loader.mjs>) | A | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/package.json](<H:/LFAA/apps/cli/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 迁移原实现并修正包导入/关联路径 | 本轮 CLI/存储 |
| [H:/LFAA/apps/cli/register-package-loader.mjs](<H:/LFAA/apps/cli/register-package-loader.mjs>) | A | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/src/index.ts](<H:/LFAA/apps/cli/src/index.ts>) | A | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/tests/agent-runtime.test.mjs](<H:/LFAA/apps/cli/tests/agent-runtime.test.mjs>) | untracked | 回归后台 Agent、工具协议、执行预算和权限提示。 | 仅在隔离测试数据与合成 Provider 流中验证断线、重连、取消、账户隔离和历史恢复。 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/apps/cli/tests/client-requests.test.mjs](<H:/LFAA/apps/cli/tests/client-requests.test.mjs>) | untracked | 验证前端同一时刻的只读请求合并及写入边界。 | 用合成响应统计真实 API 函数的 fetch 次数，确保读取无长期缓存、失败可重试、身份切换不复用旧请求。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/tests/data-directory.test.mjs](<H:/LFAA/apps/cli/tests/data-directory.test.mjs>) | A | 迁入的既有验证用例，仅调整包导入与位置 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/tests/database-migrations.test.mjs](<H:/LFAA/apps/cli/tests/database-migrations.test.mjs>) | A | 长期数据库升级回归 | 补齐 v8/v10/v22 夹具和行对象原型比较，保留升级断言 | 本轮 CLI/存储 |
| [H:/LFAA/apps/cli/tests/file-manager-api.test.mjs](<H:/LFAA/apps/cli/tests/file-manager-api.test.mjs>) | A | 迁入的既有验证用例，仅调整包导入与位置 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/tests/file-storage.test.mjs](<H:/LFAA/apps/cli/tests/file-storage.test.mjs>) | untracked | 长期混合存储回归 | 旧数据导入、权限隔离、Provider 密文、重启/篡改/磁盘失败和账户删除 | 本轮 CLI/存储 |
| [H:/LFAA/apps/cli/tests/helpers/historical-database.mjs](<H:/LFAA/apps/cli/tests/helpers/historical-database.mjs>) | untracked | 长期历史数据库夹具工具 | 按真实迁移链构造完整历史 schema，不添加生产测试开关 | 本轮 CLI/存储 |
| [H:/LFAA/apps/cli/tests/http-delivery.test.mjs](<H:/LFAA/apps/cli/tests/http-delivery.test.mjs>) | untracked | 回归验证生产前端的 HTTP 缓存、图标、页面回退与日志级别。 | 使用根 dist/.tmp 中的合成静态夹具和真实 HTTP 服务，防止重复下载及资源请求误返回 HTML。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/tests/minecraft-task-leases.test.mjs](<H:/LFAA/apps/cli/tests/minecraft-task-leases.test.mjs>) | R091；原 [路径](<H:/LFAA/server/test/minecraft-task-leases.test.mjs>) | 迁入的既有验证用例，仅调整包导入与位置 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/cli/tests/realtime-socket.test.mjs](<H:/LFAA/apps/cli/tests/realtime-socket.test.mjs>) | A | 长期实时认证回归 | 心跳夹具补齐真实合同必填 dataRoot | 本轮 CLI/存储 |
| [H:/LFAA/apps/cli/tsconfig.json](<H:/LFAA/apps/cli/tsconfig.json>) | A | 命令行入口、包解析器和命名 Profile 配置 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/daemon/package.json](<H:/LFAA/apps/daemon/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/daemon/src/index.mjs](<H:/LFAA/apps/daemon/src/index.mjs>) | A | 独立节点进程入口及原生 Host 构建 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-electron/nsis/installer.nsh](<H:/LFAA/apps/desktop-electron/nsis/installer.nsh>) | A | 在卸载或覆盖安装时保留安装目录中的 LFAA 运行数据。 | 复用 electron-builder 的安全文件移出流程，只把程序安装文件清出安装目录，再恢复 data/ 数据树。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-electron/package.json](<H:/LFAA/apps/desktop-electron/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 修改现有入口、路径或文档 | 本轮 CLI/存储 |
| [H:/LFAA/apps/desktop-electron/scripts/prepare-runtime.mjs](<H:/LFAA/apps/desktop-electron/scripts/prepare-runtime.mjs>) | A | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | 本轮 CLI/存储 |
| [H:/LFAA/apps/desktop-electron/src/main.mjs](<H:/LFAA/apps/desktop-electron/src/main.mjs>) | A | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-electron/src/preload.cjs](<H:/LFAA/apps/desktop-electron/src/preload.cjs>) | A | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-host/.gitkeep](<H:/LFAA/apps/desktop-host/.gitkeep>) | untracked | 上游同名包目录占位 | 仅保留目录，不声明可用能力 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-tauri/package.json](<H:/LFAA/apps/desktop-tauri/package.json>) | A | 工作区包清单 | 声明实际包、公开入口、运行组合与依赖 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-tauri/scripts/package-windows.mjs](<H:/LFAA/apps/desktop-tauri/scripts/package-windows.mjs>) | A | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | 本轮 CLI/存储 |
| [H:/LFAA/apps/desktop-tauri/scripts/run-tauri-dev.mjs](<H:/LFAA/apps/desktop-tauri/scripts/run-tauri-dev.mjs>) | A | 在根 dist 目录内启动 Tauri 桌面开发壳。 | 把 Cargo 调试产物固定到 dist/apps/desktop-tauri/target，避免桌面源码目录出现 target 构建目录。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-tauri/src-tauri/build.rs](<H:/LFAA/apps/desktop-tauri/src-tauri/build.rs>) | A | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-tauri/src-tauri/capabilities/local-server-ui.json](<H:/LFAA/apps/desktop-tauri/src-tauri/capabilities/local-server-ui.json>) | A | 项目配置或迁移文件 | 按新包架构维护入口、实现或引用 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-tauri/src-tauri/Cargo.lock](<H:/LFAA/apps/desktop-tauri/src-tauri/Cargo.lock>) | A | 项目配置或迁移文件 | 按新包架构维护入口、实现或引用 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-tauri/src-tauri/Cargo.toml](<H:/LFAA/apps/desktop-tauri/src-tauri/Cargo.toml>) | A | 定义 LFAA Windows 桌面外壳的 Rust 构建包和平台依赖。 | 以 Tauri WebView2 显示本机 Web 界面，并管理随安装包提供的 Node 控制端与 Daemon 进程。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-tauri/src-tauri/src/main.rs](<H:/LFAA/apps/desktop-tauri/src-tauri/src/main.rs>) | A | 既有桌面外壳，接入新编译入口、Daemon 配置和根 dist 输出 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop-tauri/src-tauri/tauri.conf.json](<H:/LFAA/apps/desktop-tauri/src-tauri/tauri.conf.json>) | A | 项目配置或迁移文件 | 按新包架构维护入口、实现或引用 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/desktop/.gitkeep](<H:/LFAA/apps/desktop/.gitkeep>) | untracked | 上游同名包目录占位 | 仅保留目录，不声明可用能力 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/index.html](<H:/LFAA/apps/web/index.html>) | R090；原 [路径](<H:/LFAA/frontend/index.html>) | Web 开发入口、Vite 与类型检查配置 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/package.json](<H:/LFAA/apps/web/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/backgrounds/minecraft-world.jpg](<H:/LFAA/apps/web/public/backgrounds/minecraft-world.jpg>) | R100；原 [路径](<H:/LFAA/frontend/public/backgrounds/minecraft-world.jpg>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/backgrounds/service-room.jpg](<H:/LFAA/apps/web/public/backgrounds/service-room.jpg>) | R100；原 [路径](<H:/LFAA/frontend/public/backgrounds/service-room.jpg>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/backgrounds/steamcmd-world.jpg](<H:/LFAA/apps/web/public/backgrounds/steamcmd-world.jpg>) | R100；原 [路径](<H:/LFAA/frontend/public/backgrounds/steamcmd-world.jpg>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/backgrounds/writing-desk.jpg](<H:/LFAA/apps/web/public/backgrounds/writing-desk.jpg>) | R100；原 [路径](<H:/LFAA/frontend/public/backgrounds/writing-desk.jpg>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/favicon.svg](<H:/LFAA/apps/web/public/favicon.svg>) | untracked | 提供浏览器标签页的 LFAA 图标。作用：以中性黑白标识替代缺失的默认图标请求。关联文件：apps/web/index.html、packages/host/webserver/src/http-delivery.ts。 --> | 以中性黑白标识替代缺失的默认图标请求。关联文件：apps/web/index.html、packages/host/webserver/src/http-delivery.ts。 --> | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-shore.png](<H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-shore.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/cherry-blossom-shore.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-village.png](<H:/LFAA/apps/web/public/images/minecraft/cherry-blossom-village.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/cherry-blossom-village.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/flower-meadow-castle.png](<H:/LFAA/apps/web/public/images/minecraft/flower-meadow-castle.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/flower-meadow-castle.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/forest-bridge-evening.png](<H:/LFAA/apps/web/public/images/minecraft/forest-bridge-evening.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/forest-bridge-evening.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/golden-wheat-field.png](<H:/LFAA/apps/web/public/images/minecraft/golden-wheat-field.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/golden-wheat-field.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/lakeside-pagoda-morning.png](<H:/LFAA/apps/web/public/images/minecraft/lakeside-pagoda-morning.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/lakeside-pagoda-morning.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/ocean-cliff-sunset.png](<H:/LFAA/apps/web/public/images/minecraft/ocean-cliff-sunset.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/ocean-cliff-sunset.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/rainy-grassland.png](<H:/LFAA/apps/web/public/images/minecraft/rainy-grassland.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/rainy-grassland.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/snowy-cabin-interior.png](<H:/LFAA/apps/web/public/images/minecraft/snowy-cabin-interior.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/snowy-cabin-interior.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/public/images/minecraft/tropical-coast-day.png](<H:/LFAA/apps/web/public/images/minecraft/tropical-coast-day.png>) | R100；原 [路径](<H:/LFAA/frontend/public/images/minecraft/tropical-coast-day.png>) | 原公共静态资源，资源内容保持原样 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/scripts/wait-for-server.mjs](<H:/LFAA/apps/web/scripts/wait-for-server.mjs>) | A | Web 开发入口、Vite 与类型检查配置 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/src/main.tsx](<H:/LFAA/apps/web/src/main.tsx>) | A | Web 开发入口、Vite 与类型检查配置 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/tsconfig.json](<H:/LFAA/apps/web/tsconfig.json>) | A | Web 开发入口、Vite 与类型检查配置 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/apps/web/vite.config.ts](<H:/LFAA/apps/web/vite.config.ts>) | A | Web 开发入口、Vite 与类型检查配置 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/daemon/package.json](<H:/LFAA/daemon/package.json>) | D | 工作区包清单 | 声明实际包、公开入口、运行组合与依赖 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/daemon/src/task-runner/minecraft-daemon.mjs](<H:/LFAA/daemon/src/task-runner/minecraft-daemon.mjs>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/docs/harness-cleanup-files.json](<H:/LFAA/docs/harness-cleanup-files.json>) | untracked | 架构或交付文档 | 登记当前合同、目录状态、绝对文件职责与真实验证 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/docs/harness-cleanup.md](<H:/LFAA/docs/harness-cleanup.md>) | untracked | 架构或交付文档 | 登记当前合同、目录状态、绝对文件职责与真实验证 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/docs/harness-cli.md](<H:/LFAA/docs/harness-cli.md>) | untracked | 架构或交付文档 | 登记当前合同、目录状态、绝对文件职责与真实验证 | 本轮 CLI/存储 |
| [H:/LFAA/docs/harness-delivery-files.json](<H:/LFAA/docs/harness-delivery-files.json>) | new | 架构或交付文档 | 登记当前合同、目录状态、绝对文件职责与真实验证 | 本轮 CLI/存储 |
| [H:/LFAA/docs/harness-delivery-files.md](<H:/LFAA/docs/harness-delivery-files.md>) | new | 架构或交付文档 | 登记当前合同、目录状态、绝对文件职责与真实验证 | 本轮 CLI/存储 |
| [H:/LFAA/docs/harness-delivery.md](<H:/LFAA/docs/harness-delivery.md>) | untracked | 架构或交付文档 | 登记当前合同、目录状态、绝对文件职责与真实验证 | 本轮 CLI/存储 |
| [H:/LFAA/docs/harness-migration-files.json](<H:/LFAA/docs/harness-migration-files.json>) | untracked | 架构、实施状态、任务合同或完整迁移清单 | 新增完整交付及逐文件绝对路径清单 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/docs/harness-migration.md](<H:/LFAA/docs/harness-migration.md>) | untracked | 架构、实施状态、任务合同或完整迁移清单 | 新增完整交付及逐文件绝对路径清单 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/docs/harness-packages.json](<H:/LFAA/docs/harness-packages.json>) | untracked | 架构、实施状态、任务合同或完整迁移清单 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/docs/harness-packages.md](<H:/LFAA/docs/harness-packages.md>) | untracked | 架构、实施状态、任务合同或完整迁移清单 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/docs/harness-storage.md](<H:/LFAA/docs/harness-storage.md>) | untracked | 架构或交付文档 | 登记当前合同、目录状态、绝对文件职责与真实验证 | 本轮 CLI/存储 |
| [H:/LFAA/docs/PROMPTS.md](<H:/LFAA/docs/PROMPTS.md>) | M | 架构、实施状态、任务合同或完整迁移清单 | 修改现有入口、路径或文档 | 共享文件：本轮存储改动与并行工作并存 |
| [H:/LFAA/docs/开发计划.md](<H:/LFAA/docs/开发计划.md>) | M | 架构、实施状态、任务合同或完整迁移清单 | 修改现有入口、路径或文档 | 共享文件：本轮存储改动与并行工作并存 |
| [H:/LFAA/docs/系统总体架构.md](<H:/LFAA/docs/系统总体架构.md>) | M | 架构、实施状态、任务合同或完整迁移清单 | 修改现有入口、路径或文档 | 共享文件：本轮存储改动与并行工作并存 |
| [H:/LFAA/docs/设置中心审查与整改待办.md](<H:/LFAA/docs/设置中心审查与整改待办.md>) | untracked | 架构或交付文档 | 登记当前合同、目录状态、绝对文件职责与真实验证 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/package.json](<H:/LFAA/frontend/package.json>) | D | 工作区包清单 | 声明实际包、公开入口、运行组合与依赖 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/public/fonts/.gitkeep](<H:/LFAA/frontend/public/fonts/.gitkeep>) | D | 上游同名包目录占位 | 仅保留目录，不声明可用能力 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/src/api.ts](<H:/LFAA/frontend/src/api.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/src/components/AdminUsersPage.tsx](<H:/LFAA/frontend/src/components/AdminUsersPage.tsx>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/src/components/ai-work-chat.css](<H:/LFAA/frontend/src/components/ai-work-chat.css>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/src/components/AiWorkChat.tsx](<H:/LFAA/frontend/src/components/AiWorkChat.tsx>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/src/components/MinecraftWorkspace.css](<H:/LFAA/frontend/src/components/MinecraftWorkspace.css>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/src/components/MinecraftWorkspace.tsx](<H:/LFAA/frontend/src/components/MinecraftWorkspace.tsx>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/src/main.tsx](<H:/LFAA/frontend/src/main.tsx>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/tsconfig.json](<H:/LFAA/frontend/tsconfig.json>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/frontend/vite.config.ts](<H:/LFAA/frontend/vite.config.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/native/system/Cargo.lock](<H:/LFAA/native/system/Cargo.lock>) | R100；原 [路径](<H:/LFAA/daemon/sandbox-host/Cargo.lock>) | 原 Windows Sandbox Host 原生实现与 Cargo 依赖 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/native/system/Cargo.toml](<H:/LFAA/native/system/Cargo.toml>) | R094；原 [路径](<H:/LFAA/daemon/sandbox-host/Cargo.toml>) | 原 Windows Sandbox Host 原生实现与 Cargo 依赖 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/native/system/src/main.rs](<H:/LFAA/native/system/src/main.rs>) | R067；原 [路径](<H:/LFAA/daemon/sandbox-host/src/main.rs>) | 原 Windows Sandbox Host 原生实现与 Cargo 依赖 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/package.json](<H:/LFAA/package.json>) | M | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 修改现有入口、路径或文档 | 本轮 CLI/存储 |
| [H:/LFAA/packages/acp/acp/.gitkeep](<H:/LFAA/packages/acp/acp/.gitkeep>) | R100；原 [路径](<H:/LFAA/daemon/src/connection/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/account-controller/package.json](<H:/LFAA/packages/api/account-controller/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/account-controller/src/index.ts](<H:/LFAA/packages/api/account-controller/src/index.ts>) | A | 登记 account-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/account-controller） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/gateway/package.json](<H:/LFAA/packages/api/gateway/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/gateway/src/express.d.ts](<H:/LFAA/packages/api/gateway/src/express.d.ts>) | R065；原 [路径](<H:/LFAA/server/src/types/express.d.ts>) | 为 Express 请求增加通过服务端会话校验的身份信息。（api/gateway） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/gateway/src/health-controller.ts](<H:/LFAA/packages/api/gateway/src/health-controller.ts>) | A | 登记 gateway 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/gateway） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/gateway/src/index.ts](<H:/LFAA/packages/api/gateway/src/index.ts>) | A | 提供可组合的 HTTP 路由服务。（api/gateway） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/job-controller/package.json](<H:/LFAA/packages/api/job-controller/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/job-controller/src/index.ts](<H:/LFAA/packages/api/job-controller/src/index.ts>) | A | 登记 job-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/job-controller） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/minecraft-controller/package.json](<H:/LFAA/packages/api/minecraft-controller/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/minecraft-controller/src/index.ts](<H:/LFAA/packages/api/minecraft-controller/src/index.ts>) | A | 登记 minecraft-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/minecraft-controller） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/remotes/package.json](<H:/LFAA/packages/api/remotes/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/remotes/src/rate-limit.ts](<H:/LFAA/packages/api/remotes/src/rate-limit.ts>) | R095；原 [路径](<H:/LFAA/server/src/middleware/rate-limit.ts>) | 限制同一来源短时间内的敏感请求数量。（api/remotes） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/remotes/src/route-contracts.ts](<H:/LFAA/packages/api/remotes/src/route-contracts.ts>) | A | 定义 HTTP 请求校验和共享响应合同。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/remotes） | 从原实现按职责拆分，保留原业务或设置合同 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/api/remotes/src/socket-server.ts](<H:/LFAA/packages/api/remotes/src/socket-server.ts>) | A | 为已登录的 LFAA 页面提供 Minecraft 实时变更通知。（api/remotes） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/session-controller/package.json](<H:/LFAA/packages/api/session-controller/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/api/session-controller/src/index.ts](<H:/LFAA/packages/api/session-controller/src/index.ts>) | A | 登记 session-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/session-controller） | 从原实现按职责拆分，保留原业务或设置合同 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/api/settings-controller/package.json](<H:/LFAA/packages/api/settings-controller/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/settings-controller/src/index.ts](<H:/LFAA/packages/api/settings-controller/src/index.ts>) | A | 登记 settings-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/settings-controller） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/steamcmd-controller/package.json](<H:/LFAA/packages/api/steamcmd-controller/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/steamcmd-controller/src/index.ts](<H:/LFAA/packages/api/steamcmd-controller/src/index.ts>) | A | 登记 steamcmd-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/steamcmd-controller） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/terminal-controller/.gitkeep](<H:/LFAA/packages/api/terminal-controller/.gitkeep>) | R100；原 [路径](<H:/LFAA/daemon/src/monitoring/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/workspace-controller/.gitkeep](<H:/LFAA/packages/api/workspace-controller/.gitkeep>) | R100；原 [路径](<H:/LFAA/daemon/src/process-manager/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/workspace-files/package.json](<H:/LFAA/packages/api/workspace-files/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/workspace-files/src/index.ts](<H:/LFAA/packages/api/workspace-files/src/index.ts>) | A | 登记 workspace-files 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/workspace-files） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/writing-controller/package.json](<H:/LFAA/packages/api/writing-controller/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/api/writing-controller/src/index.ts](<H:/LFAA/packages/api/writing-controller/src/index.ts>) | A | 登记 writing-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（api/writing-controller） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/attachment/attachment-local/.gitkeep](<H:/LFAA/packages/attachment/attachment-local/.gitkeep>) | R100；原 [路径](<H:/LFAA/daemon/src/runners/minecraft/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/attachment/attachment/.gitkeep](<H:/LFAA/packages/attachment/attachment/.gitkeep>) | R100；原 [路径](<H:/LFAA/daemon/src/runners/steamcmd/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/boot/app-boot/package.json](<H:/LFAA/packages/boot/app-boot/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/boot/app-boot/src/ai-host.ts](<H:/LFAA/packages/boot/app-boot/src/ai-host.ts>) | A | 创建和关闭 LFAA 后端 AI 插件宿主。（boot/app-boot） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/boot/app-boot/src/index.ts](<H:/LFAA/packages/boot/app-boot/src/index.ts>) | A | 启动 LFAA Harness 的共享 Cordis 上下文。（boot/app-boot） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/boot/cmdline/.gitkeep](<H:/LFAA/packages/boot/cmdline/.gitkeep>) | R100；原 [路径](<H:/LFAA/daemon/src/task-runner/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/boot/config-editor/.gitkeep](<H:/LFAA/packages/boot/config-editor/.gitkeep>) | R100；原 [路径](<H:/LFAA/daemon/src/terminal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/boot/hmr/package.json](<H:/LFAA/packages/boot/hmr/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/boot/hmr/src/index.ts](<H:/LFAA/packages/boot/hmr/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（boot/hmr） | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/packages/boot/plugin-manager/.gitkeep](<H:/LFAA/packages/boot/plugin-manager/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/public/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/browser-use/browser-use/.gitkeep](<H:/LFAA/packages/browser-use/browser-use/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/app-shell/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/acp-app/.gitkeep](<H:/LFAA/packages/bundle/acp-app/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/apps/minecraft/ai-work/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/base/cordis.patch.yml](<H:/LFAA/packages/bundle/base/cordis.patch.yml>) | A | bundle/base 的能力实现、类型或装配补丁 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/packages/bundle/base/package.json](<H:/LFAA/packages/bundle/base/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/packages/bundle/base/src/index.ts](<H:/LFAA/packages/bundle/base/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（bundle/base） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/daemon-app/cordis.patch.yml](<H:/LFAA/packages/bundle/daemon-app/cordis.patch.yml>) | A | bundle/daemon-app 的能力实现、类型或装配补丁 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/daemon-app/package.json](<H:/LFAA/packages/bundle/daemon-app/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/headless/.gitkeep](<H:/LFAA/packages/bundle/headless/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/apps/minecraft/normal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/sdk-app/.gitkeep](<H:/LFAA/packages/bundle/sdk-app/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/apps/steamcmd/ai-work/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/sdk-minimal/.gitkeep](<H:/LFAA/packages/bundle/sdk-minimal/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/apps/steamcmd/normal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/web-app/cordis.patch.yml](<H:/LFAA/packages/bundle/web-app/cordis.patch.yml>) | A | bundle/web-app 的能力实现、类型或装配补丁 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/web-app/package.json](<H:/LFAA/packages/bundle/web-app/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/bundle/web-app/src/index.ts](<H:/LFAA/packages/bundle/web-app/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（bundle/web-app） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/connection/package.json](<H:/LFAA/packages/client/connection/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/connection/src/api.ts](<H:/LFAA/packages/client/connection/src/api.ts>) | A | 定义前端与 LFAA 控制端之间的 API 类型和请求函数。（client/connection） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/client/connection/src/minecraft-socket.ts](<H:/LFAA/packages/client/connection/src/minecraft-socket.ts>) | A | 建立 Minecraft 工作台到同源 LFAA 控制端的实时连接。（client/connection） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/file-upload/.gitkeep](<H:/LFAA/packages/client/file-upload/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/apps/writing/ai-work/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/hmr/.gitkeep](<H:/LFAA/packages/client/hmr/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/apps/writing/normal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/locale/.gitkeep](<H:/LFAA/packages/client/locale/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/components/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/modules/package.json](<H:/LFAA/packages/client/modules/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/modules/src/client/index.ts](<H:/LFAA/packages/client/modules/src/client/index.ts>) | A | 提供浏览器模块登记服务。作用：按包加载界面并在插件卸载时撤销登记。关联文件：各 ui 包的 client/index.ts、client/web。（client/modules） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/modules/src/index.ts](<H:/LFAA/packages/client/modules/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/modules） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/product-analytics/.gitkeep](<H:/LFAA/packages/client/product-analytics/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/shared/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/resources/package.json](<H:/LFAA/packages/client/resources/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/resources/src/notification-runtime.ts](<H:/LFAA/packages/client/resources/src/notification-runtime.ts>) | R059；原 [路径](<H:/LFAA/frontend/src/shared/notification-runtime.ts>) | 管理 LFAA 前端的系统通知和提示音。（client/resources） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/shortcuts/.gitkeep](<H:/LFAA/packages/client/shortcuts/.gitkeep>) | R100；原 [路径](<H:/LFAA/frontend/src/terminal/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/store/package.json](<H:/LFAA/packages/client/store/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/store/src/scroll-restoration.ts](<H:/LFAA/packages/client/store/src/scroll-restoration.ts>) | R100；原 [路径](<H:/LFAA/frontend/src/shared/scroll-restoration.ts>) | 保存并恢复前端滚动区域的位置。（client/store） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-agent-preset/.gitkeep](<H:/LFAA/packages/client/ui-agent-preset/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/scripts/python/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-approval/.gitkeep](<H:/LFAA/packages/client/ui-approval/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/ai/agent/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-attachment/.gitkeep](<H:/LFAA/packages/client/ui-attachment/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/ai/llm/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-brand-official/.gitkeep](<H:/LFAA/packages/client/ui-brand-official/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/ai/prompts/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-chat/package.json](<H:/LFAA/packages/client/ui-chat/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-chat/src/ai-work-chat.css](<H:/LFAA/packages/client/ui-chat/src/ai-work-chat.css>) | A | 定义 AI Work 对话画布、悬停式提问锚点、消息、权限模式弹层和输入区的布局与样式。（client/ui-chat） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-chat/src/AiMarkdown.tsx](<H:/LFAA/packages/client/ui-chat/src/AiMarkdown.tsx>) | A | 渲染 AI 回复中的常用 Markdown 内容。（client/ui-chat） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-chat/src/AiWorkChat.tsx](<H:/LFAA/packages/client/ui-chat/src/AiWorkChat.tsx>) | A | 提供 SteamCMD、Minecraft 和写作工作区的 AI Work 流式聊天。（client/ui-chat） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/client/ui-chat/src/client/index.ts](<H:/LFAA/packages/client/ui-chat/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-chat） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-chat/src/index.ts](<H:/LFAA/packages/client/ui-chat/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-chat） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-commands/package.json](<H:/LFAA/packages/client/ui-commands/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-commands/src/client/index.ts](<H:/LFAA/packages/client/ui-commands/src/client/index.ts>) | A | 提供浏览器快捷键匹配能力。作用：沿用账户快捷键合同，随插件卸载撤销服务。关联文件：shortcuts.ts、client/web、ui-layout。（client/ui-commands） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-commands/src/index.ts](<H:/LFAA/packages/client/ui-commands/src/index.ts>) | A | 声明命令界面包。作用：供 Host 登记浏览器包，匹配实现由 client 入口提供。关联文件：client/index.ts、shortcuts.ts。（client/ui-commands） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-commands/src/shortcuts.ts](<H:/LFAA/packages/client/ui-commands/src/shortcuts.ts>) | A | 提供 lfaa-client-ui-commands 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-commands） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-conversation/.gitkeep](<H:/LFAA/packages/client/ui-conversation/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/ai/skills/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-deliverables/.gitkeep](<H:/LFAA/packages/client/ui-deliverables/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/ai/subagents/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-directory-picker-browse/.gitkeep](<H:/LFAA/packages/client/ui-directory-picker-browse/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/ai/tools/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-directory-picker-native/.gitkeep](<H:/LFAA/packages/client/ui-directory-picker-native/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/api/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/package.json](<H:/LFAA/packages/client/ui-dockkit/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/client/index.ts](<H:/LFAA/packages/client/ui-dockkit/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-dockkit） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/index.ts](<H:/LFAA/packages/client/ui-dockkit/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-dockkit） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/ResizableWorkbench.tsx](<H:/LFAA/packages/client/ui-dockkit/src/ResizableWorkbench.tsx>) | R084；原 [路径](<H:/LFAA/frontend/src/workbench/ResizableWorkbench.tsx>) | 提供左栏 / 中间区 / 右栏 / 底部面板的纯布局容器，并实现拖拽缩放与吸附收起。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/ui-resize/damped-motion.ts](<H:/LFAA/packages/client/ui-dockkit/src/ui-resize/damped-motion.ts>) | R100；原 [路径](<H:/LFAA/frontend/src/workbench/ui-resize/damped-motion.ts>) | 给 Resize/Snap 提供与帧率无关的指数阻尼步进，避免 pointer 尺寸直接跳变产生僵硬/顿挫感。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench-interaction.config.ts](<H:/LFAA/packages/client/ui-dockkit/src/workbench-interaction.config.ts>) | R100；原 [路径](<H:/LFAA/frontend/src/workbench/workbench-interaction.config.ts>) | 集中定义 Workbench 拖拽、吸附、反向释放与键盘缩放的交互参数，避免把手感数字散落在 TSX / CSS。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.config.ts](<H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.config.ts>) | R100；原 [路径](<H:/LFAA/frontend/src/workbench/workbench-layout.config.ts>) | 集中定义 Workbench 的响应式几何变量和计算公式，避免把 280px / 360px 这类魔法数字散落在组件里。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.types.ts](<H:/LFAA/packages/client/ui-dockkit/src/workbench-layout.types.ts>) | R100；原 [路径](<H:/LFAA/frontend/src/workbench/workbench-layout.types.ts>) | 定义 ResizableWorkbench 的布局参数和受控状态接口。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench-preferences.ts](<H:/LFAA/packages/client/ui-dockkit/src/workbench-preferences.ts>) | R095；原 [路径](<H:/LFAA/frontend/src/workbench/workbench-preferences.ts>) | 读取并保存工作台共用的左侧栏宽度。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-dockkit/src/workbench.css](<H:/LFAA/packages/client/ui-dockkit/src/workbench.css>) | R088；原 [路径](<H:/LFAA/frontend/src/workbench/workbench.css>) | ResizableWorkbench 的纯几何布局和吸附/收起视觉状态。（client/ui-dockkit） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-goal/.gitkeep](<H:/LFAA/packages/client/ui-goal/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/middleware/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-input-trigger/.gitkeep](<H:/LFAA/packages/client/ui-input-trigger/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/auth/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-jobs/.gitkeep](<H:/LFAA/packages/client/ui-jobs/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/files/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-layout/package.json](<H:/LFAA/packages/client/ui-layout/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-layout/src/client/index.ts](<H:/LFAA/packages/client/ui-layout/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-layout） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-layout/src/index.ts](<H:/LFAA/packages/client/ui-layout/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-layout） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-layout/src/pages.css](<H:/LFAA/packages/client/ui-layout/src/pages.css>) | R093；原 [路径](<H:/LFAA/frontend/src/styles/pages.css>) | 定义应用能力页和账户列表的共用样式。（client/ui-layout） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-layout/src/workbench.css](<H:/LFAA/packages/client/ui-layout/src/workbench.css>) | R079；原 [路径](<H:/LFAA/frontend/src/styles/workbench.css>) | 定义应用中心、工作台页脚和首次配置提醒弹窗样式。（client/ui-layout） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-layout/src/Workbench.tsx](<H:/LFAA/packages/client/ui-layout/src/Workbench.tsx>) | R060；原 [路径](<H:/LFAA/frontend/src/components/Workbench.tsx>) | 呈现现有工作台。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。（client/ui-layout） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/client/ui-message-feedback/.gitkeep](<H:/LFAA/packages/client/ui-message-feedback/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/games/catalog/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-minecraft/package.json](<H:/LFAA/packages/client/ui-minecraft/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-minecraft/src/assets/minecraftScenes.ts](<H:/LFAA/packages/client/ui-minecraft/src/assets/minecraftScenes.ts>) | R100；原 [路径](<H:/LFAA/frontend/src/assets/minecraftScenes.ts>) | client/ui-minecraft 的能力实现、类型或装配补丁 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-minecraft/src/client/index.ts](<H:/LFAA/packages/client/ui-minecraft/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-minecraft） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-minecraft/src/index.ts](<H:/LFAA/packages/client/ui-minecraft/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-minecraft） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.css](<H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.css>) | A | 定义 Minecraft 常规工作台内容区、实例视图和操作表单的样式。（client/ui-minecraft） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.tsx](<H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.tsx>) | A | 呈现 Minecraft 常规模式的真实管理工作台。（client/ui-minecraft） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-model-selection/.gitkeep](<H:/LFAA/packages/client/ui-model-selection/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/games/config/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-open-in-app/.gitkeep](<H:/LFAA/packages/client/ui-open-in-app/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/games/deployment/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-permission-presets/.gitkeep](<H:/LFAA/packages/client/ui-permission-presets/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/games/instances/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-plan/.gitkeep](<H:/LFAA/packages/client/ui-plan/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/games/minecraft/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-plugin-manager/.gitkeep](<H:/LFAA/packages/client/ui-plugin-manager/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/games/steamcmd/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-primitives/package.json](<H:/LFAA/packages/client/ui-primitives/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-primitives/src/.gitkeep](<H:/LFAA/packages/client/ui-primitives/src/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/monitoring/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-primitives/src/client/index.ts](<H:/LFAA/packages/client/ui-primitives/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-primitives） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-primitives/src/index.ts](<H:/LFAA/packages/client/ui-primitives/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-primitives） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-primitives/src/ServiceStatus.tsx](<H:/LFAA/packages/client/ui-primitives/src/ServiceStatus.tsx>) | R081；原 [路径](<H:/LFAA/frontend/src/components/ServiceStatus.tsx>) | 展示控制端当前的连通状态。（client/ui-primitives） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-primitives/src/settings-controls.tsx](<H:/LFAA/packages/client/ui-primitives/src/settings-controls.tsx>) | A | 提供 lfaa-client-ui-primitives 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-primitives） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-primitives/src/WorkbenchIcon.tsx](<H:/LFAA/packages/client/ui-primitives/src/WorkbenchIcon.tsx>) | R087；原 [路径](<H:/LFAA/frontend/src/components/workbench/shared/WorkbenchIcon.tsx>) | 提供工作台壳层使用的轻量线性 SVG 图标集合。（client/ui-primitives） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-reference/.gitkeep](<H:/LFAA/packages/client/ui-reference/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/nodes/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-renderer/package.json](<H:/LFAA/packages/client/ui-renderer/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-renderer/src/App.tsx](<H:/LFAA/packages/client/ui-renderer/src/App.tsx>) | R078；原 [路径](<H:/LFAA/frontend/src/App.tsx>) | 管理 LFAA 前端认证状态、路由、服务状态和账户设置。（client/ui-renderer） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/client/ui-renderer/src/client/index.ts](<H:/LFAA/packages/client/ui-renderer/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-renderer） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-renderer/src/index.ts](<H:/LFAA/packages/client/ui-renderer/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-renderer） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-renderer/src/render.tsx](<H:/LFAA/packages/client/ui-renderer/src/render.tsx>) | A | 挂载 LFAA React 前端。（client/ui-renderer） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-schedule/.gitkeep](<H:/LFAA/packages/client/ui-schedule/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/modules/writing/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-session/.gitkeep](<H:/LFAA/packages/client/ui-session/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/realtime/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/package.json](<H:/LFAA/packages/client/ui-settings-account/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/src/AdminUsersPage.tsx](<H:/LFAA/packages/client/ui-settings-account/src/AdminUsersPage.tsx>) | A | 呈现设置中心里的本机账户管理。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/src/auth.css](<H:/LFAA/packages/client/ui-settings-account/src/auth.css>) | R092；原 [路径](<H:/LFAA/frontend/src/styles/auth.css>) | 定义登录页、首次初始化页和密码恢复页的专属样式。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/src/AuthView.tsx](<H:/LFAA/packages/client/ui-settings-account/src/AuthView.tsx>) | R077；原 [路径](<H:/LFAA/frontend/src/components/AuthView.tsx>) | 呈现超级管理员首次初始化、登录和恢复密码表单。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/src/client/index.ts](<H:/LFAA/packages/client/ui-settings-account/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings-account） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/src/index.ts](<H:/LFAA/packages/client/ui-settings-account/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings-account） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/src/PasskeyManager.tsx](<H:/LFAA/packages/client/ui-settings-account/src/PasskeyManager.tsx>) | A | 管理当前账户已登记的 WebAuthn 通行密钥。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/src/PasskeySetupPrompt.tsx](<H:/LFAA/packages/client/ui-settings-account/src/PasskeySetupPrompt.tsx>) | A | 在账户尚无通行密钥时显示可跳过的安全设置提示。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-account/src/PasswordStrengthIndicator.tsx](<H:/LFAA/packages/client/ui-settings-account/src/PasswordStrengthIndicator.tsx>) | R073；原 [路径](<H:/LFAA/frontend/src/components/PasswordStrengthIndicator.tsx>) | 显示密码和恢复密钥的实时强度。（client/ui-settings-account） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-agent-loop/.gitkeep](<H:/LFAA/packages/client/ui-settings-agent-loop/.gitkeep>) | R100；原 [路径](<H:/LFAA/server/src/utils/.gitkeep>) | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-general/package.json](<H:/LFAA/packages/client/ui-settings-general/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-general/src/client/index.ts](<H:/LFAA/packages/client/ui-settings-general/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings-general） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-general/src/default-settings.ts](<H:/LFAA/packages/client/ui-settings-general/src/default-settings.ts>) | A | 提供 lfaa-client-ui-settings-general 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-settings-general） | 从原实现按职责拆分，保留原业务或设置合同 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/client/ui-settings-general/src/index.ts](<H:/LFAA/packages/client/ui-settings-general/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings-general） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-general/src/setup-reminder.ts](<H:/LFAA/packages/client/ui-settings-general/src/setup-reminder.ts>) | A | 维护首次配置提醒的本地“今日暂停”状态。（client/ui-settings-general） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-general/src/SetupReminder.tsx](<H:/LFAA/packages/client/ui-settings-general/src/SetupReminder.tsx>) | A | 提示用户完成首次配置。（client/ui-settings-general） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-models/package.json](<H:/LFAA/packages/client/ui-settings-models/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-models/src/model-options.ts](<H:/LFAA/packages/client/ui-settings-models/src/model-options.ts>) | A | 提供 lfaa-client-ui-settings-models 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-settings-models） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-plugin-inventory/.gitkeep](<H:/LFAA/packages/client/ui-settings-plugin-inventory/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-plugins/.gitkeep](<H:/LFAA/packages/client/ui-settings-plugins/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-session-log/.gitkeep](<H:/LFAA/packages/client/ui-settings-session-log/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-shell/.gitkeep](<H:/LFAA/packages/client/ui-settings-shell/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-subagent/.gitkeep](<H:/LFAA/packages/client/ui-settings-subagent/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings-web-search/.gitkeep](<H:/LFAA/packages/client/ui-settings-web-search/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings/package.json](<H:/LFAA/packages/client/ui-settings/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings/src/client/index.ts](<H:/LFAA/packages/client/ui-settings/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings/src/index.ts](<H:/LFAA/packages/client/ui-settings/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-settings） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings/src/SettingsPage.css](<H:/LFAA/packages/client/ui-settings/src/SettingsPage.css>) | R068；原 [路径](<H:/LFAA/frontend/src/components/SettingsPage.css>) | 定义 LFAA 设置中心的导航、分类面板、表单和账户卡片样式。（client/ui-settings） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx](<H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx>) | R052；原 [路径](<H:/LFAA/frontend/src/components/SettingsPage.tsx>) | 呈现现有设置中心。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。（client/ui-settings） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/client/ui-shortcuts/package.json](<H:/LFAA/packages/client/ui-shortcuts/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-shortcuts/src/settings-shortcuts.tsx](<H:/LFAA/packages/client/ui-shortcuts/src/settings-shortcuts.tsx>) | A | 提供 lfaa-client-ui-shortcuts 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-shortcuts） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-browser/.gitkeep](<H:/LFAA/packages/client/ui-sidebar-browser/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-documentpreview/.gitkeep](<H:/LFAA/packages/client/ui-sidebar-documentpreview/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-files/package.json](<H:/LFAA/packages/client/ui-sidebar-files/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-files/src/client/index.ts](<H:/LFAA/packages/client/ui-sidebar-files/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-sidebar-files） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.css](<H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.css>) | A | 定义通用文件管理工作台的布局、目录表格、任务提示和在线文本编辑器样式。（client/ui-sidebar-files） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.tsx](<H:/LFAA/packages/client/ui-sidebar-files/src/FileManagerPage.tsx>) | A | 呈现各应用共用的 daemon 文件管理工作台。（client/ui-sidebar-files） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-files/src/index.ts](<H:/LFAA/packages/client/ui-sidebar-files/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-sidebar-files） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-right/.gitkeep](<H:/LFAA/packages/client/ui-sidebar-right/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar-terminal/.gitkeep](<H:/LFAA/packages/client/ui-sidebar-terminal/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar/package.json](<H:/LFAA/packages/client/ui-sidebar/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar/src/client/index.ts](<H:/LFAA/packages/client/ui-sidebar/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-sidebar） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-sidebar/src/GlobalNavigationRail.tsx](<H:/LFAA/packages/client/ui-sidebar/src/GlobalNavigationRail.tsx>) | A | 提供应用工作区、文件页和设置中心共用的全局导航轨。（client/ui-sidebar） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/client/ui-sidebar/src/index.ts](<H:/LFAA/packages/client/ui-sidebar/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-sidebar） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-skill/.gitkeep](<H:/LFAA/packages/client/ui-skill/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-slots/.gitkeep](<H:/LFAA/packages/client/ui-slots/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-subagent/.gitkeep](<H:/LFAA/packages/client/ui-subagent/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-theme/package.json](<H:/LFAA/packages/client/ui-theme/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-theme/src/base.css](<H:/LFAA/packages/client/ui-theme/src/base.css>) | R087；原 [路径](<H:/LFAA/frontend/src/styles/base.css>) | 定义文档级默认样式。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-theme/src/common.css](<H:/LFAA/packages/client/ui-theme/src/common.css>) | R085；原 [路径](<H:/LFAA/frontend/src/styles/common.css>) | 定义多个独立前端组件共用的状态样式。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-theme/src/fonts.ts](<H:/LFAA/packages/client/ui-theme/src/fonts.ts>) | A | 提供 lfaa-client-ui-theme 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（client/ui-theme） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-theme/src/login-background.ts](<H:/LFAA/packages/client/ui-theme/src/login-background.ts>) | R087；原 [路径](<H:/LFAA/frontend/src/shared/login-background.ts>) | 管理登录页在未认证状态下使用的内置背景。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-theme/src/responsive.css](<H:/LFAA/packages/client/ui-theme/src/responsive.css>) | R098；原 [路径](<H:/LFAA/frontend/src/styles/responsive.css>) | 定义前端各页面的响应式断点和减少动效规则。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-theme/src/tokens.css](<H:/LFAA/packages/client/ui-theme/src/tokens.css>) | R093；原 [路径](<H:/LFAA/frontend/src/styles/tokens.css>) | 定义 LFAA 全局共用的颜色、字号、间距和字体变量。（client/ui-theme） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-tool/.gitkeep](<H:/LFAA/packages/client/ui-tool/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-trajectory/.gitkeep](<H:/LFAA/packages/client/ui-trajectory/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-user-questions/.gitkeep](<H:/LFAA/packages/client/ui-user-questions/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-workflow-run/.gitkeep](<H:/LFAA/packages/client/ui-workflow-run/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-workspace/package.json](<H:/LFAA/packages/client/ui-workspace/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-workspace/src/application-workspace.css](<H:/LFAA/packages/client/ui-workspace/src/application-workspace.css>) | R098；原 [路径](<H:/LFAA/frontend/src/styles/application-workspace.css>) | 定义应用内三栏工作区和可调整侧栏样式。（client/ui-workspace） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-workspace/src/ApplicationWorkspace.tsx](<H:/LFAA/packages/client/ui-workspace/src/ApplicationWorkspace.tsx>) | R067；原 [路径](<H:/LFAA/frontend/src/components/ApplicationWorkspace.tsx>) | 装配 SteamCMD、Minecraft、写作应用内部的工作台界面。（client/ui-workspace） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/client/ui-workspace/src/client/index.ts](<H:/LFAA/packages/client/ui-workspace/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-workspace） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-workspace/src/index.ts](<H:/LFAA/packages/client/ui-workspace/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-workspace） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-workspace/src/module-workbench.css](<H:/LFAA/packages/client/ui-workspace/src/module-workbench.css>) | R067；原 [路径](<H:/LFAA/frontend/src/components/module-workbench.css>) | 定义共享全局导航轨，以及应用工作区的浮动卡片、侧栏和内容区域样式。（client/ui-workspace） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-writing/package.json](<H:/LFAA/packages/client/ui-writing/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.css](<H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.css>) | A | 定义写作 AI Work 右侧创作上下文的排版与状态样式。（client/ui-writing） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.tsx](<H:/LFAA/packages/client/ui-writing/src/ai-work/WritingAiContext.tsx>) | A | 展示写作应用当前作品、章节与模式上下文。（client/ui-writing） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-writing/src/client/index.ts](<H:/LFAA/packages/client/ui-writing/src/client/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-writing） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-writing/src/index.ts](<H:/LFAA/packages/client/ui-writing/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/ui-writing） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.css](<H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.css>) | A | 定义写作常规模式的作品、卷、章节目录和正文编辑区样式。（client/ui-writing） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.tsx](<H:/LFAA/packages/client/ui-writing/src/normal/WritingWorkspace.tsx>) | A | 提供写作空间常规模式的作品大纲、卷、章节与中央编辑区。（client/ui-writing） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/web/package.json](<H:/LFAA/packages/client/web/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/web/src/index.ts](<H:/LFAA/packages/client/web/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（client/web） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/client/web/src/main.tsx](<H:/LFAA/packages/client/web/src/main.tsx>) | A | 启动浏览器 Harness。作用：先装配界面插件，再挂载现有 React 界面。关联文件：client/modules、各 ui 包、ui-renderer/render.tsx。（client/web） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/compaction/command-compact/.gitkeep](<H:/LFAA/packages/compaction/command-compact/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/compaction/compaction-basic/.gitkeep](<H:/LFAA/packages/compaction/compaction-basic/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/compaction/compaction-image-offload/.gitkeep](<H:/LFAA/packages/compaction/compaction-image-offload/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/compaction/compaction-tool-result-pruner/.gitkeep](<H:/LFAA/packages/compaction/compaction-tool-result-pruner/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/compaction/compaction/.gitkeep](<H:/LFAA/packages/compaction/compaction/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/computer-use/computer-use/.gitkeep](<H:/LFAA/packages/computer-use/computer-use/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/context/agent-instructions/.gitkeep](<H:/LFAA/packages/context/agent-instructions/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/context/file-reference-local/.gitkeep](<H:/LFAA/packages/context/file-reference-local/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/context/file-reference/.gitkeep](<H:/LFAA/packages/context/file-reference/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/context/session-reference/.gitkeep](<H:/LFAA/packages/context/session-reference/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/context/time-context/.gitkeep](<H:/LFAA/packages/context/time-context/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/context/tmux-context/.gitkeep](<H:/LFAA/packages/context/tmux-context/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/agent-default-model/.gitkeep](<H:/LFAA/packages/core/agent-default-model/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/agent-loop/package.json](<H:/LFAA/packages/core/agent-loop/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/core/agent-loop/src/execute-turn.ts](<H:/LFAA/packages/core/agent-loop/src/execute-turn.ts>) | untracked | 运行大模型驱动的 Agent 工具循环。 | 管理模型请求、权限审批、工具结果和持久化证据，运行不依赖 HTTP 连接。 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/core/agent-loop/src/index.ts](<H:/LFAA/packages/core/agent-loop/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（core/agent-loop） | 新增包实现、配置或目录占位 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/core/agent-loop/src/runs.ts](<H:/LFAA/packages/core/agent-loop/src/runs.ts>) | untracked | 管理独立于网页连接的 Agent 任务。 | 提供提交、账户隔离查询、事件跟随及显式取消；任务证据由 JSONL 会话服务保存。 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/core/agent-loop/src/runtime.ts](<H:/LFAA/packages/core/agent-loop/src/runtime.ts>) | A | 通过当前用户已激活的 Provider 执行流式 AI Work 对话。（core/agent-loop） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/core/agent-tool-presentation/.gitkeep](<H:/LFAA/packages/core/agent-tool-presentation/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/agent/package.json](<H:/LFAA/packages/core/agent/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/agent/src/extension-registry.ts](<H:/LFAA/packages/core/agent/src/extension-registry.ts>) | R084；原 [路径](<H:/LFAA/server/src/ai/plugins/extension-registry.ts>) | 提供 Cordis 插件使用的 AI 扩展登记服务。（core/agent） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/core/agent/src/index.ts](<H:/LFAA/packages/core/agent/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（core/agent） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/scope/.gitkeep](<H:/LFAA/packages/core/scope/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/session/package.json](<H:/LFAA/packages/core/session/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/packages/core/session/src/index.ts](<H:/LFAA/packages/core/session/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（core/session） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/session/src/sessions.ts](<H:/LFAA/packages/core/session/src/sessions.ts>) | A | AI 会话业务 | 本轮将 SQLite 消息/用量访问改为 JSONL；并行任务增加模型协议与运行记录 | 共享文件：本轮存储改动与并行工作并存 |
| [H:/LFAA/packages/core/system-prompt/.gitkeep](<H:/LFAA/packages/core/system-prompt/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/tools/package.json](<H:/LFAA/packages/core/tools/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/core/tools/src/business-tools.ts](<H:/LFAA/packages/core/tools/src/business-tools.ts>) | A | 定义 AI Work 可调用的业务工具目录。（core/tools） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/core/tools/src/index.ts](<H:/LFAA/packages/core/tools/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（core/tools） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/core/tools/src/project-tools.ts](<H:/LFAA/packages/core/tools/src/project-tools.ts>) | untracked | 将项目文件能力登记为模型可调用工具。 | 从账户设置解析默认任务目录，通过既有认证 Daemon 队列执行并返回文件证据。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/deliverables/tool-present/.gitkeep](<H:/LFAA/packages/deliverables/tool-present/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/deliverables/workspace-changes/.gitkeep](<H:/LFAA/packages/deliverables/workspace-changes/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/document/office-to-pdf/.gitkeep](<H:/LFAA/packages/document/office-to-pdf/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/document/writing/package.json](<H:/LFAA/packages/document/writing/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/document/writing/src/index.ts](<H:/LFAA/packages/document/writing/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（document/writing） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/document/writing/src/prompts.ts](<H:/LFAA/packages/document/writing/src/prompts.ts>) | A | 构造写作 App 的 LFAA AI Work System Prompt。（document/writing） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/document/writing/src/service.ts](<H:/LFAA/packages/document/writing/src/service.ts>) | A | 管理账户自己的写作作品、大纲、卷、章节、自动保存修订和当前编辑位置。（document/writing） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/agent-team-profile/.gitkeep](<H:/LFAA/packages/experimental/agent-team-profile/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/agent-team/.gitkeep](<H:/LFAA/packages/experimental/agent-team/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/api-speech-to-text/.gitkeep](<H:/LFAA/packages/experimental/api-speech-to-text/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/auto-review/.gitkeep](<H:/LFAA/packages/experimental/auto-review/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/browser-use-chrome-devtools-mcp/.gitkeep](<H:/LFAA/packages/experimental/browser-use-chrome-devtools-mcp/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/browser-use-playwright-mcp/.gitkeep](<H:/LFAA/packages/experimental/browser-use-playwright-mcp/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/browser-use-runtime/.gitkeep](<H:/LFAA/packages/experimental/browser-use-runtime/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/browser-use-stagehand-native/.gitkeep](<H:/LFAA/packages/experimental/browser-use-stagehand-native/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/client-ui-agent-team/.gitkeep](<H:/LFAA/packages/experimental/client-ui-agent-team/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/client-ui-voice-input/.gitkeep](<H:/LFAA/packages/experimental/client-ui-voice-input/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/computer-use-cua-driver-mcp/.gitkeep](<H:/LFAA/packages/experimental/computer-use-cua-driver-mcp/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/computer-use-cua-driver-native/.gitkeep](<H:/LFAA/packages/experimental/computer-use-cua-driver-native/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/inspector/.gitkeep](<H:/LFAA/packages/experimental/inspector/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/ptc-runtime-python/.gitkeep](<H:/LFAA/packages/experimental/ptc-runtime-python/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/schedule-bundle/.gitkeep](<H:/LFAA/packages/experimental/schedule-bundle/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/speech-to-text-sensevoice/.gitkeep](<H:/LFAA/packages/experimental/speech-to-text-sensevoice/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/speech-to-text/.gitkeep](<H:/LFAA/packages/experimental/speech-to-text/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/tool-agent-team/.gitkeep](<H:/LFAA/packages/experimental/tool-agent-team/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/voice-input-bundle/.gitkeep](<H:/LFAA/packages/experimental/voice-input-bundle/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/webworker-packer/.gitkeep](<H:/LFAA/packages/experimental/webworker-packer/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/experimental/webworker-runtime/.gitkeep](<H:/LFAA/packages/experimental/webworker-runtime/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/extensions/cordis-client-runner/.gitkeep](<H:/LFAA/packages/extensions/cordis-client-runner/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/extensions/cordis-host-runner/.gitkeep](<H:/LFAA/packages/extensions/cordis-host-runner/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/extensions/tool-cordis/.gitkeep](<H:/LFAA/packages/extensions/tool-cordis/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/extensions/ui-cordis/.gitkeep](<H:/LFAA/packages/extensions/ui-cordis/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/feedback/command-feedback/.gitkeep](<H:/LFAA/packages/feedback/command-feedback/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/feedback/message-feedback/.gitkeep](<H:/LFAA/packages/feedback/message-feedback/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/fs-local/.gitkeep](<H:/LFAA/packages/fs/fs-local/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/fs-observation-policy/.gitkeep](<H:/LFAA/packages/fs/fs-observation-policy/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/fs-sandbox/.gitkeep](<H:/LFAA/packages/fs/fs-sandbox/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/fs/package.json](<H:/LFAA/packages/fs/fs/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/fs/src/index.ts](<H:/LFAA/packages/fs/fs/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（fs/fs） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/fs/src/queue.ts](<H:/LFAA/packages/fs/fs/src/queue.ts>) | A | 保存并派发 daemon 节点文件管理任务。（fs/fs） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/tool-fs-search/.gitkeep](<H:/LFAA/packages/fs/tool-fs-search/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/tool-fs/.gitkeep](<H:/LFAA/packages/fs/tool-fs/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/fs/tool-str-replace-editor/.gitkeep](<H:/LFAA/packages/fs/tool-str-replace-editor/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/games/minecraft/package.json](<H:/LFAA/packages/games/minecraft/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/packages/games/minecraft/src/catalog.ts](<H:/LFAA/packages/games/minecraft/src/catalog.ts>) | R096；原 [路径](<H:/LFAA/server/src/modules/games/minecraft/catalog.ts>) | 读取 Mojang 官方 Minecraft Java 版本清单与 Vanilla 服务端工件信息。（games/minecraft） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/games/minecraft/src/index.ts](<H:/LFAA/packages/games/minecraft/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（games/minecraft） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/games/minecraft/src/service.ts](<H:/LFAA/packages/games/minecraft/src/service.ts>) | A | 实现 Minecraft Vanilla 实例目录、生命周期操作与受支持的服务器配置规则。（games/minecraft） | 迁移原实现并修正包导入/关联路径 | 本轮 CLI/存储 |
| [H:/LFAA/packages/games/steamcmd/package.json](<H:/LFAA/packages/games/steamcmd/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/packages/games/steamcmd/src/index.ts](<H:/LFAA/packages/games/steamcmd/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（games/steamcmd） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/games/steamcmd/src/service.ts](<H:/LFAA/packages/games/steamcmd/src/service.ts>) | A | 管理 SteamCMD 专项配置、游戏存储路径并派发安装任务。（games/steamcmd） | 迁移原实现并修正包导入/关联路径 | 本轮 CLI/存储 |
| [H:/LFAA/packages/goal/command-goal/.gitkeep](<H:/LFAA/packages/goal/command-goal/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/goal/goal-round-driver/.gitkeep](<H:/LFAA/packages/goal/goal-round-driver/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/goal/goal/.gitkeep](<H:/LFAA/packages/goal/goal/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/goal/tool-goal/.gitkeep](<H:/LFAA/packages/goal/tool-goal/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/guard/repeat-tool-reminder/.gitkeep](<H:/LFAA/packages/guard/repeat-tool-reminder/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/guard/timeout-policy/.gitkeep](<H:/LFAA/packages/guard/timeout-policy/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/hooks/hook-protocol/package.json](<H:/LFAA/packages/hooks/hook-protocol/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/hooks/hook-protocol/src/index.ts](<H:/LFAA/packages/hooks/hook-protocol/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（hooks/hook-protocol） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/hooks/hook-protocol/src/runtime-hooks.ts](<H:/LFAA/packages/hooks/hook-protocol/src/runtime-hooks.ts>) | R094；原 [路径](<H:/LFAA/server/src/ai/plugins/runtime-hooks.ts>) | 提供只读、类型化的 AI 推理生命周期钩子。（hooks/hook-protocol） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/hooks/hooks-claude-code/.gitkeep](<H:/LFAA/packages/hooks/hooks-claude-code/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/hooks/hooks-codex/.gitkeep](<H:/LFAA/packages/hooks/hooks-codex/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/daemon/package.json](<H:/LFAA/packages/host/daemon/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/daemon/src/daemon.mjs](<H:/LFAA/packages/host/daemon/src/daemon.mjs>) | A | 运行本机 Windows x64 Daemon，并执行 SteamCMD、Minecraft、Java、文件管理与 AI 主机命令任务。 | 轮询控制端任务、安装并校验 Valve SteamCMD、发现和管理 Java 运行环境、维护 Minecraft 实例目录、在 LFAA 数据根目录内管理文件，并按项目权限模式运行账户设置的 Shell 命令。 | 本轮 CLI/存储 |
| [H:/LFAA/packages/host/daemon/src/index.ts](<H:/LFAA/packages/host/daemon/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（host/daemon） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/daemon/src/local-daemon.ts](<H:/LFAA/packages/host/daemon/src/local-daemon.ts>) | R055；原 [路径](<H:/LFAA/server/src/modules/nodes/local-daemon.ts>) | 维护本机 Windows Daemon 的登记、心跳与运行能力。（host/daemon） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/daemon/src/project-files.mjs](<H:/LFAA/packages/host/daemon/src/project-files.mjs>) | untracked | 执行项目文件的真实读取、检索、创建和唯一锚点修改。 | 验证规范路径、拒绝越界与符号链接，使用文件摘要防止覆盖并发修改，返回可核对的内容与差异。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/directory-picker-auto/.gitkeep](<H:/LFAA/packages/host/directory-picker-auto/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/directory-picker-browse/.gitkeep](<H:/LFAA/packages/host/directory-picker-browse/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/directory-picker-native/.gitkeep](<H:/LFAA/packages/host/directory-picker-native/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/directory-picker/.gitkeep](<H:/LFAA/packages/host/directory-picker/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/frontend-static/.gitkeep](<H:/LFAA/packages/host/frontend-static/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/open-in-app/.gitkeep](<H:/LFAA/packages/host/open-in-app/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/plugin-inventory/.gitkeep](<H:/LFAA/packages/host/plugin-inventory/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/product-telemetry-otel/.gitkeep](<H:/LFAA/packages/host/product-telemetry-otel/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/webserver/package.json](<H:/LFAA/packages/host/webserver/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/webserver/src/http-delivery.ts](<H:/LFAA/packages/host/webserver/src/http-delivery.ts>) | untracked | 定义控制端 HTTP 日志分级和生产前端交付规则。 | 让带内容哈希的资源复用浏览器缓存，入口与普通资源可重新校验，缺失资源不返回页面 HTML。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/webserver/src/index.ts](<H:/LFAA/packages/host/webserver/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（host/webserver） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/host/webserver/src/server.ts](<H:/LFAA/packages/host/webserver/src/server.ts>) | R055；原 [路径](<H:/LFAA/server/src/index.ts>) | 启动 LFAA 控制端 HTTP 服务。（host/webserver） | 从原实现按职责拆分，保留原业务或设置合同 | 共享文件：本轮存储改动与并行工作并存 |
| [H:/LFAA/packages/identity/anonymous-user-id/.gitkeep](<H:/LFAA/packages/identity/anonymous-user-id/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/identity/auth/package.json](<H:/LFAA/packages/identity/auth/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/packages/identity/auth/src/.gitkeep](<H:/LFAA/packages/identity/auth/src/.gitkeep>) | A | 保留上游同名目录位置 | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/identity/auth/src/index.ts](<H:/LFAA/packages/identity/auth/src/index.ts>) | A | 集中导出账户与会话业务服务。（identity/auth） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/identity/auth/src/passkeys.ts](<H:/LFAA/packages/identity/auth/src/passkeys.ts>) | A | 管理 LFAA 用户的 WebAuthn 通行密钥与认证挑战。（identity/auth） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/identity/auth/src/password-policy.ts](<H:/LFAA/packages/identity/auth/src/password-policy.ts>) | R086；原 [路径](<H:/LFAA/server/src/modules/auth/password-policy.ts>) | 定义登录密码与恢复密钥的强度判定规则。（identity/auth） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/identity/auth/src/service.ts](<H:/LFAA/packages/identity/auth/src/service.ts>) | A | 身份与账户管理 | 删除账户后清理其 JSON 配置及 JSONL 历史 | 本轮 CLI/存储 |
| [H:/LFAA/packages/interaction/commands/.gitkeep](<H:/LFAA/packages/interaction/commands/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/interaction/permission-presets/package.json](<H:/LFAA/packages/interaction/permission-presets/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/interaction/permission-presets/src/index.ts](<H:/LFAA/packages/interaction/permission-presets/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（interaction/permission-presets） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/interaction/permission-presets/src/permissions.ts](<H:/LFAA/packages/interaction/permission-presets/src/permissions.ts>) | R097；原 [路径](<H:/LFAA/server/src/ai/permissions.ts>) | 提供由 server 核心持有的 AI 工具授权、单次审批和记忆授权。（interaction/permission-presets） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/interaction/tool-ask-user/.gitkeep](<H:/LFAA/packages/interaction/tool-ask-user/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/interaction/user-approval/.gitkeep](<H:/LFAA/packages/interaction/user-approval/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/interaction/user-questions/.gitkeep](<H:/LFAA/packages/interaction/user-questions/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/jobs/jobs-local/.gitkeep](<H:/LFAA/packages/jobs/jobs-local/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/jobs/jobs/package.json](<H:/LFAA/packages/jobs/jobs/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts](<H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts>) | A | 保存 AI Work 的主机 Shell 命令并通过在线 Daemon 节点派发执行。（jobs/jobs） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/jobs/jobs/src/index.ts](<H:/LFAA/packages/jobs/jobs/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（jobs/jobs） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/jobs/jobs/src/minecraft-queue.ts](<H:/LFAA/packages/jobs/jobs/src/minecraft-queue.ts>) | R075；原 [路径](<H:/LFAA/server/src/modules/tasks/minecraft-queue.ts>) | 保存并派发 Minecraft 节点任务及控制台日志。（jobs/jobs） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/jobs/tool-jobs/.gitkeep](<H:/LFAA/packages/jobs/tool-jobs/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/deepseek-llm-api-extensions/.gitkeep](<H:/LFAA/packages/llm/deepseek-llm-api-extensions/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/llm-deepseek-account/.gitkeep](<H:/LFAA/packages/llm/llm-deepseek-account/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/llm-deepseek-api-key/.gitkeep](<H:/LFAA/packages/llm/llm-deepseek-api-key/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/llm-deepseek/.gitkeep](<H:/LFAA/packages/llm/llm-deepseek/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/llm-pi-ai/.gitkeep](<H:/LFAA/packages/llm/llm-pi-ai/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/llm-retry/.gitkeep](<H:/LFAA/packages/llm/llm-retry/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/llm/.gitkeep](<H:/LFAA/packages/llm/llm/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/plugin-package-inventory-deepseek/.gitkeep](<H:/LFAA/packages/llm/plugin-package-inventory-deepseek/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/llm/token-meter/.gitkeep](<H:/LFAA/packages/llm/token-meter/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/lsp/lsp-stdio/.gitkeep](<H:/LFAA/packages/lsp/lsp-stdio/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/lsp/lsp/.gitkeep](<H:/LFAA/packages/lsp/lsp/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/lsp/tool-lsp/.gitkeep](<H:/LFAA/packages/lsp/tool-lsp/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/mcp/mcp-client/.gitkeep](<H:/LFAA/packages/mcp/mcp-client/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/mcp/mcp-resources/.gitkeep](<H:/LFAA/packages/mcp/mcp-resources/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/plan/plan-mode/.gitkeep](<H:/LFAA/packages/plan/plan-mode/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/preset/agent-preset-registry/.gitkeep](<H:/LFAA/packages/preset/agent-preset-registry/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/preset/agent-preset/package.json](<H:/LFAA/packages/preset/agent-preset/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts](<H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts>) | A | 注册 LFAA 首期受信任的 AI Agent、子 Agent、领域专家、Skills、提示词和业务工具元数据。（preset/agent-preset） | 迁移原实现并修正包导入/关联路径 | 并行 Agent 任务，保留；本轮未实施 |
| [H:/LFAA/packages/preset/agent-preset/src/index.ts](<H:/LFAA/packages/preset/agent-preset/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（preset/agent-preset） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/preset/persona/.gitkeep](<H:/LFAA/packages/preset/persona/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/ptc-runtime/ptc-runtime-node/.gitkeep](<H:/LFAA/packages/ptc-runtime/ptc-runtime-node/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/ptc-runtime/ptc-runtime/.gitkeep](<H:/LFAA/packages/ptc-runtime/ptc-runtime/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/runtime-diagnostics/invariants/.gitkeep](<H:/LFAA/packages/runtime-diagnostics/invariants/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/sandbox/sandbox-local/.gitkeep](<H:/LFAA/packages/sandbox/sandbox-local/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/sandbox/sandbox-policy/.gitkeep](<H:/LFAA/packages/sandbox/sandbox-policy/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/sandbox/sandbox-windows-acl/.gitkeep](<H:/LFAA/packages/sandbox/sandbox-windows-acl/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/sandbox/sandbox/.gitkeep](<H:/LFAA/packages/sandbox/sandbox/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/schedule/schedule/.gitkeep](<H:/LFAA/packages/schedule/schedule/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/sdk/client/.gitkeep](<H:/LFAA/packages/sdk/client/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/sdk/protocol/.gitkeep](<H:/LFAA/packages/sdk/protocol/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/sdk/server/.gitkeep](<H:/LFAA/packages/sdk/server/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session-query/session-log-export/.gitkeep](<H:/LFAA/packages/session-query/session-log-export/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session-query/session-query-sqlite/.gitkeep](<H:/LFAA/packages/session-query/session-query-sqlite/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session-query/session-query/.gitkeep](<H:/LFAA/packages/session-query/session-query/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session-query/tool-session-query/.gitkeep](<H:/LFAA/packages/session-query/tool-session-query/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-checkpoint-policy/.gitkeep](<H:/LFAA/packages/session/session-checkpoint-policy/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-format-catalog/.gitkeep](<H:/LFAA/packages/session/session-format-catalog/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-format-v0-to-v1/.gitkeep](<H:/LFAA/packages/session/session-format-v0-to-v1/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-format-v1-to-v2/.gitkeep](<H:/LFAA/packages/session/session-format-v1-to-v2/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-format-v2-to-v3/.gitkeep](<H:/LFAA/packages/session/session-format-v2-to-v3/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-format-v3-to-v4/.gitkeep](<H:/LFAA/packages/session/session-format-v3-to-v4/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-format/.gitkeep](<H:/LFAA/packages/session/session-format/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-log-deepseek/.gitkeep](<H:/LFAA/packages/session/session-log-deepseek/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-persistence-jsonl/.gitkeep](<H:/LFAA/packages/session/session-persistence-jsonl/.gitkeep>) | 已删除多余占位文件 | 转为真实实现后的历史占位文件 | 目录内已有 package.json 与源码，删除多余 .gitkeep；上游同名目录仍保留 | 本轮 CLI/存储 |
| [H:/LFAA/packages/session/session-persistence-jsonl/package.json](<H:/LFAA/packages/session/session-persistence-jsonl/package.json>) | untracked | 工作区包清单 | 声明实际包、公开入口、运行组合与依赖 | 本轮 CLI/存储 |
| [H:/LFAA/packages/session/session-persistence-jsonl/src/index.ts](<H:/LFAA/packages/session/session-persistence-jsonl/src/index.ts>) | untracked | 登记权威会话服务。作用：完成旧表退役并随 Harness 生命周期释放写锁。关联文件：repository.ts、core/session、bundle/base。 | 完成旧表退役并随 Harness 生命周期释放写锁。关联文件：repository.ts、core/session、bundle/base。 | 本轮 CLI/存储 |
| [H:/LFAA/packages/session/session-persistence-jsonl/src/persistence.ts](<H:/LFAA/packages/session/session-persistence-jsonl/src/persistence.ts>) | untracked | JSONL 事件文件 | 幂等追加、序列/摘要校验、截断末行恢复和受控会话目录 | 本轮 CLI/存储 |
| [H:/LFAA/packages/session/session-persistence-jsonl/src/repository.ts](<H:/LFAA/packages/session/session-persistence-jsonl/src/repository.ts>) | untracked | 会话权威仓库 | 无损导入、重放、投影、已提交历史保护和回复中断恢复 | 本轮 CLI/存储 |
| [H:/LFAA/packages/session/session-persistence/.gitkeep](<H:/LFAA/packages/session/session-persistence/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-projection-cache/.gitkeep](<H:/LFAA/packages/session/session-projection-cache/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-projection/.gitkeep](<H:/LFAA/packages/session/session-projection/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-stats/.gitkeep](<H:/LFAA/packages/session/session-stats/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-telemetry-otel/.gitkeep](<H:/LFAA/packages/session/session-telemetry-otel/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-telemetry/.gitkeep](<H:/LFAA/packages/session/session-telemetry/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-title-all-prompts-llm/.gitkeep](<H:/LFAA/packages/session/session-title-all-prompts-llm/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-title-first-prompt-llm/.gitkeep](<H:/LFAA/packages/session/session-title-first-prompt-llm/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-title-llm/.gitkeep](<H:/LFAA/packages/session/session-title-llm/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-title/.gitkeep](<H:/LFAA/packages/session/session-title/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/session/session-turn-outline/.gitkeep](<H:/LFAA/packages/session/session-turn-outline/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/settings/settings/package.json](<H:/LFAA/packages/settings/settings/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 本轮 CLI/存储 |
| [H:/LFAA/packages/settings/settings/src/index.ts](<H:/LFAA/packages/settings/settings/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（settings/settings） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/settings/settings/src/preferences/index.ts](<H:/LFAA/packages/settings/settings/src/preferences/index.ts>) | R073；原 [路径](<H:/LFAA/server/src/modules/preferences/index.ts>) | 集中导出应用偏好业务服务。（settings/settings） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/settings/settings/src/preferences/service.ts](<H:/LFAA/packages/settings/settings/src/preferences/service.ts>) | R051；原 [路径](<H:/LFAA/server/src/modules/preferences/service.ts>) | 保存和读取当前用户的应用中心偏好。（settings/settings） | 迁移原实现并修正包导入/关联路径 | 本轮 CLI/存储 |
| [H:/LFAA/packages/settings/settings/src/service.ts](<H:/LFAA/packages/settings/settings/src/service.ts>) | R062；原 [路径](<H:/LFAA/server/src/modules/settings/service.ts>) | 设置与 Provider 服务 | 本轮接入文件配置，保留密文与校验；并行任务另增加 2 项预算设置 | 共享文件：本轮存储改动与并行工作并存 |
| [H:/LFAA/packages/shell/bash-local/.gitkeep](<H:/LFAA/packages/shell/bash-local/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/bash-sandbox/.gitkeep](<H:/LFAA/packages/shell/bash-sandbox/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/pwsh-local/.gitkeep](<H:/LFAA/packages/shell/pwsh-local/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/pwsh-sandbox/.gitkeep](<H:/LFAA/packages/shell/pwsh-sandbox/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/shell-env/.gitkeep](<H:/LFAA/packages/shell/shell-env/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/shell/.gitkeep](<H:/LFAA/packages/shell/shell/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/tool-bash-persistent/.gitkeep](<H:/LFAA/packages/shell/tool-bash-persistent/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/tool-bash/.gitkeep](<H:/LFAA/packages/shell/tool-bash/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/tool-pwsh-persistent/.gitkeep](<H:/LFAA/packages/shell/tool-pwsh-persistent/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/shell/tool-pwsh/.gitkeep](<H:/LFAA/packages/shell/tool-pwsh/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/skill/skill-badge/.gitkeep](<H:/LFAA/packages/skill/skill-badge/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/skill/skill-filesystem/.gitkeep](<H:/LFAA/packages/skill/skill-filesystem/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/skill/skill-office/.gitkeep](<H:/LFAA/packages/skill/skill-office/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/skill/skill/.gitkeep](<H:/LFAA/packages/skill/skill/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/skill/tool-skill/.gitkeep](<H:/LFAA/packages/skill/tool-skill/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/skill/tool-workspace-dependencies/.gitkeep](<H:/LFAA/packages/skill/tool-workspace-dependencies/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/skill/writing/package.json](<H:/LFAA/packages/skill/writing/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/skill/writing/src/writing-skills.ts](<H:/LFAA/packages/skill/writing/src/writing-skills.ts>) | A | 定义 LFAA 写作 Agent 可按需加载的内置创作方法。（skill/writing） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/spill/spill-local/.gitkeep](<H:/LFAA/packages/spill/spill-local/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/spill/spill-policy/.gitkeep](<H:/LFAA/packages/spill/spill-policy/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/spill/spill/.gitkeep](<H:/LFAA/packages/spill/spill/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/ssh/fs-ssh/.gitkeep](<H:/LFAA/packages/ssh/fs-ssh/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/ssh/sandbox-ssh/.gitkeep](<H:/LFAA/packages/ssh/sandbox-ssh/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/ssh/ssh/.gitkeep](<H:/LFAA/packages/ssh/ssh/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/ssh/subprocess-ssh/.gitkeep](<H:/LFAA/packages/ssh/subprocess-ssh/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/storage/storage-domain/.gitkeep](<H:/LFAA/packages/storage/storage-domain/.gitkeep>) | 已删除多余占位文件 | 转为真实实现后的历史占位文件 | 目录内已有 package.json 与源码，删除多余 .gitkeep；上游同名目录仍保留 | 本轮 CLI/存储 |
| [H:/LFAA/packages/storage/storage-domain/package.json](<H:/LFAA/packages/storage/storage-domain/package.json>) | untracked | 工作区包清单 | 声明实际包、公开入口、运行组合与依赖 | 本轮 CLI/存储 |
| [H:/LFAA/packages/storage/storage-domain/src/configuration.ts](<H:/LFAA/packages/storage/storage-domain/src/configuration.ts>) | untracked | JSON 配置权威仓库 | 9 域原样导入、原子事务、账户/节点归属、Provider 单激活及提交失败停止读取 | 本轮 CLI/存储 |
| [H:/LFAA/packages/storage/storage-domain/src/control-lock.ts](<H:/LFAA/packages/storage/storage-domain/src/control-lock.ts>) | untracked | SQLite 控制事务 | 协调启动写锁、导入和会话投影提交 | 本轮 CLI/存储 |
| [H:/LFAA/packages/storage/storage-domain/src/index.ts](<H:/LFAA/packages/storage/storage-domain/src/index.ts>) | untracked | 登记 JSON 配置域服务。作用：供设置与应用包共享权威配置和生命周期。关联文件：configuration.ts、bundle/base。 | 供设置与应用包共享权威配置和生命周期。关联文件：configuration.ts、bundle/base。 | 本轮 CLI/存储 |
| [H:/LFAA/packages/storage/storage-domain/src/migration.ts](<H:/LFAA/packages/storage/storage-domain/src/migration.ts>) | untracked | 旧表退役与恢复副本 | VACUUM 备份后事务删除旧权威表，新增日志修订投影并提交 v31 | 共享文件：本轮存储改动与并行 v32 迁移并存 |
| [H:/LFAA/packages/storage/storage-json/.gitkeep](<H:/LFAA/packages/storage/storage-json/.gitkeep>) | 已删除多余占位文件 | 转为真实实现后的历史占位文件 | 目录内已有 package.json 与源码，删除多余 .gitkeep；上游同名目录仍保留 | 本轮 CLI/存储 |
| [H:/LFAA/packages/storage/storage-json/package.json](<H:/LFAA/packages/storage/storage-json/package.json>) | untracked | 工作区包清单 | 声明实际包、公开入口、运行组合与依赖 | 本轮 CLI/存储 |
| [H:/LFAA/packages/storage/storage-json/src/index.ts](<H:/LFAA/packages/storage/storage-json/src/index.ts>) | untracked | JSON 后端 | 二进制值编码、原子写入、刷盘和单写者文件租约 | 本轮 CLI/存储 |
| [H:/LFAA/packages/storage/storage-sqlite/package.json](<H:/LFAA/packages/storage/storage-sqlite/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/storage/storage-sqlite/src/database.ts](<H:/LFAA/packages/storage/storage-sqlite/src/database.ts>) | A | 身份/任务数据库及历史迁移链 | 支持 v31 并把回复中断恢复交给文件仓库；并行变化保留 | 共享文件：本轮存储改动与并行工作并存 |
| [H:/LFAA/packages/storage/storage-sqlite/src/index.ts](<H:/LFAA/packages/storage/storage-sqlite/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（storage/storage-sqlite） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/storage/storage/.gitkeep](<H:/LFAA/packages/storage/storage/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/subagent-acp/.gitkeep](<H:/LFAA/packages/subagent/subagent-acp/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/subagent-claude-code/.gitkeep](<H:/LFAA/packages/subagent/subagent-claude-code/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/subagent-codex/.gitkeep](<H:/LFAA/packages/subagent/subagent-codex/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/subagent-dsh-sdk/.gitkeep](<H:/LFAA/packages/subagent/subagent-dsh-sdk/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/subagent-fork-in-process/.gitkeep](<H:/LFAA/packages/subagent/subagent-fork-in-process/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/subagent-in-process-driver/.gitkeep](<H:/LFAA/packages/subagent/subagent-in-process-driver/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/subagent-spawn-in-process/.gitkeep](<H:/LFAA/packages/subagent/subagent-spawn-in-process/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/subagent/.gitkeep](<H:/LFAA/packages/subagent/subagent/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/tool-subagent-control/.gitkeep](<H:/LFAA/packages/subagent/tool-subagent-control/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subagent/tool-subagent/.gitkeep](<H:/LFAA/packages/subagent/tool-subagent/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subprocess/subprocess-local/.gitkeep](<H:/LFAA/packages/subprocess/subprocess-local/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subprocess/subprocess/.gitkeep](<H:/LFAA/packages/subprocess/subprocess/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/subprocess/win32-process/.gitkeep](<H:/LFAA/packages/subprocess/win32-process/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/telemetry/logger/package.json](<H:/LFAA/packages/telemetry/logger/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/telemetry/logger/src/logger.ts](<H:/LFAA/packages/telemetry/logger/src/logger.ts>) | R076；原 [路径](<H:/LFAA/server/src/logger.ts>) | 创建控制端结构化日志器。（telemetry/logger） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/telemetry/otel/.gitkeep](<H:/LFAA/packages/telemetry/otel/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/terminal/terminal-bash/.gitkeep](<H:/LFAA/packages/terminal/terminal-bash/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/terminal/terminal/.gitkeep](<H:/LFAA/packages/terminal/terminal/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/terminal/tool-terminal/.gitkeep](<H:/LFAA/packages/terminal/tool-terminal/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/agent-loop-testkit/.gitkeep](<H:/LFAA/packages/test-support/agent-loop-testkit/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/api/package.json](<H:/LFAA/packages/test-support/api/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/api/src/router.ts](<H:/LFAA/packages/test-support/api/src/router.ts>) | A | 装配各能力包的 HTTP 接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。（test-support/api） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/client-runtime/.gitkeep](<H:/LFAA/packages/test-support/client-runtime/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/llm-mock-server/.gitkeep](<H:/LFAA/packages/test-support/llm-mock-server/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/llm-replay/.gitkeep](<H:/LFAA/packages/test-support/llm-replay/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/loader-smoke/.gitkeep](<H:/LFAA/packages/test-support/loader-smoke/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/remote-mock/.gitkeep](<H:/LFAA/packages/test-support/remote-mock/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/test-support/session-snapshot/.gitkeep](<H:/LFAA/packages/test-support/session-snapshot/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/todo/tool-todo/.gitkeep](<H:/LFAA/packages/todo/tool-todo/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/typert/generator/.gitkeep](<H:/LFAA/packages/typert/generator/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/typert/loader/.gitkeep](<H:/LFAA/packages/typert/loader/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/typert/protocol/.gitkeep](<H:/LFAA/packages/typert/protocol/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/typert/registry/.gitkeep](<H:/LFAA/packages/typert/registry/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/atomic-write/.gitkeep](<H:/LFAA/packages/util/atomic-write/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/brand/.gitkeep](<H:/LFAA/packages/util/brand/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/chunked-list/.gitkeep](<H:/LFAA/packages/util/chunked-list/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/code-language/.gitkeep](<H:/LFAA/packages/util/code-language/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/crypto/.gitkeep](<H:/LFAA/packages/util/crypto/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/deque/.gitkeep](<H:/LFAA/packages/util/deque/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/home-paths/package.json](<H:/LFAA/packages/util/home-paths/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/home-paths/src/index.d.mts](<H:/LFAA/packages/util/home-paths/src/index.d.mts>) | A | util/home-paths 的能力实现、类型或装配补丁 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/home-paths/src/index.mjs](<H:/LFAA/packages/util/home-paths/src/index.mjs>) | A | 定位开发或桌面运行根目录。（util/home-paths） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/home-paths/src/reserved-data-paths.d.mts](<H:/LFAA/packages/util/home-paths/src/reserved-data-paths.d.mts>) | untracked | 私有目录类型声明 | 提供共享保留目录的 TypeScript 类型 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/home-paths/src/reserved-data-paths.mjs](<H:/LFAA/packages/util/home-paths/src/reserved-data-paths.mjs>) | untracked | 私有目录协议常量 | 集中保护 credentials/database/storages/sessions，供应用与节点复用 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/home-paths/src/resolve-data-directory.d.mts](<H:/LFAA/packages/util/home-paths/src/resolve-data-directory.d.mts>) | A | util/home-paths 的能力实现、类型或装配补丁 | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/home-paths/src/resolve-data-directory.mjs](<H:/LFAA/packages/util/home-paths/src/resolve-data-directory.mjs>) | A | 解析 LFAA server 与 Daemon 共用的数据根目录。（util/home-paths） | 从原实现按职责拆分，保留原业务或设置合同 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/http-proxy/.gitkeep](<H:/LFAA/packages/util/http-proxy/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/launch-environment/package.json](<H:/LFAA/packages/util/launch-environment/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/launch-environment/src/config.ts](<H:/LFAA/packages/util/launch-environment/src/config.ts>) | A | 读取并校验控制端运行配置。（util/launch-environment） | 迁移原实现并修正包导入/关联路径 | 本轮 CLI/存储 |
| [H:/LFAA/packages/util/lazy-require/.gitkeep](<H:/LFAA/packages/util/lazy-require/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/native-command/.gitkeep](<H:/LFAA/packages/util/native-command/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/output-retention/.gitkeep](<H:/LFAA/packages/util/output-retention/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/package-manifest/.gitkeep](<H:/LFAA/packages/util/package-manifest/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/time/.gitkeep](<H:/LFAA/packages/util/time/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/timeout/.gitkeep](<H:/LFAA/packages/util/timeout/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/values/package.json](<H:/LFAA/packages/util/values/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/values/src/http-error.ts](<H:/LFAA/packages/util/values/src/http-error.ts>) | R079；原 [路径](<H:/LFAA/server/src/api/http-error.ts>) | 定义可安全返回给 API 调用方的业务错误。（util/values） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/util/workspace-path/.gitkeep](<H:/LFAA/packages/util/workspace-path/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/web/tool-web/.gitkeep](<H:/LFAA/packages/web/tool-web/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/web/web-fetch-http/.gitkeep](<H:/LFAA/packages/web/web-fetch-http/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/web/web-search-deepseek/.gitkeep](<H:/LFAA/packages/web/web-search-deepseek/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/web/web-search-exa/.gitkeep](<H:/LFAA/packages/web/web-search-exa/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/web/web-search-perplexity/.gitkeep](<H:/LFAA/packages/web/web-search-perplexity/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/web/web/.gitkeep](<H:/LFAA/packages/web/web/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/webhook/webhook-github/.gitkeep](<H:/LFAA/packages/webhook/webhook-github/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/webhook/webhook/.gitkeep](<H:/LFAA/packages/webhook/webhook/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/workflow/tool-ralph/.gitkeep](<H:/LFAA/packages/workflow/tool-ralph/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/workflow/tool-workflow/.gitkeep](<H:/LFAA/packages/workflow/tool-workflow/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/workflow/workflow-ptc/.gitkeep](<H:/LFAA/packages/workflow/workflow-ptc/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/workflow/workflow/.gitkeep](<H:/LFAA/packages/workflow/workflow/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/workspace/data-directory/package.json](<H:/LFAA/packages/workspace/data-directory/package.json>) | A | 包名、依赖、公开导出、装配元数据和根 dist 构建命令 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/workspace/data-directory/src/index.ts](<H:/LFAA/packages/workspace/data-directory/src/index.ts>) | A | 登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。（workspace/data-directory） | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/workspace/data-directory/src/service.ts](<H:/LFAA/packages/workspace/data-directory/src/service.ts>) | A | 管理 Windows 本地开发环境和桌面端的数据根目录迁移请求。（workspace/data-directory） | 迁移原实现并修正包导入/关联路径 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/packages/workspace/workspace/.gitkeep](<H:/LFAA/packages/workspace/workspace/.gitkeep>) | A | 保留上游同名目录位置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/pnpm-lock.yaml](<H:/LFAA/pnpm-lock.yaml>) | M | 工作区依赖或 TypeScript 包映射与根 dist 输出配置 | 修改现有入口、路径或文档 | 共享文件：本轮存储改动与并行工作并存 |
| [H:/LFAA/pnpm-workspace.yaml](<H:/LFAA/pnpm-workspace.yaml>) | M | 工作区依赖或 TypeScript 包映射与根 dist 输出配置 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/README.md](<H:/LFAA/README.md>) | M | 架构规范、开发说明或构建/运行路径规则 | 修改现有入口、路径或文档 | 本轮 CLI/存储 |
| [H:/LFAA/scripts/apply-data-directory-migration.mjs](<H:/LFAA/scripts/apply-data-directory-migration.mjs>) | A | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/backup-project.ps1](<H:/LFAA/scripts/backup-project.ps1>) | M | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/build-harness.mjs](<H:/LFAA/scripts/build-harness.mjs>) | A | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/configure-tauri-output.mjs](<H:/LFAA/scripts/configure-tauri-output.mjs>) | A | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/get-project-drive-type.ps1](<H:/LFAA/scripts/get-project-drive-type.ps1>) | A | 读取项目所在 Windows 卷的 DriveType。 | 区分固定磁盘与可移动磁盘，决定默认数据使用当前用户目录还是跟随项目目录。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/harness-workspace.d.mts](<H:/LFAA/scripts/harness-workspace.d.mts>) | A | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/harness-workspace.mjs](<H:/LFAA/scripts/harness-workspace.mjs>) | A | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 新增包实现、配置或目录占位 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/install-dependencies.ps1](<H:/LFAA/scripts/install-dependencies.ps1>) | M | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/package-cli.mjs](<H:/LFAA/scripts/package-cli.mjs>) | A | npm 组装工具 | 公共 @yubboo/lfaa 运行树，只打包产品编译文件和外部依赖 | 本轮 CLI/存储 |
| [H:/LFAA/scripts/resolve-data-directory.d.mts](<H:/LFAA/scripts/resolve-data-directory.d.mts>) | A | 项目配置或迁移文件 | 按新包架构维护入口、实现或引用 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/resolve-data-directory.mjs](<H:/LFAA/scripts/resolve-data-directory.mjs>) | A | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/start-dev.mjs](<H:/LFAA/scripts/start-dev.mjs>) | A | 提供 Windows 与 Linux 共用的项目级开发启动入口。 | Windows 交给 PowerShell 完整启动器处理进程停机和数据迁移；其他平台直接启动工作区开发服务。 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/scripts/start-dev.ps1](<H:/LFAA/scripts/start-dev.ps1>) | M | 迁移后的构建、启动、依赖、数据位置或源码备份工具 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/package-loader.mjs](<H:/LFAA/server/package-loader.mjs>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/package.json](<H:/LFAA/server/package.json>) | D | 工作区包清单 | 声明实际包、公开入口、运行组合与依赖 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/register-package-loader.mjs](<H:/LFAA/server/register-package-loader.mjs>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/ai/host.ts](<H:/LFAA/server/src/ai/host.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/ai/plugins/builtin-catalog.ts](<H:/LFAA/server/src/ai/plugins/builtin-catalog.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/ai/runtime.ts](<H:/LFAA/server/src/ai/runtime.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/ai/sessions.ts](<H:/LFAA/server/src/ai/sessions.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/api/routes.ts](<H:/LFAA/server/src/api/routes.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/config.ts](<H:/LFAA/server/src/config.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/database.ts](<H:/LFAA/server/src/database.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/middleware/auth.ts](<H:/LFAA/server/src/middleware/auth.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/modules/auth/index.ts](<H:/LFAA/server/src/modules/auth/index.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/modules/auth/service.ts](<H:/LFAA/server/src/modules/auth/service.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/src/modules/games/minecraft/service.ts](<H:/LFAA/server/src/modules/games/minecraft/service.ts>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/test/database-migrations.test.mjs](<H:/LFAA/server/test/database-migrations.test.mjs>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/server/tsconfig.json](<H:/LFAA/server/tsconfig.json>) | D | 已经替代的旧源码/索引 | 从旧路径移除，新实现位于职责包 | 此前 Harness 迁移/已有工作 |
| [H:/LFAA/tsconfig.client.json](<H:/LFAA/tsconfig.client.json>) | A | 工作区依赖或 TypeScript 包映射与根 dist 输出配置 | 迁移原实现并修正包导入/关联路径 | 本轮 CLI/存储 |
| [H:/LFAA/tsconfig.host.json](<H:/LFAA/tsconfig.host.json>) | A | 工作区依赖或 TypeScript 包映射与根 dist 输出配置 | 迁移原实现并修正包导入/关联路径 | 本轮 CLI/存储 |
| [H:/LFAA/开发规范.md](<H:/LFAA/开发规范.md>) | M | 架构规范、开发说明或构建/运行路径规则 | 修改现有入口、路径或文档 | 此前 Harness 迁移/已有工作 |
