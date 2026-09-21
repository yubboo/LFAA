# LFAA Releases — current policy v0.1.5

## v0.1.5 — #22.12 Codex Windows Host 启动与诊断修复

- Windows Codex App Server 改为显式 `cmd.exe /d /s /v:off /c codex app-server`，不再使用触发 Node 24 `DEP0190` 的 `shell + args`。
- 启动前验证 `where.exe codex`；失败时返回受限、脱敏 stderr，便于区分 PATH、CLI 版本、App Server 自身错误。
- v0.1.4 官方 Usage / Chat-Work 语义保持不变。
- 状态：`pending-user-acceptance`；AI 验证 `pass`；真实 Windows Codex CLI 端到端待用户验收。


## v0.1.4 — #22.11 官方余额额度与 Chat/Work 模式边界

- 新增统一 `AiAccountUsageSnapshot`；Provider 只能接官方余额/额度/usage/rate-limit 数据。
- ChatGPT 套餐使用 Codex App Server `account/rateLimits/read` / `account/usage/read`，只标记为 Codex/Work，不冒充标准 ChatGPT Chat 额度。
- DeepSeek 接官方 `/user/balance`；阿里云在具备 Workspace ID 时接官方 `/api/v1/quotas`。
- 官方未提供稳定普通账户接口的 Provider 明确显示“官方未提供”，禁止估算。
- Chat/Work 左侧导航按模式分流。
- 状态：`pending-user-acceptance`；真实 Provider 端到端额度值仍由用户实机账户验收。


## v0.1.3 — #22.10 全量质量门禁与 Codex 取消竞态修复

- 修复 Web TypeScript 严格可选参数错误、旧 Node source importer 测试与 Codex 提前取消的未处理拒绝。
- 发布验证：`pnpm run quality:full` 全链通过；Rust check/test 通过（2/2）；Web 开发入口 200；Unicode ZIP 745 entries，fresh extract `workspace-preflight` 全 Gate PASS。
- 状态：`pending-user-acceptance`；AI 验证 `pass`；用户验收 `pending`。

## v0.1.2 — Codex App Server Chat Runtime

- ChatGPT/Codex 套餐不再停在登录与 `model/list`，新增官方 `thread/start` / `turn/start` 文本 Runtime；
- 支持 `item/agentMessage/delta` 流式回复、最终 `assistant.completed` 与 `turn/interrupt` 取消；
- `agent-controller` 按 Provider `connection.protocol` 路由，不再通过 `credentialRef` 猜协议；
- 设置页 Managed Auth 与 Chat Runtime 共享一个 `CodexAppServerHost`；
- LFAA 不读取/保存 Codex OAuth Token；审批 UI 未接入前强制 read-only 并拒绝写入/执行类 server request；
- 新增 Codex Runtime 行为回归测试，并更新 Chat streaming contract。
- AI 验证：仓库级 Node 合同测试 175/175 PASS；Config System 39/39 PASS；Codex Runtime 行为测试 2/2 PASS；统一静态治理 / workspace preflight PASS；真实 Windows Codex CLI + ChatGPT 账户端到端保留给用户验收。

**当前任务：#22.9 · ChatGPT/Codex 套餐 Text Runtime · v0.1.2 · pending-user-acceptance · AI=pass · 用户验收=pending**

## v0.1.1 — TSConfig 根配置继承 / Vite 启动修复

- 修复 capability-family 迁移后的 tsconfig extends 深度错误；
- 新增 `tsconfig.base.client.json` 作为 Client 工程配置 Owner；
- 移除无运行时共同解析支持的 `@/*` 私有 paths alias；
- 新增 `tsconfig-reference-check` 并接入 governance / workspace preflight；
- 业务源码跨 package 仍只允许 `@lfaa/*` 公共 API。

**当前任务：#21.29 · TSConfig / Vite 启动修复 · v0.1.1 · pending-user-acceptance · AI=pass · 用户验收=pending**

### v0.1.0 — Harness 架构收口 / Sync 与依赖健康修复


- 承接 v0.0.99 的 capability-family / packages-first / thin-app / Runtime Home / native 架构；
- 修复退役 workspace 只剩 `node_modules` / `target` 等缓存时 Sync 无法清理、`current-fact` 误判旧 Owner 回流的问题；
- 修复依赖健康检查仍只扫描旧单层 `packages/*`，导致“workspace 25，但只真实解析 10/10”的假健康；
- 当前扫描以 `pnpm-workspace.yaml` 为唯一 workspace 来源，当前仓库共 25 个 importer；
- lockfile 检查升级为 importer + section + specifier 精确覆盖；
- 菜单 1 在真实缺依赖时自动执行 `pnpm install`，Web 启动复用同一 readiness；
- 新增版本策略 Gate，禁止 `0.0.100` 这类非法显示版本。

**当前任务：#20.20 + #21.28 hotfix · v0.1.0 · pending-user-acceptance · AI=pass · 用户验收=pending**

> **版本纠正：** LFAA 版本每一段都限制为 `0-99`。因此 `v0.0.99` 后必须进入 `v0.1.0`。此前生成的 `v0.0.100` / `v0.0.101` 为误标构建，不属于正式发布序列；对应修复统一纳入 v0.1.0。

## 当前版本

```text
displayVersion: 0.1.5
releaseSequence: 103
architectureVersion: 5
```

`lfaa.release.json` 是版本元数据 Owner。根 package、workspace packages 和 Native crate 版本必须保持一致。`releaseSequence` 是独立内部发布序号，不等于 displayVersion 的 patch 位。

## 版本进位规范

LFAA 使用三段显示版本 `major.minor.patch`，但项目约定每一段都只允许 `0-99`：

```text
0.0.98 → 0.0.99
0.0.99 → 0.1.0
0.1.99 → 0.2.0
0.99.99 → 1.0.0
```

禁止：

```text
0.0.100
0.100.0
```

`scripts/version-policy.mjs` 与 `release-consistency-check.mjs` 负责机器校验；开发者不得手工绕过该 Gate。

## Release gates

正式发布环境：

```bash
pnpm run release:environment
pnpm install --frozen-lockfile
pnpm run release:verify
```

其中 release verify 包含完整质量与 Rust 检查。

## Archive

使用：

```bash
pnpm run release:archive
```

归档器显式处理 Unicode ZIP entry，并在生成后反向解析 Central Directory 验证 canonical 中文路径的 UTF-8 bit。

源码包不应包含：

- `node_modules`
- `dist`
- `target`
- 本机 Runtime Home
- repo `.lfaa`
- 临时/缓存文件

## Workspace Sync

Sync 原则：

1. 验证来源包版本与结构；
2. source preflight；
3. 生成差异；
4. 用户确认；
5. v0.0.99 前旧 `.lfaa/state` 已知运行数据先迁移到 LFAA_HOME；
6. 镜像源码；
7. 再运行治理/路径检查。

`pnpm-lock.yaml` 的保护只允许在依赖声明指纹证明未变化时发生，不能把旧 lockfile 无条件覆盖新架构。

## 历史

更早版本的详细发布过程保留在根 `CHANGELOG.md` 与 `docs/DEVELOPMENT_LOG.md`。其中关于 `.lfaa` 保留、旧 `crates/`、旧 Web bridge 的内容只属于对应历史版本。
