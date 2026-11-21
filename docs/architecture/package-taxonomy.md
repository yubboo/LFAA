# 包分类规范（Package Taxonomy）

状态：**强制规范**。新增包必须先按本文找到归属组，再动手；`pnpm check` 的 `package-group` 规则会拒绝未登记的分组。

## 0. 已登记分组（已启用 web / goal / guard / spill / plan / fs / compaction / schedule / feedback / attachment / session / interaction / media）

| 分组 | 职责 |
| --- | --- |
| `web` | 网页访问与抓取：`tool-web`、能力 seam `web`、HTTP 实现 `web-fetch-http`。 |
| `goal` | 长期目标：目标服务 `goal` 与目标工具 `tool-goal`（进度、受阻原因持久化）。 |
| `guard` | 执行策略：`timeout-policy` 统一工具超时（`core/guard` 是既有的命令安全服务，两者职责不同）。 |
| `spill` | 长结果治理：`spill-local` 把超长工具输出落盘并只回首尾窗口。 |
| `plan` | 计划模式：`plan-mode` 用中间件拦截写/执行工具，只留只读探查。 |
| `fs` | 文件策略：`fs-observation-policy` 强制写前必读（`core/fs` 是路径安全与遍历实现）。 |
| `compaction` | 上下文治理：`compaction-basic` 提供可替换的压缩服务，`tool-result-pruner` 精简单条工具结果。 |
| `schedule` | 定时任务：`tool-schedule` 持久化一次性/重复任务并提供领取工具（无后台定时器）。 |
| `feedback` | 消息反馈：`message-feedback` 持久化对助手回复的赞/踩与备注，供聊天界面回读。 |
| `attachment` | 会话附件：`attachment-local` 把附件字节存到本机并按会话提供列出/读取工具。 |
| `session` | 会话领域扩展：`session-title` 提供启发式 + 模型会话标题服务（`core/session` 依赖其纯函数）。 |
| `interaction` | 交互扩展：`commands` 提供斜杠命令注册 seam（`/api/commands` 发现与执行）。 |
| `media` | 媒体生成：`tool-media` 调用套餐生图模型生成图片并落盘到工作区（视频/语音后续）。 |

## 1. 为什么必须先分类

包分类不是审美问题，是维护成本问题。同样 20 个能力：

- 按职责分组：`api/` 全是接口边界，`core/` 全是内核，`bundle/` 全是装配——找东西只需一次定位。
- 东放西放：接口一半在功能包里、一半在 app 里；装配散在各处；半年后要重构骨架。

所以规则只有一条：**先确定层与组，再决定包名。**

## 2. 分层模型

```
apps/            启动与平台适配（禁止业务实现）
packages/
  api/           接口边界：HTTP/RPC 路由、控制器、协议
  host/          宿主服务：进程内基础设施（Web 服务托管、目录选择、静态资源）
  bundle/        装配组合：把多个包按序装成一个运行形态
  core/          内核领域：Agent 循环、模型、工具、会话、记忆、规则、上下文
  <domain>/      领域包：workspace、shell、ui、skill、plugin 等按领域分组
  util/          无领域归属的纯工具
  test-support/  测试替身与夹具
vendor/          内嵌上游源码（非本仓编写）
```

**硬约束**：

1. `apps/` 不放业务实现与装配（见规范 §3.6）。
2. `packages/` 下**不允许根级散包**；新包必须落在已登记的组内。历史上 `plugins`、`skills` 曾放在根目录，现已迁入 `extension/`。
3. 一个包只回答一个"层"的问题：要么是接口，要么是领域实现，要么是装配。

## 3. 组清单与职责（LFAA）

### 3.1 已登记分组

