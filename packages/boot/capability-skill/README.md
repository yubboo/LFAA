# LFAA 账户共享 Skill 安装适配器

lfaa-capability-skill 是通用能力路由下的 skill 类型 Owner 适配器。它通过 GitHub API 检索候选，将检查固定到 commit 与选中 Skill 文件树摘要，先读取 Git tree 发现 SKILL.md 目录，再只读取所选目录内有界文件并核验每个 Git blob SHA。它选择仓库内单个 SKILL.md 目录，并交由现有 lfaa-knowledge-library Owner 按账户保存。该路径不下载整仓 ZIP，不要求仓库根目录存在插件 `package.json`；插件 manifest/发布入口核验只在 Plugin Owner 路径执行。安装不写入项目 .agents/skills/；检查凭证绑定发起用户和所选目标 App，Skill 正文写入账户共享库，所有项目与 App 的现有 SkillRegistry 都可发现并按需加载。调用 App 与凭证目标 App 可以不同；账户共享 Owner 以用户身份核验安装记录，不把两者相等作为安装成功条件。

安装检查与安装使用同一固定提交和选中文件摘要，检查阶段的文件树与内容下载同样接收当前 Agent Run 的 AbortSignal。Knowledge Library Owner 在账户哈希隔离的目录中保存正文与附属文件，按文件 SHA-256 回读。适配器的 capability_list 仅列出当前账户的安装；capability_remove 按稳定安装 ID 精确移除一条记录。Owner 拒绝同一账户重复安装同名 Skill，不覆盖现有内容。验证会检查 Settings Owner 的账户扩展总开关与 Skill 停用名单：开关关闭或该项被停用时 Skill 仍在账户资料库，但模型 Skill 目录不会提供它，只报告“已安装”并给出真实阻塞原因，不伪称 ready；共享 Skill 成为 Registry winner 且正文可回读、运行时门打开时才标记 ready，存在优先级更高的同名项目 Skill 时同样只报告“已安装”。

Skill 内容只作为不可信数据安装，来源脚本不会执行，也不会安装其依赖。检查会静态列出常见脚本文件、来源声明的最低 Node 主版本、package.json 中依赖名和 script 名称，以及后台进程、浏览器远程调试/CDP、任意页面脚本执行、本机文件路径和用户目录持久化的文本线索，并把这些信息标为“仅来源声明/静态线索，未执行、需核验”放进检查与安装审批摘要。扫描只揭示来源文本中出现的标记，不证明行为存在或安全，也不证明目标执行环境、脚本、依赖或外部服务可运行。单个 Skill 最多 128 个文件、总计 5 MiB、单文件 2 MiB；二进制资源以受限 base64 经 Knowledge Library Owner 校验保存，读取仍受 Skill Registry 的文本资源目录与大小界限约束。

检查与安装都沿用当前 Agent Run 的 AbortSignal，并把它传递至固定快照下载；下载完成和写入账户 Owner 前再次检查取消，避免取消后的迟到结果写入。一次性检查凭证由通用 Registry 消费；取消后须重新检查。此适配器不增加 Permission Owner、账户存储或 Skill Registry，也不代表来源脚本、外部依赖或运行环境已经验证。
