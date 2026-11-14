# LFAA Repository Skeleton Modularization

<a id="lfaa-repository-skeleton-modularization-20261114"></a>

## 用户问题与目标

用户反馈仓库职责堆叠较多、部分文件承担多个功能，修改一个区域可能波及其他区域。本任务按职责把相关能力归入同一功能目录，并把过大的组合文件逐批拆成边界清晰的内部模块。采用小批迁移；每批保留现有公开入口、运行行为和唯一业务 Owner。

用户已将范围明确扩展到整个 `packages/`：逐目录核验实现位置、唯一 Owner、消费者、依赖、装配和占位状态；把已实现但职责错位的代码归回正确模块；按功能拆分职责混杂的大文件。以现有包职责规范和生成清单为准，不按目录名猜归属，也不因目录为空就机械实现。

下方最初的 `ApplicationWorkspace` 入口、设置边界、允许范围和 600 行验收专属于 UI-A 工作区拆分；后续 UI-B 与全包归属批次以各自续批合同及本页实施记录为准。

这是跨 388 个两级目录的分批任务，不会一次搬动全仓。初始盘点时有 233 个 workspace 包；UI-B-4 完成后，生成清单记录 236 个实现包和 152 个占位。先完成全目录证据盘点和问题登记，再按安全/数据一致性、执行正确性、重复职责、性能与维护成本排序处理；每批只改有错位证据的 Owner 边界，保留稳定公开入口、真实用户数据和范围外工作。`ApplicationWorkspace.tsx` 首批拆分已完成，后续继续全包审计和迁移，不能据此关闭总任务。

## 运行入口与 Owner

- 共享 `/work` 与领域 App 工作区由 `packages/client/ui-workspace` 提供；本批只整理该包内部的 `ApplicationWorkspace` 及其内部模块，不改包边界。
- 模块职责按现有调用链分组：会话/项目数据；能力资源与领域内容状态；Git/Host Task；浏览器与工具页签；工作区 Chrome/键盘与响应式布局；中心内容、右侧上下文及工具页签呈现。只在组件或 hook 内持有其单一状态源，组合层负责跨模块连接。
- 应用目录和路由由 Workbench/应用装配提供；会话由 Session Owner 提供；项目由 Workspace Owner 提供；Git 摘要由现有 Git Owner 提供；通知由 `client/resources` 提供。此批不改变这些 Owner。

## 设置、数据与权限边界

- 不新增、迁移或修改设置。保留现有 `general.navigationLayout` 与 Appearance 外观传递；侧栏折叠、会话分区、项目折叠与分页偏好仍按现有 Client Store 的账户/App 范围保存；会话置顶继续沿用现有 Session Store。
- 会话、项目、通知、Git、应用导航与权限数据保持原 Owner 和数据格式；不新增 API、存储、订阅或权限策略。
- 改名、归档、选择、取消侧栏预览和打开应用继续调用现有回调；权限仍由服务端及原 Permission Owner 校验。
- 未添加用户可见功能、CSS、状态副本或依赖，也不改包边界和构建输出路径。

## 本批允许范围

- 保留并归档现有 `application-workspace/types.ts`、`pure-utils.ts`、`application-navigation-model.ts` 与 `components/` 模块。
- 新增按唯一职责划分的 `hooks/` 数据/交互控制器及中心工作区、右侧上下文、Git 摘要等 `components/` 视图；主入口只组合 Hook 返回值和区域组件。
- 控制器以领域数据边界划分为 Session/Workspace、Agent Git/Host Task、Browser/Utility Tabs、Workbench Chrome 与领域内容状态；不得通过一个全能 Hook 或 React Context 重新聚合全部业务状态。
- 更新 `packages/client/ui-workspace/README.md` 与本合同，列明每个新模块职责、入口与依赖边界。
禁止：改变可见 DOM/CSS/文案、导航/会话/浏览器/Git/布局行为、设置映射、API/Owner、用户数据、公开包导出和依赖；不改其他产品热点文件、不搬包、不做行数驱动拆分。

## 可观察验收

1. 根组件保留稳定公开 API 和工作区组合入口，目标控制在 600 行以内；数据读取、订阅/计时器、导航交互、各区域展示分别由有明确名称和属性合同的职责模块拥有。
2. Session/Workspace、Git/Host Task、Browser/Utility Tabs、Chrome/响应式布局和领域 App 内容的状态、请求取消及清理仍各自单一，不新增重复订阅、状态副本或全能控制器。
3. 保持公开包导出、CSS/DOM/无障碍名称、文案、路由、lazy-loading、设置/存储 key、请求顺序、错误反馈和运行行为。
4. 运行受影响包构建、Client 类型检查、工作区 Gate、差异检查；不新增或运行产品测试。Impeccable 命令可用时运行，否则记录阻碍。
5. 尝试当前源码路由实页验收；记录桌面、窄/短视口和无法进入业务页面的边界。构建不能替代实页观察。
## 后续拆分路线（候选，需每批单独收敛合同）

全目录审查与问题登记见 [packages 全仓职责盘点](package-organization-audit-20261114.md)。该登记页只保存审查结论和问题，不另建包目录或能力清单；实际目录、状态、入口、消费者和装配声明继续以生成的 `docs/harness-packages.json` 为准。

