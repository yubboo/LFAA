# LFAA 桌面端

LFAA 桌面端是同一套四栏工作台的 Electron 运行形态：`apps/desktop` 只负责窗口、菜单与生命周期，真正跑业务的是独立宿主进程 `apps/desktop-host`（用 Electron 的 Node 模式启动，内部运行 `@lfaa/web-server` 的生产宿主：静态托管 `apps/web/dist` + 同一套 `/api` 网关）。壳通过 IPC 拿到本机地址后加载窗口。

目录与 DSH 的 `apps/desktop` / `apps/desktop-host` 保持一致：启动脚本、打包脚本、打包配置、图标资源都在本应用目录内；仓库根 `scripts/` 只保留工作区级工具，`package.json` 只做转发。

## 与 Web 的关系

- 共用同一份 `apps/web` UI 与同一个 Host 运行时，不复制业务实现。
- 共用 `~/.lfaa` 数据目录（项目、会话、记忆、媒体），但 Electron 自身的 localStorage/缓存位于 `%APPDATA%\LFAA`，与浏览器不共享。
- **桌面宿主固定监听 `127.0.0.1:5173`**，窗口地址固定为 `http://127.0.0.1:5173/`；与 `pnpm lfaa web` 的 Web 开发服务器是同一个端口，同一时间只能跑一个入口（菜单 2 / 3 都会先释放 5173）。
- 从仓库菜单 3 启动时，会先结束已在运行的 LFAA 桌面端和占用 5173 的进程，再重启桌面端；若端口被系统进程占用导致释放失败，会给出提示而不是留下空白窗口。
- 现有实现没有跨进程写锁，仍建议同一时间只用一个入口。

## 命令

在本目录直接执行：

```powershell
pnpm build       # 用 tsdown 构建壳入口 dist/main.js
pnpm start       # 启动桌面端（需要包 lib/、Web 产物与宿主 lib/index.js 已构建）
pnpm package:dir # 全量构建 → 构建壳与宿主 → staging → 免安装目录（快速验收）
pnpm package     # 全量构建 → 构建壳与宿主 → staging → NSIS 安装包与免安装 zip
pnpm make-icon   # 重新生成 resources/icon.ico
```

> 安装器会写入 `Uninstall LFAA.exe`，请安装到**空目录**；若目标目录已被其他程序占用，可能反复报「不能打开要写入的文件」。此时改用免安装 `LFAA-<version>-win.zip`（解压后直接运行 `LFAA.exe`）。安装包已做过负载裁剪（只带宿主运行期文件），安装约 **15 秒**、约 340 个文件。

在仓库根等价的转发命令：

```powershell
pnpm build:desktop:app  # 构建壳与宿主（两个 app 一起）
pnpm build:desktop:host # 只构建宿主
pnpm desktop            # = pnpm run start:desktop
pnpm build:desktop      # = pnpm run package:desktop
pnpm build:desktop:dir  # = pnpm run package:desktop:dir
```

调试 UI 时可先 `pnpm lfaa web`，再指定已有开发服务器地址启动壳（不起本机 Host 服务）：

```powershell
$env:LFAA_DESKTOP_URL = "http://127.0.0.1:5173"
pnpm desktop
```

`LFAA_DESKTOP_DEV=1`（仅未打包运行时）会在启动后自动打开 DevTools。

## 结构

| 路径 | 职责 |
|---|---|
| `src/main.ts` | 单实例、拉起/停止宿主子进程、生命周期 |
| `src/host-process.ts` | 宿主子进程：启动超时、IPC 事件、优雅退出与强制结束 |
| `src/window.ts` | 窗口选项与导航、弹窗安全策略 |
| `src/menu.ts` | 中文应用菜单（编辑角色保证 Ctrl+C/V 可用） |
| `src/paths.ts` | 开发态/安装态路径、宿主体位置与默认工作根 |
| `scripts/start.mjs` | 校验产物并启动 Electron |
| `scripts/package.mjs` | 全量构建 → 构建壳与宿主 → staging → 自检 → electron-builder |
| `scripts/make-icon.mjs` | 生成占位图标 |
| `electron-builder.config.mjs` | NSIS 安装包配置（仅当前用户、不签名） |
| `resources/icon.ico` | 桌面图标（占位，正式品牌图可替换同名文件） |
| `.desktop-build/` | staging 与安装包产物（gitignore，不随仓库分发） |

默认工作根是 `~/.lfaa/workspace`；安装目录只读，绝不作为用户工作目录。

## 运行期行为

- 宿主固定占用 `127.0.0.1:5173`；菜单 3 会先结束旧桌面端与端口占用进程再启动，因此重复按 3 等价于「重启桌面端」。
- 窗口尺寸与位置会记住（`~/.lfaa/desktop-window.json`），下次启动恢复；显示器变化导致越界时回退默认尺寸。
- 启动失败、宿主异常与未捕获错误写入 `~/.lfaa/logs/desktop.log`；出问题直接把这个文件发回来即可。
- 单实例：再次启动只聚焦已有窗口。若上次异常退出导致双击无反应，可用 `LFAA.exe --new-instance` 强制再开一个窗口排查。
- 版本号以 `apps/desktop/package.json` 为唯一来源，安装包与 zip 文件名自动跟随。

## 已知限制

- 安装包未签名：部分机器首次运行会出现 SmartScreen「未知发布者」，属于首版取舍。
- 在受限沙箱终端（如 Agent 会话）里直接启动 Electron，可能在启动早期报 `EPERM lstat 'E:\'` 或直接以 `0x80000003` 退出；请在普通终端、开始菜单或双击安装后的快捷方式启动。排查时可临时用 `LFAA_DESKTOP_NO_SANDBOX=1 pnpm desktop` 关闭 Chromium sandbox（默认保持开启，不要用于日常运行）。
- 宿主是独立子进程（`apps/desktop-host`），壳退出时会先请求它停服；若遇到宿主异常，窗口会提示并退出而不是留下白屏。
- 首版关闭 asar（安装目录内代码为明文），后续再评估；托盘、深链、自动更新不在首版范围。

原生内置视图的下载由主进程暂存，经私有父子进程 IPC 交由桌面宿主审批、保存并记录。
