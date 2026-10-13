# AI 漫剧本地项目文件合同

## 目标与运行入口

把 AI 漫剧每张分镜画布保存为账户隔离的本地项目文件夹，便于后续在同一项目内保存参考素材、白模和生成结果。入口仍为应用中心 `aivideo`；Web/Desktop 共用画布和认证 API 不变。

## Owner、路径与配置

- `packages/video/ai-video` 是项目文件和画布内容唯一 Owner；认证 Controller 只按当前登录用户委派。
- 路径固定由当前 `config.dataDirectory`、`resolveUserDataPaths(dataDirectory, userId)` 和已验证 UUID 推导：`<LFAA_DATA_DIR>/users/<账户 SHA-256>/projects/aivideo/<项目 UUID>/project.json`。不接受客户端绝对路径、任意文件名或其他账户的 UUID。
- `project.json` 是完整可编辑创作画布的权威文件。未来真实接入的媒体资产放入同项目的 `assets/` 并从项目 JSON 保存相对路径；本轮不接入素材、白模或生成文件，因此不创建空目录、不引入虚构素材引用。
- 复用现有 `LFAA_DATA_DIR`、账户路径 Owner、`atomicWrite`、私有目录保护和控制端写锁；不新增设置中心配置、权限、SQLite 表、第二套项目服务或任意本机目录选择。
- 继续使用现有外观设置映射、AI Work `permissions.mode` 和 App 账户授权。本轮无新增界面或设置控件。

## 旧数据迁移与故障边界

- 首次读写时检查旧 `projects/aivideo/storyboards.json`。逐项校验旧数据，按项目 UUID 写入并回读校验独立 `project.json`；全部成功后才将旧文件原子改名为 `storyboards.v1.migrated.json` 作为本地恢复副本。
- 迁移必须可重试；文件写入、校验、格式或目标冲突时拒绝继续并保留旧文件。损坏文件、符号链接、错误类型及跨账户路径一律失败关闭，不静默重建或覆盖。
- 每账户最多 20 个项目，全部 `project.json` 合计沿用 4 MiB 上限。列举目录和文件读取均受该上限约束；更新仍要求匹配 `expectedUpdatedAt`。删除只移除目标 UUID 项目目录，并保留账户路径之外的所有内容。

## 修改边界

允许修改 AI Video 项目 Owner、直接回归、Owner README、架构/计划文档、首版画布合同、本合同及任务索引。不得修改 Writing 正在进行中的未提交文件；不得创建真实 Provider/ComfyUI 执行器、白模导入、媒体上传、时间线、模型自动改写、任意路径访问或额外用户设置。不得触碰其他未提交工作、提交、发布或重启运行服务。

## 验收

- 新项目各自位于独立 UUID 文件夹；创建、读取、更新、删除、账户隔离和并发冲突符合既有 API 行为。
- 旧聚合文件迁移写入并回读验证后才改名；模拟部分迁移重试、文件损坏、目标冲突及符号链接均不会丢失/覆盖原数据。
- 项目 JSON 保留完整编辑画布字段；连线仍是创作关系，可有环，不映射到可执行 Workflow。
- 运行 AI Video Owner/API 定向回归、受影响包构建、CLI 类型检查、工作区 Gate 与 `git diff --check`。真实 Provider、浏览器写入、桌面、素材/白模、帧时间和运行中服务加载分别报告，未运行则标为未验。

## 实施记录

代码已实现：每张画布保存到账户隔离的 UUID 项目文件夹；旧账户级文件经逐项校验、原子写入及回读后改名留作恢复副本。Owner/API 定向回归 2/2、Owner 与 Controller 构建、CLI 类型检查通过；`git diff --check` 和新增文件空白检查通过。`pnpm run check:workspace` 未通过：仓库里正在进行的 `packages/document/writing/src/local-files.ts` 引入了 `lfaa-launch-environment`，但 Writing 包尚未声明该内部依赖；本任务未改写作目录。当前仓库没有 `workspace-preflight` 脚本。真实浏览器写入、运行中服务加载、桌面、Provider、素材/白模、帧时间未验。
