<a id="lfaa-ui-skill-toolkit-20261026"></a>

## LFAA UI Skill 工具集接入与使用规则（2026-10-26）

### 目标、Owner 与设置

- 安装用户指定的 `ibelick/ui-skills` 与 `nextlevelbuilder/ui-ux-pro-max-skill`，用于本机 Codex 编写 LFAA 时查阅、审视和打磨界面；将适用范围、搭配方式与优先级写入 `开发规范.md`。
- 上游内容 Owner 仍是各 GitHub 仓库；个人 Codex 技能目录 `C:\Users\Administrator\.codex\skills` 仅承载本机开发辅助内容。LFAA 开发规范由仓库 `开发规范.md` 持有。本任务不改动 LFAA Runtime Skill Registry、Bundle 或产品装配。
- 设置中心：无。本任务只安装开发期技能并改工程文档，不修改账户、外观偏好、运行数据或权限。

### 范围与验收

- 允许范围：个人 Codex Skills 目录下指定两套上游技能；根 `开发规范.md` 中的 UI Skill 选择规则；本任务合同及 `docs/PROMPTS.md` 索引。
- 禁止范围：产品源码、依赖、运行时技能注册/启停、设置中心、用户数据、服务与插件状态、提交或发布。
- 安装固定上游提交：`ibelick/ui-skills` `59193a75432e5f41c6980f53b9e6a7bd56919947`；`nextlevelbuilder/ui-ux-pro-max-skill` `d14efff8ed1faa4187f004f79926f428c8074ec7`。目标目录不存在同名技能时才能安装。
- 验收：技能目录具备上游 `SKILL.md` 和必要资源；开发规范给出任务到技能的选择映射、组合上限、栈/Owner/设置/验证优先级，并说明开发期技能不自动成为 LFAA 产品能力；文档引用存在，`git diff --check` 通过。纯文档与本机开发工具接入不运行产品构建或 UI 页面验收。

### 实施与验证记录

- 本机 Codex 已安装到 `C:\Users\Administrator\.codex\skills`：`ui-skills-root`、`improve-ui`、`fixing-motion-performance`、`fixing-metadata`、`fixing-accessibility`、`create-design-md`、`create-canvas`、`baseline-ui`、`component-canvas`，共 9 个模块；另安装 `ui-ux-pro-max` 及其本地 `scripts/`、`data/`、`references/` 资源。所有模块均存在 `SKILL.md`；各自目录包含对应上游 MIT `LICENSE.txt`。
- 上游来源锁定：`ibelick/ui-skills` commit `59193a75432e5f41c6980f53b9e6a7bd56919947`；`nextlevelbuilder/ui-ux-pro-max-skill` commit `d14efff8ed1faa4187f004f79926f428c8074ec7`。没有安装 npm 全局包，没有向 LFAA 添加运行时依赖。
- `开发规范.md` 新增 UI Skill 选择矩阵，覆盖产品方向/新页面、常规视觉打磨、只读审查、无障碍交互、动效、动效性能、公开页元信息、React 组件检查、设计文档及独立原型；说明组合数量、既有主题/Owner/设置的优先级及不得装配为 LFAA Runtime 能力的边界。
- 文件职责：`开发规范.md`（UI Skill 的选择、组合和使用边界）；`docs/PROMPTS.md`（索引状态）；本合同（上游固定版本、安装清单、设置与验收证据）。
- 设置中心：无；没有改产品代码、用户偏好、运行数据、服务、插件或权限。未运行产品测试、构建或浏览器验收，因为本轮仅涉及本机开发 Skill 与规则文档。
- 验证：10 个 Skill 目录全部具备 `SKILL.md` 和对应 `LICENSE.txt`；`ui-ux-pro-max` 共安装 74 个文件；上游许可内容核验为 MIT；本合同文件及索引引用存在；`git diff --check` 通过。
