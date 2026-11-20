# @lfaa/command-compact

把「立即压缩上下文」暴露成 `compact_context` 工具。

## 行为

- 工具只**登记请求**；`@lfaa/compaction-basic` 在下一次模型调用前消费该请求，并按硬预算压缩（4 千字符、工具结果上限 600、保留最近两轮）。
- 请求是一次性的：消费即清除，不会排队。
- 工具结果会说明生效时机，避免模型误以为上下文已经清空。
- 请求是进程级（本机单用户）：某次运行里发出的请求，会被下一次压缩消费，无论是哪次运行。

## 用法

先挂 `@lfaa/compaction-basic`，再挂本插件。包默认导出 Cordis 插件（`inject: ["compaction", "tools"]`）。