# LFAA 文件系统 Skill Provider

`lfaa-skill-filesystem` 负责从经当前账户配置允许的项目、自定义和用户 Skill 根发现 SKILL.md，并按需读取正文及附属文本资源。摘要发现、正文和资源读取均有界；资源相对当前 Skill 目录解析，校验规范路径、真实根目录、普通文件、UTF-8 与 96 KiB 上限。

该 Provider 不执行 SKILL.md 或其脚本，也不提供任意路径读取工具。目录监视由 Provider Fiber 管理并在卸载时关闭；依赖用户 Home、自定义目录和本轮项目根的发现选项使用独立缓存键。
