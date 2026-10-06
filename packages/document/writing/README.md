# 写作领域数据

`packages/document/writing` 是 LFAA 写作作品、大纲、卷、章节、修订和作品资料条目的业务数据 Owner。控制端 SQLite 中现有账户作品表是唯一持久化来源；写作 Controller 在认证后调用这里的服务并以当前账户 ID 做归属校验。

常规模式通过 `packages/client/connection` 的账户 API 管理资料目录。`listWritingCatalogEntries` 对当前账户作品执行标题搜索和固定 40 条分页，只读取目录元数据；`getWritingCatalogEntry` 供已认证 CRUD 路由按账户读取完整条目，`getWritingCatalogEntryForBook` 供 AI 只读上下文使用，要求本轮当前作品归属匹配且正文最多返回 12,000 字符。

AI Tools 由 `packages/core/tools` 登记，调用时从当前 Agent Run 取得用户与作品目标，不接受模型传入的作品 ID。目录条目是用户创作内容，提示词与工具结果都将它标记为不可信资料；它不能改变系统规则、用户目标、权限或写入授权。AI 对大纲和章节的编辑工具只创建绑定账户、作品、目标与基准正文 SHA-256 的待审提案，不直接改作品。提案最长 150 万字符、24 小时有效、每账户最多保留 50 条，同一目标仅保留最新待审提案；完整正文只在用户打开审阅时通过认证 API 读取。UI 是唯一应用入口，应用时在事务内复核基准正文、保存旧文到既有修订历史并更新正文；冲突、拒绝、过期和替代状态均不会覆盖作品。提案活动仅持久化 ID，不复制正文。

资料列表和 AI 读取均有界；工作区概览只加载 40 条资料摘要用于兼容投影，并通过 `catalogEntriesHasMore` 标示还有后续内容。作品正文和目录正文不落到任意文件路径，不创建第二个存储或 Runtime。

每部作品还保存一个受数据库白名单约束的专职角色，以及最多 40 条作品自有 Skills。角色是代码内置方法配置，由 Agent Loop 作为受信任扩展指令传给当前 Writing 请求；它不改变 Provider、工具范围或 P2 用户审阅应用边界。作品 Skills 按账户和作品双重归属写入 `writing_book_skills`，工作区列表只返回标题、说明、启停状态和更新时间；完整方法只在用户打开编辑器或当前作品的 AI 按需调用 `writing_read_book_skill` 时读取，正文上限 12,000 字符。AI 只看到已启用 Skill 的元数据，不会默认注入全部方法；Skill 内容按不可信用户资料处理。

`writing-specialist-library.ts` 保存六种专职角色方法；角色和 Skills 继续使用设置中心已有 Provider、模型、推理档位、AI Runtime、权限与外观映射，不新增平行配置。版本 41 在保留版本 40 Storage Hub 迁移后，为 `writing_books` 增加角色 ID 并创建作品 Skill 表。P4 分析通过当前作品的有界只读章节/修订工具与按需提示词提供长短篇拆解、修改分析和文风比较，不自动写回作品。P5 由本包的 `deepwrite-archive.ts` 解析/生成限额 ZIP 并把 DeepWrite 长篇、短篇/剧本内容映射到既有 SQLite Writing Owner；导入经单一事务创建新作品，LFAA 往返扩展保留角色、Skills、卷与资料目录。ZIP 传输由认证 Controller 负责，浏览器不提交路径，服务不创建文件缓存目录；不迁移 Agent 会话、提案、修订历史、设置或秘密。当前 schema/服务回归与相关构建已通过，浏览器文件选择/下载和 DeepWrite 客户端打开尚未实测。
