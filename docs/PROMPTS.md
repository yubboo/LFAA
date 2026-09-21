# v0.1.11 Prompt / Requirement Note — Project + Session Persistence / Runtime Event Isolation

- **基线 / 目标：** v0.1.10 → v0.1.11；任务 #22.17；状态 pending-user-acceptance；AI 验证 pass；用户验收 pending。
- **用户需求：** 工作模式不得再触发聊天表现；项目/会话/置顶必须真实交互；刷新恢复全部状态；项目支持创建/切换/展开/置顶；思考过程展示实时阶段和工具；生成递增版本包。
- **架构约束：** 沿用 TS + Rust；Chat/Work 共用 Agent Core，但 Project、Session、mode、Runtime Event 路由明确分层；不引入 C#。
- **验收：** Project/Session 真持久化、Host 失败可见、sessionId 事件隔离、Chat/Work 中央 Surface 分流、Run phase/activity 可展开、全量门禁与独立浏览器刷新回归通过。

# v0.1.10 Prompt / Requirement Note — Session Persistence / Stable Navigation / Dual Mode Switch

- **基线 / 目标：** v0.1.9 → v0.1.10；任务 #22.16；状态 pending-user-acceptance；AI 验证 pass；用户验收 pending。
- **用户需求：** 修正 Timeline 布局，保留可展开真实 activity；F5 后对话/工作状态不能消失；左栏最近与菜单必须真实可用；左栏不再随 mode 变化；左上角与中央顶部都提供 mode switch，并控制同一核心状态。
- **架构约束：** Chat/Work/Manual 继续共用一个 Agent Core 和一个 Session Domain；长期会话不得用 localStorage 假持久化；模式变化只改变中央 Interaction Surface。
- **验收：** active/recent Session 可持久化恢复；最近列表真实可点击；Work/Manual Canvas 按 Session 隔离恢复；Run Timeline 紧凑可展开；合同测试/preflight/fresh extract 通过。
- **AI 验证：** Node 合同 193/193、Config System 42/42、27 个 Node workspace / 1 个 Native crate、10/10 tsconfig、777-entry Unicode ZIP fresh extract 静态门禁 PASS；真实浏览器交互仍待用户验收。

# v0.1.9 Prompt / Requirement Note — 实时 Agent Run Timeline / Streaming Activity

- **基线 / 目标：** v0.1.8 → v0.1.9；任务 #22.15；状态 pending-user-acceptance；AI 验证 pass；用户验收 pending。
- **用户需求：** 按用户上传的 DeepSeek Harness 源码来做运行过程体验；用户提交任务后立即显示正在思考/已处理时间，可展开查看 Agent 真正做了什么，最终结果必须动态真实流式输出，不能静默后一次性给答案。
- **核心边界：** Runtime Event 是唯一真值；允许显示官方 reasoning summary、plan、tool/command/file/search/MCP activity；禁止伪造步骤，禁止泄露原始隐藏 chain-of-thought。
- **架构约束：** Chat/Work 继续共用一个 Agent Core/Session/Runtime；Manual 不启动模型；DeepSeek Harness 只作为事件组织参考，不复制其产品视觉或拆出第二套 Runtime。
- **验收：** Codex/Provider 原生事件能统一投影、elapsed 真计时、过程可展开、Assistant delta 真流式、完整合同测试/preflight/fresh extract 通过。
- **AI 验证：** Node 合同 190/190、Config System 42/42、Timeline/Codex/SSE 聚焦 16/16、10/10 tsconfig、759-entry Unicode ZIP fresh extract 静态 preflight PASS；真实 Provider 视觉/节奏由用户验收。

# v0.1.8 Prompt / Requirement Note — ChatGPT 套餐 OAuth 完成态竞态修复

- **基线 / 目标：** v0.1.7 → v0.1.8；任务 #22.14；状态 pending-user-acceptance；AI 验证 pass；用户验收 pending。
- **实机回归：** OpenAI 官方页面显示登录成功并提示可关闭，但关闭窗口后 LFAA 误报“登录已取消”。
- **根因：** Client 把 `popup.closed` 当认证失败真值，抢在官方 `account/login/completed` / `account/updated` / `account/read` 前结束流程。
- **要求：** 浏览器窗口只属于交互层；认证成功/失败必须以 OpenAI 官方 App Server 账户状态为准。关闭成功页后继续短期等待，官方已成功则保存套餐账户；仅官方失败、显式取消或超时才失败。
- **禁止：** 读取 OAuth Token、把窗口关闭等同 logout/cancel、为了修复而改 Chat/Work/Manual 单核模式或 Provider 额度规则。

# v0.1.7 Prompt / Requirement Note — Provider 官方登录、保存响应、Usage 终态与真实流式回复

- **基线 / 目标：** v0.1.6 → v0.1.7；任务 #22.13；状态 pending-user-acceptance；AI 验证 pass；用户验收 pending。
- **实机回归：** ChatGPT 套餐仍出现官方账户服务退出；左上角 Chat/Work/Manual 模式菜单被 Pane 裁切；API 测试成功后保存响应过慢；官方余额/额度长期停在“正在读取”；API Provider 回答仍一次性出现。
- **核心要求：** 不改变 Chat/Work 同一 Agent Core 与 Manual 设计；ChatGPT 套餐必须是 OpenAI 官方登录体验，禁止要求用户安装全局 Codex CLI；Provider 支持官方流式协议时必须真实流式。
- **实现：** Windows 按需准备 OpenAI 官方 App Server 独立资产并校验 SHA-256；Probe/Save 复用短期 Host Verified Probe；Usage 拆成 loading/ready/error + timeout；OpenAI Responses/Chat Completions SSE 统一映射 `assistant.delta`；修复左 Pane overflow/Popover layer。
- **禁止：** 伪造余额、把 Usage 失败当模型不可用、把 Chat/Work 分成两套 Runtime、读取/保存 ChatGPT OAuth Token、恢复全局 Codex CLI 前置。

# v0.1.6 Prompt / Requirement Note — 单一 Agent Core / Chat·Work·Manual 三模式

- **基线 / 目标：** v0.1.4 能力基线 → v0.1.6；任务 #22.12；状态 pending-user-acceptance；AI 验证 pass；用户验收 pending。v0.1.5 为错误产品方向，不作为开发基线。
- **核心要求：** Chat Agent 与 Work Agent 能力、智力、性能、工具、权限、自动化质量和最终交付完全一致，只允许表现层/人工干预方式不同。Chat 用对话/插话；Work 用无限画布人工编辑 + 对话继续。
- **Manual：** 新增完全手动模式；无模型也能进入，复用无限画布和真实 Terminal/Tool 基础设施；禁止创建 Agent Run 或伪造自动化结果。
- **Provider 原则：** 厂商官方免费/套餐/API/Coding Plan 的认证、Runtime 与 Entitlement 原样映射；LFAA 不把官方免费能力改成自有额度，也不伪造官方未提供的 quota。
- **ChatGPT 套餐特殊边界：** 产品只呈现 OpenAI 官方套餐登录；LFAA 可在自身 Runtime Home 按需托管 OpenAI 官方 App Server daemon，但禁止要求用户全局安装 Codex CLI/PATH，也禁止读取官方 OAuth/Token 文件。
- **实现约束：** 一个 `AgentRunRequest`、一个 Session Controller、一个 Runtime Host；Work 的用户画布编辑通过 `workspaceContext` 回到同一 Agent Core；运行中干预统一走 `interveneRun`。

# v0.1.4 Prompt / Requirement Note — 官方余额额度与 Chat/Work 模式边界

- **基线 / 目标：** 用户提供 v0.1.3 → v0.1.4；任务 #22.11；状态 pending-user-acceptance；AI 验证 pass；用户验收 pending。
- **需求：** 所有余额/额度必须来自官方真实数据；ChatGPT Chat 与 Codex/Work 用量分开；Chat 简单任务轻量执行、困难任务后续可自动升级 Work；Work 面向完整开发；切换 Work 后左侧菜单变为工作区相关导航。
- **实现边界：** 本版落官方 Usage/Quota 事实链与 Chat/Work 导航；Chat 自动升级和完整 Run Timeline 继续由 Runtime Event/Router 后续实现，禁止 UI 假装完成。

# v0.1.3 Prompt / Requirement Note — 全量质量门禁与 Codex 取消竞态修复

- **用户要求：** 修复 v0.1.2 全仓复查中复现的三个问题。
- **基线 / 目标：** v0.1.2 → v0.1.3；任务 #22.10；状态 pending-user-acceptance；AI 验证 pass；用户验收 pending。
- **允许修改：** Web Bundle 的可选端口传参、Node source runtime 测试的真实 Host importer、Codex Text Runtime 的取消 Promise 生命周期及其 Fake Client 行为测试；版本元数据、当前说明文档与发布账本同步更新。
- **禁止修改：** Provider/Secret/Plugin/Terminal/Workspace 产品行为、UI 视觉、Codex OAuth 存储边界、read-only 审批策略；不新增 package 或依赖。
- **验收：** `pnpm run quality:full`、`pnpm run release:rust`、真实 Host Bundle Node source import、Codex 延迟 `turn/start` 取消回归均通过；Web 开发入口可启动；归档后 fresh extract 预检通过。状态最终为 pending-user-acceptance，用户验收前不得 delivered。

# v0.1.2 Prompt / Requirement Note — ChatGPT/Codex 套餐 Text Runtime

- **用户问题：** 模型已经通过 ChatGPT/Codex 套餐配置完成，但发送消息无法得到模型回复。
- **确认：** 配置/登录/model-list 已完成，缺的是套餐账户的真实 thread/turn 执行链。
- **要求：** 继续沿 Harness 架构实现；业务留在 `packages/`；不破坏 API Key Runtime、UI、Plugin、Secret、Terminal；全部当前文档同步。
- **安全边界：** 不读取 Codex OAuth Token；审批 UI 未接入前只开放 read-only Text Runtime。
- **版本：** v0.1.2；**状态：** pending-user-acceptance；**AI：** pass；**用户验收：** pending。

# v0.1.1 Prompt / Requirement Note — TSConfig 根配置继承修复

- **用户纠正：** 不要把业务源码 alias 规则与工程配置继承混为一谈。业务源码跨 package 继续使用 `@lfaa/*`；`tsconfig extends` 可按 DeepSeek Harness 的 Monorepo 方式相对继承根级配置。
- **实机问题：** Vite dependency scan 报 `Failed to load tsconfig '../../packages/tsconfig.base.json'`。
- **根因：** capability-family 迁移后两层 package 的 tsconfig 仍沿用旧单层 package 的 `../../tsconfig.base.json`。
- **修复要求：** 修复全部同类 tsconfig；新增 client base；清理无运行时支持的 `@/*` 私有 alias；新增可执行 Gate，防止回归。
- **版本：** v0.1.1；**状态：** pending-user-acceptance；**AI：** pass；**用户验收：** pending。

# v0.1.0 Prompt / Requirement Note — Sync / 依赖健康 / 版本进位修复

> **文档属性：历史需求账本。** 当前实现仍以代码、`ARCHITECTURE.md`、`DEVELOPMENT.md` 为主。
> **版本纠正：** `v0.0.99` 后下一合法版本为 `v0.1.0`；此前 AI 生成的 `v0.0.100` / `v0.0.101` 是误标构建，其需求与实现统一归并到本版本。

本轮合并三个修复合同：

1. 修复退役 workspace 仅剩 `node_modules` 等缓存时 Sync 无法清理、`current-fact` 误报旧 Owner 回流的问题；
2. 修复菜单 1【按需依赖】无法真实识别 capability-family 架构中新 workspace / 新依赖，而菜单 2【启动 Web】又使用另一套旧硬编码依赖判断的问题；
3. 把版本进位规则升级为机器 Gate：每个版本位只允许 `0-99`，`0.0.99` 的下一版本必须是 `0.1.0`。

# v0.0.99 Prompt / Requirement Note — Harness 化重构

> **文档属性：历史需求账本。** 当前架构必须以代码、`ARCHITECTURE.md`、`DEVELOPMENT.md` 为主；本文件旧 Prompt 中的旧路径不能作为当前实现要求。

本轮核心需求：以用户提供的 LFAA v0.0.98 与 DeepSeek Harness 源码为依据，把 LFAA 往 packages-first Harness 架构迁移；删除源码仓库 `.lfaa/`；业务全部归 `packages/`；`apps/web` 像 DeepSeek Harness 一样变成薄入口；不得破坏已完成的 UI、Chat/Work、Provider、Plugin、Secret、Terminal 与 Windows 工具；全部当前文档同步更新，新文档事实优先，旧记录仅作历史参考。

# LFAA 开发 Prompt 时间线

> 这是唯一 Prompt 记录文件。新任务不再创建独立 Prompt Markdown；在本文件顶部的“当前任务”区域新增 `#编号 + 功能名称` 条目。
> 历史记录只追加、不删除；任务完成后只修改状态，不移动文件。

## 开发合同生命周期

```text
用户需求
→ 分配 #NN.x 编号 + 功能名称
→ 先写本文件 Prompt 条目
→ 明确允许/禁止修改、验收条件、必须测试
→ 再改代码
→ AI 自测 / 门禁 / 实机可做验证
→ 状态 = pending-user-acceptance
→ 打包交给用户
→ 用户验收
   ├─ 不通过：新子编号 + 新 Prompt + 新版本
   └─ 通过：状态改为 delivered
```

用户未明确验收前，禁止把任务写成 `delivered`。

## 当前任务索引

| 任务 | 功能名称 | 版本 | 状态 | AI 验证 | 用户验收 |
|---|---|---|---|---|---|
| #22.17 | Project + Session Persistence / Runtime Event Isolation | v0.1.11 | pending-user-acceptance | pass | pending |
| #22.16 | Session Persistence / Stable Navigation / Dual Mode Switch | v0.1.10 | pending-user-acceptance | pass | pending |
| #22.15 | 实时 Agent Run Timeline / Streaming Activity | v0.1.9 | pending-user-acceptance | pass | pending |
| #22.14 | ChatGPT 套餐 OAuth 完成态 / 窗口关闭竞态修复 | v0.1.8 | pending-user-acceptance | pass | pending |
| #22.13 | Provider 官方登录 / Usage 终态 / 真流式回复 | v0.1.7 | pending-user-acceptance | pass | pending |
| #22.12 | 单一 Agent Core / Chat·Work·Manual 三模式 | v0.1.6 | pending-user-acceptance | pass | pending |
| #22.11 | 官方余额额度与 Chat/Work 模式边界 | v0.1.4 | pending-user-acceptance | pass | pending |
| #22.10 | 全量质量门禁与 Codex 取消竞态修复 | v0.1.3 | pending-user-acceptance | pass | pending |
| #22.9 | ChatGPT/Codex 套餐 Text Runtime | v0.1.2 | pending-user-acceptance | pass | pending |
| #21.29 | TSConfig 根配置继承 / Vite 启动修复 | v0.1.1 | pending-user-acceptance | pass | pending |
| #20.20 | Workspace 依赖健康检测 / 自动按需同步修复 | v0.1.0 | pending-user-acceptance | pass | pending |
| #21.28 | Harness capability-family 仓库架构重构 / Sync 目录迁移热修复 | v0.1.0 | pending-user-acceptance | pass | pending |
| #21.28 | Harness capability-family 仓库架构重构 | v0.0.99 | pending-user-acceptance | pass | pending |
| #21.27 | 全仓审计问题修复与发布门禁闭环 | v0.0.98 | pending-user-acceptance | pass | pending |
| #21.26 | 全项目术语与架构一致性维护 | v0.0.97 | pending-user-acceptance | pass | pending |
| #21.25 | Workspace 领域聚合 / Chat-Work 双投影父子架构 | v0.0.96 | pending-user-acceptance | pass | pending |
| #21.24 | Workbench 模块内职责分层 / v0.0.93 无限画布合并 | v0.0.95 | pending-user-acceptance | pass | pending |
| #22.8 | 无限画布布局持久化与选中层级修复 | v0.0.93 → merged v0.0.95 | pending-user-acceptance | pass | pending |
| #21.23 | Workbench 全域模块化 / DeepSeek Harness 风格边界 | v0.0.94 | pending-user-acceptance | pass | pending |
| #21.22 | Workbench 父子模块边界重构 | v0.0.93 | pending-user-acceptance | pass | pending |
| #22.7 | Reasoning Slider 几何与粒子修复尝试 | v0.0.92 | superseded | pass | not-accepted |
| #22.6 | Canvas 粒子渲染与 reasoning 提交闪烁修复 | v0.0.91 | pending-user-acceptance | pass | pending |
| #20.19 | Unicode ZIP 归档与 Sync 来源诊断修复 | v0.0.91 | pending-user-acceptance | pass | pending |
| #22.5 | Provider 实际推理档位动态投影修正 | v0.0.90 | superseded | pass | not-accepted |
| #22.4 | Chat 对齐 / 六档推理控制 / 粒子拖拽稳定性修复 | v0.0.89 | superseded | pass | not-accepted |
| #22.3 | 真实 Chat Run / UI Motion 与阻尼 Resize 基础 | v0.0.88 | superseded | pass | not-accepted |
| #21.21 | UI 共享模块 / Effect & Extension Registry 收敛 | v0.0.87 | pending-user-acceptance | pass | pending |
| #21.20 | Composer 统一模型运行时控制器 / Popover 闪烁修复 | v0.0.86 | pending-user-acceptance | pass | pending |
| #21.19 | Composer 模型 / 思考强度原地快切 | v0.0.85 | pending-user-acceptance | pass | pending |
| #2.19 | Provider Host 网络代理 / 系统 CA / 可诊断错误修复 | v0.0.84 | pending-user-acceptance | pass | pending |
| #2.18 | 模型管理 Active Model / Catalog 真值修复 | v0.0.83 | pending-user-acceptance | pass | pending |
| #2.17 | Node ESM Source Package 运行时导入修复 | v0.0.82 | pending-user-acceptance | pass | pending |
| #20.18 | Windows Setup PowerShell 智能引号解析修复 | v0.0.81 | pending-user-acceptance | pass | pending |
| #22.2 | Plugin Profile 生命周期与项目骨架收敛 | v0.0.80 | pending-user-acceptance | pass | pending |
| #4.4 | 发布包隐藏资源完整性与同步前来源预检 | v0.0.79 | pending-user-acceptance | pass | pending |
| #22.1 | Plugin Platform / Capability Contract / App Pack 总架构 | v0.0.78 | pending-user-acceptance | pass | pending |
| #21.18 | Chat / Work Codex 风格交互收敛 | v0.0.78 | pending-user-acceptance | pass | pending |
| #20.17 | 依赖同步幂等与 lockfile 保留修复 | v0.0.78 | pending-user-acceptance | pass | pending |
| #22.0 | 统一 Agent Runtime、三档权限与无限画布工作台 | v0.0.77 | pending-user-acceptance | pass | pending |
| #4.3 | Sync/GitHub 统一工作区预检与可诊断失败修复 | v0.0.77 | pending-user-acceptance | pass | pending |
| #2.16 | OpenAI ChatGPT 套餐 / Codex App Server 登录闭环 | v0.0.76 | pending-user-acceptance | pass | pending |
| #2.15 | 侧栏最小宽度超拖吸附修正 | v0.0.75 | delivered | pass | passed |
| #2.14 | 侧栏吸附触发阈值变量化 | v0.0.74 | superseded | pass | not-accepted |
| #2.13 | Rust Secret Broker 与官方模型能力配置 | v0.0.73 | superseded | pass | not-accepted |
| #2.12 | Windows Credential Manager 保存链路修复 | v0.0.72 | superseded | pass | not-accepted |
| #2.11 | 工作台 / 设置左栏宽度单一事实源 | v0.0.71 | delivered | pass | passed |
| #2.10 | UI Workspace 运行时导入解析修复 | v0.0.70 | superseded | pass | not-accepted |
| #2.9 | 设置中心共享可伸缩侧栏 | v0.0.69 | superseded | pass | not-accepted |
| #2.8 | Vite Native Config 兼容修复 | v0.0.68 | superseded | pass | not-accepted |
| #2.7 | Web API-Key Account 真实闭环 | v0.0.67 | superseded | pass | not-accepted |
| #2.6 | 工作台吸附反向展开动效修复 | v0.0.66 | delivered | pass | passed |
| #2.5 | 个人中心侧栏内联聚焦修复 | v0.0.65 | delivered | pass | passed |
| #2.4 | 设置中心与个人中心交互重构 | v0.0.64 | superseded | pass | not-accepted |
| #2.3 | 配置系统目录边界与 AI Provider 插件体系 | v0.0.63 | superseded | pass | not-accepted |
| #20.16 | pnpm 控制台直连原生输出修复 | v0.0.62 | delivered | pass | passed |
| #20.15 | pnpm CMD 原生终端输出与菜单精简 | v0.0.61 | superseded | pass | not-accepted |
| #20.14 | pnpm 原生安装输出恢复 | v0.0.60 | superseded | pass | not-accepted |
| #20.13 | 开发期依赖同步与实时输出修复 | v0.0.59 | superseded | pass | not-accepted |
| #20.12 | PowerShell 自动变量冲突修复 | v0.0.58 | superseded | pass | not-accepted |
| #20.11 | pnpm 实时环境事实与 Store 来源修复 | v0.0.57 | superseded | pass | not-accepted |
| #20.10 | 真实依赖健康检测与 Store 状态修复 | v0.0.56 | superseded | pass | not-accepted |
| #20.9 | 依赖提示去重与路径可见性 | v0.0.55 | delivered | pass | passed |
| #20.8 | 按需依赖增量检测与复用 | v0.0.54 | superseded | pass | not-accepted |
| #20.7 | Setup 菜单与发布门禁解耦 | v0.0.53 | superseded | pass | not-accepted |
| #20.6 | 发布环境与质量门禁闭环 | v0.0.52 | superseded | pass | not-accepted |
| #2.2 | Config Schema 基线 | v0.0.51 | pending-user-acceptance | pass | pending |
| #20.5 | 文档体系单文件时间线重构 | v0.0.50 | pending-user-acceptance | pass | pending |

## 当前任务 / 当前合同

## #22.17 Project + Session Persistence / Runtime Event Isolation

- **版本：** v0.1.11；**状态：** pending-user-acceptance。
- **允许修改：** Project/Session Domain 与 Node Host、Session HTTP/Client、Workspace Controller、左栏项目/会话交互、Chat Run disclosure、Agent Runtime session 路由、对应测试/文档/版本元数据。
- **禁止修改：** Provider 认证和额度语义、Plugin/Secret/Terminal 协议、Chat/Work 共用同一 Agent Core 的能力边界；禁止引入 C#。
- **验收：** Project/Session/置顶/展开/active 状态和消息跨刷新、重启恢复；Chat 与 Work 中央表现和提交行为按 mode 分流；Runtime 事件按 Session 隔离；真实阶段与工具活动可展开；完整门禁和 fresh extract 通过。



## #22.9 ChatGPT/Codex 套餐 Text Runtime

- **版本：** v0.1.2；**状态：** pending-user-acceptance。
- **允许修改：** `packages/harness/codex-app-server`、`packages/api/agent-controller`、`packages/api/settings-controller`、`packages/bundle/web-app`、Agent Runtime event contract、Workspace Session Controller、对应 tests/docs/version metadata。
- **禁止修改：** Work Canvas、Workbench Resize/Motion、Plugin Runtime、Terminal、Secret Store 实现、OpenAI-compatible 网络协议既有语义。
- **验收：** 套餐账户可真实 text turn、多轮复用、流式 delta、取消；API Key 路径不回退；OAuth Token 不进入 LFAA；Codex 写权限在审批 UI 接入前保持 read-only。

## #21.29 TSConfig 根配置继承 / Vite 启动修复

- **版本：** v0.1.1；**状态：** pending-user-acceptance。
- **问题：** capability-family 迁移后，两层 package 的 `tsconfig.json` 仍使用旧单层目录的 `../../tsconfig.base.json`，Vite dependency scan 因而尝试读取不存在的 `packages/tsconfig.base.json`。
- **允许修改：** 根级 TypeScript base 配置、workspace tsconfig extends、TSConfig Gate / tests / 当前文档 / 版本元数据。
- **禁止修改：** Chat/Work、Workbench 动效、Provider 业务、Plugin Runtime、Secret、Terminal 协议、Agent Runtime 行为。
- **验收：** `apps/web` 能解析根 client base；两层 package 的 extends 真实存在；私有 `@/*` TypeScript-only alias 不回流；workspace-preflight 在 Vite 启动前捕获错误 extends。

## #20.20 Workspace 依赖健康检测 / 自动按需同步修复

- **版本：** v0.1.0；**状态：** pending-user-acceptance。
- **问题：** v0.0.99 已迁为 `packages/<family>/<package>`；后续 Sync 热修复完成后，Node 健康检查仍扫描旧单层 packages，Web 启动又硬编码旧 importer 的 xterm/node-pty 路径，导致菜单 1 与菜单 2 互相矛盾。
- **允许修改：** Node dependency health checker、Windows Setup 依赖 readiness、依赖相关 tests/docs/version。
- **禁止修改：** Chat/Work、Workbench UI、Provider 业务、Plugin Runtime、Secret、Terminal 协议与 Harness package Owner。
- **验收：** 全部 workspace importer 被发现；新增 package dependency / lockfile importer 不一致 / workspace link 缺失必定触发 NeedsInstall；菜单 1 自动同步；菜单 2 复用同一 readiness；无变化时仍跳过 pnpm install。

## #21.27 全仓审计问题修复与发布门禁闭环

### 目标与基线

- **基线：** v0.0.97；**目标版本：** v0.0.98；**状态：** pending-user-acceptance。
- 修复审计复现的 Web CSS 构建失败、TypeScript 7 配置失败、Node source runtime 测试导入位置错误、当前事实文档旧 Owner、`@lfaa/ui` 的 LFAA Settings/UserMenu 产品 UI 越界，以及仅靠源码文本合同测试遗漏实际编译/构建的问题。
- 只做等价迁移和门禁补强；不新增产品功能、不改视觉/交互/Provider/Agent/Plugin 执行行为。用户验收前状态不得为 delivered。

### 目录归属、依赖与边界

- **允许修改：** `packages/client/app-shell/src/workbench/{settings,shell}/**` 中产品 Settings/Plugin/UserMenu View 与样式；`packages/client/ui/src/features/{settings,account}/**` 的等价迁出和公开入口；相关 `ui`/`app-shell` README 与 API；`apps/web/tsconfig.json`、现有 package tsconfig；`packages/client/app-shell/src/agent-workbench.css` 注释；`test/**` 与 `scripts/**` 的对应门禁；当前事实文档、版本元数据和历史时间线新增条目。移除 `baseUrl` 后发现 TypeScript 7 原先遮蔽的严格类型错误，因此额外允许只为类型正确性编辑 `apps/web/dev/bridges/ai/{ai-config-bridge,codex-app-server,rust-secret-store}.ts`、`packages/client/app-shell/src/{AgentWorkbench.tsx,workbench/center/**,workbench/settings/logic/useAiSettingsController.ts}`、`packages/client/workspace/src/work/view/WorkWorkspace.tsx`、`packages/plugin/plugin-host-node/src/index.ts`、`packages/client/ui/src/ui-effects/ParticleStreamCanvas.tsx`；这些文件禁止改变业务分支、参数值或渲染结果。
- **允许依赖：** `app-shell → @lfaa/ui` 的通用 ResizableWorkbench/ThemeModeMenu 等公共 API；`app-shell → config-system` 只经既有公开 API；Node source 测试从真实 Consumer 目录解析 workspace 包。
- **禁止依赖：** `@lfaa/ui → app-shell/config-system/apps`；跨包深链内部源码；`apps/web/src → apps/web/dev`；新增 package/crate 或空壳目录。
- **状态归属：** Settings 页面导航与 Plugin 页面局部表单状态随 View 迁入 App Shell；`packages/client/ui/src/features/settings/ai/` 是 AGENTS.md 明确规定的 AI 配置图形界面位置，保留只接收 Props 的 `AiSettingsPanel` 与其瞬时表单状态；配置/Secret 真值仍归 Config System/Host；共享 UI Primitive 状态不迁移；Plugin Profile/Workspace Session 不改。
- **冻结：** Workspace Chat/Work、InfiniteCanvas、Reasoning/Slider/Particle/Resize、Provider/Secret、Plugin Host/Runtime、Rust、Windows 运维行为。

### 验收条件与必须测试

1. `pnpm run governance:check`、`pnpm run typecheck`、`pnpm test`、`pnpm run build`、`pnpm run quality:full` 在 Node 24/pnpm 11.17.0 下通过；CSS 与 TS 错误不得通过关闭压缩或降级 TypeScript 绕过。
2. Node source runtime 测试真实加载 Host 所依赖的 workspace package，不要求根 package 增加无关依赖；`@lfaa/ui` 不再拥有 Settings 页面导航、Plugin 管理页面或 UserMenu 产品外壳，AI 配置图形界面继续按 AGENTS.md 固定留在 `ui/features/settings/ai` 且不拥有业务真值；Settings/个人中心的用户可见行为保持。
3. 当前事实文档只指向 `packages/client/workspace/src/{chat,work,shared}` 和现有 App Shell 模块；旧版本记录保留在历史时间线。门禁增加实际构建/类型检查覆盖和文档路径/归属防回归检查，不把静态 preflight 冒充完整发布验证。
4. 最终 ZIP 使用现有归档器生成，验证 Unicode entry、`.lfaa`、fresh extract preflight；更新 CHANGELOG/RELEASES，交付状态为 pending-user-acceptance。

### 必须更新的文档与版本

`PROJECT_PLAN.md`、`docs/DEVELOPMENT_LOG.md`、`ARCHITECTURE.md`、`docs/MODULES.md`、`docs/UI.md`、`docs/TESTING.md`、`docs/RUNTIME.md`、`docs/项目结构与代码地图.md`、相关 README、`CHANGELOG.md`、`docs/RELEASES.md`；根/包/发布元数据递增至 v0.0.98。

## #21.26 全项目术语与架构一致性维护

### 用户目标 / 背景

用户要求对整个项目做一次维护，并明确要求架构术语专业、职责清楚、避免过度设计。上一版已经把 `Workspace → chat/work/shared` 父子关系落地，但当前事实文档、源码类型名和注释中仍混用 `Projection / Surface / Mode`，`PROJECT_PLAN.md` 还存在重复/过期当前任务描述。该类语义漂移会直接增加未来 AI/开发者的理解成本。

本轮是**行为冻结的架构维护版本**：统一 Workspace 术语、修正公开/内部契约命名、清理当前事实文档漂移、强化防回归门禁；不新增产品功能，不改变 Provider/Reasoning/Canvas Pointer/Resize/Plugin/Rust/Windows 运维行为。

### 基线 / 目标版本

- **代码基线：** v0.0.96。
- **目标版本：** v0.0.97。
- **发布状态：** 完成 AI 验证后只能进入 `pending-user-acceptance`。

### 专业术语决定

1. `Workspace` 是父领域；`Chat` / `Work` 的正式称呼是 **Workspace Mode / 工作模式**。
2. `Surface` 只表示实际 UI 承载面/扩展目标（例如 Settings Surface、Plugin UI Surface），不再作为 Chat/Work 的主领域名称。
3. `ViewModel` 表示 UI 直接消费的数据形状；Chat 消息 UI 契约使用 `ChatMessageViewModel`。
4. `Renderer` / `Interaction Primitive` 表示 InfiniteCanvas 等通用 UI 渲染与交互能力。
5. `Projection` 只在真正的派生 Read Model / Event → ViewModel 映射语义中使用；不得再把 Chat/Work 模式、InfiniteCanvas Renderer 本身称为 Projection。

### 允许修改

- `packages/core/agent-runtime/**`：只做 Chat/Work 模式契约的专业命名迁移；
- `packages/client/workspace/**`：Workspace mode / ViewModel 命名、兼容旧 localStorage key 的一次迁移；
- `packages/client/app-shell/**`：随公共契约做等价接线与 `data-workspace-mode` 命名；
- `packages/client/connection/src/agent-runtime-client.ts`、`apps/web/dev/bridges/agent/**`：随 Run request 字段等价迁移；
- 相关测试与架构门禁；
- 当前事实文档、README、包 README、版本/发布元数据；
- 历史时间线只追加本条记录，不重写旧版本历史。

### 禁止修改

- `packages/client/ui/src/ui-controls/**`、`ui-effects/**`、`ui-resize/**`、`ui-motion/**` 的行为；
- InfiniteCanvas pan/zoom/drag/selection/edge 算法；
- Config/Provider/Secret/Reasoning/Strong Reasoning 业务；
- Plugin Registry / Plugin Host 行为；
- Rust Native、Windows Setup/Sync/GitHub/Update 逻辑；
- 新建未来 `project/canvas/workflow/task/asset/model/tool/storage` 空壳 package。

### 状态所有权 / 兼容要求

```text
Workspace
├─ Chat Mode
├─ Work Mode
└─ shared Session Controller
        ↓
AgentRunRequest.workspaceMode
        ↓
同一个 Agent Runtime Host
```

- `AgentSurfaceMode` → `AgentWorkspaceMode`；`AgentRunRequest.surface` → `workspaceMode`。
- Workspace 本地持久化 key 使用 `lfaa.workspace.mode.v1`；读取时必须兼容 v0.0.96 的 `lfaa.agent.surface.v1`，避免升级后丢失用户模式偏好。
- `ChatProjectionMessage` → `ChatMessageViewModel`，只改语义命名，不改字段/渲染行为。
- Plugin SDK 的 `surfaces`、Settings Surface 等真正 UI Surface 语义保持不动。

### 验收条件

1. 当前事实源不再把 Chat/Work 正式称为“投影”，统一为 Workspace 的两种工作模式。
2. Agent Runtime / Workspace / App Shell / Web Bridge 的 Chat/Work mode 字段命名一致，不保留 `AgentSurfaceMode` / `request.surface` 旧契约。
3. v0.0.96 的 workspace mode 偏好可通过 legacy key 自动读取。
4. InfiniteCanvas 当前行为与 v0.0.96 完全冻结；仅允许注释/文档从 Projection 修正为 Renderer/Interaction。
5. `PROJECT_PLAN.md` 当前任务不再重复或指向 v0.0.95/#21.24。
6. 新门禁能阻止 `ChatProjectionMessage`、`AgentSurfaceMode`、`AgentRunRequest.surface` 等旧专业术语回流。
7. workspace-preflight、聚焦回归、可执行全仓 Node 测试、发布 ZIP round-trip 通过；环境限制必须如实记录。

### 必须测试

