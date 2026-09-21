# LFAA 文档索引 — v0.1.9

**当前候选版本：v0.1.9**

当前 v0.1.9 重点：真实 Agent Run Timeline。Runtime Event 是过程唯一真值；UI 实时显示 elapsed、官方 reasoning summary、plan、tool/command/file/search/MCP activity，并让最终 Assistant answer 继续真实 delta streaming。DeepSeek Harness 源码只作为事件组织参考，LFAA 保持自己的单一 Agent Core 与视觉。


本目录只保留 9 份长期文档。**当前事实与历史事实严格分层。**

## 当前事实文档

| 文档 | 作用 |
|---|---|
| `项目结构与代码地图.md` | 当前目录、package Owner、入口与重要文件 |
| `MODULES.md` | Capability family / package 职责与依赖 |
| `RUNTIME.md` | Browser/Host/Agent/Config/Plugin/Terminal 运行链路 |
| `UI.md` | Workspace、App Shell、UI Kit、Client 视觉/交互边界 |
| `TESTING.md` | 测试、治理 Gate、静态/动态验证规则 |
| `RELEASES.md` | 当前发布、版本、Sync/Archive 规则 |

根目录 `ARCHITECTURE.md`、`DEVELOPMENT.md`、`AGENTS.md` 的优先级高于本目录；若冲突，以根当前真相文档和机器门禁为准。

## 历史账本

| 文档 | 作用 |
|---|---|
| `DEVELOPMENT_LOG.md` | 每个版本/任务实施过程与验证历史 |
| `PROMPTS.md` | 需求/Prompt 生命周期与历史输入 |

历史账本中出现的 `.lfaa/`、`crates/`、`apps/web/dev`、旧 package 路径只说明旧版本当时的事实，不再指导 v0.1.9 开发。

## 文档更新规则

架构或 Owner 改动时：

1. 先改代码和机器契约；
2. 同步 `ARCHITECTURE.md` / `DEVELOPMENT.md`；
3. 同步本目录对应当前事实文档；
4. CHANGELOG / DEVELOPMENT_LOG 追加变更记录；
5. 不通过删除历史记录来“解决冲突”，而是明确新旧优先级。
