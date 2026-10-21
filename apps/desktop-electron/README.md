# Electron 桌面入口

Windows 产品主线使用根 `build:desktop:win` / `build:win`；打包读取唯一更新日志，通过版本隔离暂存与交付目录组装。数据目录与迁移继续归主进程和现有存储工具；Web 使用同一共享客户端。

`main.mjs` 是本机服务与桌面更新 Owner。Control Plane/Daemon 子进程开启 IPC；`service-shutdown.mjs` 发送既有 `lfaa-shutdown` 并监听退出，退出码 0 才确认关闭。Daemon 未完成前保持控制端可用，超时/断线/异常退出拒绝安装而不强杀。启动失败分支也不能跳过关闭确认。

桌面 Browser Dock 的原生网页由 `native-browser-workspace.mjs` 管理，使用专用非持久 Session，不修改应用默认 Electron Session；Cookie、缓存和站点存储随应用进程结束清理。网页站点权限由当前桌面的系统对话框处理，下载必须由用户选择保存位置；关闭标签/窗口时回收视图和待处理权限/下载。主窗口 IPC 只接受当前配置的 LFAA 前端来源。Electron 主进程启用仅绑定 `127.0.0.1`、由系统分配端口的 CDP，用于 Control Plane Browser Owner 按认证账户、LFAA Session 和当前选中的原生标签 Target 附着；端点不传给 Renderer、Agent Tool 或远程网页。原生标签绑定源码已接入，桌面真实页面、登录、权限、下载和响应式交互仍待实页验收。

退出被拒绝时撤销“正在关闭”状态并恢复既有更新检查调度，应用保持打开，不留下永久停止检查的状态。

Daemon 可能先等待已领安装任务再停止游戏实例；桌面等待预算到期可拒绝退出/安装，不冒充安全停机。Tauri 旧关闭实现不由此修复。定向 Node 回归不证明真实 Java 进程、Electron 窗口或 NSIS 升级已验收。

候选输出 `dist/apps/desktop-electron/LFAA-<版本>/` 仅含安装器、blockmap、latest.yml。先准备并核验 Release 工件，再宣告 update.json；构建不授权发布或安装。macOS 打包与签名未接入。
