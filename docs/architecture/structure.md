# 结构法则（Structure）

状态：**强制规范**。本文件替代口头约定：新增包、新增跨包依赖、拆界面之前先按本文判定；违反由 `pnpm check:arch` 拦下。

- 时间基线：2026-11-23。对应仓库快照：50 个包 / 23 个分组 / 717 个源文件。
- 关联：[包分类规范](package-taxonomy.md)（组与包归属）、[依赖规则清单](dependency-rules.json)（机器读的例外表）、[仓库目录说明书](repository-map.md)（自动生成的骨架）。
- 一句话：**产品 = 包树 + 代码装配（bundle）+ 可拆卸的界面贡献**；分组按能力域，不按技术层。

## 1. 与两份参考实现的关系

| 维度 | DSH（成熟产品，397 包/55 组） | 参考 lfaa（`D:\...\deepseek-harness\lfaa`，19 包） | 本项目（50 包/23 组） |
| --- | --- | --- | --- |
| 分组方式 | **按能力族分组**，包数多；权威表在 `packages/README.md` | **按技术层分组**（core/runtime/service/client 四层） | 按能力域分组（chat / core / workspace / ui / …），组名混有 api/host/bundle 这类层名 |
| 依赖约束 | 不做全局层强制；靠「扩展只依赖 Service Definition」+ 生成依赖图 | 四层 + 入口粒度 `check:deps`，跨层即失败 | 本轮前**无依赖方向门禁**；本轮新增 `check:arch`（6 条规则 + 例外表） |
| 装配 | bundle patch（`cordis.patch.yml`）+ profile 叠加 + `--dump-config` | `packages/bundle/cordis.yml` 纯数据装配，`pnpm gen` 生成 registry | 代码装配：`packages/bundle/web/src/index.ts` 手写 `ctx.plugin(...)`，`presets.ts` 维护模块表 |
| 界面位置 | 全部在 `packages/client/ui-*`（65 个 ui 包） | 全部在 `packages/client/ui-*` | **已对齐**：11 个功能界面包全部在 `packages/client/ui-*`，能力包只剩 `src/`/`contract/` |
| 可拆卸验收 | Web 快照回放（`snapshots/web`）+ e2e | `test:detach` 逐个删入口重启断言 | 本轮新增 `contribution-detach` 单测；E2E 版待下一阶段 |
| 门禁规模 | ~120 脚本 / 25 个 gate mode | `pnpm verify` 串 6 条 | `pnpm check` + lint + typecheck + test + verify:web + probe + ui:shot |

**结论：对齐「结构」也对齐「机制」，但分阶段。**

- 采用：界面与能力分家（`packages/client/ui-*` + `packages/ui/*`）、按能力域分组、可拆卸验收、依赖方向门禁、例外必须登记、生成物新鲜度。
- 已完成：界面搬迁（11 个包）全部迁入 `packages/client/ui-*`，`clientUi.legacy` 基线已清空——**新界面必须进 `packages/client/ui-*`，能力包不允许再有 `client/`**。
- 不采用：参考项目「manifest 生成全部 package.json」与 DSH 的 397 包粒度、25 个 gate mode、Host/Client 双 `ts.Program`、i18n 字数预算——成本大于收益。
- 不再保留的差异：**界面不再住在能力包里**。原因是能力包要能独立发布/复用、Host 构建面不能混入 React，而且「删界面不删能力」只有分家之后才可能做到。

## 2. 分组与层级现状（24 组）

| 类别 | 分组 | 说明 |
| --- | --- | --- |
| 接口 / 宿主 / 装配 | `api`、`host`、`bundle` | `api` = HTTP 路由与协议；`host` = 进程内托管；`bundle` = 装配叶子 |
| 内核 | `core`（19 包） | agent、llm、tools、session、memory、context、rules、fs、guard、storage、settings、metrics、jobs、subagent、browser、agent-profile、agent-group、tool-todo、system-prompt |
| 业务领域 | `chat`（3）、`workspace`（3）、`extension`（2）、`media`、`web`、`shell`、`sandbox`、`interaction` | `chat` 组内 `library`、`review` 单向依赖 `chat` |
| 功能界面 | `client`（11） | `ui-<功能>`：一个界面功能一个包，含 `src/index.ts`（Host 半）+ `client/`（浏览器半） |
| 通用界面 | `ui`（4） | layout、primitives、theme、icons；唯一允许被跨包 import `/client` 的组 |
| 单包策略组 | `attachment`、`compaction`、`feedback`、`fs`、`goal`、`guard`、`plan`、`schedule`、`session`、`spill` | 每组一个包，用于承载「一个可替换策略」 |

