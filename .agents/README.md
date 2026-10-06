# LFAA AI 协作入口

## 权威规则

- 仓库根目录 `AGENTS.md`、`开发规范.md` 与 `docs/系统总体架构.md` 定义本仓库的约束和事实；技能只提供按任务调用的工作流程，不能覆盖这些文件。
- 本目录中的 `skills/` 是 LFAA 仓库技能正文的唯一维护位置。`.claude/skills/` 与 `.codex/skills/` 只保留轻量入口，实际规则统一回到这里读取。
- 技能只适用于 LFAA 源码、架构文档和维护流程，不授予额外工具权限，不代表产品功能，也不要求自动执行其中提到的操作。

## 可用技能

- `skills/lfaa-code-change/SKILL.md`：代码任务的资料读取、任务合同和最小修改流程。
- `skills/lfaa-owner-navigation/SKILL.md`：沿当前包架构定位运行入口、能力 Owner 与数据边界。
- `skills/lfaa-validation/SKILL.md`：选择直接相关的验证并如实记录验证范围。
- `skills/lfaa-git-commit/SKILL.md`：仅在用户明确要求提交时隔离并核对本次 Git 变更。
- `skills/lfaa-desktop-package-test/SKILL.md`：按 Windows/macOS Electron 产品目标审查现行构建入口、纯净包内容和隔离安装；明确记录 Tauri 默认命令与 Windows-only 包配置的迁移缺口。
- `skills/lfaa-patch-release/SKILL.md`：区分普通补丁和正式版本，并按 LFAA 版本日志、构建与发布边界执行。

LFAA 项目文件工具会发现选中项目中的 `.agents/skills/`。因此技能内容保持为纯文本维护说明；不得在其中放脚本、密钥、用户数据或未经登记的产品能力。
