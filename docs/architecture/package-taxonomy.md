# 包分类规范（Package Taxonomy）

状态：**强制规范**。新增包必须先按本文找到归属组，再动手；`pnpm check` 的 `package-group` 规则会拒绝未登记的分组。

## 0. 已登记分组（已启用 web / goal / guard / spill / plan / fs / compaction / schedule / feedback / attachment / session / interaction / media / chat）

| 分组 | 职责 |
| --- | --- |
| `web` | 网页访问与抓取：单包 `web` 内含能力 seam、HTTP 抓取实现与 `fetch_url` 工具。 |
| `chat` | 聊天工作台领域：`chat`（对话、输入栏、会话、右栏工作台、模型与常规/通知设置）、`library`（资料库页面、检视器与存储位置设置）、`review`（代码审查工作台、Git/审查设置页与 Git/审查 Host 服务）。三个包共用 `chat` 提供的 `chatStore` 客户端服务与 `@lfaa/memory` 的资料库数据；**设置页归各自功能包所有**。 |
| `goal` | 长期目标：单包 `goal` 内含目标服务与目标工具（进度、受阻原因持久化）。 |
| `guard` | 执行策略：`timeout-policy` 统一工具超时（`core/guard` 是既有的命令安全服务，两者职责不同）。 |
| `spill` | 长结果治理：`spill-local` 把超长工具输出落盘并只回首尾窗口。 |
| `plan` | 计划模式：`plan-mode` 用中间件拦截写/执行工具，只留只读探查。 |
| `fs` | 文件策略：`fs-observation-policy` 强制写前必读（`core/fs` 是路径安全与遍历实现）。 |
| `compaction` | 上下文治理：单包 `compaction` 内含可替换压缩服务、工具结果精简与 `/compact` 命令。 |
| `schedule` | 定时任务：`tool-schedule` 持久化一次性/重复任务并提供领取工具（无后台定时器）。 |
| `feedback` | 消息反馈：`message-feedback` 持久化对助手回复的赞/踩与备注，供聊天界面回读。 |
| `attachment` | 会话附件：`attachment-local` 把附件字节存到本机并按会话提供列出/读取工具。 |
| `session` | 会话领域扩展：`session-title` 提供启发式 + 模型会话标题服务（`core/session` 依赖其纯函数）。 |
| `interaction` | 交互扩展：`commands` 提供斜杠命令注册 seam（`/api/commands` 发现与执行）。 |
| `media` | 媒体生成：`tool-media` 提供图像、视频与音频生成工具及落盘；`canvas` 提供项目画布契约、素材版本和节点执行。界面分别由 `client/ui-tool-media` 与 `client/ui-canvas` 提供。 |

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
| `core/` | Agent 内核 | agent、llm、tools、context、memory、session、rules、guard、fs、storage、settings、metrics、jobs、subagent、browser | 装配、HTTP 路由表 |
| `chat/` | 聊天工作台领域 | chat（对话工作台）、library（资料库）、review（代码审查与 Git Host 服务） | 其它领域逻辑、通用控件 |
| `ui/` | 通用界面 | layout、primitives、theme | 业务功能 |
| `client/`（11） | **功能界面** | `ui-<功能>`：agent-group、agent-profile、browser、chat、library、plugins、review、sections、skills、tool-media、workspace；含 `src/index.ts`（Host 半）+ `client/`（浏览器半） | 业务服务实现、跨功能 UI 直连 |
| `workspace/` | 工作区领域 | workspace、sections | 通用 UI 组件 |
| `shell/` | 命令执行领域 | `shell`（执行服务 + 本地 Shell 方言解析 + 输出解码） | 工具定义（属 core/tools） |
| `sandbox/` | 安全边界 | `sandbox`（契约 + 逐次策略 + 工具层后端） | 业务逻辑、UI |
| `extension/` | 扩展生态 | plugins（插件生命周期）、skills（技能目录） | 内核能力、装配 |
| `util/` | 无领域工具 | 纯函数、类型、路径helper | 依赖 Cordis 服务的实现 |
| `test-support/` | 测试支撑 | mock、fixture、testkit | 生产代码 |

