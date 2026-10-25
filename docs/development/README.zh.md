# 开发文档索引

[English index](README.md) · [文档总目录](../README.zh.md)

本页用于查找长期开发指南和专题实施记录。当前事实分别由[开发规范](../../开发规范.md)、[系统总体架构](../系统总体架构.md)、[开发计划](../开发计划.md)和[任务合同](../PROMPTS.md)维护。按日期记录的报告只证明当时的实现与验收，不替代当前权威来源。

## 长期指南与当前目标

| 主题 | 入口 | 用途 |
|---|---|---|
| 开发手册 | [简体中文](handbook.zh.md) · [English](handbook.md) | 功能地图、Owner、开发记录与验收流程 |
| 开发流程 | [简体中文](guide.zh.md) · [English](guide.md) | 仓库协作流程和修改边界 |
| 包职责与应用装配 | [简体中文](package-responsibilities.zh.md) · [English](package-responsibilities.md) | 包 Owner、应用装配与迁移规则 |
| 性能与维护性 | [简体中文](performance.zh.md) · [English](performance.md) | 性能、安全与维护要求 |
| 文件资源 | [简体中文](file-resources.zh.md) · [English](file-resources.md) | 文件/资源行为和存储要求 |
| 登录转场 | [简体中文](auth-transition-plugins.zh.md) · [English](auth-transition-plugins.md) | 登录转场合同与扩展用法 |
| 应用面板与模板 | [简体中文](application-panels-templates.zh.md) · [English](application-panels-templates.md) | 已确认的产品目标；不代表尚未实现的模板运行时已经上线 |
| 小鱼智能体工作区 | [简体中文](xiaoyu-agent.zh.md) · [English](xiaoyu-agent.md) | 共享智能体工作区开发合同 |

## 实施与验收记录

以下材料均对应具体任务和日期。引用其中实现细节前，先核对当前架构与关联任务合同。

### Agent 与 AI Work

- [Agent 执行链路审计（2026-10-21）](agent-execution-audit-20261021.md)
- [Agent 任务审计与验收（2026-10-14）](agent-execution-validation-20261014.md)
- [Agent 文件 CRUD 合同（2026-10-09）](agent-file-crud-20261009.md)
- [Minecraft、Skill 与存储联动修复（2026-10-13）](agent-minecraft-storage-repair-20261013.md)
- [Agent 首次回复交接（2026-10-09）](agent-reply-handoff-20261009.md)
- [Agent 最终答复交付（2026-10-09）](agent-response-delivery-20261009.md)
- [Agent 流式循环修复（2026-10-09）](agent-stream-loop-repair-20261009.md)
- [Run 暂停与继续（2026-10-10）](ai-run-pause-resume-20261010.md)
- [Run 断流恢复与循环上限（2026-10-10）](ai-run-reconnect-loop-bounds-20261010.md)
- [澄清问题内嵌（2026-10-10）](ai-work-clarification-inline-20261010.md)
- [文件变更审阅（2026-10-10）](ai-work-file-change-review-20261010.md)
- [回复过程说明（2026-10-10）](ai-work-process-disclosure-20261010.md)
- [回复排版（2026-10-10）](ai-work-reply-layout-20261010.md)
- [SSE 请求收尾（2026-10-10）](ai-work-sse-request-close-20261010.md)
- [流式光标闪烁（2026-10-09）](ai-work-stream-caret-flicker-20261009.md)
- [流式渲染稳定性（2026-10-10）](ai-work-stream-render-stability-20261010.md)
- [工具执行效率（2026-10-10）](ai-work-tool-efficiency-20261010.md)
- [通用 Agent 能力（2026-10-09）](general-agent-capabilities-20261009.md)
- [通用 Agent 变更文件清单（2026-10-09）](general-agent-capabilities-files-20261009.md)
- [本机应用意图发现（2026-10-09）](local-app-intent-discovery-20261009.md)
- [本机电脑任务（2026-10-09）](local-computer-activity-20261009.md)
- [本机可执行文件路径启动（2026-10-09）](local-executable-path-launch-20261009.md)
- [本机 Web 电脑操控（2026-10-09）](local-web-computer-use-20261009.md)
- [小鱼工作区统一交付（2026-10-15）](xiaoyu-agent-20261015.md)

### AI 漫剧

- [分镜画布首版（2026-10-10）](ai-video-canvas-mvp-20261010.md)
- [图片生成（2026-10-11）](ai-video-image-generation-20261011.md)
- [本地项目文件（2026-10-10）](ai-video-local-project-files-20261010.md)

### 应用、客户端与工作区

- [无限画布 MVP（2026-10-25）](infinite-canvas-20261025.md)
- [应用面板分离交付（2026-10-16）](application-panels-20261016.md)
- [小鱼首页迁移（2026-10-15）](chat-home-20261015.md)
- [插件生命周期、会话菜单与响应式验收（2026-10-16）](plugin-lifecycle-session-responsive-20261016.md)
- [全仓审查（中文，2026-10-08）](workspace-audit-20261008.zh.md)
- [全仓审查（English, 2026-10-08）](workspace-audit-20261008.md)
- [全仓审查变更文件清单（2026-10-08）](workspace-audit-files-20261008.md)

### Harness、包与集成

- [DSH 与 LFAA 扩展方式审计（2026-10-17）](dsh-lfaa-extension-audit-20261017.md)
- [LFAA 与 DSH 能力差距盘点（2026-10-25）](dsh-parity-gap-20261025.md)
- [Ekko 能力融合登记](ekko-capability-fusion.md)
- [Ekko 编程协作核心（2026-10-16）](ekko-fusion-core-20261016.md)
- [Harness 运行链修复（2026-10-09）](harness-runtime-integration-20261009.md)
- [Harness 运行链变更文件清单（2026-10-09）](harness-runtime-integration-files-20261009.md)
- [包职责与按需能力修复（2026-10-14）](package-owner-lazy-capabilities-20261014.md)

### 文件、存储与写作

- [文件管理源码对照（2026-10-13）](file-manager-reference-20261013.md)
- [文件资源交付记录（2026-10-14）](file-resources-20261014.md)
- [写作本地文件（2026-10-10）](writing-local-files-20261010.md)

### 游戏、运行环境与壁纸

- [游戏库与运行环境（2026-10-14）](game-library-runtime-20261014.md)
- [手动开服与运行环境修复（2026-10-14）](runtime-manual-repair-20261014.md)
- [壁纸实时切换（2026-10-09）](wallpaper-live-switch-20261009.md)
- [壁纸请求日志降噪（2026-10-09）](wallpaper-request-log-noise-20261009.md)
