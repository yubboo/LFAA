# LFAA Agent / Contributor Guide — v0.1.7

本文件给 AI Agent 和开发者提供最短路径的当前约束。**先遵守当前代码与本文件，再参考历史记录。**


## v0.1.7 不可破坏的模式 / Provider 原则

1. Chat Agent 与 Work Agent **只能有一套 Agent Core / AgentRunRequest / Session Controller / Runtime Host**。
2. 二者能力、智力、性能、工具、权限、自动化与最终交付质量必须同构；`workspaceMode` 只描述交互表现层。
3. Chat 的人工干预是对话/插话；Work 的人工干预是无限画布编辑 + 对话继续。
4. Manual 是无模型手动模式：不得进入 Agent Runtime，但必须复用 Work Canvas 和真实 Tool/Terminal 基础设施。
5. Provider 官方免费、套餐包含、按量 API、Coding Plan 等 entitlement 原样映射；禁止 LFAA 自造余额、免费/收费规则。
6. ChatGPT 套餐属于 OpenAI Provider 的官方订阅认证方式；产品不得要求用户安装全局 Codex CLI。内部可使用由 LFAA 管理的官方 App Server 组件，但不得把实现细节冒充用户依赖。
7. 支持流式的 Provider 必须通过统一 `assistant.delta` 实时投影；禁止为了省实现而退回“等待完整 JSON 后一次性回答”。
8. Usage/Quota 是附加状态：失败或超时必须进入明确终态，不能阻塞账户保存，也不能永久显示“正在读取”。

## 先读

1. `ARCHITECTURE.md`
2. `DEVELOPMENT.md`
3. `docs/项目结构与代码地图.md`
4. 你要修改的 capability family / package README

## 当前仓库地图

```text
apps/                    薄产品入口；禁止承载业务
  web/

packages/                TypeScript 业务 / Harness 主体
  api/                    本地 Host Controllers
  bundle/                 产品 Host Bundle
  client/                 Web Client / Shell / Workspace / UI
  core/                   Agent Runtime 核心契约
  credentials/            Credential seam / Native Adapter
  harness/                官方外部 Harness Adapter
  host/                   Vite 等 Host 技术适配
  llm/                    模型协议 Adapter
  plugin/                 Plugin SDK / Runtime / Host
  settings/               Config Domain / Host
  terminal/               Terminal Host 能力
  util/                   基础工具

native/                  Rust Native Kernel
scripts/                 开发/治理/发布工具
test/                    仓库级契约测试
docs/                    长期文档与历史日志
```

仓库根**不得重新创建 `.lfaa/`**。运行状态使用 `@lfaa/home-paths` 解析的用户 Runtime Home。

## Owner 规则

- 业务首先找现有 capability family；不要因为一个新文件就新增顶层 family。
- package 只有在有真实实现、当前 Consumer、明确 lifecycle/Owner 时创建。
- `apps/web` 只允许 startup/build composition；Agent、AI、Plugin、Terminal、Secret、Provider 等业务必须属于 `packages/`。
- `native/` 只允许真实 OS/Security primitive。
- 外部 Harness 通过 Adapter 接入，优先官方协议/API。

## 依赖规则

继续遵守：

```text
Service Definition → Provider → Consumer → Composition/Bundle
```

禁止：

- UI 直接读取文件/Secret；
- Domain 反向依赖 Web/Vite；
- Consumer 绕过服务定义直接抓具体 Provider；
- sibling package 深路径 import；
- 创建无 Consumer 的空 package；
- App 重新长出 `dev/bridges`。

公开跨 package import 使用 `@lfaa/*` exports。Package 内部深层模块优先使用 package-private imports 或局部相对路径，不跨包偷读内部文件。

## UI 归属

- `@lfaa/ui`：通用 UI Kit / Interaction primitive；
- `@lfaa/workspace`：Chat / Work 产品 Workspace；
- `@lfaa/app-shell`：Workbench / Composer / Settings / Shell；
- `@lfaa/client-web`：Web Client Composition；
- `@lfaa/ui-terminal`：Terminal Web UI。

Chat/Work 是 **Workspace Mode**，不是两个独立产品核心。

## Runtime / Model

- `@lfaa/config-system` 管配置，不等于模型运行 Provider；
- OpenAI-compatible 一次调用归 `@lfaa/llm-openai-compatible`；
- ChatGPT 套餐通过 OpenAI 官方 App Server 协议接入；官方运行组件由 LFAA 按需隔离在 `LFAA_HOME`，禁止把“用户必须全局安装 Codex CLI”重新作为产品前置条件；
- Run/Session 生命周期归 Agent Runtime/Controller；
- Codex App Server 归 `packages/harness/`；v0.1.2 已承担 ChatGPT 套餐的 managed auth + read-only text runtime；
- Tool/Skill/MCP 未实现前不要建空壳假装完成。
- Codex subscription runtime 必须按 Provider `connection.protocol` 路由，禁止再用 `credentialRef` 猜认证协议；ChatGPT OAuth Token 只能留在官方 Codex App Server。
- 审批 UI 未接入前，Codex Text Runtime 必须保持 read-only，并拒绝命令/文件修改审批请求。

## Secret

Secret 不能进入：

- 普通 JSON；
- Git；
- Plugin Manifest；
- 日志/Trace/Error body；
- argv；
- 普通环境变量；
- 模型上下文。

只通过 `@lfaa/credentials` seam 与 Native Broker Adapter 访问。

## Runtime Home

机器状态：

```text
LFAA_HOME
  state/
  plugins/
  cache/
  tmp/
  logs/
```

路径必须经 `@lfaa/home-paths` 统一解析。旧项目 `.lfaa/state` 只能作为迁移来源，不能成为新代码默认路径。

## 修改必须同步

如果修改架构/Owner/路径：

- 更新当前架构文档；
- 更新对应 package/group README；
- 更新 contract test 与 path gate；
- 更新 CHANGELOG + DEVELOPMENT_LOG；
- 更新 lockfile/workspace；
- 不通过“关闭门禁”让迁移假绿。

## 版本规范

显示版本每一段只允许 `0-99`。`0.0.99` 的下一版必须是 `0.1.0`，禁止创建 `0.0.100`。版本事实以 `lfaa.release.json` 为准，发布前必须通过 `release-consistency-check` / `version-policy` Gate。`releaseSequence` 只是独立内部序号。

## 质量命令

```text
pnpm run governance:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run quality:full
```

项目规定 Node 24.x、pnpm 11.17.0。若执行环境不满足，不得冒充完整质量验证已经通过；可以执行无需 workspace 依赖的静态门禁并明确限制。

## 文档新旧优先级

当前真相：代码 + 自动门禁 + `ARCHITECTURE.md` / `DEVELOPMENT.md` / 本文件。

`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROMPTS.md` 是历史账本。旧条目里出现 `.lfaa`、`crates/`、`apps/web/dev` 等路径时，只解释当时版本，不用于指导 v0.1.4 开发。

## TSConfig 继承边界

业务源码跨 package 仍必须走 `@lfaa/*`。`apps/*` 与 `packages/<family>/<package>` 的 `tsconfig extends` 可以像 DeepSeek Harness 一样相对指向根级 `tsconfig.base*.json`；这种 `../` 仅属于工程配置继承，不得用于业务源码跨包引用。Client 包继承 `tsconfig.base.client.json`，其余包继承 `tsconfig.base.json`。所有迁移必须通过 `scripts/tsconfig-reference-check.mjs`。
