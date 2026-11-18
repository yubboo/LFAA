# LFAA 扩展中心开发方案

| 项目 | 内容 |
| --- | --- |
| 状态 | 草案，供负责人评审 |
| 日期 | 2026-11-18（Asia/Shanghai） |
| 实施级别 | A1，新增功能包、公开契约和装配方式 |
| 首次交付 | 一条可编辑、可二创、可调用、可撤销的真实技能流程 |

## 1. 包的位置与职责

```text
packages/
├── core/
├── skills/           @lfaa/skills
├── plugins/          @lfaa/plugins
├── ui/
└── workspace/
```

| 包或应用 | 职责 |
| --- | --- |
| `@lfaa/skills` | 发现技能、解析 `SKILL.md`、管理自建版本与启用状态，为 Agent 提供运行时查询。Client 负责技能页和编辑器。 |
| `@lfaa/plugins` | 维护真实安装记录，从清单加载插件、管理启停和卸载，跟踪该插件贡献的工具、技能及 UI。Client 负责插件页和详情。 |
| `@lfaa/ui-layout` | 持有四栏布局、导航选中态和注册入口。扩展页通过 Workbench 契约贡献页面与菜单。 |
| `@lfaa/agent`、`@lfaa/tools` | Agent 根据本次显式选择查询技能。已有 `ToolsService` 管理工具注册和执行，沿用既有工具权限与审批。 |
| `apps/web` | 装配 Host 和 Client，绑定公开接口与路由。可以独立装配两个包，Agent 也可以在缺少两个包时启动。 |

两个包都使用 `src/`、`client/` 与无浏览器或 Node 依赖的公开契约，按需要导出 `.`、`./contract`、`./client`。实施到哪个包，就把对应的 `packages/skills` 或 `packages/plugins` 显式加到 `pnpm-workspace.yaml`，并同步根规范与包索引。既有分组和 `packages/*/*` 继续使用。

## 2. 用户界面和使用流程

「自定义」继续使用 LFAA 现有四栏 Shell。左二提供「插件」「技能」和由服务返回的已安装插件。中间展示当前页面的搜索、刷新、新增、详情和管理操作。320px 手机端从「更多」进入，浏览列表或详情使用同一视图和状态。视觉延续 LFAA 的主题和交互样式。

| 用户操作 | 页面与系统结果 |
| --- | --- |
| 打开技能页 | 按「项目」「个人」「插件提供」筛选真实记录。列表显示名称、来源、启用状态，详情可预览正文及查看版本。 |
| 新增或导入技能 | 从表单新建，或预览用户明确选择的 `SKILL.md`。保存后进入个人或有权限的当前项目范围。 |
| 编辑或二创 | 用户拥有的技能可编辑。项目已有、插件提供的技能可「复制为我的版本」，生成独立 ID，保留来源信息。原版更新、停用或卸载时，已复制的版本继续由用户管理。 |
| 在聊天里选用 | 输入 `$技能名` 选择技能。发送时带上稳定 ID，由 Host 校验作用域及启用状态。执行轨迹展示本次实际载入的技能名与版本。若发送前已停用，显示具体原因，并保留输入草稿。 |
| 打开插件页 | 从 Host 读取安装记录及运行状态，支持搜索、详情、启停和卸载。插件目录如后续接入，则显示来源和「可添加」；连接状态由具体服务的实际授权与可用性决定。 |

移除左二写死的 Canva、OpenAI Developers、Data 和代码审查安装条目。代码审查保留已有内置入口。已安装列表为空时显示空态，目录读取失败时显示可重试的错误。停用的已安装项仍可管理；卸载后从已安装列表及其注册入口移除。首期「插件」页可显示明确的接入状态，安装动作随插件包交付上线。

## 3. 公开契约与数据归属

