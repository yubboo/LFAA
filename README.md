# LFAA-Harness

LFAA-Harness 是 LFAA 自有的 Harness 项目与面向本机和远程主机的应用工作台，首期聚焦 SteamCMD 游戏服务器、Minecraft 服务器和写作应用。用户既可以在各应用的常规模式中操作，也可以切换到内置的 AI Work，由大模型驱动 Agent 完成多步骤任务。

> LFAA 当前主线是通用 Agent 工作台与领域 App。AI Work 已接入模型工具循环、顺序执行的独立子 Agent、项目文件工具、可执行插件工具和 Streamable HTTP MCP；写作工具仍只操作当前账户的作品，主机 Shell 通过目标在线 Daemon 按账户权限模式执行。完全权限模式不逐项审批，但不扩大用户目标、不构成 OS 沙盒，也不替代 Minecraft EULA 的单独同意。Minecraft 已有多核心部署服务；具体核心、版本、构建和节点执行能力须以本轮工具目录、业务服务校验及 Daemon 回报为准。子 Agent 并行调度、外部 Agent 任务交接和 Steam 游戏服务端 Runner 仍未接入。浏览器、Provider、Windows 节点和安装包的实际验收状态见[开发计划与交付记录](docs/开发计划.md)。

## 系统架构

![LFAA 迁移期现有组件部署图](docs/img/system-architecture.svg)

![应用工作台思维导图](docs/img/app-workbench-mindmap.svg)

详细设计见 [系统总体架构](docs/系统总体架构.md)。

LFAA 现已采用对标 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的包架构：上游 316 个包目录原名保留，现有产品源码迁入对应职责包；浏览器界面位于 `packages/client/ui-*`，控制端和节点由 Cordis 管理插件生命周期。Profile 选择普通 Bundle 包，Bundle 提供 `cordis.patch.yml`。目录状态见[完整包树](docs/harness-packages.md)，源码与验证记录见[迁移交付清单](docs/harness-migration.md)。

## 启动 LFAA Web

运行环境需要 Node.js 24.15.0 或更新版本。Web 命令使用构建后的界面与控制端，默认在 `http://127.0.0.1:3000` 同源提供页面、API 和 Socket.IO；监听地址和端口读取环境配置。按 `Ctrl+C` 停止。

### 方式一：npm 包

```sh
npx @yubboo/lfaa web
```

此命令需要 `@yubboo/lfaa` 已发布到 npm。本仓库已提供发布组装和打包命令，未发布的版本不能通过在线 npx 获取。npm 模式默认把数据放在用户目录 `~/.lfaa/data`，不放在 npx 缓存内；当前目录的 `.env` 和显式环境变量可以配置 `LFAA_DATA_DIR`，相对路径按当前目录解析。

### 方式二：源码仓库

```sh
git clone https://github.com/yubboo/LFAA.git lfaa
cd lfaa
pnpm install
pnpm run build
pnpm lfaa web
```

克隆时显式指定 `lfaa` 目录，保证区分大小写的系统也能执行 `cd lfaa`。源码模式沿用仓库 `.env`、现有数据目录解析和用户配置；不必手动设置 `LFAA_SERVE_FRONTEND`。普通 Web 构建不要求 Rust，全部输出进入根 `dist/`。

本机回环监听可自动生成并持久保存真实签名密钥；修改为公网生产监听时，仍需显式设置不少于 32 个字符的 `JWT_SECRET` 和绝对持久数据目录。首次访问沿用现有管理员创建流程，不注入假账户。

### 节点与发布

`web` 启动控制端；Daemon 独立执行节点任务。当前本机节点支持 Windows x64，源码模式先准备 Rust/MSVC 工具链，再运行：

```sh
pnpm run build:daemon
pnpm lfaa daemon
```

控制端与本机节点使用相同的 `LFAA_DATA_DIR`。npm Web 包不携带 Windows Sandbox Host；节点应使用上述源码节点入口或现有桌面运行包。发布包只收录产品运行文件，不收录测试支持、凭据、运行数据和历史备份。

```sh
pnpm run pack:cli
# 在确认发布版本并登录 npm 后执行：
pnpm run publish:cli
```

发布组装目录为 `dist/npm/lfaa/`，tarball 写入 `dist/npm/`，npm 名称固定为 `@yubboo/lfaa`。详细职责、配置和验证见 [CLI 启动与发布](docs/harness-cli.md)。

开发菜单和 `pnpm dev` 保留；`pnpm lfaa --profile web` 与 `pnpm lfaa --profile daemon` 仍可选择运行组合。自定义组合使用 `--home <目录>`，补丁使用 `--patch <文件>`。

## 本机开发

