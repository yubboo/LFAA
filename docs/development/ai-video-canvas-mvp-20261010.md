# AI 漫剧分镜画布首版合同

## 目标与运行入口

在应用中心提供独立 `aivideo` 入口，以 Web/Desktop 共用的 React Flow 无限画布组织账户隔离的分镜板。用户可以新建/删除分镜板、添加/编辑/删除镜头卡片、拖动镜头、缩放画布、连接镜头并显式保存。首版是创作资料画布，不是可执行 Workflow。

## Owner、数据与设置

- 分镜 JSON 的唯一 Owner：`packages/video/ai-video`。MVP 首版实现时使用账户级 `projects/aivideo/storyboards.json`；当前项目文件布局和迁移规则由[本地项目文件合同](ai-video-local-project-files-20261010.md)维护。
- 认证 API：`packages/api/ai-video-controller`；客户端类型与请求：`packages/client/connection`；画布界面：`packages/client/ui-workspace`。
- App ID 进入现有账户会话、权限、主机任务、资料库和 Workflow 作用域时，使用 SQLite v50 扩展现有约束；不创建新的存储或权限系统。
- 外观沿用现有 Appearance 的主题、字体、颜色、字号、背景遮罩/模糊及减少动态效果映射；AI Work 沿用 `permissions.mode`。不新增设置项。

## 修改边界

允许修改 App ID/工作台路由、应用卡片、分镜 Owner/API/Client/UI、Web Bundle 装配、直接回归、目标包 README、`docs/系统总体架构.md`、`docs/开发计划.md` 和本合同。

首版不接视频模型或 ComfyUI 执行器，不上传素材，不导入 Blender 白模，不渲染时间线，不让 AI 直接改写画布，也不借用 Workflow 定义存储创作资料。不得虚构生成或导入结果，不复制 Nomi/ComfyUI 源码，不引入未经审查的许可内容，不增加第二套权限或用户设置，不触碰其他未提交工作。

## 验收

1. 认证用户可创建、读取、更新和删除自己的分镜画布；未认证请求拒绝，其他账户看不到数据。
2. 服务端验证有界镜头/连线数据，原子持久化；读取恢复标题、镜头文字/时长、坐标和连线。
3. 更新以 `expectedUpdatedAt` 防止过期写入；UI 显示真实保存/冲突结果，单次仅有一个保存请求。
4. SQLite v49→v50 迁移保留已有行、索引和外键，并允许 `aivideo` 进入现有 App 作用域。
5. 运行 Owner/API/迁移定向回归、受影响包构建、CLI 类型检查、工作区 Gate 和 `git diff --check`。
6. Provider、视频生成、白模导入、时间线、浏览器视觉/帧时间及桌面运行时未测时，明确标为未验收。

## 实施与验证记录

- 已接入应用中心入口、共享工作台路由、分镜画布服务和认证 API。画布支持分镜板与镜头卡片 CRUD、拖动缩放、镜头连线和显式保存；连线属于创作关系，可形成环路，不进入 Workflow DAG。
- 画布数据按账户隔离保存，校验 20 张分镜板、每板 64 个镜头/128 条连线和单账户文档字符上限；路径拒绝符号链接/错误文件类型；原子替换后回读校验。过期更新时间返回冲突。
- SQLite v50 事务化重建仍在用的 App 作用域表，复制原记录并保留索引/触发器/外键；已随 v31 退役的 `user_preferences` 继续沿用账户设置文件 Owner。
- `apps/cli/tests/ai-video-canvas.test.mjs`、`ai-video-api.test.mjs`、`workflow-core.test.mjs`、`computer-use.test.mjs`、`harness-agent-api.test.mjs`、`knowledge-library.test.mjs`：定向命令 7/7 通过；覆盖认证 API 401/CRUD/400/409、数据隔离、原子持久化、v49→v50 行/索引/外键保留及旧 Workflow 迁移。
- 受影响包构建通过：SQLite、Storage Domain、AI Video Owner、API Controller、UI Workspace、UI Layout、UI Renderer、UI Sidebar、UI Settings、UI Chat、Core Tools、System Prompt、Web Bundle。
- `pnpm run build:control-plane`、`pnpm run build:web`、`pnpm run typecheck`、`pnpm run check:workspace` 和 `git diff --check` 通过；Web 输出位于 `dist/apps/web/`，能力包输出位于根 `dist/packages/`。
- 当前仓库没有 `workspace-preflight` 脚本；已执行存在的 `check:workspace` Gate。
- 未运行真实视频 Provider/ComfyUI/白模导入/时间线；帧时间和桌面运行时仍未验收。浏览器只验证应用入口、画布首屏与账户空列表读取，没有在真实账户创建测试数据。

## 运行时问题修复

- 2026-10-10 登录后实测应用中心点击 AI 漫剧“常规模式”仍留在应用中心。原因是 `App.tsx` 的历史入口状态解析器手写了应用白名单，漏掉 `aivideo`；入口虽写入浏览器 history，布局 effect 随即将其重定向回 `/`。
- 已将历史状态解析抽成纯函数，并基于 `APPLICATION_IDS` 唯一清单校验；新增回归覆盖每个登记应用和非法状态。
- `application-entry-state.test.mjs`、`ai-video-canvas.test.mjs`、`ai-video-api.test.mjs` 定向回归 4/4 通过；`pnpm run build:web`、`pnpm run check:workspace`（180 个包）和 `git diff --check` 通过。
- 本机已登录浏览器从应用中心打开 `/apps/aivideo/normal`，显示“漫剧分镜”工作区；账户分镜列表读取成功且为空，添加/保存控件正常呈现。没有创建测试分镜，避免写入用户账户数据。
