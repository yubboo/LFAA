# 插件分层与模式预设

状态：**P0/P1 已落地（DEV-000647）：只读清单投影 + 设置中心「内置插件」页；Loader 全量装配与启停闭环（P2/P3）待排期**。

## 1. 两层结构（对齐 DSH）

```
全局插件（Builtin · Global）        随应用发布，系统与所有会话共用
   │  系统内核：tools / session / storage / sandbox / llm / ……
   │
   └─ 会话插件（Builtin · Session）  从全局清单里挑出的子集，按「模式」组成预设
        标准模式：通用对话所需的最小组合
        PTC 模式：程序化工具调用（PTC 运行时 + workflow）
        极简模式：只留读写与搜索
        创造模式：放开更多工具与浏览器
```

**关键语义**：

1. **不是两套插件，是同一份清单的两种取用范围。** 会话插件必须是全局清单里的已有项，不允许凭空出现。
2. **模式 = 预设 = 一份会话插件子集。** 切换模式只改变"这次会话启用哪些会话插件"，全局插件始终可用。
3. 全局插件**默认全部启用**，用户可停用；会话插件由当前模式决定，用户可临时调整。
4. 内置插件永远不可"安装/卸载"，只能启用/停用。

## 2. 与当前实现的差距

| 项 | DSH | LFAA 现状 |
|---|---|---|
| 全局插件数量 | ~100（截图可见 60+） | **35**（原 14 + web seam / web-fetch-http / goal / tool-goal / timeout-policy / spill-local / plan-mode / fs-observation-policy / compaction-basic / tool-result-pruner / tool-schedule / system-prompt / command-compact / sandbox-policy / message-feedback / attachment-local / session-title / commands / tool-media） |
| 会话/全局分区 | 两段，各自分组 | 两段（DEV-000209） |
| 模式预设 | 标准 / PTC / 极简 / 创造 | 标准 / 极简 / 创造可用，PTC 未接入 |
| 每项详情 | 完整名称、来自、配置状态、运行状态 | 名称、包名、内置标记、已装配状态 |

## 2.1 已完成（P0 全部 + P1 进行中）

| 包 | 状态 | 说明 |
|---|---|---|
| `tool-todo` | 完成 | `todo_write` / `todo_read` |
| `tool-web` | 完成 | 网页读取工具 |
| `web`（`packages/web/web`） | 完成 | 网页能力 seam：按优先级注册抓取实现 |
| `web-fetch-http` | 完成 | HTTP 实现：仅 http/https、超时、字节上限与截断标记 |
| `goal`（`packages/goal/goal`） | 完成 | 目标服务：`~/.lfaa/goals.json`，进度 + 最近 50 条进展 |
| `tool-goal` | 完成 | `goal_create` / `goal_update` / `goal_list` |
| `timeout-policy` | 完成 | 通过 `@lfaa/tools` 的 `useToolMiddleware` 给每次执行套超时，超时中止 signal 并返回可读结果 |
| `spill-local` | 完成 | 同一 seam 的 `afterExecute`：超长输出落盘 `~/.lfaa/spills/<session>/`，只回首尾窗口与路径（`spill-policy` 的阈值判断已合并进本包配置） |
| `plan-mode` | 完成 | 计划模式：`plan_mode_enter/exit/status` + 中间件拦截写/执行工具，只读探查保留 |
| `fs-observation-policy` | 完成（P1 提前） | 写前必读：已存在文件未读过时拦截 `write_file`/`edit_file`，新建文件放行，按会话隔离 |
| `compaction-basic` | 完成 | 压缩做成 `ctx.compaction` 服务，Agent 运行时优先用它，未挂载回落到内置函数；预算/窗口/保留轮次可配 |
| `tool-result-pruner` | 完成 | 中间件 `afterExecute`：清 ANSI/空行噪声，按行与字符保首尾并标注省略量，失败结果不动 |
| `tool-schedule` | 完成 | `schedule_create/list/cancel/due`：一次性与重复任务持久化到 `~/.lfaa/schedules.json`；无后台定时器，到期由工具领取（边界写进 README） |
| `system-prompt` | 完成 | `ctx.prompt` 分段注册 + `compose()`；Agent 开局取一次追加在系统提示末尾（`RunLoopDeps.extraSystemPrompt`），保持前缀稳定 |
| `command-compact` | 完成 | `compact_context` 工具向压缩服务登记一次性强制请求，下一次模型调用前按 4k 预算硬压（`compaction-basic` 内实现，Agent 循环零改动） |
| `sandbox-policy` | 完成（P1 提前） | `ToolsService.setSandboxResolver` seam：按工具指定本次沙箱模式，在判定之前生效；未配置时沿用调用方 |
| `message-feedback`（`packages/feedback/message-feedback`） | 完成（P1 首项） | 赞/踩与备注持久化到 `~/.lfaa/feedback.json`；`/api/feedback` 支持 GET / POST / DELETE；聊天消息操作栏已接入并可在刷新后回读 |
| `attachment-local`（`packages/attachment/attachment-local`） | 完成（P1 第二项） | 附件字节落盘 `~/.lfaa/attachments/<session>/`；`/api/attachments` 上传/列出/读取/删除；聊天输入栏附件上传后写入附件库，Agent 可用 `list_attachments` / `read_attachment` 读取 |
| `session-title`（`packages/session/session-title`） | 完成（P1 第三项） | 启发式简洁标题 + 模型生成（失败自动回落）；`core/session` 的标题函数改为依赖本包；`POST /api/session-title` 已接入 |
| `commands`（`packages/interaction/commands`） | 完成（P1 第四项） | 斜杠命令注册 seam：`ctx.commands.register` 注册、`/api/commands` 发现与执行；输入栏已合并 Host 命令（`/summarize`、`/explain` 为内置示例） |
| `tool-media`（`packages/media/tool-media`） | 完成（媒体生成 P2 生图 + P3 视频） | `generate_image` / `generate_video` / `get_video` 工具：调用套餐生图/视频模型（百炼原生接口 / 方舟 / OpenAI 兼容），媒体保存到 `.lfaa-media/{images,videos}` 并在聊天内预览；真实生成已验证 |

