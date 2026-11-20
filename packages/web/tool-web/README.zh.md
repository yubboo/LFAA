# @lfaa/tool-web

LFAA 智能体的网页读取工具包。

## 工具

| 工具 | 作用 |
| --- | --- |
| `fetch_url` | 抓取公开的 http/https 网页并返回可读正文 |

安全约束：仅 http/https；拒绝 localhost 与内网地址；响应上限 2 MB、正文上限 6 万字符。

## 安装

```bash
pnpm add @lfaa/tool-web
```

包默认导出 Cordis 插件本体。