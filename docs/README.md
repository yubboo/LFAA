# 文档地图

先读哪几份、每类文档放哪，以本页为准。文档状态以各篇开头的标记（已实施 / 待评审 / 草案）为准，草案不等于已批准。

## 先读三份

| 文档 | 解决什么问题 |
|---|---|
| [开发规范](standards/AI-Agent-Development-Standards.md) | 本项目的强制规范：命名、边界、注释、日志、提交流程 |
| [结构法则](architecture/structure.md) | 包分组、依赖方向、包内分区与检查命令 |
| [架构基线](architecture/overview.md) | 技术栈、四栏布局、装配与已确认决策 |

## 目录职责

| 目录 | 放什么 | 不放什么 |
|---|---|---|
| `architecture/` | 结构与机制：分组、依赖、插件模型、运行时、目录说明书 | 单个功能的设计方案 |
| `features/` | 功能设计：交互、契约、实施与验收（按能力一篇） | 跨多个功能的规划 |
| `plans/` | 规划与重构方案：分阶段边界、验收标准、状态 | 已实施功能的日常说明 |
| `standards/` | 强制规范 | 方案讨论 |
| `templates/` | dev-log / updata-log 模板 | 实际日志 |
| `dev-log/` | 每轮实施事实，按 200 个任务号一卷 | 用户可读的变化 |
| `updata-log/` | 用户可见的新功能 / 修复 / 优化，一条一个文件 | 内部重构细节（写 dev-log） |

## 索引

- [架构文档](architecture/README.md)
- [功能设计](features/README.md)
- [规划方案](plans/README.md)

## 维护约定

- 新增功能：先在 `features/` 写设计（状态、边界、验收），实施后更新状态；跨阶段的计划放 `plans/`。
- 改结构：先改 `architecture/structure.md` 与 `dependency-rules.json`，再动代码；`repository-map.md` 由 `pnpm map:sync` 生成，禁止手改。
- 每轮有实际文件变更：补 `dev-log/`；用户可见的变化：补 `updata-log/`。
- 文档间引用用相对路径；移动文档后同轮修链接，跑 `node scripts/check-doc-links.mjs` 确认。