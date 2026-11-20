# 第三方依赖补丁（pnpm patch）

本目录存放**给第三方 npm 包打的补丁**。它与 `cordis.patch.yml`（应用配置补丁）不是一回事：

| | `patches/*.patch` | `cordis.patch.yml` |
|---|---|---|
| 作用对象 | 第三方包的**代码** | 本应用自己的**插件配置** |
| 由谁应用 | `pnpm install` | Cordis Loader |
| 典型用途 | 修上游 bug、加运行时钩子 | 覆盖默认插件组合，不改源码 |

## 机制已验证（2026-11-20）

已用 `vite` 做过一次完整演练：`pnpm patch` → 修改 → `pnpm patch-commit` → 生成 `patches/vite.patch` 并自动写入 `pnpm-workspace.yaml` 的 `patchedDependencies` → pnpm 在 `.pnpm` 下生成 `vite@8.3.8_patch_hash=…` 实例并让消费者指向它 → `pnpm patch-remove` 清理干净（补丁文件与配置项均删除）。

当前仓库**没有必须打的补丁**，因此本目录只保留这份说明；不要为了占位而写空补丁。

## 打补丁流程

```powershell
# 1. 取出可编辑副本（会创建临时目录）
pnpm patch <包名>

# 2. 在提示的临时目录里改代码

# 3. 提交为仓库补丁：生成 patches/*.patch 并写入 patchedDependencies
pnpm patch-commit <临时目录>

# 4. 验证：确认该包在 node_modules/.pnpm 下出现 *_patch_hash= 实例，且改动生效
# 5. 撤销
pnpm patch-remove <包名>
```

## 约束

- **必须写明理由**：每个补丁在提交说明和 dev-log 里写清楚「上游什么问题、为什么不 fork、上游修复后如何移除」。
- **必须可回滚**：补丁只改第三方包，不涉及本仓源码，`pnpm patch-remove` 即可完全撤销。
- **升级即复检**：依赖版本变化后补丁可能失配，`pnpm install` 会直接失败（fail loud，属预期行为），需重新生成补丁。
- **不做无主补丁**：没有明确上游问题时不建补丁；本目录允许只有 README。
- **验证过再留**：任何留在仓库里的补丁，都要有一次「改动确实生效」的实测记录。

## 何时会真的需要

按当前架构，最可能出现的时机是插件运行时落地阶段：如果 Cordis Loader 的 profile 解析、模块热替换或路径解析无法通过公开 API 满足需求，才考虑给 `@deepseek-ai/cordis-plugin-loader` 打补丁。届时**优先尝试**：配置覆盖 → 包装包 → 最后才是补丁。
