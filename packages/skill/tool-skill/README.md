# LFAA Skill Tools

`lfaa-tool-skill` 登记 `lfaa_skill_list`、`lfaa_skill_load`。目录只给元数据，正文由模型按需读取；既有写作 Skill 与项目 `.agents/skills`、`.lfaa/skills` 共用入口。

项目读取复用 projectFileTool 的路径校验、项目绑定、分页、风险、审批与真实 Daemon，保留 general.taskFolder 的权威设置；未获准的任意主机目录不能因为 Skill 工具而成为只读豁免。只读取规定位置的 SKILL.md，不执行文档指令、不安装依赖、不扩大用户目标。正文页和文件上限沿用项目 Owner。

Bundle 生命周期管理工具登记；构建输出为根 `dist/packages/skill/tool-skill/`。项目实际 Daemon 读取需在目标节点验收。
