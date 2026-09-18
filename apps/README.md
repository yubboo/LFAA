# apps：可运行应用入口

> `apps/` 放“可以直接启动的应用”，共享能力尽量放到 `packages/`。

| 目录 | 作用 |
|---|---|
| `web/` | Vite + React Web 工作台；当前 UI 开发主要入口。 |
| `desktop/` | Electron 桌面应用骨架。 |
| `server/` | 后续 Agent Server / Remote Runtime 入口。 |
| `cli/` | CLI 命令行入口。 |

共同结构：

```text
package.json   包配置 / 依赖 / scripts
README.md      当前职责
src/           源码
tsconfig.json  TypeScript 配置
```

完整导航：`docs/项目结构与代码地图.md`。
