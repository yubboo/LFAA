# LFAA-READABLE-AI-PROJECT-FOLDERS-20261029

<a id="lfaa-readable-ai-project-folders-20261029"></a>

## 目标与 Owner

将 AI 漫剧与 Writing 的本机作品目录从账户 SHA-256 / 作品 UUID 改成可读账户目录和作品名目录。账户归属、聊天关联和业务身份继续使用稳定账户 ID、作品 UUID；这些 ID 留在数据库与项目清单，不作为正常作品目录名。

- 运行入口：认证后的 AI 漫剧与 Writing 服务；请求账户 ID 由认证 Controller 传入。
- 数据 Owner：`packages/video/ai-video` 拥有漫剧项目 JSON、画布和素材；`packages/document/writing` 拥有写作作品正文文件和作品元数据关系；`packages/identity/auth` 的 `users.username` 是可读账户名来源；`packages/util/home-paths` 维护账户数据目录安全解析。
- 配置 Owner：设置中心“项目与存储”现有 `LFAA_DATA_DIR`/历史内容根候选；本任务不新增设置、不改变用户已选根。
- 其他域边界：不迁移通用 Canvas、Workspace、Minecraft、会话、账户/控制数据库或输入/输出镜像目录。

## 目录合同

- AI 漫剧：`<LFAA_DATA_DIR>/users/<可读账户名>/projects/aivideo/<可读作品名>/project.json`，同一作品素材继续保存在该作品 `assets/`。
- Writing：`<LFAA_DATA_DIR>/users/<可读账户名>/projects/writing/<可读作品名>/`，原 `project.json`、大纲、章节、资料、Skills 与修订布局不变；SQLite 保存 UUID 到创建时目录名的映射，标题改名保留现有目录名。
- 目录名经过跨平台安全清理；同名时添加可读序号 `(2)`、`(3)`。账户目录用隐藏 Owner 清单绑定稳定账户 ID，以处理重名和账户改名；项目 ID 仍是授权与读写定位依据。

## 迁移与安全边界

- 首次访问受影响作品时才迁移该领域目录；只在同一个内容根内移动目录，避免跨盘隐式复制。
- 迁移前校验旧项目清单及其账户/作品 ID；拒绝覆盖已存在且归属不同的目标、重复副本、符号链接或不匹配清单。
- 同卷目录移动采用原子重命名；移动后回读验证。失败时尽可能原子移回旧位置，且不得静默创建空作品或丢失原目录。
- Data 根切换后的旧根继续按设置中心候选位置读取；不把历史根自动搬到新根。
- 开发期间不读取、迁移或改写用户本机 `.lfaa/data` 中的作品。

## 验收

- 新建与已有 AI 漫剧/Writing 作品的可读路径不暴露账户哈希或作品 UUID；素材、正文、画布布局与账户隔离保持原 Owner。
- 老路径在首次访问后能定位到新路径；同名、损坏清单、多副本和移动失败均保留可诊断错误与原数据。
- 设置中心现有内容根配置继续生效，不引入第二套存储配置。
- 运行受影响包的直接构建与静态差异检查；本轮不运行测试，也不以构建代替真实数据迁移验收。
- 本轮没有产品界面改动，因此不需要浏览器页面验收。

## 实施记录

- 共享路径帮助、AI 漫剧 Owner、Writing Owner 与 SQLite v76 已接入；旧 AI 漫剧/Writing 目录在各自项目首次访问时按清单/账户 ID 校验并迁移。项目迁移只在原内容根内目录重命名，项目数据根切换不触发跨根搬运。AI 漫剧标题变更同步改名；Writing 保留首次目录名。
- 新增 AI 漫剧用户目录 Owner 清单；稳定账户 ID 和作品 UUID 仍是唯一关联身份。Writing `directory_name` 有账户内唯一索引和 80 字符数据库校验。
- 使用设置中心“项目与存储”既有 `LFAA_DATA_DIR` 与历史内容根候选；没有新增设置或改变现有偏好。
- 性能与安全静态证据：用户目录探测最多检查 2,048 项并缓存上限为 2,048；AI 漫剧目录每用户最多扫描 20 个项目并限制候选根/目录项；Writing 目录片段由服务端清理和 SQLite 唯一索引约束。项目身份仍由认证账户 ID、数据库关系和项目清单校验，不接收客户端路径。Writing 项目清单以独占创建避免同名并发覆盖。
- 实际构建均通过并仅输出到根 `dist/packages/`：`pnpm --filter lfaa-home-paths build`、`pnpm --filter lfaa-storage-sqlite build`、`pnpm --filter lfaa-document-writing build`、`pnpm --filter lfaa-video-ai-video build`。`node --check packages/util/home-paths/src/readable-user-paths.mjs` 与 `git diff --check` 通过。
- 在后续 Web 实页验收的 Control Plane 完整构建中，发现 `local-files.ts` 的 `projectLocation` 声明漏列已有返回值中的 `writingRoot`；已补齐该返回类型，`pnpm.cmd run build:control-plane` 随后通过。此为类型合同对齐，不改变本任务运行行为或真实数据。
- 按工作区开发者指令未运行测试。未读取或迁移本机真实作品数据，因此真实旧目录迁移、碰撞和回滚尚未实测；无界面变化，未做浏览器验收。构建结果只证明包可构建。

### 变更文件职责

- `packages/util/home-paths/src/readable-user-paths.mjs`、`.d.mts`：可读账户目录清理、归属清单、旧用户名解析、安全边界与类型合同。
- `packages/util/home-paths/README.md`：共享路径 Owner 边界，明确仅 AI 漫剧/Writing 使用可读项目路径。
- `packages/video/ai-video/src/index.ts`、`README.md`：漫剧作品目录分配、旧哈希/UUID 目录校验迁移、标题改名和本地素材保留说明。
- `packages/document/writing/src/local-files.ts`、`service.ts`、`README.md`：Writing 目录映射、迁移校验、创建/导入和删除映射。
- `packages/storage/storage-sqlite/src/database.ts`、`README.md`：Writing 目录名 v76 数据迁移、唯一索引及 Owner 说明。
- `docs/系统总体架构.md`：更新两领域实际本机路径与稳定 ID/迁移合同。
- `docs/PROMPTS.md`：本任务索引与交付状态。
- `docs/development/readable-ai-project-folders-20261029.md`：任务范围、验收边界、实施和验证记录。