| 顺序 | 热点 | 候选职责模块 | 必须保留的边界 |
|---|---|---|---|
| UI-A | `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`（本批前 2,854 行，拆分后 534 行） | 已完成纯类型/逻辑、导航模型、侧栏、Session/Workspace、Git/Host Task、Browser/Utility Tabs、Chrome/响应式布局、聊天与区域视图拆分 | Session、Workspace Project、Git、Browser、Canvas、领域 App 数据仍归原 Owner |
| UI-B | `packages/client/ui-chat/src/AiWorkChat.tsx`（UI-B-5 后 2,467 行） | 时间线/消息呈现、Composer/附件、Run 活动与独立视图模块 | Agent Loop、Session、Provider/Settings、审批与附件 Owner 不移动；流订阅仅保留一份 |
| UI-FEEDBACK | `packages/client/ui-message-feedback/PLACEHOLDER.md` 对应已有聊天反馈按钮/弹窗 | 将纯反馈展示组件与 CSS 归到声明的 `ui-message-feedback` Owner，并由 `ui-chat` 作为唯一消费者引用 | Session 持久化及认证 Connection API 留在原 Owner；该 UI 子包随 `ui-chat` 静态加载，不创建独立路由/服务 |
| UI-PLAN | `packages/client/ui-plan/PLACEHOLDER.md` 对应已有计划模式横幅 | 将计划模式状态横幅与专属样式归入 `ui-plan`，由 `ui-chat` 传入现有状态和动作 | Session/Agent Loop 的计划状态、模式切换和批准后发送仍由其原 Owner/聊天协调层持有 |
| UI-MODEL-SELECTION | `packages/client/ui-model-selection/PLACEHOLDER.md` 对应聊天内模型/推理 Popover | 将目录与推理档位面板视图/CSS 归入 `ui-model-selection`，聊天层只提供模型目录投影和已授权设置回调 | 模型能力/设置映射、认证写入和账户隔离继续归 `ui-settings-models`、Settings/Connection Owner |
| UI-APPROVAL | `packages/client/ui-approval/PLACEHOLDER.md` 对应待审批卡及历史审批决定视图 | 将审批请求卡、决定记录和审批专属 CSS 归入 `ui-approval`，由聊天传入真实活动与回调 | Permission/Agent Loop 继续执行授权与决定，聊天/Session 保留 Run 状态，不创建第二套审批规则 |
| UI-USER-QUESTIONS | `packages/client/ui-user-questions/PLACEHOLDER.md` 对应澄清问题、选项、答案输入及历史结果视图 | 将待回答卡、答案记录与问题专属 CSS 归入 `ui-user-questions` | 答案/跳过动作继续交给现有聊天、Agent Loop、Session Owner，问题运行状态不在 UI 包复制 |
| UI-WRITING-REVIEW | `packages/client/ui-chat/src/AiWorkChat.tsx` 内的写作修改提案审阅弹窗 | 将提案原文/新文对照、状态说明和审阅视图 CSS 归入已有 `ui-writing` | 提案读取、应用/拒绝请求、刷新和运行状态由 `ui-chat` 与 Connection/Writing Owner 保持 |
| UI-TRAJECTORY | 原 `ui-trajectory` 占位和 `ui-chat` 内公开回复轨迹投影/耗时/计时/展示逻辑 | 迁入轨迹展示组件、纯轨迹投影、耗时摘要、共享时钟及独立 CSS；`ui-chat` 保留回复组合、消息与交互 Owner，并继续提供旧源码路径兼容转发 | 隐藏推理、Session/Run、活动详情、工具协议与权限仍归原 Owner；保留 Appearance/reduced-motion 行为，不新增设置或持久化 |
| UI-CONVERSATION | 原 `ui-conversation` 占位和 `ui-chat` 内提问锚点导航/滚动视口算法 | 迁入锚点轨道、消息到锚点投影、滚动跟随与布局/观察器逻辑和专属样式；`ui-chat` 继续供给当前会话消息与跳转动作，并保留旧模块路径转发 | Session/消息读写、聊天 Run 与滚动恢复账户偏好不移动；保留键盘语义、Appearance/reduced-motion 和 ResizeObserver/帧清理行为 |
| UI-C | `packages/client/ui-workspace/src/CanvasWorkspace.tsx`（约 2.4k 行） | Stage、工具栏/面板、文档 load/save、history 与 selection/viewport 模块 | Canvas、AI Video 与生成 Owner 的格式、版本冲突和持久化不复制 |
| UI-D | `packages/client/ui-layout/src/Workbench.tsx`（约 1,252 行） | 路由纯逻辑、Shell/导航视图与外观适配 | Settings 默认值、路由装配、导航偏好与布局偏好继续归其原 Owner |
| UI-E | `packages/client/ui-settings/src/SettingsPage.tsx`（初始盘点 4,995 行，当前 4,559 行） | 按现有设置分类拆为内部页面/面板目录，页面保留 React/数据装配；常规表单、账号标签/资料/安全、Agent Loop 预算视图归各自 UI Owner，分类/路由模型归包内 `settings-page-model.ts` | Settings Owner 的 schema、校验、持久化与配置映射始终唯一 |
| API-A | `packages/client/connection/src/api.ts`（初始 3,795 行，当前 53 行） | 按领域分组类型与请求模块，根文件保留稳定的兼容聚合入口 | 认证请求封装、公开导出和调用方行为不变；不重复实现 API |
| DATA-A | `packages/storage/storage-sqlite/src/database.ts`（约 2,556 行） | 迁移定义与领域 repository/查询模块 | 单一连接、事务、迁移顺序、恢复与既有数据库格式 |
| HOST-A | `packages/host/daemon/src/daemon.mjs`（约 2,415 行） | Daemon 生命周期、连接/协议适配与任务执行模块 | Daemon 身份认证、目标校验、任务状态和取消合同不变 |
| CORE-A | `packages/core/agent-loop/src/execute-turn.ts`（约 2,301 行） | turn orchestration 与工具执行/审批/事件适配模块 | 模型决策、Permission Owner、Run/Session 持久化和取消语义不变 |
| SETTINGS-A / SESSION-A | `packages/settings/settings/src/service.ts`（约 1,992 行）；`packages/core/session/src/sessions.ts`（约 1,677 行） | 仅在对应上游拆分稳定后按职责提取纯校验、查询或领域命令模块 | 设置/Session 的权威 schema、迁移、事务与兼容合同不复制 |
| PKG-AUDIT | 全部 `packages/<领域>/<包名>/` 目录（388 个两级目录，当前包含 155 个上游占位） | 逐项核验入口、消费者、Owner、依赖、运行时/Bundle 装配和实际能力；每个目录登记“有证据保留 / 确认错位待修复 / 占位不可用 / 工程测试专用 / 证据不足待核验”结论及问题 ID | 占位仅在证实该职责已有实现或存在当前消费者时处理；不复制规则、数据、权限、提示词正文或 Provider 协议，不按包数/行数搬迁 |
| PKG-MIGRATION | 盘点确认错位的包与文件 | 依问题登记逐批归位；UI 展示、交互 Hook/状态、领域服务、Controller、存储、Tool/Prompt 内容分别遵循现有 Owner | 公开导出、账户/会话/项目/节点隔离、设置映射、Bundle/Profile、取消/错误/结果语义保持；同步消费者、依赖和包 README |

行数是本轮当前源码静态快照的定位参考，并非质量分数或拆分验收线。执行每一项前需读取相应包 README、Owner 与消费者，结合调用链确认适合的边界；完整路线可按实际依赖和回归风险调整。目录已有明确职责的功能包继续沿用，不为了整齐搬迁或合并。

### 2026-11-14 续批 UI-B-1：聊天消息呈现归类

- 入口：`packages/client/ui-chat/src/AiWorkChat.tsx`；消费者是本包 `AiWorkResponse` 与 Workbench 懒加载注册，不改变 `AiWorkChat` 导出或 `src/*` 兼容路径。
- 本批只把消息行与会话锚点轨道呈现移入 `packages/client/ui-chat/src/components/`，把共享消息状态/动作类型归入包内 `message-types.ts`。聊天根继续负责状态、请求、发送、Run/SSE 订阅和回调编排；Session、Agent Loop、Connection、Permission、附件和样式 Owner 不移动。
- 可观察验收：仅文件归类，保留原 DOM 顺序、类名、无障碍名称、消息动作、懒加载和 memo 更新边界；不改 CSS、用户文案、公开导出、设置、存储、请求或权限。同步更新 `ui-chat/README.md` 和全包审计状态；完成包构建、Client 类型检查、工作区 Gate、差异检查及现有 `/work` 实页观察，不新增或运行产品测试。
- 后续 Composer、流订阅/滚动、Run 状态和语音控制拆分仍是独立批次；本批不得把这些职责重新聚合到一个全能 Hook。

