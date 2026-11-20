# @lfaa/tool-todo

LFAA 智能体的待办清单工具包。

## 工具

| 工具 | 作用 |
| --- | --- |
| `todo_write` | 创建或更新当前会话的任务清单（同 `id` 覆盖，新 `id` 追加） |
| `todo_read` | 读取当前清单与完成进度统计 |

清单按会话保存在内存中，插件卸载时清空。

## 安装

```bash
pnpm add @lfaa/tool-todo
```

包默认导出 Cordis 插件本体，可由 Cordis Loader 直接装载。