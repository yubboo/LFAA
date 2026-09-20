# LFAA Releases — current policy v0.1.0

## v0.1.0 — Harness 架构收口 / Sync 与依赖健康修复

- 承接 v0.0.99 的 capability-family / packages-first / thin-app / Runtime Home / native 架构；
- 修复退役 workspace 只剩 `node_modules` / `target` 等缓存时 Sync 无法清理、`current-fact` 误判旧 Owner 回流的问题；
- 修复依赖健康检查仍只扫描旧单层 `packages/*`，导致“workspace 25，但只真实解析 10/10”的假健康；
- 当前扫描以 `pnpm-workspace.yaml` 为唯一 workspace 来源，当前仓库共 25 个 importer；
- lockfile 检查升级为 importer + section + specifier 精确覆盖；
- 菜单 1 在真实缺依赖时自动执行 `pnpm install`，Web 启动复用同一 readiness；
- 新增版本策略 Gate，禁止 `0.0.100` 这类非法显示版本。

**当前任务：#20.20 + #21.28 hotfix · v0.1.0 · pending-user-acceptance · AI=pass · 用户验收=pending**

> **版本纠正：** LFAA 版本每一段都限制为 `0-99`。因此 `v0.0.99` 后必须进入 `v0.1.0`。此前生成的 `v0.0.100` / `v0.0.101` 为误标构建，不属于正式发布序列；对应修复统一纳入 v0.1.0。

## 当前版本

```text
displayVersion: 0.1.0
releaseSequence: 100
architectureVersion: 5
```

`lfaa.release.json` 是版本元数据 Owner。根 package、workspace packages 和 Native crate 版本必须保持一致。`releaseSequence` 是独立内部发布序号，不等于 displayVersion 的 patch 位。

## 版本进位规范

LFAA 使用三段显示版本 `major.minor.patch`，但项目约定每一段都只允许 `0-99`：

```text
0.0.98 → 0.0.99
0.0.99 → 0.1.0
0.1.99 → 0.2.0
0.99.99 → 1.0.0
```

禁止：

```text
0.0.100
0.100.0
```

`scripts/version-policy.mjs` 与 `release-consistency-check.mjs` 负责机器校验；开发者不得手工绕过该 Gate。

## Release gates

正式发布环境：

```bash
pnpm run release:environment
pnpm install --frozen-lockfile
pnpm run release:verify
```

其中 release verify 包含完整质量与 Rust 检查。

## Archive

使用：

```bash
pnpm run release:archive
```

归档器显式处理 Unicode ZIP entry，并在生成后反向解析 Central Directory 验证 canonical 中文路径的 UTF-8 bit。

源码包不应包含：

- `node_modules`
- `dist`
- `target`
- 本机 Runtime Home
- repo `.lfaa`
- 临时/缓存文件

## Workspace Sync

Sync 原则：

1. 验证来源包版本与结构；
2. source preflight；
3. 生成差异；
4. 用户确认；
5. v0.0.99 前旧 `.lfaa/state` 已知运行数据先迁移到 LFAA_HOME；
6. 镜像源码；
7. 再运行治理/路径检查。

`pnpm-lock.yaml` 的保护只允许在依赖声明指纹证明未变化时发生，不能把旧 lockfile 无条件覆盖新架构。

## 历史

更早版本的详细发布过程保留在根 `CHANGELOG.md` 与 `docs/DEVELOPMENT_LOG.md`。其中关于 `.lfaa` 保留、旧 `crates/`、旧 Web bridge 的内容只属于对应历史版本。
