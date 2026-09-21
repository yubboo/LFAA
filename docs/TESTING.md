# LFAA Testing & Gates — v0.1.7

## v0.1.7 Provider 可靠性回归

必须覆盖：

1. OpenAI-compatible Chat Completions SSE 会逐 delta 回调并收敛最终文本；
2. OpenAI Responses `response.output_text.delta` 走同一 Runtime Event 合同；
3. Probe 成功后 Save 可复用 Verified Probe，不重复访问官方模型目录；
4. Usage 失败/超时进入 error 终态，不永久显示 loading；
5. ChatGPT 套餐产品路径不要求全局 Codex CLI；Windows 官方 App Server 固定资产来源/SHA-256 受合同测试约束；
6. 左侧 Mode Popover 不被 Pane overflow 裁切；
7. Windows Secret Broker 启动后预热不能阻塞 Host，真实保存仍保留失败重试；
8. ChatGPT 套餐首次登录在准备官方组件期间必须立即给出可见状态，并只跳转 OpenAI / ChatGPT 官方 HTTPS 登录地址。


## v0.1.6 三模式与 OpenAI 官方 Runtime 回归

- `test/workspace-mode-unification.test.mjs`：锁定 Chat/Work 同一个 Agent Core、统一干预、Manual 无模型边界和 Work Canvas 上下文回流。
- `test/ai-web-host.test.mjs`：锁定 ChatGPT 套餐使用 LFAA_HOME 中的 OpenAI 官方 daemon runtime，禁止恢复全局 `codex`/PATH 前置。
- 真实 ChatGPT 套餐 OAuth 与官方 runtime 下载/启动仍需要用户 Windows 环境验收；静态/Fake Client 测试不能冒充真实账户 E2E。


## v0.1.6 单核三模式回归

- `workspace-mode-unification.test.mjs` 锁定 Chat/Work 只有一套 Agent Core / startRun / interveneRun；
- Manual 必须存在于 Client Workspace Mode，但禁止进入 `AgentWorkspaceMode` / `AgentRunRequest`；
- Work Canvas 人工编辑必须生成 `workspaceContext` 回到同一 Agent Core，Agent 输出必须能回投画布；
- Chat 运行中插话必须走同一 `interveneRun`，支持 native steer 的 Runtime 不创建第二套聊天引擎；
- Manual 可无模型进入并复用 InfiniteCanvas/Terminal；未注册 Review/Browser/File Tool 必须 disabled，不得伪造可用；
- 当前 Provider Usage 回归继续要求“官方有则真实显示、官方无则明确未知/未提供”，禁止 LFAA 推算额度。

## v0.1.4 官方 Usage / 模式导航回归

- Config System 纯函数测试锁定 DeepSeek `/user/balance` 与 Model Studio `/api/v1/quotas` 字段映射；
- 静态契约锁定 Codex `account/rateLimits/read` / `account/usage/read`、Settings usage route 与 UI “官方未提供”语义；
- Work 模式必须拥有工作区/任务与运行/文件/终端/变更与审查导航，Chat 模式保持新建对话/工具与技能/知识库。
- 禁止任何 `Math.random`、价格换算或本地 token 推算被用于余额/额度展示。


## v0.1.3 质量门禁修复回归

- `quality:full` 必须真实经过 Web/Config TypeScript、全仓 Node 测试与 Vite 生产构建；Bundle 可选端口满足 `exactOptionalPropertyTypes`。
- `node-source-runtime` 从 `apps/web` 这个真实 Consumer 加载 `@lfaa/bundle-web-app/vite`，覆盖 Host Bundle 的 Node source 依赖链。
- Codex Fake Client 延迟 `turn/start` 响应时取消 Run：不得产生未处理 Promise 拒绝，最终以 `AbortError` 结束，并在获得 Turn ID 后发出 `turn/interrupt`。
- 发布前执行 Rust check/test、Web 开发启动和归档 fresh extract preflight。
- 本次复测：`pnpm run quality:full` 全链通过（Codex 行为 3/3）、Rust 2/2 通过；Web 开发入口返回 200；Unicode ZIP 745 entries 且 fresh extract preflight 全 Gate PASS。


## v0.1.2 Codex App Server Chat Runtime 回归

本版新增 `test/codex-app-server-runtime.test.mjs`，用 Fake Client 执行真正的 Runtime 状态机而不是只做源码字符串断言，锁定：

1. 一个 LFAA sessionKey 只创建一个 Codex Thread，多轮 Turn 复用 thread；
2. `turn/start` 使用当前 model 与官方 `effort`；
3. `item/agentMessage/delta` 按顺序流入 Chat；
4. `item/completed` / `turn/completed` 收敛最终文本；
5. AbortSignal 必须转成 `turn/interrupt`；
6. Codex 套餐分支不得要求 `credentialRef` 或读取 LFAA Secret；
7. Web Bundle 必须让设置页 managed auth 与 Agent text runtime 共享一个 Codex Host；
8. 当前 Text Runtime 必须保持 read-only，审批 server request 默认拒绝。

