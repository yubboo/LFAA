# DSH 包跨仓库复用评估

状态：调研完成，路线待负责人确认。**本轮未修改 `E:\lfaa1\deepseek-harness`，也未给 LFAA 增加跨仓库依赖**；只落地了一个纯算法切片（token 估算），并用 DSH 源码实测值对齐。

## 背景

LFAA 与 DSH 都是 Cordis 架构，但属于两个独立 workspace。负责人希望把 `E:\lfaa1\deepseek-harness\packages` 中的能力真正复用到 LFAA，而不是持续重写。本文件先给出事实、可选路线和风险，再决定是否动手。

## 调研事实（2026-11-19）

| 项 | DSH | LFAA |
|---|---|---|
| 仓库版本 | `0.2.1-rc.2`（本地源码） | `0.1.0` |
| 包管理器 | pnpm 11.28.5 | pnpm 11.17.0 |
| Node 要求 | `^22.19.0 \|\| >=24.0.0` | 本机 24.16，可用 |
| Cordis | `vendor/cordis` 4.0.5 | `@deepseek-ai/cordis` ^4.1.0 |
| 包命名 | `@deepseek-ai/dsh-*` | `@lfaa/*` |
| 依赖协议 | 包内大量 `workspace:*` / `workspace:~` | 包内 `workspace:*` |

关键发现：

1. **npm 上的版本落后于本地源码**：`npm view @deepseek-ai/dsh-token-meter version` 返回 `0.0.1-rc.1`，本地源码是 `0.2.1-rc.2`。直接 `pnpm add` 拿不到本地这套实现。
2. **包内依赖是 `workspace:*`**：把本地目录用 `file:` 挂到 LFAA 时，pnpm 无法解析这些 workspace 协议，必须先构建/改写/抽包。
3. **服务型包与 DSH 运行时强绑定**：`session/session-stats` 是 session projection 单元，`llm/token-meter` 的 service 依赖 `dsh-session`、`dsh-session-projection`、`dsh-llm` 的事件模型与 zod 4，不是独立工具库。
4. **存在可复用的纯子路径**：`@deepseek-ai/dsh-token-meter/estimate` 只有 type import，运行时无依赖。用 tsx 直接跑本地源码：

   ```text
   estimateMessage({ role: 'user', content: [{ type: 'text', text: 'hello world' }] }) → 11
   estimateToolsTokens({ tools: [read_file schema] }) → 25
   ```

5. UI 组件（`ContextMeter`、stats 弹窗）绑定 DSH 的 client/ui-primitives 与 projection hooks，不能直接搬进 LFAA 的 React 树。

## 复用层级

| 层级 | 例子 | 可行性 |
|---|---|---|
| 纯算法/公式 | token 密度估算、成本公式、统计口径 | 高：可适配后用实测值对齐 |
| 投影/服务 | session-stats、token-meter 服务、context 压力 | 低：需要接入 DSH 的 session 事件与 projection 协议 |
| UI 组件 | ContextMeter、统计弹窗 | 低：依赖 DSH client 契约与样式体系 |

## 方案对比

| 方案 | 做法 | 优点 | 风险/成本 |
|---|---|---|---|
| A. 跨仓库 workspace | LFAA 的 `pnpm-workspace.yaml` 纳入 DSH 包 | 源码级复用 | 两库 lockfile/依赖树合并；DSH 的 `workspace:*`、构建脚本与 Cordis 版本会一起进入；破坏两个仓库的独立性 |
| B. 构建后作为 npm 依赖 | DSH 发版/私服，LFAA 固定版本依赖 | 运行时干净、可缓存 | 需要 DSH 发布流程与版本承诺；本地源码当前未发布 |
| C. 抽独立共享包 | 把纯模块（如 token 估算）抽成独立包，双方依赖 | 长期最健康 | 需要修改 DSH 仓库并维护共享包发布 |
| D. Vendor 纯算法 | 复制小型纯函数到 LFAA，保留 MIT 出处 | 立即可用、零运行时耦合、可验证 | 代码重复；上游变更需手动同步 |
| E. 保持自研 | 按 DSH 口径在 LFAA 内实现 | 无跨仓库成本 | 需要持续对齐语义（本轮已做） |

## 推荐路线

