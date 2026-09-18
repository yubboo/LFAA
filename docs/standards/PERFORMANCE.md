# LFAA 性能与资源预算规范

涉及运行时、数据库、UI、网络、Agent、Tool 或大文件的模块，在进入 `in-progress` 前必须定义：

- 测量场景与数据规模；
- P50/P95/P99 延迟；
- 吞吐或最大并发；
- CPU、内存、磁盘、网络预算；
- 超时、取消、背压；
- 可接受回归阈值。

UI 主线程不得执行数据库、文件扫描、模型调用或阻塞式系统操作。

SQLite 必须定义事务、busy timeout、WAL、索引、慢查询、Migration 和恢复预算。


## Web 开发启动预算

`LFAA-Setup.bat → 2 启动 Web` 属于高频开发操作。

性能要求：

- 端口检测不得逐个执行 1 秒级网络超时；
- 无已有 LFAA、5173 空闲时，端口解析应只做本机 Listener 查询；
- 已占用端口只探测实际 Listener；
- 单个 LFAA 识别请求超时应小于 500ms；
- 启动动作不得隐式执行 `pnpm install`；
- 缺依赖时快速失败，并提示运行菜单 1。

Windows 实机启动耗时需要在实际环境中记录，不允许用静态检查伪造性能通过。


## Web Terminal 性能

- xterm resize 必须使用 `ResizeObserver`；
- Shell I/O 使用 WebSocket/HMR 事件流，不允许轮询；
- 终端滚动缓冲默认限制，避免无限增长；
- PTY session 数量必须设置上限；
- UI 主线程不得直接执行进程操作。