- `test/workspace-package-boundary.test.mjs`；
- `test/agent-runtime-contract.test.mjs`；
- `test/chat-runtime-contract.test.mjs`；
- `test/infinite-canvas-contract.test.mjs`；
- `test/workbench-module-boundary.test.mjs` / `test/workbench-architecture-layer.test.mjs`；
- 新增或扩展 Workspace terminology contract；
- `node scripts/workspace-preflight.mjs`；
- 可执行的 `node --test test/*.test.mjs`；
- 最终 ZIP fresh extract + preflight。

### 当前状态

- **状态：** pending-user-acceptance
- **AI 验证：** pass
- **用户验收：** pending


## #21.25 Workspace 领域聚合 / Chat-Work 双投影父子架构

### 用户目标 / 背景

用户进一步确认 LFAA 的长期产品模型：**Chat 与 Work 不是两套独立产品，而是同一个 Workspace/Project/Agent 核心之上的两种工作方式**。Chat 负责线性“一句话解决问题”，Work 负责可视化无限画布中的自动化执行、用户监督与对话辅助。此前按 `chat-workspace / work-workspace / canvas-core / canvas-renderer` 横向铺开独立 package 的规划存在过度拆分风险，会增加跨包依赖、重复合同与维护成本。

本轮只把当前已经存在、已经被产品实际消费的 Workspace 能力做真实父子聚合；**禁止为了未来规划创建 canvas/workflow/project/task/asset 等空壳 package**。遵守“父目录表示领域、子目录表示领域内部职责”的原则。

### 基线 / 目标版本

- **代码基线：** v0.0.95。
- **保留功能：** v0.0.95 的 Workbench 模块化、用户 v0.0.93 合入的 Infinite Canvas 持久化/选中置顶，以及既有 Chat/Work Run 行为全部冻结。
- **目标版本：** v0.0.96。

### 架构决定

1. 新增真实 workspace package：`packages/client/workspace` / `@lfaa/workspace`。它必须有当前 Consumer（`@lfaa/app-shell`）和真实实现，不允许占位。
2. `@lfaa/workspace` 是 **Workspace Feature Composition**：内部按父子关系组织 `chat/`、`work/`、`shared/`，拥有 Chat/Work 两种 Surface 的产品投影、共享 Session Controller 与 Work Canvas 产品布局状态。
3. `@lfaa/app-shell` 收敛为产品外壳/装配：Shell、Left、Center Chrome、Composer、Right、Terminal、Settings 保留；不再同时拥有 Chat Timeline、Work Canvas 和 Workspace Session 的内部实现。
4. 当前 `center/conversation` 语义被拆正：Center 直接根据当前 Surface 从 `@lfaa/workspace` 公共入口组合 `ChatWorkspace` 或 `WorkWorkspace`；不再使用一个叫 Conversation 的模块同时包 Chat 与 Work。
5. Work Canvas 的 `workspaceId → node x/y + viewport` 持久化、`lastRunInput` UI Projection 迁入 `workspace/work/`，保持 v0.0.95 行为语义等价；`@lfaa/ui` InfiniteCanvas 仍只是通用 UI Projection，不拥有产品持久化真值。
6. Chat/Work Run、permission、Runtime event projection 迁入 `workspace/shared/logic`，继续只调用同一个 `AgentRuntimeHost.startRun`；不得创建第二套 Chat Runtime 或 Work Runtime。
7. 包组织原则写入长期规范：**同一领域的 core/renderer/runtime/子模式优先先在一个父 package 内分层，只有存在独立生命周期、跨领域复用、部署边界或真实多个 Consumer 时才拆独立 package。**
8. 不在本轮创建 `project/ canvas/ workflow/ task/ asset/ model/ tool/ storage` 等未来 package；只在 Architecture/Plan 记录方向，等真实实现 + Consumer 出现再建立。
9. `@lfaa/ui` 包名本轮不改，继续作为 UI Kit / Shared Interaction Engine；避免把 Workspace 迁移与 UI 包重命名混在同一版本。

### 允许修改

- 新增 `packages/client/workspace/**`；
- 从 `packages/client/app-shell/src/workbench/center/conversation/**` 与 `workbench/session/**` 做等价迁移并删除旧 Owner；
- `packages/client/app-shell/src/AgentWorkbench.tsx`、`workbench/center/**`、Workbench 公共 contracts/index/package manifest 的必要接线；
- package architecture / module boundary / UI contract / Chat Runtime / Infinite Canvas 测试，使门禁跟随新 Owner；
- `AGENTS.md`、`DEVELOPMENT.md`、`ARCHITECTURE.md`、`PROJECT_PLAN.md`、`docs/MODULES.md`、`docs/UI.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`；
- 版本、CHANGELOG、RELEASES 与发布元数据。

### 禁止修改

- Runtime Reasoning / 强力推理 / Slider / Particle 视觉与算法；
- `packages/client/ui/src/ui-controls/**`、`ui-effects/**`、`ui-resize/**`、`ui-motion/**`、InfiniteCanvas Pointer 算法；
- Provider Capability、Config/Secret 业务、Agent Runtime Protocol、Plugin Runtime、Rust Native；
- Workbench Resize/Snap、Windows Sync/GitHub/Setup/Update 行为；
- 为未来功能提前创建没有当前 Consumer 的 package/crate。

### 状态所有权

```text
@lfaa/app-shell
├─ Shell / Left / Center Chrome / Composer / Right / Terminal / Settings
└─ 只装配 Workspace 公共 API

@lfaa/workspace
├─ shared/
│  ├─ contracts/   ChatProjection / Workspace View contract
│  └─ logic/       Chat/Work 共用 Session Controller
├─ chat/
│  ├─ view/
│  └─ styles/
└─ work/
   ├─ view/
   ├─ logic/
   ├─ styles/
   └─ contracts/
        ↓
@lfaa/ui InfiniteCanvas（通用交互/渲染）
        ↓
@lfaa/agent-runtime（同一 Run 协议）
```

### 不可回退行为

- Chat 用户消息保持右对齐 Composer 右基线；AI/Error 保持左对齐 Composer 左基线。
- Chat / Work 仍使用同一个当前模型、permissionProfile、AgentRuntimeHost 和 `startRun` 契约。
- Work Canvas workspaceId 隔离、节点位置与 viewport 持久化、低频 commit、selected node z-index、edges behind nodes 不回退。
- Reasoning / Strong Reasoning / Particle / Resize / Snap / Unicode ZIP / Sync 行为全部冻结。

### 验收条件

1. `packages/client/workspace` 是真实 package，内部只有一个 Workspace 父领域，下面明确出现 `chat/`、`work/`、`shared/`；不新增 `chat-workspace`、`work-workspace` 两个平级 package。
2. `packages/client/app-shell` 不再存在 `workbench/center/conversation/**` 和 `workbench/session/**` 旧 Owner；AgentWorkbench 仍是薄 Composition Root。
3. Center 只通过 `@lfaa/workspace` 公共 export 使用 Chat/Work，不深链 Workspace 内部目录。
4. Chat/Work 共用 Session Controller；代码中不存在第二套 `startRun` / Runtime event subscription。
5. Work Canvas 持久化和 Infinite Canvas 交互行为与 v0.0.95 等价。
6. package architecture Gate 明确允许 `product-composition → workspace-feature-composition`，同时保留无环检查，禁止任意深链跨包内部源码。
7. 文档把“父 package=领域，子目录=职责；不为未来规划预创建独立 package”写成长期规则。
8. 最终 ZIP fresh extract 后 Unicode path、`.lfaa` 与 workspace-preflight 全通过。

### 必须测试

- `test/workspace-package-boundary.test.mjs`（新增）；
- `test/workbench-module-boundary.test.mjs`；
- `test/infinite-canvas-contract.test.mjs`；
- `test/chat-runtime-contract.test.mjs`；
- `test/model-quick-switch-contract.test.mjs`；
- `scripts/package-architecture-check.mjs` / `test/package-architecture.test.mjs`；
- `scripts/ui-contract-check.mjs`；
- 既有 UI shared / interaction motion / settings / release/sync 回归；
- 可执行全仓 Node 静态/契约测试；
- `node scripts/workspace-preflight.mjs`；
- 最终 ZIP fresh round-trip + preflight。

### 必须更新文档

`AGENTS.md`、`DEVELOPMENT.md`、`ARCHITECTURE.md`、`PROJECT_PLAN.md`、`docs/DEVELOPMENT_LOG.md`、`docs/MODULES.md`、`docs/UI.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### 当前状态

`pending-user-acceptance`

- CHANGELOG 编号：`#21.25`
- 目标版本：`v0.0.96`
- AI 验证：`pass`
- 用户验收：`pending`

## #21.24 Workbench 模块内职责分层 / v0.0.93 无限画布合并

### 用户目标 / 背景

用户确认 v0.0.94 的“全域模块 Owner”方向正确，但进一步要求工程结构必须像 DeepSeek Harness 一样清楚：模块是父子级边界，模块内部还要能一眼区分 View / Logic / Styles / Contracts，不能把 Controller、TSX、CSS 混在同一层，也不能把 `packages/client/ui` 与产品业务 UI 混为一谈。同时用户提供了自己修过的 v0.0.93，其中 #22.8 Infinite Canvas 已完成布局持久化与选中置顶，要求与 v0.0.94 模块化基线合并后生成新包。

### 基线与合并策略

- **结构基线：** v0.0.94；保留其 Workbench 全域父子模块与行为。
- **功能补丁源：** 用户上传的 v0.0.93，仅移植 #22.8 Infinite Canvas 合同/行为，不回滚 v0.0.94 的模块化代码，也不复制 v0.0.93 的其他旧实现。
- **目标版本：** v0.0.95。

### 架构决定

1. `packages/client/ui` 保持包名 `@lfaa/ui`，明确定位为 **UI Kit / Design System / Shared Interaction Engine**：通用控件、布局、Motion、Effect、InfiniteCanvas Projection 等可复用界面能力；它使用 TS/TSX 是正常的，因为 UI 组件需要 DOM/ARIA/Pointer/Props 行为。它不得拥有 Provider/Config/Session 产品真值。
2. `packages/client/app-shell` 是 **LFAA 产品 UI 组合层**。Workbench 每个大模块继续有独立 Owner，并在模块内部按需使用 `view/`、`logic/`、`styles/`、`contracts/` 子目录；不为了形式创建空目录。
3. `apps/web/src` 是浏览器 bundle；`apps/web/dev` 是 Vite dev-server/Node 进程专用代码，因此继续独立于 `src`。但 `vite.config.ts` 只做组合，Resource/PTy 等开发桥逻辑必须下沉 `dev/bridges/*`。浏览器侧调用 Host 的客户端目录命名为 `src/host-clients/`，避免与 Node Host 实现混淆。
4. Work Canvas 视觉布局不属于 Agent Session 真值。#22.8 的 workspace-scoped 节点位置/viewport 持久化归 `center/conversation/work-canvas/logic`；Session 只拥有 Run/Chat/Surface/Permission 等业务状态。

### 允许修改

- `packages/client/app-shell/src/workbench/**` 的等价目录整理、公共 index、内部 import；
- `packages/client/ui/src/features/workbench/InfiniteCanvas*` 与导出（仅合并用户 v0.0.93 #22.8）；
- `apps/web/src/host/**` → `src/host-clients/**` 的语义重命名与引用；
- `apps/web/dev/bridges/resources/**`、`terminal/**`，把 `vite.config.ts` 的开发桥实现下沉；
- 与上述结构/Canvas 对应的测试、治理、项目地图、UI/Architecture/Testing/Runtime 文档；
- 版本与发布文档。

### 禁止修改

- Runtime Reasoning/强力推理/Slider/Particle 的行为与视觉；
- `packages/client/ui/src/ui-controls/**`、`ui-effects/**`、`ui-resize/**`、`ui-motion/**`；
- Provider Capability、Config/Secret、Agent Runtime Protocol、Plugin Runtime、Rust Native；
- Workbench Resize/Snap 算法；
- Sync/GitHub/Setup/Update 业务逻辑。

### 不可回退行为

- v0.0.94 的 Left/Center/Right/Terminal/Settings/Session 父子模块边界；
- v0.0.94 的 CSS Module 隔离与 Composition Root；
- v0.0.93 #22.8 的 Work Canvas：按 workspaceId 保存节点 `id→x/y` 与 viewport、低频 commit、选中节点置顶、edges 在后、UI 不直接拥有 localStorage key；
- v0.0.91+ Unicode ZIP / `.lfaa` 成品完整性。

### 验收条件

1. Workbench 大模块仍全部独立；模块内部的 View / Logic / Styles / Contracts 通过目录和 index 能清楚辨识，根组件不重新变胖。
2. `packages/client/ui` 文档明确为共享 UI Kit，不与 app-shell 产品模块重复；业务语义不得下沉 UI Kit。
3. `apps/web/dev` 只含 dev-server Node 代码；`vite.config.ts` 不再直接承载 Resource/PTY 详细实现；浏览器 Host Client 位于 `src/host-clients`。
4. Work Canvas 刷新恢复节点位置与 viewport；workspaceId 隔离；PointerMove 不直接写 localStorage；选中/拖动节点置顶且 edge 在后。
5. `useAgentSessionController` 不再拥有 Work Canvas 节点视觉坐标。
6. Reasoning/Particle/Resize/Snap 等禁止区与 v0.0.94 保持零功能改动。
7. 最终 ZIP 可 fresh extract，中文代码地图 UTF-8 flag 正常，`.lfaa` 保留，解压根 preflight PASS。

### 必须测试

- `test/infinite-canvas-contract.test.mjs`；
- Workbench module boundary / UI shared / interaction motion / chat runtime / settings shell / model quick switch 等既有回归；
- 新增/扩展 Architecture Layer Contract：App Shell 模块内分层、Session 不拥有 Canvas Layout、Vite config 只组合 bridge；
- `scripts/ui-contract-check.mjs`；
- `scripts/workspace-preflight.mjs`；
- 可执行全仓 Node 静态/契约测试；
- 最终 ZIP fresh round-trip + preflight。

### 当前状态

`pending-user-acceptance`

- CHANGELOG 编号：`#21.24 + merge #22.8`
- 目标版本：`v0.0.95`
- AI 验证：`pass`
- 用户验收：`pending`

## #22.8 无限画布布局持久化与选中层级修复

### 用户目标 / 背景

v0.0.92 Windows 实机反馈暴露 Work 无限画布的两个基础交互缺陷：用户手动拖动节点、平移或缩放画布后，刷新页面会恢复默认位置，无法把用户自定义排版作为稳定工作区状态；多个节点发生重叠时，即使用户已经选中下层节点，选中节点仍可能被后绘制节点遮挡，破坏“当前对象应在最前”的直接操作语义。用户同时提供截图要求保留节点可自由摆放、允许重叠，但被选中/拖动的节点必须即时提升到前层。

本轮不引入自动布局器，也不把节点业务真值写入浏览器存储。只持久化 Work Surface 的**视觉布局事实**：节点 `id -> {x,y}` 与 viewport `{x,y,scale}`。业务标题、描述、状态、Run/Session/Event 仍由 Agent Runtime / App Shell 当前数据源决定；恢复时只把已保存坐标按 `id` 合并到当前节点定义，新增节点继续使用当前默认位置，已删除节点的旧坐标自然忽略。

### 主模块 / 状态所有权

- `packages/client/ui/src/features/workbench/InfiniteCanvas.tsx`：继续拥有高频 pan/zoom/drag 交互；新增 viewport 初始值与低频 commit 回调，不直接访问 localStorage，不拥有工作区持久化 Key。
- `packages/client/ui/src/features/workbench/infinite-canvas.types.ts`：拥有 `InfiniteCanvasViewport` 与 viewport commit 公共 UI Contract。
- `packages/client/app-shell/src/AgentWorkbench.tsx`：拥有当前 Work Surface 视觉布局偏好持久化；按 workspaceId 使用版本化 localStorage key，保存节点坐标与 viewport，加载时做有限数值校验并与当前节点模板合并。
- `packages/client/ui/src/features/workbench/infinite-canvas.css`：拥有节点堆叠视觉规则；普通节点在基础层，选中/拖动节点必须提升到节点层最前，边线始终位于节点后方。

### 允许修改

- `packages/client/ui/src/features/workbench/InfiniteCanvas.tsx`、`infinite-canvas.types.ts`、`infinite-canvas.css`；
- `packages/client/app-shell/src/AgentWorkbench.tsx`（仅 Work Canvas 视觉布局持久化与传参）；
- Infinite Canvas / UI contract / interaction 测试；
- 当前事实文档、版本元数据、CHANGELOG / RELEASES。

### 禁止修改 / 安全边界

- 禁止把 Run/Session/Artifact/模型回复等业务真值塞进 localStorage；只保存节点 `x/y` 与 viewport `x/y/scale`。
- 禁止让 `packages/client/ui` 自己拼 workspace localStorage key；持久化 Owner 在 App Shell，UI 只暴露初始值与 commit 回调。
- 禁止在 PointerMove 每像素写 localStorage；节点拖动只更新视觉 state，持久化必须 debounce/commit；viewport 只在 pan 结束、缩放控制、wheel settle 后提交。
- 禁止引入自动避让或强制重排；用户允许节点自由重叠，自定义排版必须原样恢复。
- 禁止用 DOM 顺序重排破坏 edges/node identity；选中层级使用稳定 z-index/active state，不改变节点业务数组顺序。
- 禁止回退 #22.7 的 reasoning / star particle / Unicode ZIP 修复。

### 实现约束

1. 新增版本化持久化结构 `WorkCanvasLayoutSnapshot v1`，至少包含 `viewport` 与 `nodePositions`；key 必须按 workspaceId 隔离，避免不同项目共用一套坐标。
2. 读取持久化数据时必须容错：JSON 失败、版本不匹配、NaN/Infinity、scale 超界都回退安全默认；节点只接受有限数值坐标。
3. 初始化节点时按 id 合并已保存 `x/y`，不保存或覆盖 `title/description/status/kind`；运行时状态更新必须保留当前坐标。
4. `InfiniteCanvas` 内部继续本地持有 viewport，避免 pan 每像素让整个 App Shell 重渲染；通过 `initialViewport` 初始化，通过 `onViewportCommit` 在低频时机通知上层保存。
5. Wheel pan/zoom 使用短 settle timer 合并提交；Pointer pan 在 PointerUp/Cancel 提交；缩放按钮与“复位”立即提交。复位应回到产品默认 viewport 并覆盖此前保存值。
6. 节点坐标持久化由 App Shell 对 `workNodes` 做短 debounce，仅序列化 `{id,x,y}`；刷新后应恢复到最后一次稳定位置。
7. 节点选中/开始拖动时必须获得最高节点 z-index；未选中节点保持基础层，edges 固定在节点后。选中节点即使 DOM 顺序较早，也不能被后续节点遮挡。
8. 选中层级只影响视觉，不改变 edges 连接、节点 id、业务状态或数组排序。

### 验收条件

1. 任意拖动 1 个或多个 Work 节点，刷新页面后节点恢复到用户最后摆放的位置，不回默认模板。
2. 任意平移/缩放画布，刷新后 viewport 恢复到最后稳定位置与比例；点击“复位”后刷新仍保持默认 viewport。
3. 不同 `workspaceId` 使用独立布局，A 项目的排版不污染 B 项目。
4. 新增/删除节点时，保存数据按 id 合并：已有节点恢复坐标，新节点使用当前代码默认坐标，旧节点残留坐标不产生幽灵节点。
5. 两个或更多节点重叠时，点击/拖动哪个节点，哪个节点立即显示在最前；即使它在 DOM 数组中更早，也不被其他节点盖住。
6. edges 始终在节点后方，不覆盖节点文本；选择层级不改变连线数据。
7. PointerMove 不直接写 localStorage；连续拖动/滚轮不会造成同步存储写放大或明显卡顿。
8. #22.7 的 reasoning 动态档位、Slider 几何、轨道内星光粒子与发布包 Unicode 修复不回退。

### 必须测试

- 扩展 `test/infinite-canvas-contract.test.mjs`：viewport initial/commit、selected z-index、edges behind nodes；
- 新增/扩展 App Shell contract：workspace-scoped localStorage key、v1 layout snapshot、节点 id 坐标合并、只保存 x/y、不保存业务字段、debounce；
- `node --test test/infinite-canvas-contract.test.mjs`；
- `node --test test/ui-interaction-motion.test.mjs`；
- `node scripts/ui-contract-check.mjs`；
- 全仓可执行 Node 静态/契约测试；
- `node scripts/workspace-preflight.mjs`；
- 最终 ZIP 继续使用 `scripts/release-archive.mjs`，Unicode / `.lfaa` fresh round-trip 后再次 preflight。

### 必须更新文档

`DEVELOPMENT.md`、`ARCHITECTURE.md`、`PROJECT_PLAN.md`、`docs/DEVELOPMENT_LOG.md`、`docs/MODULES.md`、`docs/UI.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG / 版本

- CHANGELOG 编号：`#22.8`
- 目标版本：`v0.0.93`
- 当前状态：`pending-user-acceptance`
- AI 验证：`pass`（Infinite Canvas 聚焦 5/5 PASS；UI 交互回归 21/21 PASS；全仓除当前环境限定的 `node-source-runtime.test.mjs` 外 141/141 PASS；本轮 TS/TSX syntax transpile 5/5 PASS；workspace-preflight PASS；最终 ZIP fresh round-trip 后再次 preflight PASS）
- 用户验收：`pending`

## #21.23 Workbench 全域模块化 / DeepSeek Harness 风格边界

### 用户目标 / 背景

用户明确纠正：不能只把 RuntimeControl 单独模块化，必须把整个 Workbench 按 DeepSeek Harness 的工程方式一次性建立长期模块边界。左侧栏、中央区、右侧栏、底部终端都是独立大模块；中央区继续拆 Header / Conversation / Composer；Composer 再拆 Permission / Add Menu / RuntimeControl；Shell Overlay、Settings Surface、AI/Plugin Host Controller、Agent Session Controller、Theme/Chrome Controller 也必须有唯一 Owner。后续修改任意一块，不得要求编辑兄弟模块或共享大 CSS。

本轮从 **v0.0.93** 建立 **v0.0.94**，只做等价模块迁移与边界治理，冻结用户可见布局、尺寸、颜色、行为和共享 Slider/Canvas/Resize/Motion 算法。参考 DeepSeek Harness 的 `ui-* package / component + service/controller + *.module.css + index.ts` 思路，但不复制其业务实现。

### 目标模块树

```text
AgentWorkbench.tsx                         # 只保留 Composition Root
workbench/
├─ shell/                                 # Shell 状态/布局/快捷键/Overlay
│  ├─ WorkbenchShell.tsx
│  ├─ useWorkbenchChromeController.ts
│  ├─ useWorkbenchThemeController.ts
│  ├─ WorkbenchOverlays.tsx
│  ├─ *.module.css
│  └─ index.ts
├─ left/                                  # 左栏完整模块
│  ├─ LeftSidebarRegion.tsx
│  ├─ ProfileBar.tsx
│  ├─ LeftSidebar.module.css
│  └─ index.ts
├─ center/                                # 中央父模块
│  ├─ CenterWorkspaceRegion.tsx
│  ├─ header/
│  ├─ conversation/
│  └─ composer/
│     ├─ ComposerRegion.tsx
│     ├─ PermissionControl.tsx
│     ├─ AddCapabilityMenu.tsx
│     ├─ runtime-control/
│     ├─ *.module.css
│     └─ index.ts
├─ right/                                 # 右栏完整模块
│  ├─ RightSidebarRegion.tsx
│  ├─ RightSidebar.module.css
│  └─ index.ts
├─ terminal/                              # 终端完整模块
│  ├─ BottomTerminalRegion.tsx
│  ├─ BottomTerminal.module.css
│  └─ index.ts
├─ settings/                              # Settings Surface + Host Controller
│  ├─ SettingsSurface.tsx
│  ├─ useAiSettingsController.ts
│  ├─ usePluginSettingsController.ts
│  ├─ settings-view-models.ts
│  ├─ SettingsSurface.module.css
│  └─ index.ts
├─ session/                               # Chat/Work Run 状态 Owner
│  ├─ useAgentSessionController.ts
│  └─ index.ts
└─ shared/                                # 仅真正跨模块 Primitive
   ├─ IconButton.tsx
   ├─ IconButton.module.css
   └─ index.ts
```

### 状态所有权

- `shell/*`：theme / layout mode / chrome / leftPaneWidth / Hover Preview / Shell shortcuts / profile-theme-update overlays。
- `session/*`：agentSurface / permission profile / chat projection / work nodes / Agent Run event subscription。
- `settings/*`：AI Account snapshot / Provider ViewModel / Plugin snapshot / Settings surface section。
- `left/*`：brand menu 等左栏局部状态。
- `center/conversation/*`：消息与 Work Canvas 展示，不拥有 Composer 状态。
- `center/composer/*`：draft/add menu/permission menu 等输入区域局部状态。
- `center/composer/runtime-control/*`：模型快切、reasoning preview/commit queue、boost。
- `right/*`、`terminal/*`：只消费父级显式 Props，不读取其他区域私有 State。

### CSS 所有权硬规则

1. 每个 UI 模块必须拥有自己的 `*.module.css`；静态布局/字体/背景/边框/hover/focus 只写入自己的 Module。
2. `agent-workbench.css` 在本轮结束后不得继续包含 Left/Center/Conversation/Composer/RuntimeControl/Right/Terminal/Overlay 的业务选择器；只允许保留真正全局 reset/token（若仍需要）。
3. 禁止通过 `:global(.agent-xxx)` 伪装 CSS Module。
4. 动态几何/拖拽/阻尼/粒子保持 TypeScript/共享 Primitive Owner；CSS Module 不新增第二套算法。
5. 模块禁止匹配兄弟模块 class；父模块只能控制自己的根布局。

### 允许修改

- `packages/client/app-shell/src/AgentWorkbench.tsx`（仅收敛 Composition Root）；
- `packages/client/app-shell/src/workbench/**` 全域等价模块迁移；
- `packages/client/app-shell/src/agent-workbench.css`（只做删除/收敛到全局 token/reset）；
- `packages/client/app-shell/src/css-modules.d.ts`；
- workbench module boundary / UI contract / import contract 测试；
- 当前事实文档、版本元数据、CHANGELOG、RELEASES。

### 禁止修改 / 行为冻结

- 禁止改变 `packages/client/ui/src/ui-controls/**`、`ui-effects/**`、`ui-resize/**`、`ui-motion/**` 行为与视觉参数；
- 禁止改变 Provider Capability、Config System、Agent Runtime、Plugin Runtime、Rust、Windows Sync/GitHub/Setup/Update 业务；
- 禁止改变现有尺寸、颜色、文案、ARIA、快捷键、resize/snap、chat 对齐、reasoning/boost 语义；
- 禁止顺手修 #22.x 的视觉问题；本轮只做等价模块迁移；
- 禁止新增跨模块全局 CSS；
- 禁止父模块深链 import 子模块内部文件，统一走各模块 `index.ts`。

### 验收条件

1. `AgentWorkbench.tsx` 只做模块总装配，不再持有 AI/Plugin 映射函数、Run 事件细节、Overlay DOM、Left/Center/Right/Terminal DOM。
2. Left / Center(Header/Conversation/Composer/RuntimeControl) / Right / Terminal / Shell Overlay / Settings / Session 全部拥有独立目录、公共入口和样式 Owner。
3. Workbench 区域样式全部迁出共享大 CSS；不存在一个改动会通过全局 `.agent-*` selector 影响兄弟模块的路径。
4. 父子 import 只能走 `index.ts` 公共入口；兄弟模块不能深链。
5. v0.0.93 的用户可见行为保持等价；共享 UI primitive 目录零行为改动。
6. 自动门禁能阻止重新向 AgentWorkbench/全局 CSS 堆回区域实现。
7. workspace preflight、最终 ZIP Unicode round-trip 全部通过。

### 必须测试

- 扩展 `test/workbench-module-boundary.test.mjs`：检查所有大/小模块目录、`index.ts`、`*.module.css`、禁止深链和 AgentWorkbench 膨胀；
- `scripts/ui-contract-check.mjs`：禁止 `agent-workbench.css` 回归区域 selector；
- 既有 model quick switch / chat runtime / workbench snap / dismissible layer / shared UI tests 全部回归；
- `packages/client/ui/src/ui-controls|ui-effects|ui-resize|ui-motion` 与 v0.0.93 做零改动 diff；
- `node scripts/workspace-preflight.mjs`；
- 最终 ZIP fresh extract 后再次 preflight。

### CHANGELOG / 版本

- CHANGELOG 编号：`#21.23`
- 目标版本：`v0.0.94`
- 当前状态：`pending-user-acceptance`
- AI 验证：`pass`
- 用户验收：`pending`

## #21.22 Workbench 父子模块边界重构

### 用户目标 / 背景

v0.0.92 用户验收失败暴露出结构性问题：`packages/client/app-shell/src/AgentWorkbench.tsx` 同时包含左侧栏、中间 Header、Chat/Work 主区、Composer、Runtime Control、右侧资源栏、底部终端和 Shell 总装配。局部修复容易扩大修改面并造成已通过功能回归。用户明确要求工作台按“父模块 → 大区域子模块 → 区域内部小模块”组织，修改某个子模块时不得顺带影响兄弟模块。

本轮**从 v0.0.91 重新建立 v0.0.93 基线**，不继承 v0.0.92 的业务代码。目标只做模块边界重构与防回归门禁，保持 v0.0.91 的 UI/行为/CSS 语义不变。Reasoning Slider 的视觉修复另开后续子任务，只允许在对应 Composer/RuntimeControl 子模块内完成。

### 主模块 / 状态所有权

```text
AgentWorkbench（根父模块 / Composition Root）
├─ LeftSidebarRegion（左侧栏大模块）
│  ├─ BrandSwitcher
│  └─ ProfileBar
├─ CenterWorkspaceRegion（中间区大模块）
│  ├─ CenterHeader
│  ├─ ConversationRegion
│  │  ├─ ChatTimeline
│  │  └─ WorkCanvas
│  └─ ComposerRegion（输入框大子模块）
│     ├─ AddCapabilityMenu
│     ├─ PermissionControl
│     └─ RuntimeControl（模型 / reasoning / 强力推理）
├─ RightSidebarRegion（右侧栏大模块）
└─ BottomTerminalRegion（底部终端大模块）
```

- `AgentWorkbench`：只拥有跨区域 Shell 状态、业务 Snapshot、Host/Runtime 装配和区域间回调；不得再直接写区域内部 JSX。
- 各 Region：只拥有自己区域的局部 UI 状态；通过明确 Props/Callback 与父模块通信，禁止直接读取兄弟模块内部状态。
- `ComposerRegion`：拥有输入草稿、Add/Permission/Runtime Control 的局部交互；Chat Timeline 不得依赖 Composer 内部 State。
- `RuntimeControl`：后续 reasoning 修复唯一允许落点；不允许因此修改 Left/Right/Terminal/Conversation。
- `packages/client/ui`：继续拥有真正共享 Primitive（Slider、Effect、Resize、Overlay），本轮不改变其行为。

### 允许修改

- `packages/client/app-shell/src/AgentWorkbench.tsx`：收敛为 Composition Root；
- 新增 `packages/client/app-shell/src/workbench/**` 父子模块文件与本目录 README；
- `packages/client/app-shell/src/workbench.types.ts`：仅提取区域共享 ViewModel 类型；
- `packages/client/app-shell/src/README.md`、架构/模块/UI/测试/代码地图文档；
- 新增模块边界防回归测试。

### 禁止修改 / 行为冻结

1. **禁止继承 v0.0.92 业务改动**；基线必须是 v0.0.91。
2. 本任务禁止改变 Runtime reasoning 档位过滤、强力推理语义、粒子算法、Slider Pointer 算法。
3. 禁止改变现有 CSS selector、尺寸、颜色、动画参数、布局数值；本任务不做视觉设计。
4. 禁止改变 Chat Timeline 与 Composer 的左右对齐行为。
5. 禁止改变左右栏/底部终端 Resize、Snap、快捷键、Hover Preview。
6. 禁止修改 `packages/client/ui/src/ui-controls/**`、`ui-effects/**`、`ui-resize/**`。
7. 禁止把业务逻辑移入 `apps/web` 或 `packages/client/ui`。
8. 子模块不得跨层 import 另一个兄弟模块的内部文件；共享契约进入 `workbench/contracts.ts` 或公共父级。

### 实现约束

1. 迁移必须是“代码等价移动”：保留原 DOM className、ARIA、回调时序与 localStorage key。
2. 每个大模块文件必须写结构化中文文件头：负责 / 不负责 / 状态归属 / 对外接口 / 子模块 / 修改注意事项。
3. `AgentWorkbench.tsx` 中不得再声明 `LeftSidebar/CenterWorkspace/RightSidebar/BottomTerminal` 实现。
4. 中间区必须进一步拆为 Header、Conversation、Composer；Composer 内 Runtime Control 必须是独立子模块。
5. 模块间只通过 typed Props/Callback；不得用 DOM query、全局变量或共享 mutable singleton 串状态。
6. CSS 本轮保持原文件不动，避免“结构重构 + 视觉重构”同时发生；后续如拆 CSS 必须单独任务并保持 selector namespace。
7. 新增自动检查：大区域组件必须位于规定目录；`AgentWorkbench.tsx` 行数/区域实现标记不得回退成单文件巨石；RuntimeControl 修改 allowlist 可在后续任务单独启用。

### 验收条件

1. 左侧栏、中间区、右侧栏、底部终端成为四个独立大模块。
2. 中间区的 Conversation 与 Composer 独立；Composer 中 Runtime Control 独立。
3. `AgentWorkbench.tsx` 只做父级状态与装配，不再包含区域内部 JSX。
4. v0.0.91 的现有 CSS class、快捷键、Resize/Snap、Chat/Composer 对齐、模型切换与 reasoning 行为不发生语义变化。
5. 后续修改 RuntimeControl 时，代码层面不需要编辑 LeftSidebar/RightSidebar/BottomTerminal/Conversation 文件。
6. 模块边界检查、现有 UI contract、workspace preflight 全部通过。

### 必须测试

- 新增 `test/workbench-module-boundary.test.mjs`；
- `node --test test/ui-interaction-motion.test.mjs`；
- `node --test test/ui-shared-module-contract.test.mjs`；
- `node --test test/model-quick-switch-contract.test.mjs`；
- `node scripts/ui-contract-check.mjs`；
- `node scripts/folder-boundary-check.mjs`；
- `node scripts/workspace-preflight.mjs`；
- 对 v0.0.91 → v0.0.93 做文件级 diff，确认 `packages/client/ui/src/ui-controls/**`、`ui-effects/**`、`ui-resize/**` 零改动。

