# @lfaa/spill-local

通过 `@lfaa/tools` 的中间件 seam，把超长工具输出落到本机文件，避免一条大命令撑爆上下文。

## 行为

- 阈值与窗口可配：默认超过 24k 字符落盘，回 4k 头部 + 2k 尾部。
- 完整输出写到 `<root>/<sessionId>/<时间>-<工具>-<随机>.txt`，结果带 `metadata.spillPath` 与原始字符数。
- 保留 `ok`、`summary`、`fileChange`，只替换 `output` 为窗口 + "用 read_file 分段读取"的提示。
- 未超长的结果原样通过。

## 用法

```ts
ctx.plugin(spillLocalPlugin, { root: "E:/lfaa-data/spills", maxChars: 40_000 });
```

默认根目录是 `~/.lfaa/spills`。包默认导出 Cordis 插件。