运行环境要求 Node.js 24.15.0 或更新版本、根目录指定的 pnpm 11.17.0，以及带有 `x86_64-pc-windows-msvc` target 的 Rust stable MSVC 工具链（用于构建 Windows Sandbox Host）。首次启动前，在仓库根目录复制环境模板：

```powershell
Copy-Item .env.example .env
pnpm install
```

Windows 下从仓库根目录运行以下命令，会通过完整项目启动器安全检查并启动前端、server 和本机 Daemon；这也支持设置中心的数据根目录迁移。Linux 开发环境直接并行启动服务。服务仍并行启动，但前端会先等待 server 的 `/api/health` 就绪（最长 120 秒）再启动 Vite；server 未就绪时会明确提示检查 server 终端。开发期间若控制端热重启，Vite 会把同一故障期间重复的 `ECONNREFUSED` 代理堆栈合并成一条提示，并在控制端恢复时提示连接已恢复。按 `Ctrl+C` 停止三项服务：

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

从项目根目录运行 `pnpm build` 可构建能力包、Web、控制端和 npm 发布目录；Web、控制端和 Daemon 的入口产物分别位于 `dist/apps/web/`、`dist/apps/control-plane/`、`dist/apps/daemon/`，能力包位于 `dist/packages/<领域>/<包名>/`。Windows Rust Sandbox Host 由 `pnpm run build:daemon` 单独构建。也可以单独运行 `pnpm run build:web`、`pnpm run build:control-plane` 或 `pnpm run build:daemon`。Linux/macOS 尚无 Minecraft Sandbox Host，不会回退为普通 Java 进程。

LFAA-Harness 桌面产品主线目标为 Windows/macOS Electron，Web 与桌面共用前端。当前仓库的 `pnpm run build:desktop:win` 仍调用 Tauri，Electron 单独入口 `pnpm run build:desktop:electron:win` 只配置 Windows x64 NSIS；默认构建入口迁移和 macOS Electron 打包仍待完成。现有 Tauri Windows 包的数据迁移与卸载保留逻辑是当前实现事实，不能当作 Electron 新包已验收。Linux 与 Android 是后续平台目标。
纯净源码 ZIP 和全新安装包只包含 LFAA 仓库中正式登记的第一方 Harness 能力与锁定的运行依赖。外部另装插件、账户凭据、Provider 密钥、游戏实例、数据库、缓存、日志和开发机路径均不得进入发行物；首次启动才创建空白用户数据。开发盘构建与干净克隆构建必须遵守相同文件边界。真实新安装和异盘验收通过前，不宣称产品包已纯净。

Electron Windows x64 桌面包可单独运行 `pnpm run build:desktop:electron:win`。打包后的 Windows NSIS 应用会在启动后检查 `update.json`，有新版本时自动下载，并在安装前显示包含版本说明的确认框；选择“稍后”会在退出 LFAA 时安装。Windows 注销或关机期间会延期启动安装器，并在下次启动时重新检查。构建输出位于 `dist/apps/desktop-electron/`，其中 `latest.yml` 和安装包需由发布者上传到 `update.json` 所指向的 GitHub Release 下载目录。更新清单必须与 `docs/updata-log.md` 和 Electron 包版本一致；构建会校验版本、发布日期、说明和更新源。当前仓库未配置 Authenticode 发布者名称或签名证书，代码签名者验证尚未完成。打包命令只生成本地产物，不会上传或发布。

本机一体版面向管理当前 Windows 主机；远程主机仍由 Web 界面连接部署在远端的控制端。公网访问本机控制端的内网穿透尚未接入，后续需要同时转发 Web、API 与 Socket.IO，并继续通过控制端鉴权。

Windows 下双击根目录 `lfaa.bat`，首次依次选择 `1` 安装依赖、`3` 构建、`2` 后按 Enter 启动 Harness Web（`pnpm lfaa web`）。启动子菜单中选择 `1` 启动 Web、`2` 独立启动节点、`3` 使用完整开发启动器、`4` 启动 Vite 热更新前端、`0` 返回。Vite 菜单等待现有控制端健康后只启动 `127.0.0.1:5173` 前端，不重启控制端或 Daemon；若检测到本工作区 Vite 已在运行且页面就绪，会直接复用。打开 `http://127.0.0.1:5173/apps/minecraft/ai-work` 查看源码改动，按 `Ctrl+C` 停止 Vite。未知程序占用 5173 时会显示进程并停止，不会终止进程或换端口。菜单及服务使用当前终端；正式 Web 不自动启动 Vite 或 Daemon。主菜单选择 `4` 检查环境和实际工作区包。普通 Web 不要求 Rust；节点原生 Host 使用 `pnpm run build:daemon` 单独构建。完整菜单见 [CLI 合同](docs/harness-cli.md)。