### AI 验证结果

- Workbench/既有行为聚焦回归：45/45 PASS。
- 全仓 Node 合同测试：140 项中 139 项 PASS；唯一 `node-source-runtime.test.mjs` 受当前 Node 22.16.0 + 无 pnpm workspace `node_modules` 环境阻断。
- 本轮 15 个 TS/TSX 语法 transpile：PASS。
- `agent-workbench.css`、`ui-controls`、`ui-effects`、`ui-resize` 相对 v0.0.91：零改动。
- `workspace-preflight`：全 Gate PASS。
- Unicode ZIP 候选包 fresh round-trip：359 entries；中文 canonical entry UTF-8 bit 11 / `0x800`；`.lfaa/` 保留；解压后 preflight 再次 PASS。

### 必须更新文档

`PROJECT_PLAN.md`、`docs/DEVELOPMENT_LOG.md`、`ARCHITECTURE.md`、`docs/MODULES.md`、`docs/UI.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`packages/client/app-shell/src/README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG / 版本

- CHANGELOG 编号：`#21.22`
- 目标版本：`v0.0.93`
- 当前状态：`pending-user-acceptance`
- AI 验证：`pass`
- 用户验收：`pending`

## #22.7 Reasoning Slider 几何与粒子修复尝试（v0.0.92，已否决）

- 状态：`superseded` / `not-accepted`。
- 用户验收结论：局部修复扩大修改面，出现未要求功能消失与既有问题回归。
- 处理：v0.0.93 不继承 v0.0.92 业务代码，重新从 v0.0.91 建基线；Reasoning 修复必须等父子模块边界建立后，只修改 RuntimeControl 子模块。

## #22.6 Canvas 粒子渲染与 reasoning 提交闪烁修复

### 用户目标 / 背景

v0.0.90 实机反馈未通过：reasoning Slider 拖拽松手后仍会出现明显闪烁；点击“强力推理”闪电按钮后没有可见动态粒子。用户同时要求评估是否继续使用 CSS Keyframes，优先选择更稳定、不会被 React 重渲染 / Windows 合成层切换影响的渲染方式。

本轮将粒子运动从“多个 DOM `<i>` + CSS `@keyframes`”迁移为**单 Canvas 2D + requestAnimationFrame**。CSS 只保留 Canvas 的定位/尺寸，不再承担粒子运动算法。Reasoning 设置提交改为乐观 UI + 串行持久化队列，不再在 PointerUp 时把整条 Slider 置为 disabled，从源头消除“松手瞬间 opacity 下降再恢复”的闪烁。

### 主模块 / 状态所有权

- `packages/client/ui/src/ui-effects`：拥有 Canvas 粒子 Renderer、Palette 解析、rAF 生命周期、DPR/ResizeObserver、reduced-motion。
- `packages/client/ui/src/ui-controls`：拥有 Slider Pointer/Keyboard、visual progress 与 settle；不拥有业务保存 busy。
- `packages/client/app-shell`：拥有 reasoning 业务选择、强力推理 Hint 与 Provider setting 的异步提交队列。
- `packages/settings/config-system`：继续拥有 Provider Capability 真值，本轮不改档位来源。

### 允许修改

- `packages/client/ui/src/ui-effects/**`、`packages/client/ui/src/ui-controls/**`；
- `packages/client/app-shell/src/AgentWorkbench.tsx`、相关 CSS；
- UI/交互契约测试与文档、版本元数据、CHANGELOG / RELEASES。

### 禁止修改 / 安全边界

- 禁止用 React State 做逐帧粒子动画；禁止每帧触发父业务组件重渲染。
- 禁止重新使用多个 DOM 粒子 + CSS `@keyframes` 作为主动画实现。
- 禁止在 reasoning setting 保存期间把整条 Slider opacity 降低造成提交闪烁。
- 禁止强力推理开关修改 Provider reasoning 档位；`reasoningBoost` 继续正交。
- 禁止改变 #22.5 的动态 Capability 档位规则。

### 实现约束

1. Effect Host 常驻为单个 `<canvas>`；`active=false` 时取消 rAF 并清屏，`active=true` 时启动。
2. Canvas 只绘制当前 Slider 已填充区；拖拽中的连续进度直接读取 Slider 局部 CSS variable，不经过 React State。
3. standard 使用粉色 Palette；最高官方档 extreme 使用淡粉 → 粉 → 紫 → 深紫的水平渐变。Palette 仍通过可覆盖 CSS Token 解析，后续设置中心可改色。
4. 使用 `ResizeObserver + devicePixelRatio` 保证清晰度；`prefers-reduced-motion: reduce` 时停止粒子。
5. Slider 提交采用本地立即选中 + Promise 串行队列写 Provider setting；模型切换 busy 与 reasoning setting 保存 busy 分离。
6. PointerUp 不再制造额外 preview(next) → preview(null) 双重业务渲染；settle 仅负责视觉位置。

### 验收条件

1. 点击闪电开启强力推理后，Slider 填充区立即出现持续运动粒子；关闭后立即清空并停止动画。
2. 普通档粒子为粉色系；最高官方档粒子沿轨道呈淡粉→粉→紫→深紫。
3. 连续拖拽后松手，Slider / 卡片不再因 disabled opacity 或 Effect DOM 重建产生闪烁。
4. 快速连续选择不同 reasoning 档时 Provider setting 按用户提交顺序串行保存，不因异步完成顺序倒写。
5. 模型 Capability 动态档位与强力推理解耦规则不回退。

### 必须测试

- `node --test test/ui-interaction-motion.test.mjs`
- `node --test test/ui-shared-module-contract.test.mjs`
- `node --test test/model-quick-switch-contract.test.mjs`
- `node scripts/ui-contract-check.mjs`
- 新增 Canvas Effect / active gate / no CSS keyframes / no reasoning disabled-flash 契约测试
- 全仓可执行 Node 静态/契约测试 + `node scripts/workspace-preflight.mjs`

### 必须更新文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/DEVELOPMENT_LOG.md`、`docs/UI.md`、`docs/MODULES.md`、`docs/TESTING.md`、`ARCHITECTURE.md`、`docs/项目结构与代码地图.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG / 版本

- CHANGELOG 编号：`#22.6`
- 目标版本：`v0.0.91`
- 当前状态：`pending-user-acceptance`
- AI 验证：`pass`
- 用户验收：`pending`

## #20.19 Unicode ZIP 归档与 Sync 来源诊断修复

### 用户目标 / 背景

v0.0.90 在 Windows `LFAA-Sync.bat` 来源预检中失败，报告缺少 `docs/项目结构与代码地图.md`。复核最终 ZIP 发现归档器把 UTF-8 文件名字节写入 ZIP，却没有设置 ZIP General Purpose Bit 11（UTF-8 filename flag）；Linux `unzip` 可按本地启发式显示中文，但 Windows 解压后 canonical Unicode 路径丢失，导致治理 Gate 正确阻止同步。稳定工作区没有被修改，但发布包本身错误。

本轮必须修复**归档生成链路**而不是放宽治理检查，同时让 Sync 在 canonical Unicode 必需路径缺失时更早给出“来源包/解压编码损坏”诊断。

### 主模块 / 状态所有权

- `scripts/release-archive.mjs`：发布 ZIP 生成与 ZIP UTF-8 entry 事实 Owner。
- `scripts/windows/lfaa-sync.ps1`：只做来源目录编码/完整性 fail-safe，不负责修复坏包。
- `scripts/governance-check.mjs` / `workspace-preflight.mjs`：继续要求 canonical `docs/项目结构与代码地图.md`，禁止降级。

### 允许修改

- 新增 `scripts/release-archive.mjs` 与归档测试；
- `scripts/windows/lfaa-sync.ps1` 来源路径诊断；
- 根 package scripts / governance required list；
- 发布/同步文档、版本元数据、CHANGELOG / RELEASES。

### 禁止修改 / 安全边界

- 禁止把 `docs/项目结构与代码地图.md` 改成 ASCII 别名来绕过问题。
- 禁止删除 governance 对 canonical 中文路径的要求。
- 禁止 Sync 在来源 preflight 未通过时生成删除计划或修改稳定工作区。
- 禁止依赖平台默认 ZIP 编码行为；归档器必须显式写 UTF-8 filename flag。

### 实现约束

1. Release ZIP entry 名称统一 UTF-8 编码，并在 local header / central directory 设置 bit 11。
2. ZIP 根直接是项目内容；保留 `.lfaa/` 隐藏目录和空目录占位，排除 `.git/node_modules/dist/target`。
3. 打包后程序化校验：必须存在 exact `docs/项目结构与代码地图.md` entry，且该 entry UTF-8 flag 为真。
4. Sync 的“路径编码正常”只能在 canonical Unicode 必需路径存在且没有 mojibake 后输出；缺失时在运行 workspace-preflight 之前停止并给出明确修复提示。
5. Windows PS1 保持 UTF-8 with BOM。

### 验收条件

1. 新 ZIP 在 Windows 解压后真实存在 `docs/项目结构与代码地图.md`。
2. Python/Node 读取 ZIP central directory 时该 entry 的 UTF-8 bit=1。
3. 从最终 ZIP 新目录解压后 `node scripts/workspace-preflight.mjs` PASS。
4. Sync 对缺失 canonical Unicode 文件的坏来源包在 diff 前停止，并明确指出来源包/解压编码问题。
5. 目标稳定工作区在来源失败时保持零修改。

### 必须测试

- `node --test test/release-archive.test.mjs`
- `node --test test/release-path-encoding.test.mjs`
- `node --test test/workspace-sync-idempotency.test.mjs`
- `node scripts/windows-script-encoding-check.mjs`
- `node scripts/workspace-preflight.mjs`
- 使用 `scripts/release-archive.mjs` 生成 v0.0.91 ZIP → 读取 central directory 验证 UTF-8 flag → 新目录 round-trip → 再次 preflight。

### 必须更新文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`ARCHITECTURE.md`、`docs/项目结构与代码地图.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG / 版本

- CHANGELOG 编号：`#20.19`
- 目标版本：`v0.0.91`
- 当前状态：`pending-user-acceptance`
- AI 验证：`pass`
- 用户验收：`pending`

## #22.5 Provider 实际推理档位动态投影修正

### 用户目标 / 背景

v0.0.89 的“固定六档 UI，再映射到 Provider 官方值”仍然不符合产品真实语义。用户明确修正：推理档位数量不能由 LFAA 固定，更不能把少量 Provider 档位复制成六个视觉档。Runtime Control 必须以**当前实际模型的官方 Capability**为唯一事实源：厂商/账户当前返回几档就显示几档；当前模型完全没有推理强度能力就不显示推理 Slider。

例如 ChatGPT/Codex 套餐优先使用当前 `model/list.supportedReasoningEfforts`；API Provider 使用 Config System 已经由官方运行时接口/官方文档确认并写入当前模型 Capability 的 `reasoningEffort.options`。LFAA 不猜模型名、不补档、不删档、不把 `none/off` 全局过滤掉；只有 Provider 没有返回该选项时 UI 才没有该选项。

### 主模块 / 状态所有权

- `packages/settings/config-system`：继续拥有当前模型 Capability 与 `reasoningEffort.options` 真值；本任务不复制第二份 Provider 能力表。
- `packages/client/app-shell`：只把 `activeReasoning.field.options` **一对一**投影成 Runtime Slider steps，并提交被选中的原始 `option.value`。
- `packages/client/ui/src/ui-controls`：继续只负责任意 steps 数量的 Pointer/Keyboard Slider，不拥有模型档位。
- `packages/client/ui/src/ui-effects`：只消费“当前是否位于 Provider 最高官方档”的视觉 variant，不定义档位数量或名称。
- `packages/core/agent-runtime`：`reasoningBoost` 继续是与 Provider reasoning 正交的 Agent Run Hint。

### 允许修改

- `packages/client/app-shell/src/reasoning-control.ts`、`AgentWorkbench.tsx`；
- 与 Runtime reasoning 动态档位有关的测试 / UI Contract；
- 当前事实文档、版本元数据、CHANGELOG / RELEASES。

### 禁止修改 / 安全边界

- 禁止固定 `极低/低/中/高/极高/极限` 六个档位。
- 禁止把 Provider 的 2/3/4/5 档重复映射成 6 档；Slider step 数必须与当前 `reasoningEffort.options.length` 一致。
- 禁止通过模型名称猜档位；只允许消费当前模型 Capability。
- 禁止全局过滤 `none/disabled/off`；如果 Provider 官方 Capability 明确列出它，它就是一个真实 option，应原样保留。
- 禁止模型没有 `reasoningEffort` 时生成默认档、占位档或假的 Slider。
- 禁止强力推理切换时改写当前 Provider reasoning option；每一个真实 Provider 档位都允许独立开/关 `reasoningBoost`。
- 不回退 #22.4 已完成的 Chat 左右基线、Slider 拖拽、白色 Thumb、粒子稳定挂载和闪屏修复。

### 实现约束

1. `resolveReasoningStages(options)` 必须保持 Provider option 的数量、顺序、label、value 一一对应，不做 semantic rank、插值、补齐或复用。
2. 当前值反推 index 只能做 `option.value === activeReasoning.value` 的精确匹配；默认值同理。
3. Runtime Slider `steps` 直接来自动态 stages；0 档时整个 Slider/重置/强力推理入口按“无 reasoning capability”语义隐藏或禁用，不制造假档。
4. 最高官方档仅作为 LFAA 的视觉/默认强力推理触发位置：不重命名 Provider label，不改变提交值；强力推理仍可在任意真实档位手动开关。
5. 模型切换必须重新读取该模型 Capability 并重建 steps；从 5 档模型切到 3 档/0 档时不得保留旧档位 DOM 或越界 index。
6. ChatGPT/Codex 套餐的 `supportedReasoningEfforts` 继续由 App Server 实时目录进入 Capability；API Provider 继续走已验证 Capability，不增加 UI 侧厂商分支。

### 验收条件

1. Provider 报 5 档，UI 就 5 档；报 3 档就 3 档；报 1 档就 1 档；没有 `reasoningEffort` 就没有 reasoning Slider。
2. 每个 step 的 label/value 与 Capability option 一对一，不再出现 LFAA 自造 `极低/极高/极限`。
3. Provider 明确提供 `none/关闭思考` 时 UI 保留；Provider 没提供时 UI 不生成“关闭思考”。
4. 切换不同模型后档位数量即时匹配新模型真实 Capability，不残留上一模型的 steps。
5. 选择任一档只提交该 option 的原始 `value`；Run 不出现未声明 Provider 参数。
6. 强力推理在每个真实档位均可独立开/关，不强制跳最高档。
7. 最高官方档继续使用 extreme 粒子视觉；普通档使用 standard；不改 Provider label。
8. #22.4 的对话对齐、拖拽平滑、白色 Thumb、悬浮卡不闪屏规则全部不回退。

### 必须测试

- `node --test test/model-quick-switch-contract.test.mjs`
- `node --test test/ui-shared-module-contract.test.mjs`
- `node --test test/ui-interaction-motion.test.mjs`
- `node --test test/chat-runtime-contract.test.mjs`
- `node scripts/ui-contract-check.mjs`
- 新增/更新动态 0/1/3/5 档与 `none` 保留契约测试
- 全仓可执行 Node 静态/契约测试 + `node scripts/workspace-preflight.mjs`
- 最终 ZIP Unicode / `.lfaa` round-trip 后再次 `workspace-preflight`

### 必须更新文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/DEVELOPMENT_LOG.md`、`docs/UI.md`、`docs/MODULES.md`、`docs/TESTING.md`、`ARCHITECTURE.md`、`docs/项目结构与代码地图.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG / 版本

- CHANGELOG 编号：`#22.5`
- 目标版本：`v0.0.90`
- 当前状态：`pending-user-acceptance`
- AI 验证：`pass`
- 用户验收：`pending`

## #22.4 Chat 对齐 / 六档推理控制 / 粒子拖拽稳定性修复

### 用户目标 / 背景

v0.0.88 实机反馈确认未通过：Chat Timeline 的用户/AI 消息没有与 Composer 共用左右基线；Runtime Control 的强力推理图标与卡片几何存在对齐问题；reasoning slider 缺少符合参考体验的连续拖拽与白色 Thumb 跟手感，粒子/流星效果不够动态，且 Slider 区域会带动整张悬浮卡片出现闪烁/闪屏。当前“强力推理 = 直接切最高 reasoning 档”的语义也不符合产品需求。

本轮必须在不伪造 Provider 能力的前提下，把 UI 统一成固定六档视觉等级：`极低 / 低 / 中 / 高 / 极高 / 极限`。六档是 LFAA 的显示/交互刻度，实际提交值必须映射到当前模型官方 Capability 已声明的非关闭 reasoning 值；不得向 Provider 发送不存在的档位。强力推理改为与档位正交的独立 Run Hint：任何档位都可开/关；切换档位不得自动关闭或切换强力推理；进入“极限”时若用户没有显式关闭过，则默认开启强力推理，但“强力推理”本身不得再把档位强制改成极限。

### 主模块 / 状态所有权

- `packages/client/app-shell`：拥有 Composer Runtime Control 的交互投影、六档视觉等级到 Provider Capability 的映射、当前会话的强力推理 UI 状态；不拥有 Provider Capability 真值。
- `packages/client/ui/src/ui-controls`：拥有通用离散 Slider 的 Pointer/Keyboard、白色 Thumb、拖拽 Preview 与平滑视觉过渡；不得包含模型语义。
- `packages/client/ui/src/ui-effects`：拥有粒子/流星 Renderer、颜色 Token/Palette 与动画；不得参与业务布局或 Provider 参数。
- `packages/core/agent-runtime`：如需让强力推理真实进入 Run，只允许新增通用 `reasoningBoost`/execution hint 契约；不得冒充 Provider setting。
- `apps/web/dev/bridges/agent`：只消费 Runtime Hint，并以不泄露 Secret、不发送未声明 Provider 参数的方式影响开发态真实 Run。

### 允许修改

- `packages/client/app-shell/src/AgentWorkbench.tsx`、`reasoning-control.*`（如拆分）、`agent-workbench.css`；
- `packages/client/ui/src/ui-controls/**`：Slider Motion / Thumb / CSS Variables；
- `packages/client/ui/src/ui-effects/**`：粒子 Renderer、Palette、CSS Variables；
- `packages/core/agent-runtime/**` 与 `apps/web/dev/bridges/agent/**`：仅限独立强力推理 Run Hint 的真实接线；
- `test/model-quick-switch-contract.test.mjs`、`test/ui-shared-module-contract.test.mjs`、`test/ui-interaction-motion.test.mjs`、`test/chat-runtime-contract.test.mjs`、`scripts/ui-contract-check.mjs`；
- 当前事实文档、版本元数据、CHANGELOG / RELEASES。

### 禁止修改 / 安全边界

- 禁止把 `极低/低/中/高/极高/极限` 六个 UI 名称直接当作 Provider 参数发送；只允许映射到当前模型官方 Capability 已声明值。
- 禁止重新引入“关闭思考”作为 Runtime Control Slider 档位；Provider Capability 内若存在 `none/disabled/off`，只在本控件映射时排除，不篡改 Provider 原始 Catalog。
- 禁止强力推理按钮自动把 Slider 改到最高档；禁止拖 Slider 自动关闭强力推理。
- 禁止粒子组件读写业务 State、测量/改变卡片尺寸，禁止每帧 React State 更新；动画只使用 CSS transform/opacity/background-position 等 compositor-friendly 路径。
- 禁止通过 `key` 重建 Runtime Card、在 Pointer Move 时 mount/unmount 整个 Effect/Popover、或用 `contain: paint` 裁剪 Tooltip。
- 不修改 #2.15 已验收的侧栏隐藏超拖 50% 吸附规则。

### 实现约束

1. Chat Timeline 与 Composer 使用同一个水平几何 Token；用户消息容器右边缘与 Composer 右边缘对齐，AI/错误消息左边缘与 Composer 左边缘对齐，Compact/Mobile 同样成立。
2. 六档视觉等级由单一常量表定义，标签、Index、默认极限行为、主题色全部变量化；后续 Settings 可以只覆盖 CSS Custom Properties / Palette 而不改算法。
3. Provider reasoning 只取官方 Capability 的“非关闭选项”，按强度顺序归一映射到六个 UI index；同一 Provider 值允许被相邻 UI 档复用，保证绝不构造未声明值。
4. 强力推理作为独立 Boolean 状态进入下一次 Agent Run；极限只负责“默认建议开启”，不能形成不可关闭的耦合。用户显式关闭后停留极限仍保持关闭，直到用户再次开启或模型切换/重置策略明确触发。
5. Slider Pointer Move 只更新本地 Preview；Thumb 使用 transform/left 的稳定过渡，按下时可短暂放大，释放时有轻微阻尼式 settle；必须显示 `cursor: grab/grabbing` 和可见白色 Thumb。
6. 粒子层常驻 Slider 内部，使用 `data-active/data-variant` 或 CSS variable 控制透明度/动画，不因每次拖动反复 mount/unmount；普通档使用粉色粒子，极限使用淡粉→粉→紫→深紫渐变粒子。
7. Runtime Card 本体不得因 Slider Preview 更新发生布局尺寸变化；去除会诱发整卡合成层闪烁的无必要 GPU/contain 组合，仅对真正动画子层做 compositor hint。

### 验收条件

1. Chat 中用户消息右边缘与输入框右边缘同基线；AI/错误消息左边缘与输入框左边缘同基线。
2. Runtime Card 顶部左/中/右三列视觉居中；强力推理 Bolt 不偏移。
3. Slider 始终只有六档：极低、低、中、高、极高、极限；不显示“关”。
4. 强力推理可以在六个档位任意开启/关闭；点击强力推理不改变当前档位；拖拽档位不关闭强力推理。
5. 首次进入极限档默认开启强力推理；用户在极限显式关闭后不会被拖拽/重渲染强制重新打开。
6. Slider 有清晰白色 Thumb，Pointer 光标为 grab/grabbing，拖动连续，不出现跳点、瞬移或卡片闪白。
7. 普通档粒子为粉色；极限档粒子轨迹为淡粉→粉→紫→深紫渐变，并能持续动态流动；reduced-motion 下停用动画。
8. 快速拖拽、Hover、打开模型列表、切模型、开关强力推理 30 次，Runtime Card 不闪屏、不闪白、不抖动，不因 Effect DOM 反复挂载产生布局变化。
9. Agent Run 只携带官方 Capability 允许的 reasoning 值；独立强力推理 Hint 不进入 Provider model settings 白名单。

### 必须测试

- `node --test test/model-quick-switch-contract.test.mjs`
- `node --test test/ui-shared-module-contract.test.mjs`
- `node --test test/ui-interaction-motion.test.mjs`
- `node --test test/chat-runtime-contract.test.mjs`
- `node scripts/ui-contract-check.mjs`
- 全仓 Node 测试 + Config System 回归 + `node scripts/workspace-preflight.mjs`
- 最终 ZIP Unicode / `.lfaa` round-trip 后再次 `workspace-preflight`

### 必须更新文档

`PROJECT_PLAN.md`、`docs/DEVELOPMENT_LOG.md`、`docs/UI.md`、`docs/MODULES.md`、`docs/TESTING.md`、`ARCHITECTURE.md`（若 Runtime Hint 契约变化）、`docs/项目结构与代码地图.md`（若新增源码文件）、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG / 版本

- CHANGELOG 编号：`#22.4`
- 目标版本：`v0.0.89`
- 当前状态：`pending-user-acceptance`
- AI 验证：`pass`
- 用户验收：`pending`

## #22.3 真实 Chat Run / UI Motion 与阻尼 Resize 基础

### 用户目标

模型已经配置完成后，Chat 输入框必须真正可以发送并得到 Provider 的真实回复；不得继续停留在只构造 Run Request 的假入口。同时将快捷键、浮层层级、模型控制卡展开/收起动画和工作台拖拽/吸附阻尼抽成 `packages/client/ui/src/ui-xxx` 共用能力。模型控制卡展开/恢复要有连续、柔和但不过慢的过渡；侧栏继续保留“达到最小宽后还需额外超拖 50% 最小宽才吸附”的既有交互。

### 允许修改

- `packages/core/agent-runtime/**`：补最小 Run Event/订阅契约。
- `apps/web/dev/bridges/agent/**`、`apps/web/src/host/**`、`apps/web/vite.config.ts`：接入 Web 开发态真实模型 Run Bridge。
- `packages/client/app-shell/**`：Chat Timeline、发送状态、共享 UI 能力接线。
- `packages/client/ui/src/ui-motion/**`：稳定挂载的展开/收起 Motion。
- `packages/client/ui/src/ui-shortcuts/**`：共享快捷键 Hook。
- `packages/client/ui/src/ui-resize/**`：阻尼尺寸跟随 Primitive。
- `packages/client/ui/src/ui-overlay/**`：统一 Layer Token。
- `packages/client/ui/src/workbench/**`：只允许消费共享 Resize Primitive，不重复实现阻尼算法。
- 对应测试、治理、版本与架构文档。

### 禁止修改 / 边界

- 不把 Provider Secret 返回浏览器；API Key 只允许在 Node Host 内按 `credentialRef` 临时读取。
- 不伪造本地 AI 回复；Chat 结果必须来自真实 Provider 调用，失败则明确显示失败。
- 本任务只闭环 API Key / OpenAI-compatible 开发态文本对话；ChatGPT/Codex 套餐仍由官方 Harness Adapter 承担，不伪装已完成。
- 本任务不宣称 Tool / Skill / MCP / Subagent 已进入真实执行链；它们留给 Capability Invocation P2。
- 不破坏 #2.15 已验收的最小宽超拖 50% 才吸附规则。
- UI 共用能力继续遵守 `packages/client/ui/src/ui-xxx`，业务组件禁止重新复制 outside-click、slider、阻尼或 layer 常量。

### 验收条件

1. 配置有效 API 模型后，Chat 输入可发送；用户消息进入 Timeline，Provider 返回后出现 Assistant 消息。
2. Provider/网络失败以错误消息显示，不产生伪回复；Secret 不进入浏览器响应、日志或 Timeline。
3. `Ctrl+Shift+M` 打开/关闭模型运行时控制；`Ctrl+Shift+P` 打开/关闭权限菜单，Tooltip 显示快捷键。
4. 模型列表在同一张 Runtime Control Card 内平滑展开/收起，不通过双 Popover 反复 mount/unmount；空白点击/Esc 仍可关闭。
5. Tooltip / Popover 层级由 `ui-overlay` 统一 Layer Token 管理，不被 Runtime Card 裁剪。
6. Workbench 侧栏尺寸跟随使用共享阻尼算法，视觉跟随连续；达到最小宽后只有继续超拖 `0.50 * minWidth` 才进入吸附捕获。
7. 新增 UI 共用模块必须有 README、公开出口和契约测试。

### 必须测试

- `test/chat-runtime-contract.test.mjs`
- `test/ui-interaction-motion.test.mjs`
- `test/workbench-snap-animation.test.mjs`
- `test/model-quick-switch-contract.test.mjs`
- `test/ui-shared-module-contract.test.mjs`
- `node scripts/ui-contract-check.mjs`
- 全仓 Node 回归 + Config System 回归 + `workspace-preflight`。
- 最终 ZIP UTF-8 / `.lfaa` round-trip 后重新执行 `workspace-preflight`。

### 状态

`pending-user-acceptance`

## #21.21 UI 共享模块 / Effect & Extension Registry 收敛

### 用户目标

所有 UI 复用能力继续归 `packages/client/ui`，新增共享模块用 `ui-xxx` 命名；通用交互不要在业务组件重复写。具有独立安装/卸载生命周期的 Effect/Renderer/Panel 等 UI 能力允许插件化，基础 UI Kernel 不允许被卸载。

### 允许修改

- `packages/client/ui/src/ui-xxx` 共享模块与公开 exports；
- App Shell 对共享 Slider/Effect 的消费；
- UI 架构/测试/治理门禁。

### 禁止修改

- 不改变 Config/Agent Runtime 模型业务真值；
- 不允许普通插件直接操作 document/body；
- 不为了目录重构搬动既有 `layout/workbench/features`；
- 不把 UI Primitive 做成必须安装才能启动的插件。

### 验收

- outside-dismiss、Slider、Effect 都存在唯一共享 Owner；
- App Shell 不再实现 Pointer slider/粒子细节；
- Effect/Extension Registry 支持 owner 卸载 + generation；
- v0.0.86 Runtime Control 行为保持不变。

## #21.20 Composer 统一模型运行时控制器 / Popover 闪烁修复

### 用户目标

Composer 右下角的模型、思考强度和强力推理必须是一个整体运行时控制器：点击后出现一张稳定悬浮卡片；顶部三键分别控制强力推理、模型切换、重置；下方强度条支持点击和拖拽。点击卡片外空白处必须关闭。三种权限菜单同样使用紧凑悬浮交互。严禁再次出现点击/切换时某块区域瞬间闪白或跳动的 `Popover flicker / layout flash`。

### 允许修改

- App Shell Composer 的模型/推理/权限交互与对应 CSS；
- `@lfaa/ui` 增加可复用 outside-dismiss Primitive；
- Workbench 通用图标；
- UI/模型快切/共享关闭行为的测试与门禁；
- UI/开发/发布文档。

### 禁止修改

- 不创建第二份 Active Model / reasoning 业务真值；
- “强力推理”不得发送厂商 Capability 未声明的超限参数，只能选择当前模型公开支持的最高档；
- 不用频繁 mount/unmount 两个相邻 Popover 模拟一个整体控件；
- 不在各业务组件复制 document outside-click 监听；
- 不允许粒子特效参与布局计算或造成性能抖动；
- 不牺牲键盘可访问性和 reduced-motion。

### 验收

- 已配置模型时 Composer 只有一个模型运行时入口；打开后是一张卡片，不发生闪屏/闪白/位置跳变。
- 顶部左键可进入/退出强力推理，中间可切模型，右键可恢复模型默认 reasoning 档。
- 强度轨道可点击、拖动、方向键/Home/End 调整，提交值仍经 Config System 校验。
- 强力推理打开后出现轻量粒子/流星效果，关闭或系统 reduced-motion 时停止。
- 点击卡片外空白处或按 Escape 关闭；LFAA 模式、添加、权限、模型控制复用同一个 `useDismissibleLayer`。
- 权限卡保持三种模式，但宽度/留白明显收紧，不再占据大块工作区。

## #21.19 Composer 模型 / 思考强度原地快切

### 用户目标

模型已经配置后，Chat / Work 输入区右下角必须像 Codex 一样原地交互：点击模型直接弹出可用模型列表，点击思考强度直接调整当前模型支持的档位；只有第一次完全没有可用模型时才进入 `设置 → AI 与模型`。

### 允许修改

- App Shell Composer 的模型/思考强度交互；
- Config System 的“基于缓存官方目录快速激活模型”业务方法；
- Web AI Settings Host/Bridge 对应接口；
- AgentModelBinding，使已校验模型 settings 真正进入下一次 Run；
- 对应 UI/Config/Runtime 测试和文档。

### 禁止修改

- 不新增第二份模型列表或 UI 私有 Active Model；
- 不让每次日常切模都重新请求 Provider；
- 不在 Quick Switch 中读取/显示 API Key；
- 不把 Settings 的账户认证职责搬进 Composer；
- 不做只改标签、不影响下一次 Agent Run 的假思考强度。

### 验收

- 已有 `modelCatalog` 时点击模型不跳 Settings；模型列表原地弹出并可切换。
- 当前模型声明 reasoningEffort 时可原地选择官方支持档位；切换后刷新仍保持。
- 零模型目录时才进入 AI 与模型完成首次配置。
- `管理模型` 是 Popover 次级入口。
- Chat / Work 共用同一 Active Model 与 settings。

## #2.19 Provider Host 网络代理 / 系统 CA / 可诊断错误修复

### 用户目标

修复输入 OpenAI/DeepSeek API Key 后出现 `fetch failed` 或难以判断的 HTTP 错误：浏览器代理、Windows 系统代理、Node Host 网络和系统 CA 必须形成可维护的明确边界，同时错误信息要能定位网络/认证类别且不能泄露 Secret。

### 允许修改

- Web 开发 Host 的 Provider HTTP Adapter；
- Windows Setup 启动 Web 时的临时网络环境；
- Provider 网络错误脱敏分类；
- 对应测试、运行时、版本和测试文档。

### 禁止修改

- 不关闭 TLS 证书校验；
- 不把 API Key / Token / Proxy credential 写入日志、账户 JSON、浏览器 Storage；
- 不把远端 Provider 错误 body 直接回传 UI；
- 不因网络修复修改 Active Model / Plugin Platform / Rust Secret Broker 业务语义；
- 不永久修改用户系统代理或全局环境变量。

### 验收条件

- `LFAA-Setup.bat → 2` 的 Node/Vite Host 显式启用 Node 24 env proxy 与 system CA；
- 无显式代理变量时可继承 Windows 当前用户已启用的静态 HTTP/HTTPS 系统代理，停止 Web 后恢复原环境；
- `fetch failed` 至少可区分 DNS / timeout / refused / reset / TLS；401/403/429/5xx 有清楚错误；
- TLS 校验不能被禁用，Secret/Headers/远端错误体不能出现在 UI/日志；
- Windows 实机 OpenAI/DeepSeek Provider 探测可根据真实网络/凭据给出正确结果。

## #2.18 模型管理 Active Model / Catalog 真值修复

### 用户目标

修复模型管理无法稳定配置的问题：账户认证、账户默认模型和当前 Agent 模型必须是清楚的独立事实；保存/刷新后模型目录仍可配置，多 Provider/多账户切换不能依赖数组顺序。

### 允许修改

- Config System Account / Active Model / modelCatalog 契约与服务；
- Web Host 账户状态 Repository / Bridge / Client；
- Settings AI 模型管理 UI 与 App Shell 模型投影；
- 对应测试、运行时、模块、版本文档。

### 禁止修改

- 不把 API Key / Token 写入 JSON、浏览器 Storage、日志、argv/env；
- 不把完整 Model Router / Fallback 提前塞进 Config System；
- 不重新用 accounts 顺序猜当前模型；
- 不因配置修复修改 Frozen Rust Kernel 业务边界。

### 验收条件

- Snapshot 有显式 activeModel，Composer 只消费它；
- modelCatalog 可持久化并在 Settings 重开后直接显示；
- 第二账户不会自动抢占当前模型，显式激活才切换；
- Secret 仍只有 credentialRef，关键持久化失败可回滚；
- Windows 实机真实 Provider 保存/刷新/切换链路通过。

## #2.17 Node ESM Source Package 运行时导入修复

### 用户目标