真实 Codex CLI + ChatGPT 账户仍需要在用户 Node 24 / Windows 开发环境做运行验收；制作环境若没有 `codex` 命令，不得把 Fake Client 测试冒充真实账户 E2E。

## v0.1.1 TSConfig / Vite 启动回归

本版必须锁定：

1. `apps/*/tsconfig.json` 的根级 Client 配置继承能真实解析；
2. `packages/client/*/tsconfig.json` 统一继承 `../../../tsconfig.base.client.json`；
3. 其他两层 capability package 统一继承 `../../../tsconfig.base.json`；
4. 目录迁移后旧 `../../tsconfig.base.json` 必须由 Gate 直接失败；
5. 不允许恢复仅 TypeScript 可见的 `@/*` 私有 paths alias；
6. 业务源码跨 package 仍只能通过公开 `@lfaa/*` API。

对应测试：`test/tsconfig-reference.test.mjs`；静态 Gate：`scripts/tsconfig-reference-check.mjs`。

本版 AI 验证：仓库级合同 172/172 PASS；Config System 39/39 PASS；当前 10 个 workspace tsconfig 通过 `tsc --showConfig`。制作环境 Node 22 使用实验性 type stripping 执行 TS package tests；用户标准环境仍以 Node 24 / pnpm 11.17.0 为最终运行环境。

## v0.1.0 Workspace 依赖健康回归

依赖检测必须覆盖 `pnpm-workspace.yaml` 声明的所有 importer，而不是写死 `packages/<name>` 旧拓扑。当前仓库应识别 25 个 workspace package.json。重点回归：

1. capability-family 两层 package 必须被发现；
2. 某个深层 package 新增外部依赖但 importer node_modules 未同步时必须失败；
3. package.json 已新增依赖、但对应 `pnpm-lock.yaml#importers/<same importer>` 未记录时必须失败；
4. workspace:* 直接链接缺失/指向错误 Owner 必须失败；
5. 外部包 package.json 残留但 runtime entry 删除时必须失败；
6. Web 启动必须复用统一 readiness，不得重新写死 xterm/node-pty 的旧 App 所有权。

对应测试：`test/node-dependency-health.test.mjs`、`test/dependency-setup.test.mjs`。

## v0.1.0 版本进位回归

版本 Gate 必须锁定：

- `0.0.99 → 0.1.0`；
- `0.1.99 → 0.2.0`；
- `0.99.99 → 1.0.0`；
- `0.0.100` / `0.100.0` 必须失败。

对应测试：`test/version-policy.test.mjs`。

## 原则

架构重构必须靠现有测试护航，不能先关 Gate 再宣称迁移成功。

## 主要层级

### Governance/static gates

```text
governance-check
import-path-check
runtime-import-resolution-check
folder-boundary-check
language-ownership-check
tsconfig-reference-check
package-architecture-check
dev-log-check
docs-check
current-fact-check
comment-check
windows-script-encoding-check
release-consistency-check
prompt-lifecycle-check
config-schema-check
release-gates-check
ui-contract-check
```

### Contract tests

仓库 `test/*.test.mjs` 锁定：

- Workspace/App Shell/UI 边界；
- Web App 薄入口；
- Config/Secret/Provider；
- Plugin platform；
- Runtime import；
- Agent chat runtime；
- Windows dependency/setup/sync；
- Unicode release archive；
- motion/resize/snap 等 UI 契约。

### Package tests

例如 `@lfaa/config-system` 自身测试。

### Type/build

```text
pnpm run typecheck
pnpm run build
```

发布目标：`pnpm run quality:full` + Rust release checks。

## v0.1.0 必须锁住的契约

本热修复新增 Sync 契约：当旧 workspace Owner 已从源码退役、目录中只剩 `node_modules` / `target` / `dist` / `.cache` 等本地缓存时，同步必须能够安全清理该退役目录；如果仍有真实项目文件，则不得静默删除。


1. `apps/web` 没有 `dev/bridges`、`host-clients`、Terminal business；
2. App 只依赖 `@lfaa/client-web` / `@lfaa/bundle-web-app`；
3. workspace 使用 `packages/*/*`；
4. 根 `.lfaa` 不存在；
5. Runtime state 使用 LFAA_HOME；
6. Native workspace 使用 `native/*`；
7. `@lfaa/*` 稳定包名仍可被依赖图解析；
8. LLM Provider HTTP 不回流 Agent Controller/App；
9. release ZIP 保持中文路径 UTF-8 flag。

## 环境声明

本仓库要求 Node 24/pnpm 11.17.0。若某交付制作环境只有 Node 22 且无可用 pnpm/node_modules：

- 可以运行纯 Node built-in 静态 Gate/contract tests；
- 不得声称 workspace TypeScript typecheck/build 已完成；
- 应在用户正常 Setup 环境再次执行 `quality:full`。

## 修改测试的原则

路径迁移时应把旧测试改成**新架构长期契约**，而不是简单删除断言。例如“`.lfaa` 必须存在”应改成“repo `.lfaa` 必须不存在且旧 state 迁移到 LFAA_HOME”。