打开 `http://localhost:5173`。本机数据尚无账户时，首次访问创建 UID 1 的超级管理员；之后不开放公开注册，由超级管理员在“设置 → 账户”新增管理员或普通账户、编辑和删除账户、按 UID/用户名/邮箱/角色/创建时间筛选，并可把超级管理员权限转移给其他账户。删除账户会释放其 UID，后续优先复用最小空号。密码至少 8 位并须包含至少 3 类字符，初始化或创建账户时需设置密码；忘记密码时可用恢复密钥重设密码。管理员登录后可在“设置 → 账户”生成或设置独立恢复密钥。邮箱仅用于账户资料和筛选，邮箱找回尚未接入。登录后可在“设置 → 账户”添加通行密钥；Windows Hello、设备 PIN、生物识别或密码管理器只负责本机验证，LFAA 不接收设备 PIN、生物特征或私钥。开发环境通行密钥默认限定 `http://localhost:5173`；使用 `http://127.0.0.1:5173` 时仍可用密码登录，但不会显示通行密钥入口。

当前采用用户确认的混合存储：设置、应用偏好、加密 Provider 配置和节点目录配置保存于 `<LFAA_DATA_DIR>/storages/configuration.json`；Agent 会话、消息、活动与用量追加保存于 `sessions/<会话摘要>/events.jsonl`；账户、登录会话、权限、节点、任务、写作正文与修订继续使用本机 SQLite。Provider 加密密钥仍位于 `credentials/settings.key`，明文不下发前端。旧数据迁移按导入、回读校验、备份后再退役旧权威表的顺序执行；SQLite 迁移版本以 `packages/storage/storage-sqlite/src/database.ts` 为准，当前最高迁移号为 38。完整归属、备份与恢复见[混合存储合同](docs/harness-storage.md)。本机回环 CLI 可持久化自动生成的 JWT 密钥；公网生产继续要求强 `JWT_SECRET` 和绝对数据目录。通行密钥仍需匹配 `WEBAUTHN_RP_ID`、`WEBAUTHN_ORIGIN`。

控制端使用 Node 内置 SQLite。Windows 固定盘开发默认将数据放在当前用户 `%USERPROFILE%\.lfaa\data`；Windows 可移动盘开发和非 Windows 开发环境默认放在项目根目录 `data/`。本机活动数据路径随工作副本、部署方式、环境变量和用户设置而异，必须按本次运行配置确认，不得从仓库目录推断；新克隆仓库不带运行数据，首次启动时才创建，`data/` 已被 Git 忽略。管理员可在“设置 → LFAA 配置 → 项目与存储”自定义本机数据根目录：Windows 完整开发启动器和已安装 Electron 桌面端会在完整重启时停止服务、复制并核对 SQLite、凭据和节点文件，再切换路径；旧目录保留作回退。开发模式下显式系统环境变量 `LFAA_DATA_DIR` 优先，设置页会说明该部署位置由环境变量管理。Linux 生产服务由部署环境配置绝对持久化路径（例如 `/var/lib/lfaa`），Web 设置页不会改写服务器目录。用户 Home 中其他应用的 `config/`、`state/`、`plugins/`、`runtimes/` 不会被扫描或合并。

## 首期功能范围

- SteamCMD 游戏目录和一键部署流程，逐步扩展至 40+ 款游戏。
- Minecraft 服务端核心目录、部署、实例配置、启停、日志和停服后世界备份。核心目录包含多种部署类型，但每个版本/构建/运行时/节点组合以实时目录和业务服务校验为准。常规执行默认使用 native；显式 AppContainer 仅保留旧 Vanilla 兼容路径，不能据此宣称所有核心均处于 OS 沙盒。节点与安装包实机验收状态见[开发计划](docs/开发计划.md)。Minecraft 插件/模组安装仍未接入。
- 所有应用共用的文件管理工作台；管理员可在在线 daemon 节点的 `LFAA_DATA_DIR` 内浏览、搜索、新建、编辑 UTF-8 文本、上传、下载、重命名和删除文件。凭据与控制端数据库目录不开放；路径越界、链接文件、超过大小限制的文件会被拒绝。上传不覆盖现有文件，运行中的 Minecraft 实例目录禁止修改。
- 游戏实例、配置文件、存档、日志、备份和运行环境的持久化管理。
- 响应式 Ant Design 管理界面、可视化配置编辑、实例状态和主机资源监控。
- Minecraft 任务进度、Daemon 日志及节点/实例状态通过已认证的 Socket.IO 变更通知触发页面刷新，状态和日志仍由受保护 REST API 提供；Daemon 继续使用 HTTP 心跳与任务上报。交互式终端和资源监控尚未接入。
- JWT 用户认证和授权；部署、文件、进程等操作由后端进行权限校验。
- AI Work 内置在 SteamCMD、Minecraft 和写作应用中。LLM 负责理解与推理，主 Agent 规划任务、调用工具，必要时召唤子 Agent 协作。
- Docker Compose 部署控制端；`daemon` 可安装在本机或多台远程主机执行具体任务。
- Web 和 Electron 目标共用 React 前端；当前仍有 Tauri Windows 打包实现，尚未切换成 Electron 默认发布入口。Windows/macOS Electron 是桌面目标，Linux 和 Android 尚属后续平台计划。