修复 v0.0.81 `LFAA-Setup.bat → 2` 启动 Web 时的 `ERR_MODULE_NOT_FOUND`，并阻止 Node/Vite Config 直接执行的 workspace TypeScript ESM 源码再次出现无扩展名相对 import。

### 允许修改

- Node Runtime workspace package 的相对 ESM specifier；
- runtime import resolution Gate 与回归测试；
- 当前版本/测试/运行时文档。

### 禁止修改

- 不改变 PluginManager 安装事务/权限/Secret 语义；
- 不为修导入问题重新引入 alias；
- 不把 presentation/composition 的 Vite bundle 规则误当成 Node Host 规则。

### 验收条件

- Node source runtime 的相对 import 使用显式扩展名并指向真实文件；
- `runtime-import-resolution-check.mjs` 能机器阻断同类回归；
- Windows `LFAA-Setup.bat → 2` 不再停在 `plugin-runtime/src/registry` 模块解析错误。

## #20.18 Windows Setup PowerShell 智能引号解析修复

### 用户目标

修复 v0.0.80 `LFAA-Setup.bat → 1` 在依赖检测摘要阶段把中文 `“新增”` 错误解析为 `ConsoleColor` 参数、导致菜单直接失败的问题；同时把同类 PowerShell 智能引号风险做成长期机器门禁。

### 允许修改

- `scripts/windows/*.ps1` 的字符串/正则安全；
- `windows-script-encoding-check.mjs`；
- 依赖菜单静态回归；
- 当前版本/测试/运行时文档。

### 禁止修改

- 不改变依赖健康判断、pnpm install 决策与 Store 策略；
- 不改变 Plugin Platform / Agent Runtime / Secret 架构；
- 不把 PowerShell 用户文案迁入另一套脚本实现。

### 验收条件

- 所有 Windows PS1 不含 U+2018/U+2019/U+201C/U+201D；
- 治理 Gate 对再次出现智能引号直接失败；
- Setup 依赖基线文案使用 `「新增」`；
- Windows 实机菜单 1 能继续进入确认/安装或健康返回，不再出现 `ConsoleColor` 转换错误。

## #22.2 Plugin Profile 生命周期与项目骨架收敛

### 用户目标

在继续扩展“一切皆插件”之前，先审阅 DeepSeek Harness 源码并收紧 LFAA 整体骨架，使插件安装、文件夹边界、性能、安全和后续维护具备稳定可针对性修改的 seam；插件安装方式借鉴 DSH Profile/PluginManager，而不是手工复制文件。

### 允许修改

- workspace/package/crate 骨架与依赖方向 Gate；
- Plugin SDK / Runtime / Node Host / Settings Plugin Manager；
- 通用 Credentials seam 与现有 AI Secret Host Port 适配；
- Web 开发 Host bridge；
- v0.0.79 Unicode 发布包完整性门禁；
- 当前架构、测试、运行时和发布文档。

### 禁止修改

- 不重写 Codex / DeepSeek Harness Agent Loop；
- 不把用户插件加入 LFAA 根 package/lock；
- 不让第三方插件直接 import 进浏览器/Electron 高权限主进程；
- 不把 API Key / Token 写入 Manifest、`.lfaa` JSON、日志、argv/env；
- 不为未来规划创建无 Consumer 的空 package/crate；
- 不把未实现的 executable hot reload 写成已完成。

### 验收条件

1. workspace 只保留真实模块，并有机器化 layer/role/依赖方向/无环门禁；
2. Plugin Profile 独立于根 workspace，安装先 inspect，失败/取消回滚，新插件默认 disabled，build script 精确审批；
3. Settings 有“插件与能力”入口，可检查/安装/启停/移除，所有入口共享 PluginManager；
4. Plugin Manifest 只能声明 credential requirement，Secret 继续走 Rust Secret Broker/OS Credential Store；
5. 79 的中文路径问题在最终 ZIP entry + round-trip 解压后被验证；
6. 最终成品解压根再次通过 workspace-preflight；
7. 当前制作环境无法完成的 Node24/pnpm/Windows 动态测试必须明确标注 blocked，禁止冒充 PASS。

### 必须测试

- package architecture / folder boundary / language ownership；
- plugin platform + plugin manager UI contract；
- release Unicode/hidden path source gate + 成品 ZIP round-trip；
- 全仓 Node 可执行静态回归 + Config System 回归；
- workspace-preflight。


## #4.4 发布包隐藏资源完整性与同步前来源预检

### 背景

v0.0.78 源工作树包含 `.lfaa/README.md`、`manifest.json`、`lock.json` 与 skills/experts/plugins/extensions/mcp 骨架，但交付 ZIP 漏掉隐藏目录。Windows Sync 因来源包中看不到这些文件，把稳定工作区对应文件列为 DEL 并执行删除；同步后的 Governance 随即要求这些文件存在，因此失败。

### 目标

1. 修复发布包，确保 `.lfaa` 项目资源骨架随 ZIP 交付；
2. Sync 在生成 diff/delete plan 之前先对来源版本包运行统一静态 preflight；
3. 来源包预检失败时明确显示“稳定工作区尚未被修改”，禁止任何新增/修改/删除；
4. 继续复用同一个 `scripts/workspace-preflight.mjs`，不为 Source/Target 各维护一套 Gate；
5. 保持 `.lfaa/cache|state|tmp|logs` 为本机运行状态保护项，项目资源骨架仍可被正常版本升级。

### 禁止修改

- 不回退 v0.0.78 Plugin Platform / Capability Contract；
- 不改变 Agent Runtime、Config、UI、Rust Native Kernel 业务语义；
- 不把 `.lfaa` 整目录粗暴设成永不更新的保护目录；
- 不通过放宽 Governance 来掩盖坏包。

### 验收条件

- 新 ZIP 解压后 8 个 `.lfaa` 必需文件全部存在；
- 对缺 `.lfaa` 的坏包运行 Sync 时，在 diff/delete 前失败；
- 好包 Sync 后 Governance 不再报 `.lfaa/*` Missing；
- `.lfaa/state/dependency-state.json` 等本机状态不得再被镜像删除；
- 来源预检与目标工作区预检继续共用同一 Node Gate。

### 必须测试

- `test/workspace-sync-idempotency.test.mjs` 锁定 Source Preflight 在 `Get-SyncPlan` 与任何 destructive apply 之前；
- 统一 workspace preflight 与全部治理 Gate；
- 发布 ZIP 解压后再运行 workspace preflight，确认隐藏目录确实进入成品包。

## #22.0 统一 Agent Runtime、三档权限与无限画布工作台

### 主模块

`agent-runtime / app-shell / ui-workbench / runtime-adapters`

### 背景

用户明确 LFAA 的核心不是“聊天壳”或“工作台壳”，而是配置好的顶级大模型及其完整 Agent Harness 能力。Chat 与 Work 只是同一智能核心的两种入口：Chat 用一句话/对话驱动任务，Work 用无限画布组织同一任务、工具、子智能体、产物与状态。模型能力不能因为进入 LFAA 而被阉割；Tools / Skills / Experts / Commands / Sandbox / Subagents / Computer capabilities 应作为可组合能力增强模型。官方 Codex 与 DeepSeek Harness 是优先兼容/调用的成功 Runtime，不重新伪造其协议和内部能力。

### 任务目标

1. `packages/core/agent-runtime` 从空壳升级为统一 Runtime 公共契约，定义 Model、Tool、Skill、Expert、Command、Sandbox、Subagent、Harness Bridge、Run/Session Surface 等能力；
2. 用户只看到三档权限：`请求审批 / 替我审批 / 完全权限`，内部拆成 approval reviewer、sandbox、execution scope 三个不可混淆的轴；
3. `请求审批` 对每次 capability 调用 / 执行步骤逐次请求用户 Yes / No；`替我审批` 使用受限 sandbox + 自动风险审查/官方 reviewer；`完全权限` 显式请求 unrestricted profile，但仍不得绕过 Secret 隔离、OS 身份边界和 LFAA Trust Core；
4. Codex Adapter 只映射官方 App Server/CLI 能力；DeepSeek Harness Adapter 只映射官方 DSH/ACP/SDK 能力，不复制其内部 Agent Loop；
5. App Shell 增加 `Chat / Work` 两大 Surface，二者共享模型选择、权限 Profile、Run/Session 与能力注册，不复制 Agent 智能；
6. Work Surface 使用可平移、缩放、节点拖拽、连线的 Infinite Canvas；节点是 Run/Agent/Tool/Artifact/App 等 Runtime 实体的 UI Projection，不成为业务真值；
7. Composer 不再硬编码 `GPT-5.6 Sol`，优先显示 Config System 已配置账户的当前模型；没有可用模型时明确显示“未配置模型”，不伪装可执行；
8. “自主进化”只允许修改任务产物、代码、Skills、工作流和可审计的 Agent 配置；普通 Run 禁止自行修改 Permission Policy、Secret 边界、Trust Core 或关闭审计。

### 状态所有权

- Config System：账户、认证、模型选择配置；
- Agent Runtime：Session/Run、能力目录、权限 Profile 的运行时快照、Harness 路由；
- Policy/Permission：实际 Allow/Ask/Deny 与审批生命周期；
- Rust Execution：最终 OS/FS/Process/Sandbox/Secret re-validation；
- App Shell：Chat/Work UI Surface 选择；
- Infinite Canvas：仅拥有 viewport 与节点视觉位置等 UI Projection 状态。

### 允许修改

- `packages/core/agent-runtime/**`；
- `packages/client/app-shell/**`；
- `packages/client/ui/src/features/workbench/**` 与公共 export；
- 必要的 Web Host 类型契约；
- 架构、模块、UI、测试、代码地图、版本文档。

### 禁止修改

- 禁止自行复刻 Codex / DSH 私有协议或伪造“兼容成功”；
- 禁止模型绕过 Tool Runtime / Policy / Permission / Rust Broker 直接调用 OS；
- 禁止把 Secret 明文注入模型上下文、Canvas 节点或 Session Event；
- 禁止把 Chat 和 Work 实现成两套 Agent Runtime；
- 禁止 Full access 自动关闭审计、修改 Trust Core、绕过 OS 用户权限；
- 禁止 Canvas 成为 Run/Session/Artifact 的第二事实源。

### 验收条件

- Chat / Work 可切换且共享同一已配置模型显示和三档权限；
- Work 无限画布支持 pan / zoom / reset / 节点拖拽 / 连线渲染，布局不依赖固定 viewport；
- 权限 Profile 有单一映射函数，可明确映射 Codex 的 reviewer / approval / sandbox 组合；
- 官方 Harness 能力以 Adapter/Bridge 注册，不进入 UI 特判；
- 未接 Runtime Host 时 UI 不伪装任务已执行；
- #2.15 侧栏 resize/snap、Settings、#2.16 Config 能力不回退。

### 必须测试

- Agent Runtime 权限 preset 与 Codex 映射纯函数；
- Capability/Harness Registry 不重复注册、未知 Provider 不猜测；
- Infinite Canvas 静态合同与无硬编码模型回归；
- App Shell Chat/Work 共享模型/权限状态；
- 现有 Workbench Snap / Settings / Config / Runtime import 回归；
- 全治理门禁。

### 必须更新文档

`ARCHITECTURE.md`、`PROJECT_PLAN.md`、`docs/MODULES.md`、`docs/UI.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`LFAA v0.0.77 — #22.0 统一 Agent Runtime、三档权限与无限画布工作台`

### 版本目标

`v0.0.77`

### 当前状态

`implementing`

### AI 验证

`pending`

### 用户验收

`pending`

## #4.3 Sync/GitHub 统一工作区预检与可诊断失败修复

### 主模块

`windows-runtime-scripts / governance`

### 背景

v0.0.76 Windows 实机运行 `LFAA-GitHub.bat → 一键推送` 时，在 `H:\lfaa\lfaa` 的推送前治理检查处被阻止，但终端只显示“项目治理检查未通过”，真实失败项仅写入深层日志。干净 v0.0.76 发布包中的 standalone governance 本身可通过，说明当前脚本缺少“稳定工作区事实诊断 + Sync/GitHub 同一预检链”的产品化能力。

### 任务目标

1. 新增一个不依赖 pnpm/node_modules 的统一 `workspace-preflight`，顺序执行所有 Git/Sync 前应执行的静态治理 gate；
2. Sync 成功前与 Git push 前必须调用同一个 preflight，避免两边口径不同；
3. 失败时终端直接打印失败 gate、原始错误摘要、工作区与 Node 版本，不要求用户先打开日志猜原因；
4. 日志继续保留完整技术输出；
5. 不因为缺少 node_modules 阻止纯 Git 推送，也不把 Node24 release-environment 检查混入工作区静态 preflight；
6. Git 历史、origin、`.git` 保护与 safe rebase/push 语义保持不变。

### 允许修改

`scripts/windows/lfaa-sync.ps1`、`scripts/windows/lfaa-github.ps1`、`scripts/workspace-preflight.mjs`、相关 Node 测试与 Runtime 文档。

### 禁止修改

- 禁止强推、自动丢弃用户本地修改、自动删除 `.git`；
- 禁止为了“能推”而跳过失败 gate；
- 禁止要求 node_modules 才能执行静态预检；
- 禁止隐藏失败原因只留日志路径。

### 验收条件

- Sync 与 Git push 显示同一预检 gate 名称；
- 某 gate 失败时终端可直接看到原因；
- 干净版本包 preflight PASS；
- `.git`、runtime logs、Secret/local env 的同步保护不回退。

### 必须测试

- workspace-preflight PASS / artificial fail 行为；
- 两个 PowerShell 脚本都调用统一 preflight；
- Windows BOM 门禁；
- 既有 Sync/GitHub 静态合同。

### CHANGELOG 编号

`LFAA v0.0.77 — #4.3 Sync/GitHub 统一工作区预检与可诊断失败修复`

### 版本目标

`v0.0.77`

### 当前状态

`implementing`

### AI 验证

`pending`

### 用户验收

`pending`

## #2.16 OpenAI ChatGPT 套餐 / Codex App Server 登录闭环

### 主模块

`config-system / web-host / ui`

### 背景

v0.0.75 已由用户确认继续，#2.15 侧栏最小宽度超拖吸附修正视为验收通过。此前 Config System 主线在 v0.0.73 已完成 Rust Secret Broker、Provider 官方模型目录与模型能力契约，但 OpenAI 的 ChatGPT 套餐认证仍只是占位入口。根据 OpenAI 当前官方 Codex App Server 协议，ChatGPT 托管登录应由 `codex app-server` 负责 OAuth / Token 持久化与刷新，客户端通过 `account/login/start`、`account/read`、`model/list` 等 JSON-RPC 方法读取状态与模型，不应由 LFAA 自行实现或保存 ChatGPT Token。

### 任务目标

1. 新增 Web Host 的 Codex App Server Adapter：按需启动本机 `codex app-server`，使用默认 stdio JSONL 传输，完成 `initialize → initialized` 握手并管理请求/通知生命周期；
2. Config System 新增“宿主管理认证”端口，使 `subscription` 认证仍由 Account Core 编排，而不是把 ChatGPT 业务写进 Vite / React；
3. ChatGPT 登录使用官方 `account/login/start(type=chatgpt)` 浏览器流程，LFAA 只接收 `loginId / authUrl / completed` 状态，不接触 access token / refresh token；
4. 登录成功后用 `account/read` 校验当前 ChatGPT 账户，并用 `model/list` 获取该账户真实可用模型、默认推理强度与支持的 reasoning efforts；
5. ChatGPT 套餐账户落盘时不得伪造 `credentialRef`；其凭证所有权属于 Codex App Server，LFAA 只保存非 Secret 账户元数据、认证方式、模型选择与模型配置；
6. API Key / Token Plan 继续走 Rust Secret Broker，不因 ChatGPT 登录改写既有 Secret 链路；
7. UI 对 ChatGPT 套餐显示“登录并连接”流程；浏览器打开官方登录页后等待 Host 完成，不把 URL/Token 写入 localStorage/sessionStorage；
8. 删除 LFAA 中的 ChatGPT 账户只取消本项目关联，不自动执行 Codex 全局 `account/logout`，避免影响用户其他 Codex 客户端。

### 归属目录 / 允许依赖

- `packages/settings/config-system/src/settings/ai/core/**`：Managed Auth 契约与 Account Core 业务编排；
- `packages/settings/config-system/src/settings/ai/providers/openai/**`：OpenAI ChatGPT 认证能力描述，不实现进程；
- `apps/web/dev/bridges/ai/**`：Codex App Server Node Host Adapter、localhost 路由；
- `apps/web/src/host/**`：浏览器 Host Client 与打开登录页/等待完成；
- `packages/client/app-shell/**`：把 Host 能力和 Config 结果映射为 UI ViewModel；
- `packages/client/ui/src/features/settings/ai/**`：只负责登录按钮、状态和模型展示。

允许依赖方向保持：`apps/web → app-shell/config-system`，`app-shell → ui + config-system public API`；Config System 不依赖 Node / DOM / React。

### 禁止修改

- 禁止自行实现 OpenAI OAuth、解析/保存 ChatGPT access token / refresh token；
- 禁止把 ChatGPT Token 写入 `.lfaa`、账户 JSON、浏览器 Storage、argv、env 或日志；
- 禁止 UI / Vite Bridge 写 Provider 业务分支；
- 禁止为了本任务修改 Workbench resize/snap、Profile/Theme、Windows Setup/Sync/GitHub/Update；
- 禁止自动执行 `account/logout` 作为“删除 LFAA 账户”的副作用；
- 禁止引入第二套 OpenAI 模型能力硬编码覆盖 Codex `model/list` 返回的运行时事实。

### 验收条件

- 本机存在可用 Codex CLI 时，ChatGPT 套餐入口可发起官方登录并在完成后保存为 LFAA 账户；
- 本机没有 Codex CLI / app-server 时，Settings 明确显示不可用原因，不伪装成功；
- 登录完成后 `account/read` 必须为 ChatGPT 账户，`model/list` 返回模型后才允许保存；
- ChatGPT 账户 `credentialRef = null`，账户 JSON 不出现 accessToken / refreshToken / authUrl / userCode 等敏感或临时认证字段；
- ChatGPT 模型的 reasoning 选项来自 App Server `model/list.supportedReasoningEfforts`；未知字段不猜测；
- API Key 账户仍使用 Rust Secret Broker，保存/重测/删除行为不回退；
- 删除 LFAA ChatGPT 账户不调用全局 `account/logout`；
- Settings / Workbench #2.15 行为保持不变。

### 必须测试

- Config Core：API Key 与 subscription 分流、managed auth 无 Secret 保存、模型能力映射、删除不触发全局 logout；
- Web Host：`codex app-server` stdio JSONL、initialize/initialized、request id、login completed 通知、model/list、无 Token 持久化；
- Browser Client：同步预开登录窗口、登录 URL 只用于导航、轮询完成、不得写 Storage；
- UI：subscription 不要求 Secret，按钮/状态与普通 API Key 流程分离；
- 历史回归：Rust Secret、Provider、Settings、Workbench Snap、runtime import；
- governance / folder / import / docs / comments / Windows BOM / release consistency / prompt lifecycle / UI contract / TypeScript。

### 必须更新文档

`PROJECT_PLAN.md`、`docs/MODULES.md`、`docs/UI.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`LFAA v0.0.76 — #2.16 OpenAI ChatGPT 套餐 / Codex App Server 登录闭环`

### 版本目标

