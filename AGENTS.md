# AGENTS.md — AI Agent 新项目强制开发规则

> 本文件用于新项目根目录。详细条款请阅读 `docs/standards/AI-Agent-Development-Standards.md`。本文件与完整规范冲突时，按照当前负责人指令与已批准架构决策处理，不能静默忽略。

## 1. 基础技术栈

- 使用 TypeScript + React（TS/TSX）+ CSS Modules + pnpm Monorepo + Cordis 插件机制。
- 主包位于 `packages/<group>/<package>`（`pnpm-workspace.yaml` 含 `packages/*/*`）。
- **包必须先分类再创建**：新增包必须落在已登记分组（`api` / `bundle` / `core` / `host` / `ui` / `workspace` / `shell` / `util` / `test-support` 等），完整职责与决策流程见 [包分类规范](docs/architecture/package-taxonomy.md)。禁止在 `packages/` 根目录建散包，禁止东放西放；接口边界进 `api/`，装配进 `bundle/`，内核进 `core/`。`pnpm check` 的 `package-group` 规则会拒绝未登记分组。
- `apps/` 只负责启动、平台适配和插件装配；主要业务核心在 `packages/`。
- **装配必须下沉到包**：`apps/` 禁止自建服务端装配文件（如 `server.ts`）与 HTTP 路由注册；服务实现放 `packages/host/*`，装配组合放 `packages/bundle/*`，`apps/web` 只保留前端资源。`apps/` 只允许导入 `@lfaa/*/client` 或显式 boot 包（`@lfaa/web-server`），由 `pnpm check` 的 `app-host-import` 规则强制。
- 项目按需保留 `docs/`、`native/`、`patches/`、`scripts/`、`vendor/`；不得创建无用途的空壳包。
- 参考 DeepSeek Harness 架构，但不是旧项目的延续，不得导入此前项目专用逻辑与目录名。

## 1.1 项目本地 Skill 约定

- 项目本地 UI 与工程审美技能安装在 `.agent/skills/`（含 `impeccable`、`frontend-design`、`design-taste-frontend`、`antfu`）。
- 每次启动或开展前端界面、响应式布局与组件工程任务前，须先查阅 `.agent/skills/` 对应 `SKILL.md` 及参考文档，确保视觉层次、多端适配（桌面 / 平板 / 手机）与代码品味一致。

## 2. 功能与 UI 同包

- 功能包只在需要 UI 时创建自己的 `client/`，如 `packages/workspace/workspace/client/`。
- 同包 `src/` 作为 Host/领域入口，`client/` 作为浏览器入口；用公开 contract、RPC/事件沟通。
- Host 代码禁止导入 React、DOM、CSS；Client 代码禁止导入 Node 专有实现、凭据或 Host 内部模块。
- 共享基础 UI 独立放在 `packages/ui/primitives`、`packages/ui/theme`、`packages/ui/slots` 等真正通用包。
- 每个插件应具有明确 Service 定义、`inject`、公开导出和生命周期清理；禁止跨包深层导入和循环依赖。
- **插件包必须默认导出插件本体**：Host 侧 `src/index.ts` 需 `export default xxxPlugin`。Cordis Loader 按 `default` 取插件，只有具名导出会导致「装得上但拿不到插件」；`pnpm check` 的 `plugin-default-export` 规则会强制这一条。

## 2.1 首版主界面布局约定

- 当前 Web 采用负责人确认的四栏可折叠 Shell，顺序固定：**左一图标菜单栏 → 左二功能菜单栏（支持展开/收起） → 中间主工作区 → 右侧菜单栏（支持展开/收起）**。不让各插件构建独立的整页骨架。
- Shell 放在 `packages/ui/layout/`，由 `apps/` 装配启动；各插件的具体 UI 位于本包 `client/`，通过 Cordis `workbench` 服务契约贡献导航、主视图和右侧上下文面板，不直接改别的包的 DOM / React State。
- 左一切换驱动左二与工作区更新；同一导航状态应有唯一所有者，禁止各栏独立维护互相冲突的选中状态。
- Shell 负责宽度、展开/收起、滚动、焦点和窗口适配；中间工作区优先保留可用空间。**未经交互设计确认，不编造固定宽度比例。**
- 插件卸载/热重载必须清理其布局贡献；窄屏时仍适配同一四栏契约，不创建第二套脱离 Shell 的界面。
- 本约定与 `docs/standards/AI-Agent-Development-Standards.md` §3.3 的四栏方案保持一致。

