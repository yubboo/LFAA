# Resource Dev Bridge

仅运行在 Vite dev-server 的 Node 进程。负责 `.lfaa/*` 资源元数据扫描与 HMR changed 通知，不进入浏览器 bundle，不读取资源正文。