## 目录职责

- `.github/`：GitHub 问题表单与 Pull Request 模板，不承载产品运行代码。
- `.agents/skills/`：LFAA 仓库 AI 技能的唯一正文来源；根 `AGENTS.md` 和开发规范仍是权威规则。
- `.claude/`、`.codex/`：对应工具的轻量技能入口，正文统一回到 `.agents/skills/`。
- `packages/client/ui-*`：现有界面与交互，按聊天、命令、设置、导航、文件及应用划分。
- `packages/boot/app-boot`、`packages/bundle/*`：共享装配入口与组合补丁。
- `packages/api/*`：Gateway 与可撤销的控制器路由。
- `packages/core`、`settings`、`storage`、`identity`、`credentials`：现有 AI、账户、设置、权限及持久化能力。
- `packages/games`、`packages/document/writing`、`packages/host/daemon`：LFAA 业务与节点执行。
- `apps/cli`、`apps/web`、`apps/daemon`：命令行、Web 与节点启动工具。
- `apps/desktop-electron`、`apps/desktop-tauri`：保留现有外壳和打包路线，使用相同的编译后 Harness 入口。
- `native/system`：现有 Windows AppContainer/Job Object Sandbox Host。
- `apps/web/public`：原公共静态资源。
- `data` 与旧 `server/data`：既有运行数据及历史候选数据，均未迁移或重置。
- `dist`：唯一产物目录，各构建只清理自身子目录。
- `docs/harness-packages.md`：全部上游目录及每个实际包/占位目录的状态。
- `docs/quality/design-qa.md`：历史设计验收记录。

## 技术方案

当前前端使用 React 18、TypeScript、Ant Design 5、Vite 和 Socket.IO Client；控制端使用 Express、Joi、JWT、Socket.IO、Winston 与 Node 内置 SQLite。Minecraft 的显式 AppContainer 兼容路径使用最小 Rust helper 调用原生 AppContainer 与 Job Object API；常规 native 执行使用目标节点进程权限，不宣称 OS 沙盒。文件操作通过受认证 HTTP 接口排入 Daemon 节点任务。交互式终端和资源监控尚未接入。

项目统一使用 pnpm 工作区安装 `packages/*/*` 与 `apps/*` 已声明的 Node.js 依赖。Windows 工作台选项 `1` 安装、`2` 选择 Harness 运行模式、`3` 构建、`4` 检查环境及安装范围、`0` 退出。安装按根目录 `package.json` 指定的 pnpm 版本运行，并生成或更新根目录 `pnpm-lock.yaml`。Daemon Sandbox Host 与桌面原生 Rust/Cargo 依赖不属于 pnpm 管理范围，需使用各自构建入口。

## 数据约定

- 一次本机开发中，server 与本机 daemon 使用同一个 `LFAA_DATA_DIR`，这样控制端数据库与本机节点共用一个持久化根；它们仍按子目录分工。控制端的账户、权限、设置、AI 配置、节点登记、任务与实例元数据放在 `database/lfaa.sqlite`，密钥放 `credentials/`。
- 每台远程 daemon 主机有自己的 `LFAA_DATA_DIR`；游戏服务端文件、实例世界、Java 环境和辅助依赖留在执行任务的节点本机。控制端数据库只保存必要元数据与相对路径，不复制或承载这些大文件。
- `games/steamcmd/` 是 SteamCMD 部署的游戏服务端文件；`lib/steamcmd/` 是 SteamCMD 下载器和命令行工具本身。
- 数据按内容命名，例如 `games/steamcmd/`、`games/minecraft/`、`environments/java/`、`lib/pty/`、`lib/zip-tools/` 和 `plugins/`；路径不包含 `server/` 或 `nodes/<节点名>/`。
- Windows 可移动盘开发默认跟随项目目录，固定盘开发默认进入当前用户数据目录；设置页可安排完整数据迁移，桌面端可选文件夹，源目录保留。Linux 服务由部署配置指定持久化卷。Electron macOS、Linux 桌面与 Android 数据路径和安装流程尚未接入；升级程序不得清理游戏实例和运行环境。

## 文档

- [开发计划与进度](docs/开发计划.md)
- [系统总体架构](docs/系统总体架构.md)
- [更新日志](docs/updata-log.md)
- [开发规范](开发规范.md)
- [AI 协作技能索引](.agents/README.md)
- [设计验收记录](docs/quality/design-qa.md)