接入方式：加入 `bundle/web` 的 `CORE_MODULES` 并挂载，`plugin-catalog.ts` 登记名称/描述，插件页「全局插件」即可见；每个包带双语 README 三件套与回归测试。`@lfaa/tools` 新增 `useToolMiddleware` seam（`aroundExecute` / `afterExecute`），后续超时、精简、落盘类策略都挂在这里，不再各自改工具实现。

## 2.2 未完成（按优先级）

- **P0 已全部落地**（`tool-ask-user` 关闭：由 Agent 内置 `clarificationTool` 与聊天澄清卡片覆盖，不重复建包）。
- **P1（下一批从这里开始）**：`session-persistence-jsonl`、`session-projection`、`session-query-sqlite`、`permission` / `approval`、`subagent-spawn` / `fork`。
- **P2**：`mcp-client`、`lsp`、`workflow` / `tool-workflow`、`ptc-runtime`、`otel`、`open-in-app`、`document`、`acp` / `sdk`。

## 2.3 阶段收口（DEV-000283）

本轮全局插件扩充已交付 **14 个新包**（16 → 30 项），全部具备：Host 实现 + 注册进 `CORE_MODULES` + 插件页可见 + 双语 README 三件套 + 回归测试。

配套新增 5 个可复用 seam，后续插件不必再改核心实现：

| seam | 位置 | 用途 |
|---|---|---|
| `useToolMiddleware` | `@lfaa/tools` | 包裹执行（超时/取消）与改写结果（精简/落盘），按注册顺序组合 |
| `setSandboxResolver` | `@lfaa/tools` | 逐次沙箱策略，在判定前决定本次模式 |
| `ctx.compaction` + `RunLoopDeps.compaction` | `@lfaa/compaction-basic` + agent | 压缩策略可替换，未挂载时回落内置实现 |
| `ctx.prompt` + `RunLoopDeps.extraSystemPrompt` | `@lfaa/system-prompt` + agent | 插件按序追加系统提示段落，开局取一次 |
| `ctx.web` | `@lfaa/web` | 网页抓取实现按优先级注册，工具只依赖 seam |

新增包清单（按落地顺序）：`web`、`web-fetch-http`、`goal`、`tool-goal`、`timeout-policy`、`spill-local`、`plan-mode`、`fs-observation-policy`、`compaction-basic`、`tool-result-pruner`、`tool-schedule`、`system-prompt`、`command-compact`、`sandbox-policy`。

**已知约束**：`agent-loop.ts` 恰好 500 行（硬上限），再改必须先拆；`plugins/tool-web` 与两条内置 README 仍缺 YAML 头，属既有豁免。

## 3. 全局插件清单规划（按 DSH 分组归位）

> 每条对应本仓 `packages/<group>/<package>`，按包分类规范落地。P0 = 直接影响 Agent 可用性；P1 = 体验与安全；P2 = 生态。

### P0 · 内核与工具（缺了 Agent 能力不完整）