### 2026-11-14 续批 UI-B-2：抽取会话滚动与视口生命周期 Hook

- 入口：`packages/client/ui-chat/src/AiWorkChat.tsx`；纯锚点/视口算法继续由 `packages/client/ui-conversation` 提供，聊天主组件通过包内 Hook 适配当前消息 DOM。
- 将账户/App/Session 级滚动快照恢复、底部跟随、嵌套滚动传递、回复详情折叠后的视口校正、锚点观察与测量生命周期归入 `src/hooks/useAiConversationScroll.ts`。聊天入口继续持有会话消息、Run/发送/权限协调及 Hook 所需的状态连接；不复制 Session 或 Conversation 数据 Owner。
- 设置与边界：沿用现有账户/App/Session 滚动恢复键及 Appearance `appearance.advanced.reducedMotion` 映射；无新增设置、存储、API、订阅或权限。保留 DOM、类名、文案、事件次序及既有滚动阈值；不修改 CSS。
- 验证：`lfaa-client-ui-chat` 构建、Client `tsc --noEmit`、Web 构建、233 包 workspace Gate、Impeccable detector 与 `git diff --check` 通过。当前源码 `/work` 通过 Vite 前端连接既有 Host 的桌面实页加载；会话列表、锚点、历史消息、Composer 和右侧工作区工具栏均可见。只观察 1280×720 桌面，不执行发送、设置更改或写入；窄屏/短屏与滚动交互实测未覆盖，不新增或运行产品测试。
- 文件职责：`packages/client/ui-chat/src/hooks/useAiConversationScroll.ts`（滚动状态、会话恢复和锚点视口生命周期）；`packages/client/ui-chat/src/AiWorkChat.tsx`（使用新 Hook，保留聊天协调）；`packages/client/ui-chat/README.md`（说明 Chat Hook 与纯 Conversation Owner 的边界）；本合同及 `docs/development/package-organization-audit-20261114.md`（审计状态、验证与待办）。

### 2026-11-14 续批 UI-E-1：常规设置表单归入设置通用 UI 包

- 入口：`packages/client/ui-settings/src/SettingsPage.tsx`；该页面已依赖并装配 `lfaa-client-ui-settings-general`，逐包职责注解确认该包持有通用偏好与交互设置界面。
- 将“常规”分类原有表单、工作台布局预览、卡片/弹窗动效选择器及专属 CSS 归入 `packages/client/ui-settings-general/src/GeneralSettingsSection.tsx` 与 `general-settings.css`。SettingsPage 继续读账户设置、解析默认工作区、调用 updateGeneral、重试工作区读取、执行权限导航和打开许可证弹窗；组件仅接收值与回调。
- 设置及权限边界：沿用现有 `general.*` 字段、Settings Owner 的默认值/schema/保存 API、`appearance.advanced.reducedMotion` 优先级及 Appearance 样式令牌；无新增设置、存储、API、授权策略或设置映射。控件 DOM、文案、选项和 class 保持原有内容，专属 CSS 只移动到实际呈现它的包。
- 验证：`lfaa-client-ui-settings-general` 与 `lfaa-client-ui-settings` 包构建、Client `tsc --noEmit`、Web 构建、清单同步后的 233 包 workspace Gate、Impeccable detector（空列表）和 `git diff --check` 通过。首次 Gate 报告源码清单过期，运行 `pnpm run sync:workspace` 后通过。当前源码设置页实测桌面 1280×720、窄屏 390×844、短屏 390×640；布局卡片在窄容器保持两列、动效卡片单列，无横向溢出；未触发保存、重试、权限跳转或偏好变更，不新增或运行产品测试。Web 构建通过，输出还含 CSS 注释 minify 警告与既有大 chunk 提示，未归因。
- 文件职责：`packages/client/ui-settings-general/src/GeneralSettingsSection.tsx`（通用偏好 UI）；`packages/client/ui-settings-general/src/general-settings.css`（该表单专属响应式样式）；`packages/client/ui-settings/src/SettingsPage.tsx`（设置分类、数据与副作用编排）；`packages/client/ui-settings/src/SettingsPage.css`（其余分类共享样式）；两包 README、审计表与本合同（职责及验收记录）。

### 2026-11-14 续批 UI-E-2：拆出设置分类与路由状态模型

- 入口与边界：`packages/client/ui-settings/src/SettingsPage.tsx` 继续作为设置页 React 组合和数据协调入口；`src/settings-page-model.ts` 归包内负责分类类型/目录、设置类别映射、深链兼容、插件工作区视图投影、导航分组及账户级纯 UI 状态读写。
- 本批迁移 `SectionId`、插件独立视图映射、设置导航/扩展分类目录、分类到设置类别映射、延迟数据分类集合、原有导航/外观展开/背景目标 localStorage key 与读取写回函数；`SettingsPage` 保留设置请求/缓存、账户与领域状态、自动保存和交互编排。`StandalonePluginWorkspaceView` 仍从 `SettingsPage.tsx` 重导出，既有 `ui-plugin-manager` 导入路径不变。
- 设置边界：所有 URL 参数、localStorage key、序列化格式和分类回退顺序原样保留；此处状态只影响设置页展示，不持有 `UserSettings`、业务偏好或权限。无新增字段、API、依赖、存储合同或授权规则。
- 验收：设置包构建、Client `tsc --noEmit`、Web 构建、清单同步后的 233 包 workspace Gate、`git diff --check` 和 `/settings?section=general` 当前源码桌面实页通过；不新增或运行产品测试，不更改设置。
- 文件职责：`packages/client/ui-settings/src/settings-page-model.ts`（分类/路由/导航显示模型及本地视图状态映射）；`SettingsPage.tsx`（使用模型，保留页面、数据与副作用协调）；本包 README、全仓审计与本合同（模块边界、已知剩余范围和验收记录）。

### 2026-11-14 续批 UI-E-3：账号分类标签归入账号设置包

- 入口与证据：`SettingsPage.tsx` 在个人资料、安全和账号管理三类重复渲染同一键盘可操作标签栏；账号设置包已承载账户安全与管理员视图，且已由设置页静态依赖和装配。
- 将受控 `AccountSettingsTabs` 和专属 CSS 放入 `ui-settings-account`；账号分类 ID/标签目录、深链与选中状态仍归 `settings-page-model.ts`，由设置页传入分类、当前值和切换回调。不把用户设置、身份数据、认证 API 或凭据状态复制到 UI 包。
- 保留原 DOM 角色/ARIA、左右方向/Home/End 键处理、标签选择、class、主题令牌和响应式横向滚动；不新增设置、存储、API、路由或依赖。
- 验收：账号/设置包构建、Client `tsc --noEmit`、Web 构建、workspace Gate、差异检查，以及当前源码账号设置桌面与窄屏实页通过；不新增或运行产品测试，不提交设置更改。
- 文件职责：`ui-settings-account/src/AccountSettingsTabs.tsx` 与 `account-settings-tabs.css`（受控标签视图与专属样式）；`ui-settings/src/settings-page-model.ts`（账号类别、标签目录及深链守卫）；`SettingsPage.tsx`（当前分类及切换协调）；两包 README、账号分类现有结构回归断言、全仓审计与本合同（Owner 和验收）。