1. **短期（已完成）D + E 结合**：把 `token-meter/estimate` 的固定密度口径适配进 LFAA（`packages/core/agent/src/token-estimate.ts`），并用 DSH 源码实测值 `11` 做回归对照；不引入跨仓库依赖。
2. **中期 C**：把确实可共享的纯模块（token 估算、成本公式、统计口径）抽成独立包，由 DSH 仓维护并发布；LFAA 固定版本依赖。需要 DSH 仓改动与发布权限。
3. **长期 B/A**：只有当两个产品确定要统一运行时（session 事件模型、Cordis 版本、UI 契约）时，才做 npm 依赖或 monorepo 合并；单纯“复用几个函数”不值得付出该成本。
4. **服务级复用**（session-stats、token-meter 服务、上下文压力）本质上要求 LFAA 迁移到 DSH 的 session 事件/投影模型，属于运行时架构迁移，不能用“加一个依赖”解决，需单独立项。

## LFAA 侧包设计（已落地）

参考 DSH 的拆分方式，把指标类能力从 `agent` / `chat` 中抽成独立包 `@lfaa/metrics`（`packages/core/metrics`）：

| DSH 包 | LFAA 对应 | 说明 |
|---|---|---|
| `packages/llm/token-meter`（estimate 部分） | `@lfaa/metrics` → `src/estimate.ts` | 4 字符/token、块开销、角色开销；用 DSH 源码实测 `11` 对齐 |
| `packages/llm/token-meter`（计价部分） | `@lfaa/metrics` → `src/cost.ts` | 按模型单价计算人民币成本 |
| `packages/session/session-stats`（纯聚合） | `@lfaa/metrics` → `src/session-stats.ts` | 轮次/步数/耗时/TTFT/TPS/上下文/成本聚合 |
| `packages/context/*`（压缩/上下文） | `@lfaa/context` | 已抽出 `src/context-budget.ts`（预算压缩与超限识别） |
| `packages/guard/*`（超时/安全） | `@lfaa/guard` | 已抽出命令安全拦截、审计、前台命令时限归一化与连续重复调用提醒 |
| `packages/session` | `@lfaa/session` | 已抽出会话类型、会话文件存储、标题与历史摘要 |
| `packages/fs` | `@lfaa/fs` | 已抽出工作区路径安全、私有路径过滤与文件遍历 |
| `packages/settings` | `@lfaa/settings` | 已抽出常规设置与编码（Git/代码审查）设置持久化 |
| `packages/spill`/存储相关 | `@lfaa/storage` | 已抽出资料库布局、资产存取与数据根迁移 |

`@lfaa/metrics` 不依赖 Node 或 DOM，Host（agent）与浏览器（chat）共用同一套计算与格式化函数；`agent`、`chat` 通过 workspace 依赖引用，不再各自维护重复实现。

## 本轮已完成的切片

- 新增包 `@lfaa/metrics`（`packages/core/metrics`），包含 `estimate.ts`、`cost.ts`、`session-stats.ts` 与统一入口。
- 新增包 `@lfaa/session`（`packages/core/session`）：会话类型、`SessionMemoryStore`、标题与历史摘要；`@lfaa/memory` 依赖它并继续重导出会话类型，既有导入路径不变。
- 新增包 `@lfaa/fs`（`packages/core/fs`）：`resolveSafeWorkspacePath`、私有路径过滤与 `walkWorkspaceFiles`；`@lfaa/tools` 改为依赖并保留公开重导出。
- 新增包 `@lfaa/settings`（`packages/core/settings`）：常规设置与编码设置存储；`@lfaa/chat` 改为依赖。
- 新增包 `@lfaa/storage`（`packages/core/storage`）：资料库布局、资产/产物存取与数据根迁移；`@lfaa/memory` 改为依赖并保留类型重导出。
- 新增包 `@lfaa/context`（`packages/core/context`），迁出 `context-budget.ts`（预算压缩与上下文超限识别）及其测试；`agent` 通过 workspace 依赖引用。
- `agent-loop` 的上下文构成与成本计算改为从 `@lfaa/metrics` 引入；`SessionStatsBar` 的聚合与格式化同样从该包引入。
- 原 `agent/src/cost.ts`、`agent/src/token-estimate.ts`、`chat/client/session-metrics.ts` 已删除，测试迁移到 `packages/core/metrics/tests`。
- 新增 `packages/core/agent/tests/token-estimate.test.ts` 的对等用例迁入 `metrics/tests/estimate.test.ts`，保持 `11` 的 DSH 实测对齐。

## 需要负责人确认

1. 是否继续按同一思路抽出 `@lfaa/context`（上下文压缩/预算）与 `@lfaa/guard`（命令安全/超时）？
2. 共享包发布到哪里：npm 公开、私有 registry，还是只在本仓库 workspace 内共用？
3. 是否需要把 LFAA 与 DSH 的运行时统一（session 事件模型、Cordis 版本）？

在得到上述确认前，LFAA 侧只做“包内复用 + 纯算法对齐”，不引入未发布依赖，也不改动 DSH 仓库。