## 2.2 浅色/深色双主题与 CSS 变量规范（强制）

- **项目代码严禁写死颜色。** 组件样式只允许消费 `@lfaa/ui-theme` 语义变量（定义在 `@lfaa/ui-theme` 的 `client/tokens.css`，浅色/深色成对）：`--color-shell`/`--color-rail`/`--color-panel`/`--color-topbar`/`--color-surface`/`--color-popover`/`--color-active`/`--color-line`/`--color-ink`/`--color-muted`/`--color-accent`(`-rgb`)/`--color-success*`/`--color-warning*`/`--color-danger*`/`--color-info*`/`--color-link`(`-hover`)/`--color-violet*`/`--color-orange*`/`--color-teal*`/`--color-activity-positive*`/`--color-activity-negative*`/`--color-code-bg*`/`--color-code-ink`/`--color-code-muted`/`--color-on-accent`/`--color-scrim` 等；禁止直接写十六进制、`rgb()`、`hsl()`，也禁止 `var(--x, #固定色)` 回退。
- **规则由 `pnpm check` 的 `css-theme-literal` 强制**：只读 `client/**` 样式；阴影/滤镜/玻璃材质与 α ≤ 0.2 的半透明叠层自动放行；允许写具体色值的文件只有变量定义层（`@lfaa/ui-theme/client/tokens.css`）、代码高亮调色板、主题预览样张，登记在 `scripts/check-allowlist.json` 且只减不增。新增状态色必须在浅色与深色块成对定义并保证正文对比度 ≥ 4.5:1，组件里不再写 `:global(:root[data-resolved-theme="light"])` 颜色覆盖。
- **状态色与玻璃态双端适配**：若语义色（如增删绿/红、错误红）或半透明边框在浅色/深色下对比度不足，必须回到 `@lfaa/ui-theme` 的 `tokens.css` 成对修正变量值，而不是在组件里加浅色覆盖。
- **双主题实测验收**：涉及 Web UI 的每次修改，交付前须同时在**深色与浅色主题**下目视/实测确认文字对比度、弹窗、输入框及悬浮层均正常。

## 2.3 活动行对齐（强制）

- 同级活动行的类型图标和左侧标签须对齐。命令运行时，圆环和「进行中」紧跟类型图标，与文件行的「已编辑」使用同一左侧起点。命令成功后在右侧展开箭头前显示勾，失败显示对应错误状态。
- 长命令优先截断正文，保证状态和展开控件可见。验收须检查同级对齐及运行到结束的切换，详见开发规范 §3.5。

## 3. `-`、`_`、`.` 命名、本地化与中文注释