### 2026-11-14 续批 UI-E-4：账号资料与安全视图归入账号设置包

- 入口与边界：`SettingsPage.tsx` 继续协调账号路由、当前账户对象、在线状态、表单草稿及异步写入；`ui-settings-account` 只呈现资料与安全表单布局。
- 将只读资料行和用户名/邮箱/密码/恢复密钥/Passkey 安全表单移入 `ui-settings-account`。账户 API、`hasAdminAccess`、用户名/密码校验、恢复密钥生成/提交、草稿清理和保存状态仍由原 Settings/Account Owner 调度，不在展示包重复认证、授权或持久化。
- 保留原标签面板、输入类型/自动填充提示、在线禁用条件、密码强度说明、恢复密钥提示与按钮状态；不新增配置、API、路由、存储或依赖。
- 实际验收：账号/设置包构建、Client `tsc --noEmit`、Web 构建、233 包 workspace Gate、`git diff --check` 均通过；`/settings?section=profile` 和 `/settings?section=security` 当前源码在桌面 1280×720、窄屏 390×844 与短屏 390×640 可见，未发现横向溢出。只读页面，未更改账户资料；账号分类现有结构断言已跟随 Owner 路径更新，但未运行产品测试。
- 文件职责：`ui-settings-account/src/AccountProfileSettings.tsx` 与 `AccountSecuritySettings.tsx`（受控资料/安全表单视图）；`SettingsPage.tsx`（账户数据、草稿、校验与请求协调）；账号/设置包 README、全仓审计与本合同（Owner 和验收）。

### 2026-11-14 续批 UI-E-5：Agent Loop 预算表单归入原占位包

- 证据与入口：`scripts/package-responsibilities.mjs` 已将 `ui-settings-agent-loop` 注解为“Agent 循环预算设置界面”；迁移前目标目录只有不可加载占位，AI 设置页的“推理参数”组则实现执行模式、模型输出/超时/重试、子 Agent 委派、模型/工具预算及上下文压缩控制。
- 将该受控表单 UI 移入 `ui-settings-agent-loop` 并由 `ui-settings` 静态依赖；Settings 容器继续持有 `UserSettings.aiRuntime`、账户目录、更新回调和自动保存。运行上限、沙箱模式及默认值继续读取 `util-values/settings-contract` 与 `sandbox-contract` 唯一来源，不在展示包复制策略。
- 保留原字段、标题/说明、范围、输入类型、账户选项、默认值回退和更新载荷；不新增设置、存储、API、运行授权或 Agent Loop 执行逻辑。
- 验收：`ui-settings-agent-loop` 与设置包构建、Client `tsc --noEmit`、Web 构建、清单/lockfile 同步后 234 包 workspace Gate、差异检查，以及 `/settings?section=ai` 当前源码桌面与 390×844/390×640 实页通过；只读检查，没有修改设置。Vite 构建有既有 CSS 注释压缩警告。不新增或运行产品测试。
- 文件职责：`ui-settings-agent-loop/src/AgentLoopSettingsGroup.tsx`（Agent 运行参数布局与受控事件）；其包 manifest/README（静态 UI Owner 与来源边界）；`ui-settings/package.json` 与 `SettingsPage.tsx`（装配和既有设置更新）；现有责任注解、生成清单、占位审计、本合同（目录状态与验收）。

### 2026-11-14 续批 UI-FEEDBACK：填充已有消息反馈占位

- 证据：职责注解将 `packages/client/ui-message-feedback` 定为“消息反馈交互组件”；该目录当前是无 package manifest/源码/装配的上游占位，但 AI Work 已有消息反馈按钮、理由选择、详情输入和弹窗，入口在 `ui-chat`。
- 将反馈按钮/既有反馈状态展示、反馈理由选项、受控反馈对话框和仅反馈专属 CSS 移入 `ui-message-feedback`；`ui-chat` 继续持有会话/消息状态、加载态、错误恢复与 `submitAiMessageFeedback` 调用。持久化继续归 Session Owner，认证 REST 继续归 Connection，不复制记录或授权。
- 新包通过 workspace dependency 被 `ui-chat` 的动态聊天入口静态引用；不登记为独立 Cordis 能力，不新增路由、设置、Bundle/Profile 消费者或运行权限。删除此目录的 `PLACEHOLDER.md`，新增包 README/公开入口/依赖合同，并同步生成清单和锁文件。
- 验收：反馈 DOM、class、无障碍文本、忙碌/错误/取消/提交语义保持；新包和 `ui-chat` 构建、Client 类型检查、工作区 Gate、`git diff --check` 通过；不新增或运行产品测试。界面 detector 针对最终新包文件执行一次；不改变视觉样式。

### 2026-11-14 续批 UI-PLAN-B1：填充计划模式展示占位

- 证据：`package-responsibilities.mjs` 将 `ui-plan` 定为“计划模式和计划结果展示”；现有 `AiWorkChat` 在输入区内直接绘制计划模式状态横幅，并包含退出/批准后执行动作。
- 仅将已有横幅与视图 CSS 移入 `ui-plan`；计划状态从 Session 投影读取，切换和发送仍调用 `ui-chat` 的既有回调，模型执行限制与状态持久化仍归 Agent Loop/Session。新包作为 `ui-chat` 静态依赖加载，不独立注册路由或权限。
- 验收保持原 DOM、文案、CSS 选择器和按钮禁用/加载条件；新增 package README/公开入口/依赖合同并同步清单、类型路径和 lockfile；新包与 `ui-chat` 构建、Client 类型检查、工作区 Gate、差异检查通过，不新增/运行产品测试。

### 2026-11-14 续批 UI-WRITING-REVIEW：写作提案审阅视图归位

- 入口：`ui-chat/src/AiWorkChat.tsx` 读取 Writing Connection 提案并传给对话界面；作品/提案真实数据和事务由既有 Writing Owner 持有。
- 将提案对照弹窗、状态提示、操作/状态标签和专属 CSS 归入 `ui-writing/src/normal/WritingProposalReviewDialog.tsx`；`ui-chat` 继续掌握加载序列、忙碌/错误状态及关闭清理，并将应用/拒绝交给原 Connection API。视图包不请求、不写入、不复制 Writing 数据。
- 同步 `ui-writing` 公开导出/README，`ui-chat` 依赖、CSS 与 README，并更新本审计及全包清单。外观设置继续用共享 Appearance 令牌，不增加配置。
- 验收：保留弹窗目标容器、标题、宽度、键盘/遮罩/关闭保护、按钮状态和状态提示；受影响包构建、Client 类型检查、工作区 Gate 与差异检查通过，不新增或运行产品测试。样式已移入 Owner 包，当前源实页未重新验收，后续需验证桌面及窄/短容器。

### 2026-11-14 续批 UI-C-1：抽取画布项目与 React Flow 映射逻辑