| 计划包 | 组 | 对应 DSH 插件 | 作用 |
|---|---|---|---|
| `tool-todo` | core | tool-todo | 任务清单工具 |
| `tool-web` | web | tool-web | 网页搜索与读取 |
| `web` / `web-fetch-http` | web | web / web-fetch-http | 网页能力 seam 与抓取实现 |
| `tool-ask-user` | interaction | user-questions | 向用户提问并等待 |
| `plan-mode` | plan | plan-mode | 计划模式 |
| `tool-schedule` | schedule | tool-schedule | 定时任务 |
| `compaction-basic` | compaction | compaction-basic | 上下文压缩 |
| `command-compact` | compaction | command-compact | 手动压缩命令 |
| `tool-result-pruner` | compaction | tool-result-pruner | 工具结果精简 |
| `spill-local` / `spill-policy` | spill | spill-* | 长结果落盘与策略 |
| `timeout-policy` | guard | timeout-policy | 工具超时 |
| `tool-goal` / `goal` | goal | tool-goal / goal | 目标管理 |
| `agent-loop` 拆分 | core | agent-loop | 与既有 agent 对齐 |
| `system-prompt` | core | system-prompt | 系统提示词组装 |

### P1 · 记忆、检索与安全

| 计划包 | 组 | 对应 DSH | 作用 |
|---|---|---|---|
| `session-persistence-jsonl` | session | session-persistence-jsonl | JSONL 持久化 |
| `session-projection` / `-cache` | session | session-projection | 会话状态派生与缓存 |
| `session-query-sqlite` | session-query | session-query-sqlite | 全文检索 |
| `session-title` / `-llm` | session | session-title* | 标题生成 |
| `attachment-local` | attachment | attachment-local | 附件存储 |
| `message-feedback` | feedback | message-feedback | 赞踩记录 |
| `permission` / `approval` | interaction | permission / approval | 权限模式与审批 |
| `fs-observation-policy` | fs | fs-observation-policy | 编辑前先读 |
| `sandbox-policy` | sandbox | sandbox-policy | 逐次沙箱策略 |
| `subagent-*`（spawn / fork） | subagent | subagent-* | 子智能体后端 |
| `tool-subagent-control` / `-fork` | subagent | tool-subagent-* | 子智能体工具 |
| `commands` / `command-feedback` | interaction | commands | 用户命令注册 |

### P2 · 生态与观测

`mcp-client`、`lsp`、`workflow` / `tool-workflow`、`ptc-runtime`、`typert-*`、`otel`、`product-analytics`、`open-in-app`、`document`、`acp` / `sdk`。

### 3.1 只读清单与设置页（DEV-000647）

- `GET /api/plugins/inventory`（`packages/extension/plugins/src/inventory/plugin-inventory.ts`）每次现读 `ctx.loader.entries()`，跳过 group 条目；只有根 Fiber 失败时才带 `diagnostic`；bundle 静态装配的模块按 `providedModules` 顺序补在前面，相位记为 active。
- 显示元数据来自包内 `locale/zh.json` 与 `locale/en.json` 的 `meta.title` / `meta.description`（`catalog/package-meta.ts`）；缺 locale 时回落 `package.json.description` 并标 `source: package`。
- 设置中心「内置插件」页（`packages/client/ui-plugins/client/inventory/`）只读：会话插件按当前预设分组（可切预设），全局插件默认折叠；卡片折叠显示标题、两行描述与条目 id，展开显示完整名称、来自、配置状态、运行状态；搜索覆盖标题、描述、包名与条目 id。
- 38 个插件全部是 Cordis Loader 条目（id 即稳定短名，状态取真实 Fiber 相位）；多插件包用默认导出的组合 bundle 装载（`web` / `goal` / `compaction` / `agent-profile`），`sandbox` 默认只挂策略、本地后端仍由根上下文提供。
- 每个条目展开后可「启用 / 停用」：停用写入 profile 的 `.plugin-manager/builtin-disabled.json`，并立即 `entry.update({ disabled })` 让 Loader 卸载；启动时由联线插件应用该清单，重启后保持。
- 函数型配置由联线插件在装配完成后经 setter 注入；安装记录的名称与描述取自包内 locale 元数据，`pnpm check` 的 `plugin-locale-meta` 会拦住缺双语 meta 的插件包。

## 4. 模式预设（已实现数据）

`packages/bundle/web/src/presets.ts` 定义四个模式及各自的会话插件子集，供 bundle 与插件页共用：

| 模式 | 会话插件 |
|---|---|
| `standard` | agent、tools、llm、rules、memory、skills |
| `ptc` | standard + ptc 运行时与工作流 |
| `minimal` | tools、llm |
| `creative` | standard + browser、jobs |

约束：预设里的每一项都必须在全局清单中存在（有单测守护）。

## 5. 实施顺序

1. **界面分区**：插件页拆成「会话插件（按当前模式）」「全局插件（默认启用，可停用）」两段，每项可展开看完整名称 / 来自 / 配置状态 / 运行状态。
2. **模式切换**：顶部下拉切模式，写入 profile，下次启动按模式装配会话插件。
3. **清单扩充**：按 P0 → P1 → P2 逐包新增，每个包都要过 `package-group` / `readme-pair` / `plugin-default-export` 三项检查。
4. **每加一个包都要**：`pnpm sync` 生成 tsconfig/清单/README 三件套 → `pnpm check` → `pnpm test` → 记录 dev-log。