单包组不是错误（一个包也能是一个能力域），但**新组必须在 [包分类规范](package-taxonomy.md) 登记**，并由 `check-workspace` 的 `package-group` 规则校验。当前已知问题：组名一半是层（api/host/bundle/core/ui）、一半是域（chat/workspace），分类学不闭合；收敛计划见 §7。

## 3. 依赖规则（`pnpm check:arch` 强制）

规则与例外都写在 [dependency-rules.json](dependency-rules.json)。新增一条跨包边 = 改这个文件 + 在 PR/日志里写理由；不登记就失败。

| 规则 | 判据 | 为什么 |
| --- | --- | --- |
| `ui-cross-import` | 引用别的包的 `/client` 入口，且目标不在 `sharedUiPackages`，且未登记例外 | 界面之间直接耦合，删一块会带崩另一块 |
| `client-node-import` | `client/` 下的代码引用 `node:*` 或 `hostOnlyPackages` | 浏览器构建面不能混入 Node 专有实现 |
| `tsx-place` | 包内 `.tsx` 不在 `client/` 且不是测试 | 能力入口保持无 React，才能单独发布/复用 |
| `upward-dependency` | 组在 `upwardForbidden` 里（当前仅 `core`），却依赖了被禁止的组（chat/ui/bundle） | 内核不得反向依赖业务与界面 |
| `assembly-edge` | 引用了 `bundle/*` 却不是登记的装配点 | 装配包是叶子，能力包不得依赖它 |
| `undeclared-dependency` | 用到别的 `@lfaa/*` 包却没写进自己的 `package.json` | 依赖必须显式，否则拆包时静默断链 |
| `deep-src-import` | `@lfaa/x/y/src/*` | 只走公开入口 |
| `ui-package-required` | 带 `client/` 的包既不在 `ui`/`client` 组，也不在存量基线里 | 新界面必须进 `packages/client/ui-*`，能力包保持无 React |
| `legacy-client-grow` | 存量包的 `client/` 文件数超过 `clientUi.legacy` 基线 | 迁移期允许旧结构存在，但不许继续往能力包里加界面 |
| `bom` | 源码/配置/文档带 UTF-8 BOM（`.ps1` 例外：Windows PowerShell 5.1 需要 BOM 才能正确解码中文） | BOM 曾让启动期 `JSON.parse` 失败；反过来，去掉 `.ps1` 的 BOM 会让脚本按 ANSI 解码中文而语法崩溃 |
| `client-layout`（`pnpm check` 内） | `client/` 下区域之间成环、区域反向 import 入口、或扁平包顶层超过 10 个业务文件 | 分区后仍要有单向依赖：共用类型/常量下沉 `shared/`；扁平包超过 10 个文件就该按职责分区 |

### 3.1 包内结构：入口 + 区域 + shared

一个 `client/` 超过 10 个业务文件时，按职责分区，而不是继续平铺：

```text
packages/client/ui-tool-media/client/
├── index.tsx            入口：注册与导出，可 import 任意区域
├── css-modules.d.ts
├── media-locales.ts     文案（跨区域共享，留在顶层）
├── media/               数据与缓存：chat-media / media-library / media-thumb-cache / media-result-context
├── thumbs/              缩略图原子组件
├── library/             资料库对话框与状态
└── compose/             比例/风格选择器与生成卡片
```

规则：

- 区域之间保持单向：`compose → media`、`library → media + thumbs`，不得反向。
- 区域不得 import 入口（`index.tsx`）。
- 区域共用的类型/常量放 `shared/`，不要让 store 反向 import 组件（`ui-workspace` 的 `HoverAnchorRect` 已按此下沉）。
- 检查覆盖全部 11 个界面包；存量成环先告警，新增成环会在评审时要求拆 `shared/`。

当前基线：0 处越界、396 条跨包导入、5 条登记例外（client-ui-chat→tool-media、client-ui-chat→browser、client-ui-library→chat、client-ui-library→tool-media、client-ui-review→chat）与 1 条装配边（web-server→bundle-web）；界面待迁包 **0** 个。

## 4. 装配