- 入口与 Owner：`packages/client/ui-workspace/src/CanvasWorkspace.tsx` 是现有 Canvas 展示与编辑协调入口；项目格式与节点目录继续由原 Canvas/AI Video Owner 提供。
- 仅把 Canvas 项目/摘要与 React Flow 节点、连线互转、默认 UI 数据、素材/节点引用整理等纯映射函数收拢到本包 `src/canvas-workspace/project-model.ts`。网络请求、项目保存/版本冲突、生成、资产、编辑事件与页面 JSX 留在原有 Owner/入口；不改数据格式或持久化。
- 验收：保留节点字段清洗/边界、未知节点与连线原样保留、素材引用数、时间线/导演台/镜头引用清理等逻辑；不新增或运行产品测试，执行 UI Workspace 构建、Client 类型检查、工作区 Gate、差异检查和当前源码 Canvas 实页观察。无新增设置或数据写入。

### 2026-11-14 续批 UI-MODEL-SELECTION-B1：填充模型选择展示占位

- 证据：职责注解将 `ui-model-selection` 定为模型目录/能力参数展示；聊天协调入口当前内嵌推理力度控制、目录搜索/分页、账户/模型选项、键盘选项导航和 Settings 入口，且该包仍是空占位。
- 仅迁移 Popover 内部视图及组件专属 CSS。模型列表筛选数据仍来自 `ui-chat` 当前 Settings 目录投影；模型/推理设置写入仍由聊天层传入回调并调用认证 Settings API；Provider 能力格式化继续复用 `ui-settings-models`，不重复保存目录或权限。
- 新包由 `ui-chat` 静态依赖并随现有聊天动态模块加载，不单独登记模型设置页、路由或运行权限。保留现有 DOM、键盘/辅助功能、文案、选择和加载边界；README、workspace 清单、类型映射和 lockfile 同步，直接构建及 Client/Gate/差异检查通过，不新增/运行产品测试。

### 2026-11-14 续批 API-A-1：拆出 Connection HTTP 传输与 Writing API

- 入口：既有消费者继续从 `lfaa-client-connection/src/api.js` 导入；本批把同源认证请求、合并只读请求、二进制响应和会话失效处理拆到 `src/http-client.ts`，并把 Writing API 类型与端点拆到 `src/writing-api.ts`。
- 写作 API 仍沿用统一 HTTP Owner 的认证、Cookie、错误和请求合并语义；作品/章节/修订/提案事务由服务端 Writing Owner 持有，不复制数据、设置、持久化或权限规则。`api.ts` 继续重导出原公开符号，不改变消费者路径。
- 首批验证：Connection 包构建、Client 类型检查、工作区 Gate、`git diff --check` 通过；不新增或运行产品测试。后续继续按账户/模型、Session/Run、Workspace/Git、Minecraft/SteamCMD、文件/浏览器等现有边界拆分，并在每批按源码核对导出兼容。
- 2026-11-14 续批 API-A-2：Provider 连接探测、模型测试及账户凭据/模型/推理选择端点归 `src/ai-account-api.ts`；类型继续复用 Connection facade 的账户合同，所有请求继续使用统一 `http-client.ts`。既有 `/settings/ai/*` 路径与 API 导出路径不变；Connection 不引入凭据缓存或另一套账户/模型设置存储。完成后继续执行本合同 API-A-1 的包构建、Client 类型检查、workspace Gate 和差异检查。
- 2026-11-14 续批 API-A-3：Workspace 项目目录/来源、知识库来源及 Git/文件请求归 `src/workspace-api.ts`；`api.ts` 继续重导出。保留认证、`appId`/`sourceId`、AbortSignal、哈希、读取上限及请求路径；Connection 不接触本机磁盘，也不新增缓存或写入规则。Connection 构建、Client 类型检查、232 包 workspace Gate 与 `git diff --check` 均通过；不新增或运行产品测试。
- 2026-11-14 续批 API-A-4：浏览器会话/标签/凭据类型与认证端点归 `src/browser-api.ts`；`api.ts` 保留所有稳定导出。实时画面 SSE 继续保留独立响应处理、当前登录代次核对、AbortSignal 取消及既有帧/缓冲上限；普通请求复用 `http-client.ts`。不复制密码/联系信息或浏览器历史，也不改浏览器权限和安全策略。
- 2026-11-14 续批 API-A-5：文件节点、系统文件操作、传输、任务和审计类型/端点归 `src/file-manager-api.ts`；`api.ts` 保持原导出兼容，SteamCMD 与 Minecraft 共用的文件节点类型通过模块导入。认证请求、路径/权限校验、数据与节点操作仍在现有 Owner，文件传输大小继续复用共享上限；未改端点、参数、哈希或字节处理。
- 2026-11-14 续批 API-A-6：Minecraft DTO/端点、SteamCMD DTO/端点和 Connectivity 路由/账户连接端点分别归 `src/minecraft-api.ts`、`src/steamcmd-api.ts`、`src/connectivity-api.ts`；对外仍由 `api.ts` 全量重导出。只移动 Connection 适配，不迁领域执行逻辑、持久化或权限；Minecraft 专用 Workflow 适配暂留通用 Workflow 区域以避免反向循环依赖。
- 2026-11-14 续批 API-A-7：角色、登录/登出、Passkey、受信任联系人与账户恢复、管理员用户类型/API 归 `src/identity-api.ts`；Passkey 凭据创建仍使用原 WebAuthn Browser 流程，登录/登出仍先更新统一认证代次再调用原请求。`loadCurrentUser()` 的类型化 Host Remote 与旧 Host 404 只读兼容仍留聚合入口；未在 Client 保存身份凭据或账户副本。
- 2026-11-14 续批 API-A-8：AI 漫剧 DTO/媒体/生成端点、App Workflow 通用合同、GitHub Integration、Daemon 凭据操作分别归 `src/ai-video-api.ts`、`src/workflow-api.ts`、`src/github-api.ts`、`src/daemon-connection-api.ts`；`isRecord` 响应守卫归包内 `value-guards.ts` 供漫剧与 Minecraft Workflow 适配共用。保留统一请求、错误映射、下载 Blob 与现有 DTO，不更改服务端数据/授权/任务规则。
- 2026-11-14 续批 API-A-9：Canvas 项目/素材/生成 DTO 与端点、Agent Git 仓库/固定操作端点、Terminal Controller DTO/会话端点分别归 `src/canvas-api.ts`、`src/agent-git-api.ts`、`src/terminal-api.ts`；保持 `/api` 下载 URL、原认证请求与字节/AbortSignal 语义。工作区 Git 共用类型继续由兼容 API 合同引用；Host 上的权限、文件、凭据及进程 Owner 不变。
- 2026-11-14 续批 API-A-10：账户偏好、Settings 读写、会话记忆、AI 账户使用控制、账户快照/导入和外观背景请求及 DTO 归 `src/account-settings-api.ts`；偏好、设置、记忆、备份/恢复事务仍由原 Settings/Memory Owner 权威持有，Client 只沿认证端点回传数据，不额外缓存账户副本。
- 2026-11-14 续批 API-A-11：Session、消息、反馈、分支与上下文/关联 DTO、读取校验和对应端点归 `src/ai-session-api.ts`；`api.ts` 继续按原公开导入兼容导出 DTO/函数，内部响应校验不扩大为聚合 API。AI Run/SSE 传输和权限决定仍保留原执行/Permission Owner；消息存储与分支事务仍由 Session Owner 持有。
- 2026-11-14 续批 API-A-12：Data Directory 与 Project Storage Locations 设置/内容迁移 DTO 和端点归 `src/storage-location-api.ts`；桌面 `Window.lfaaDesktop` 全局 Host 合同、Electron/Tauri API 与本机目录选择归 `src/desktop-api.ts`。仅移动 Client 传输与宿主桥接适配；设置值、目录验证、复制/采用/归档事务和磁盘操作均仍归原 Settings/Workspace/Host Owner。
- 2026-11-14 续批 API-A-13：AI Provider/账户目录和 Claude 外部凭据接口归 `ai-account-api.ts`；插件扩展/运行/安装流归 `plugin-api.ts`，能力目录/来源检查归 `capability-api.ts`，本地模型目录/下载生命周期归 `local-model-api.ts`。安装 NDJSON 保留原请求代次、认证错误、帧上限、reader cancel 和 pending-read 清理；密钥不持久化于 Client。
- 2026-11-14 续批 API-A-14：AI 审批/Permission Grant API 归 `ai-permission-api.ts`；AI Run 停止/暂停/继续、追加输入与回答问题端点归 `ai-run-control-api.ts`。只归档 Connection 请求适配；审批决定、任务执行、状态及持久化仍由 Permission/Agent Loop/Session Owner 负责。
- 2026-11-14 续批 API-A-15：Minecraft Workflow 旧 DTO 投影归 `minecraft-workflow-api.ts`，Typert Remote 通用传输归 `typert-client.ts` 并让 `loadCurrentUser()` 回到 Identity Owner；AI Run SSE 重连与事件转发归 `ai-run-stream-api.ts`。Host Task、AI Office、附件、健康状态、错误兜底按职责移至独立 API 模块；账户、插件、能力、权限、模型与 Workspace/Git DTO 归领域 type 文件，模块直接导入 Owner 类型，不再从聚合入口反向引用。认证、流协议、Host 执行/持久化和设置合同保持原样。