| 组 | 职责 | 放什么 | 禁止放什么 |
|---|---|---|---|
| `api/` | 接口边界 | HTTP 路由表、请求/响应校验、控制器、协议常量 | 业务规则、DOM、UI |
| `host/` | 宿主基础设施 | Web 服务托管、静态资源、目录选择 | 领域逻辑 |
| `bundle/` | 装配组合 | 按序挂载能力、跨服务联线、`providedModules` 声明 | 具体能力实现 |
| `core/` | Agent 内核 | agent、llm、tools、context、memory、session、rules、guard、fs、storage、settings、metrics、jobs、subagent、browser、chat | 装配、HTTP 路由表 |
| `ui/` | 通用界面 | layout、primitives、theme | 业务功能 |
| `workspace/` | 工作区领域 | workspace、sections | 通用 UI 组件 |
| `shell/` | 命令执行领域 | shell、shell-env、bash-local、pwsh-local | 工具定义（属 core/tools） |
| `sandbox/` | 安全边界 | sandbox（契约）、sandbox-local（工具层后端） | 业务逻辑、UI |
| `extension/` | 扩展生态 | plugins（插件生命周期）、skills（技能目录） | 内核能力、装配 |
| `util/` | 无领域工具 | 纯函数、类型、路径helper | 依赖 Cordis 服务的实现 |
| `test-support/` | 测试支撑 | mock、fixture、testkit | 生产代码 |

`packages/` 根目录不再有任何散包：原 `plugins`、`skills` 已迁入 `extension/`。

### 3.2 规划中的分组（新增能力时按此归位）

| 组 | 何时启用 | 典型包 |
|---|---|---|
| `extension/`（已启用） | 插件与技能的装载生态 | plugins、skills、plugin-market |
| `session/` | 会话持久化/投影/检索继续膨胀时，从 `core/session` 拆出 | session-persistence、session-query |
| `web/` | 联网能力 | web、web-search、web-fetch、tool-web |
| `mcp/` | 外部工具协议 | mcp-client |
| `schedule/`、`todo/`、`goal/`、`plan/` | 对应能力落地时 | tool-schedule、tool-todo…… |
| `interaction/` | 需要用户审批/提问的交互 | user-approval、user-questions、tool-ask-user |
| `credentials/` | 凭据与授权 | credentials、authorization |
| ~~`sandbox/`~~ | 已启用，见已登记分组 | sandbox、sandbox-local |
| `subprocess/` | 进程管理从 shell 中独立 | subprocess、win32-process |
| `telemetry/` | 指标上报 | otel |
| `client/` | 浏览器端通用基础设施（非某个功能的 UI） | modules、connection、store、shortcuts |

## 4. 新包归属决策流程

按顺序回答，第一个"是"即决定归属：

1. **它是 HTTP/RPC 路由、请求校验或协议定义吗？** → `api/`
2. **它只负责把别的包装起来、接线吗？** → `bundle/`
3. **它是宿主进程级基础设施（服务托管、静态资源、目录选择）吗？** → `host/`
4. **它是 Agent 内核的一环（模型、工具、上下文、会话、记忆、规则）吗？** → `core/`
5. **它是通用界面、无业务语义吗？** → `ui/`
6. **它属于已有领域（workspace / shell / skill / plugin / web / mcp…）吗？** → 对应领域组
7. **它无领域归属且被两处以上复用吗？** → `util/`
8. **都不是** → 先在本文登记新组，再建包。

## 5. 命名与包的粒度

- 组内包名用 kebab-case，一个包一个职责：`api/gateway`、`core/agent`、`host/web-server`。
- 包名带领域前缀会重复，**优先用目录上下文减重复**：`core/session` 而不是 `core/session-manager`。
- 一个能力若同时有"服务 + 工具 + UI"，仍放在**同一个包**内（`src/` + `client/`）；只有接口边界才单独进 `api/`。

## 6. 反例（明确禁止）

| 错误做法 | 为什么错 | 正确做法 |
|---|---|---|
| 在 `apps/web` 里注册 13 个 HTTP 路由 | app 变成装配中心，无法复用 | 路由表进 `api/gateway` |
| 每个功能包自己 `createXxxHttpHandler` 并各自注册 | 路由顺序分散，无法统一鉴权 | 统一由 `api/gateway` 编排 |
| 新建 `packages/foo` 根级散包 | 分类失效，半年后不知道找哪 | 放进已登记组 |
| 把通用 UI 放进某个业务包 | 其他包被迫依赖业务包 | 进 `ui/primitives` |
| 把装配逻辑写进 `core/agent` | 内核与运行形态耦合 | 进 `bundle/*` |

## 7. 迁移策略

- 新包一律按本文归位；存量包不主动搬迁，除非同轮任务本身要动它。
- 搬迁必须同轮完成：目录、`package.json`、`pnpm-workspace.yaml`（若涉及根级）、tsconfig 生成、imports、README 三件套、dev-log。
- 已完成迁移：`plugins`、`skills` → `packages/extension/`（DEV-000191）；`packages/` 根目录现无散包。
