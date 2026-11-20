# 内嵌上游运行时（vendor）

本目录存放**从 npm 取回、纳入本仓工作区**的上游包源码。与 `patches/` 的区别：

| | `vendor/` | `patches/` |
|---|---|---|
| 形态 | 完整包源码，进 workspace，独立构建 | 差异文件，install 时叠加到第三方包 |
| 适用 | 需要持续修改、调试上游实现 | 只需修少量上游 bug |
| 升级方式 | 重新取新版本源码并重放本地改动 | 重新生成补丁 |

## 当前内嵌

| 目录 | 包名 | 版本 | 为什么内嵌 |
|---|---|---|---|
| `loader` | `@deepseek-ai/cordis-plugin-loader` | 1.1.0 | 插件装卸的核心（`Loader` / `Entry` / `EntryTree` / `ModuleLoader`）。插件运行时落地时需要按 LFAA 的 profile 与 `cordis.yml` 调整解析行为，因此必须可改、可调试 |

**只内嵌这一个包**，其余（`cordis`、`cosmokit`、`schemastery`）仍走 npm。原因是它们当前版本已与 LFAA 完全配套，没有需要修改的地方；盲目照搬内嵌会把 cordis 从 4.1.0 降级到更旧的 fork 版本。

## 取包方式（可复现）

```powershell
npm pack "@deepseek-ai/cordis-plugin-loader@1.1.0"
tar -xzf deepseek-ai-cordis-plugin-loader-1.1.0.tgz
# 把 package/ 内容放入 vendor/loader/
```

npm 包自带 `src/`（该包 `files` 字段包含 `src`），所以拿到的是**可编辑源码**，不必 fork 整个上游仓库。

## 工程约定

1. **编译选项独立**：`vendor/*` 的 `tsconfig.json` 由 `scripts/sync-tsconfig.mjs` 生成时自动放宽（`strict`、`noImplicitAny`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、`isolatedModules` 全部关闭）。理由是**不为通过类型检查而改写上游实现**；本仓自己的 `packages/*` 仍保持全严格。
2. **构建同构**：`vendor/*` 与 `packages/*` 走完全相同的 `tsc -b` → `tsdown` → `lib/index.js` 流程，产物与类型入口一致。
3. **单一实例**：`vendor/loader` 通过 pnpm workspace 链接到根 `node_modules`，`@deepseek-ai/cordis` 全仓只有一份（`node_modules/.pnpm/@deepseek-ai+cordis@4.1.0`）。已验证 loader 侧与 app 侧解析到同一路径——Cordis 依赖类身份判等，出现两份会导致「服务注册了但取不到」。
4. **不参与边界检查**：`scripts/check-workspace.mjs` 只扫描 `packages/`；`vendor/` 是上游代码，不套用本仓命名与注释规范。

## 已验证（2026-11-20）

- `tsc -b tsconfig.host.json` 含 `vendor/loader` 共 28 个工程，0 错误。
- `tsdown` 产出 `vendor/loader/lib/index.js`（28.42 kB）。
- 用本仓 `@deepseek-ai/cordis@4.1.0` 装配：`ctx.plugin(Loader)` 成功，`ctx.loader` 暴露 `commit` / `locate` / `showLog` / `exit` / `unwrapExports` / `unwrapExports`，`dispose` 干净。
- 全仓 142 个测试不受影响。

## 升级与回滚

- 升级：按上面的取包方式换版本 → `pnpm install` → `pnpm sync` → `pnpm build` → 重跑测试；本地改动需逐条重放（当前尚无本地改动）。
- 回滚：删除 `vendor/loader` 目录并移除 `pnpm-workspace.yaml` 的 `vendor/*`，改为在需要的包里直接依赖 npm 版 `@deepseek-ai/cordis-plugin-loader`。

## 何时才继续扩充 vendor

只有当某个上游包**必须修改且无法通过公开 API / 配置 / 包装解决**时才内嵌，并同步更新本文件与 dev-log。不要为了「和参考仓库结构一致」而预先内嵌一批包——那会立刻变成长期维护负担。
