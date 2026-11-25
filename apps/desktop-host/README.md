# LFAA 桌面端宿主

`apps/desktop-host` 是桌面端的宿主进程：由 `apps/desktop` 用 Electron 的 Node 模式（`ELECTRON_RUN_AS_NODE=1`）作为子进程拉起，内部运行 `@lfaa/web-server` 的生产宿主（静态托管 + `/api` 网关），并通过 IPC 上报本机地址与退出状态。

与 DSH 的 `apps/desktop-host` 对应：壳只负责窗口、菜单与生命周期，宿主独立成进程。

## 约定

- 启动参数：`node index.js <webRoot> <projectRoot>`。
- IPC 事件：
  - `{ type: "ready", url, port }`：本机服务就绪，壳据此 `loadURL`。
  - `{ type: "fatal", message, diagnostic }`：启动失败，壳展示可读错误并退出。
  - `{ type: "shutdown-complete" }`：已停止本机服务，壳随后退出。
- 壳发送 `{ type: "shutdown" }` 触发优雅退出；IPC 断开（壳崩溃或退出）也会触发停止，避免遗留端口。

## 命令

```powershell
pnpm build       # 用 tsdown 构建 lib/index.js
pnpm typecheck   # 类型检查
```

打包时 `apps/desktop/scripts/package.mjs` 会把本进程的 `lib/index.js` 复制到安装包的 `desktop-host/` 目录，与 `node_modules` 一起分发。

内置浏览器通过桌面壳的私有 IPC 接收 Electron 下载事件，再由浏览器服务统一执行策略与历史持久化。