- **技能记录。** `SkillSummary` 包含稳定 `id`、名称、描述、来源、作用域、当前修订和启用状态。来源包含项目、个人或插件，以及可选的原始技能引用。Host 根据当前会话绑定的项目解析目录。名称相同的技能在选择器中带来源，实际调用按 ID。目录列表只输摘要，详情预览或执行时再读取正文。
- **技能存储。** 个人技能存放在 `~/.lfaa/skills/`。项目发现首版读取绑定项目下 `.agent/skills/`。已有文件作为项目来源展示，由用户选择复制或按项目权限新建托管条目。LFAA 管理的条目支持启停、版本检查和原子保存，导入和刷新只解析元数据。保存冲突时返回当前版本，保留用户未保存的编辑内容供处理。
- **插件清单和状态。** `PluginManifest` 包含 `id`、版本、入口类型、LFAA 兼容范围和能力声明。安装记录单独保存来源、用户启用设置和管理路径，运行状态由 Host 实时报告。建议首期状态为「已停用」「启用中」「运行中」「停用中」「加载失败」。状态按插件 ID 串行更新，同一插件的重复安装、双标签页操作和重启恢复都走同一记录。
- **扩展贡献。** 沿用 `ToolsService.registerTool` 和 `WorkbenchClientService.registerView` 返回的注销函数。增加面向扩展的导航贡献和技能来源契约，登记统一关联插件 ID 与本次加载实例。Host 绑定工具，Client 绑定页面与菜单；插件提供的技能由 `skills` 的公开来源接口接收。两个功能包之间通过公开接口或应用装配连接，避免循环依赖。
- **Agent 接入。** `POST /api/agent/runs` 增加可选的 `skillIds`。Agent 公开注册、撤销技能查询能力的接口，由应用装配绑定到运行中的 `skills` 服务。Agent 开始本轮时解析选中的技能并记录修订，原始正文只进入本轮上下文。普通聊天请求无需扩展字段，技能停用后新一轮重新查询可用列表。运行记录保留技能名、版本和结果，历史详情和上下文压缩不重新注入扩展正文。

建议 Host 接口使用 `/api/skills` 和 `/api/plugins`，分别提供列表、详情和写入操作。技能的新增、复制、更新、启停都由 Host 校验。插件详情和页头共用安装状态，Host 装卸完成后广播状态变更，Client 重新读取快照。详情页的过期按钮点击由 Host 校验实例和状态。

## 4. Cordis 装卸与二创边界

1. **安装与启用。** Host 先读取清单、校验来源和兼容性，把成功安装写入本地记录。启用时由管理器创建独立的 Cordis 子实例，保留其 `fiber` 句柄。Host 初始化就绪后才通知 Client 挂载。任何一侧失败都撤销本次注册，界面显示失败原因。安装和启用分别报告，用户可以保留一项已安装但停用的插件。
2. **停用与卸载。** Host 先把该实例标为不可用，禁止新调用，撤掉工具、技能来源和待审批调用，再释放 Client/Host 实例、订阅和连接。界面收到撤销事件，移除页面与侧栏项；如果正在该页，返回可用的扩展列表或首页。停用保留安装记录与设置，卸载再移除安装记录及 LFAA 管理的安装副本。用户创作和历史结果单独保存。
3. **正在运行。** Agent 在工具执行前核对当前注册实例，等待审批时卸载也要再次核对。下一步模型请求重新读取工具清单。对已加载技能正文的运行，停止受影响的运行并提示用户可以重新发起任务。对正在执行的扩展调用发出取消信号，退出前显示「停用中」。独立运行的扩展由 Host 回收其运行环境，已经完成的外部操作保留原有记录。
4. **编辑和二创。** 首个真实插件采用可预览、可编辑的本地清单与内容，能从扩展页安装、管理和复制。对可编辑的插件配置，校验成功后通过卸载旧实例、加载新实例生效。二创插件使用新 ID 和独立安装记录，来源字段可追溯。可运行自编代码的插件作为下一阶段，通过受控 Host 运行和独立 Client 贡献接入；届时单独评审权限、运行隔离和装卸失败恢复。

验收以**同一个真实扩展的贡献全部撤销**为准。重装相同 ID 会生成新的加载实例，旧审批、旧请求和注销回调都不能作用到新实例。

## 5. 文件级实施顺序

