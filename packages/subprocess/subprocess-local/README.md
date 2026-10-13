# lfaa-subprocess-local

实现受管进程和唯一原生 PTY。`spawn.ts` 校验协议；`pty.ts` 在线程中运行 `pty-worker.mjs`，通过官方 node-pty 1.1.0 的预编译文件使用 Windows ConPTY（随依赖提供的 conpty.dll），不使用管道模拟。工作线程不继承开发加载器，原生启动、输入、缩放和终止不会同步阻塞宿主主线程；环境来自调用方显式参数，未传时使用同一 OS 环境白名单。

输出队列按调用方容量限制，超过上限停止终端并报告截断；线程间输出达到 128 KiB 暂停原生读取，确认至 64 KiB 以下恢复，避免消息队列无界增长。支持输入、窗口尺寸、SIGINT、退出码、AbortSignal 和关闭清理。取消先关闭 PTY，超过等待期再调用现有进程树终止 Owner。节点只传必要 OS 环境，不传 Provider/控制端密钥。`async-queue.ts` 保留等待中的首块，结束前已有输出仍能排空。

依赖安装脚本保持禁用，Windows 使用官方预编译资产。其它平台的原生依赖和 Electron 安装版需要单独封装验收；当前 Daemon 产品入口仍仅 Windows x64。源码包构建输出根 `dist/packages/subprocess/subprocess-local/`，不在包目录生成编译产物。