- 2026-11-14 UI-C-1 实页观察：通过当前源码工作台的“当前项目画布”入口实际打开 `/apps/workspace/canvas`，画布工具栏、项目选择器与当前项目名称可见；该项目没有画布节点，故只确认路由和页面能正常渲染，未创建/移动节点或素材。内置浏览器无法设置窄/短视口；构建及类型检查通过不替代这些视口和编辑交互验收。
- 2026-11-14 API-A 实施与验证：`api.ts` 从 3,795 行盘点基线降至 53 行兼容导出；HTTP/二进制、AI Provider/账户/设置/Session/Permission/Run/SSE、Workspace/Git、浏览器、文件、Minecraft/Workflow、SteamCMD、Identity/Typert、AI 漫剧、GitHub、Daemon、Canvas、Terminal、目录迁移、桌面 Host、插件/能力、本地模型、Host Task、AI Office、附件与健康状态均按领域归入独立模块，公开 `api.js` 导入路径保持不变。各领域 DTO 也从聚合入口移入 type 模块；认证、错误、AbortSignal、哈希/读取上限、SSE 帧和重连行为保持原合同。Connection 包构建、Client `tsc --noEmit`、233 包 workspace Gate 与 `git diff --check` 通过。未新增或运行产品测试；没有发送浏览器操作、创建凭据或修改设置/会话。全包 388 目录职责核验和其余大文件批次仍继续。

### 2026-11-14 续批 UI-TRAJECTORY：公开执行轨迹归位

- 证据：职责注解将 `packages/client/ui-trajectory` 定为公开执行轨迹展示，但它原来是空占位；`ui-chat` 实际拥有 `response-timeline.ts`、`activity-duration.ts`、`activity-clock.ts`、轨迹 JSX 和工具组/状态样式。
- 将投影/耗时/共享时钟和 `AiExecutionTrajectory` 视图及专属轨迹 CSS 移入该包；`AiWorkResponse` 继续在 `ui-chat` 管理单条回复状态、AI Markdown、活动详情/问题/审批插槽和文件变更。保留旧源码模块兼容转发，不改变公开聊天入口。
- 聊天仍持有真实 Session/Run、活动/权限与问题/审批回调；不展示隐藏推理，不新增设置、请求、存储、权限或 Cordis 服务。样式继续使用现有 Appearance 与 reduced-motion 规则。
- `ui-trajectory` 和 `ui-chat` 包构建、Client 类型检查、workspace Gate 与差异检查通过；未新增或运行产品测试。当前源码 `/work` 桌面实页展开一条已有会话回复及包含五项活动的工具组，渲染正常；没有发送消息或写入会话。窄/短视口无法在内置浏览器设置，未验收。

### 2026-11-14 续批 UI-CONVERSATION：会话锚点与滚动展示归位

- 证据：职责注解将 `packages/client/ui-conversation` 定为对话容器/消息交互 UI，但它原来是空占位；`ui-chat` 有真实的 `ConversationAnchorRail`、问题/回复预览、锚点轨道投影与交互算法、滚动跟随、视口测量及观察器清理。
- 将 `ConversationAnchorRail.tsx`、`conversation-anchor-preview.ts`、`conversation-scroll.ts` 和锚点专属/reduced-motion CSS 迁入 `ui-conversation`。`ui-chat` 仍持有当前会话消息、跳转/发送/Run、Session 数据与账户滚动恢复偏好；通过同名兼容转发模块保留旧源码入口与已有引用。
- 保留原 DOM、类名、无障碍标签、滚动阈值、锚点位置算法和资源清理；不改消息、设置或数据。无新增 Cordis 服务/运行权限。
- `ui-conversation` 和 `ui-chat` 构建、Client 类型检查、233 包 Gate、`git diff --check` 通过；未新增或运行产品测试。当前源码 `/work` 桌面有四个真实用户锚点，点击第二项跳至“你能生图吗？”并显示真实回复预览；只改变页面滚动位置，没有写入会话。窄/短视口和触屏未验，内置浏览器不能设置相关视口。
## 实施与验证记录

### 2026-11-14 续批 PKG-INDEX-1：占位包索引与工作区清单同步

- 证据：`docs/development/placeholder-packages.md` 手工索引仍写 169 个目录，且把已实现的 `ui-settings-agent-loop` 继续标为没有 `package.json`；`docs/harness-packages.json` 才是当前包状态的生成来源。索引没有被工作区 Gate 校验，新增/填充包后容易继续过期。
- 由 `scripts/check-workspace.mjs --write` 从同一 `current.packages` 清单生成占位索引；普通 Gate 对照生成内容并在索引过期时失败。保持路径、总数、不可执行边界来自唯一目录扫描，不手工维护第二份包状态。
- 验收：同步后索引条目与生成清单中 `status=placeholder` 集合一一对应、数量一致；`pnpm run sync:workspace`、`node scripts/check-workspace.mjs` 与 `git diff --check` 通过。不修改产品代码/用户数据，不运行产品测试。