- **先按文件类别选择符号，而不是全仓库一刀切**：`-` 分隔人可读的功能词，`_` 用于明确的数据/素材/原生/外部约定，`.` 表示文件角色、语言和扩展名。
- `-`：包和目录用小写 `kebab-case`，如 `ui-primitives/`；React 组件文件按负责人要求首字母大写，如 `Ai-Work.tsx`；手写服务用 `workspace-service.ts`；脚本用 `verify-package-exports.ts`。
- `_`：结构化测试夹具 `workspace_invalid_path.fixture.json`、同类素材 `workspace_empty_state.svg`、原生接口 `window_bridge.cpp`；仅在所在目录确认统一风格后采用。不得把 `Ai-Work.tsx` 混写为 `Ai_Work.tsx`。
- `.`：角色和格式，例 `Ai-Work.module.css`、`Ai-Work.test.tsx`、`css-modules.d.ts`、`README.zh.md`、`README.i18n.yaml`、`vite.config.ts`、`.env.example`。
- 组件 `Ai-Work.tsx`、样式 `Ai-Work.module.css`、测试 `Ai-Work.test.tsx` 必须同基础名；React Hook 按社区约定 `useWorkspace.ts`，导出 `useWorkspace`。
- 固定工具文件名（如 `package.json`、`tsconfig.json`、`index.ts`、`AGENTS.md`）优先于个人命名偏好。外部 API 字段如 `session_id` 不得擅自改成 `sessionId`。
- 新建前检查目录命名；重命名须修复 import/exports/测试/文档，不能只靠大小写区分文件；旧文件不得未经批准全量重命名。
- 文件名必须**短、准确、有语义**：普通手写文件基础名建议不超过 30 个英文字符、原则上不超过 3 个语义单词；超过 40 个字符必须解释（固定工具/协议/生成名例外）。
- 禁止 `Workspace-Client-Menu-Navigation-Panel-View.tsx` 等无意义长串、`Data.ts` / `Helper.ts` / `Final2.ts` 等含糊名、`xwsp-hnd.ts` 等自造缩写。优先 `Workspace-Menu.tsx`、`session-service.ts` 等“实体 + 职责”命名；先用目录上下文减重复、再查是否混合职责。
- 功能 Client 使用 `locales.ts` 管理中英文字典，`css-modules.d.ts` 声明样式模块。
- **每个包必须有双语文档三件套**：`README.md`（英文）、`README.zh.md`（中文）、`README.i18n.yaml`（双语配对哈希记录，由 `pnpm readme:pair -- . --write` 生成，不是翻译源）。三件套由 `pnpm check` 的 `readme-pair` 规则强制；改任一侧后须同步另一侧并重新生成记录。
- 每个 TS、TSX、JS、MJS、CSS、HTML 源码文件必须有简洁中文文件头，说明职责、关联及运行环境。
- 重要函数、类、导出/重导出、特殊导入分组、主要 UI 区块和 CSS 分组需有必要中文注释；不逐行解释自明语句，不写冗长废话。
- 具体边界及例外以详细规范 **§4.1** 为准，变更行为后同步更新注释和 README。

## 4. 小文件与模块边界

- `*.tsx` 超过 250 行、`*.ts/js/mjs` 超过 300 行、`*.module.css` 超过 250 行，必须检查是否需要按职责拆分。
- `*.tsx` 超过 400 行、`*.ts/js/mjs` 超过 500 行、`*.module.css` 超过 400 行，必须给出保留理由并在 dev-log 记录。
- 上述两条由 `pnpm check` 强制：`file-size` 拦硬上限，`client-host-relative` 禁止 Client 用相对路径导入同包 `src/`，`css-theme-literal` 禁止 Client 样式写死颜色。既有债务按规则登记在 `scripts/check-allowlist.json`，该清单只允许减少：拆分或修复后同轮删除条目，新增违规必须直接修掉，不得往清单里加。
- 不得将多个无关功能全部放在一个入口/组件中；不得用 `part1.ts` 等无语义拆分逃避规则。
- 修改前搜索已有实现：避免复制逻辑、重复状态、死代码、无用文件、僵尸事件监听器。
- 仅允许最小必要差异，未经授权不“顺便重构”无关模块。

## 5. 每轮 AI Agent 工作流（必须执行）