| 阶段 | 拟实施文件 | 可验收结果 |
| --- | --- | --- |
| 一、技能闭环 | 新增 `packages/skills/package.json`、`tsconfig.json`、`contract/index.ts`、`src/index.ts`、`src/skill-service.ts`、`src/skill-routes.ts`、`client/index.tsx`、`client/Skills-View.tsx` 及同名样式、`client/locales.ts`、`tests/` 和双语包说明。调整 `packages/core/agent/src/index.ts`、`agent-loop.ts`、`types.ts`、`http-handler.ts`，以及 `packages/core/chat/client/chat-store.ts` 和实际聊天选择器挂载点。 | 用一个用户自建技能完成新增、复制、编辑、调用、停用和重新启用；移除侧栏虚假已安装项。 |
| 二、插件闭环 | 新增 `packages/plugins/package.json`、`tsconfig.json`、`contract/index.ts`、`src/index.ts`、`src/plugin-manager.ts`、`src/plugin-routes.ts`、`client/index.tsx`、`client/Plugins-View.tsx` 及同名样式、`client/locales.ts`、`tests/` 和双语包说明。复用 `packages/core/tools/src/index.ts` 的注册器，增加必要的注册实例校验。 | 用一个真实本地插件走完安装、启用、调用、停用、卸载、重新安装。 |
| 各阶段装配 | `apps/web/src/server.ts`、`apps/web/src/main.tsx`、`apps/web/package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、根 `package.json`。布局涉及 `packages/ui/layout/src/index.ts`、`packages/ui/layout/client/workbench-service.ts`、`workbench-domains.ts`、`navigation.ts`、`ui-preferences.ts` 和 `components/DomainSidebarMenu.tsx`。目录规范涉及 `AGENTS.md`、`packages/README*.md` 与 `docs/standards/AI-Agent-Development-Standards.md`。按当期实际契约做最小变更。 | 一个包缺席或停用时，另一个包和普通聊天可独立使用。 |
| 三、扩展作者能力 | 基于阶段二清单增量设计加载适配器、权限申请和可编辑源码工作流，另行细化文件清单。 | 用户在独立版本中修改、预览、试运行和重新装载自定义扩展。 |

首期合并技能闭环的代码和测试。第二期只安装明确选择的本地插件。建议用「文本计数」作为首个真实插件，让它贡献一个详情页、一个计数工具和一个使用说明技能，完成同一插件的装卸验收。远程市场、外部账号连接、可执行源码加载各有独立交付和验收。

## 6. 验收和回滚

| 验收项 | 判定标准 |
| --- | --- |
| 真实列表和二创 | 空列表、加载失败、重复名称、项目隔离均能正确显示。编辑二创版本后原版内容相同；刷新后能恢复二创版本及启用状态。 |
| 技能确实被使用 | 运行测试通过可观测的模型请求验证选中的技能正文进入本轮上下文。停用、越权或卸载后无法选用，旧会话的下一轮也无法重新加载。 |
| 扩展装卸 | 验证同一插件的工具、技能和 UI 都来自实际登记。停用或卸载后它们即时移除；旧工具调用和未完成审批无法执行；重装后无重复菜单、工具或订阅。 |
| 失败与并发 | 验证 Host 启动失败、Client 挂载失败、同时启停、运行中卸载、带旧版本保存及重启恢复。列表和 Agent 能力以同一状态为准。 |
| 界面 | 用 `pnpm lfaa web` 启动，在内置浏览器实际走通桌面、双侧栏分屏、320px 手机、深浅主题和键盘操作。确认无新增控制台错误。 |
| 工程 | 运行相关测试、`pnpm run typecheck`、`pnpm run build` 和 `git diff --check`。每期补 dev-log 与适用的 updata-log，记录实际文件和测试结果。 |

每期都可在应用装配层停用对应模块，并撤销客户端贡献。回滚代码时保留独立的技能与插件数据目录，旧客户端继续读取普通会话。已安装扩展如涉及远端动作或可执行源码，纳入对应后续阶段的权限与回滚评审。

## 参考实现

- LFAA 的 [工具注册](../../packages/core/tools/src/index.ts)、[Agent 运行循环](../../packages/core/agent/src/agent-loop.ts)、[Workbench 注册](../../packages/ui/layout/client/workbench-service.ts) 和 [Web 装配](../../apps/web/src/server.ts)。
- DSH 本地参考位于 `E:/lfaa1/deepseek-harness`。查看 `packages/skill` 的技能分组、`packages/boot/plugin-manager` 的安装状态，以及 `packages/extensions` 下 Host/Client 的生命周期。
