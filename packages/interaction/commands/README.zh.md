---
description: "斜杠命令注册 seam：插件向 Host 注册命令，聊天输入栏通过 /api/commands 发现并执行。"
kind: "package"
---

# @lfaa/commands

Host 侧命令注册表，插件不必改聊天客户端就能贡献斜杠命令。

| 入口 | 作用 |
| --- | --- |
| `ctx.commands.register({ name, title, description, kind, source, execute })` | 注册命令，返回注销函数 |
| `ctx.commands.list()` | 公开命令视图，按名称排序 |
| `GET /api/commands` | 列出已注册命令 |
| `POST /api/commands/run` | `{ name, args? }` → `{ ok, prompt?, message? }`；未知命令 404 |

## 命令类型

- `prompt`：把 `args` 展开为提示词，客户端放进输入框供用户确认后发送。
- `message`：返回一条简短回执，客户端以提示条展示。

## 内置命令

`/summarize`（总结当前会话）与 `/explain`（用更简单的话解释上一条答案），由插件自身注册，用于打通往返链路。

## 范围

只做发现与执行：不落存储、没有后台任务，也不会自行把提示词注入正在运行的对话。