- 唯一装配点：`packages/bundle/web/src/index.ts`（`webBundlePlugin`）。它按语义顺序 `ctx.plugin(...)` 挂载基础服务，再挂 Loader 与插件管理，最后用 `WIRING_PLUGIN` 做跨服务联线。
- 模块表：`packages/bundle/web/src/presets.ts` 的 `CORE_MODULES` / `OPTIONAL_MODULES` 决定「哪些包算内置、哪些交给插件页安装」。
- **已知债**：装配是代码而不是数据。加一个包要改 3 处（import、`ctx.plugin`、`Promise.all` 列表），顺序错只会表现为运行时等待或服务不可见。下一阶段目标见 §7。

## 5. 可拆卸验收

- 已有：`packages/ui/layout/tests/contribution-detach.test.tsx` —— 注册/注销视图与上下文面板后，快照只变化自己，外壳回退欢迎页不崩。
- 目标（下一阶段）：E2E 版 `verify:detach` —— 依次从装配里去掉 chat / library / review / 设置等界面贡献，启动生产宿主，断言其余界面仍在且控制台无新错误。参考项目把这一步做成 `test:detach` 常驻 CI。

## 6. 验收矩阵（改动前先看这张表）

| 命令 | 覆盖 | 何时必跑 |
| --- | --- | --- |
| `pnpm check` | 包分组、依赖声明、文件规模、主题色、插件默认导出、README 三件套、日志编号、目录说明书、**依赖方向** | 任何改动 |
| `pnpm lint` / `pnpm typecheck` | AST 规则 / 类型（含 `noUncheckedIndexedAccess`） | 任何改动 |
| `pnpm test` | 单元与集成（含贡献可拆卸） | 任何改动 |
| `pnpm verify:web` | 生产构建 + 无头浏览器壳层/资料库/审查/设置/双主题/窄屏 | 涉及界面 |
| `pnpm ui:shot` | 按任务表出图到 `shots/`（含深色、窄屏、设置中心各页），用于目视自查与交付证据 | 涉及界面 |
| `pnpm probe:boot` / `probe:loader` | 整机 Host 启动期错误、Loader 按包名装载 | 涉及装配或插件 |
| `pnpm verify:coordination` | 交接条与目标条的浏览器隔离验收 | 涉及会话协调 |

## 7. 结构债与处置顺序

1. **界面从能力包迁出**（进行中）。目标：能力包只留 `src/`/`contract/`，界面进 `packages/client/ui-*`。完成试点：`@lfaa/agent-group` → `@lfaa/client-ui-agent-group`。剩余批次：
   - 批次 A（低风险，零跨包消费）：`skills`、`sections`、`plugins`、`agent-profile` → `client-ui-skills / ui-sections / ui-plugins / ui-agents`。
   - 批次 B（有跨包 UI 消费，需要同步改例外）：`browser`、`workspace`、`tool-media`。
   - 批次 C（工作台三兄弟，依赖 chatStore）：`review`、`library`、`chat`。chat 的客户端状态（`chatStore`）先留在 `packages/client/chat-store` 这类非界面包，再把设置页与右栏工作台拆成独立界面包。
   - 每迁一个包就下调 `dependency-rules.json` 的 `clientUi.legacy` 基线。
2. **装配数据化**：把 `bundle/web` 的模块表与顺序抽成数据文件，生成挂载清单并加 `--dump-config`，让「少装一个包」变成改一行数据。
3. **单包组收敛**：`guard` / `fs` / `spill` / `plan` / `goal` / `schedule` / `feedback` / `attachment` / `session` / `interaction` 十组按「谁在用」并入 `core` 或对应领域组，减少 24 → 约 16 组的认知成本。
4. **E2E 可拆卸验收**（§5 目标）。
5. **分组语义收敛**：把 `api`/`host`/`bundle`/`client` 保留为「结构角色组」，其余按域命名，写进包分类规范。

## 8. 变更流程

- 新增包：先按 [包分类规范](package-taxonomy.md) 定组 → 建包 → 同轮 `pnpm map:sync`。
- 新增跨包依赖：先看是否已有共享位置（`ui/*`、`core` 类型、Cordis 服务）→ 确实需要就把边登记进 `dependency-rules.json` 并写理由。
- 新增界面功能：**建 `packages/client/ui-<功能>/`**（`src/index.ts` 放共享类型 + `client/` 放 React），通过 `workbench` 服务注册视图/面板；不得再往能力包里加 `client/`。
- 迁移一个存量界面包：`git mv client packages/client/ui-<功能>/client` → 新包 `package.json`（`./client` 导出）→ 能力包删 `./client` 导出与 React 依赖 → `apps/web` 改 import → `node scripts/sync-tsconfig.mjs .` → `pnpm install` → `pnpm readme:pair -- . --write` → 同轮下调基线、`map:sync`、dev-log。