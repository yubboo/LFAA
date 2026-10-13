# LFAA 文档

[English](README.md) · [项目入口](../README.md)

先按任务选择专题。当前架构、版本和任务合同各有一个权威来源；历史记录只能证明当时的实现与验证，不能作为当前状态或操作授权。

| 分类 | 入口 | 内容 |
|---|---|---|
| 用户指南 | [启动与命令](user/cli.zh.md) | Web、节点、开发与打包 |
| 子系统 | [架构导读](subsystems/architecture.zh.md) · [存储](subsystems/storage.zh.md) · [执行控制](subsystems/execution-control.zh.md) | Owner、数据、权限与生命周期 |
| 开发 | [开发流程](development/guide.zh.md) · [性能治理](development/performance.zh.md) · [本轮审查](development/workspace-audit-20261008.zh.md) | 检查命令、回归、事实与限制 |
| 参考 | [根目录职责](reference/repository-layout.zh.md) · [生成的包清单](harness-packages.md) · [提示词资料](reference/prompts/README.zh.md) | 路径、包状态与非工程资料 |
| 语言维护 | [中英文配对规则](i18n/README.zh.md) | 对应文件、翻译范围与权威来源 |
| 历史 | [归档索引](archive/README.zh.md) | 审计快照、旧计划与已完成合同 |

以下入口保留原路径，避免改变仓库治理合同：

- [开发规范](../开发规范.md)：修改与交付要求。
- [系统总体架构](系统总体架构.md)：当前实现事实与边界。
- [开发计划](开发计划.md)：当前缺口与优先级。
- [PROMPTS](PROMPTS.md)：合同索引与当前合同。
- [更新日志](updata-log.md)：产品版本唯一权威；历史版本重置不重新编号。

专题英文与中文用 `name.md` / `name.zh.md` 配对。归档与既有权威长文保留原语言；英文导读明确链接原文，不冒充完整翻译。没有实现的占位包保持不可用。