### 2026-11-14 续批 UI-B-3：输入触发菜单归入 ui-input-trigger

- 证据：`scripts/package-responsibilities.mjs` 将 `ui-input-trigger` 定义为输入触发器和快捷交互组件；`AiWorkChat.tsx` 原先同时拥有 `/` 命令/`@` 关联菜单视图、候选状态投影、草稿与键盘协调，`ai-work-chat.css` 持有菜单全部专属样式，目标包为空占位。
- 将受控菜单视图、窄属性类型与菜单专属 CSS 归入 `packages/client/ui-input-trigger` 并由 `ui-chat` 静态依赖。聊天层继续持有输入触发解析、应用/能力候选投影、活动索引/键盘导航、草稿插入、模型选择动作、关联 API/Session 写入和候选高度生命周期。
- 保留原 DOM、菜单顺序/文案、ARIA ID/角色、disabled/selected/associated 状态、鼠标按下焦点语义、Wallpaper Engine 浮层外观与 520px 样式；不新增设置、存储、API、权限或 Cordis 能力，不改变 Send/Run 流程。
- 验收：输入菜单包与 `ui-chat` 构建、Client `tsc --noEmit`、Web 构建、235 包 workspace/占位索引同步 Gate 和差异检查通过；Impeccable detector 返回聊天样式中的三条规则告警（当时未修改的侧边边框及图标三角形边框）。当前源码 `/work` 路由和聊天输入区在 1280×720、390×844、390×640 可见且无页面横向溢出；没有输入触发词，未实际展开或操作菜单。只读验收，不发送/保存消息，不新增或运行产品测试。
- 文件职责：`ui-input-trigger/src/ComposerTriggerMenu.tsx` 与 `composer-trigger-menu.css`（输入触发候选菜单视图/视觉）；`ui-input-trigger/package.json`/README/入口及 `ui-chat/package.json`（包元数据、职责与消费者依赖）；`AiWorkChat.tsx`（菜单状态/候选/行为协调）；`ai-work-chat.css`（其余聊天外观）；工作区清单生成器、占位索引、审计和本合同（唯一目录状态与验收记录）。

### 2026-11-14 续批 UI-B-4：Composer 附件界面归入 ui-attachment

- 证据：`scripts/package-responsibilities.mjs` 将 `ui-attachment` 定义为附件选择、预览与状态界面；`AiWorkChat.tsx` 仍内嵌附件选择按钮/文件输入和待发送附件缩略图，专属预览 CSS 也留在聊天样式中，而目标包仍为空占位。
- 将受控附件选择控件和待发送附件列表视图及专属 CSS 归入 `packages/client/ui-attachment`，由 `ui-chat` 静态依赖。`ui-chat` 保留剪贴板导入接线、类型/大小上限、字节编码、Connection 上传、错误/忙碌状态源、附件消费及消息/跟进 Run 限制。
- 保持既有接受类型、最多 4 个、单文件 8 MiB 上限、提示/错误文字、无障碍标签、缩略图 URL 与移除行为；不新增设置、持久化、API、权限或运行时服务。
- 验收：`ui-attachment`、`ui-chat` 包构建，Client `tsc --noEmit`、Web 构建、`pnpm run sync:workspace` 和 236 包 Gate 通过；Impeccable detector 对聊天样式返回三条既有边框写法告警，本批未改动这些规则。当前源码 `/work` 实页未通过：Vite 可服务，但 LFAA Host 的 Browser Dock 等待接口返回 503，Client 根持续显示空 `loading-page`，因此附件控件的渲染与 1280×720/390×844/390×640 实页视口未能验收。没有选择或上传附件、发送消息或更改设置；未新增或运行产品测试。临时 Host/Vite 服务已停止。
- 文件职责：`ui-attachment/src/ComposerAttachmentControl.tsx`（文件选择按钮与输入状态视图）、`PendingAttachmentList.tsx`/`attachment.css`（待发送附件投影、移除动作及专属样式）、`index.ts`/`package.json`/README（包入口和职责合同）；`ui-chat/src/AiWorkChat.tsx` 继续持有文件校验/编码/上传、错误/忙碌状态和发送边界，并提供预览 URL；`ui-chat/src/ai-work-chat.css` 仅保留聊天 Composer 共享样式，`ui-chat/package.json` 与 README 记录静态消费者边界；删除 `ui-attachment/PLACEHOLDER.md` 并同步生成清单/索引。

### 2026-11-14 续批 UI-B-5：附件上传状态与读取逻辑提取到聊天 Hook

- 证据：附件视觉已经归入 `ui-attachment`，但 `AiWorkChat.tsx` 仍内嵌附件选择过滤、上限校验、字节转 Base64、Connection 上传、错误/忙碌及待发送列表状态，导致 UI 协调入口继续持有文件处理逻辑。
- 将上述 Hook 状态和选择上传流程移入 `packages/client/ui-chat/src/hooks/useComposerAttachments.ts`。聊天协调层只接收 Hook 结果、保留粘贴事件接线、在发送前消费附件并构造既有 API payload；预览 URL 与选择/移除视图分别归 UI/Connection 边界。
- 保留 MIME 白名单、4 个附件、单个 8 MiB 限制、Base64 分块算法、既有错误文案、上传时序与消息附件引用；不新增设置、持久化、API、权限或 Cordis 服务。
- 验收：`ui-chat` 构建、Client `tsc --noEmit`、Web 构建、236 包 workspace Gate 与差异检查通过；Web 构建仍报告已有 CSS 注释压缩告警与大 chunk 提示。不新增或运行产品测试。无样式/DOM 改动，不做新一轮页面验收；当前源码页加载阻塞见 UI-B-4。
- 文件职责：`ui-chat/src/hooks/useComposerAttachments.ts`（附件过滤/上限反馈、Base64 上传、错误/忙碌与待发送状态、移除/消费接口）；`AiWorkChat.tsx`（粘贴事件、发送闸门和 payload 组合）；其余 UI/数据边界见 UI-B-4。

