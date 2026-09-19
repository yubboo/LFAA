# apps：可运行宿主入口

> `apps/` 只放“可以直接启动的应用宿主”。Web-first 只是验证顺序，不代表共享 UI / 业务归 Web 所有。

| 目录 | 作用 |
|---|---|
| `web/` | Vite + React Web 宿主：启动、Router、Web Host Adapter、本地开发桥。 |
| `desktop/` | Electron 桌面宿主骨架：窗口、IPC、Desktop Host Adapter。 |
| `server/` | 后续 Agent Server / Remote Runtime 宿主。 |
| `cli/` | CLI 宿主：命令解析、终端呈现、CLI Adapter。 |

## 严禁

`apps/*` 不得成为共享业务仓库：

- 不放 Provider 厂商实现；
- 不拥有 Config / Account / Auth 真值；
- 不复制 `packages/ui` 的业务 Feature UI；
- 不把可跨宿主复用的逻辑留在 App。

可复用图形 UI → `packages/ui`。
配置设置业务 → `packages/config-system`。
宿主只组装公共 API 与平台能力。

完整导航：`docs/项目结构与代码地图.md`。
