# LFAA Development Standard — v0.1.2

本文件是当前开发规范。历史版本的设计过程请看 `CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md` 和 `docs/PROMPTS.md`；历史内容不得覆盖本文件。

## 1. 开发目标

LFAA 不是“一个 React App 加若干工具函数”，而是一个 packages-first Agent Harness 产品。新增代码必须有明确 Owner，并保持 App、能力、Host、Native 之间的边界。

## 2. 环境

- Node.js：24.x
- pnpm：11.17.0
- Rust：`rust-toolchain.toml`
- Package manager：仅 pnpm

Windows 优先使用 `LFAA-Setup.bat`。Setup 依赖检测以 `pnpm-workspace.yaml` 声明的全部 workspace importer 为范围，以真实安装/解析 + importer 级 lockfile 覆盖为准；dependency-state 只用于显示依赖声明差异和加速基线，不能决定“已就绪”。菜单 1 被用户选择后，如检测到真实缺依赖，会自动同步当前声明的 Node 依赖。

## 3. 仓库规则

```text
apps/        只启动产品
packages/    所有 TS 业务/Harness 能力
native/      Rust Native primitive
scripts/     开发与发布工具
test/        跨包契约与架构测试
docs/        长期文档/历史记录
```

### 3.1 `apps/`

App 不拥有业务。`apps/web` 当前只保留：

- `src/main.ts`
- `vite.config.ts`
- build/type config
- HTML/README/tests（如有）

禁止重新添加 `apps/web/dev/bridges`、`host-clients`、Terminal implementation、Provider implementation。

### 3.2 `packages/`

物理结构使用：

```text
packages/<capability-family>/<package>/
```

新增 family 需要长期独立领域，不是为了分类一个文件。新增 package 必须同时满足：

1. 有真实实现；
2. 有当前 Consumer；
3. 有清晰 Owner/生命周期；
4. 拆包能减少错误依赖或提供独立替换点。

否则先作为现有 package 内子模块成长。

### 3.3 `native/`

普通业务默认 TypeScript。Rust 只用于 Secret/OS/Security/性能上确实需要的 native primitive。禁止复制 Agent、Provider、Session、Workspace 业务到 Rust。

## 4. Capability family 当前职责

- `api`：本地 Host controller / protocol boundary；
- `bundle`：把一组 Host capability 装成产品；
- `client`：浏览器/产品 Client；
- `core`：Agent Runtime 核心稳定契约；
- `credentials`：Secret service seam；
- `harness`：官方外部 Harness adapter；
- `host`：Vite 等 Host technology adapter；
- `llm`：实际模型协议 adapter；
- `plugin`：Plugin contracts/runtime/host；
- `settings`：配置 Domain 与 Host provider；
- `terminal`：本地 PTY/Terminal host；
- `util`：真正跨能力的基础 seam。

每个 family 根应有 README，说明“负责/不负责/演进条件”。

## 5. Service / Provider / Consumer / Composition

必须优先使用：

```text
Service Definition
      ↓
Provider
      ↓
Consumer
      ↓
Composition / Bundle
```

不要让：

- Domain 认识 Vite；
- UI 认识 node:fs / node-pty；
- Plugin Runtime 认识 pnpm CLI 细节；
- Agent Controller 自己实现所有 Provider 协议；
- App 直接 import 每个 Host Adapter。

## 6. Package layer

`package.json#lfaa.layer` 是机器依赖门禁，不取代 capability family：

- `foundation`
- `runtime`
- `domain`
- `presentation`
- `composition`
- `host-adapter`
- `host`
- `bundle`
- `app`

改 layer 前必须检查 `scripts/package-architecture-check.mjs`，不能为绕过错误依赖随便提高层级。

## 7. Web 架构

浏览器侧：

```text
apps/web/src/main.ts
  → @lfaa/client-web
  → @lfaa/app-shell
  → @lfaa/workspace / @lfaa/ui
```

Host 侧：

```text
apps/web/vite.config.ts
  → @lfaa/bundle-web-app
  → @lfaa/host-vite + Controllers
```

Browser ↔ Host 只通过协议/事件通信。浏览器包不得 import Node Host/Secret/PTy 实现。

## 8. Workspace / UI

正式术语：Workspace → Chat Mode / Work Mode。

- Session/Run 共用逻辑：`packages/client/workspace/src/shared/logic/`
- Chat：`workspace/src/chat/`
- Work/Canvas 产品布局：`workspace/src/work/`
- 通用 Pointer/Zoom/Overlay/Resize/Effect：`client/ui`
- Product Shell/Composer/Settings：`client/app-shell`

UI Kit 不应吸收产品业务，只因“它是 TSX”并不意味着应该放 UI Kit。

模块内部按需要使用：

```text
view/
logic/
styles/
contracts/
index.ts
```

不需要的目录不要建空壳。

## 9. Model / Config / Runtime

`@lfaa/config-system`：账户、Provider metadata、模型能力、设置 schema。

`@lfaa/llm-openai-compatible`：一次 Provider runtime call。

`@lfaa/agent-controller`：开发 Host Run 生命周期/HTTP/HMR/内存多轮会话。

这些 Owner 不可合并成一个“AI bridge”。

Strong reasoning 当前是执行 Hint：由 Agent Request 表达，由 LLM Adapter转为安全的 system instruction；不得伪造 Provider 没声明的 `reasoning_effort` 字段。

## 10. Plugin

- Contract：`plugin-sdk`
- Generation/lifecycle：`plugin-runtime`
- Inspect/install/rollback：`plugin-host-node`
- Web API：`api/plugin-controller`
- UI：App Shell Settings

用户插件依赖安装到 Runtime Home 中的独立 Profile，不进入仓库根 `package.json` / `pnpm-lock.yaml`。新插件默认 disabled，install transaction 必须可回滚，build script 需精确审批。

