# LFAA-PROJECT-APPLICATION-ASSOCIATIONS-20261027：项目关联 LFAA 应用

<a id="lfaa-project-application-associations-20261027"></a>

## 用户目标

在 AI Work 的 ChatGPT 式项目中，可关联一个或多个 LFAA 已登记的业务 App。项目会持续告诉 Agent 该项目的领域范围，使模型结合当前请求，从 LFAA 真实登记且当前可用的工具、Skill 与专家中选择合适能力。关联清单取自 `APPLICATION_IDS`；当前示例为 Minecraft、SteamCMD 游戏服务、写作空间和 AI 漫剧。

## Owner、入口与边界

- 运行入口：`/work` 的 AI Work 项目管理器 → 认证 Workspace Controller → `packages/workspace/workspace` 项目 Owner；每次项目会话由 Agent Loop 读取当前登记并组合项目上下文。
- 项目 Owner 持久化 App 关联，保存顺序与唯一性；服务端校验值必须来自权威 `APPLICATION_IDS`，不接受 `workspace`（它是通用 Agent/项目管理入口，不是附加领域 App）。旧项目迁移为空关联，不猜测、不补假关联。
- 项目应用关联只表达用户提供的领域上下文，不等于权限、授权、工具白名单、可用能力保证或 Daemon/节点归属。Agent 仍依当前请求与真实登记的能力目录决策，执行继续经过原 Owner、认证、参数校验和 Permission Owner。
- 现有 App 清单是业务 App 身份唯一来源。Steam 示例对应当前 `steamcmd`（SteamCMD 游戏服务）；“漫剧”对应当前 `aivideo`（AI 漫剧）。不新增 App ID，不把写作 Skill 冒充独立 App，不让项目 App 关联触发 Daemon 发现、选择或任务。
- 不新增设置中心偏好。界面沿用当前 Appearance/Workbench 令牌和项目弹窗布局；现有 `permissions.mode`、账户记忆设置及项目记忆范围保持原 Owner 和默认值。

## 验收条件

1. 新建/编辑项目可从权威 App 清单多选/移除业务 App，保存后刷新仍显示正确关联；旧项目显示无关联，不被静默改类。
2. 数据库迁移使用独立关联关系，不覆盖项目原 `app_id` 所表达的项目 Owner/来源，也不丢失既有项目、会话、目录和记忆；输入经认证 API 与 Workspace Owner 校验账户及 App ID。
3. 项目关联能进入每次 Agent 项目上下文，并清楚标明为用户资料/领域上下文；提示模型优先按目标参考关联领域、只使用实际已登记能力，不把关联当作授权，也不要求静态业务流程。
4. 关联保存、读取、编辑和 AI Work Run 只经过当前控制端/本机 Host；不会查询、要求或写入 Daemon `nodeId`，不会更改原有权限模式。
5. 运行受影响包的直接检查/构建；Web UI 变更需按开发规范逐批在 ChatGPT 内置浏览器的实际 `/work` 路由验收桌面与窄/短视口，并记录交互、截图、源码/构建/页面证据及未验项。不得因其他并行源码错误把失败写成通过。

## 修改边界

- 只修改项目 App 关联的持久化、认证 API/共享类型、项目创建/编辑界面、Agent 项目上下文及受影响 README/架构/本合同。
- 不改项目路径或小写 `lfaa` 规则；不改变项目目录主根、附加来源、会话归组或记忆策略。
- 不重排现有 LFAA Apps，不改 App/Tool/Skill/Expert 正文或包职责，不实现新的 App，也不改变 SteamCMD、Minecraft 节点能力。
- 不绑定、读取、选择、派发或等待任何 Daemon/节点。

## 实施与验收记录

实现记录：正式业务 App 选项由 `APPLICATION_IDS` 派生，排除通用入口 `workspace`，当前包括 SteamCMD 游戏服务、Minecraft 管理、LFAA 联机服务、写作空间和 AI 漫剧。SQLite 迁移 71 用 `workspace_project_applications` 保存账户/项目/App 关系及选择顺序；旧项目保持空关联。项目管理器创建/编辑支持多选，项目列表摘要显示已关联 App。Agent Loop 每轮从 Workspace Owner 重新读取最新关联，并将稳定 ID 和显示名称放入项目上下文；只作为模型判断当前目标的领域资料，工具/Skill/专家仍须属于本轮真实可用目录。关联不改变 `workspace` 会话的能力可见范围，不是 App 启用开关、授权、白名单、Daemon 或节点绑定。

实现文件职责：`packages/util/values/src/application-id.ts` 持有 App ID/显示名称权威目录与项目关联可选集；`packages/storage/storage-sqlite/src/database.ts`、`packages/storage/storage-domain/src/migration.ts` 创建关联表；`packages/workspace/workspace/src/index.ts` 持有账户校验、排序、读写和事务替换；`packages/api/workspace-controller/src/index.ts`、`packages/client/connection/src/api.ts` 持有认证 API 与共享类型；`packages/client/ui-chat/src/LocalWorkspaceProjectPicker.tsx` 提供创建/编辑交互；`packages/core/session/src/sessions.ts`、`packages/core/agent-loop/src/workspace-context.ts`、`runs.ts`、`execute-turn.ts` 将当前登记的项目关联传到 Agent；Workbench、相关 README、系统架构、本合同和迁移回归期望记录共享目录与边界。

设置中心配置：无新增或调整；继续使用已存在的 Appearance/Workbench 主题令牌与 `permissions.mode`，未更改用户偏好。

实施与源码验证：受影响的 10 个包构建通过，`tsconfig.client.json` 类型检查通过，`git diff --check` 通过。Web Vite 构建在当时源码快照上成功（3887 个模块），但并行源码随后变化；最新 `runtime-build-state.mjs web` 返回 `host`、`web`，当前控制端和 Web 指纹均过期，不能把此前 Web 构建当作当前快照的最终构建证据。Host TypeScript 检查被本合同以外的 `packages/knowledge/knowledge-library/src/index.ts` 错误阻断：该文件引用 `HomePaths.skills`，但当前 `HomePaths` 类型没有此属性（第 722、759 行）。未运行测试。

页面验收：本轮使用临时 `LFAA_HOME` 与 `LFAA_DATA_DIR`，控制端 `/api/health` 返回 200，Vite 开发服务报告就绪；未启动 Daemon。首次内置浏览器只到达登录页，临时账户登录返回 401；随后浏览器对本机 HTTP 页面拒绝授权访问，明确要求不得经其他浏览器或技术路径绕过。故 `/work` 项目创建/编辑交互、桌面与窄/短屏均未完成实页验收，不能标记通过。临时隔离服务已停止；未写入真实 Home/Data、真实项目或用户设置。