`packages/` 根目录不再有任何散包：原 `plugins`、`skills` 已迁入 `extension/`。

### 3.2 规划中的分组（新增能力时按此归位）

| 组 | 何时启用 | 典型包 |
|---|---|---|
| `extension/`（已启用） | 插件与技能的装载生态 | plugins、skills、plugin-market |
| `session/` | 会话持久化/投影/检索继续膨胀时，从 `core/session` 拆出 | session-persistence、session-query |
| `web/` | 联网能力 | `web`（seam + 抓取实现 + 抓取工具） |
| `mcp/` | 外部工具协议 | mcp-client |
| `schedule/`、`todo/`、`goal/`、`plan/` | 对应能力落地时 | tool-schedule、tool-todo…… |
| `interaction/` | 需要用户审批/提问的交互 | user-approval、user-questions、tool-ask-user |
| `credentials/` | 凭据与授权 | credentials、authorization |
| ~~`sandbox/`~~ | 已启用，见已登记分组 | `sandbox` |
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

- 组内包名用 kebab-case，一个包一个职责：`api/gateway`、`core/agent`、`host/web-server`、`client/ui-chat`。
- 包名带领域前缀会重复，**优先用目录上下文减重复**：`core/session` 而不是 `core/session-manager`。
- **界面与能力分家**：能力包只放 `src/`（服务、工具、契约）；界面放 `packages/client/ui-<功能>/`（一个界面功能一个包）或 `packages/ui/*`（共享界面）。存量带 `client/` 的包按 [结构法则](structure.md) §7 分批迁出，`pnpm check:arch` 的 `legacy-client-grow` 保证基线只减不增。
- **一个大功能 = 一个包，包内再分小文件夹**：功能包内部按职责建立子目录（如 `client/store/`、`client/conversation/`、`client/workbench/`、`src/run/`），子目录承载同类文件而不是再拆成独立包。跨包只允许单向依赖，同领域客户端包通过 Cordis 服务（如 `chatStore`）共享状态，禁止 `export *` 互相吞。
- 不为 2–3 个文件的能力单独建包；确需独立时，必须能独立回答一个职责问题并具备自己的 README 三件套。

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
- 已完成迁移（DEV-000375）：`core/chat` → `packages/chat/chat`，并从其中拆出 `packages/chat/library`（资料库）与 `packages/chat/review`（代码审查 + Git/审查 Host 服务）。三个包同属 `chat` 组，`chat` 对外提供 `chatStore` 客户端服务，`library` / `review` 单向依赖 `chat`。

- 已完成迁移（DEV-000382）：`web`（seam + HTTP 抓取 + 抓取工具）、`shell`（执行服务 + Bash/PowerShell/CMD 解析 + 输出解码）、`sandbox`（契约 + 逐次策略 + 工具层后端）、`compaction`（压缩服务 + 结果精简 + `/compact`）、`goal`（目标服务 + 目标工具）五组各合并为单包，包内按职责分 `src/` 子目录。
- 已完成（DEV-000438 试点 + DEV-000440 全量）：界面从能力包迁往 `packages/client/ui-*`，11 个功能界面包全部就位，能力包只剩 `src/`/`contract/` 且不再带 React；`check:arch` 的 `clientUi.legacy` 基线已清空。
- 插件 id 迁移：合包前的旧 module 名登记在 `@lfaa/plugins` 的 `MODULE_ALIASES`。旧会话的 `sessionModules` 在 `resolveLegacySessionModules` 归一化并去重；旧 `installed.json` 记录在读取时改写 `moduleName/id/manifest.id`，同包多条记录按 id 合并（启用状态取并集）后回写。外部插件名不受影响。
