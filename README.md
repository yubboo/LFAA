# LFAA

LFAA 是一个面向本机和远程主机的应用工作台，首期聚焦 SteamCMD 游戏服务器、Minecraft 服务器和写作应用。用户既可以在各应用的常规模式中操作，也可以切换到内置的 AI Work，由大模型驱动 Agent 完成多步骤任务。

> 当前优先建设 Minecraft 管理 MVP。常规管理面板、server/Daemon 任务链路和每实例 Windows AppContainer Sandbox Host 已接入；真实 Windows 主机启动、网络和文件访问验收仍待完成。范围为本机 Windows x64、Minecraft Java Edition 官方 Vanilla。SteamCMD 与写作按用户顺序后续进行。常规面板与 AI Work 属于同一 App，切换模式不会重建隔离环境；当前 AI Work 没有已注册的 Minecraft 执行工具。

## 系统架构

![LFAA 系统总体架构图](docs/img/system-architecture.svg)

![应用工作台思维导图](docs/img/app-workbench-mindmap.svg)

详细设计见 [系统总体架构](docs/系统总体架构.md)。

## 本机开发

运行环境要求 Node.js 24.15.0 或更新版本、根目录指定的 pnpm 11.17.0，以及带有 `x86_64-pc-windows-msvc` target 的 Rust stable MSVC 工具链（用于构建 Windows Sandbox Host）。首次启动前，在仓库根目录复制环境模板：

```powershell
Copy-Item .env.example .env
pnpm install
```

从仓库根目录运行以下命令，可在当前终端并行启动前端、server 和本机 Daemon；按 `Ctrl+C` 停止三项服务：

```powershell
pnpm dev
```

也可以分别启动单个服务：

```powershell
pnpm run dev:frontend
```

```powershell
pnpm run dev:server
```

```powershell
pnpm run dev:daemon
```

从项目根目录运行 `pnpm build` 可构建前端和控制端，并构建 Windows Rust Sandbox Host、检查 Daemon 入口；所有产物统一放在根目录 `dist/` 下。也可以单独运行 `pnpm run build:frontend`、`pnpm run build:server` 或 `pnpm run build:daemon`。Linux/macOS 尚无 Minecraft Sandbox Host，不会回退为普通 Java 进程。

Windows 下双击根目录 `lfaa.bat`，在菜单中选择 `2`，前端、server 和本机 Daemon 会在当前窗口同时启动；按 `Ctrl+C` 停止。选择 `4` 可检查 Node.js、pnpm、Rust/MSVC target 和工作区环境；启动 Daemon 前会校验所需 Rust target。首次使用前先选择 `1` 安装 Node.js 依赖。

打开 `http://127.0.0.1:5173`。本机数据尚无账户时，首次访问可创建唯一超级管理员；之后只能登录，不再提供新增账户。密码至少 8 位并须包含至少 3 类字符，初始化时还需设置独立恢复密钥；忘记密码时可用恢复密钥重设密码。升级前的账户登录后可在“设置 → 用户与权限”补设恢复密钥。邮箱找回尚未接入。

当前账户、登录会话、设置和恢复密钥哈希保存在本地 SQLite 文件 `data/database/lfaa.sqlite`；这不是浏览器 `localStorage`，也不需要单独启动远程数据库。开发环境若 `JWT_SECRET` 留空，控制端首次启动会在 `data/credentials/jwt-secret` 生成并持久保存本机签名密钥，服务重启后登录会话仍可继续使用。生产环境必须在根目录 `.env` 中配置不少于 32 个字符的 `JWT_SECRET`。

控制端使用 Node 内置 SQLite，默认数据库位于 `data/database/lfaa.sqlite`；通过 `LFAA_DATA_DIR` 可改为绝对路径或相对仓库根目录的路径。数据库、密码哈希和运行数据由 `data/.gitignore` 排除，不应提交。

## 首期功能范围

