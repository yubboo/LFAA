# 架构文档索引

本目录只放**结构与机制**：分组、依赖方向、插件模型、运行时与自动生成的目录说明书。单个功能的设计在 [features/](../features/README.md)，跨阶段方案在 [plans/](../plans/README.md)。

## 必读

- [架构基线](overview.md)：技术栈、包边界、应用装配与已确认的总体决策。
- [结构法则](structure.md)：分组与层级现状、依赖护栏、包内分区规则（入口 + 区域 + shared）、可拆卸验收。**改结构前必读**。
- [包分类规范](package-taxonomy.md)：分层模型、分组职责、新包归属决策与反例。**新增包前必读**。
- [依赖规则清单](dependency-rules.json)：`check:arch` 读取的机器可读例外表；新增跨包复用或装配边必须登记理由。
- [仓库目录说明书](repository-map.md)：由 `pnpm map:sync` 按真实骨架生成；**禁止手改**，骨架变动须同轮重新生成。

## 机制

- [插件模型：内置 vs 外部](plugin-model.md)：内置插件只能启停、不可卸载；外部插件支持 npm / Git / 本地路径 / 压缩包。
- [插件运行时](plugin-runtime.md)：Loader 装载 / 卸载 / 重装 / 二创的已验证结论与默认导出约束。
- [Shell 运行时](shell-runtime.md)：四栏外壳的生命周期与贡献清理。
- [构建、测试与边界地基方案](engineering-foundation.md)：统一测试入口、包级 `dist` 构建与 Host/Client 边界检查。**待评审方案**。
- [DSH 包跨仓库复用评估](dsh-package-reuse.md)：本地源码与 npm 版本差异、workspace 协议限制与四条复用路线。

## 维护约定

- 总体开发约束见 [开发规范](../standards/AI-Agent-Development-Standards.md)。
- 每轮实施事实见 [dev-log](../dev-log/) 范围卷；面向用户的变化见 [updata-log](../updata-log/)。
- 结构调整：先改本目录的 `structure.md` 与 `dependency-rules.json`，再动代码，最后 `pnpm map:sync`。
- 文档总入口见 [docs/README.md](../README.md)。