# 应用入口

此目录存放平台启动器与插件装配代码。CLI 统一分发启动命令，目前有两个运行形态：

| 目录 | 运行形态 | 入口 |
|---|---|---|
| `apps/cli/` | 命令行分发 | `pnpm lfaa web [--open]` → `apps/cli/src/bin.ts` → `@lfaa/web-server` |
| `apps/web/` | 浏览器前端 | `apps/web/src/main.tsx`，由 Vite 托管或由生产宿主静态托管 |
| `apps/desktop/` | 桌面端壳（Electron） | `apps/desktop/src/main.ts`，负责窗口、菜单与生命周期 |
| `apps/desktop-host/` | 桌面宿主进程（Node 模式） | `apps/desktop-host/src/index.ts`，运行 `@lfaa/web-server` 生产宿主，由壳作为子进程拉起 |

- Web：Windows 菜单 2 先做依赖预检与产物构建，再通过 `pnpm lfaa web --open` 启动，占用 `127.0.0.1:5173`，Vite 监听成功后自动打开默认浏览器；后台任务与探针不带 `--open`，不会弹窗。
- 桌面端：菜单 3 调用 `pnpm desktop`（需先有构建产物），桌面宿主固定监听 `127.0.0.1:5173`；启动前菜单会结束旧桌面端与占用该端口的进程再重启。Web 与桌面端共用 5173，同一时间只能跑一个入口；菜单 7 调用 `pnpm build:desktop` 生成 NSIS 安装包。
- 两者共用同一套四栏工作台与 Host API，数据都落在 `~/.lfaa`；桌面端方案见 [桌面端开发方案](../docs/features/desktop.md)。
- 桌面端的启动/打包脚本（`apps/desktop/scripts/`）、打包配置（`electron-builder.config.mjs`）与图标资源（`resources/`）都放在应用目录内，与 DSH 的 `apps/desktop` 布局一致；宿主独立为 `apps/desktop-host`，壳以 `ELECTRON_RUN_AS_NODE` 子进程启动它并通过 IPC 通信。仓库根 `scripts/` 不承载桌面构建逻辑，根 `package.json` 只做 `start:desktop` / `package:desktop` 转发。

`apps/` 只做启动与平台适配，不允许直接依赖 Host 包（`pnpm check` 的 `app-host-import` 规则强制），唯一例外是显式 boot 包 `@lfaa/web-server`。