- SteamCMD 游戏目录和一键部署流程，逐步扩展至 40+ 款游戏。
- Minecraft Java Edition 官方 Vanilla 服务端安装、实例配置、启停、日志和停服后世界备份；当前仅支持本机 Windows x64 Daemon。实例 Java 进程通过 Windows AppContainer 限制身份、文件 ACL、网络能力及低完整性写入，并由 Job Object 管理进程与内存；真实 Windows 运行验收仍待完成。插件和其他服务端发行版尚未接入。
- 游戏实例、配置文件、存档、日志、备份和运行环境的持久化管理。
- 响应式 Ant Design 管理界面、可视化配置编辑、实例状态和主机资源监控。
- Minecraft 当前提供 Daemon 回传日志；交互式终端、实时 Socket.IO 推送与资源监控尚未接入。
- JWT 用户认证和授权；部署、文件、进程等操作由后端进行权限校验。
- AI Work 内置在 SteamCMD、Minecraft 和写作应用中。LLM 负责理解与推理，主 Agent 规划任务、调用工具，必要时召唤子 Agent 协作。
- Docker Compose 部署控制端；`daemon` 可安装在本机或多台远程主机执行具体任务。
- Web、Tauri 桌面端和 Electron 桌面端共用 React 前端。

## 目录职责

- `apps/`：Web、Tauri、Electron 平台入口和外壳。
- `frontend/`：共用 React UI、应用页面、公共静态资源和前端依赖。
- `server/`：控制端 API、业务模块、权限、AI 服务和节点任务调度。
- `daemon/`：TypeScript 常驻节点程序负责任务协调；`daemon/sandbox-host/` 内的 Rust Windows Host 负责 Minecraft AppContainer/Job Object 边界。它不是 LLM Agent。
- `data/`：按内容分类的持久化数据根目录，包含 `games/`、`environments/java/`、`environments/sandbox/minecraft/`、`lib/`、`plugins/`、`database/`、缓存、日志和备份；运行数据默认忽略，不提交到 Git。
- `dist/`：唯一构建产物目录；前后端、daemon 和桌面端开发程序、安装包及中间构建文件分别写入 `dist/frontend/`、`dist/server/`、`dist/daemon/`、`dist/apps/desktop-electron/`、`dist/apps/desktop-tauri/` 等子目录。
- `docs/`：架构和项目文档。
- `package.json`：根级 pnpm 版本、开发和构建命令；前端、server、daemon 各自维护依赖清单。
- `pnpm-workspace.yaml`：统一管理前端、server、daemon 和后续加入的 `apps/*` 包。
- `lfaa.bat`：Windows 根目录菜单入口，可安装依赖、检查环境、查看依赖范围或启动前端、server 和本机 Daemon；菜单由 `scripts/install-dependencies.ps1` 提供，服务由 `scripts/start-dev.ps1` 调度。

## 技术方案

当前前端使用 React 18、TypeScript、Ant Design 5 和 Vite；当前 server 使用 Express、Joi、JWT、Winston 与 Node 内置 SQLite；Minecraft Windows 沙盒使用最小 Rust helper 调用原生 AppContainer 与 Job Object API。尚未进入对应里程碑的编辑器、终端、实时通信、上传和调度依赖会在实际接入时再加入。SteamCMD、PTY、文件系统和 Docker 用于后续节点侧部署与管理。

项目统一使用 pnpm 工作区一次性安装根目录、前端、server、daemon 和 `apps/*` 下已声明的 Node.js 依赖。Windows 下双击根目录 `lfaa.bat` 进入彩色菜单，选择 `1` 安装依赖、`2` 在当前窗口启动前端/server/本机 Daemon、`3` 查看安装范围、`4` 检查环境、`0` 退出。安装按根目录 `package.json` 中指定的 pnpm 版本运行，并生成或更新根目录 `pnpm-lock.yaml`。Daemon Sandbox Host 与 Tauri 的 Rust/Cargo 依赖不属于 pnpm 管理范围，需自行安装项目要求的 Rust 工具链。

## 数据约定

- `server` 保存用户、权限、节点登记、任务状态等控制面数据。
- daemon 使用 `LFAA_DATA_DIR` 指定的数据根目录保存游戏、分类型运行环境和辅助依赖。
- `games/steamcmd/` 是 SteamCMD 部署的游戏服务端文件；`lib/steamcmd/` 是 SteamCMD 下载器和命令行工具本身。
- 数据按内容命名，例如 `games/steamcmd/`、`games/minecraft/`、`environments/java/`、`lib/pty/`、`lib/zip-tools/` 和 `plugins/`；路径不包含 `server/` 或 `nodes/<节点名>/`。
- 每台远程主机在本机配置自己的数据根目录；升级程序不得清理游戏实例和运行环境。

## 文档

- [开发计划与进度](docs/开发计划.md)
- [系统总体架构](docs/系统总体架构.md)
- [更新日志](docs/updata-log.md)
- [开发规范](开发规范.md)
