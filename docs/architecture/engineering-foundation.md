# 构建、测试与分包地基（对齐 DSH）

状态：**已实施（DEV-000180、DEV-000181、DEV-000182）**。实现方式以 `E:\lfaa1\deepseek-harness` 的构建模型为准，只保留一处差异：**不发布 `./src/*` 之外的源码直读能力**；`./src/*` 逃生口按负责人要求保留。

## 1. 目标模型（照 DSH）

```
tsconfig.base.json    composite + declaration + paths 门面（@lfaa/* → packages/*/*/src）
每包 tsconfig.json    rootDir src → outDir lib/types（JS + d.ts + map）
tsconfig.host.json    聚合工程：引用全部包工程，并纳入 tests 与 client 做类型检查
build                tsc -b → tsdown 从 lib/types/*.js 打包 → lib/index.js
exports              types → lib/types/index.d.ts，default → lib/index.js
```

关键点：**`paths` 门面负责“开发/测试读源码”，`lib` 负责“运行时读产物”**。因此不需要 `development` 条件导出，也能做到热重载与零构建调试；DSH 正是这么做的。

## 2. 与 DSH 的逐项对照

| 维度 | DSH | LFAA 现状 |
|---|---|---|
| 源码解析 | `tsconfig.base.json` 的 `paths` 门面 | 同，由 `scripts/sync-tsconfig.mjs` 生成 |
| 每包编译 | `extends base`，`rootDir src`，`outDir lib/types` | 同 |
| 聚合类型检查 | `tsconfig.host.json`（noEmit + references） | 同 |
| 打包 | `tsc -b` 出 JS/d.ts → `tsdown` 从 JS 打包 | 同（`fixedExtension: false` 输出 `.js`） |
| 对外入口 | `types → lib/types/*.d.ts`、`default → lib/index.js` | 同 |
| 源码逃生口 | `"./src/*": "./src/*"`（324/340 包） | 同（27/27 包） |
| 包元数据 | `main`/`types`/`files`/`publishConfig`/`repository`，可发布 | 同（27/27，已去 `private`） |
| 测试 | vitest + 多套 config | **不同**：沿用 `node:test`，经 tsx + paths 读源码 |
| Lint / 查重 | oxlint + jscpd | **未做** |
| verify-* 脚本族 | 十余个独立校验脚本 | **部分**：`scripts/check-workspace.mjs` 一个脚本覆盖 9 条规则 |
| 运行时装配 | cordis.yml + Loader + profile + bundle | **未做**：仍为静态 `import` |
| 浏览器模块表 | `client/modules` + `__DSH_BOOT__` + HMR | **未做**：`./client` 仍指向源码，由 Vite 直接消费 |

## 3. 落地脚本

| 脚本 | 职责 |
|---|---|
| `scripts/sync-tsconfig.mjs` | 生成 `tsconfig.base.json`（含 paths 门面）、`tsconfig.json`（兼容壳）、`tsconfig.host.json`、27 个包的 `tsconfig.json` |
| `scripts/sync-manifests.mjs` | 写入 `main`/`types`/`exports`/`files`/`publishConfig`/`repository`，移除 `private` |
| `scripts/build.mjs` | 清 `lib` → `tsc -b` → `tsdown` → 校验 `lib/index.js` 与类型入口 → Vite 构建 |
| `scripts/check-workspace.mjs` | 包命名、exports、深层导入、Host/Client 隔离、依赖声明、循环依赖、中文文件头 |
| `scripts/test.mjs` | 枚举 `packages/**/tests/*.test.ts(x)`，经 tsx + paths 读源码运行 `node:test` |
| `tsdown.config.ts` | workspace 模式，入口 `lib/types/index.js`，输出 `lib/index.js` |

根脚本：`pnpm typecheck`（= `tsc -b tsconfig.host.json`）、`pnpm check`、`pnpm test`、`pnpm build`、`pnpm sync`。

## 4. 验收结果（2026-11-20）

| 项 | 结果 |
|---|---|
| `tsc -b tsconfig.host.json` | 0 错误，28 个工程产出 `lib/types/*.js + *.d.ts + *.map` |
| `tsdown` | 28 个包（含 `vendor/loader`）产出 `lib/index.js`（`@lfaa/llm` 另有 `lib/ark-plan.js`） |
| 裸 Node 解析 | `@lfaa/tools` → `packages/core/tools/lib/index.js`；`@lfaa/llm/ark-plan` → `lib/ark-plan.js` |
| 裸 Node 装配 | 不起 tsx，装出 8 个工具，`dispose` 干净 |
| 开发解析 | `tsx` 下 `@lfaa/tools` → `src/index.ts`、`@lfaa/chat/client` → `client/index.tsx` |
| 测试 | 37 文件 / 142 用例全通过 |
| 边界检查 | 27 包 / 263 源文件，0 错误 2 警告 |
| 构建 | 27 包 + Vite 全通过，退出码 0 |
| 冷启动 | `pnpm lfaa web` → `/` 200、`GET /api/plugins` 200（profile=web） |

## 4.1 应用装配分层（DEV-000187）

参考 DSH 的 `apps/` 形态，把"装配"从 app 移进包：

| 层 | 包 | 职责 |
|---|---|---|
| 启动 | `apps/cli/src/bin.ts` | 只解析参数、调用 `startWeb`、处理信号 |
| 服务 | `@lfaa/web-server`（`packages/host/web-server`） | 建 Context、挂载 bundle、注册 13 个 HTTP 接口、托管 Vite |
| 装配 | `@lfaa/bundle-web`（`packages/bundle/web`） | 按序挂载 Host 能力与 Loader，跨服务联线（独立注入子插件） |
| 前端 | `apps/web` | 只有 `index.html`、`vite.config.ts`、`src/main.tsx`、`app.css` |

`apps/web` 已不再包含任何服务端代码。DSH 的 `apps/web` 同样只有前端资源，服务在 `packages/host/*` 与 `boot/*` 中。

另一个收益：bundle 声明了 `providedModules`，插件管理据此把 14 个已装配包标记为 `provided` 并拒绝重复安装，消除了上一轮"同一服务被装两次"的问题。

## 5. 已知差异与待办

1. **`contract/` 使两个包的主入口落在 `lib/types/src/`**（`plugins`、`skills`）。原因是 `rootDir` 需上提到包根才能同时编译 `src` 与 `contract`。对外出口不变，但内部路径与其他包不同；后续可把契约并回 `src/` 消除该差异。
2. **`./client` 仍指向源码**（`client/index.tsx`），等待 `client-modules` 与浏览器产物立项。
3. **未做**：oxlint、jscpd、verify-* 脚本族、vitest 多套 config、原生模块预构建、cordis.yml + Loader + profile + bundle、`client/modules` + `__DSH_BOOT__` + HMR。
4. **存量告警**：`plugins` 未使用 `@lfaa/skills`；`skills` 未使用 `@lfaa/ui-primitives`。

## 6. 风险与回滚

| 风险 | 回滚 |
|---|---|
| 组合工程要求 `composite`，增量缓存可能掩盖错误 | `build.mjs` 每次先删 `lib`，不做增量复用 |
| `paths` 门面与真实 `exports` 若不一致，会出现“类型通过、运行时失败” | `build.mjs` 校验 `lib/index.js` 存在；裸 Node 解析作为验收项 |
| 27 个包清单由脚本重写 | 清单内容全部来自代码事实（`contract`/`client`/`ark-plan` 是否存在），脚本可重跑；`git diff` 可逐包复核 |