## 11. Credential / Secret

Secret 统一走 `@lfaa/credentials`；Windows Native 实现经 Rust broker。

禁止明文进入：普通状态文件、Git、日志、错误、argv、普通 env、Plugin Manifest、Agent context。

账户状态只保存 `credentialRef`。

## 12. Runtime Home

仓库不创建 `.lfaa/`。

运行状态路径只通过 `@lfaa/home-paths`：

```text
LFAA_HOME env
Windows: %LOCALAPPDATA%\LFAA
macOS: ~/Library/Application Support/LFAA
Linux: $XDG_DATA_HOME/lfaa or ~/.local/share/lfaa
```

旧 `<project>/.lfaa/state` 允许在同步/首次读取时迁移，但新代码不得继续写入。

## 13. Imports

- 跨 package：使用公开 `@lfaa/*` export；
- package 内：局部相对 import 或经过审核的 `imports` alias；
- 禁止跨 package `../../other-package/src/...`；
- Node/Vite 直接执行链必须遵守现有 runtime import gate。

## 14. 注释与可读性

承载核心交互、桥接、脚本的文件使用结构化中文头：

```text
文件：
作用：
负责：
不负责：
状态归属：
对外接口：
关联文件：
修改注意事项：
```

复杂 CSS 按现有分区规则维护。新增关键文件要加入 `comment-check` 或定义稳定自动规则。

## 15. 测试与门禁

架构修改不能通过删除测试/关闭 Gate 获得“通过”。至少执行：

```bash
pnpm run governance:check
pnpm run typecheck
pnpm run test
pnpm run build
```

发布使用 `quality:full` + Rust release check。

在缺少 Node24/pnpm/node_modules 的制作容器里，只能声明实际完成的 Node 静态/contract gate，不能声称全量 typecheck/build 已通过。

## 16. 文档规范

架构修改同时更新：

- README / AGENTS / ARCHITECTURE / DEVELOPMENT
- `docs/项目结构与代码地图.md`
- MODULES / RUNTIME / UI / TESTING / RELEASES 中相关事实
- capability family/package README
- CHANGELOG + DEVELOPMENT_LOG

`docs/PROMPTS.md` 记录需求/Prompt 生命周期，不作为当前架构 API。

## 17. 新旧文档原则

新文档事实优先。历史文档允许保留旧路径来说明当时发生了什么，但必须在顶部标注历史属性；不要把历史路径全局替换成新路径，从而伪造过去。

## 18. Release / Sync

### 18.1 版本进位规则

LFAA 显示版本固定为 `major.minor.patch`，每一段只能是 `0-99`。patch 到 99 后必须向 minor 进位；minor 与 patch 同时到 99 后向 major 进位：

```text
0.0.98 → 0.0.99
0.0.99 → 0.1.0
0.1.99 → 0.2.0
0.99.99 → 1.0.0
```

因此 `0.0.100`、`0.100.0` 都是非法版本。`scripts/version-policy.mjs` 与 release consistency Gate 必须阻止此类版本进入发布包。`releaseSequence` 是独立内部序号，不参与显示版本进位。

### 18.2 Release / Sync 规则

- `lfaa.release.json` 是版本元数据 Owner；
- package/Cargo 版本与其保持一致；
- Unicode ZIP 由 `scripts/release-archive.mjs` 产生并反向验证；
- Sync 先 source preflight，再生成 diff；
- v0.0.99 起，Sync 在删除旧项目 `.lfaa` 前只迁移已知本机运行状态，不保留旧目录作为新架构资源根。

## TypeScript 工程配置继承规则

LFAA 区分“业务源码依赖”和“仓库工程配置继承”：

- 跨 package 业务源码必须通过公开 `@lfaa/*` API；禁止 `../../other-package/src`、`../../../other-package/src` 形式的跨包源码引用。
- package 内部允许短距离 `./` / `../` 相对 import。
- `apps/*/tsconfig.json` 允许使用 `../../tsconfig.base*.json` 继承仓库根配置。
- `packages/<family>/<package>/tsconfig.json` 允许使用 `../../../tsconfig.base*.json` 继承仓库根配置；这里的 `../` 只表达 Monorepo 工程配置 Owner，不属于业务依赖。
- Client/React/DOM workspace 统一继承 `tsconfig.base.client.json`；Runtime/Node/Core workspace 继承 `tsconfig.base.json`。
- 禁止恢复仅 TypeScript 可见、但 Vite/Node 未共同解析的私有 `@/*` paths alias。跨 package 的稳定别名只使用真实 workspace package 名 `@lfaa/*`。
- `scripts/tsconfig-reference-check.mjs` 是该规则的机器 Gate；目录迁移后必须先通过它，再允许进入 Vite/TypeScript 启动链。



## Codex Runtime 开发规则（v0.1.2）

1. ChatGPT/Codex 套餐认证只通过官方 App Server RPC；禁止读取/复制 OAuth Token 或 Codex 私有认证文件。
2. Agent Controller 必须按 `AiProviderRegistry.resolveConnection(...).protocol` 路由 Runtime，不能用 `credentialRef` 是否存在来猜协议。
3. `thread/start` / `turn/start` / delta / completed / interrupt 属于 `@lfaa/codex-app-server`；Controller 只转换 LFAA Run/Event。
4. `assistant.delta` 是增量投影，`assistant.completed` 是最终权威文本。
5. 审批 UI 未完成前 Codex Text Runtime 固定 read-only；命令、文件改写、权限提升、MCP elicitation 的 server request 必须安全拒绝。
6. 新增 Codex RPC 生命周期必须补 Fake Client 行为测试；不能只增加静态字符串断言。
