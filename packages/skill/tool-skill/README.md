# LFAA Skill Tools

`lfaa-tool-skill` 登记 `lfaa_skill_list`、`lfaa_skill_load`。目录只给元数据，正文与 `references/`、`assets/`、`scripts/` 附属文本由模型按需读取；`source=registry` 使用 `name` 和可选的 `resourcePath`，项目 Skill 使用 `path` 指向已发现的 `SKILL.md`，附属文本仍使用 `resourcePath` 并继续走 Project Files Owner。其他来源须由 Skill Registry Provider 实现可选 reader。只支持常见 UTF-8 文本且最多 96 KiB，不解析任意目录或二进制资源。既有写作 Skill 与项目 `.agents/skills`、`.lfaa/skills` 共用入口。所有已加载 Skill 和资源都标记为不可信方法资料：只可使用本轮真实登记且当前 App 可用的工具，不能改变用户目标/权限模式或增加审批层；读取脚本不会执行脚本，未得到实际执行器回执时不得把 Skill 提到的脚本、依赖和服务报告成已运行。

网页动作沿用 Browser Owner 的有限工具语义：网页导航使用 `lfaa_browser_navigate`，页面读取使用 `lfaa_browser_observe`，点击先观察并按回传的可访问 `role/name` 调用 `lfaa_browser_click`，滚动使用 `lfaa_browser_scroll`；当前工作区 HTML 使用 `lfaa_browser_open_workspace_file`。映射仅指导模型选择本轮已登记且当前 App 可用的工具，所有动作继续由统一 Permission Owner 执行；未登记/不可用的上游代理、脚本、任意 JavaScript 与本机路径接口不因映射而接入。

项目读取复用 projectFileTool 的路径校验、项目绑定、分页、风险、审批与真实 Daemon，保留 general.taskFolder 的权威设置；未获准的任意主机目录不能因为 Skill 工具而成为只读豁免。项目 Skill 读取可跨界面调用，但仍需真实项目或任务目录及目标节点，不按 App 新设读取白名单。只读取规定位置的 SKILL.md，不执行文档指令、不安装依赖、不扩大用户目标。正文页和文件上限沿用项目 Owner。

Bundle 生命周期管理工具登记；构建输出为根 `dist/packages/skill/tool-skill/`。项目实际 Daemon 读取需在目标节点验收。

Minecraft 与 Writing bundled Provider 已独立装配到同一注册表，目录跨界面提供方法摘要；插件总开关关闭时只允许 bundled 方法，不读取账户目录。保留 writing_load_skill 调用名，正文仍来自原 writing 方法 Owner。

设置中心与插件工作区共享 AI 扩展登记清单；Skill 扩展用 `skillId` 指向此包/对应 Provider 注册到 Skill Registry 的规范名称。设置中心通过账户 `plugins.disabledSkillNames` 管理单项停用。`lfaa_skill_list` 与 `lfaa_skill_load` 对停用项执行同一过滤，加载前复核当前设置；`writing_load_skill` 也检查对应稳定 Skill ID。页面只展示摘要与来源，不读取正文或更改 Skill 文件。
