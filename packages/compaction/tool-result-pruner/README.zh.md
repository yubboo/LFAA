# @lfaa/tool-result-pruner

通过 `@lfaa/tools` 的中间件 seam，把工具结果压到可读且可控的体量。

## 行为

- 清掉 ANSI 颜色控制符、行尾空白与连续空行。
- 按行数（默认 1200）与字符数（默认 4 万）截断，保留首尾并写明「中间 N 行/字符已省略」。
- 失败结果保持原样，错误原文不被动过，便于排查。
- 支持 `byTool` 按工具覆盖阈值（`read_file`、`list_dir` 等可以更严）。
- 阈值刻意低于落盘阈值：常规结果先被精简，真正超大的仍由 spill-local 落盘处理。

## 用法

```ts
ctx.plugin(toolResultPrunerPlugin, { maxLines: 800, byTool: { list_dir: { maxLines: 300 } } });
```

包默认导出 Cordis 插件。