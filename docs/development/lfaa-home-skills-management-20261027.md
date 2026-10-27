# LFAA Home 与 Skill 安装位置可读化（2026-10-27）

<a id="lfaa-skill-install-location-20261027"></a>

## 用户目标

用户在资源管理器中看到会话哈希目录、换电脑需要完整迁移会话/记忆/上下文/附件，并希望知道小鱼安装的 Skills 放在哪里、LFAA 内置 Skills 与用户安装 Skills 有何区别。现有会话索引与 `.lfaa-snapshot` v2 迁移已经分别由任务 290/291 实现；本任务保留这些既有合同，改进 LFAA Home 的可读组织与真实 Skill 清单来源说明。

## Owner、入口与配置

- Skill 文件 Owner：`packages/knowledge/knowledge-library`；SQLite `knowledge_library_skill_installations` 仍持有当前账户、名称、固定 GitHub 来源、文件清单和 SHA-256 权威登记。
- Skill 安装适配器：`packages/boot/capability-skill`；固定来源检查、审批摘要、精确安装/移除及 Registry 回读继续沿用 Capability Install 与 Permission Owner。
- Skill 发现 Owner：`packages/skill/skill-filesystem` 扫描本机/项目/自定义目录；`packages/boot/knowledge-library` 保留 Agent 安装记录和完整性校验；内置能力继续从 `packages/skill/*` Provider 装配。
- 目录 Owner：`packages/util/home-paths` 的 `LFAA_HOME`；根目录说明和 Skill 根由该 Owner 初始化。会话 JSONL 和 `会话目录索引.txt` 仍归 Session JSONL Owner。
- 清单入口：认证 `/ai/skills` 读取真实 Skill Registry；设置中心“集成 → 技能”展示来源范围并复用 `plugins.disabledSkillNames`。
- 设置：复用 `plugins.enabled`、`plugins.skillDirectories`、`plugins.disabledSkillNames` 和 `permissions.mode`；不新增配置、不重置已有偏好。技能页从真实 Skill Registry 而非扩展 manifest 显示条目、来源范围和小鱼安装的本机相对位置；API 不返回绝对路径、Skill 正文或资源基址。

## 目录与数据合同

- LFAA Home 下创建 `<LFAA_HOME>/skills/`，作为本机用户级 Skill 根；小鱼安装与手动放置的 Skill 均为 `<LFAA_HOME>/skills/<Skill 名称>/SKILL.md`。项目 Skill 仍使用项目 `.lfaa/skills/` 或 `.agents/skills/`；共享 Agent Skills 继续从配置的 `~/.agents/skills/` 发现。
- SQLite Knowledge Library 保留 Agent 安装账户、来源、文件清单及哈希，安装文件直接位于上述本机用户级路径；不额外增加账户摘要层。旧版 `<LFAA_HOME>/skills/account-installed/<账户 SHA-256>/<Skill 名称>/` 与 `<LFAA_DATA_DIR>/users/<账户 SHA-256>/knowledge/skills/` 只保留读取/精确卸载兼容，不批量搬迁真实用户数据。
- LFAA 内置 Skill 由 `packages/skill/*` 随软件注册，不复制到用户安装目录、不要求安装；它们可面向特定 App，也可为通用能力。
- 新增 `<LFAA_HOME>/目录说明.txt` 仅在文件不存在时创建，不覆盖用户已有文件；说明 Home 分类和 Skill 存储边界，不列出凭据或账户秘密。
- 设置中心 Skill 清单使用 `/ai/skills` 的真实 Registry 摘要；API 不返回绝对路径、Skill 正文或资源路径。视图区分软件内置、本机 LFAA/Agent 根与自定义来源，并显示小鱼安装的 LFAA Home 相对位置。

## 允许与禁止

- 允许：调整 Home 路径/初始化、Knowledge Library 新安装路径与旧路径回读/卸载、真实 Skill Registry 来源投影、设置中心 Skill 清单、直接回归、受影响 README/架构/本合同及索引。
- 禁止：重命名/搬迁/清理用户真实 Home；触碰 `.codex`、项目内容、数据库真实数据、凭据、会话正文或用户设置；改动任务 290/291 的会话格式与归档范围；改变 Skill 运行权限、执行第三方脚本/依赖、修改无关工作区改动；提交或发布。

## 可观察验收

- 隔离 Home 启动后存在 `skills/` 与 `目录说明.txt`；既有自定义说明文件不被覆盖，默认说明不包含秘密。
- 新 GitHub Skill 的文件位于 LFAA Home `skills/<Skill 名称>/SKILL.md`，目录结构与本机用户级 Skill 一致；数据库按安装账户列出和精确卸载。校验仍覆盖文件数、容量、路径、普通文件、逐文件 SHA-256、同名不覆盖、原子安装与精确移除。
- 旧版 `<LFAA_DATA_DIR>/.../knowledge/skills/` 安装可继续读取附属资源、跨 App 加载并按 ID 卸载；未显式操作的旧安装内容不改变。
- `/ai/skills` 对内置与本机用户目录来源返回不同来源类别，不包含绝对路径、正文或凭据；设置中心技能清单从实际 Registry 显示来源和范围，并继续使用当前单项停用设置。
- 运行 Home/Knowledge Library/Capability Skill/API/设置 UI 直接回归、Client/Host 类型检查、相关包构建、Control Plane/Web 构建及差异检查。内置浏览器按桌面和窄短屏检查 `/settings?section=profilePlugins` 技能页。真实用户 Home、真实 GitHub 安装、Provider、帧时间和 Electron 未测时单列。
- 实际验证（最终直接路径实现）：Capability Skill、Knowledge Library、Home 目录初始化、技能管理 UI 回归分别 3/3、2/2、4/4、14/14 通过；Client/Host TypeScript 检查、`lfaa-home-paths`、`lfaa-knowledge-library`、`lfaa-capability-skill`、`lfaa-api-settings-controller`、`lfaa-client-ui-settings` 构建、Control Plane/Web 构建及 `git diff --check` 通过。隔离测试覆盖直接目录安装、旧 Home/Data 路径兼容读取、资源读取与按 ID 删除。内置浏览器 `/settings?section=plugins` 技能页在 850×1244 实际显示直接用户路径与内置 Skill 列表；桌面宽屏和短屏未测。为避免误写真实 Home，后来使用隔离 Home/Data 重做页面验收并清理临时目录。首次启动时传入的 `--home` 未隔离服务启动环境，曾登录真实账户；技能文件与设置未修改，但可能新增一条认证会话记录，不能确认服务是否持久化了该记录。那次默认项目初始化请求返回 500；只读核验显示目标 `D:\Documents\LFAA\default-workspace` 在此次验收前已存在且修改时间未变。之后关闭了验收服务；真实 Home 未做清理或迁移。
