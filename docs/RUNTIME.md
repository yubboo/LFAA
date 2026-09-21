# LFAA Runtime — v0.1.6

> v0.1.6 Interaction Runtime：Chat Agent 与 Work Agent 共用同一个 Agent Core / Session Controller / `AgentRuntimeHost`。运行中人工干预统一进入 `interveneRun`：Chat 用对话插话；Work 还可把用户编辑后的无限画布投影成 `workspaceContext`。Manual 完全不创建 Agent Run，只复用 Canvas/Terminal/已注册 Tool 基础设施。

> v0.1.4 Usage Runtime：账户配置与余额/额度分开验证。Config System 声明官方 usage discovery；Settings Host 实际请求官方端点；Client 只渲染 `AiAccountUsageSnapshot`。Codex App Server 的 usage/rate-limit 明确属于 Codex/Work，不表示标准 ChatGPT Chat 消息额度。


> v0.1.3 修复 Codex Turn 在 `turn/start` 响应前取消时的未处理 Promise 拒绝；Run 对外仍以 `AbortError` 收敛，并在获得 Turn ID 后发送 `turn/interrupt`。

> v0.1.2 Codex Runtime：ChatGPT/Codex 套餐从 managed auth + `model/list` 延伸到 `thread/start` / `turn/start` / `item/agentMessage/delta` / `turn/completed` / `turn/interrupt`。设置与 Agent Runtime 共享同一个 App Server Host；LFAA 不持有 OAuth Token。当前强制 read-only，审批 UI 未接入前拒绝写入/执行类 server request。

> v0.1.1 TSConfig 修复：Client workspace 继承根级 `tsconfig.base.client.json`，Runtime/Node/Core workspace 继承 `tsconfig.base.json`；业务源码跨 package 仍只使用 `@lfaa/*`。`tsconfig-reference-check` 在 Vite 启动前验证所有 extends。

> v0.1.0 依赖健康修复：Setup / Web 启动统一通过 `pnpm-workspace.yaml` 的全部 importer 判断 Node 依赖健康；新增依赖、workspace link 缺失、外部依赖无法真实解析或 importer lockfile 不一致都会进入菜单 1 的自动同步分支。
> v0.1.0 同批 Sync 迁移修复：目录迁移后若旧 workspace root 只剩依赖/构建缓存，可安全清理；真实项目文件仍会阻止删除并交由 Gate 报告。

## 1. 两个执行平面

浏览器平面：React Client，只拥有 UI/Workspace/浏览器连接。

Node Host 平面：Vite dev Host 当前承载本地 Controllers、PTY、文件/Secret/Provider Adapter。

两者通过本地 HTTP + Vite custom event 通信，不直接跨运行环境 import 实现。

## 2. Web Client startup

```text
apps/web/src/main.ts
→ new LfaaWebEntry(root).run()
→ packages/client/web
→ React AgentWorkbench
```

`apps/web` 不包含真实 Client 业务。

## 3. Web Host startup

```text
apps/web/vite.config.ts
→ @lfaa/bundle-web-app/vite
→ @lfaa/host-vite
→ terminal-vite
→ settings-controller
→ plugin-controller
→ agent-controller
```

Bundle 是 Host Composition Owner。

## 4. Unified Agent Run（Chat / Work 同核）

Runtime 先由 Config System 的 Provider connection 决定协议：

```text
Composer
→ AgentRuntimeHost.startRun
→ client-connection HTTP
→ agent-controller
→ AiProviderRegistry.resolveConnection
├─ openai-compatible
│   → credentialRef → Native Secret Store
│   → llm-openai-compatible → Provider HTTP
└─ codex-app-server
    → shared CodexAppServerTextRuntime
    → thread/start（按 LFAA sessionKey 复用 thread）
    → turn/start（model / cwd / effort / readOnly sandbox）
    → item/agentMessage/delta
    → assistant.delta over HMR
    → item/completed + turn/completed
    → assistant.completed

Browser cancel
→ DELETE Run
→ AbortController
→ turn/interrupt

Chat / Work 人工干预
→ AgentRuntimeHost.interveneRun
├─ Runtime 支持 steer → 原 Run 注入（如 Codex turn/steer）
└─ Runtime 不支持 steer → Host 中断旧请求并在同一 Session 续跑

Work Canvas 用户编辑
→ workspaceContext
→ 同一个 AgentRunRequest / intervention
→ 同一个 Agent Core
```

OpenAI-compatible 路径当前仍保留有限开发态内存历史；Codex 路径由官方 App Server Thread 保存多轮上下文。`assistant.completed` 是最终权威文本，Workspace 会用它覆盖同一 Run 已累积的 delta，而不是生成第二条回复。

Strong Reasoning 对 OpenAI-compatible 仍使用 `AgentExecutionHints.reasoningBoost`；Codex 模型自身的 reasoning setting 通过模型目录映射为官方 `turn/start.effort`。

当前 Codex Text Runtime 为 **read-only**：审批/权限产品 UI 尚未接线前，不允许把“请求审批/完全访问”等 UI Profile 误当成 Codex 写入授权。

## 4.1 Manual Runtime 边界

Manual 是 Client/Workbench 交互模式，不属于 `AgentWorkspaceMode`。它不解析模型、不消费 Provider quota、不启动 Agent Run；用户仍可使用 Infinite Canvas、Local Terminal 和 Runtime Registry 中真正注册的工具。未实现的 Tool 必须 disabled，禁止用假结果模拟自动化。


## 5. AI Settings

```text
AI Settings UI
→ client-connection
→ settings-controller
→ config-system service
├─ config-host-node repository/http
├─ credentials-native
└─ codex-app-server managed auth
```

浏览器不持久化 API Key。账户文件只保存 credentialRef 与非敏感配置。

## 6. Plugin runtime

```text
Plugin Settings UI
→ client-connection
→ plugin-controller
→ PluginManager / Registry
→ plugin-host-node
→ Runtime Home plugins/profile
```

安装事务必须 inspect → plan/approval → install → validate → default disabled → explicit enable；失败/取消回滚。

## 7. Terminal

```text
ui-terminal (xterm)
↕ Vite custom events
terminal-vite
↕ node-pty
local shell
```

PTY 不在 browser package 创建。

## 8. Runtime Home

`@lfaa/home-paths` 是唯一路径 Owner。当前 Host 运行状态可放：

```text
state/ai-accounts.json
state/dependency-state.json
plugins/profile/
cache/
tmp/
logs/
```

源码树中没有 Runtime Home 镜像。

## 9. Abort / errors / secret

- Browser cancel → Controller AbortController；
- Provider error body 不原样转发 UI；
- 常见 credential pattern 必须脱敏；
- Secret 只在受控 Host 内存中短暂存在；
- Host close 必须终止 running runs / managed processes。

## 10. 下一阶段

Agent Runtime 将优先从 `core/agent-runtime` 内部形成真实 session/context/loop/tool registry。只有出现多个真实 Consumer 后才把这些子模块升格成独立 packages。