`v0.0.76`

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`

### 用户验收

`pending`

## #2.15 侧栏最小宽度超拖吸附修正

### 主模块

`ui / workbench`

### 背景

v0.0.74 虽然把 `minWidth` 与 capture threshold 解耦，但错误地让侧栏在 `minWidth → captureThreshold` 区间继续视觉缩窄，导致正常 resize 手感被算法接管，出现“像吸附展开、不能停在任意宽度”的回归。用户明确要求复刻目标交互：侧栏到最小宽度后视觉尺寸立即锁定，不再变窄；Pointer 继续向收起方向超拖，只有超拖约半个 `minWidth` 后才触发吸附收起。

### 任务目标

1. 正常 resize 区间保持 Pointer 1:1 跟手，可停在 `minWidth..maxWidth` 任意位置；
2. 到达 `minWidth` 后，视觉宽度固定为 `minWidth`，不得继续随 Pointer 变窄；
3. Pointer 继续向内移动只累计隐藏超拖距离，默认超拖达到 `minWidth × 50%` 才进入 snap capture；
4. 未达到 capture 阈值就松手，宽度保持 `minWidth`，不得自动收起或自动展开；
5. 已 capture 后 Pointer 不松手仍沿用已验收的 hysteresis + release 动画反向拉出；
6. 左栏、右栏、Bottom Dock、Settings 继续共用同一实现与集中变量，不复制算法。

### 允许修改

- `packages/client/ui/src/workbench/**`；
- Workbench / Settings 防回归测试与 UI contract；
- Prompt / Log / Plan / Testing / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- 禁止修改 Rust Secret Broker、Provider、Account/Auth、模型能力业务；
- 禁止修改个人中心、主题、Windows Setup / Sync / GitHub / Update；
- 禁止让 capture threshold 直接控制视觉宽度；
- 禁止新增散落魔法数字或复制第二套 snap 算法。

### 验收条件

- 正常拖动到任意宽度后松手，宽度保持该位置，不出现自动吸附展开；
- 到 `minWidth` 后继续向内拖，侧栏视觉宽度保持不变；
- 继续超拖约半个 `minWidth` 后才触发收起吸附；
- 阈值前松手保持 `minWidth`；capture 后不松手反向拉出仍丝滑；
- Settings / 主工作台 / 右栏 / Bottom Dock 共用同一逻辑。

### 必须测试

- capture 前视觉尺寸必须 `clamp(raw, min, max)`，禁止使用 `captureThreshold` 作为视觉下限；
- capture 仍由 `raw <= captureThreshold` 触发，不得回退 `raw <= min`；
- 左/右/Bottom 共用隐藏超拖规则；
- snap-release、共享 leftWidth、Provider/Secret 历史回归不退化；
- governance / import / runtime import / folder / release consistency / prompt lifecycle / UI contract。

### 当前状态

`delivered`

### 用户验收

`passed；用户在 v0.0.75 后回复“ok，下一步做什么”，按本项目连续验收语义确认 #2.15 通过。`

## #2.14 侧栏吸附触发阈值变量化

### 主模块

`ui / workbench`

### 背景

v0.0.73 保留 Rust Secret Broker 与官方模型能力候选；用户在继续体验共享 Workbench 侧栏时指出：当前侧栏一到 `minWidth` 就立刻进入 snap capture，容易误触。参考目标是在达到最小可用宽度后继续向内拖一段距离，达到明确捕获阈值后才吸附收起；同时要求拖拽参数集中变量化、写清中文注释，工作台、Settings 与后续复用 Surface 共用同一算法。

### 任务目标

1. `minWidth` 只表示正常展开态最小可用宽度，不再等于吸附触发线；
2. 新增统一 `snapCaptureRatio`，默认 `0.50`：临时拖拽宽度降到 `minWidth × 50%` 后才进入 snap capture；
3. `minWidth → capture threshold` 区间允许临时跟随 Pointer 继续缩窄；若未达到捕获阈值就松手，则恢复并提交到 `minWidth`，不得误收起；
4. 左栏、右栏、Bottom Dock、Settings 复用同一 capture / hysteresis / release 算法；允许通过组件参数单独覆盖；
5. 将 snap capture/release 动画时长、键盘 resize 步长等交互参数集中到 Workbench interaction 配置，并用中文注释说明调参影响，禁止散落魔法数字。

### 允许修改

- `packages/client/ui/src/workbench/**`；
- Settings / App Shell 对共享 Workbench 参数的透传；
- Workbench / Settings 防回归测试；
- Prompt / Log / Plan / Testing / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- 禁止修改 Rust Secret Broker、Provider、Account/Auth、模型能力业务；
- 禁止修改个人中心、主题、Windows Setup / Sync / GitHub / Update；
- 禁止在工作台与 Settings 分别复制一套 snap 逻辑；
- 禁止重新引入固定 px 捕获阈值作为唯一规则。

### 验收条件

- 拖到 `minWidth` 时不会立刻吸附；继续向内拖到默认 `minWidth × 0.50` 才进入 snap preview；
- 未越过捕获阈值时松手，侧栏回到 `minWidth` 而不是收起；
- 吸附后 Pointer 不松仍可按既有 hysteresis 反向丝滑拉出；
- Settings 与主工作台行为一致，因为使用同一 ResizableWorkbench；
- capture ratio / hysteresis / capture duration / release duration / keyboard resize step 均能从集中配置找到并有清晰中文注释。

### 必须测试

- snap 不再由 `raw <= min` 触发；
- capture threshold 使用 `min × snapCaptureRatio`；
- 左/右/Bottom 共用 capture 规则；
- Settings / App Shell 透传共享 capture ratio；
- 现有 snap-release、共享 leftWidth、Provider/Secret 历史回归不退化；
- governance / import / runtime import / folder / release consistency / prompt lifecycle / UI contract。

### 当前状态

`pending-user-acceptance`

## #2.13 Rust Secret Broker 与官方模型能力配置

### 主模块

`config-system / rust-secret-store / web-host / ui`

### 背景

v0.0.72 Windows 实机继续暴露 Credential helper 的 C# `FILETIME` 命名冲突。用户明确要求 LFAA 技术栈保持 TypeScript + Rust，不接受 PowerShell 内嵌 C# 作为长期 Secret Broker。同时用户要求 AI 配置必须直接对接各厂商官方接口：模型 ID 来自官方模型目录，思考模式/思考强度/模型参数必须只展示官方真实支持的能力，不能伪造。

### 任务目标

1. 删除 Windows Credential Manager 的 C#/PowerShell helper，实现 `lfaa-secret-store` Rust Broker；Windows 通过 Rust FFI 调用 Generic Credential，Web Host 仅通过 stdin/stdout 二进制协议与 Broker 通信。
2. Provider 模型发现继续优先使用官方模型列表 API，返回账户当前可用的全部模型 ID，不以 LFAA 内置白名单替代官方结果。
3. 新增模型能力描述契约：思考开关、推理强度、上下文/输出上限等只允许来自厂商官方 API/官方文档；能力项记录官方来源。官方 `/models` 不返回能力元数据时，Provider 可以用官方文档规则补充，但禁止猜测。
4. Account 保存模型配置时必须经过 Provider 能力校验；UI 只展示选中模型真实支持的配置项。

### 允许修改

- `native/secret-store/**`；
- `apps/web/dev/bridges/ai` 的 Rust Secret Broker Adapter；
- `packages/settings/config-system/src/settings/ai/core` 的模型能力/账户配置契约；
- 六家 `providers/<provider>` 与共享 transport；
- `packages/client/ui/src/features/settings/ai` 与 App Shell ViewModel；
- 对应测试、治理、Prompt / Log / Plan / Testing / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- 禁止继续使用 C# `Add-Type`、`cmdkey /pass:`、Secret 命令行参数、Secret 环境变量或普通文件持久化；
- 禁止为了“全模型”伪造厂商不存在的模型列表端点；
- 禁止根据模型名字臆测思考强度/上下文；无官方依据的配置项不显示；
- 禁止 Provider 业务进入 UI / apps/web；
- 禁止修改已验收 Workbench / Settings / Profile / Theme / Windows Setup / Sync / GitHub / Update。

### 验收条件

- Windows 保存 Secret 走 Rust Broker，`put → read-back → compare` 通过后才允许账户元数据落盘；C# / Credential PowerShell helper 从仓库删除；
- Secret 不进入命令行、环境变量、日志、URL、普通 JSON；账户 JSON 继续只存 `credentialRef`；
- OpenAI / DeepSeek / Kimi / 千问 / Xiaomi 使用各自官方模型目录 API 获取模型 ID；智谱在没有已确认统一列表 API 时不得伪造 endpoint，使用带官方来源的 Catalog Adapter；
- 选中模型后，UI 显示该模型官方支持的推理/思考设置；未知模型仍可选择，但不显示未确认参数；
- 保存的模型配置必须通过 Provider 能力白名单校验，不能保存厂商/模型不支持的字段或值；
- 现有 Account/Auth/Settings/Workbench 全量回归。

### 必须测试

- Rust Broker 二进制协议、Windows FFI 静态契约、无 C#/PS1 helper；
- Secret Adapter 不向 argv/env/file 传 Secret；
- Provider 动态模型发现与能力解析；
- 模型配置非法字段/非法 effort 拒绝；
- UI 仅渲染 capabilities 中声明的控制项；
- governance / folder / import / runtime imports / Windows BOM / release consistency / prompt lifecycle。

### 当前状态

`pending-user-acceptance`

## #2.12 Windows Credential Manager 保存链路修复

### 主模块

`config-system / web-host / windows-secret-adapter`

### 背景

v0.0.71 Windows 实机已确认工作台 / Settings 左栏宽度同步通过；随后用户使用真实 DeepSeek API Key 测试账户闭环，Provider 连接与模型发现成功，但点击“保存账户”时报“Windows Credential Manager 操作失败”。故障集中在 Web Host 的 Windows Secret Adapter，不能继续进入 ChatGPT 套餐登录等下一业务。

### 任务目标

修复 Windows Credential Manager Generic Credential 的写入 / 读取 / 删除宿主链路：Secret 仍只通过 stdin 进入 Windows Host，不进入命令行、日志、普通 JSON 或浏览器 Storage；写入后必须即时读回校验，只有回读与原 Secret 一致才允许账户元数据落盘。

### 允许修改

- `apps/web/dev/bridges/ai/windows-credential-manager.ts`；
- 同目录 Windows Credential Manager helper；
- `ai-config-bridge.ts` 的 Host Adapter 初始化参数；
- AI Web Host / Secret 防回归测试；
- Prompt / Log / Plan / Testing / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- Provider 网络协议、模型发现与 API Key 规则；
- Account Service 的业务语义（除非为 Secret Adapter 错误契约做最小兼容）；
- Settings / Workbench / Profile / Theme / 左栏宽度逻辑；
- Windows Setup / Sync / GitHub / Update；
- 不允许使用 `cmdkey /pass:<secret>`、命令行参数、环境变量或普通文件保存明文 Secret；
- 不允许以“内存 fallback 成功”冒充 Windows 持久化成功。

### 验收条件

- DeepSeek 等已通过连接测试的真实 Key 点击保存后能写入 Windows Credential Manager；
- `put` 后立即 `get` 回读必须与原 Secret 完全一致，否则保存失败且不得写账户元数据；
- Windows native 失败时 UI 返回不含 Secret 的阶段 + Win32 错误码 / 可诊断信息，不再只显示泛化“操作失败”；
- Secret 继续只走 stdin；PowerShell 使用稳定 helper 文件执行，不把 Secret 或 helper 源码拼进命令行；
- `.lfaa/state/ai-accounts.json` 仍只包含 `credentialRef` 与公开元数据；
- Provider / UI / 已验收 Workbench 行为回归。

### 当前状态

`pending-user-acceptance`

## #2.11 工作台 / 设置左栏宽度单一事实源

### 主模块

`ui / app-shell`

### 背景

v0.0.70 已让 Settings 与工作台复用同一个 `ResizableWorkbench`，但两个 Surface 仍各自保存 `leftWidth`：工作台调整后的宽度进入 Settings 时不一定一致，Settings 内再次调整也不会成为返回工作台后的同一宽度。用户明确要求两者视觉上与行为上都属于同一左侧栏能力，宽度必须随实际拉伸保持一致。

### 任务目标

把 `AgentWorkbench.leftPaneWidth` 升级为工作台、Settings、Profile 共用的唯一左栏宽度事实源。`ResizableWorkbench` 新增受控 `leftWidth` 契约；工作台与 Settings 都通过同一个值渲染和回写。

### 允许修改

- `packages/client/ui/src/workbench` 的受控 `leftWidth` 契约；
- `packages/client/ui/src/features/settings` 的共享宽度注入；
- `packages/client/app-shell/src/AgentWorkbench.tsx` 的共享宽度状态与一次性历史宽度迁移；
- Settings / Workbench 防回归测试；
- Prompt / Log / Plan / UI / Testing / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- resize / snap / hysteresis / 反向 release 动画算法；
- AI Account/Auth/Secret/Provider；
- Profile / Theme / UserMenu 交互；
- Web Host Bridge 与 Windows Setup / Sync / GitHub / Update；
- 不得新增 Settings 自己的第二套宽度 state 或固定宽度。

### 验收条件

- 工作台左栏当前为 N px 时，进入 Settings 第一帧左栏也为同一 N px（受当前容器 min/max 约束时按同一几何规则 clamp）；
- Settings 内拖动左栏后，返回工作台继续保持该宽度；
- 两个 Surface 都通过同一个 `leftPaneWidth / setLeftPaneWidth`；
- `ResizableWorkbench` 支持受控 `leftWidth`，非受控用法继续兼容；
- 首次升级可迁移 v0.0.70 及更早 `lfaa.workbench.layout.v5.leftWidth`，后续统一持久化到 Shell 共享宽度键；
- 原 Settings resize/snap/release、运行时 import、Account/Auth/Secret/Provider 与 Windows 工具链全部回归。

### 当前状态

`delivered`

## #2.10 UI Workspace 运行时导入解析修复

> v0.0.70 运行时 Export 修复保留；候选包因 Settings 与主工作台 leftWidth 尚未共享而由 v0.0.71 继续修正。

### 主模块

`ui / project-governance / web-host-validation`

### 背景

v0.0.69 将 Settings 左栏改为共享 `ResizableWorkbench`，但为了绕开深层相对路径使用了 `packages/client/ui/tsconfig.json` 中的 `@/*` 私有 alias。补充 TypeScript 检查能解析该 alias，而真实 Web 宿主 Vite 没有同一 alias，Windows 实机启动因此出现 `Failed to resolve import "@/workbench/..."`。这是“类型检查通过但运行时解析失败”的验证漏洞。

### 任务目标

把 Workbench 复用能力暴露为 `@lfaa/ui/workbench` 稳定公共子入口，让 Settings 通过 package `exports` 解析；同时增加运行时导入解析门禁，禁止可复用 `packages/*` 依赖宿主未声明的 tsconfig-only alias。

### 允许修改

- `packages/client/ui/package.json` 与 `packages/client/ui/src/workbench/index.ts`；
- `packages/client/ui/src/features/settings/SettingsPage.tsx` 的导入方式；
- import/runtime resolution 治理脚本与测试；
- Prompt / Log / Plan / Testing / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- Settings 左栏 resize/snap/release 业务行为；
- AI Account/Auth/Secret/Provider；
- UserMenu/Profile/Theme；
- Windows Setup / Sync / GitHub / Update；
- 不得通过给 Web 宿主临时增加 `@` alias 掩盖 package 自身 Export 缺口。

### 验收条件

- Settings 不再出现 `@/workbench/...`；
- `@lfaa/ui/workbench` 在 `packages/client/ui/package.json` 的 `exports` 中公开，目标文件真实存在；
- 从 Settings 真实 importer 位置使用 Node package resolver 可解析 `@lfaa/ui/workbench`；
- `packages/*` 源码出现 `@/` tsconfig-only alias 时治理失败；
- workspace `@lfaa/*/<subpath>` 未公开或目标不存在时治理失败；
- Windows 实机菜单 2 启动 Web 后不再出现本任务对应的 Vite import-analysis 错误；
- Settings 共享侧栏行为与 v0.0.69 保持一致。

### 当前状态

`superseded`

## #2.9 设置中心共享可伸缩侧栏

### 主模块

`ui / app-shell`

### 背景

v0.0.68 的独立 Settings Surface 已可用，但左侧设置导航仍使用固定 CSS 宽度，与工作台左栏不是同一套几何能力。用户明确要求所有左侧导航统一复用同一套可拉伸、可吸附收起、Pointer 未松手可反向拉出、带短 release 动效和尺寸持久化的能力，避免每个页面各写一套。

### 任务目标

让 Settings 左栏直接复用 `ResizableWorkbench` 的左栏能力，并扩展该布局组件支持“单侧 Surface”：没有右栏时不渲染伪右栏/伪 separator。设置侧栏尺寸必须由同一响应式几何计算器实时计算，禁止固定 `17rem / 12rem`。

### 允许修改

- `packages/client/ui/src/workbench/ResizableWorkbench.tsx` 与类型/CSS，仅用于支持单侧 Surface；
- `packages/client/ui/src/features/settings/SettingsPage.tsx` / `settings.css`；
- Settings/Workbench 防回归测试；
- UI/Workbench README、Prompt / Log / Plan / Testing / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- AI Account/Auth/Secret/Provider 业务；
- UserMenu/Profile/Theme 已验收行为；
- Web Host Bridge；
- Windows Setup / Sync / GitHub / Update；
- 不得为 Settings 再实现一套独立 Pointer resize/snap 算法。

### 验收条件

- Settings 左栏使用 `ResizableWorkbench`；
- 左栏宽度随 Settings 容器实时计算并可拖拽；
- 拖到 min 可吸附收起，Pointer 未松手反向拖过 hysteresis 可平滑拉回；
- 收起后提供显式“展开设置导航”入口；
- 设置侧栏尺寸持久化到独立 storage key，不污染主工作台布局；
- 无右栏时不出现额外右侧 separator；
- `settings.css` 不再包含固定 `17rem / 12rem` 侧栏布局；
- 原 Workbench Snap、Settings/Profile、Config System 与 Web Host 回归继续通过。

### 当前状态

`superseded`

## #2.8 Vite Native Config 兼容修复

### 主模块

`web-host / project-governance`

### 背景

v0.0.67 在 Windows 实机启动 Web 时 Vite 8.2.2 提示 native config loader 兼容警告：Vite config 及其本地 dev bridge 使用了省略 `.ts` 扩展名的相对 ESM import。当前仍能启动，但未来 `configLoader: native` 成为默认时会产生兼容风险。

### 任务目标

显式补齐 Vite config 依赖链中的本地 `.ts` 扩展名，并让 Web TypeScript `noEmit` 配置允许导入 TypeScript 扩展名；禁止通过环境变量隐藏 warning。

### 允许修改

- `apps/web/vite.config.ts`；
- `apps/web/dev/bridges/ai/*.ts` 中属于 Vite config 依赖链的本地 import；
- `apps/web/tsconfig.json`；
- AI Web Host 静态契约测试；
- Prompt / Log / Plan / Testing / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- Account/Auth/Secret/Provider 业务语义；
- Settings / Workbench / Profile / Theme；
- Windows Setup / Sync / GitHub / Update；
- 不得使用 `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` 掩盖问题。

### 验收条件

- `vite.config.ts` 导入 AI Bridge 时显式 `.ts`；
- AI Bridge 的三个本地实现依赖显式 `.ts`；
- Web tsconfig 开启 `allowImportingTsExtensions` 且继续 `noEmit`；
- 静态测试锁定上述规则；
- Windows 实机再次启动 Web 时不再出现本任务所针对的 native config loader warning；
- `Re-optimizing dependencies because lockfile has changed` 仅在 lockfile 确实变化时可出现，不视为错误。

### 当前状态

`pending-user-acceptance`

## #2.7 Web API-Key Account 真实闭环

### 主模块

`config-system / ui / app-shell / web-host`

### 背景

v0.0.66 已由用户 Windows 实机验收通过。AI Provider 插件骨架与设置中心已经存在，但账号、Secret、连接测试和模型发现仍是描述层，不能作为真实业务使用。

### 任务目标

先把 Web 作为第一参考宿主，完成六家内置 Provider 的 API Key / Token Plan 真实纵向闭环：浏览器只负责输入与显示；Config System 拥有 Account/Auth/Model 业务；Web Host 负责 Secret 安全存储与网络请求。OpenAI ChatGPT 套餐登录保留入口但不伪装完成，后续单独接 Codex App Server。

### 目录与边界

- `packages/settings/config-system/src/settings/ai/core`：Account Service、Port、Account/Probe 类型；
- `packages/settings/config-system/src/settings/ai/providers/<provider>`：厂商连接事实；
- `packages/settings/config-system/src/settings/ai/transports`：共享模型列表解析；
- `packages/client/ui/src/features/settings/ai`：纯表单/ViewModel；
- `packages/client/app-shell`：业务 ViewModel 与宿主 Port 编排；
- `apps/web/src/host`：浏览器 localhost Host Client；
- `apps/web/dev/bridges/ai`：Vite 开发宿主 Adapter。

禁止 UI 直连厂商 API、禁止 Secret 写 localStorage/sessionStorage/普通 JSON、禁止 apps/web 复制 Provider 业务。

### Secret 合同

- Windows Web 开发宿主使用 Windows Credential Manager Generic Credential；
- 浏览器只在首次保存/验证时把明文发往 `127.0.0.1` 同源 Host Bridge；
- Host 保存后只返回 `credentialRef`，任何列表/日志/错误均不得返回 Secret；
- 账户元数据可写 `.lfaa/state/ai-accounts.json`，文件中禁止出现 API Key 明文；
- 非 Windows 开发宿主只允许内存 Secret fallback，并必须向 UI 暴露“非持久”状态，不能冒充已持久化。

### Provider 范围

- OpenAI API Key：真实 `GET /models`；ChatGPT 套餐入口保持 `not-yet-connected`；
- DeepSeek API Key：真实 `/models`；
- Kimi API Key：中国/国际真实 `/models`；
- 千问/百炼 API Key：按 Region / Workspace 真实 `/api/v1/models`，解析 `output.models`；
- Xiaomi MiMo：按量 `sk-` 与 Token Plan `tp-` 分离，真实 `/models`；
- 智谱 GLM：不虚构未确认的无成本模型列表端点；允许保存真实 Key + 手工模型，状态明确为 `unverified`。

### 验收条件

- Web 设置页能输入 Secret、测试连接、显示模型、选择模型、保存/删除账户；
- 保存后刷新浏览器仍能读取账户元数据与选中模型，Secret 不返回浏览器；
- Windows 重启 Vite 后账户 Secret 仍可由 Credential Manager 读取并重新测试；
- 错误信息经过脱敏，不能包含 Key；
- UI / Config / Host 边界门禁继续通过；
- ChatGPT 套餐按钮不能伪装成功，明确显示后续 Codex App Server 接入。

### 必须测试

- Account Service 单元测试；
- Provider model parser / Qwen parser；
- Web Host 静态安全契约；
- UI/App Shell TypeScript；
- Config System 全量回归；
- folder-boundary / import / governance / ui-contract / config-schema；
- Windows PS1 Hash/BOM 不回退；
- ZIP Round-trip。

### 版本目标

`v0.0.67`

### 实现结果

- 新增 Provider 无关 `AiAccountService`、Repository / Secret Store / HTTP Host Ports；
- Web Host 新增 localhost AI Bridge；Windows Secret 保存到 Credential Manager Generic Credential；
- `.lfaa/state/ai-accounts.json` 只保存账户元数据与 `credentialRef`，写入前递归拒绝 Secret 明文字段；
- OpenAI / DeepSeek / Kimi / 千问 / MiMo 可通过各自插件真实探测模型；智谱保持手工模型 + `unverified`，不伪造模型目录；
- Web Settings 支持瞬时 Secret 输入、连接测试、模型选择、保存、重测、切模、删除；
- OpenAI ChatGPT 套餐入口明确为后续 Codex App Server，不伪装完成；
- Provider 错误体不直接回传 UI，Account 元数据持久化失败时回滚新写 Secret。

### AI 验证结果

- Config System 26/26 PASS；
- Web Host / Secret 安全契约 6/6 PASS；
- Settings / Workbench / Release / Dependency 回归 PASS；
- Config System TypeScript 与 UI/App Shell 补充 TypeScript PASS；
- folder-boundary / import / governance / docs / comment / Windows BOM / config-schema / release-gates / UI contract PASS；
- 当前制作容器不是 Node 24 + pnpm 11.17.0 Windows 环境，因此不冒充 `release:full` / Credential Manager Windows 实机通过。

## #2.6 工作台吸附反向展开动效修复

### 主模块

`ui / workbench`

### 背景

用户已明确验收 v0.0.65 的个人中心侧栏内联聚焦效果。随后实机拖拽发现工作台侧栏在 Pointer 未松手、已进入 snap capture 后反向拉出时，`0 → min` 缺少释放过渡，视觉上瞬间跳开，造成顿挫。

### 任务目标

保持既有吸附状态机不变，只修复吸附态反向展开的动效连续性：吸附收起与反向释放都应有短过渡；release 动画结束后立即恢复普通 resize 的 1:1 Pointer 跟手。

### 允许修改

- `packages/client/ui/src/workbench/ResizableWorkbench.tsx`；
- `packages/client/ui/src/workbench/workbench.css`；
- Workbench 吸附动画防回归测试；
- Prompt / Log / Plan / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- snap min / hysteresis / Pointer Up 提交 collapsed 的业务规则；
- Settings / Profile / Theme；
- AI Provider / Config System；
- `apps/web/src`；
- Windows Setup / Sync / GitHub / Update。

### 交互合同

- Pointer 不松手时，进入 snap capture 后必须仍可反向拖出；
- snap capture 收起继续使用短磁吸动画；
- 从 snap capture 反向释放时必须提供约 150ms 的 release 过渡，避免 `0 → min` 瞬跳；
- release 窗口结束后普通拖拽必须恢复直接跟手，禁止长期 transition 追逐 Pointer；
- 左栏、右栏、底部面板使用同一规则；
- `prefers-reduced-motion: reduce` 时关闭该动效。

### 验收条件

- 左栏吸附后鼠标不松、反向拉出时展开连续，无明显顿挫；
- 继续拖拽时不出现明显延迟或“橡皮筋追鼠标”；
- 左/右/底部 resize 行为和原 snap 规则不回退。

### 必须测试

- Workbench snap animation 4/4；
- Settings/Profile/Theme 回归；
- UI/App Shell TypeScript；
- folder-boundary / import / governance / ui-contract；
- Config System 17/17；
- Windows PS1 Hash/BOM 不回退。

### 版本目标

`v0.0.66`

### 实现结果

- 新增瞬时 `data-snap-release` 状态；
- snap capture 反向释放时使用 150ms `cubic-bezier(.22, 1, .36, 1)` 过渡；
- 150ms 后自动清除 release 状态，恢复普通 resize 无 transition 的直接跟手；
- 左/右侧栏和 Bottom Dock 共用同一 release 语义；
- 增加 reduced-motion 降级和 Workbench 动效防回归测试。

### AI 验证

- Workbench Snap Animation 4/4 PASS；Settings/Profile/Theme 6/6 PASS；Config System 17/17 PASS；folder-boundary / import-path / governance / ui-contract / config-schema / docs / comment / Windows BOM / release consistency / prompt lifecycle / release-gates 全部 PASS；Workbench 补充 TypeScript 检查 PASS。当前制作容器没有项目依赖，因此不伪造正式 Web build；最终拖拽手感仍以用户 Windows 实机验收为准。

## #2.5 个人中心侧栏内联聚焦修复

### 主模块

`ui / app-shell`

### 背景

用户实机验收 v0.0.64 后确认设置中心、三态主题方向可继续，但个人中心聚焦层仍不符合参考交互：弹出菜单宽度超出左侧栏，菜单与底部用户条没有形成一个整体，背景模糊范围也没有准确排除这一整体。

### 任务目标

把个人中心菜单改为严格受左侧栏实时宽度约束的聚焦整体：菜单与底部用户条在同一几何容器中，宽度随 ResizableWorkbench 当前 leftWidth 自动变化；该整体始终保持清晰，其余工作台区域统一轻度模糊/压暗。

### 允许修改

- `packages/client/ui/src/features/account/**`；
- `packages/client/app-shell/src/AgentWorkbench.tsx`、`agent-workbench.css`；
- Settings/Profile 相关 UI 静态测试；
- Prompt / Log / Plan / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- Settings Surface、三态主题业务语义；
- AI Provider Registry / Provider 插件 / Config Core；
- `apps/web/src`；
- Windows Setup / Sync / GitHub / Update；
- PTY、Agent Runtime、Tool Runtime、Permission Engine。

### 交互合同

- 个人菜单宽度禁止使用固定 `18rem` 或 viewport 估算，必须取当前左栏实时宽度；
- 菜单左右边界必须落在左侧栏内部 padding 范围，不得越过左栏 separator；
- 菜单与底部用户条构成同一个清晰聚焦整体，几何宽度一致；
- 聚焦整体之外的工作台全部轻度模糊/压暗，包括左栏其它区域；
- 聚焦整体自身不得受到 backdrop blur；
- 左栏拖拽改变宽度后，再打开个人中心时必须立即使用最新宽度；
- 关闭个人中心后恢复原工作台，不改变左栏尺寸。

### 验收条件

- Desktop 实机视觉与参考交互一致：菜单完全位于左栏内部；
- 菜单+用户条清晰，其余页面统一模糊/压暗；
- 左栏 resize 后菜单宽度自动跟随；
- 不回退 v0.0.64 的独立 Settings Surface 与三态主题。

### 必须测试

- UI/App Shell TypeScript；
- Settings/Profile/Theme 静态契约；
- 新增侧栏实时宽度与聚焦整体防回归；
- folder-boundary / import / governance / ui-contract；
- Config System 17/17 回归；
- Windows PS1 Hash/BOM 不回退。

### 版本目标

`v0.0.65`

### 用户验收

`passed / delivered`：用户实机确认个人中心宽度、聚焦整体与模糊范围符合预期。

### 实现结果

- `ProfileBar` 抽成共享 Footer 组件，正常左栏与聚焦层复用同一份用户条/更新/主题结构；
- 聚焦层改为 `agent-profile-focus-shell`，菜单与用户条在同一个连续容器内；
- 聚焦容器宽度使用 `ResizableWorkbench` 回传的实时 `leftPaneWidth`，通过 `--agent-left-live-width` 计算，禁止固定 18rem / viewport 猜测；
- 聚焦容器左右边界使用与 `.agent-side--left` 一致的 `.625rem` padding，确保不越过左栏 separator；
- 全工作台 backdrop blur/dim 位于聚焦容器下方，菜单+用户条保持清晰，其余区域全部模糊/压暗；
- `UserMenu` 自身改为 `width:100%`，几何完全由宿主左栏决定。

### AI 验证

- Settings/Profile/Theme 6/6 PASS；
- Config System 17/17 PASS；
- folder-boundary / import-path / ui-contract / config-schema / comment / docs / Windows BOM PASS；
- 当前制作容器没有项目锁定 pnpm 11.17.0，因此不伪造正式 Web build / release:full；最终视觉仍由用户 Windows Web 实机验收。

## #2.4 设置中心与个人中心交互重构

### 主模块

`ui / app-shell / config-system-ai-ui`

### 背景

用户验收 v0.0.63 时确认 Provider 目录与插件结构方向正确，但指出设置入口和个人中心交互没有按参考产品的独立设置体验实现：AI 设置被塞进工作区中心区域；左下角个人中心缺少聚焦式弹层；主题只有明/暗两态；更新入口与主题入口布局不符合预期。

### 任务目标

在不改动 AI Provider 业务边界的前提下，重构共享 Shell UI：个人中心使用带背景模糊/压暗的焦点菜单；主题支持 `system / light / dark` 三态；更新入口位于主题入口左侧；设置进入独立全屏 Settings Surface，并采用左侧分类导航 + 右侧内容区；AI Provider 设置作为 Settings 的一个分类嵌入，不再替换工作区 center pane。

### 允许修改

- `packages/client/ui/src/features/settings/**`；
- `packages/client/ui/src/features/account/**` 或等价共享账户菜单 UI；
- `packages/client/app-shell/src/AgentWorkbench.tsx`、`WorkbenchIcon.tsx`、`agent-workbench.css`；
- `packages/client/app-shell/src/workbench.types.ts`（仅 UI 宿主回调契约）；
- UI 相关 README / UI 文档 / 目录边界测试；
- Prompt / Log / Plan / CHANGELOG / RELEASES / 版本事实。

### 禁止修改

- `packages/settings/config-system/src/settings/ai/providers/**` 厂商业务语义；
- Config Schema / Secret / Storage 业务；
- `apps/web` 厂商逻辑；
- Windows Setup / Sync / GitHub / Update 脚本；
- PTY、Agent Runtime、Tool Runtime、Permission Engine；
- 不把 Settings 业务真值塞进 UI；UI 只持有交互状态。

### 交互合同

- 左下角用户按钮打开个人菜单；菜单打开时，工作台其余区域必须出现轻度模糊 + 压暗遮罩，菜单保持清晰；
- 个人菜单至少提供设置入口；不得伪造套餐用量、云账户余额或登录态；
- 左下角主题按钮保持原位附近，左侧新增更新入口，两个小按钮保留可辨识间距；
- 主题为 `跟随系统 / 浅色 / 深色` 三态；`system` 需监听系统主题变化并实时更新；
- 设置按钮进入独立 Settings Surface，工作台三栏/终端/右侧资源不应继续显示在其后作为设置布局；
- Settings Surface 采用左侧设置导航 + 右侧内容区；必须有“返回应用”；
- AI 服务作为 Settings 分类，复用 v0.0.63 的 Provider Registry/ViewModel，不把 Provider 业务复制进 Settings UI；
- `Ctrl+,` 可进入设置；Esc 优先关闭个人菜单/主题菜单，设置页由返回操作退出。

### 验收条件

- 用户菜单视觉聚焦明显，背景模糊但不影响菜单本身；
- 三态主题切换在 Web 实机可见，并能持久化 preference；
- 设置页为独立界面，不再局限于 center pane；
- AI 设置在 Settings 左侧分类中可进入；
- v0.0.63 六家 Provider 结构和目录门禁无回退；
- Desktop/Linux 后续可直接复用 Settings / Account Menu UI；
- 用户验收前状态保持 `pending-user-acceptance`。

### 必须测试

- App Shell / UI TypeScript；
- Settings/Theme/Profile 交互契约静态测试；
- `node scripts/folder-boundary-check.mjs`；
- `node scripts/import-path-check.mjs`；
- `node scripts/governance-check.mjs`；
- Config System 17/17 回归；
- Windows PS1 Hash/BOM 不回退。

### 版本目标

`v0.0.64`

### 实现结果

- 新增共享 `SettingsPage`：独立设置 Surface，左侧分类导航 + 搜索，右侧内容区；
- AI Provider 页面改为 `AiSettingsPanel` 嵌入 Settings 的“AI 服务”分类，不再替换工作台 center pane；
- 新增共享 `UserMenu`，App Shell 使用 backdrop blur + dim Overlay 聚焦个人菜单；
- 左下角 Footer 调整为用户按钮 + 更新 + 主题；更新位于主题左侧；
- 主题升级为 `system / light / dark` 三态，并监听 `prefers-color-scheme` 实时变化；
- `Ctrl+,` 进入设置；Esc 关闭个人菜单/主题菜单；
- 新增 `test/settings-shell.test.mjs` 5 项防回归，并纳入根 `test`。

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`：Settings/Profile/Theme 契约 5/5、Config System 17/17、UI/App Shell TypeScript、folder/import/ui-contract/config-schema 等门禁通过。当前容器无项目锁定 pnpm 11.17.0，不伪造正式 Web build / release:full。

### 用户验收

`pending`

## #2.3 配置系统目录边界与 AI Provider 插件体系

### 主模块

`config-system / ui / app-shell / web-host`

### 背景

用户明确要求：正式进入业务逻辑后，目录必须按长期职责形成清晰父子级，不能为了当前 Web 先开发就把 UI、Provider、Account/Auth、宿主桥东一块西一块。Web 是第一参考宿主；Desktop / Linux 图形端后续复用同一 UI，CLI 复用同一业务 Core。AI 服务未来包含 OpenAI、DeepSeek、智谱、Kimi、千问、小米等真实 Provider，因此从第一版起必须插件化。

### 任务目标

先冻结并自动约束目录架构，再在该架构内继续 Web-first AI 配置业务。Config System 是配置业务父域，`packages/client/ui` 是可复用图形 UI 唯一父域，App 只做宿主。任何 Provider 新增都必须是子插件，不允许在 Web / UI 写厂商业务。

### 固定目录

```text
packages/settings/config-system/src/settings/ai/
├── core/
├── transports/              # 仅真实共享时使用
└── providers/<provider>/

packages/client/ui/src/features/settings/ai/

apps/web/
→ 只保留 Web Host / Router / 本地桥 / Adapter
```

### 允许修改

- `AGENTS.md` / `DEVELOPMENT.md` / `ARCHITECTURE.md` 的目录职责与依赖规则；
- `docs/MODULES.md` / `docs/项目结构与代码地图.md`；
- `apps/README.md`、`packages/README.md`、`apps/web/README.md`、`packages/client/ui/README.md`、`packages/settings/config-system/README.md`；
- `packages/settings/config-system/src/settings/ai/**`；
- `packages/client/ui/src/features/settings/ai/**`；
- `packages/client/app-shell` 的业务/UI 组装；
- Web Host Adapter（不得包含 Provider 厂商业务）；
- 自动目录边界治理脚本与测试。

### 禁止修改 / 禁止放置

- Provider 厂商请求 / Base URL / Auth 业务不得写进 `packages/client/ui`、`apps/web`、Vite Config；
- React / DOM / 页面样式不得写进 `packages/settings/config-system`；
- Config / Account / Auth 真值不得由 App 或 UI 拥有；
- 模型推理 Runtime Adapter 不并入 Config System；
- Secret 明文不得进入普通 Config、日志、Trace、localStorage；
- 不为每个 Provider 新建顶级 package；Provider 是 Config AI 子插件。

### 状态所有权

Config / Account / Auth / AI Provider 配置业务 → `@lfaa/config-system`。
可复用图形 UI → `@lfaa/ui`。
Feature 编排 → `@lfaa/app-shell`。
Web 专属启动/桥接 → `@lfaa/web`。
模型推理执行 → 模型运行域，不由 Config System 拥有。

### 验收条件

- 开发规范明确一级目录和关键 package 的“负责 / 不负责”；
- AI 配置形成固定父子级，不再散落；
- UI Feature 唯一位于 `packages/client/ui/src/features/settings/ai`；
- Provider 配置插件唯一位于 `packages/settings/config-system/src/settings/ai/providers/<provider>`；
- App 无第二套共享业务 UI / Provider 逻辑；
- 自动边界检查能阻止 React 进入 Config System、厂商 API 进入 UI/App、业务包反向依赖 App；
- 后续 Provider 能通过“新增子目录 + 注册”扩展，不改核心分支；
- 用户验收前状态保持 `pending-user-acceptance`。

### 必须测试

- `node scripts/folder-boundary-check.mjs`；
- `node scripts/import-path-check.mjs`；
- `node scripts/governance-check.mjs`；
- Config System TypeScript / tests；
- UI typecheck/build；
- 相关 Provider 单元/契约测试；
- Windows 脚本业务与 BOM 不回退。

### 实现结果

- `config-system/settings/ai/core` 建立无厂商分支的 Provider 契约与 Registry；
- 首批内置 `openai / deepseek / zhipu / kimi / qwen / xiaomi` 六个配置插件；
- `transports/openai-compatible.ts` 仅承载共享模型列表协议，不拥有厂商 URL；
- OpenAI 同时声明 API Key 与官方 Codex App Server 的 ChatGPT 套餐认证能力；
- Provider 真实差异（区域、Workspace、Token Plan、Coding API、模型发现方式）全部留在各自插件；
- `packages/client/ui/src/features/settings/ai` 新增共享 AI 设置页，UI 不依赖 Config System、不发 Provider 请求；
- App Shell 只把 Registry 映射为 UI ViewModel，设置按钮可进入共享 AI 设置页；
- `folder-boundary-check` 新增强制 Provider 子目录、Core 禁止厂商 Endpoint/分支等机器门禁。

### 版本目标

`v0.0.63`

### 当前状态

`superseded`

### AI 验证

`pass`：Provider Registry / 六家插件契约、Config System 17/17 单测、Config System TypeScript、目录边界/导入/治理/文档/注释/版本/Prompt 生命周期等门禁通过；UI/App Shell 使用补充 TypeScript stub 检查通过。当前容器无法联网取得 pnpm 11.17.0，因此不伪造正式 `pnpm build` / `release:full`。

### 用户验收

`not-accepted`：Provider/目录架构保留，但设置中心与个人中心 UI 交互未通过；由 #2.4 / v0.0.64 修正。

## #20.16 pnpm 控制台直连原生输出修复

> **用户验收：** passed；v0.0.62 Windows 实机确认原生 pnpm 输出已恢复。

### 主模块

`project-governance / windows-setup / dependency-sync-ux`

### 背景与问题

用户 Windows 实机验证 v0.0.61：菜单 1 已精简、依赖同步真实成功，但 `pnpm install` 从 PowerShell 直接调用 `pnpm.cmd` 时仍未显示用户在 CMD 直接执行时可见的 Scope / Packages / Progress / Done 原生动态输出。说明问题不是 reporter 参数，而是 PowerShell native-command 管道仍位于 pnpm 与控制台之间。

### 任务目标

Windows 菜单 1 的交互式 pnpm install 改为由 `cmd.exe` 在当前同一控制台直接启动版本匹配的 `pnpm.cmd`。PowerShell 只负责等待退出码，不捕获、不重写 stdout/stderr；菜单 1 保持精简。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的交互式 pnpm install 控制台调用；
- `test/dependency-setup.test.mjs` 的控制台继承防回归；
- Runtime / Testing / Prompt / Log / Plan / CHANGELOG / Release；
- v0.0.62 产品版本事实及 workspace package / Rust crate 产品版本一致性。

### 禁止修改

- frozen/no-frozen 分流与正式发布 frozen 语义；
- Store 动态路径/来源、真实依赖健康、PNPM_HOME；
- Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update。

### 实现约束

- Windows 原生 install 必须使用 `cmd.exe` + `pnpm.cmd` 并在当前控制台运行；
- 使用 `Start-Process -NoNewWindow -Wait -PassThru`，不得配置 stdout/stderr 重定向；
- PowerShell 只能读取子进程退出码，不消费 pnpm 输出；
- 安装前只显示一条简短命令，安装中间输出完全属于 pnpm；
- 非 Windows / 无 `pnpm.cmd` 时保留现有 runner 回退。

### 验收条件

- Windows 菜单 1 确认安装后出现与 CMD 手动 `pnpm install` 同类的 Scope / Packages / Progress / Done；
- 安装完成后真实依赖检查仍通过；
- 二次运行无变化时不重复安装；
- 菜单 1 不恢复冗长中文说明。

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`：静态契约锁定 `cmd.exe` 同控制台继承、无 stdout/stderr 重定向，并回归真实依赖、frozen/no-frozen、Store 与治理门禁。Windows 原生动态进度仍以用户实机为最终验收。

## #20.15 pnpm CMD 原生终端输出与菜单精简

> **状态补充：** Windows 实机确认直接从 PowerShell 调用 `pnpm.cmd` 仍未呈现 CMD 原生动态进度；由 #20.16 / v0.0.62 修正。

### 主模块

`project-governance / windows-setup / dependency-sync-ux`

### 背景与问题

用户在 Windows 实机验证 v0.0.60：依赖真实检测、Store 动态路径、frozen/no-frozen 分流均能继续执行，但菜单 1 内调用 pnpm 后仍看不到用户在 CMD 直接执行 `pnpm install` 时的原生 Scope / Progress / Packages / reused / downloaded / added 输出。同时菜单 1 累积了过多中文说明、实现细节和重复状态，影响可读性。

### 任务目标

Windows 交互式 pnpm 写操作优先使用与 CMD 相同的 `pnpm.cmd` 执行链，并保留原生控制台输出。菜单 1 收敛为“关键环境 + 关键路径 + 简短状态 + 必要确认 + 原生命令输出 + 最终结果”，详细环境事实继续由菜单 7 提供。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的交互式 pnpm runner 与菜单 1 输出；
- `test/dependency-setup.test.mjs` 的 `pnpm.cmd` 与精简输出防回归；
- 当前 Runtime / Testing / Prompt / Log / Plan / CHANGELOG / Release；
- v0.0.61 产品版本事实及 workspace package / Rust crate 产品版本一致性。

### 禁止修改

- #20.13 的 lockfile 落后 `--no-frozen-lockfile` / 本地修复 `--frozen-lockfile` 分流；
- 正式发布 `release:full` frozen 语义；
- pnpm Store 动态路径、Store 来源、PNPM_HOME、真实依赖/Store 健康检查；
- Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update。

### 实现约束

- Windows 交互式 pnpm 写操作优先发现并校验 `pnpm.cmd`，版本必须与项目 `packageManager` 一致；不存在时才回退现有 runner；
- 安装过程不得捕获、重定向或模拟 pnpm stdout/stderr；
- 菜单 1 默认只显示 Node/pnpm/Rust 版本、node_modules / pnpm Store / Cargo / Rust toolchains 四类关键路径、依赖状态摘要与必要确认；
- PNPM_HOME、全局配置、lockfile、状态缓存、Store 来源等详细信息保留在菜单 7，异常时菜单 1 可按需显示；
- 不打印前五个新增/缺失依赖等大段明细，安装细节交给 pnpm 原生输出；
- 不新增“假进度条”。

### 验收条件

- 在 Windows 菜单 1 需要安装时，确认后出现与 CMD 直接 `pnpm install` 同类的 pnpm 原生 Scope / Progress / Packages / Done 输出；
- 正常无变化时菜单 1 输出显著短于 v0.0.60；
- 用户仍能直接看到 Node 依赖、pnpm Store、Cargo 缓存、Rust 工具链的真实位置；
- 菜单 7 继续提供完整环境详情；
- 二次运行无变化时不重复安装。

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`：静态契约锁定 Windows 交互式 pnpm 优先 `pnpm.cmd`、禁止捕获安装输出，并验证菜单 1 精简而菜单 7 保留完整路径事实。Windows 原生 pnpm TTY 仍以用户实机为最终验收。

## #20.14 pnpm 原生安装输出恢复

> **状态补充：** Windows 实机确认 v0.0.60 仍未呈现与 CMD 直接执行一致的 pnpm 原生进度，且菜单提示过多；由 #20.15 / v0.0.61 继续修正。

### 主模块

`project-governance / windows-setup / dependency-sync-ux`

### 背景与问题

用户在 Windows 实机运行 v0.0.59 菜单 1，开发期 lockfile 同步模式已经正确切换为 `--no-frozen-lockfile`，但确认后仍只看到 LFAA 的“执行命令”提示，pnpm 自身的 Scope / Progress / reused / downloaded / added 等原生安装信息没有出现。检查实现确认 v0.0.59 为了“稳定逐行输出”强制增加了 `--reporter=append-only`，这改变了原生终端 reporter 行为，并未满足用户对真实安装过程可见性的要求。

### 任务目标

撤销菜单 1 对 pnpm reporter 的强制控制。开发期同步仍保持 #20.13 的 frozen / no-frozen 分流，但 `pnpm install` 必须以前台原生命令运行，stdout/stderr 不捕获、不重写、不伪造。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的交互式 pnpm install 参数与日志说明；
- `test/dependency-setup.test.mjs` 的原生前台输出防回归；
- 当前治理/Runtime/Testing/Prompt/Log/Plan/CHANGELOG/Release；
- v0.0.60 产品版本事实及 workspace package / Rust crate 产品版本一致性。

### 禁止修改

- #20.13 已确定的 lockfile 落后 `--no-frozen-lockfile` 与本地损坏 `--frozen-lockfile` 分流；
- 正式发布 `release:full` frozen 语义；
- pnpm Store 动态路径、PNPM_HOME、Store 来源、真实依赖/Store 健康检查；
- Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update。

### 实现约束

- 菜单 1 的交互式 `pnpm install` 不传 `--reporter=*`；
- `Invoke-Pnpm -> Invoke-ProjectCommand` 必须前台直接调用当前 pnpm runner；
- 安装 stdout/stderr 不进入 `Invoke-PnpmCapture`、不重定向到文件/Null、不由 LFAA 模拟进度；
- LFAA 可以在安装前显示执行原因/命令，在安装后显示结果，但中间日志归 pnpm 自身；
- 正式发布与非交互探针可以保持各自原有行为，本任务不扩散到其他命令。

### 验收条件

- 当前 v0.0.59 同一场景确认 Y 后，立即进入 pnpm 原生前台安装输出；
- lockfile 落后时仍允许更新 `pnpm-lock.yaml`；
- lockfile 已完整的修复仍 frozen；
- 同步结束后二次运行菜单 1 不重复安装；
- 发布 frozen、Store/环境事实与业务代码无回归。

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`：静态契约确认交互式 install 不再包含任何 `--reporter=*`，并继续通过 dependency setup、真实依赖健康、发布分层/环境、Config Schema 与仓库治理门禁。Windows 原生 pnpm UI 仍以用户实机为最终验收。

## #20.13 开发期依赖同步与实时输出修复

> **状态补充：** Windows 实机确认强制 append-only reporter 仍缺少原生安装信息，本任务由 #20.14 / v0.0.60 继续修正。

### 主模块

`project-governance / windows-setup / dependency-sync`

### 背景与问题

用户在 Windows 实机运行 v0.0.58 菜单 1，脚本已经正确发现 `pnpm-lock.yaml` 尚未覆盖当前外部依赖，但随后却调用 `pnpm install --frozen-lockfile`。该组合逻辑矛盾：开发期声明发生变化时需要允许 pnpm 更新 lockfile，而 frozen 模式明确禁止修改 lockfile。用户确认写操作后界面只停留在“按当前 workspace 与 lockfile 增量同步 pnpm 依赖”，缺少稳定的实时 pnpm 输出，也无法判断正在解析、下载、执行安装脚本还是已经失败。

### 任务目标

把“开发期同步”和“发布期 frozen 校验”彻底分离：lockfile 落后时菜单 1 使用可更新 lockfile 的本地同步；lockfile 已完整但本地安装损坏时继续使用 frozen 精确修复。所有 pnpm 写操作必须以稳定逐行 reporter 直接透传进度，不能出现无输出假卡死。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的 Node 依赖同步分支与实时输出；
- `test/dependency-setup.test.mjs` 的模式选择与 reporter 防回归；
- 当前治理/Runtime/Testing/Prompt/Log/Plan/CHANGELOG/Release；
- v0.0.59 产品版本事实及 workspace package / Rust crate 产品版本一致性。

### 禁止修改

- 正式发布 `release:full` 的 `pnpm install --frozen-lockfile`；
- pnpm Store 动态路径、PNPM_HOME、Store 来源与真实健康检查；
- Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update。

### 实现约束

- `LockCoverage.Complete = false` 时，本地菜单 1 使用 `pnpm install --no-frozen-lockfile`，允许只为当前声明同步 lockfile；
- lockfile 已覆盖声明但 node_modules / 真实解析损坏时使用 `pnpm install --frozen-lockfile`，不得无故改 lockfile；
- 两种路径都追加稳定逐行 reporter，实时显示解析/复用/下载/安装输出；
- 菜单 1 不执行 `pnpm update`、不清空 node_modules / Store；
- 发布门禁继续 frozen，不因本任务放宽。

### 验收条件

- 当前 v0.0.58 所示“lockfile 未覆盖外部依赖”场景不再调用 frozen install；
- 用户确认后立即出现真实 pnpm 输出，不再只停在一行执行提示；
- 同步完成后 lockfile 覆盖、真实 resolve 与 Store 检查重新通过；
- lockfile 已完整但本地缺包时仍走 frozen 精确修复；
- 正式发布 frozen 语义不变。

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass` — dependency-setup 17/17、node-dependency-health 3/3、release-gates 5/5、release-environment 8/8、Config Schema 8/8 与版本/Windows BOM 门禁 PASS。

### 用户验收

`pending`

## #20.12 PowerShell 自动变量冲突修复

### 主模块

`project-governance / windows-setup / powershell-runtime-safety`

### 背景与问题

用户在 Windows 实机运行 v0.0.57 菜单 1 时，脚本在 PNPM_HOME/PATH 实时检测阶段报错“无法覆盖变量 HOME，因为该变量为只读变量或常量”。根因是 `Test-PnpmHomeInPath` 将普通局部变量命名为 `$home`；PowerShell 变量名不区分大小写，因此它与自动只读变量 `$HOME` 冲突。v0.0.57 的 pnpm 实时事实设计本身继续保留，但该实现错误导致菜单 1 无法进入后续检测。

### 任务目标

修复 `$HOME` 冲突，并把 PowerShell 自动/保留变量赋值纳入静态防回归；菜单 1 / 7 必须能正常进入 PNPM_HOME、active Store、Store 来源与真实依赖健康检测。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 中冲突局部变量命名；
- `test/dependency-setup.test.mjs` 的 PowerShell 自动变量防回归；
- `scripts/dev-log-check.mjs` 当前治理任务契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.58 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 产品版本一致性。

### 禁止修改

- v0.0.57 已建立的 pnpm Store 实时路径、配置来源、真实依赖健康语义；
- Web Account/Auth、Config Storage、Config Schema 业务语义；
- Web UI、PTY、Sync / GitHub / Update；
- 自动改变用户 pnpm Store、自动 `pnpm update`、删除 `node_modules` / Store。

### 状态所有权

- PowerShell 用户主目录：系统自动变量 `$HOME`，脚本只读，不得覆盖；
- PNPM_HOME 归当前进程环境变量所有；
- pnpm Store 继续以每次实时 `pnpm store path` 为最终事实；
- `.lfaa/state` 继续只作为依赖同步缓存，不拥有机器环境事实。

### 实现约束

- `Test-PnpmHomeInPath` 不得声明/赋值 `$home`，改用不会与 PowerShell 自动变量冲突的语义化局部变量；
- Windows PowerShell 脚本新增静态防回归：不得把 `$HOME`、`$PID`、`$Host`、`$Error`、`$PSHOME`、`$PWD`、`$LASTEXITCODE` 等自动/只读变量当普通赋值目标；
- 不改变 #20.11 的 pnpm 实时探测决策；
- PowerShell 文件继续保持 UTF-8 with BOM。

### 验收条件

- Windows 实机运行菜单 1 不再出现“无法覆盖变量 HOME”；
- 能继续显示 PNPM_HOME、pnpm Store 与 Store 来源；
- `pnpm store path` 与菜单显示的 Store 一致；
- 原真实依赖 / Store 健康检测继续执行；
- 自动变量防回归测试可捕获再次出现的 `$home = ...` 等冲突赋值。

### 必须测试

- dependency-setup 全部回归，并新增自动变量冲突测试；
- node-dependency-health、release gates、release environment、Config Schema 回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.12 PowerShell 自动变量冲突修复`

### 版本目标

`v0.0.58`

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass` — dependency-setup 15/15、node-dependency-health 3/3、release-gates 5/5、release-environment 8/8、Config Schema 8/8、Config System TypeScript `--noEmit` 与治理链 PASS。

### 用户验收

`pending`

## #20.11 pnpm 实时环境事实与 Store 来源修复

### 主模块

`project-governance / windows-setup / pnpm-environment-facts`

### 背景与问题

用户确认 v0.0.56 之后又发现环境事实边界仍需收紧：旧机器曾把 pnpm Store 全局配置到 `H:\next-javaweb\.pnpm-store`，执行 `pnpm setup` 并删除全局 `storeDir` 后，`pnpm store path` 立即恢复到当前 Windows 用户的默认 Store。LFAA 必须把“当前 pnpm 实时返回值”作为唯一有效 Store 路径，不能把历史缓存、旧项目目录或上一次检测结果当作下一次运行的环境真相。

### 任务目标

让菜单 1 / 7 每次运行都重新探测 Node、pnpm、PNPM_HOME、PATH、pnpm Store 与配置来源；Store 路径和来源变化必须立即反映。默认策略为尊重 pnpm 当前用户级环境，不为 LFAA 自动写入项目级 `storeDir`，也不擅自修改用户全局 Store。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的 pnpm 实时环境事实读取、Store 来源识别、路径展示与健康检查；
- `test/dependency-setup.test.mjs`、`scripts/release-gates-check.mjs` 的静态防回归契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.57 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Web Account/Auth、Config Storage、Config Schema 业务语义；
- Web UI、PTY、Sync / GitHub / Update；
- 自动改写用户全局 `storeDir`、自动迁移 pnpm Store、自动创建项目级 Store；
- 把 `.lfaa/state/dependency-state.json` 中的历史 Store 路径当作实时事实；
- 自动 `pnpm update`、清空 Store、删除 `node_modules`。

### 状态所有权

- pnpm 可执行文件：当前 shell `Get-Command pnpm` / Corepack 实际 runner；
- PNPM_HOME：当前进程环境变量与 PATH 实际状态；
- pnpm Store：每次从当前项目根运行 `pnpm store path` 获得；
- Store 配置来源：当前项目 `pnpm-workspace.yaml`、pnpm 全局 `config.yaml` 与当前环境覆盖共同判断；
- 项目依赖健康：v0.0.56 的真实 Node resolve / 原生模块加载 / Store lockfile 探针；
- `.lfaa/state`：只允许记录最近成功同步状态，不得覆盖上述实时环境事实。

### 实现约束

- `Get-PnpmStorePath` 每次调用都必须真实执行当前 pnpm runner，且工作目录固定为 `$ProjectRoot`；禁止读取状态缓存返回旧路径；
- 新增 pnpm 环境事实对象时必须至少包含 `PNPM_HOME`、pnpm 可执行源、Store 当前路径、全局配置文件、全局 `storeDir`、项目 `storeDir`、Store 来源；
- LFAA 仓库自己的 `pnpm-workspace.yaml` 不得声明 `storeDir`；默认采用 pnpm 用户/机器环境当前结果；
- 若项目级存在 `storeDir`，必须明确显示“项目配置”；若全局存在则显示“用户全局配置”；二者均无显式值时显示“pnpm 默认”；
- 环境变量覆盖无法可靠归因时显示“环境/其他覆盖”，但仍以 `pnpm store path` 为最终路径；
- `pnpm setup` 只在 PNPM_HOME / PATH 缺失且确有需要时提示/执行，已就绪时不得重复 setup；
- PowerShell 保持 UTF-8 with BOM。

### 验收条件

- 用户从旧全局 Store 配置切回默认后，菜单 1 立即显示新的 `C:\Users\<用户>\AppData\Local\pnpm\store\v11`（实际路径以本机 `pnpm store path` 为准），不得继续显示旧 `H:\next-javaweb...`；
- 菜单 1 / 7 显示 Store 来源为项目配置 / 用户全局配置 / pnpm 默认 / 环境或其他覆盖之一；
- 修改全局 `storeDir` 后无需删除 `.lfaa/state`，下次运行即显示新路径；
- 项目仓库中没有 LFAA 强加的 `storeDir`；
- v0.0.56 的真实依赖健康与 Store 缺失检测继续生效。

### 必须测试

- dependency-setup 原有测试全部回归；
- 新增“Store 路径每次调用 pnpm 获取、不读缓存”“Store 来源识别”“仓库不声明项目 storeDir”“PNPM_HOME/PATH 只读显示”静态契约；
- node-dependency-health、release gates、release environment、Config Schema 回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.11 pnpm 实时环境事实与 Store 来源修复`

### 版本目标

`v0.0.57`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

### 被后续修正

Windows 实机发现局部变量 `$home` 与 PowerShell 自动只读变量 `$HOME` 冲突；由 #20.12 / v0.0.58 修复实现错误，#20.11 的实时 Store 设计继续保留。

## #20.10 真实依赖健康检测与 Store 状态修复

### 主模块

`project-governance / windows-setup / dependency-health`

### 背景与问题

用户在 Windows 实机中删除 `pnpm store path` 指向的 Store 后再次运行菜单 1，v0.0.55 仍显示“依赖声明、锁文件和本地安装状态均未变化；跳过 pnpm install”，最终还显示“当前依赖均已就绪”。根因是旧实现只检查依赖指纹、`node_modules/.modules.yaml` 和直接依赖 `package.json`，没有把真实 Node 解析/关键运行时可用性和 pnpm Store 健康拆开验证。

### 任务目标

把菜单 1 从“文件存在性检查”升级为真实依赖健康检查：依赖声明、项目真实可解析性、pnpm Store 缓存三层事实独立检测和展示。缓存指纹只能用于判断“声明是否变化”，不得再作为“本机依赖真实可用”的证据。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的 Node 依赖计划、Store 健康、修复提示与 unchanged 路径真实验证；
- 新增跨平台只读项目级依赖健康检查脚本与对应 Node 单测；
- `test/dependency-setup.test.mjs`、`scripts/release-gates-check.mjs` 的防回归契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.56 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Web Account/Auth、Config Storage、Config Schema 业务语义；
- Web UI、PTY 业务功能、Sync / GitHub / Update；
- Agent / Tool / Policy / Permission 执行链；
- 自动 `pnpm update`、自动删除 `node_modules` / pnpm Store、静默升级锁定版本；
- 把 pnpm Store 缺失错误描述成“项目一定无法运行”。

### 状态所有权

- 依赖声明真相：workspace `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`；
- 项目当前真实可用性：当前项目目录中的真实 Node 模块解析、关键入口和原生模块加载结果；
- pnpm Store 状态：运行时 `pnpm store path` 指向的真实目录与 pnpm Store 检查结果；
- `.lfaa/state/dependency-state.json` 仍仅为最近成功同步的缓存，不得决定依赖健康。

### 实现约束

- `Test-NodeDependencyInstallState` 的 manifest 检查只能作为浅层证据，跳过安装前必须额外通过真实依赖解析检查；
- 新增跨平台依赖健康检查时，必须从各 workspace 的真实 importer 位置解析外部依赖，不能只搜索字符串或读取旧状态缓存；
- `node-pty` 等原生关键模块在 unchanged 路径也必须执行既有真实加载检查，不能只在安装后检查；
- pnpm Store 必须区分“路径不存在/为空/状态异常”和“健康”；Store 缺失时必须明确提示；
- Store 缺失但项目实际解析仍通过时，显示“项目当前可用，但 Store 缓存缺失/不完整”，不得声称“全部依赖均已就绪”；
- 用户选择修复 Store 时，只按当前 lockfile 补齐缺失缓存，优先使用 pnpm 的 lockfile fetch 能力；不得 `pnpm update`；
- 项目真实解析失败时进入依赖同步分支；同步完成后必须再次执行真实解析和 Store 状态检查再写成功缓存；
- PowerShell 保持 UTF-8 with BOM。

### 验收条件

- 删除 `pnpm store path` 指向的 Store 后运行菜单 1，必须检测到 Store 缺失/为空，不得输出“当前依赖均已就绪”；
- 如果 node_modules 仍真实可解析，必须准确区分“项目当前可用”和“Store 缓存缺失”；
- 用户确认修复后，只恢复当前 lockfile 所需缓存，不升级依赖版本；
- 删除/损坏某个依赖的真实入口文件但保留其 `package.json` 时，真实健康检查必须失败，不能被 manifest 存在性骗过；
- unchanged + 项目真实解析通过 + Store 健康时，仍保持零安装快速返回；
- v0.0.55 的提示去重与路径展示保持。

### 必须测试

- 新增真实依赖健康检查单测：健康 fixture 通过；只保留 package.json 但删除真实入口时失败；
- dependency-setup 原 8 项全部回归，并增加 Store/真实解析门禁；
- release gates、release environment、Config Schema 回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.10 真实依赖健康检测与 Store 状态修复`

### 版本目标

`v0.0.56`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

## #20.9 依赖提示去重与路径可见性

### 主模块

`project-governance / windows-setup / dependency-ux`

### 任务目标

修正 v0.0.54 菜单 1 在“预检 → 检测 → 完成”之间重复输出 Node/pnpm/workspace 与 Node/Rust 完成状态的问题，并让用户能够直接看到项目依赖、pnpm Store、lockfile、Cargo 缓存和 Rust 工具链的实际位置。保持 #20.8 的增量安装语义不变：本任务只优化可读性与路径可见性，不改变何时安装依赖。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的菜单 1 / 菜单 7 输出组织、依赖路径探测与最终摘要；
- `test/dependency-setup.test.mjs`、`scripts/release-gates-check.mjs` 的防回归契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.55 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- #20.8 已确定的依赖指纹、增量安装、Yes/No 同步语义；
- Config Schema / Config Storage、Web UI、PTY、Sync / GitHub / Update；
- Agent / Tool / Policy / Permission 执行链；
- Agent Protocol / Config Schema Version / Database Schema Version；
- 为显示路径而创建、删除或迁移真实依赖目录。

### 输出约束

- Node / pnpm / workspace 环境摘要只显示一次，禁止“预检”和“检测”重复打印同一事实；
- unchanged 路径保留一次 Node 依赖状态和一次 Rust/Cargo 状态，结尾只保留一个 `【完成】【按需依赖】` 总结；
- 菜单 1 与菜单 7必须显示：项目 `node_modules`、`node_modules/.pnpm`、真实 `pnpm store path`、`pnpm-lock.yaml`、`.lfaa/state/dependency-state.json`、Cargo registry/git 缓存、Rust toolchains、Cargo.lock 状态；
- `pnpm Store` 必须运行时读取，不能写死用户名、盘符或固定 AppData 路径；
- 路径展示只读，不允许触发 update/prune/删除缓存；
- PowerShell 保持 UTF-8 with BOM。

### 验收条件

- 用户再次执行菜单 1 时，不再连续看到两组 Node/pnpm/workspace；
- unchanged 情况结尾不再分别重复 `Node/pnpm 完成` 与 `Rust/Cargo 完成`；
- 用户能从菜单 1 直接知道 Node 依赖、pnpm Store、锁文件、Cargo 缓存和 Rust 工具链在哪里；
- 菜单 7 环境检查同样能显示上述路径；
- v0.0.54 的增量检测、零安装、Yes/No 与禁止自动升级行为全部保持。

### 必须测试

- 依赖增量原 6 项测试全部回归；
- 新增路径可见性与提示去重测试；
- release gates、release environment、Config Schema 回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.9 依赖提示去重与路径可见性`

### 版本目标

`v0.0.55`

### 当前状态

`delivered`

### AI 验证

`pass`

### 用户验收

`passed`

## #20.8 按需依赖增量检测与复用

### 主模块

`project-governance / windows-setup / dependency-state`

### 任务目标

修复 v0.0.53 菜单 1 每次执行都会再次调用依赖安装的问题。菜单 1 必须先判断“工具链是否可用、项目依赖声明/锁文件是否变化、本地直接依赖是否缺失”；如果状态未变化且依赖完整，直接返回“已就绪”，不得再次执行 `pnpm install` / Cargo 下载。只有首次准备、依赖新增/删除/版本变化、锁文件变化、依赖目录缺失或工具链损坏时，才进入写操作。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的菜单 1 依赖检测、状态缓存、增量同步与 Rust 工具链复用逻辑；
- `test/` 与 `scripts/release-gates-check.mjs` 中针对按需依赖的防回归契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.54 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Config Schema / Config Storage 业务语义；
- Web 工作台 UI、PTY / node-pty 业务实现；
- Sync / GitHub / Update 行为；
- Agent / Tool / Policy / Permission 执行链；
- Agent Protocol / Config Schema Version / Database Schema Version；
- 自动执行 `pnpm update`、自动追逐上游最新版本或删除 pnpm 全局 store。

### 状态所有权

依赖真相仍来自 `package.json` / workspace manifests / `pnpm-lock.yaml` / `Cargo.lock` / `rust-toolchain.toml`；`.lfaa/state/dependency-state.json` 只保存本机“最近一次成功同步”的指纹缓存，可随时删除并重新建立，不得反向覆盖依赖声明。该状态目录已被 `.gitignore` 忽略，不进入正式版本事实。

### 实现约束

- 菜单 1 先检测后决定，不允许无条件执行 `pnpm install`；
- Node 指纹只包含包管理器事实、依赖声明和 lockfile，不包含 LFAA 产品版本号，避免纯版本递增触发无意义安装；
- 指纹一致且直接依赖完整时，显示“依赖已就绪”，不运行安装命令；
- 指纹变化时必须区分新增 / 删除 / 版本变化 / lockfile 变化并展示摘要，再由用户 Y/Yes 确认是否同步；
- 同步完成后重新计算真实指纹并写入 `.lfaa/state/dependency-state.json`；
- `pnpm install` 只负责把当前项目声明同步到本地；不得自动执行 `pnpm update`；pnpm store 与现有 `node_modules` 必须复用，不主动清空；
- 项目新版本明确改变锁定依赖时属于该项目版本所需依赖，用户可以取消本次写操作，但必须提示取消后当前版本可能无法运行；
- “上游出现更高版本”不属于菜单 1 自动更新范围；未来如提供更新检查，必须是独立显式操作并由用户确认；
- Rust 已存在正确 toolchain + rustfmt + clippy 时不得重复 `rustup toolchain install`；无外部 crate 时不得执行 `cargo fetch`；有 `Cargo.lock` 时只有 lockfile 指纹变化或首次同步才 fetch；
- Windows 安装与状态逻辑继续由 PS1 负责，MJS 只做静态/跨平台测试。

### 安全约束

- 只允许 pnpm，不降级 npm / yarn / bun；
- 不自动删除 node_modules / pnpm store / Cargo cache；
- 不静默升级依赖版本；
- 本机状态文件不得包含 Token、API Key、Secret 或用户业务数据；
- 任何依赖写操作必须在变更摘要后由用户确认。

### 验收条件

- 连续两次运行菜单 1：第一次成功同步后，第二次在依赖未变化时不得再次调用 `pnpm install`；
- 仅产品版本从 v0.0.53 → v0.0.54、依赖声明与锁文件不变时，不应触发 Node 依赖重装；
- 新增依赖 / 改版本 / 删除依赖 / lockfile 变化时，菜单 1 能检测并提示，再按用户确认同步；
- 缺失直接依赖或 node_modules 状态损坏时，即使指纹相同也必须修复；
- Rust 工具链已完整时不重复安装；无 Rust 外部依赖时不 fetch；
- 1 仍然只是按需入口，不变回开发前强制步骤；
- Windows PowerShell 保持 UTF-8 with BOM。

### 必须测试

- 依赖指纹不包含产品版本字段；
- unchanged 状态路径必须跳过 `pnpm install`；
- changed/missing 状态路径才进入同步；
- 依赖差异摘要覆盖新增 / 删除 / 版本变化；
- 禁止 `pnpm update` 与主动 store 清理的静态回归；
- Rust 重复安装 / fetch 防回归静态契约；
- 原 release environment、release gates、Config Schema 单测回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.8 按需依赖增量检测与复用`

### 版本目标

`v0.0.54`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

### 被后续修正

用户实机确认增量安装已正确跳过，但指出菜单 1 输出重复且缺少依赖实际路径；由 #20.9 / v0.0.55 修正展示层。

## #20.7 Setup 菜单与发布门禁解耦

### 主模块

`project-governance / windows-setup / quality-gates`

### 任务目标

修正 v0.0.52 把 `LFAA-Setup.bat` 菜单 1 / 10 绑定得过重、过绝对的问题。菜单编号只应是 Windows 便捷入口，不应成为开发流程或未来 CLI 的架构事实。保留严格的质量判断，但把“环境准备、快速检查、完整检查、正式发布验证”拆成可独立调用的能力；开发者环境已就绪时可以跳过菜单 1，日常开发也不必每次执行最重的发布验证。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的菜单 1 / 10 文案、分层入口和调用关系；
- 根 `package.json` 的 `quality:*` / `release:*` 聚合脚本；
- 发布门禁静态检查与对应测试；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.53 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Config Schema / Config Storage 业务语义；
- Web 工作台 UI、PTY / node-pty 业务实现；
- Sync / GitHub / Update 行为；
- Agent / Tool / Policy / Permission 执行链；
- Agent Protocol / Config Schema Version / Database Schema Version；
- 用菜单编号定义未来 CLI / GUI API。

### 状态所有权

跨平台质量能力以根 `package.json` 脚本为调用入口；Windows 系统环境准备与交互归 `scripts/windows/*.ps1`；`LFAA-Setup.bat` 和菜单编号只是 Windows Adapter，不拥有业务状态，也不是未来 CLI 协议。产品版本仍以 `lfaa.release.json` 为唯一事实源。

### 实现约束

- 菜单 1 改为“按需依赖准备”：仅在首次环境准备、依赖变化或环境损坏时使用；环境已就绪时可直接启动 Web / 构建 / 检查；
- 菜单 1 的 Windows 环境准备逻辑继续留在 PowerShell，不把下载、PATH、Corepack、Rust 安装行为迁入 MJS；
- 菜单 10 改为“检查中心”，至少提供：快速检查、完整项目检查、正式发布检查、返回主菜单；
- 快速检查不得做 `pnpm install`、不得要求 Rust，面向高频开发反馈；
- 完整项目检查覆盖 governance + typecheck + test + build，但不隐式安装依赖；
- 正式发布检查才执行冻结依赖安装、正式环境版本检查与 Rust check/test；
- 所有 `quality:*` / `release:*` 命令都必须可以脱离菜单直接在 CLI 调用；
- 禁止规定“必须先点 1 再点 10”或把菜单编号写成发布协议；
- 正式候选 ZIP 在 `pending-user-acceptance` 阶段允许在受限制作环境生成，但必须真实记录未执行/被阻断的门禁；只有 `release:full` 在受支持环境真实通过后，才允许写“完整发布门禁通过 / release-ready”；
- 用户明确验收前仍不得写 `delivered`。

### 安全约束

- 项目依赖仍只允许 pnpm；不允许自动降级 npm / yarn / bun；
- 正式发布检查仍使用 `pnpm install --frozen-lockfile`，不得静默修改 lockfile；
- 快速/完整检查不得借“修复环境”之名修改用户系统；
- Windows 环境写操作必须经过现有 PowerShell 明确交互，不得转移到 MJS 隐式执行。

### 验收条件

- Setup 主菜单明确说明 1 是按需入口，不是开发前强制步骤；
- Setup 菜单 10 进入分层检查中心，而不是直接执行最重发布链；
- 快速检查、完整项目检查、正式发布检查三种语义明确且可分别从 CLI 调用；
- `release:full` 继续作为“完整发布验证”命令，但不再被写成生成每个 pending 验收候选 ZIP 的绝对前置条件；
- PS1 负责 Windows 环境动作，MJS 仅保留跨平台项目级检查 / 静态门禁；
- v0.0.52 保留为未被用户接受的历史版本，不覆盖；
- Windows PowerShell 保持 UTF-8 with BOM。

### 必须测试

- PowerShell 菜单静态契约：1 为按需依赖，10 为检查中心且存在 3 个分层选项；
- `quality:quick` 不包含 install / Rust；
- `quality:full` 覆盖 governance / typecheck / test / build 且不包含 install；
- `release:full` 覆盖环境检查、frozen install、完整项目检查、Rust；
- 发布环境单测与 Config Schema 单测回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract；
- 当前受限容器无法满足 Node 24 / pnpm / Cargo 时，必须记录阻断，不得伪造 `release:full` 通过。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.7 Setup 菜单与发布门禁解耦`

### 版本目标

`v0.0.53`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

## #20.6 发布环境与质量门禁闭环

### 主模块

`project-governance / toolchain / release-gates`

### 任务目标

修复 v0.0.51 暴露出的发布流程缺口：项目虽然声明 Node 24.x + pnpm 11.17.0，但 Setup 在缺少正确 pnpm 时会提前退出，根级 `typecheck / test / build` 仍是占位失败命令，导致“完整检查”无法真正成为正式发布硬门禁。本任务把工具链版本、依赖锁定安装、真实质量聚合和 Rust 检查收敛成可执行发布闭环。

### 允许修改

- `LFAA-Setup.bat` 与 `scripts/windows/lfaa-setup.ps1` 的开发环境 / 完整检查逻辑；
- `scripts/pnpm-only.mjs` 与新增发布环境、Rust、发布质量门禁脚本；
- 根 `package.json` 的真实 `typecheck / test / build / release:*` 脚本；
- 开发规范、Runtime / Testing / Code Map / Prompt / Development Log；
- v0.0.52 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Config Schema 业务结构与校验语义；
- Config Storage / SQLite / Drizzle / Migration；
- Web 工作台 UI 交互和视觉行为；
- Agent / Tool / Policy / Permission 执行链；
- PTY / node-pty 业务实现；
- Sync / GitHub / Update 行为；
- Agent Protocol / Config Schema Version / Database Schema Version。

### 状态所有权

工具链要求以根 `package.json` 的 `engines` + `packageManager` 为单一事实源；产品版本仍以 `lfaa.release.json` 为事实源。Setup 只负责准备本机开发环境和调用门禁，不得修改业务真值。

### 实现约束

- Node 必须为 24.x；pnpm 必须精确为 11.17.0；
- `pnpm-only.mjs` 除限制包管理器外，还必须拒绝错误 pnpm 版本；
- Setup 在已有 Node 24 且 pnpm 不匹配 / 缺失时，必须优先通过 Corepack 准备 `pnpm@11.17.0`；准备失败必须明确失败，不得降级到其他包管理器；
- 发布依赖安装必须使用 `pnpm install --frozen-lockfile`，禁止发布门禁修改 lockfile；
- 根 `typecheck / test / build` 必须调用当前已实现模块的真实命令，不再调用“假成功/固定失败”的占位入口；
- 发布完整检查必须覆盖环境、frozen install、governance、TypeScript、单测、Web build、Rust check/test；
- 所有失败返回非零退出码，禁止“打印通过但实际未执行”。

### 安全约束

- 不自动使用 npm / npx / yarn / bun 管理项目依赖；
- Corepack 只能准备根 `package.json` 锁定的 pnpm 版本；
- 不下载或执行项目未声明的业务依赖；
- 环境准备与发布验证不得静默修改 Config / Secret / 用户业务数据。

### 验收条件

- 错误 Node 主版本被环境门禁拒绝；
- 错误 pnpm 版本被 preinstall / 发布环境门禁拒绝；
- 缺少精确 pnpm 时 Setup 会尝试 Corepack 准备锁定版本；
- frozen lockfile 安装失败时正式发布检查失败；
- 根 `typecheck / test / build` 全部为真实聚合命令；
- `release:verify` 覆盖 governance、TypeScript、tests、build、Rust；
- Setup“完整检查”先做 frozen install，再执行统一 `release:verify`；
- Windows PowerShell 继续 UTF-8 with BOM；
- 用户明确验收前状态保持 `pending-user-acceptance`。

### 必须测试

- 发布环境脚本在当前非 Node 24 环境必须正确失败；
- 对环境检测核心逻辑做可注入单元测试，覆盖 Node / pnpm 正确和错误版本；
- `pnpm-only.mjs` 版本门禁静态 / 行为测试；
- Setup PowerShell 语法与 BOM；
- `node scripts/governance-check.mjs` 及全部现有 Node 门禁；
- 在满足 Node 24 + pnpm 11.17.0 的环境运行 `pnpm install --frozen-lockfile` + `pnpm run release:verify`；若当前执行容器无法满足，正式发布包不得伪造该结果，且 Release 必须记录阻塞事实。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/TESTING.md`、`docs/RUNTIME.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.6 发布环境与质量门禁闭环`

### 版本目标

`v0.0.52`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

## #2.2 Config Schema 基线

### 主模块

`config-system / config-schema`

### 任务目标

正式开始 LFAA 第一个业务模块 `config-system`，本次只完成第一阶段 `config-schema`：建立配置对象的版本化 TypeScript 契约、默认值、运行时校验与安全字段边界，为后续 Config Storage / Migration / Settings / Model / Account / Permission / UI 提供唯一 Schema 事实源。

### 允许修改

- `packages/settings/config-system/**`；
- Config Schema 专项门禁与根 package 脚本；
- Config System 的 Plan / Progress / Prompt / Development Log / Testing / Code Map；
- v0.0.51 版本事实、CHANGELOG、Release；
- 所有 workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- SQLite / Drizzle / Config Storage / Migration 执行器；
- Rust Secret Store 的真实 Secret 实现；
- API Key / Token / Password 等 Secret 明文持久化；
- Config UI / Web 工作台交互；
- Agent Runtime / Tool Runtime / Policy / Permission 执行逻辑；
- PTY / node-pty；
- Sync / GitHub / Setup / Update 业务行为；
- Agent Protocol 与 Database Schema Version 语义。

### 状态所有权

Config Schema 的唯一事实源是 `@lfaa/config-system`。Schema Version 只在该模块定义；账号仅保存 `credentialRef`；真实 Secret 归未来 Rust Secret Broker / OS Credential Store。UI 不拥有 Config 真值，后续 Storage 不得另造第二套配置结构。

### 实现约束

- Product Version 与 Config Schema Version 分离；本版本产品为 v0.0.51，Config Schema Version 为 1；
- Schema 使用可序列化 JSON 数据；
- Provider / Model / Account ID 唯一；引用必须完整；
- 校验保持本地纯内存 O(n)，典型各 100 项配置目标 P95 < 10ms；
- 不新增第三方运行时依赖；
- 新关键实现文件使用结构化中文文件头。

### 安全约束

- 禁止 `apiKey` / `token` / `secret` / `password` 等 Secret 明文字段；
- Account 只允许 `credentialRef`；
- 运行时校验拒绝嵌套 Secret 字段和危险对象键；
- 本任务不读取 OS Credential Store，不进行数据库、网络或进程 I/O。

### 验收条件

- 新增 `@lfaa/config-system`；
- Config Schema Version 单一且为 1；
- Settings / Runtime / Provider / Model / Account / Permission 边界清晰；
- 默认配置通过自身校验；
- 错误 Schema Version、重复 ID、悬空引用、Secret 明文字段被拒绝；
- 不包含 Storage / Secret 明文 / Config UI 实现；
- 当前任务状态为 `pending-user-acceptance`，用户明确验收前不得写 `delivered`。

### 必须测试

- `pnpm --filter @lfaa/config-system exec tsc -p tsconfig.json --noEmit`；
- `pnpm --filter @lfaa/config-system test`；
- `node scripts/config-schema-check.mjs`；
- `pnpm run governance:check`；
- Windows PowerShell BOM 不回退。

### 必须更新的文档

`PROJECT_PLAN.md`、`docs/MODULES.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`packages/README.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#2.2 Config Schema 基线`

### 版本目标

`v0.0.51`

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`

### 用户验收

`pending`


> 迁移来源：`docs/prompts/active/0020-05-文档体系单文件时间线重构.md`

## #20.5 文档体系单文件时间线重构

### 主模块

`project-governance / documentation`

### 任务目标

把当前按“每次任务 / 每个版本一个 Markdown”拆分的文档体系重构为“按文档职责长期维护少量固定文档 + 编号递增时间线”的结构，减少 Markdown 文件数量，同时保留现有历史内容和可追溯性。

### 背景

截至 v0.0.49，`docs/` 中约有 251 个 Markdown 文件。Prompt、Development Log、Changelog、Release 等时间序列信息被拆成大量独立文件和 active/archive/version 目录，长期维护会造成：

- 人类浏览成本高；
- AI 读取入口过多；
- active/archive 搬运容易产生新旧漂移；
- 治理脚本需要维护大量具体路径；
- 项目继续迭代后 Markdown 文件数量会线性膨胀。

用户要求改为：同一职责由一个长期 Markdown 承载，通过 `#编号 + 功能名称 + 版本 + 状态` 递增追加记录。

### 允许修改

- `docs/**`
- `AGENTS.md`
- `DEVELOPMENT.md`
- `ARCHITECTURE.md`
- `PROJECT_PLAN.md`
- `CHANGELOG.md`
- 文档治理相关 `scripts/*.mjs`
- `package.json`
- `lfaa.release.json`
- 各 workspace / crate 版本号
- 为 v0.0.50 所需的 Release / Changelog / Prompt / Development Log 记录

### 禁止修改

- Web UI 功能实现；
- 三向吸附与响应式布局逻辑；
- PTY / node-pty；
- Sync / GitHub / Setup / Update 的业务行为；
- Protocol / DB Schema；
- 安全执行链。

### 状态所有权

文档治理状态由 `DEVELOPMENT.md` + 固定时间线文档 + 治理脚本共同约束。

### 实现约束

1. 不按任务继续创建新的碎片化 Markdown；
2. 当前事实与历史时间线分开：当前事实允许覆盖更新，历史记录只追加；
3. 旧 Prompt / Log / Changelog / Release 内容必须迁移到固定长期文档，不能静默丢失；
4. 新体系必须让 AI 打开仓库后通过 `AGENTS.md` / `DEVELOPMENT.md` 一眼知道读取顺序和开发生命周期；
5. 新任务必须先写 Prompt 条目，再改实现，再 AI 自测，再进入 `pending-user-acceptance`，用户验收后才允许标记 `delivered`；
6. 治理脚本必须从“检查大量具体历史文件”改成“检查固定文档及编号 / 版本 / 状态一致性”。

### 目标文档形态

优先保留少量长期文档，例如：

- `docs/README.md`
- `docs/项目结构与代码地图.md`
- `docs/PROMPTS.md`
- `docs/DEVELOPMENT_LOG.md`
- `docs/MODULES.md`
- `docs/UI.md`
- `docs/TESTING.md`
- `docs/RELEASES.md`
- `docs/RUNTIME.md`

根目录继续保留当前事实 / 项目入口：

- `DEVELOPMENT.md`
- `ARCHITECTURE.md`
- `PROJECT_PLAN.md`
- `CHANGELOG.md`

### 验收条件

- `docs/` Markdown 文件数量从约 251 大幅下降到十几个以内；
- 历史 Prompt、Development Log、Changelog、Release 可通过编号或版本在固定文档中搜索到；
- 不再存在 `docs/prompts/active|archive`、`docs/logs/development/active|archive`、`docs/changelog/v*.md`、`docs/releases/v*/RELEASE.md` 这类无限增长结构；
- DEVELOPMENT / AGENTS 明确写出 `Prompt → Code → AI Test → pending-user-acceptance → User Acceptance → delivered`；
- 当前开发任务编号、版本、Prompt、Log、Changelog、Release 状态一致；
- governance / docs / dev-log / release consistency / comment / Windows encoding / UI contract 等相关门禁全部通过；
- ZIP round-trip、中文路径、PowerShell BOM 验证通过。

### 必须测试

- 文档迁移内容计数和源文件映射；
- 固定文档存在性；
- 碎片目录不存在；
- `#20.5` / `v0.0.50` 一致性；
- 开发状态不得在用户验收前写成 `delivered`；
- 现有 UI / Windows 脚本核心文件 Hash 不发生无关变化。

