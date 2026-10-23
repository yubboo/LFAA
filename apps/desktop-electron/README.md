# Electron 桌面入口

Windows 产品主线使用根 `build:desktop:win` / `build:win`；打包读取唯一更新日志，通过版本隔离暂存与交付目录组装。源码级日志可连续记录在同一产品版本下；若最新记录没有包状态，预检会沿历史查找最近的同版本桌面包记录，并用它校验 `update.json`。它不会从其他版本继承包状态或发布说明。数据目录与迁移继续归主进程和现有存储工具；Web 使用同一共享客户端。

`main.mjs` 是本机服务与桌面更新 Owner。Control Plane/Daemon 子进程开启 IPC；`service-shutdown.mjs` 发送既有 `lfaa-shutdown` 并监听退出，退出码 0 才确认关闭。Daemon 未完成前保持控制端可用，超时/断线/异常退出拒绝安装而不强杀。启动失败分支也不能跳过关闭确认。安装包 Profile 导入检查在根 `dist/.tmp/desktop-electron/` 下为每次运行创建独立 `LFAA_HOME` 与 `LFAA_DATA_DIR`，结束后清理，不会读取或争用用户实际账户/控制数据。

Windows NSIS 安装页允许选择安装位置，并在目录无效或空间不足时给出原因；可选将随包 CLI 加入当前用户 PATH。安装期间显示 NSIS 实际文件明细，完成页可分别选择运行 LFAA 和创建桌面快捷方式。旧版曾把安装目录下的 `data/` 保存为默认数据位置；升级后若该旧目录不可用，桌面端会改用当前用户的 `.lfaa/data`，在配置中保留旧路径恢复记录，并提示旧目录数据没有被移动或删除。明确配置在 LFAA Home 的数据位置仍按原规则校验，不会自动改写。

Windows x64 桌面包的 `node-pty` 预编译目录只保留 Windows x64 运行文件；打包时排除 PDB 调试符号及 ARM64/macOS 预编译文件，避免安装时复制当前目标平台用不到的内容。安装向导展示的所需空间是解压后落盘体积，不是下载的安装器文件大小；Electron/Chromium 与随包 Node、CLI 及控制端运行组件构成了主要体积。

桌面 Browser Dock 的原生网页由 `native-browser-workspace.mjs` 管理，使用专用非持久 Session，不修改应用默认 Electron Session；Cookie、缓存和站点存储随应用进程结束清理。网页站点权限由当前桌面的系统对话框处理，下载必须由用户选择保存位置；关闭标签/窗口时回收视图和待处理权限/下载。原生网页视图的位置由 Client 按动画帧合并，串行发送给主进程；导航在主文档提交后返回，后续资源仍由页面自行加载。主窗口 IPC 只接受当前配置的 LFAA 前端来源。Electron 主进程启用仅绑定 `127.0.0.1`、由系统分配端口的 CDP，用于 Control Plane Browser Owner 按认证账户、LFAA Session 和当前选中的原生标签 Target 附着；端点不传给 Renderer、Agent Tool 或远程网页。原生标签绑定源码已接入，桌面真实页面、登录、权限、下载和响应式交互仍待实页验收。

退出被拒绝时撤销“正在关闭”状态并恢复既有更新检查调度，应用保持打开，不留下永久停止检查的状态。`tests/service-shutdown.test.mjs` 除 IPC 原语回归外，还从源码启动隔离 Control Plane，验证 `lfaa-shutdown` 等到 Cordis 资源释放、进程以 0 退出并释放 loopback 端口；这不覆盖真实 Electron 窗口、Daemon 或安装更新顺序。

Daemon 可能先等待已领安装任务再停止游戏实例；桌面等待预算到期可拒绝退出/安装，不冒充安全停机。Tauri 旧关闭实现不由此修复。定向 Node 回归不证明真实 Java 进程、Electron 窗口或 NSIS 升级已验收。

候选输出 `dist/apps/desktop-electron/LFAA-<版本>/` 仅含安装器、blockmap、latest.yml。先准备并核验 Release 工件，再宣告 update.json；构建不授权发布或安装。macOS 打包与签名未接入。
