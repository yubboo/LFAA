# @lfaa/system-prompt

让插件参与系统提示词组装，不用改 Agent。

## 行为

- `ctx.prompt.registerSegment({ id, order?, text })`：`text` 可以是字符串，也可以是异步函数，便于读取实时设置。
- `compose()` 按 `order` 升序（同序按注册先后）拼接非空段落，段之间空一行。
- 同 `id` 重复注册即替换；返回的注销函数用于卸载。
- 某段求值抛错时只跳过该段，不影响整轮运行。
- Agent 每轮运行只合成一次，追加在内置提示之后，保证前缀稳定、利于提示缓存。

## 用法

```ts
ctx.plugin(systemPromptPlugin);
ctx.prompt.registerSegment({ id: "team-policy", order: 50, text: () => "提交前必须跑 pnpm check" });
```

包默认导出 Cordis 插件。