1. 先阅读相关 `AGENTS.md`、包 README、架构及本轮 Git 状态，识别用户未提交改动。
2. **新功能先讨论，再写开发方案。** 先与负责人确认目标、范围和主要交互，达成一致后按完整规范 §7.3.1 将方案写入仓库，并提交负责人评审。
3. 按批准级别执行。新功能以负责人确认具体方案并同意开工为实施授权；A0 已授权局部修复可按简明计划自主实施；其他 A1 变更及 A2 高风险变更按完整规范取得相应批准。
4. 在批准范围内逐步实现；修改边界必须先定义公开契约；注册资源要有卸载清理。
5. 跑针对性测试、类型检查、Lint、构建、必要的集成/UI 测试；涉及前端界面或交互改动时须通过内置浏览器实测验收；不能把未执行的命令写成通过。
6. 检查 `git diff` 与文件清单，再记录 dev-log 与适用的 updata-log。
7. 最终报告完成项、真实变更路径、测试结果、未完成内容、Git 状态和日志位置。

## 6. 测试、构建、提交与安全

- 保持 TypeScript 严格类型，禁止无解释 `any`、`@ts-ignore`、吞异常、伪造测试结果。
- Bug 修复优先补回归测试；Cordis 注入/安装/卸载/重载及 Host/Client 隔离有测试依据。
- **内置浏览器实测验收（强制）**：每次涉及 Web UI、布局、样式或前端交互的任务，交付前必须启动本地 Web 服务并使用 Agent 内置浏览器（`browser` 子代理）实际打开页面完成交互与视觉验收（确认控制台无新增报错且实际交互符合预期）；不得以静态构建或单测替代内置浏览器实测。
- **自动化浏览器门禁**：涉及 Web UI 的交付同时执行 `pnpm verify:web`（生产构建产物 + 本机无头 Edge/Chrome 校验壳层、资料库、代码审查、设置中心、浅色主题与窄屏，失败或控制台报错即退出 1）。它兜底装配断裂与空白页，但不替代上一条的人工/子代理目视验收。
- 所有构建命令必须实际存在于项目 scripts；失败或未运行都应如实报告。
- **门禁位置**：克隆后执行一次 `pnpm hooks:install` 启用本地提交前检查（`.githooks/pre-commit`：空白检查 + `check` + `lint`，跳过用 `--no-verify`）；完整门禁在 `.github/workflows/ci.yml`，顺序为 `install --frozen-lockfile → check → lint → readme:pair → typecheck → test → build → probe:loader → verify:web`。其中 Lint 由 `pnpm lint`（`scripts/lint-workspace.mjs`，AST 规则：未使用导入、显式 any、调试输出、宽松相等、空 catch、TS 抑制指令）执行。改完必须让这些步骤真实通过，不能只跑一部分就报告完成。
- 未经负责人明确要求，**不得 git commit、git push、合并 PR、强制 reset、覆盖用户本地改动**。
- 不泄漏密钥、不静默清除数据、不改动无关系统文件。高风险操作必须单独审批。

## 7. 日志是交付门槛

- `docs/dev-log/`：每轮**实际发生文件变更**的开发交付必须有一条；日志按每 200 个任务编号汇总到一个卷文件（如 `000001-000200.md`），卷内逐条保留完整记录与原始文件名索引，未满 200 条时追加，满 200 条后开启下一卷。
- `docs/updata-log/`：本轮有用户可见的新功能、Bug 修复或优化时必须有一条；纯内部变更可只写 dev-log，注明原因。
- 用户指定目录名 **`updata-log`**，不要自动修正成 `update-log`。
- 开发日志卷文件名：`000001-000200.md`，表示该卷覆盖的六位任务编号范围；卷内每条记录仍保留六位全局递增编号、日期、时间、英文任务名与完整文件清单。更新日志仍按单条任务命名，两类日志同轮同编号。
- 日志记录准确时间和时区，不能伪造已有文件、测试、审批和 Git commit。
- 每轮根据真实 `git diff --name-status` 校对日志，与源代码交付同轮完成。

## 8. 验收底线

如果计划缺失、新功能方案未经评审确认、审批不够、跨包边界破坏、缺失必要中文注释、测试失败、用户改动被覆盖、涉及前端改动却未通过内置浏览器实测验收，或 dev-log 不完整，或四栏布局/命名校验不满足要求，**不得报告“已完成”**。必须说明剩余工作和真实阻塞。
