# 插件运行时可行性验证

状态：**已接入运行时**（PoC 13/13 步，DEV-000184、DEV-000185）。约束 1 已按方案 A 落地（插件包默认导出），插件页的安装/启用/停用/卸载/二创都走真实 Loader 与 profile 记录。本文记录已验证事实、约束与仍未完成的部分。

## 验证方式

`scripts/probe-loader.mjs`（`pnpm probe:loader`）用内嵌的 `vendor/loader` 起一个最小 profile：

```
临时 profile 目录
├── cordis.yml          # 声明要装哪些插件（直接写 @lfaa/* 包名）
├── hello-original.mjs  # 二创对照：原版插件
└── hello-fork.mjs      # 二创对照：复制后修改的插件
```

## 已验证（13/13）

| 步骤 | 结果 |
|---|---|
| 解析 `cordis.yml` | entries = tools, metrics |
| 装载 Loader 服务 | `ctx.loader` 就绪 |
| 按包名装载 `@lfaa/tools` | 注册 8 个工具（无需导出夹具） |
| 卸载 | `ctx.tools` 变为 `undefined` |
| 重新装载 | 再次注册 8 个工具 |
| 并存装载第二个插件 | 前一个插件的工具未受扰动 |
| 只卸载 `tools` | `metrics` 条目保留 |
| 全部卸载 | loader store 为空 |
| 释放 Loader | `ctx.loader` 消失 |
| 二创插件与原插件并存 | 工具数 8 → 10 |
| 二创插件独立执行 | `hello from fork`（与 `hello from original` 明确不同） |
| 卸载原版 | 二创仍在，工具数 10 → 9 |
| 卸载二创 | 回归基线 8 |

结论：**装载、卸载、重载、并存、选择性卸载、二创，全部在真实 Cordis 运行时上成立。**

## 约束 1（已解决）：Loader 只认默认导出

`vendor/loader/src/config/entry.ts` 里是 `unwrapExports(default ?? exports)`，而 LFAA 的包导出的是**具名**插件（如 `toolsPlugin`）。所以 PoC 必须加一层夹具：

```js
export { toolsPlugin as default } from "file:///…/packages/core/tools/lib/index.js";
```

**已按方案 A 落地**：14 个插件包的 `src/index.ts` 补了 `export default xxxPlugin`，探针改为直接按包名装载，不再需要夹具。

约束已固化进 `AGENTS.md` §2，并由 `pnpm check` 的 `plugin-default-export` 规则强制：`src/index.ts` 出现 `*Plugin` 具名导出却没有 `export default` 时报错（只约束 Host 入口，client 插件由 Vite 静态装配，不适用）。

已补默认导出的 14 个包：`agent`、`browser`、`chat`、`jobs`、`llm`、`memory`、`rules`、`subagent`、`tools`、`plugins`、`shell`、`skills`、`sections`、`workspace`。

## 约束 2：核心服务必须先装载

二创场景第一次失败，原因是新 Context 里没有 `ctx.tools`，而二创插件写了 `inject: ["tools"]`，于是插件挂起、工具未注册。补上核心服务后通过。

这说明 **profile 的装载顺序有意义**：`cordis.yml` 必须先声明基础服务，再声明依赖它们的能力插件。落地时需要一条显式的启动顺序约束（或让 Loader 的 `await` 语义承担等待）。

## 二创的最小形态（已验证可用）

一个独立的 `.mjs` 文件即可成为插件，不需要进 `packages/`：

```js
export default {
  name: "hello-fork",
  inject: ["tools"],
  apply(ctx) {
    ctx.effect(() => ctx.tools.registerTool({ /* … */ }));
  },
};
```

配合 `ctx.tools.registerTool` 的注销函数 + `ctx.effect`，卸载时会自动清理注册。这就是「复制 → 改 → 装进来 → 卸掉」的最小闭环。

## 已接入 Host（DEV-000186）

`plugin-manager` 已从假实现换成 Loader 真实现：

- 安装只登记；启用 `ctx.loader.create()`；停用 `ctx.loader.remove()`；状态以「条目是否拿到 fiber」为准，导入失败会记录 `error` 而不是伪装成 `running`。
- 可安装目录改为真实插件包清单（14 个具备默认导出的包），不再有硬编码的 text-counter。
- Host 在装配时先挂 Loader，`baseUrl` 指向 `apps/web` 以便解析 `@lfaa/*`。
- `pluginsPlugin` 改为插件对象并声明 `inject: ["tools", "loader"]`——Cordis 的服务可见性按 fiber 祖先链解析，Loader 与插件服务是兄弟 fiber，不声明注入会报「cannot get property without loader」。

## 可配置装配与二创现状（DEV-000195）

bundle 已拆成**核心必装 + 可选**：

| 类别 | 模块 | 说明 |
|---|---|---|
| 核心 | sections、workspace、llm、rules、memory、shell、tools、skills、plugins、agent、chat | 应用启动必需，`provided` 恒为真 |
| 可选 | browser、jobs、subagent | 默认不装配；在插件页安装并启用后由 Loader 装载 |

实测：`catalog=14 / provided=11 / installable=3`；安装并启用 `@lfaa/browser` 后状态 `running`，`GET /api/browser` 返回 200。

**二创现状**：已实现「包级复制 + 依赖探测 + 失败回滚」。副本写入 `profile/plugins/<新 id>`，记录带 `originPluginId`。但启用**当前在 Windows 上不可用**：pnpm 的 `node_modules` 使用相对软链，经 junction 后解析失效（实测 `Cannot find package '@deepseek-ai/cordis'` 无法通过目录级 junction 修复）。因此实现为探测失败即删除副本并返回可执行原因，不留坏记录。真正可用需要 **profile 级依赖安装**（在 profile 内生成 package.json 并执行 `pnpm install`），属独立工作项。

## 尚未完成（不要当成已完成）

- **版本兼容校验**：安装前不校验插件声明的 DSH / Node 版本，装完能加载但行为不兼容时才会暴露。
- **依赖图解析**：不解析插件之间的依赖关系与加载顺序，仍靠 `inject` 声明与装配顺序约定。
- **HMR**：`vendor/hmr` 尚未内嵌，改插件代码需要重启进程。
- **二创的 profile 级依赖安装**：副本的依赖解析在 Windows 上受 pnpm 相对软链限制；当前探测失败即删除副本并返回原因，真正可用需要在 profile 内生成 `package.json` 并执行 `pnpm install`。

已解决（历史上记在这里，避免再被当成待办）：

- 插件页已接真实条目与真实状态（安装、启用、停用、卸载、二创），不再是旧字段。
- 静态装配已从 `apps/web/server.ts` 收进 `@lfaa/bundle-web`；与 Loader 的重复安装由 `providedModules` 互斥，核心模块不会被同一服务装两次。
- 装载失败会回滚（`pnpm remove` + 删除记录），不留半装状态。
- 二创的包级复制与失败回滚已实现，限制见上文「二创现状」。

## 建议的下一步顺序

1. ~~定下约束 1 的方案并补默认导出~~（已完成）。
2. 把 `plugin-manager` 的假实现换成 `ctx.loader` 真实现（profile 读写 + 条目增删）。
3. 插件页接真实状态（这次终于有真实数据源了）。
4. 再考虑 HMR 与包级二创。
