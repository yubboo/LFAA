# LFAA-WRITING-LOCAL-FILES-20261010

## 目标与运行入口

把现有 Writing 作品内容保存在控制端本机的 Markdown 文件中，继续通过现有 Writing 常规模式、认证 API 与 Writing Agent Tools 读写。SQLite 保留账户归属、作品与内容之间的关系、展示所需元数据、当前工作区位置和待审编辑提案状态。

## Owner、路径与数据边界

- `packages/document/writing` 继续持有 Writing 业务读写与账户归属校验；认证 Controller 和 Agent Tools 继续使用同一服务。
- 文件根目录由当前 `config.dataDirectory` 和 `resolveUserDataPaths(dataDirectory, userId)` 决定，落在该账户的 `projects/writing/<bookId>/` 下；账户 ID 经现有路径 Owner 哈希，作品和内容路径只接受数据库中的 UUID。应用不暴露任意本机路径。
- 本地文件保存大纲、章节、修订、资料条目正文和作品 Skills 指令。SQLite 继续保存作品/卷/章节/目录/Skills 元数据、工作区位置、账户关联和待审 AI 提案正文；既有 `writing_book_skills.instructions` 非空约束要求保留固定标记 `lfaa-local-file-v1`，其中不含用户正文。不迁移账户、权限、凭据、Session、AI Work 工作区项目或游戏数据。
- 沿用现有数据根配置、原子文件写入和私有目录权限实现，不新增或修改设置中心配置。文件不是加密格式；本轮只依赖当前账户的操作系统目录访问控制。

## 允许与禁止

允许修改 Writing 服务与本地文件 Owner、SQLite 的非破坏性迁移结构、直接 Writing 回归、Writing README、系统总体架构说明、本合同及任务索引。禁止建立第二套 Writing 服务或账号/权限系统，禁止客户端/模型提供任意路径，禁止把 AI 提案正文或其他领域数据搬入本地文件，禁止触碰无关未提交改动。不得提交、发布或重启正在运行的服务。

## 验收

- 旧作品先写入分账户本地文件并校验回读，再在数据库事务中清空对应 SQLite 正文并记录迁移完成；在写入、回读或事务失败时保留 SQLite 原文，重启可重复完成。
- 新建、读取、更新、删除、修订恢复、编辑提案应用、资料目录、作品 Skills 和 DeepWrite 导入/导出均通过既有 Writing Owner 操作本地文件；SQLite 只保留关系/状态/元数据及明确保留的提案正文。
- 文件路径由已认证用户和 UUID 推导，文件写入原子发布并验证内容；缺失/损坏文件时失败关闭，不回退到 SQLite 残留正文。账户隔离、上限、分页、修订保留数、提案审核和冲突规则不变。
- 运行新的迁移/文件定向回归、现有 Writing 定向回归和 Writing 包构建。区分代码/构建证据与真实浏览器、Provider、桌面及运行服务验收。

## 实施记录

- 已实现：Writing 服务按账户哈希和作品 UUID 派生本机文件路径，正文通过原子文件写入；文件布局清单、目录/文件类型、硬链接及 UTF-8 均在读取/写入时校验。SQLite v51 增加逐作品迁移标记和章节/修订字数投影。迁移按有界批次写入并逐项回读校验，成功后才在 SQLite 事务中清空旧正文；Skill 旧列保留固定非内容标记。
- 已实现：新建、更新、删除、修订恢复、提案应用、资料/Skills 读写及 DeepWrite 导入/导出继续通过既有 Writing Owner；待审提案正文仍在 SQLite。章节列表继续读取字数投影，不为工作区目录扫描所有正文。
- 验证通过：`pnpm --filter lfaa-document-writing run build`；`apps/cli` 下 `writing-local-files.test.mjs`、`writing-edit-proposals.test.mjs`、`writing-book-profiles.test.mjs`、`writing-catalog.test.mjs`、`writing-analysis-tools.test.mjs`、`writing-deepwrite-projects.test.mjs` 各 1/1；本轮涉及文件的 `git diff --check`。
- 未验收：真实浏览器、Provider、Electron/桌面、运行中服务和重启后真实账户数据；Windows ACL 在当前设备的实际访问结果未单独实测。未新增设置中心配置，沿用现有 `LFAA_DATA_DIR`；未提交、发布或重启服务。
