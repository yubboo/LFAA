# LFAA Releases — current policy v0.0.100

**当前任务：#21.28 · v0.0.100 · pending-user-acceptance · AI=pass · 用户验收=pending**


## 当前版本

```text
displayVersion: 0.0.100
releaseSequence: 99
architectureVersion: 5
```

`lfaa.release.json` 是版本元数据 Owner。根 package、workspace packages 和 Native crate 版本应保持一致。

## v0.0.100 发布重点

- 修复 v0.0.99 大规模目录迁移后，旧 workspace 目录只剩 `node_modules` / `target` 等本地缓存时无法被 Sync 清理的问题；
- `current-fact` 只把仍含项目文件的旧 Owner 视为架构回流，不再把缓存空壳误判为失败；
- Sync 对明确退役的 workspace root 增加安全清理：仅在确认没有项目文件时，才连同孤立缓存一起移除；
- 新增回归测试锁定“旧 package 已迁走 + 旧目录只剩本地缓存”的同步场景；
- v0.0.99 已完成的 packages-first / thin app / bundle / Runtime Home / native 架构保持不变。

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
