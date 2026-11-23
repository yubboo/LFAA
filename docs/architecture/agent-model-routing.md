# Agent 与模型解耦：Agent 定义、模型绑定与路由组方案

- 状态：**待评审，未开工**
- 提出时间：2026-11-22（Asia/Shanghai）
- 范围：只做 LFAA 自身。只接 API Key 套餐与本地模型（Ollama / LM Studio）；**不做**登录态订阅（Claude Pro / ChatGPT Plus）的反向借用，**不做**对外端口（3425 那种让别的 CLI 接进来）。
- 参照：[magpie](https://github.com/yetone/magpie) 的 Agents / Routing 两层设计。只借它的「绑定」概念，不借「改写别人家配置文件」的做法——LFAA 自己就是那个 agent，没有外部配置要改。
- 关联方案：[会话形态：单聊 / 群聊 / Agents](agent-conversations.md)。本文只管「agent 与模型怎么绑」，会话怎么组织归那份文档；两份一起评审，实施时前者是后者的地基。

## 0. 一句话

把「agent 是谁」和「用哪个模型」拆成两个独立实体：agent 只管人设、技能与工具边界；模型绑定只管调谁、失败了找谁；会话在运行开始时把两者拍平成一个快照交给 LLM 层。

## 1. 为什么 LFAA 只需要 magpie 的一半

magpie 的「解耦」由两个动作叠起来：

| 动作 | magpie 的做法 | LFAA 的对应 |
| --- | --- | --- |
| 让外部工具指向网关 | 改写 Claude Code 的 `settings.json`、Codex 的 `config.toml`，原子写、保留注释 | **不需要**。LFAA 的 agent 内核就是自己，配置在自己手里 |
| 协议翻译网关 | `127.0.0.1:3425` 同时讲 OpenAI Chat / Responses / Anthropic / Gemini 并互译 | **已经有了**：`packages/core/llm/src/index.ts:139` 的 `dispatchByProtocol` 与四个适配器 |
| 模型/账号的选择与轮换 | 路由组 + 多账号 + 配额耗尽切换 | **缺这块**，本方案的核心 |

所以本方案不重复造协议层，只补「谁能用哪个模型」和「用完怎么办」。

## 2. 现状盘点

| 能力 | 现状 | 缺口 |
| --- | --- | --- |
| 多供应商配置 | `LlmService` 管多份 `LlmProfile`，落 `~/.lfaa/llm-config.json`；增删改在 `core/llm/src/index.ts:236`（`saveProfile`）、`:374`（`selectProfileModel`） | 无 |
| 协议 | 四适配器 + 按 `apiProtocol` 派发 | 无 |
| 供应商卡片 / 套餐 | `chat/chat/client/models/provider-catalog.ts`、`provider-plans.ts`（火山 Agent Plan、千问 Token Plan 等已登记） | 无 |
| 模型选择粒度 | **全局单例**：`chat/chat/client/store/chat-run-actions.ts:193` 每次发消息带的是 `state.activeProfileId` | **没有会话级、更没有 agent 级绑定**；换模型全局串台 |
| Agent 定义 | 只有一个隐含的「小鱼」：系统提示由 `core/system-prompt` 的全局段落合成 | 没有可添加、可保存、可复用的 agent 实体 |
| 故障转移 | `core/agent/src/run/agent-fallback.ts` 是**步数预算收口**，不是模型故障转移 | 没有 order / rotate / 组内切换 |
| 子 agent | `core/subagent/src/types.ts:35` 的 `parentProfileId`，只能继承父的模型 | 不能指定自己的 agent 与模型 |
| 用量 | 每条助手消息记 `model` / `tokenUsage` / `cost`（`core/session/src/types.ts:142`） | 没有按 profile 的累计，路由的 `usage` 策略无数据可用 |

一句话总结：**「任意模型」这半件事已经做完了；缺的是「任意 agent × 任意模型」的绑定关系，以及绑定到多个目标时的派发规则。**

## 3. 设计

### 3.1 AgentDefinition（agent 定义）

```ts
interface AgentDefinition {
  id: string;                          // "xiaoyu" 为内置默认，不可删
  name: string;
  icon?: string;                       // 复用 ui-icons 的 key
  description?: string;
  instructions?: string;               // 追加到系统提示，排在 PromptService 现有段落之后
  instructionsMode?: "append" | "replace";
  skillIds?: string[];                 // 复用 @lfaa/skills
  toolPolicy?: { allow?: string[]; deny?: string[] };  // 复用 permission-policy
  bindingId?: string;                  // 默认模型绑定；缺省=全局默认绑定
  source: "builtin" | "user" | "imported";
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
```

要点：

- 「小鱼」以 `builtin` 形式内置，行为与今天完全一致（无 instructions、无 toolPolicy、用全局默认绑定），保证不配置也能跑。
- `instructions` 只影响系统提示的追加段，不替换 `PromptService` 的既有段落；`replace` 模式作为显式选项保留，第一版 UI 不暴露。
- `skillIds` / `toolPolicy` 本方案只做**存储 + 接线**，不做新的权限语义。

### 3.2 ModelBinding（模型绑定，含路由组）

```ts
type BindingStrategy = "single" | "order" | "rotate" | "usage";

interface BindingTarget {
  profileId: string;
  modelId?: string;                    // 缺省=该 profile 当前选中的模型
}

interface ModelBinding {
  id: string;
  name: string;
  strategy: BindingStrategy;
  targets: BindingTarget[];            // 1..n，顺序即优先级
  onError: "next" | "fail";            // 失败是否换下一个目标，默认 next
  cooldownMs?: number;                 // 触发失败的 profile 在本次运行内冷却
  inheritGlobal?: boolean;             // 仅内置 default：跟随全局选中配置
}
```

**实施补充（P1 已落地，2026-11-22）**：只有内置 `default` 绑定带 `inheritGlobal: true` 且 `targets` 为空——它不写死 profile id，运行时跟随全局 `activeProfileId`。原因很简单：写死一个 id，用户换配置或删配置后这份绑定就指向了不存在的目标，等于每次启动都要修一遍数据。其余绑定的 `targets` 一律非空。

**关键取舍：单模型不单独建模，就是 `targets.length === 1` 的绑定。**

这一条决定了后面所有代码只需要一条路径：UI 上「选一个模型」和「选一个路由组」写的是同一个字段 `bindingId`；派发层只认「候选队列」，永远不需要 `if (是组)` 的分支。magpie 里 `group/xxx` 与 `provider/model` 也是同一种引用，值得对齐。

不做嵌套组（组里再放组）：第一版先避免环检测与调试成本，`targets` 只允许指向具体 profile。

### 3.3 会话绑定与优先级

- 会话记录新增 `agentId?: string`（缺省取内置 `xiaoyu`）与 `bindingOverrideId?: string`（临时换模型，不改 agent 定义）。
- 运行开始时解析一次：

```
会话 bindingOverrideId  >  agent.bindingId  >  全局默认绑定
```

- **快照语义**：解析结果写进本次 run 的参数，运行中改 UI 不影响正在跑的这一轮；下一轮重新解析。
- 全局 `activeProfileId` 降级为「默认绑定的来源」：内置 `default` 带 `inheritGlobal`，**不复制**当时的 profile id，因此用户换配置、删配置都不会留下悬空引用。UI 上的模型切换仍然可以写全局（今天的行为），也可以写某个 agent 的绑定——两者不冲突，因为优先级是显式的。

### 3.4 解析与派发：包装器，不改 loop 签名

agent loop 里的 `profileId` 目前穿过 `run-begin` / `model-round` / `think-round` / `agent-fallback` / `run-options` 多处，直接改签名会牵动大量既有用例。改为：

1. 新增纯函数 `resolveCandidates(binding, profiles, session) -> Promise<BindingTarget[]>`（按策略排序、过滤不可用 profile）。
2. 新增 `BoundLlm` 薄装饰器，实现与 `LlmService.complete` 相同的签名，内部：逐个候选 try → 成功即返回 → 失败按 `classifyError` 决定换下一个、冷却、还是直接抛。
3. 在 `run-context` 装配 deps 时把 `deps.llm` 换成 `BoundLlm`（默认绑定只有 1 个目标时行为与今天逐字节一致）。
4. `completeAgentRound` 回传**实际使用的 profile/model**，写进消息记录，UI 显示真话。

### 3.5 路由策略与「什么时候可以换」

| 策略 | 行为 |
| --- | --- |
| `single` | 固定一个目标；失败即失败（`onError: fail`） |
| `order` | 永远先用第一个，失败才下移 |
| `rotate` | 每次运行下移一位（按 run 计数，不按请求计数，避免多步任务一轮换一个模型） |
| `usage` | 本地用量最少的优先，需要 `~/.lfaa/usage.json` 累计 |

**硬约束：只在「本轮模型回合尚未产出任何 token」时换目标。**

一旦流式输出已经开始（reasoning 或正文有内容），失败就按今天的路径重试或收口，**绝不切换到另一个模型拼接输出**——两个模型的思维链拼在一起，结果不可读也不可审计。这条要写成单测。

### 3.6 错误分类

`classifyError(error) -> "retryable" | "next-target" | "fatal"`：

- `next-target`：429、5xx、超时、网络错误、`ECONNRESET`。
- `fatal`：400（参数/上下文超限）、403（内容策略）、鉴权失败（401 换同 provider 无用，跨 provider 才有意义——按 `onError` 决定，默认换）。
- `retryable`：沿用现有 `IncompleteModelRound` 的短重试，不消耗候选。

## 4. 数据与接口

### 4.1 存储

| 文件 | 内容 |
| --- | --- |
| `~/.lfaa/agents.json` | `{ version, agents: AgentDefinition[] }` |
| `~/.lfaa/bindings.json` | `{ version, bindings: ModelBinding[] }` |
| `~/.lfaa/usage.json` | `{ [profileId]: { requests, inputTokens, outputTokens, lastUsedAt } }` |

统一由新包 `@lfaa/agent-profile` 读写，形态与 `LlmService` 的 `readConfig` / `writeConfig` 一致（原子写、损坏时回退默认、修复后回写）。

### 4.2 HTTP

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST | `/api/agents` | 列 / 建 |
| PATCH / DELETE | `/api/agents/:id` | 改 / 删（`builtin` 拒绝删，只允许禁用） |
| POST | `/api/agents/import` | 导入（`source: "imported"`） |
| GET / POST | `/api/bindings` | 列 / 建 |
| PATCH / DELETE | `/api/bindings/:id` | 改 / 删（被 agent 或会话引用时拒绝） |
| PATCH | `/api/sessions/:id` | 追加 `agentId` / `bindingOverrideId` |

全部走既有 `ApiGateway` 注册（新包提供 `createAgentProfileHttpHandler`），鉴权与 JSON 校验沿用 `packages/api/gateway`。

### 4.3 运行入口扩展

`StartAgentRunInput` 增加 `agentId?: string`、`bindingId?: string`，并在 `run-options.ts` 的续跑缓存里带上——和 `profileId` 同样的处理，保证「自动续跑 / goal 续跑」不会退回默认模型。

## 5. UI 与交互

### 5.1 Agents 页（左二新增一级入口）

对齐 magpie 的列表形态，但每行的下拉是 LFAA 自己的 `供应商/模型` 或路由组。位置已定（负责人 2026-11-22 决定）：**左一图标栏「首页 → 群聊 → Agents」的第三位**，不占左二，详见[会话形态方案](agent-conversations.md) §4。

```
┌ Agents ────────────────────────────── [ + 新建 ] [ 导入 ] ┐
│ ▸ 小鱼          ● 已启用      [ DeepSeek V4.1 Flash  ▾ ]  ○│
│ ▸ 代码审查员    ● 已启用      [ 路由组：Opus 优先    ▾ ]  ●│
│ ▸ 前端助手      ○ 已停用      [ Kimi K3              ▾ ]  ○│
└────────────────────────────────────────────────────────────┘
```

- 展开行：人设指令编辑器、技能多选、工具 allow/deny、绑定选择（模型 or 路由组）。
- 模型下拉的数据源直接复用 `llm.listPublicProfiles()`，把所有 profile 的 `availableModels` 摊平成 `供应商/模型`，底部单独一段「路由组」。
- 「新建路由组」就地弹窗：名称 + 策略 + 目标列表（每行一个 `供应商/模型`）。

### 5.2 会话顶栏

现有会话模式下拉旁边增加 agent 与模型徽标（`小鱼 · DeepSeek V4.1 Flash`），点击可临时覆盖 `bindingOverrideId`；临时覆盖只影响本会话，不改 agent 定义。

### 5.3 状态与失败可见

发生目标切换时，在助手消息的活动行里记一条 `已从 X 切到 Y`（沿用现有 activity 行的语义与对齐规则），不让用户猜为什么这轮变慢了。

## 6. 包落位与文件级清单（预估）

| 位置 | 内容 |
| --- | --- |
| `packages/core/agent-profile/src/{index.ts,store.ts,binding-resolver.ts,error-classify.ts,http-handler.ts}` | 新包；默认导出 `agentProfilePlugin`；`core` 组已登记，需同轮补 README 三件套 |
| `packages/core/agent-profile/client/{Agents-Page.tsx,Binding-Editor.tsx,locales.ts,*.module.css}` | Agents 页（`core/browser` 已有带 client 的先例） |
| `packages/core/llm/src/bound-llm.ts` | 装饰器，放 llm 包内避免循环依赖 |
| `packages/core/agent/src/run/{run-context.ts,run-options.ts,types.ts}` | 装配与入参扩展（小改） |
| `packages/core/session/src/types.ts` | 会话记录加两个字段 |
| `packages/bundle/web/src/index.ts`、`packages/host/web-server/src/*` | 注册新包与路由 |
| `docs/architecture/{README.md,repository-map.md}` | 索引与骨架 |

## 7. 分阶段（每阶段独立提交、可回滚）

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| P1 | ✅ 数据层：`AgentDefinition` / `ModelBinding` 存储、内置小鱼、默认绑定（`inheritGlobal`） | 单测：读写、损坏回退、builtin 不可删 —— **已实施，`packages/core/agent-profile`** |
| P2 | 解析层：`resolveCandidates` + `classifyError` + `BoundLlm` | 单测：优先级、四种策略、首 token 后不换、错误分类 |
| P3 | 生效：会话 `agentId`、run 装配、消息记录真实 model、切换活动行 | 集成：curl 起 server，两个 agent 各绑不同 profile，切 agent 后 `model` 字段跟着变 |
| P4 | ✅ UI：Agents 页（左一第二位）+ 编辑卡 + 单目标绑定 | `verify:web` 12/12，含窄屏与深色截图 |
| P5 | ⏳ 部分完成：导入导出、`toolPolicy` 运行期生效 + 界面编辑已做；`allow` 白名单 UI、`skillIds`、子 agent `agentId` 未做 | 快照 3 例 + 策略 2 例；策略视图已用真实 Context 验证 |

## 8. 验收标准

- 单测覆盖：解析优先级、四种策略、错误分类表、流式中途不换、builtin 保护、引用检查。
- 集成：真实起 Host，建 2 个 agent + 1 个路由组，跑一轮把主目标打成不可用，确认切到第二个目标且消息如实记录。
- UI：内置浏览器实测（AGENTS.md 强制），浅色与深色、窄屏都要过；控制台无新增报错。
- 门禁：`pnpm check`（含 `map:sync`、README 三件套、file-size）、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm verify:web` 全过。
- 日志：dev-log 同编号一条；updata-log 随 P4 交付一条（Agents 页是用户可见新功能）。

## 9. 风险与明确不做

| 风险 | 处理 |
| --- | --- |
| 全局 `activeProfileId` 与新绑定双轨 | 内置 `default` 用 `inheritGlobal` 跟随全局，不复制 profile id；UI 切换模型不再产生第二份真相 |
| 改 loop 的回归面 | 用装饰器 + 默认透传，agent loop 现有 47 个用例不允许因本次改动修改断言 |
| 换目标导致重复计费 | 失败切换记录 attempts；首 token 后禁止切换（见 3.5） |
| 路由的 `usage` 失真 | 明确是**本地计数**，不是厂商配额；真实配额窗口各家 API 差异太大，不在本方案 |
| 多 agent 协作被误解成本方案已交付 | 本方案只交付「每个 agent 各自绑定模型」的基座；**多 agent 同处一个会话、互看产出**由[会话形态方案](agent-conversations.md)承接 |

明确不做：登录态订阅借用、配额窗口 warm-up、对外网关端口、路由组嵌套、跨机器同步。

## 10. 待负责人确认

1. ~~Agents 页放左二一级入口还是设置页~~ → **已定**（2026-11-22）：左一图标栏第三位，顺序为 首页（单聊）→ 群聊 → Agents。
2. 路由组第一版**不允许嵌套**（推荐）是否可以。
3. `usage` 策略第一版只做本地计数，够用吗？还是要同时显示各家的剩余额度（后者要逐家适配）。
4. 子 agent 指定 `agentId` 放在 P5 是否可以——群聊落地后，这条也可以并入群聊的「成员」概念，不必单独做。

## 11. 实施记录

**P1（2026-11-22 已实施）**：新包 `packages/core/agent-profile`。

| 文件 | 职责 |
| --- | --- |
| `src/types.ts` | 契约、常量、纯归一化与 `resolveBindingIdFor` |
| `src/validate.ts` | 入参校验（名称、id、指令长度、目标数量、冷却） |
| `src/sanitize.ts` | 落盘数据归一，内置小鱼与 default 始终存在 |
| `src/store.ts` | 原子写（临时文件 + rename），读失败当「没有文件」 |
| `src/service.ts` | `AgentProfileService`（`ctx.agentProfile`）与插件 |

落地时的三个偏差，均已在正文登记：

1. `default` 绑定用 `inheritGlobal` 而非写死 profile id（见 §3.2）。
2. 首次访问时把内置项真正落盘，而不是只在内存里补——用户打开 `~/.lfaa/agents.json` 能看到小鱼。
3. `cooldownMs: 0` 约定为「清除冷却」，与「未传」区分。

已接入 `packages/bundle/web`（`ctx.plugin(agentProfilePlugin)`），`pnpm probe:boot` 3/3 证明装配不破。