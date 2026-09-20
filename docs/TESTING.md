# LFAA Testing & Gates — v0.1.1

## v0.1.1 TSConfig / Vite 启动回归

本版必须锁定：

1. `apps/*/tsconfig.json` 的根级 Client 配置继承能真实解析；
2. `packages/client/*/tsconfig.json` 统一继承 `../../../tsconfig.base.client.json`；
3. 其他两层 capability package 统一继承 `../../../tsconfig.base.json`；
4. 目录迁移后旧 `../../tsconfig.base.json` 必须由 Gate 直接失败；
5. 不允许恢复仅 TypeScript 可见的 `@/*` 私有 paths alias；
6. 业务源码跨 package 仍只能通过公开 `@lfaa/*` API。

对应测试：`test/tsconfig-reference.test.mjs`；静态 Gate：`scripts/tsconfig-reference-check.mjs`。

本版 AI 验证：仓库级合同 172/172 PASS；Config System 39/39 PASS；当前 10 个 workspace tsconfig 通过 `tsc --showConfig`。制作环境 Node 22 使用实验性 type stripping 执行 TS package tests；用户标准环境仍以 Node 24 / pnpm 11.17.0 为最终运行环境。

## v0.1.0 Workspace 依赖健康回归

依赖检测必须覆盖 `pnpm-workspace.yaml` 声明的所有 importer，而不是写死 `packages/<name>` 旧拓扑。当前仓库应识别 25 个 workspace package.json。重点回归：

1. capability-family 两层 package 必须被发现；
2. 某个深层 package 新增外部依赖但 importer node_modules 未同步时必须失败；
3. package.json 已新增依赖、但对应 `pnpm-lock.yaml#importers/<same importer>` 未记录时必须失败；
4. workspace:* 直接链接缺失/指向错误 Owner 必须失败；
5. 外部包 package.json 残留但 runtime entry 删除时必须失败；
6. Web 启动必须复用统一 readiness，不得重新写死 xterm/node-pty 的旧 App 所有权。

对应测试：`test/node-dependency-health.test.mjs`、`test/dependency-setup.test.mjs`。

## v0.1.0 版本进位回归

版本 Gate 必须锁定：

- `0.0.99 → 0.1.0`；
- `0.1.99 → 0.2.0`；
- `0.99.99 → 1.0.0`；
- `0.0.100` / `0.100.0` 必须失败。

对应测试：`test/version-policy.test.mjs`。

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
tsconfig-reference-check
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

## v0.1.0 必须锁住的契约

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
