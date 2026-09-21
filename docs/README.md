# LFAA 文档索引 — v0.1.16

**当前候选版本：v0.1.16**

当前 v0.1.16 是 Smart Home / Identity Visual System 版本：登录、First Run 注册与登录后第一屏统一视觉与 Motion；自然语言入口仅无损 handoff 到现有 Workbench，不伪造 Intent Router；App Pack Runtime + AI Writing 路线不变。

本目录固定保留 12 份长期 Markdown。**当前事实与历史事实严格分层，不允许“一任务一个 Markdown”。**

## 当前事实文档

| 文档 | 作用 |
|---|---|
| `ARCHITECTURE.md` | 当前架构、Owner、边界与长期设计决定 |
| `DEVELOPMENT.md` | 当前开发规范、强制工作流与禁止事项 |
| `PROJECT_PLAN.md` | 当前里程碑、冻结范围和下一阶段顺序 |
| `项目结构与代码地图.md` | 当前目录、package Owner、入口与重要文件 |
| `MODULES.md` | Capability family / package 职责与依赖 |
| `RUNTIME.md` | Browser/Host/Agent/Config/Plugin/Terminal 运行链路 |
| `UI.md` | Workspace、App Shell、UI Kit、Client 视觉/交互边界 |
| `TESTING.md` | 测试、治理 Gate、静态/动态验证规则 |
| `RELEASES.md` | 当前发布、版本、Sync/Archive 规则 |

根目录 `AGENTS.md` 是最短 Agent 入口，根 `README.md` 是项目入口；详细当前真相统一进入本目录。若冲突，以代码/机器 Gate、`AGENTS.md`、本目录当前事实文档为准。

## 历史账本

| 文档 | 作用 |
|---|---|
| `DEVELOPMENT_LOG.md` | 每个版本/任务实施过程与验证历史 |
| `PROMPTS.md` | 需求/Prompt 生命周期与历史输入 |

历史账本中出现的 `.lfaa/`、`crates/`、`apps/web/dev`、旧 package 路径只说明旧版本当时的事实，不再指导 v0.1.16 开发。

## 文档更新规则

架构或 Owner 改动时：

1. 先读取 `AGENTS.md`、`DEVELOPMENT.md`、当前 Prompt 合同与目标 Owner；
2. **先**在 `PROMPTS.md` 登记当前任务合同，再修改实现；
3. 同步 `ARCHITECTURE.md` / `PROJECT_PLAN.md` 与对应当前事实/README/Gate；
4. CHANGELOG / DEVELOPMENT_LOG / RELEASES 追加变更记录；
5. 执行 governance + workspace preflight；候选 ZIP fresh extract 后再次 preflight；
6. 不通过删除历史、关闭 Gate 或伪造版本字符串来“解决冲突”。
