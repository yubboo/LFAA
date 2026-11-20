# 插件分层与模式预设

状态：**模型已定，预设数据已落地（DEV-000208）**；全局插件清单扩充与界面分区待实施。

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
| 全局插件数量 | ~100（截图可见 60+） | **14** |
| 会话/全局分区 | 两段，各自分组 | 只有一段"可安装" |
| 模式预设 | 标准 / PTC / 极简 / 创造 | **无** |
| 每项详情 | 完整名称、来自、配置状态、运行状态 | 只有包名 |

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