- 状态：`ApplicationWorkspace` 拆分、模型上下文定位/格式模块化、压缩包反向依赖修复已完成；整个 `packages/` 的其余目录审计和迁移仍按本合同逐批处理，本合同继续开放。
- 当前源码基线：2026-11-14，仓库 `E:\lfaa1\lfaa`，分支 `main`；续作时工作区已有未提交的 `ApplicationWorkspace` 拆分与相关合同/README 改动，本轮保留并完成接线，没有清理其余工作树内容。
- 设置/数据/权限：本批不新增或写入设置、用户数据、凭据或权限；使用现有 Settings/Client Store 外观和偏好映射，行为保持不变。
- 实施：将 `ApplicationSidebar` 组件从主组合文件移入 `application-workspace/components/ApplicationSidebar.tsx`；再将会话/项目目录计算、分区偏好、滚动恢复、菜单与移动端定时关闭、改名状态及其视图独立归入 `ApplicationSidebarSessions.tsx`；内部属性合同归 `sidebar-types.ts`。按本次改动前的 `HEAD` 与最终文件逐行核对，`ApplicationWorkspace.tsx` 从 2,854 行减至 2,406 行，下降 448 行。没有改变公开包导出、DOM/CSS、设置、路由、Owner 调用或用户可见功能。
- 工程验证：续拆后 `pnpm --filter lfaa-client-ui-workspace run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run check:workspace`（226 包）和 `git diff --check` 均通过；未新增或运行产品测试。尝试对拆分组件运行 Impeccable `detect --json`，当前 shell 找不到 `impeccable` 命令，因此该项未能验证。
- 浏览器观察：用当前 checkout 的 Vite 源码访问 `/work`，在 1364×875 桌面视口实际显示会话/项目侧栏、中心 AI Work、右侧工具页签及操作控制，控制端显示已连接。没有操作会写入用户数据或布局偏好的交互。ChatGPT 内置浏览器当前不提供可调视口能力，窄屏/短屏布局与交互未验；临时 5173 源码服务已停止。
- 设置/数据/权限：无新增或写入；继续使用现有 `general.navigationLayout`、Appearance 与 Client Store 偏好，未改 Settings、Session、Workspace Project、Notification 或 Permission Owner。
- 后续候选路线：完成本批后，按计划处理 `AiWorkChat`、`CanvasWorkspace`、`Workbench`；之后逐项核对 `SettingsPage`、Connection API、SQLite、Daemon、Agent Loop 与 Settings/Session 服务的 Owner、调用方和回归边界，并分别登记任务合同。
- 2026-11-14 本批续拆：将主入口从 2,854 行减至当前 534 行。`application-workspace/hooks/useWorkspaceSessionsAndProjects.ts` 持有会话/项目加载与选择；`useWorkspaceCapabilities.ts` 持有扩展/技能目录加载；`useWorkbenchChrome.ts` 持有尺寸、快捷键、Chrome 持久化和响应式行为；`useWorkspaceUtilityTabs.ts` 持有浏览器、工具页签与相关交互；`useWritingWorkspace.ts`、`useCanvasWorkspaceContext.ts`、`useMinecraftWorkspaceContext.ts`、`useGitWorkspace.ts` 分别持有对应领域状态及订阅清理。`components/ApplicationChatSurface.tsx`、`ApplicationCenterWorkspace.tsx`、`ApplicationContextPanel.tsx`、`ApplicationGitSummary.tsx`、`ApplicationWorkbenchTabs.tsx`、`ApplicationSidebar.tsx`、`ApplicationSidebarSessions.tsx` 与 `PanelControl.tsx` 按视图职责承载渲染；`workspace-lazy-modules.ts` 集中包内懒加载模块；`sidebar-types.ts` 维护侧栏内部属性。`ApplicationWorkspace.tsx` 负责在这些 Owner 边界之间组装左侧、中心、右侧和底部区域；不改变公开包导出。新增模块和组合入口已补职责头注释。
- 续拆验证：Client/Host 类型检查、工作区 Gate（226 包）、UI Workspace、Agent Loop、Compaction Basic、Compaction Contract、Token Meter 五个包构建及 `git diff --check` 均通过。先前并行启动多条 `pnpm` 命令触发相互竞争的依赖链接更新，出现一次 `EBUSY` 和一次 `EPERM`；随后改为直接串行运行 Node 检查/构建，全部通过，未改动额外源码。未新增或运行产品测试。
- 当前源码实页：从本仓库启动临时 Vite 源码服务，在 ChatGPT 内置浏览器打开 `http://127.0.0.1:5173/work`，1280×720 桌面截图显示已登录工作区、会话/项目侧栏、聊天中心及工具栏，控制端显示在线。仅观察页面，未点击会写入用户数据或布局偏好的操作。窄屏、短屏及键盘交互未测；Vite 临时服务已停止，原有控制端进程未重启。
- 包归属批次：模型上下文仍按 `core/system-prompt`、`core/agent-loop`、`llm/llm`、`prompt/*` 与 Session/Memory/Workspace/Git/Writing 数据 Owner 分工，`packages/context/*` 六个目录是无源码/无装配的上下文来源占位，未证实可替代现有 Owner。修复 `compaction-basic` 反向依赖 `agent-loop`：Token 估算改依赖 `lfaa-token-meter`，压缩协议与不变量归 `lfaa-compaction`，同步 package.json、锁文件、生成清单和两个包 README。没有新增设置；容量继续取已选模型目录或现有 `aiRuntime.contextWindowTokens`。
- 2026-11-14 UI-B 归位续批：把 `AiWorkMessageRow`、`ConversationAnchorRail` 与其内部消息类型拆到 `ui-chat/src/components/`；把反馈视图和 CSS、计划模式横幅和 CSS 分别归入已声明的 `ui-message-feedback`、`ui-plan`；把模型/推理 Popover 视图及专属 CSS 归入 `ui-model-selection/src/`；把待审批/审批记录和待回答/历史回答视图与专属 CSS 分别归入 `ui-approval`、`ui-user-questions`；再把全屏语音会话的纯展示组件归入 `ui-chat/src/components/AiWorkVoiceSurface.tsx`。聊天层继续拥有 Session/Run/API/权限协调、目录投影和设置写入回调、语音会话状态和浏览器语音控制；新 UI 包仅通过静态依赖消费，不独立登记 Cordis 运行能力。
- UI-B 本轮验证：`ui-model-selection`、`ui-approval`、`ui-user-questions`、`ui-writing`、`ui-chat` 包构建通过；Client `tsc --noEmit`、231 包 `check-workspace`、`git diff --check` 通过；此前 Impeccable detector 对模型选择、审批卡和澄清问题视图返回 `[]`。新语音/写作审阅视图的 detector 未运行成功，本机 shell 未找到 `impeccable` 命令。全包清单生成后重复 Gate 通过。本轮未新增或运行产品测试。工作区 UI 改动未新增/写入设置、用户数据、凭据或权限；实页范围见下。
- UI 实页范围：本次从当前源码启动正式 Web 前端并在 ChatGPT 内置浏览器打开 `/work`，1280×720 下查看现有写作会话和消息流、打开新拆出的模型选择/推理面板；未触发会写入操作。当前会话没有待审阅写作提案，因此 `WritingProposalReviewDialog` 未在真实数据下展开；本轮也没有模型设置保存、审批、澄清、计划、反馈及语音模式交互验收。内置浏览器无法调节窄/短视口，窄屏、短屏、键盘与桌面宿主验收仍未完成；此前的桌面观察不能代替本轮新视图检查。临时 5173 前端已停止，已有 3000 控制端进程未重启或中断。
- 全包进度：388 个两级目录均有盘点行；当前 233 个 workspace 包标为 implemented、155 个为 placeholder。剩余占位和实现包仍需逐项沿源码核验 Owner、调用方与装配，不能把清单状态当作运行验收或因目录为空就全部填充；长文件、Connection API 等问题继续按本合同批次处理，不能据已完成批次关闭总目标。
