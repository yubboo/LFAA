# @lfaa/web

LFAA 的网页能力 seam。抓取实现按优先级注册，工具与 Agent 只依赖这个服务。

## 接口

| 导出 | 作用 |
| --- | --- |
| `WebService` | `ctx.web`：注册/列出实现、按优先级取正文 |
| `WebProvider` | 单个实现的契约（`id`、`priority`、`fetchText`） |
| `orderProviders` | 服务与测试共用的纯排序函数 |

`fetchText` 按优先级从高到低依次尝试，全部失败才抛错，并汇总每个实现的错误。

## 安装

```bash
pnpm add @lfaa/web
```

包默认导出 Cordis 插件，Loader 可按包名装载；搭配 `@lfaa/web-fetch-http` 获得默认 HTTP 实现。