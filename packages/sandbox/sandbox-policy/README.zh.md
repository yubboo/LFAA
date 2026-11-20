# @lfaa/sandbox-policy

让部署按工具固定沙箱模式，而不是依赖每个调用点自觉。

## 行为

- `mode` 设置所有受约束工具的默认模式；`byTool` 按工具覆盖；`onlyTools` 限定策略作用范围。
- 不返回模式时保持调用方 `sandboxMode` 不变（缺省放行既有行为，挂载本插件不会静默改变现状）。
- 通过 `ToolsService.setSandboxResolver` 注册，运行在沙箱判定**之前**——策略影响的是判定本身，而不只是执行。
- 未装配 `sandbox` 服务时策略空转（工具层本就不做沙箱检查）。

## 用法

```ts
ctx.plugin(sandboxPolicyPlugin, { mode: "workspace-write", byTool: { run_command: "read-only" } });
```

包默认导出 Cordis 插件（`inject: ["tools"]`）。