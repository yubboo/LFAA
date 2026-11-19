---
name: lfaa-skill-creator
description: 创建或规范化 LFAA SKILL.md 技能文件的内置指南，适用于用户要求小鱼创建新技能或整理工作流模板时。
---

# LFAA 技能创建规范

当用户要求创建一个新的可复用技能时，请遵循以下步骤：

1. **明确职责与触发条件**：用简短准确的 `name` 和 `description` 描述适用场景。
2. **编写可执行步骤**：正文使用清晰的 Markdown 标题与编号列表，给出边界条件与输出要求。
3. **保存到用户级目录**：调用 `save_user_skill` 工具将技能写入 `~/.lfaa/skills/<skill-id>/SKILL.md`，用户可在「技能中心」查看、编辑或通过 `$技能名` 选用。