### 必须更新的文档

本任务本身即负责重构文档体系；完成后所有当前规则更新到新固定文档。

### CHANGELOG 编号

`#20.5`

### 版本目标

`v0.0.50`

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`

### 用户验收

`pending`

> 迁移来源：`docs/prompts/active/0002-配置系统.md`

## #2 配置系统

### 主模块

`config-system`

### 任务目标

按照 LFAA 开发规范，逐步完成配置系统，先完成整个配置系统达到可交付，再进入其他业务模块。

### 开发顺序

0. Web Workbench Shell（#21，先用于本地 UI / 热插拔验证）
1. Config Schema
2. Config Storage
3. Settings Domain
4. Model Management
5. Account Management
6. Permission Settings
7. Config UI
8. Tests
9. Optimization
10. Delivery

### 安全约束

- API Key/Token 不得明文存入普通 SQLite 配置表。
- 只保存 Credential Reference。
- UI 不直接读取 Secret。

### 工具链约束

- Node.js 包管理器只允许 pnpm；
- 新增依赖使用 `pnpm add`；
- workspace 命令使用 `pnpm run` / `pnpm --filter` / `pnpm -r`；
- 禁止 npm、npx、yarn、bun 替代 pnpm。

### 项目资源作用域

Skills、Experts、Plugins、Extensions、MCP 只从当前项目 `.lfaa/` 解析。

### 验收条件

Schema 唯一；Storage 可迁移；Model/Account/Permission 清晰分层；UI 与业务状态分离；测试通过；Progress/Changelog 完整。

### CHANGELOG 编号

`#2 配置系统`

