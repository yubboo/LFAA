# LFAA Runtime — v0.0.100

> v0.0.100 Sync 热修复：目录迁移后若旧 workspace root 只剩依赖/构建缓存，可安全清理；真实项目文件仍会阻止删除并交由 Gate 报告。

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

## 4. Agent text chat

```text
Composer
→ AgentRuntimeHost.startRun
→ client-connection HTTP
→ agent-controller
→ account repository
→ credential reference → Native Secret Store
→ llm-openai-compatible
→ Provider HTTP
→ AgentRuntimeEvent over HMR
→ workspace Session Controller
→ ChatMessageViewModel
```

当前 agent-controller 只保存开发态内存多轮历史，最多保留有限消息；这不是正式 Session Store。正式 Session/Event Store 后续在 Runtime 内核阶段实现。

Strong Reasoning 当前只作为 `AgentExecutionHints.reasoningBoost`，LLM Adapter 增加安全 system instruction，不制造 Provider 未声明参数。

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
