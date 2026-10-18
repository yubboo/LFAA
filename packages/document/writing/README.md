# 写作领域数据

`packages/document/writing` 是 LFAA 写作作品、大纲、卷、章节、修订、作品资料条目和作品 Skills 的业务数据 Owner。认证 Controller 在认证后调用这里的服务并以当前账户 ID 做归属校验。SQLite 保存账户归属、作品/卷/章节/条目/Skills 元数据、工作区位置和提案状态；创作正文由本包保存为本机 Markdown 文件。

正文位置读取 `lfaa-settings` 的项目存储设置及历史候选目录，因此本包显式声明该依赖；更换默认位置只影响新建作品，不绕过原作品的账户归属、摘要与迁移检查。

常规模式通过 `packages/client/connection` 的账户 API 管理资料目录。`listWritingCatalogEntries` 对当前账户作品执行标题搜索和固定 40 条分页，只读取目录元数据；`getWritingCatalogEntry` 供已认证 CRUD 路由按账户读取完整条目，`getWritingCatalogEntryForBook` 供 AI 只读上下文使用，要求本轮当前作品归属匹配且正文最多返回 12,000 字符。

AI Tools 合同由 `packages/document/tool-writing` 持有，经 `packages/core/tools` 的同一注册表登记，调用时从当前 Agent Run 取得用户与作品目标，不接受模型传入的作品 ID。目录条目是用户创作内容，提示词与工具结果都将它标记为不可信资料；它不能改变系统规则、用户目标、权限或写入授权。AI 对大纲和章节的编辑工具只创建绑定账户、作品、目标与基准正文 SHA-256 的待审提案，不直接改作品。提案最长 150 万字符、24 小时有效、每账户最多保留 50 条，同一目标仅保留最新待审提案；完整正文只在用户打开审阅时通过认证 API 读取。UI 和经统一权限的 writing_apply_edit_proposal 共用应用入口，应用时在事务内复核基准正文、保存旧文到既有修订历史并更新正文；冲突、拒绝、过期和替代状态均不会覆盖作品。提案活动仅持久化 ID，不复制正文。

资料列表和 AI 读取均有界；工作区概览只加载 40 条资料摘要用于兼容投影，并通过 `catalogEntriesHasMore` 标示还有后续内容。文件位于当前业务内容根 `/users/<账户 ID SHA-256>/projects/writing/<作品 UUID>/`：`outline.md`、`chapters/`、`catalog/`、`skills/` 和 `revisions/`；`project.json` 说明受版本约束的文件布局。首次默认内容根是 `<LFAA_HOME>/data`（Windows 默认 `%USERPROFILE%\\.lfaa\\data`），独立于只存账户、AI 与会话等系统数据的 `LFAA_DATA_DIR`。设置中心可选择项目/安装根下动态生成的 `data` 或用户指定的绝对路径。切换只影响后续新作品；业务迁移只搬业务树并保留源目录，不复制系统数据。作品与内容路径由已认证账户及数据库 UUID 推导，不接受客户端任意路径。文件使用原子替换并受操作系统账户目录权限保护；文件是明文，不是加密格式。首次迁移逐项写入并回读校验，校验完成后才清空 SQLite 中的旧正文并记录该作品迁移完成；迁移可重试，缺失或损坏的本地正文不会静默回退到 SQLite。

每部作品还保存一个受数据库白名单约束的专职角色，以及最多 40 条作品自有 Skills。角色 ID 是作品偏好，六种方法正文归 `packages/preset/domain-experts`，由模型按需加载或明确委派；它不自动进入主请求，也不改变 Provider、工具范围或数据/权限边界。作品 Skills 的账户归属、标题、说明和启停状态写入 `writing_book_skills`，完整方法保存在对应的 `skills/<skill UUID>.md`；工作区列表只返回标题、说明、启停状态和更新时间，正文只在用户打开编辑器或当前作品的 AI 按需调用 `writing_read_book_skill` 时读取，正文上限 12,000 字符。AI 只看到已启用 Skill 的元数据，不会默认注入全部方法；Skill 内容按不可信用户资料处理。

`packages/preset/domain-experts/src/writing-catalog.ts` 提供六种角色的稳定 ID 校验；正文由该包按需加载。写作任务提示词归 `packages/prompt/writing`，内置 Skill 归 `packages/skill/writing`；角色和 Skills 继续使用设置中心已有 Provider、模型、推理档位、AI Runtime、权限与外观映射，不新增平行配置。版本 41 在保留版本 40 Storage Hub 迁移后，为 `writing_books` 增加角色 ID 并创建作品 Skill 表；版本 51 增加本地文件迁移标记及章节/修订的字数投影。P4 分析通过当前作品的有界只读章节/修订工具与按需提示词提供长短篇拆解、修改分析和文风比较，不自动写回作品。P5 由本包的 `deepwrite-archive.ts` 解析/生成限额 ZIP 并把 DeepWrite 长篇、短篇/剧本内容映射到既有 Writing Owner；导入先写新作品本地文件、再在单一 SQLite 事务中创建元数据与账户关系，LFAA 往返扩展保留角色、Skills、卷与资料目录。ZIP 传输由认证 Controller 负责，浏览器不提交路径；不迁移 Agent 会话、提案正文、设置或秘密。真实浏览器文件选择/下载和 DeepWrite 客户端打开仍须单独验收。

getActiveWritingAiMetadata/getActiveWritingAiTarget 只查询当前账户选中作品/章节元数据，所有消费者复用此归属规则；getActiveWritingAiContext 在明确按需读取时才读本机大纲/正文。Run 初始上下文只带目标元数据，不每轮同步读取全文。