> 迁移来源：`docs/prompts/active/0020-开发规范执行.md`
> 状态：`superseded`，已由 #20.5 的单文件文档合同取代；保留在此只用于追溯。

## #20.4 开发规范执行合同

### 触发条件

用户明确说：

```text
按照开发要求做
按照开发规范开发
严格按照开发规范
```

即触发本合同。

### 强制流程

必须先按 `DEVELOPMENT.md` / `AGENTS.md` 的顺序读取当前事实源，再修改代码。不能先改代码后补记录。

每次实际交付必须同时确认：

1. 当前版本与历史版本分离；
2. Plan / Progress / Prompt / Development Log 是否需要更新；
3. 相关 Standards 是否发生变化；
4. CHANGELOG / Release 与实际代码一致；
5. 代码注释、目录地图、文件职责与实现一致；
6. 相关治理 / 编码 / 版本 / ZIP 门禁通过；
7. 不覆盖旧版本包。

### Windows PowerShell 特别规则

任何 `scripts/windows/*.ps1`：

- 必须使用 UTF-8 with BOM；
- 中文结构化注释不能以牺牲 Windows PowerShell 5.1 可执行性为代价；
- 修改后必须经过 `windows-script-encoding-check.mjs`。

> 迁移来源：`docs/prompts/active/0021-Web工作台UI.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

以 v0.0.48 为历史基线，调整 Composer 垂直落点。输入框不应贴近窗口底边；底部间距必须变量化并按 Desktop / Compact / Mobile 响应，不允许通过散落的固定 `margin-bottom` 或 absolute 定位硬抬。

### 当前实现要求

#### 1. 单一底部间距变量

```text
--agent-composer-bottom-gap
→ .agent-composer-wrap
→ max(variable, safe-area-inset-bottom)
```

#### 2. 响应式取值

- Desktop 使用 `clamp()` + `vh`，适度抬高 Composer；
- Compact 减小留白，避免短窗口浪费高度；
- Mobile 保留较小固定 rem，并尊重 safe area；
- 不新增第二套 Composer bottom 数值来源。

#### 3. 保持现有行为

- Hover / Click 左栏宽度统一不回退；
- 容器响应式 / Desktop / Compact / Mobile 不回退；
- 三向到 min 吸附收起不回退；
- Pointer 不松手反向解锁不回退；
- Header / Tooltip / PTY / Sync / GitHub / Setup / Update 不改业务逻辑。

### 允许修改

- `packages/client/app-shell/src/agent-workbench.css`；
- `scripts/ui-contract-check.mjs`；
- 当前 UI 文档、测试、Plan / Progress / Development Log / Changelog / Release / Version。

### 验收条件

- Desktop 输入框下方留白明显比 v0.0.48 更舒适；
- Compact / Mobile 不因固定大间距浪费高度；
- safe-area 仍然生效；
- 不用 absolute / transform 假移动 Composer；
- UI contract 能阻止固定底部 padding 回归；
- 基础设施和 PTY 不变。

### 当前状态

`active / pending-windows-visual-test`

## 历史 Prompt 时间线

> 以下内容由 v0.0.49 及以前的独立 Prompt 文件无损迁移而来。原路径作为迁移来源保留，旧碎片文件已移除。

> 迁移来源：`docs/prompts/archive/v0.0.1/0001-项目基础.md`

## #1 项目初始化与架构骨架

### 主模块

`project-foundation`

### 任务目标

建立 Little Fish AI Agent（LFAA）v0.0.1 的项目治理与 Monorepo 架构骨架。

### 允许修改

项目根目录治理文件、apps/packages/crates 骨架、docs。

### 禁止修改

不实现真实业务能力。

### 验收

- 当前架构明确；
- 历史架构隔离；
- 开发规则可被 AI 第一时间发现；
- 主模块与下一步明确；
- 首包名称为 `LFAA-v0.0.1`。

> 迁移来源：`docs/prompts/archive/v0.0.2/0003-导入路径规范.md`

## #3 导入路径与 Alias 优化

### 主模块

`project-foundation`

### 任务类型

基础架构优化 / config-system 开发前置任务

### 任务目标

避免 LFAA 随目录增长出现：

```text
../../../
../../../../
```

等深层相对路径。

建立：

- `./` 同模块导入；
- `@/` 当前 workspace 导入；
- `@lfaa/*` 跨 package 导入；
- 自动检查。

### 允许修改

- 项目治理文件
- TypeScript workspace `tsconfig.json`
- scripts
- project-foundation Plan/Progress
- config-system Progress 前置记录
- Changelog / Release

### 禁止修改

- config-system 真实业务代码
- Agent Runtime 行为
- Rust 执行逻辑
- 数据库业务 Schema

### 验收

- 所有 TS workspace 有本地 `@/* -> src/*`
- 禁止 `../../` 及以上深层导入
- 跨 package 不访问 internal
- 自动检查可执行
- 主模块仍保持 `config-system`

> 迁移来源：`docs/prompts/archive/v0.0.3/0004-稳定工作区同步.md`

## #4 稳定工作区同步与 GitHub 推送

### 主模块

`project-foundation`

### 任务类型

开发基础设施优化

### 任务目标

让每个 LFAA 版本快照能够安全、完整地同步到：

```text
H:\lfaa\lfaa
```

并保证：

- `.git` 常驻；
- 新增/修改/删除真实检测；
- 彩色详细路径；
- 删除前确认；
- 同步后完整校验；
- 一键 GitHub 推送脚本随版本包恢复。

### 参考脚本风格

用户提供的 XMA Sync/GitHub BAT 采用：

- BAT 仅作为启动器；
- PowerShell 承担真实逻辑；
- 窗口保留结果。

LFAA 沿用该分层方式，并增加真实 diff、SHA-256 校验、颜色输出和稳定工作区定位。

### 禁止修改

- config-system 业务实现；
- Agent Runtime 行为；
- Rust Broker 行为。

### 验收

- 正式版本包含 `LFAA-Sync.bat` 与 `LFAA-GitHub.bat`
- PowerShell 位于 `scripts/windows/`
- 同步前展示 ADD/MOD/DEL 完整路径
- 同步后无项目文件差异
- `.git` 不被删除/覆盖
- GitHub 脚本始终优先操作稳定工作区

> 迁移来源：`docs/prompts/archive/v0.0.4/0005-同步日志目录.md`

## #5 同步日志目录优化

### 主模块

`project-foundation`

### 任务目标

将 LFAA-Sync 运行生成的同步日志从隐藏目录：

```text
.lfaa-local/sync-logs/
```

迁移到：

```text
docs/logs/workspace-sync/
```

使开发留痕更直观、可发现、按 docs 分类管理。

### 约束

- `*.log` 不参与版本镜像差异判断；
- `*.log` 不被新版本同步删除；
- `*.log` 默认不推送 GitHub；
- `README.md` 正常进入版本控制；
- 不修改 config-system 业务。

### 验收

- PowerShell 生成日志到新目录；
- 同步后校验不会因旧日志失败；
- `.gitignore` 忽略运行日志；
- 文档/Progress/Changelog 同步更新。

> 迁移来源：`docs/prompts/archive/v0.0.5/0006-GitHub推送修复.md`

## #6 GitHub 一键推送修复

### 主模块

`project-foundation`

### 问题

首次运行：

```text
LFAA-GitHub.bat
```

到：

```text
git init
```

时 Git 只显示帮助页，没有真正执行 `init`。

### 根因

PowerShell helper 使用：

```text
param([string[]]$Args)
```

`$Args` 与 PowerShell 自动变量冲突，导致 Git 子命令没有正确传递。

### 任务目标

- 修复 Git 命令参数传递；
- 按同步脚本标准显示 Git 文件变化；
- Commit 名称由用户自定义；
- 首次 Commit 不写死 `first commit`；
- Commit/Push 分别确认；
- 保留 `.git`；
- 不使用 force push；
- 生成 GitHub Push 本机日志。

### 禁止修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

### 验收

首次运行能够执行：

```text
git init
git branch -M main
git remote add origin ...
git add -A
git commit -m "<用户输入>"
git push -u origin main
```

后续运行复用原 `.git`。

> 迁移来源：`docs/prompts/archive/v0.0.6/0007-GitHub远程检测.md`

## #7 GitHub 首次远程仓库检测与中文输出修复

### 主模块

`project-foundation`

### 问题

首次 Git 初始化成功后：

```text
git remote get-url origin
```

因为 `origin` 尚未创建而返回错误。

Windows PowerShell 在 `$ErrorActionPreference = "Stop"` 下把 Git stderr 包装成错误，导致脚本提前退出。

同时 Git 原生命令直接输出到控制台，出现大量英文。

### 根因

1. 首次状态没有 `origin` 是正常情况，脚本却直接读取 URL。
2. PowerShell 对原生命令 stderr 的处理导致预期状态升级为错误。
3. 没有统一捕获 Git stdout/stderr。

### 修复

- 先执行 `git remote` 判断是否存在 `origin`；
- 不存在则直接 `git remote add origin`；
- 存在才执行 `git remote get-url origin`；
- 新增 `Invoke-GitRaw` 捕获原始 Git 输出；
- 默认控制台只显示中文状态；
- Git 原始英文技术信息仅在失败时写入日志；
- Git 中文路径设置 `core.quotepath=false`；
- 保留用户自定义 Commit 名称流程。

### 验收

- 已经存在但没有 origin 的 `.git` 可以继续运行；
- 全新 `.git` 可以首次添加 origin；
- 控制台默认不直接打印 Git 英文帮助/错误；
- 首次和后续 Commit 均由用户自定义名称。

> 迁移来源：`docs/prompts/archive/v0.0.7/0008-Git远程配置.md`

## #8 用户首次配置 Git origin

### 主模块

`project-foundation`

### 目标

GitHub / Git 一键推送脚本不得写死仓库地址。

首次运行时，如果 `.git/config` 中没有 `origin`：

1. 提示用户输入 Git 仓库地址；
2. 显示并确认；
3. 执行 `git remote add origin <地址>`；
4. 保存到 `.git/config`；
5. 后续运行自动读取，不再次要求输入。

### 原则

`origin` 的唯一事实源：

```text
.git/config
```

不再额外创建 LFAA 自定义 origin 配置文件。

### 支持地址

- HTTPS
- SSH URL
- SCP 风格 SSH
- file://

### 不修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

> 迁移来源：`docs/prompts/archive/v0.0.8/0009-终端完成状态.md`

## #9 终端完成状态与关闭提示

### 主模块

`project-foundation`

### 问题

同步或 GitHub 推送成功后，终端虽然显示成功信息，但没有明确告诉用户：

- 后台流程是否已经彻底结束；
- 终端是否可以关闭；
- 是否还需要等待。

### 目标

同步与 GitHub 推送脚本必须在结束时给出明确状态。

成功：

```text
【提示】【可关闭】全部操作已完成，现在可以安全关闭终端窗口。
【提示】【操作】按任意键关闭窗口，或直接点击右上角 X。
```

失败：

```text
【提示】【可关闭】错误信息已经保留，现在可以关闭窗口；处理问题后再重新运行。
```

### 实现

- BAT 只负责启动 PowerShell；
- 不再由 BAT 执行额外 pause；
- PowerShell 统一掌控最终提示；
- 成功和失败分别显示不同颜色；
- Windows 交互终端下等待任意键；
- 非交互终端不因 ReadKey 失败而再次报错。

### 不修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

> 迁移来源：`docs/prompts/archive/v0.0.9/0010-Commit确认优化.md`

## #10 移除 Commit 二次确认

### 主模块

`project-foundation`

### 问题

用户已经手工填写：

```text
【提交】【名称】
```

之后，脚本又要求：

```text
【确认】【创建提交】
```

属于重复确认，增加不必要的交互。

### 目标

流程改为：

```text
输入 Commit 名称
→ 直接创建本地 Commit
→ 检测远程
→ Push 前确认
```

### 保留

Push 前确认必须保留，因为 Push 会修改远程仓库。

### 不修改

- config-system 业务
- Agent Runtime
- Rust Broker

> 迁移来源：`docs/prompts/archive/v0.0.10/0011-源码更新脚本.md`

## #11 Git Clone 后一键更新源码

### 主模块

`project-foundation`

### 问题

`git clone` 只适合第一次下载仓库。

GitHub 仓库后续更新时，不应该重新删除目录再 clone。

### 目标

新增：

```text
LFAA-Update.bat
scripts/windows/lfaa-update.ps1
```

实现已有 Git 工作区的一键安全更新。

### 安全规则

- 有未提交修改：停止；
- 本地与远程分叉：停止；
- 本地领先：不 pull，提示 Push；
- 本地纯落后：允许 fast-forward only；
- 禁止 hard reset；
- 禁止自动删除用户本地文件；
- 更新前展示远程文件变化；
- 更新后验证 HEAD；
- 保存本机更新日志。

### 不修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

> 迁移来源：`docs/prompts/archive/v0.0.11/0012-脚本菜单与强制更新.md`

## #12 Windows 脚本菜单化与强制拉取

### 主模块

`project-foundation`

### 目标

三个 Windows 工具双击后不得直接执行写操作，必须先进入数字菜单。

#### Update

```text
1 安全拉取
2 强制拉取
3 仅检查更新
0 退出
```

#### Git Push

```text
1 一键提交并推送
2 查看 Git 状态
3 配置/修改 origin
0 退出
```

#### Sync

```text
1 预览同步差异
2 执行同步
3 查看同步配置
0 退出
```

### 强制拉取安全设计

强制模式允许当前分支完全对齐远程，但必须先建立恢复点：

1. `git fetch --prune`
2. 建立 `lfaa-backup/<branch>-<timestamp>` 备份分支
3. 未提交文件使用 `git stash push -u`
4. `git reset --hard origin/<branch>`
5. `git clean -fd`
6. 校验本地/远程一致
7. 显示 backup branch / stash 恢复信息

Git ignored 文件不使用 `-x` 清理，因此 `.env`、缓存等忽略项继续保留。

> 迁移来源：`docs/prompts/archive/v0.0.12/0013-更新路径无关.md`

## #13 Git 更新脚本路径无关化

### 主模块

`project-foundation`

### 问题

源码拉取不能依赖：

```text
H:\lfaa\lfaa
```

也不能假设项目目录一定叫：

```text
lfaa
```

用户可能把项目放在：

```text
C:\Code\LFAA
D:\AI\LittleFish
E:\Projects\Agent
U:\Source\LFAA
```

### 目标

`LFAA-Update.bat` 必须根据用户实际项目位置自动找到 Git 根目录。

### 定位顺序

1. 脚本所在项目 `git rev-parse --show-toplevel`
2. 用户启动脚本时的当前目录
3. 扫描脚本附近 Git 工作区
4. 多个项目时让用户选择
5. 无法识别时要求用户输入项目路径并验证

### 原则

- 不写死盘符；
- 不写死 `H:\lfaa`；
- 不要求目录名必须为 `lfaa`；
- 只认真实 `.git` / Git 根目录；
- 路径中有空格也必须正常工作。

> 迁移来源：`docs/prompts/archive/v0.0.13/0014-同步菜单顺序.md`

## #14 同步菜单顺序优化

### 主模块

`project-foundation`

### 目标

调整 `LFAA-Sync.bat` 菜单顺序，让最高频操作放在数字 `1`。

### 新顺序

```text
1 执行同步
2 预览差异
3 同步配置
0 退出
```

### 原因

日常最常用操作是实际同步，因此数字 `1` 应直接进入执行同步流程。

### 不修改

- 同步安全机制；
- SHA-256 校验；
- Git 保护；
- config-system 业务。

> 迁移来源：`docs/prompts/archive/v0.0.14/0015-更新差异修复.md`

## #15 Update 安全拉取远程差异读取修复

### 主模块

`project-foundation`

### 现象

安全拉取已经得到：

```text
本地领先 0
本地落后 0
```

随后仍执行远程文件差异读取，并可能错误终止为：

```text
读取远程文件变化失败
```

### 根因

状态判断顺序错误。

`0 / 0` 已经证明本地与远程一致，本不需要继续执行文件 diff。

### 修复

1. ahead=0 / behind=0 时立即返回“已是最新”；
2. 本地纯领先、且不是强制模式时不读取远程 diff；
3. 安全拉取遇到分叉时先停止，不执行无意义 diff；
4. 只有真正需要展示变化时才读取文件差异；
5. 文件比较由 revision-range：
   `HEAD..origin/main`
   改为两个明确 ref：
   `git diff <local-sha> <origin/ref>`；
6. 增加 `git diff-tree` fallback；
7. 两种比较都失败时才真正终止并写技术日志。

> 迁移来源：`docs/prompts/archive/v0.0.15/0016-项目治理加固.md`

## #16 项目治理、归属与项目级资源边界加固

### 主模块

`project-foundation`

本任务是 `config-system` 开发前的全项目基础设施加固，不改变当前主业务模块顺序。

### 完成范围

- 性能、安全、质量门禁；
- LFAA 官方命名、作者署名和第三方归属规则；
- `.lfaa/` 项目级 Skills / Experts / Plugins / Extensions / MCP；
- `LFAA-Setup.bat` 开发环境与依赖菜单；
- pnpm 版本与 lockfile；
- 禁止 build/typecheck/test 假成功。

### 状态

`delivered in v0.0.15`

> 迁移来源：`docs/prompts/archive/v0.0.15/0017-pnpm一致性.md`

## #17 pnpm-only 一致性修复

### 主模块

`project-foundation`

### 问题

项目已经固定 pnpm，但根 `package.json` 的 test 脚本和 `DEVELOPMENT.md` 仍残留 npm 命令，Setup 环境页也继续展示 npm，容易让后续开发者或 AI 误认为 npm 可用。

### 修复

- 根 test 改为 `pnpm run governance:check`；
- DEVELOPMENT 命令统一为 pnpm；
- Setup 不再展示 npm；
- 新增 `preinstall` pnpm-only 门禁；
- Governance 检查根 scripts 不得调用 npm/npx/yarn/bun；
- AGENTS/README/QUALITY_GATES 明确 pnpm-only。

### 状态

`delivered in v0.0.15`

> 迁移来源：`docs/prompts/archive/v0.0.16/0018-Setup缺少Cargo修复.md`

## #18 Setup 菜单缺少 Cargo 时错误终止修复

### 主模块

`project-foundation`

### 问题

用户运行：

```text
LFAA-Setup.bat
→ 1 全部依赖
```

pnpm workspace 依赖已经成功安装，但机器未安装 Cargo 时，脚本随后抛出：

```text
未检测到 Cargo。
```

导致菜单 1 被标记为失败。

### 根因

菜单 1 将 Node/pnpm 与 Rust/Cargo 两套工具链错误地当成一个不可分割的前置条件。

### 修复

- 菜单 1 先做 Node/Rust 工具链预检；
- Node 可用则安装 Node 依赖；
- Cargo 可用则安装 Rust 依赖；
- 缺少某一工具链时安全跳过并明确提示；
- 已成功完成的依赖安装结果保留；
- 两类工具链都不存在时才失败；
- 菜单 4 和菜单 10 仍严格要求 Cargo。

### 不修改

- Config System 业务；
- Agent Runtime；
- Rust Broker。

> 迁移来源：`docs/prompts/archive/v0.0.17/0019-一键准备与资源根.md`

## #19 一键准备与项目资源根收敛

### 主模块

`project-foundation`

### 目标

1. 将 Setup 菜单 1 升级为真正的一键准备入口；
2. 消除根 `/skills`、`/plugins` 与 `.lfaa/*` 双重事实源；
3. 固定 `.lfaa` 热插拔资源模型。

### Setup

- pnpm install 始终可重复运行并复用已下载依赖；
- 缺少 Cargo 时通过 winget 尝试安装 Rustlang.Rustup；
- 不在没有受控 Cargo.lock 时偷偷生成本机锁文件；
- 项目尚无外部 Rust crate 时明确无需 fetch。

### Resource Root

唯一项目资源根：

```text
.lfaa/
```

删除：

```text
/skills
/plugins
```

### Hot Plug

后续 File Watcher 监听 `.lfaa/skills|experts|plugins|extensions|mcp`，经校验后发布新的 Registry Generation。运行中的 Run 固定使用原 generation。

> 迁移来源：`docs/prompts/archive/v0.0.18/0020-开发日志规范.md`

## #20 开发日志分层规范

### 主模块

`project-foundation`

### 目标

建立“当前日志 / 历史日志”分层，并把开发日志读取顺序、编号、命名和中文文档要求写成硬规则。

### 关键要求

- 开发前先读 DEVELOPMENT；
- 再读 Development Log INDEX；
- 只从 active 获取当前结论；
- archive 只用于回溯；
- 同一问题使用 #NN.x；
- 旧记录不删除；
- 旧记录必须指向新记录；
- 文档中文为主；
- 标题清晰、内容逐项列出；
- 文件名短、准、规范。

### 状态

`delivered in v0.0.18`

> 迁移来源：`docs/prompts/archive/v0.0.19/0020-01-历史编号迁移.md`

## #20.1 历史编号迁移

### 主任务

`#20 开发日志分层规范`

### 问题

#20.0 建立了 active/archive，但 Development Log 中只直接显示 #20，#1 - #19 只有 legacy 指针。

这不满足“旧记录不删除、可以直接搜索和对比”的要求。

### 修复

- #1 - #19 逐条纳入 Development Log；
- #2 保持 active；
- #1、#3 - #19 进入 archive；
- #20.0 保存为 superseded 历史快照；
- #20 active 更新为 #20.1；
- Dev Log Check 增加主编号连续性检查；
- 原 Prompt / Progress / Changelog / Release 全部保留。

### 编号说明

没有真实 #0 历史，不伪造 #0。

### 状态

`delivered in v0.0.19`

> 迁移来源：`docs/prompts/archive/v0.0.20/0020-02-中文命名与文档整理.md`

## #20.2 中文命名与文档整理

### 主任务

`#20 开发日志与文档规范`

### 目标

让 `docs/` 长期可读、可查、可维护，避免英文短名和目录混乱增加维护成本。

### 本次规则

- 编号类人类文档使用中文短名；
- Development Log 当前文件使用 `NNNN-中文短名.md`；
- Development Log 历史文件使用 `NNNN-NN-中文短名.md`；
- Prompt 同样使用编号 + 中文短名；
- `docs/` 顶层目录保持短英文稳定路径；
- 每个主要分类必须有中文 README 导航；
- 运行日志统一归入 `docs/logs/runtime/`；
- 开发决策日志只放 `docs/logs/development/`。

### 状态

`delivered in v0.0.20`

> 迁移来源：`docs/prompts/archive/v0.0.21/0010-01-GitHub推送取消二次确认.md`

## #10.1 GitHub 推送取消二次确认

### 主任务

`#10 GitHub 推送确认交互`

### 目标

取消“一键推送”在本地 Commit 已创建之后的远程 Push 二次确认。

### 新流程

```text
菜单 1 一键推送
→ 查看变化
→ 输入 Commit 名称
→ 创建 Commit
→ 显示 origin / 分支 / Commit
→ 直接 Push
```

### 保留确认

- 新增 origin；
- 修改 origin；
- 强制拉取；
- 其他高风险覆盖操作。

### 状态

`delivered in v0.0.21`

> 迁移来源：`docs/prompts/archive/v0.0.22/0019-01-一键准备真实检测.md`

## #19.1 一键准备真实检测

### 主任务

`#19 一键准备与依赖检测`

### 问题

用户机器已有 Node / pnpm，`pnpm install` 也成功，但：

- 当前项目没有实际第三方 Node 依赖；
- `node_modules` 因此只有少量 pnpm 元数据；
- Cargo 缺失；
- winget 也缺失；
- 旧逻辑无法继续自动补 Rust。

### 修改

- Node 版本和路径真实检测；
- pnpm 版本和路径真实检测；
- workspace / Node 依赖声明统计；
- 明确解释零外部依赖时 node_modules 很小；
- winget 不可用时使用 Rust 官方 rustup-init；
- rustup-init 同时下载官方 SHA-256 并校验；
- 显式安装 stable Rust toolchain；
- 自动安装仍失败时返回“部分完成”，不假绿。

### 状态

`delivered in v0.0.22`

> 迁移来源：`docs/prompts/archive/v0.0.24/0019-03-统一开发入口.md`

## #19.3 统一开发入口

### 主任务

`#19 一键准备与依赖检测`

### 目标

将 Web / Desktop 的启动、构建和发布入口统一收敛到：

```text
LFAA-Setup.bat
```

### 新菜单

```text
1  一键依赖
2  启动 Web
3  启动桌面
4  构建 Web
5  构建桌面
6  构建发布
7  环境检查
8  项目资源
9  治理检查
10 完整检查
```

### 约束

- 删除重复 `LFAA-Web.bat`；
- Desktop 尚未实现时必须明确失败；
- 构建发布只生成本地产物，不自动上传远程；
- 不允许假成功。

### 状态

`delivered in v0.0.24`

> 迁移来源：`docs/prompts/archive/v0.0.25/0019-04-Rust安装诊断优化.md`

## #19.4 Rust 安装诊断优化

### 主任务

`#19 一键准备与依赖检测`

### 问题

Windows 实机安装中出现：

```text
winget exit -1978335189
```

旧逻辑直接显示“安装未完成”，随后重新下载 Rust 官方安装器。

该 WinGet 返回码表示：

```text
No applicable update found
```

不能简单当普通安装失败。

同时用户 Cargo 最终位于自定义目录，说明检测必须支持 `CARGO_HOME`。

### 修改

- 优先识别 `CARGO_HOME\bin`；
- WinGet 返回码语义映射；
- WinGet 返回后重新检测现有 rustup/Cargo；
- 只有仍不可用才走 Rust 官方安装器；
- 官方 rustup 英文原始日志保留；
- LFAA 自身提示保持中文；
- 官方 SHA-256 校验继续保留。

### 状态

`delivered in v0.0.25`

> 迁移来源：`docs/prompts/archive/v0.0.26/0021-02-黑白工作台重构.md`

## #21.2 黑白工作台重构

### 主任务

`#21 Web 工作台 UI`

### 用户要求

- UI 改为 Codex / ChatGPT 类风格；
- 不再使用水墨风格；
- 使用黑 / 白 / 灰主题；
- 左右栏允许更大范围拉伸，但必须有最大宽度；
- 吸附收起必须更丝滑。

### 实现约束

- 不复制 Codex / ChatGPT 品牌标识；
- 保留 LFAA 自有信息架构；
- 复用同一套 Web / Desktop App Shell；
- 侧栏拖动使用 rAF + CSS 变量预览；
- collapsed 状态只在拖动结束时提交；
- 动态最大宽度保护中央工作区；
- 不改 `.lfaa` 热插拔协议。

### 状态

`in-progress in v0.0.26`

> 迁移来源：`docs/prompts/archive/v0.0.27/0021-03-最小宽度自动吸附.md`

## #21.3 最小宽度自动吸附

### 主任务

`#21 Web 工作台 UI`

### 问题

v0.0.26 使用独立：

```text
snapThreshold = 96px
```

并在 Pointer Up 才决定收起。

目标交互要求侧栏一碰到最小宽度就自动吸附，不需要继续向内拖，也不等待松手。

### 修改

```text
左栏 min = 240px
右栏 min = 300px
```

Pointer Move 到对应 min：

```text
立即吸附到 collapsed 预览
```

反向拖回：

```text
min + 24px
```

重新展开，防止边界抖动。

### 保留

- 最大宽度动态限制；
- 中央区最小宽度保护；
- requestAnimationFrame 合并 Pointer Move；
- localStorage 宽度与收起状态；
- 双击 / 键盘控制。

### 状态

`delivered in v0.0.27`

> 迁移来源：`docs/prompts/archive/v0.0.28/0019-05-Rust工具链分层.md`

## #19.5 Rust 工具链分层

### 目标

采用“共享工具链 + 项目锁定版本 + 项目本地依赖/构建”的 Rust 开发模型，避免每个项目复制完整编译器。

### 决策

- rustup/rustc/cargo：共享；
- `rust-toolchain.toml`：项目；
- Cargo.toml/Cargo.lock：项目；
- target：项目；
- CARGO_HOME/RUSTUP_HOME：允许用户放到非系统盘。

### 状态

`delivered in v0.0.28`

> 迁移来源：`docs/prompts/archive/v0.0.28/0021-04-Web端口复用.md`

## #21.4 Web 端口复用

### 目标

菜单 2 在 5173 已被占用时不直接失败。

### 行为

- 已有 LFAA Vite：复用；
- 其他程序占用 5173：自动找 5174-5199；
- 不结束未知进程；
- 终端必须显示真实 URL。

### 状态

`delivered in v0.0.28`

> 迁移来源：`docs/prompts/archive/v0.0.29/0019-06-依赖模型简化.md`

## #19.6 依赖模型简化

### 主任务

`#19 一键准备与依赖检测`

### 目标

把工具链和项目依赖规则固定成简单、稳定、普通用户无需理解内部细节的模式。

### 最终规则

```text
Node / pnpm / Git / Rust / Cargo
→ 电脑基础工具，只准备一次

node_modules / Cargo.lock / target / .lfaa
→ 项目内容，跟项目走
```

Rust 项目版本继续由：

```text
rust-toolchain.toml
```

锁定。

### Setup 行为

```text
已有工具
→ 直接复用

缺少 Rust/Cargo
→ Rust 官方 rustup-init
→ 官方 SHA-256 校验
→ 自动准备项目要求版本
```

不再让用户选择安装模式，不再优先尝试 WinGet。

### 状态

`delivered in v0.0.29`

> 迁移来源：`docs/prompts/archive/v0.0.30/0019-07-Setup主菜单循环.md`

## #19.7 Setup 主菜单循环

### 主任务

`#19 一键准备与依赖检测`

### 目标

Setup 普通操作结束后返回主菜单，不自动退出终端。

### 规则

```text
1 - 10
→ 执行操作
→ 显示结果
→ 按任意键返回主菜单

0
→ 退出
```

Web 按 Ctrl+C 停止后也必须返回主菜单。

普通错误同样返回主菜单。

### 状态

`delivered in v0.0.30`

> 迁移来源：`docs/prompts/archive/v0.0.30/0021-05-Web启动延迟修复.md`

## #21.5 Web 启动延迟修复

### 主任务

`#21 Web 工作台 UI`

### 根因

旧端口识别会从 5173 到 5199 逐个执行 HTTP 请求，每个失败请求可等待 1 秒。

在没有运行中的 LFAA Web 时会造成明显空白等待。

### 修复

```text
读取当前 TCP Listener
→ 只探测真正已占用端口
→ 识别已有 LFAA
→ 否则立即选空闲端口
```

Vite 改为直接执行项目本地 binary，不在菜单 2 走依赖安装流程。

### 验收

- 无服务时端口选择接近即时；
- 已运行 LFAA 时快速复用；
- 5173 被其他程序占用时快速切到下一端口；
- Ctrl+C 停止后返回 Setup 主菜单。

### 状态

`delivered in v0.0.30`

> 迁移来源：`docs/prompts/archive/v0.0.31/0021-06-三栏交互与终端停靠.md`

## #21.6 三栏交互与终端停靠

### 主任务

`#21 Web 工作台 UI`

### 目标

把工作台三栏交互继续收敛到接近 ChatGPT / Codex 的使用方式。

### 重点

- 分隔条只负责拖拽拉伸与自动吸附；
- 不再在分隔条中央叠加点击收起按钮；
- 左上 / 右上使用淡入式控制按钮做侧栏与终端显隐；
- 收起 / 展开要有过渡动画；
- 中间底部增加终端停靠区；
- 右侧工具里的“终端”与底部终端联动。

### 验收

- 三栏拖拽与自动吸附保留；
- 分隔条点击冲突消失；
- 左上 / 右上 hover 显示控制按钮；
- 点击可展开 / 收起左右侧栏与终端；
- 底部中间可以看到终端区；
- 过渡动画不再瞬间跳变。

### 状态

`delivered in v0.0.31`

> 迁移来源：`docs/prompts/archive/v0.0.32/0021-07-侧栏Hover与真实终端.md`

## #21.7 侧栏 Hover 与真实终端

### 主任务

`#21 Web 工作台 UI`

### 用户修正

#### 侧栏控制

Hover 控件不是中间顶部控件。

必须是：

```text
鼠标进入左侧栏
→ 左侧栏自己的控制淡入

鼠标进入右侧栏
→ 右侧栏自己的控制淡入
```

#### 终端

禁止模拟终端。

必须是：

```text
最底部 Dock
+ xterm.js
+ 真实 PTY
+ 可输入命令
+ 可看到真实 Shell 输出
```

### 开发实现

Web Vite 本地开发模式：

```text
@xterm/xterm
@xterm/addon-fit
node-pty
Vite custom HMR events
```

Windows 默认 Shell：

```text
powershell.exe -NoLogo
```

### 安全限制

- 仅 `127.0.0.1`；
- 只用于人类直接交互；
- 不作为 Agent 自动命令绕过 Tool Runtime 的入口；
- 正式 Desktop / Agent PTY 仍归 Rust Native Core。

### 状态

`pending-test in v0.0.32`

> 迁移来源：`docs/prompts/archive/v0.0.33/0019-08-node-pty跨机器安装.md`

## #19.8 node-pty 跨机器安装

### 主任务

`#19 一键准备与依赖检测`

### 问题

全新 Windows 电脑执行：

```text
LFAA-Setup.bat → 1
```

pnpm 因 `node-pty@1.1.0` 的构建脚本未被项目审核而报：

```text
ERR_PNPM_IGNORED_BUILDS
```

### 目标

- 用户不需要手动运行 `pnpm approve-builds`；
- 只批准 LFAA 已审核、锁定的原生依赖；
- 不降低 pnpm 的供应链安全门禁。

### 实现

```yaml
strictDepBuilds: true
allowBuilds:
  "node-pty@1.1.0": true
```

并在 Setup 安装后做 node-pty Smoke Check。

### 状态

`delivered in v0.0.33`

> 迁移来源：`docs/prompts/archive/v0.0.34/0019-09-node-pty校验引号兼容.md`

## #19.9 node-pty 校验引号兼容

### 主任务

`#19 一键准备与依赖检测`

### 问题

Windows PowerShell 5 下调用 `node -e` 时，内嵌 JavaScript 字符串中的引号可能被原生命令参数转换影响。

导致本来正确的：

```js
require("node-pty")
```

传到 Node 后变成：

```js
require(node-pty)
```

从而出现 SyntaxError。

### 修复

- 不再用 `node -e` 做 node-pty Smoke Check；
- 使用独立 `scripts/check-node-pty.mjs`；
- 从 `apps/web/package.json` 创建 require 上下文；
- 保留真实 `pty.spawn` 检查。

### 状态

`delivered in v0.0.34`

> 迁移来源：`docs/prompts/archive/v0.0.35/0019-10-Rustup平台目标修复.md`

## #19.10 Rustup 平台目标修复

### 主任务

`#19 一键准备与依赖检测`

### 问题

Windows 新机器菜单 `1` 在 Rust 缺失时调用：

```text
Get-WindowsRustupTarget
```

但函数没有定义，导致 Rust 官方安装流程在下载前直接失败。

### 修复

新增 Windows 架构到 Rustup 官方 target tuple 的映射：

```text
AMD64 → x86_64-pc-windows-msvc
ARM64 → aarch64-pc-windows-msvc
x86   → i686-pc-windows-msvc
```

同时：

- 兼容 32 位 PowerShell 运行于 64 位 Windows；
- 未知架构直接中文失败；
- 官方 HTTPS 与 SHA-256 校验保持；
- Governance 防止 helper 再次缺失。

### 状态

`delivered in v0.0.35`

> 迁移来源：`docs/prompts/archive/v0.0.36/0010-02-GitHub推送预检容错.md`

## #10.2 GitHub 推送预检容错

- 目标：修复 v0.0.35 在 `git ls-remote` 失败时提前中止一键推送。
- 约束：不强推、不覆盖远端历史，保留失败原始日志。
- 实现：fetch + rebase + safe push；预检异常只警告，最终以 push 结果为准。

> 迁移来源：`docs/prompts/archive/v0.0.36/0021-08-三向吸附与显式展开.md`

## #21.8 三向吸附与显式展开

- 左 / 右 / 底部都支持拖拽到阈值后吸附收起。
- 吸附完成后禁止通过 resize handle 反向拉开。
- 重新展开必须使用对应方向的显式 UI 入口。
- 底部终端新增 hover 展开控件。

> 迁移来源：`docs/prompts/archive/v0.0.37/0004-01-中文路径打包保护.md`

## #4.1 中文路径打包保护

- 目标：修复 v0.0.36 发布包中文文件名编码损坏，并防止错误版本包被同步到稳定工作区。
- 基线：必须保留 v0.0.36 的 GitHub 推送和三向吸附功能，不回退业务实现。
- 约束：稳定工作区 `.git`、本机日志、依赖缓存和 `.env` 保护规则保持不变。
- 实现：恢复 UTF-8 中文路径；同步前检测可逆 CP437→UTF-8 乱码；ZIP 产物生成后校验文件名。

> 迁移来源：`docs/prompts/archive/v0.0.38/0021-09-Web常驻工作台Chrome.md`

## #21.9 Web 常驻工作台 Chrome

- 参考 Codex 桌面端时，左栏 / 终端 / 右栏属于工作台壳层按钮，应常驻显示，不依赖 hover。
- 桌面端可承载在原生标题栏；Web 端没有原生应用菜单栏，必须在页面自身创建全宽顶栏承载这些入口。
- Web 顶栏左侧固定放左栏开合按钮，再显示当前工作台标题。
- Web 顶栏右侧固定放终端和右栏开合按钮；更多 / 分享属于次要操作。
- 左右侧栏内部不要重复放框架级开合按钮。
- 收起后不要依赖屏幕边缘 hover 热点重新展开。
- 保留拖拽吸附、吸附后 separator 禁止反向拉开、终端真实 PTY 等既有行为。

> 迁移来源：`docs/prompts/archive/v0.0.39/0021-10-主区悬浮与左栏预览.md`

## #21.10 主区悬浮与左栏预览

- Web 顶栏只保留标题、更多、分享等页面级操作；
- 左栏按钮移动到中间主区左上角；
- 终端 / 右栏按钮移动到中间主区右上角；
- 左栏收起后，鼠标移入左栏按钮临时淡入预览左栏内容，移出后淡出；
- Hover 只做临时预览，点击 / `Ctrl+B` 才改变正式 collapsed 状态；
- 右栏保持显式点击控制；
- 快捷键：`Ctrl+B`、`Ctrl+J`、`Ctrl+Alt+B`；
- 保留三向吸附和吸附后禁止 separator 反向展开。

> 迁移来源：`docs/prompts/archive/v0.0.40/0004-02-同步目标与ZIP编码.md`

## #4.2 同步目标与 ZIP 编码

- 修复版本包多包一层目录后，Sync 把目标错误推导到版本包内部的问题；
- 默认目标应始终定位到版本目录同级 `lfaa` 稳定工作区；
- 扩展中文路径乱码保护，除 CP437 外还要识别 CP936/GBK；
- 发布 ZIP 直接以项目根内容入包；
- 打包后验证 UTF-8 中文路径和文件内容 Round-trip。

> 迁移来源：`docs/prompts/archive/v0.0.41/0020-03-代码可读性与项目地图.md`

## #20.3 代码可读性与项目地图

- 关键 TS / TSX / CSS / PowerShell 文件必须写结构化中文文件头；
- 文件头说明作用、负责、不负责、状态归属、对外接口、关联文件、修改注意事项；
- CSS 必须说明页面区域、盒子父子关系和分区；
- 第一次打开项目的人必须有一份完整的项目结构 / 文件职责地图；
- `apps/`、`packages/`、`crates/`、`scripts/` 等一级目录必须有人类可读 README；
- 当前 Web UI 要明确说明 App → App Shell → Layout → Terminal 的文件调用链；
- 增加自动检查，防止以后关键实现文件再次漏注释；
- 修正 v0.0.39 / v0.0.40 后开发日志和 UI 规范没有跟上代码的事实源漂移。

> 迁移来源：`docs/prompts/archive/v0.0.42/0004-03-PowerShell脚本编码保护.md`

## #4.3 PowerShell 脚本编码保护

### 主模块

`project-foundation / workspace-sync`

### 任务目标

修复 v0.0.41 因 PowerShell 脚本 UTF-8 BOM 被移除导致的 Windows PowerShell 5.1 兼容性回归，并建立发布前自动编码门禁。

### 当前约束

- v0.0.41 不覆盖，作为历史缺陷版本保留；
- 修复进入 v0.0.42；
- Sync 业务算法不改，只恢复可执行编码契约；
- GitHub / Setup / Update 同类 `.ps1` 一并恢复 BOM；
- `.git` 稳定工作区规则不变；
- 发布 ZIP 不允许双层根目录。

### 验收

- `scripts/windows/*.ps1` 全部 UTF-8 with BOM；
- 编码门禁进入 governance；
- ZIP 解压后 BOM 仍存在；
- 同步目标逻辑仍与 v0.0.40/v0.0.41 一致。

### 状态

`delivered / v0.0.42`

> 迁移来源：`docs/prompts/archive/v0.0.42/0021-10-主区悬浮与左栏预览.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell`

### 任务目标

实现可通过 Vite 本地启动、可供 Web / Desktop 复用的三栏工作台 UI，作为 Config UI、Agent UI 和 `.lfaa` 热插拔验证壳。

### 当前交互事实

#### 三栏

- 左栏：导航 / 项目 / 会话；
- 中间：工作区 / 对话 / Composer；
- 右栏：工具 / 运行状态 / 项目资源；
- 左右分隔条只负责拖拽；
- 到达最小宽度立即自动吸附；
- 同一次拖拽反向拉回使用迟滞避免抖动；
- Pointer Up 完成吸附后，separator 禁止反向拖开。

#### Web 页面顶栏

页面顶栏只保留：

```text
Web 工作台标题
更多
分享
```

Shell 开合按钮不再放在顶栏。

#### 中间主区 Shell Actions

```text
中间主区左上角
→ 左栏按钮

中间主区右上角
→ 终端按钮
→ 右栏按钮
```

左栏按钮有两种不同交互：

```text
Hover / Focus（仅左栏已收起）
→ 临时淡入左栏内容预览
→ 不修改 leftCollapsed

Click / Ctrl+B
→ 正式改变 leftCollapsed
→ 展开 / 收起 Grid 左栏
```

右侧保持显式控制：

```text
Ctrl+J
→ 终端

Ctrl+Alt+B
→ 右栏
```

右栏禁止 Hover 自动展开。

#### 真实终端

底部终端必须位于工作区最底部：

```text
左侧栏保持全高
中间 + 右侧区域底部
→ Terminal Dock
```

Web 本地开发终端：

```text
xterm.js
↓
Vite HMR custom events
↓
node-pty
↓
PowerShell / 系统 Shell
```

禁止模拟日志冒充终端。

### 允许修改

- `packages/client/ui`
- `packages/client/app-shell`
- `apps/web`
- Vite 开发桥接
- UI / Security / Testing / Readability 文档

### 禁止修改

- Agent Loop
- Tool Runtime
- Permission Engine
- 正式 Rust Broker / Rust PTY Broker
- Config Storage
- Secret Store
- Knowledge
- Plugin Runtime 正式实现

### 状态所有权

- 左右栏正式 collapsed 状态：`AgentWorkbench` Shell 状态；
- 左栏 Hover Preview：`AgentWorkbench` 临时 UI 状态；
- 侧栏宽度 / 底栏高度：`ResizableWorkbench` 几何状态；
- 终端显隐：`AgentWorkbench` Shell 状态；
- Web 终端 PTY 进程：Vite 本地开发桥接；
- 正式 Desktop / Agent PTY：未来 Rust Native Core；
- `.lfaa` 资源快照：Vite 只读开发桥接。

### 安全边界

开发终端属于人类直接交互，不属于 Agent Tool。

必须：

- 绑定 `127.0.0.1`；
- 默认 cwd 为项目根；
- 不自动提升权限；
- 不读取 / 注入 Secret；
- 页面 / Vite 关闭时回收 PTY；
- 不作为 Agent 绕过 Policy / Permission 的执行路径。

### 性能要求

- 侧栏拖拽使用 `requestAnimationFrame`；
- 吸附 150ms - 220ms；
- 左栏 Preview 使用 opacity / transform 淡入淡出，不改变 Grid；
- Terminal resize 使用 `ResizeObserver` + xterm FitAddon；
- UI 主线程不执行阻塞系统调用。

### 验收条件

- 页面顶栏只保留标题 / 更多 / 分享；
- 左栏按钮位于中间主区左上角；
- 终端 / 右栏按钮位于中间主区右上角；
- 左栏收起时 hover 可临时预览，离开后淡出；
- Hover Preview 不修改正式 collapsed 状态；
- 点击 / `Ctrl+B` 正式开合左栏；
- 右栏不做 Hover 自动展开；
- `Ctrl+J` 控制终端；
- `Ctrl+Alt+B` 控制右栏；
- 左右侧栏拖拽 / 吸附正常；
- 吸附完成后不能从 separator 反向拖开；
- 底部 Terminal Dock 可拉高 / 拉低 / 吸附收起；
- Web Terminal 可以真正输入 PowerShell 命令并看到输出；
- `.lfaa` 热插拔继续可用；
- 关键实现文件注释与 UI 文档同步。

### 当前状态

`active / pending-test`

> 迁移来源：`docs/prompts/archive/v0.0.43/0021-11-Header联动与按钮归属修正.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell`

### 当前任务目标

实现接近 ChatGPT / Codex 的顶部 Header 联动三栏工作台：框架按钮属于区域 Header，不能漂在正文层。

### 当前交互事实

#### 顶部 Header

```text
Center Header 左侧
→ 左栏按钮 / 标题

Center Header 右侧
→ 更多 / 分享
→ RightCollapsed=true 时再显示终端 / 右栏按钮

Right Header
→ RightCollapsed=false 时显示终端 / 右栏按钮
```

Center / Right Header 必须同高并形成连续顶部结构。

#### 左栏

- Hover / Focus（仅正式收起时）：临时淡入左栏预览，不修改 `leftCollapsed`；
- Click / `Ctrl+B`：正式开合左栏；
- Preview 必须低于 Header 层级，不能挡住左栏按钮点击。

#### 右栏与终端

- `Ctrl+J`：切换底部终端；
- `Ctrl+Alt+B`：切换右栏；
- 右栏不做 Hover 自动展开；
- 按钮提供可见 Tooltip + 原生 title 提示。

#### 拖拽与真实终端

- 左右 separator 只负责拖拽/吸附；
- 吸附后禁止 separator 反向拖开；
- Terminal Dock 使用 xterm + node-pty，禁止模拟日志冒充终端。

### 允许修改

- `packages/client/app-shell`
- 必要时 `packages/client/ui`
- `apps/web`
- UI / Testing / Readability 文档

### 禁止修改

- Agent Loop / Tool Runtime / Permission Engine
- Config Storage / Secret Store
- 正式 Rust PTY Broker
- GitHub / Sync / Setup / Update 业务逻辑

### 验收条件

- 不存在 `agent-center-floats` / `agent-center-toggle` 旧正文悬浮实现；
- 中间 Header 是正常文档流第一行；
- 右栏展开时按钮位于右栏 Header；
- 右栏收起时按钮回到中间 Header；
- 左栏 Hover Preview 与点击开合语义分离；
- 快捷键与 Tooltip 一致；
- 三向吸附、PTY、资源桥不回退；
- 代码注释、UI Layout、Development Log、Changelog / Release 同步。

### 当前状态

`active / pending-test`

> 迁移来源：`docs/prompts/archive/v0.0.44/0021-12-ShellTooltip单一提示源.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell`

### 当前任务目标

保持 #21.11 的 Header 联动布局，只修复 Shell Header 三个框架按钮的重复 Tooltip，并建立防回归门禁。

### 当前交互事实

#### Header 布局

```text
Center Header 左侧
→ 左栏按钮 / 标题

Center Header 右侧
→ 更多 / 分享
→ RightCollapsed=true 时再显示终端 / 右栏按钮

Right Header
→ RightCollapsed=false 时显示终端 / 右栏按钮
```

#### Tooltip 单一来源

三个 Shell Header 按钮只允许：

```text
aria-label
+
.agent-shell-tooltip
```

禁止：

```text
title="..."
+
.agent-shell-tooltip
```

原因：浏览器原生 `title` 会在自定义 Tooltip 之后再次弹出第二层提示，造成重复黑框。

Tooltip 必须 `pointer-events:none`，不得抢鼠标 Hover / Click。

#### 快捷键

- `Ctrl+B`：左栏正式开合；
- `Ctrl+J`：底部终端开合；
- `Ctrl+Alt+B`：右栏开合。

### 允许修改

- `packages/client/app-shell/src/AgentWorkbench.tsx`
- UI 契约门禁脚本
- UI / Testing / Development Log / Changelog / Release 文档

### 禁止修改

- `packages/client/ui` 拖拽吸附算法（本次无必要）
- Agent Loop / Tool Runtime / Permission Engine
- Config Storage / Secret Store
- GitHub / Sync / Setup / Update 业务逻辑
- PTY 业务逻辑

### 验收条件

- 左栏按钮 Hover 只出现一层提示；
- 终端按钮 Hover 只出现一层提示；
- 右栏按钮 Hover 只出现一层提示；
- Shell Header 按钮不存在 `title=`；
- 自定义 Tooltip 仍显示快捷键；
- Tooltip 不拦截鼠标事件；
- Header 联动、Hover Preview、三向吸附、PTY 不回退；
- `scripts/ui-contract-check.mjs` 进入治理门禁；
- Development Log / UI Layout / Test / Changelog / Release 同步。

### 当前状态

`active / pending-test`

> 迁移来源：`docs/prompts/archive/v0.0.45/0021-13-响应式重构与弹性吸附.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

在 v0.0.44 的 Header / Tooltip 基线上，修复窄屏布局崩溃、Shell 控件在覆盖式侧栏中不可见、三向拖拽吸附过硬的问题，并把响应式与拖拽状态机升级为当前正式方案。

### 当前交互事实

#### 1. 三档响应式

```text
Desktop >= 1180px
→ 左 / 中 / 右 Dock 布局
→ 右栏展开时 Shell Actions 位于 Right Header

Compact 760 ~ 1179px
→ 左栏保持 Dock
→ 右栏改为覆盖式 Drawer
→ Shell Actions 始终留在 Center Header，保证关闭入口可见

Mobile < 760px
→ 中间主区全宽
→ 左右栏都改为覆盖式 Drawer
→ 默认收起左右栏与底部终端
→ Header 中始终保留左栏 / 终端 / 右栏三个核心入口
```

#### 2. Tooltip

- 左栏 Tooltip 从按钮左边界向右展开；
- 右侧两个 Tooltip 从按钮右边界向左展开；
- 禁止原生 `title` 与自定义 Tooltip 共存；
- Mobile 下不依赖 Hover Tooltip 作为必要入口。

#### 3. 三向拖拽吸附

左栏、右栏、底部终端统一：

```text
Pointer Down
→ Pointer Capture
→ 正常跟手拖拽
→ min 以下进入弹性磁区
→ 靠近边缘才标记 snapped
→ 鼠标仍按住时可以反向拖回 min
→ 回到 min 即退出 snapped
→ 继续向外拉伸
```

只有：

```text
Pointer Up 时仍处于 snapped
```

才真正提交收起。

Pointer Up 完成收起后，separator 禁止重新展开，只能通过显式按钮或快捷键重新打开。

#### 4. 动画手感

- Pointer Move 阶段禁止 CSS transition 追赶鼠标；
- 吸附提交 / 按钮展开使用统一 ease-out；
- 不允许从 `min` 硬跳到 `0`；
- 展开/收起要平滑，但不能拖泥带水。

### 允许修改

- `packages/client/app-shell/src/AgentWorkbench.tsx`
- `packages/client/app-shell/src/agent-workbench.css`
- `packages/client/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/client/ui/src/workbench/workbench.css`
- UI 契约门禁
- UI / Testing / Development Log / Plan / Progress / Changelog / Release 文档

### 禁止修改

- GitHub / Sync / Setup / Update 业务逻辑
- PTY 协议和 node-pty bridge
- Agent Runtime / Tool Runtime / Permission Engine
- Config Storage / Secret Store

### 验收条件

- Desktop / Compact / Mobile 三档结构明确；
- 小窗口不再出现右栏占 80%+ 宽度导致主区消失；
- 右栏覆盖模式下关闭按钮始终可见；
- Mobile 中间主区保持完整可用；
- 左 / 右 / 底部三向拖拽都支持“按住时吸附后反向拖回 min”；
- 松手确认收起后不能从 separator 反向展开；
- 拖拽过程中无 transition 追鼠标造成的卡顿；
- Tooltip 不被左右边缘裁切；
- `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B` 保持；
- Windows PowerShell 脚本不修改且 BOM 不回退；
- Development Log / UI Layout / Test / Code Map / Changelog / Release 同步。

### 当前状态

`active / pending-windows-visual-test`

> 迁移来源：`docs/prompts/archive/v0.0.46/0021-14-最小尺寸吸附收起语义修正.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

在 v0.0.45 的响应式基线上，修正三向吸附语义：**吸附目标是收起，不是把仍然展开的面板压到 min 以下。** 同时提高左栏、右栏、底部终端的可用最小尺寸，保证内容在展开状态下仍可阅读。

### 当前交互事实

#### 1. 三档响应式

```text
Desktop >= 1240px
→ 左 / 中 / 右 Dock 布局

Compact 760 ~ 1239px
→ 左栏 Dock
→ 右栏 Drawer

Mobile < 760px
→ 中间主区全宽
→ 左右栏 Drawer
```

#### 2. 可用最小尺寸

```text
左栏：min 280 / initial 300 / max 640
右栏：min 360 / initial 400 / max 760
Bottom：min 180 / initial 280 / max 560
```

min 是“展开态还能正常排版”的硬下限，不能再拿 min 以下的宽度显示内容。

#### 3. 三向拖拽吸附

左栏、右栏、底部终端统一：

```text
Pointer Down
→ 正常跟手 Resize
→ 到达 min
→ 立即进入 snap capture / 收起预览
→ 预览尺寸吸到 0
```

如果鼠标仍然按住：

```text
snap capture
→ 反向拖动
→ 达到 min + snapHysteresis
→ 退出 snap capture
→ 面板恢复到至少 min
→ 可继续向外拉伸
```

只有：

```text
Pointer Up 时仍处于 snapped
```

才真正提交 collapsed。

正式 collapsed 后 separator 不能重新拉开，只能通过：

```text
Ctrl+B       左栏
Ctrl+J       Bottom Terminal
Ctrl+Alt+B   右栏
```

或对应 Header 按钮恢复。

#### 4. 动画手感

- 普通 pointermove 阶段不启用 Grid transition；
- 到 min 触发 snap preview 时允许一个很短的磁吸收起过渡；
- 不允许出现 min 以下的“半残废展开态”；
- 正式开合继续使用平滑 ease-out。

### 允许修改

- `packages/client/app-shell/src/AgentWorkbench.tsx`
- `packages/client/app-shell/src/agent-workbench.css`
- `packages/client/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/client/ui/src/workbench/workbench.css`
- `scripts/ui-contract-check.mjs`
- UI / Testing / Development Log / Plan / Progress / Changelog / Release / Code Map

### 禁止修改

- GitHub / Sync / Setup / Update 业务逻辑
- PTY 协议和 node-pty bridge
- Agent Runtime / Tool Runtime / Permission Engine
- Config Storage / Secret Store

### 验收条件

- 左右栏展开时不允许小于 min；
- 拖到 min 立即进入吸附收起预览；
- Pointer 不松手可从已吸附状态反向拖回并恢复至少 min；
- 松手后正式 collapsed，separator 不可展开；
- 右栏最小宽度足以完整显示“审查 / 终端 / 浏览器 / 文件”及快捷键，不再出现截图中的文字截断；
- Desktop / Compact 断点与新 min 相容；
- Windows PowerShell 脚本不修改且 BOM 不回退；
- Development Log / UI Layout / Test / Code Map / Changelog / Release 同步。

### 当前状态

`active / pending-windows-visual-test`

> 迁移来源：`docs/prompts/archive/v0.0.47/0021-15-容器响应式与布局变量化.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

以 v0.0.46 为历史基线，修正固定侧栏宽度与固定 viewport 断点导致的小窗口布局崩溃。布局必须更接近 ChatGPT / Codex 的“主区优先 + 侧栏按空间自动 Dock/Overlay”行为，并把几何配置集中为可维护变量和计算公式。

### 当前实现要求

#### 1. 单一布局变量源

禁止在 `AgentWorkbench.tsx` 继续出现：

```text
LEFT_LIMITS
RIGHT_LIMITS
BOTTOM_LIMITS
```

统一使用：

```text
packages/client/ui/src/workbench/workbench-layout.config.ts
```

其中必须集中维护：

- ratio；
- floor；
- ceiling；
- center 保护；
- separator；
- snap hysteresis。

#### 2. 容器响应式

不以 `window.innerWidth < 某固定值` 决定工作台模式。

必须：

```text
agent-workbench-stage
→ ResizeObserver
→ resolveWorkbenchLayoutMetrics(rect.width, rect.height)
→ Desktop / Compact / Mobile
```

#### 3. 当前几何目标

当前动态安全范围：

```text
左栏 min 约 196~232
右栏 min 约 228~288
Bottom min 约 136~176
```

实际值必须由容器计算，不能直接作为业务固定宽度使用。

#### 4. 模式语义

```text
Desktop：容器真正放得下 left + center + right 才双 Dock
Compact：左 Dock + 右 Overlay
Mobile：左右 Overlay + 主区全宽
```

右 Overlay 不能再把主区挤小；Overlay 宽度必须通过 CSS 变量 + `clamp()` / 百分比计算。

#### 5. 三向吸附

左 / 右 / Bottom 继续统一：

```text
正常 Resize
→ 到动态 min
→ snap preview 收到 0
→ Pointer 仍按住可反向越过 hysteresis 恢复
→ Pointer Up 仍 snapped 才正式 collapsed
```

正式 collapsed 后 separator 不能拖开，只能通过：

```text
Ctrl+B
Ctrl+J
Ctrl+Alt+B
```

或 Header 对应按钮恢复。

#### 6. 动画

- 普通 resize：transition:none，跟手；
- snap preview：短磁吸过渡；
- 正式按钮开合：ease-out；
- 不允许以 min 以下尺寸继续渲染残缺侧栏。

### 允许修改

- App Shell / UI Workbench 当前实现；
- 布局 config / types / exports；
- UI contract；
- UI Standard / Test / Code Map / README；
- Prompt / Plan / Progress / Development Log / Changelog / Release / Version。

### 禁止修改

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY 协议 / node-pty bridge；
- Agent Runtime / Permission / Config / Rust Native 边界。

### 验收条件

- 950px 左右窗口不再同时被大左栏 + 大右栏挤压；
- 1024px 左右在容器允许时可维持合理双 Dock；
- 760~950px 右栏变 Overlay，中央主区不变窄；
- <680px 左右栏都 Overlay；
- 侧栏最小宽度明显小于 v0.0.46 的 280 / 360，但仍足够阅读；
- 历史持久化宽度会随容器重新 clamp；
- CSS 尺寸由变量 / rem / clamp / calc 维护；
- 三向吸附行为不回退；
- Windows 脚本与 PTY 不变；
- 所有当前事实源同步更新。

### 当前状态

`active / pending-windows-visual-test`

> 迁移来源：`docs/prompts/archive/v0.0.48/0021-16-Hover与点击左栏宽度统一.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

以 v0.0.47 为历史基线，修复左栏 Hover Preview 与点击正式展开宽度不一致的问题。两种展示必须共享同一个实际左栏宽度事实源，不能再分别用 CSS clamp 和 ResizableWorkbench 内部 width 两套值。

### 当前实现要求

#### 1. 单一宽度事实源

```text
ResizableWorkbench.leftWidth
→ onLeftWidthChange(width)
→ AgentWorkbench.leftPaneWidth
→ --agent-left-preview-width
→ Hover Preview
```

正式 Dock 和 Hover Preview 必须使用同一个 width。

#### 2. 默认与用户调整后都一致

- 初次打开：Preview = 当前响应式 `left.initial`；
- 用户拖过左栏后：Preview = 用户最后真实左栏宽度；
- 容器缩小时：Preview 跟随重新 clamp 后的真实宽度；
- collapsed 状态 Hover 不得维护第二套 `clamp()` 宽度。

#### 3. 保持现有行为

- 容器响应式 / Desktop / Compact / Mobile 不回退；
- 三向到 min 吸附收起不回退；
- Pointer 不松手反向解锁不回退；
- Header / Tooltip / PTY / Sync / GitHub / Setup / Update 不改业务逻辑。

### 允许修改

- `AgentWorkbench.tsx`；
- `agent-workbench.css`；
- `ResizableWorkbench.tsx`；
- `workbench-layout.types.ts`；
- UI contract；
- 当前 UI 文档、测试、代码地图、Plan / Progress / Development Log / Changelog / Release / Version。

### 验收条件

- Hover Preview 与点击展开后的左栏宽度视觉一致；
- 用户手动 resize 后再次 collapsed，Hover Preview 仍与下一次 click 展开宽度一致；
- CSS 不再存在独立 `--agent-left-preview-width: clamp(...)`；
- UI contract 能阻止第二套 Preview 宽度回归；
- 基础设施和 PTY 不变。

### 当前状态

`active / pending-windows-visual-test`

## #22.1 Plugin Platform / Capability Contract / App Pack 总架构

- **版本：** v0.0.78
- **主模块：** plugin-sdk / plugin-runtime / agent-runtime / architecture-governance
- **目标：** 把“一切皆插件”从口头原则升级为长期可执行架构。LFAA Core 只保留稳定机制，具体 Tool / Skill / Expert / Agent / Workflow / UI Extension / App Pack 通过统一 Capability Contract 注册；外部 Codex / DeepSeek Harness / MCP 等通过 Adapter 接入，并保留平台专有扩展能力。
- **状态所有权：** `@lfaa/plugin-sdk` 拥有协议；`@lfaa/plugin-runtime` 拥有运行时 Registry generation；Agent Runtime 只消费 Snapshot，不复制第二套 Capability 词汇。
- **允许修改：** ARCHITECTURE / DEVELOPMENT / AGENTS / Project Plan、plugin-sdk、plugin-runtime、agent-runtime 公共契约、治理/测试/代码地图。
- **禁止修改：** Rust Native primitive 业务实现、Provider Secret、真实 Harness Agent Loop。
- **硬约束：** Common Contract + namespaced extensions；App Pack 只组合能力；运行中的 Run 固定 Registry generation；新业务默认 Plugin-first；TS/Rust/Python 不得重复实现同一领域事实。
- **验收：** Plugin Manifest / Capability / App Pack / External Adapter 契约存在；Registry 支持 register/unregister/snapshot/generation；Agent Runtime 复用 Plugin SDK 类型；language ownership gate 生效。
- **用户验收：** pending。

## #21.18 Chat / Work Codex 风格交互收敛

- **版本：** v0.0.78
- **主模块：** app-shell / ui-workbench
- **目标：** 根据用户提供的 Codex UI 参考修正 v0.0.77 开发占位感：左上角 LFAA 负责 Chat/Work 切换；权限采用 Codex 风格说明菜单；Composer 的添加/权限/模型控件都可点击；中间 Surface 视觉重心居中。
- **允许修改：** AgentWorkbench / workbench CSS / UI Contract / UI 文档。
- **禁止修改：** Agent Runtime 真值、Config Secret、Rust Native、PTY。
- **验收：** 不使用原生 select 作为三档权限主交互；LFAA Brand 可切换 Chat/Work；模型按钮能进入 AI 设置；添加入口有可见交互反馈；不硬编码模型名。
- **用户验收：** pending。

## #20.17 依赖同步幂等与 lockfile 保留修复

- **版本：** v0.0.78
- **主模块：** Windows Setup / Sync
- **背景：** 用户稳定工作区已安装依赖，但每次版本同步后菜单 1 又显示“新增依赖 / lockfile 待同步”；实际 `pnpm install` 输出 `Already up to date / downloaded 0 / added 0`。
- **根因约束：** dependency-state 缓存缺失/指纹变化本身不能等于“需要安装”；版本包 lockfile 在依赖声明未变化时也不能无意义覆盖稳定工作区已经由 pnpm 生成的更完整 lockfile。
- **实现：** Setup 只在真实缺包、真实解析失败或 lockfile 确实不完整时安装；首次基线不再把全部现有依赖显示为“新增”。Sync 比较依赖声明指纹，相同且目标 lockfile 不弱于来源时保留目标 lockfile。
- **禁止：** 自动升级依赖、清 Store、删除 node_modules、隐藏真正的依赖变化。
- **用户验收：** pending Windows 实机。
