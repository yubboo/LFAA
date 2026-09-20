# LFAA Testing & Gates — v0.0.100

## 原则

架构重构必须靠现有测试护航，不能先关 Gate 再宣称迁移成功。

## 主要层级

### Governance/static gates

```text
governance-check
import-path-check
runtime-import-resolution-check
folder-boundary-check
language-ownership-check
package-architecture-check
dev-log-check
docs-check
current-fact-check
comment-check
windows-script-encoding-check
release-consistency-check
prompt-lifecycle-check
config-schema-check
release-gates-check
ui-contract-check
```

### Contract tests

仓库 `test/*.test.mjs` 锁定：

- Workspace/App Shell/UI 边界；
- Web App 薄入口；
- Config/Secret/Provider；
- Plugin platform；
- Runtime import；
- Agent chat runtime；
- Windows dependency/setup/sync；
- Unicode release archive；
- motion/resize/snap 等 UI 契约。

### Package tests

例如 `@lfaa/config-system` 自身测试。

### Type/build

```text
pnpm run typecheck
pnpm run build
```

发布目标：`pnpm run quality:full` + Rust release checks。

## v0.0.100 必须锁住的契约

本热修复新增 Sync 契约：当旧 workspace Owner 已从源码退役、目录中只剩 `node_modules` / `target` / `dist` / `.cache` 等本地缓存时，同步必须能够安全清理该退役目录；如果仍有真实项目文件，则不得静默删除。


1. `apps/web` 没有 `dev/bridges`、`host-clients`、Terminal business；
2. App 只依赖 `@lfaa/client-web` / `@lfaa/bundle-web-app`；
3. workspace 使用 `packages/*/*`；
4. 根 `.lfaa` 不存在；
5. Runtime state 使用 LFAA_HOME；
6. Native workspace 使用 `native/*`；
7. `@lfaa/*` 稳定包名仍可被依赖图解析；
8. LLM Provider HTTP 不回流 Agent Controller/App；
9. release ZIP 保持中文路径 UTF-8 flag。

## 环境声明

本仓库要求 Node 24/pnpm 11.17.0。若某交付制作环境只有 Node 22 且无可用 pnpm/node_modules：

- 可以运行纯 Node built-in 静态 Gate/contract tests；
- 不得声称 workspace TypeScript typecheck/build 已完成；
- 应在用户正常 Setup 环境再次执行 `quality:full`。

## 修改测试的原则

路径迁移时应把旧测试改成**新架构长期契约**，而不是简单删除断言。例如“`.lfaa` 必须存在”应改成“repo `.lfaa` 必须不存在且旧 state 迁移到 LFAA_HOME”。
