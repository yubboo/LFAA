# LFAA 文件系统 Skill Provider

`lfaa-skill-filesystem` 负责从经当前账户配置允许的项目、自定义和用户 Skill 根发现 SKILL.md，并按需读取正文及附属文本资源。摘要发现、正文和资源读取均有界；资源相对当前 Skill 目录解析，校验规范路径、真实根目录、普通文件、UTF-8 与 96 KiB 上限。

默认用户级 LFAA Skill 根为 `<LFAA_HOME>/skills/`，共享 Agent 根为 `<LFAA_AGENTS_HOME>/skills/`（默认 `~/.agents/skills/`）；项目级根为项目 `.lfaa/skills/` 与 `.agents/skills/`。设置中的 `plugins.skillDirectories` 是附加扫描根，不代表安装目标。小鱼安装和用户手动放置的本机 Skill 都使用 `<LFAA_HOME>/skills/<技能名>/SKILL.md`；Knowledge Library Owner 记录小鱼安装的来源、校验清单和卸载归属。本 Provider 发现用户级目录中的 Skill。LFAA 内置 Skill 来自软件包，不需要复制到用户目录；Codex `.codex/skills/` 不属于本 Provider。

该 Provider 不执行 SKILL.md 或其脚本，也不提供任意路径读取工具。目录监视由 Provider Fiber 管理并在卸载时关闭；依赖用户 Home、自定义目录和本轮项目根的发现选项使用独立缓存键。
