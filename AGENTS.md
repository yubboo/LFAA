# LFAA Agent / Contributor Guide — v0.1.0

本文件给 AI Agent 和开发者提供最短路径的当前约束。**先遵守当前代码与本文件，再参考历史记录。**

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
- Run/Session 生命周期归 Agent Runtime/Controller；
- Codex App Server 归 `packages/harness/`；
- Tool/Skill/MCP 未实现前不要建空壳假装完成。

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

`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROMPTS.md` 是历史账本。旧条目里出现 `.lfaa`、`crates/`、`apps/web/dev` 等路径时，只解释当时版本，不用于指导 v0.1.0 开发。
