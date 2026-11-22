# AI Agent 项目工程开发规范

> 版本：V1.2（增加简短语义命名与四栏界面的建议稿）  
> 适用：独立新项目、TypeScript + React + Cordis 插件化 Monorepo  
> 参考基座：DeepSeek Harness（https://github.com/deepseek-ai/deepseek-harness）  
> 主规则入口：仓库根目录 `AGENTS.md`  
> 状态：正式用于新项目之前，应由项目负责人确认约束；本规范不会自动修改现有项目。

## 0. 规则优先级与词义

- **必须 / 禁止（MUST / MUST NOT）**：交付门禁，不满足不得标记完成。
- **应该（SHOULD）**：默认执行；例外必须在计划和开发日志说明理由。
- **建议（MAY）**：按实际复杂度采用，不能为追求目录整齐而制造空包。
- 冲突时按 **项目负责人的当前明确指令 > 项目已批准的架构决策 > 本规范 > 参考仓库的示例** 执行。无法兼容时必须在改动前披露影响。
- DeepSeek Harness 是架构参考，不代表照搬其品牌、包名、全部功能或版本。涉及运行时机制时优先参考其对应版本的源码和文档，不得凭印象宣称 API 存在。
- 统一技术栈：**TypeScript、React、TSX、CSS Modules、Cordis、pnpm**。除必要构建脚本、配置文件及原生模块外，禁止无批准引入另一套业务语言和前端框架。
- 本项目的显式差异：**功能 UI 就近放在其业务包 `client/` 内**，不把所有业务 UI 集中放进独立 `packages/client/*`。仍必须遵守 Host/Client 严格隔离。

## 1. 总体工程原则

1. **万物皆插件，能力由服务提供**：Cordis 管理服务、依赖注入、事件、生命周期；插件不越过契约直接操控别的包内部状态。
2. **先规划、后执行、再验收**：每轮实际开发都先检查上下文与变更范围，输出计划，再按授权级别执行；没有验收证据不能说“已经完成”。
3. **包级单一职责**：每个 package 对外提供清楚的能力；复杂能力可以拆为 `contract / service / provider / adapter / client`，但不因文件行数机械创建新包。
4. **UI 与领域逻辑就近，运行环境仍分离**：允许同一包同时拥有 Host 入口与 Client 入口，但不得跨环境直接引入实现。
5. **可替换、可卸载**：插件卸载应清理所有监听器、UI 插槽、定时器、资源引用；替换功能的 UI 不应要求重写稳定的领域服务。
6. **中文可维护性优先**：注释、开发过程、架构说明、测试用例说明、日志统一中文；代码标识符、协议字段、命令及必要第三方术语保留其英文形式。
7. **最小改动、可追溯**：一个任务只改必须改的包；必须记录改动、验证、影响与回滚方式。
8. **桌面端统一四栏骨架**：左一图标菜单、左二功能菜单、中间工作区、右侧菜单；由统一 UI Shell 管理，业务插件只能贡献视图，不能各自重建页面布局。

## 2. Monorepo 根目录

建议采用如下基线（按需创建，不允许空壳泛滥）：

```text
project-root/
├── .agents/                         # 可选：AI Agent 流程、技能、工作约定
├── .github/                         # CI、PR 模板、Issue 模板
├── apps/                            # 可执行程序与启动/组装入口，不承载领域核心
│   ├── cli/
│   ├── web/
│   └── desktop/                     # 仅选择桌面端时启用
├── packages/                        # 核心：packages/<能力分组>/<具体包>
│   ├── core/
│   │   ├── agent/
│   │   ├── tools/
│   │   └── session/
│   ├── workspace/
│   │   └── workspace/
│   │       ├── src/                 # Host / 领域逻辑 / Cordis 插件
│   │       ├── client/              # 仅 workspace 自己拥有的浏览器 UI
│   │       ├── tests/
│   │       ├── locale/              # 如需领域服务的国际化资源
│   │       ├── README.i18n.yaml
│   │       ├── README.md
│   │       ├── README.zh.md
│   │       ├── package.json
│   │       ├── tsconfig.host.json
│   │       └── tsconfig.client.json
│   ├── ui/
│   │   ├── primitives/            # 跨业务共享的按钮、对话框等
│   │   ├── theme/                 # 共享设计 Token / 全局主题
│   │   ├── slots/                 # UI 扩展插槽与注册契约
│   │   └── layout/                # 四栏 UI Shell，统一拥有布局骨架
│   ├── integration/                 # 跨系统集成协议和适配器（有需求时）
│   └── util/                        # 真正跨包、依赖最小的纯工具
├── docs/
│   ├── architecture/                # 总体架构、包关系、接口与 ADR
│   ├── standards/                   # 工程规范及细分规则
│   ├── dev-log/                     # 每轮开发事实记录
│   ├── updata-log/                  # 用户可感知的新增、修复和优化
│   └── templates/                   # 各类计划、日志、验收模板
├── native/                          # 真正需要的原生接口/扩展
├── patches/                         # 第三方补丁，必须标识来源和原因
├── scripts/                         # 构建、验证、生成及维护脚本
├── vendor/                          # 需要本地维护或固定版本的第三方源码
├── AGENTS.md                        # AI Agent 强制执行入口
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json
└── tsconfig.json
```

### 2.1 目录职责与禁区

**包分类必须先于建包**：分组职责、已登记组清单、新包归属决策流程与反例见 [包分类规范](../architecture/package-taxonomy.md)。核心约束：接口边界进 `api/`，装配组合进 `bundle/`，宿主基础设施进 `host/`，Agent 内核进 `core/`，通用界面进 `ui/`；禁止在 `packages/` 根目录新建散包；新增分组必须先登记规范再扩展检查白名单。该约束由 `pnpm check` 的 `package-group` 规则强制。

| 位置 | 允许负责 | 禁止负责 |
|---|---|---|
| `apps/*` | 启动器、配置组装、进程入口、不同平台装配 | 成为业务规则与核心服务的唯一实现所在地 |
| `packages/*/*/src` | 领域逻辑、Service、插件注册、契约、适配器 | 直接导入 React、DOM、浏览器 API、CSS |
| `packages/*/*/client` | 属于该业务包的组件、CSS、UI 本地化、浏览器入口 | 使用 Node 文件系统、私密凭据、Host 进程对象 |
| `packages/ui/*` | 与业务无关、被多个包复用的 UI 基础设施 | 复制特定业务逻辑或成为所有业务 UI 的集中大包 |
| `docs` | 人类及 Agent 可查的架构、约定和真实记录 | 将未完成事项写成已完成功能 |
| `scripts` | 可复现、可校验的开发与发布流程 | 绕开测试、偷偷改动业务、静默删除用户数据 |
| `vendor / patches / native` | 必要且解释过来源的特殊技术边界 | 无说明引入体积巨大的依赖、直接修改 vendor 而不留记录 |

### 2.2 两层 workspace 规则

- `pnpm-workspace.yaml` 中的主包模式必须包含 `packages/*/*`，并根据实际启动程序包含 `apps/*`，其它路径按需配置。
- **包的所有权由第二层目录确定**：`packages/workspace/workspace` 是一个包，`packages/workspace` 是包组而不是包。
- 一个包应有唯一 `package.json`、明确包名与 exports、README、测试归属。子目录 `client/` 默认是**同一个 package 的代码入口**，不是隐式增加的第三层 workspace 包。
- 包组新增或删除时更新 `packages/README.zh.md`（如果项目创建了此目录索引），不得留下孤儿包和死引用。
- 包之间只能引用公开的 package exports；禁止使用 `../../另一个包/src/internal.ts` 绕过 API 契约。

### 2.3 功能包内的 Client 标准布局

```text
packages/workspace/workspace/
├── src/
│   ├── index.ts                    # Host Cordis 插件入口（中文文件头）
│   ├── service/                     # 服务与业务用例
│   ├── contract/                    # 无 Node/DOM 依赖的共享类型与协议
│   └── adapters/                    # 外部适配
├── client/
│   ├── index.ts                     # Client 插件注册及卸载
│   ├── locales.ts                   # UI 中英文文本字典
│   ├── css-modules.d.ts             # *.module.css 类型声明
│   ├── components/
│   │   ├── Ai-Work.tsx
│   │   └── Ai-Work.module.css
│   ├── hooks/                       # 仅此 Client 专属的 React Hooks
│   ├── stores/                      # UI 状态，仅在必要时创建
│   └── assets/                      # 专属静态资源
├── tests/
│   ├── unit/
│   ├── integration/
│   └── client/
└── package.json
```

- 不是每个包都必须创建 `client/`；没有 UI 的服务包禁止增加空 `client`。
- 如果 UI 以后替换，只更换 `client/` 及其注入的展示适配层，业务接口原则上保持不变。
- 为 `.`、`./client`、必要的 `./contract` 设置明确的 `package.json#exports`；构建 Host 与 Client 时必须映射到**不同的产物和类型入口**。
- `./client` 的构建工具、React runtime、CSS 处理和 HMR 必须在正式脚手架上验证，不能只建立目录就声称兼容 DSH。

## 3. Cordis 插件和依赖架构

### 3.1 组织方式

- 依照 DSH 的 Service Definition / Provider / Consumer 思路：公共协议定义能力，具体 Provider 实现能力，Consumer 通过声明的注入调用能力。
- 插件通过 `inject` 显式声明依赖；可选服务按实际 Cordis API 的安全读取方式处理，禁止无声明地假设服务存在。
- 稳定服务通过 `ctx` 注册和注入；跨包广播与扩展通过**类型化事件**；展示区域通过可注册、可撤销的 UI 插槽。
- 生命周期内注册的监听器、资源、命令、UI 贡献必须随 dispose/HMR 撤销，防止卸载后残留。
- Host 和 Client 用契约、经授权的 RPC/事件或状态快照通信；不能共享可变模块单例作为隐式通信手段。
- 包只导出必要的公共 API；不可把全部实现细节都 `export *` 到根入口，避免误形成永久公共契约。
- DSH 已存在的导出约定必须结合实际 Cordis 版本验证：Service 类与函数式插件不能随意混用默认导出和命名导出。

### 3.2 依赖方向

```text
apps/<入口>  -->  packages/<能力组>/<组合与提供方>
                               |
                               v
                     稳定 Service / Contract
                               ^
                               |
                   其它插件通过 inject 调用

某功能包/client/ -->  该功能的公开 contract + 共享 ui/primitives、ui/slots
某功能包/src/    -X->  任意 client/、React、DOM、CSS
某功能包/client/ -X->  Node 专属实现、私密凭据、Host 文件系统
```

- 不允许形成依赖环；出现环时提取公共契约或事件，不用延迟 `require()` 规避。
- 跨包共用逻辑至少存在两个明确消费者、且与某业务领域无强绑定时，才考虑提取进 `util` 或独立基础包。
- 特定业务的共享逻辑仍属于**该业务的所属包**，不要为了“共用”把领域规则放进全局工具箱。
- 对平台 API、第三方 SDK 使用 adapter，避免 Service 层依赖具体供应商。

### 3.3 四栏 UI 布局（强制架构约定）

**LFAA 当前项目说明（2026-11-17 更新）：**负责人确认采用本节四栏架构，且左二功能菜单栏与右侧菜单栏均支持展开与收起，由 `packages/ui/layout/` 通过 Cordis `workbench` 服务统一管理。

**桌面主界面固定采用四个逻辑区域，顺序与职责不得擅自改变：**

```text
┌──────────┬──────────────────┬───────────────────────────────┬──────────────────┐
│ 左一     │ 左二             │ 中间                          │ 右侧             │
│ 图标菜单 │ 功能/导航菜单    │ 主工作区                      │ 右侧菜单/面板    │
│          │                  │                               │                  │
│ 图标入口 │ 当前模块子菜单   │ 页面、对话、画布、编辑等工作  │ 当前工作上下文   │
└──────────┴──────────────────┴───────────────────────────────┴──────────────────┘
```

#### 3.3.1 四栏职责边界

| 区域 | 职责 | 不允许发生的情况 |
|---|---|---|
| **左一：图标菜单栏** | 项目级/模块级一级入口；采用统一图标导航与选中状态 | 插件自行插入另一条全局主导航；把具体业务实现塞入导航壳 |
| **左二：菜单栏** | 展示左一当前选中功能的二级导航、工作区目录或相应菜单 | 与左一维护互不一致的选中状态；每个插件重新创造一套侧边布局 |
| **中间：工作区** | 主任务承载位置：对话、编辑器、画布、项目内容等按功能切换 | 将主工作内容永久挤进某个边栏；业务包自行覆盖全部四栏 |
| **右侧：菜单栏** | 当前工作对象或任务相关的操作、信息和扩展菜单 | 不基于当前上下文展示无关功能；重复定义整套左二导航 |

- 四栏属于**同一应用 Shell**，默认桌面窗口打开时保持四个逻辑区域；不同业务模式切换的是区域内的插件视图，而不是切换成四种相互独立的 App 界面。
- `apps/web`、`apps/desktop` 等只挂载/启动 UI Shell，**不在 apps 编写四栏业务实现**。统一布局归 `packages/ui/layout/`；项目启用的具体包在自己的 `client/` 中注册对应区域内容。
- 左一选择一级入口后，左二展示对应菜单，中间展示选中的工作视图；右侧根据中间的当前会话、文件、任务或对象更新。**同一上下文状态有明确唯一所有者**，其他区域通过公共契约/状态投影订阅，避免同值重复维护和不同步。
- 插件只可向约定插槽贡献组件、菜单或上下文动作；不得直接访问其他插件的私有 React State、DOM 节点或使用全局事件黑箱联动。
- UI Shell 持有四栏容器、分隔拖拽、折叠/展开、宽度约束、焦点与滚动策略、屏幕适配和生命周期。每个功能插件**只拥有本包的 UI 内容**与数据协议。

#### 3.3.2 四栏插槽与本包 Client

可以先在架构契约中定义四个语义插槽（**以下名称是提议，非 DSH 已存在的 API**）：

```text
shell.nav.primary      # 左一：图标菜单内容
shell.nav.secondary    # 左二：二级导航、当前模块菜单
shell.workspace.main   # 中间：主工作区内容
shell.nav.right        # 右侧：上下文菜单与操作面板
```

统一 Shell 对上述插槽进行注册、鉴权、排序、切换和卸载清理。实际实现时应参考当前 Cordis/DSH 的 UI 扩展槽协议设计类型，**不能凭上述字符串就宣称已经可运行**。

示例：`packages/workspace/workspace/client/` 提供 Workspace 左一入口、左二菜单、中间工作页和需要时的右侧面板；它仅注册贡献，不持有四栏的外层 Grid、全局主题或其他功能包的 UI 实现。某功能只占用其中一栏也允许，不强制创建四个空组件。

#### 3.3.3 布局尺寸、交互与适配

1. **未指定具体宽度比例**，不得擅自把 5/20/60/15 等数字写成项目不可修改的架构常量。具体默认值、最小/最大宽度及保存策略在 UI 原型/交互方案批准后配置。
2. 中间工作区优先保留可用空间；拖动右栏宽度不得意外改变左一宽度；左二与右侧支持按产品需求的展开/收起和恢复，不得出现拖动抖动、界面闪屏或内容丢失。
3. 左一承担稳定的全局导航；左二应跟随一级入口变化；右侧随中间工作上下文变化。导航切换、任务打开和工作区状态必须具有明确的数据流，避免各栏“独立可用但互不联动”。
4. 各栏独立控制滚动与溢出，不让横向内容撑坏整个页面；面板重排和窗口缩放保持焦点、键盘可达性、可理解的空态与必要的内容状态。
5. 四栏是**桌面主界面的逻辑架构**。如果以后需要窄屏/移动端，可对四栏进行抽屉、叠层或临时折叠适配，但它们仍对应同一套四区域状态和插槽契约；不得未经批准改成另一套独立的业务导航架构。
6. 业务插件卸载时，四栏 Shell 仍正常运行，已注册的该插件图标、菜单、工作视图与右侧操作应同步撤销，并显示安全的空态/回退视图。

#### 3.3.4 验收门禁

- 测试桌面主界面四栏顺序及语义区域，不允许实际变成三栏/其他布局而未经说明。
- 测试左一切换时左二、中间的联动，以及右侧与当前工作对象的联动，避免状态漂移。
- 测试左右面板调整尺寸、折叠恢复、窗口缩放、滚动和键盘操作，不得破坏中间工作区。
- 测试功能插件注册、切换、热重载/卸载时，四栏贡献能正确挂载和释放。
- 测试 Host/Client 隔离和样式 token，禁止插件用全局 CSS 擅自覆盖 Shell 四栏结构。
- 涉及 Web UI 的改动在交付前执行 `pnpm verify:web`：用生产构建产物起静态宿主，再以本机无头 Edge/Chrome 校验壳层、资料库、代码审查、设置中心、浅色主题与 390px 窄屏，失败或出现控制台错误即退出码 1。它不能替代人工/子代理目视，但能兜住装配断裂、空白页与插件注册缺失。

### 3.4 浅色/深色双主题与 CSS 变量规范（强制）

**项目代码严禁写死颜色。** 组件里只允许出现 `var(--…)`；具体色值只允许出现在变量定义层，由 `@lfaa/ui-theme` 语义变量统一注入，并由 `pnpm check` 的 `css-theme-literal` 规则强制（含 `var(--x, #hex)` 形式的固定色回退一律禁止）。

1. **必须使用语义化主题变量**：所有 UI 组件（含弹窗、悬浮卡片、右键菜单、表单控件、代码块与徽章）只能消费 `@lfaa/ui-theme` 的 `client/tokens.css` 注入的变量：
   - 画布与表面：`--color-shell`、`--color-rail`、`--color-panel`、`--color-topbar`、`--color-surface`、`--color-popover`、`--color-active`、`--color-menu-hover`
   - 边框与文字：`--color-line`、`--glass-border`、`--color-ink`、`--color-muted`
   - 强调色联动：`--color-accent`、`--color-accent-rgb`
   - 状态与语义：`--color-success`/`--color-success-strong`/`--color-success-rgb`、`--color-warning*`、`--color-danger`/`--color-danger-strong`/`--color-danger-rgb`、`--color-info*`、`--color-link`/`--color-link-hover`、`--color-violet*`、`--color-orange*`、`--color-teal*`、`--color-activity-positive*`、`--color-activity-negative*`
   - 代码与彩色底：`--color-code-bg`/`--color-code-bg-alt`/`--color-code-ink`/`--color-code-muted`、`--color-on-accent`、`--color-scrim`
2. **禁止写死与固定色回退**：严禁裸写十六进制、`rgb()`、`hsl()` 作为通用表面/边框/文字/状态色，也禁止 `var(--color-bg, #111216)`、`var(--glass-card-bg, rgba(24, 25, 30, 0.96))` 这类回退；变量缺失时必须暴露问题，而不是退回某个固定色。
3. **状态色成对定义，组件只消费**：新增状态色必须在 `@lfaa/ui-theme` 的 `tokens.css` 浅色与深色块（含系统主题媒体查询块）成对提供，并保证正文对比度 ≥ 4.5:1；组件不得自带 `:global(:root[data-resolved-theme="light"])` 颜色覆盖（变量已带两端值，覆盖属重复定义）。仅半透明叠层可用 `rgb(var(--color-*-rgb) / α)`。
4. **允许的具体色值只有三类**，且必须登记在 `scripts/check-allowlist.json`：变量定义层（`@lfaa/ui-theme/client/tokens.css`）、代码高亮调色板（`CodeSyntax` / `MarkdownContent` / `FileChangePreview` 中的 token 色）、主题预览样张（`AppearanceSettings`）。阴影、滤镜、玻璃材质与 α ≤ 0.2 的半透明叠层属于表面质感，规则自动放行。豁免清单只减不增。
5. **验收要求**：每次前端界面改动必须在深色和浅色两种主题下实测弹窗、悬浮层、表单控件与正文对比度，确认无暗色残留或不可读问题；新增/调整状态色时给出对比度计算或实测结论。

### 3.5 活动行对齐与状态排布（强制）

- 同一层级的活动行统一类型图标的占位、左侧标签的起点及垂直对齐。命令运行时，圆环和「进行中」放在类型图标后、命令正文前，进度组的起点与同级文件活动的「已编辑」对齐。
- 命令成功后，勾放在行尾的展开箭头前。失败显示对应错误状态。行尾展开控件的位置不得随命令长短或状态切换移动，长正文优先省略。
- 交付前在深浅主题和窄面板检查同级活动行。验收须覆盖长命令、运行到成功的状态切换、失败提示与展开控件的可见性。

### 3.6 应用分层与装配下沉（强制）

`apps/` 只负责**启动与平台适配**，不承担服务端实现与装配逻辑。

| 层 | 位置 | 允许内容 |
|---|---|---|
| 启动 | `apps/cli` | 参数解析、调用 boot 包、信号与退出码处理 |
| 前端 | `apps/web` | `index.html`、`vite.config.ts`、`src/main.tsx`、样式资源 |
| 服务实现 | `packages/host/*` | HTTP 接口注册、Context 组装、开发服务器托管 |
| 装配组合 | `packages/bundle/*` | 按序挂载能力插件、跨服务联线、向插件管理声明 `providedModules` |

强制条款：

- `apps/` 内**禁止**出现服务端装配文件（如自建的 `server.ts`）与 HTTP 路由注册。
- `apps/` 只允许导入 `@lfaa/*` 的 **`client` 子路径**；导入 Host 包仅限显式 boot 包（当前为 `@lfaa/web-server`），由 `pnpm check` 的 `app-host-import` 规则强制。
- 新增一种运行形态时，新建 `packages/bundle/*` 组合包，而不是在 `apps/` 里加分支。
- 装配顺序具有语义：基础服务必须先于依赖它们的插件装载；跨服务联线必须放在声明了 `inject` 的独立子插件里，不能在父插件里直接访问子服务。
- 已装配的能力必须向插件管理登记（`providedModules`），避免同一服务被 Loader 重复装载。

参考实现：`packages/host/web-server`（服务）、`packages/bundle/web`（装配）、`apps/cli` + `apps/web`（启动与前端）。

## 4. 文件命名、语言和国际化

### 4.1 三种符号的职责：`-`、`_`、`.`

三种符号**按语义选择，不能随意互换**。先判断文件类型与工具链约定，再选择分隔符；同一目录内、同一类文件必须统一，不允许 AI 以个人习惯随意改变已有命名。

| 符号 | 主要意义 | 优先适用范围 | 示例 |
|---|---|---|---|
| `-` 横杠 | 分隔**词语 / 功能概念**，强调名称可阅读性 | 业务包、文件夹、组件名、普通源码、开发脚本、日志任务短名 | `ui-primitives/`、`Ai-Work.tsx`、`workspace-service.ts`、`verify-package-exports.ts` |
| `_` 下划线 | 分隔**结构化字段 / 外部约定的标识符**，适合稳定数据、素材和原生接口 | 测试数据和素材（经目录级选型）、原生 C/C++、与外部格式/生成器一致的名称 | `workspace_invalid_path.fixture.json`、`workspace_empty_state.svg`、`native/window_bridge.cpp` |
| `.` 点号 | 标记**层级角色 / 环境 / 语言 / 格式 / 文件扩展名**，不是任意词语分隔 | CSS Modules、声明文件、测试、配置、i18n、平台变体及隐藏配置 | `Ai-Work.module.css`、`Ai-Work.test.tsx`、`css-modules.d.ts`、`README.zh.md`、`vite.config.ts` |

**判定优先级：外部工具或协议的固定文件名 > 文件功能后缀（`.`）> 所属类别的词语分隔（`-` 或 `_`）> 个人习惯。**

#### 4.1.1 `-`：目录与手写源码的默认词语分隔符

- 包组、包、普通业务目录及脚本名使用小写 `kebab-case`，例如 `browser-use/`、`ui-primitives/`、`workspace-service.ts`。
- **用户指定的 React 组件风格保留首字母大写**：`Ai-Work.tsx`、`Workspace-Panel.tsx`，与其 CSS Modules 的基础名称完全一致。
- 组件文件中的 `-` 用于区分两个语义词，而不是随意拆单词；不得在同一目录混用 `Ai-Work.tsx`、`Ai_Work.tsx`、`aiWork.tsx` 表示同一实体。
- 脚本采用 `verify-package-exports.ts`、`build-client-assets.mjs` 等可读名称；`apps/`、`packages/`、`docs/` 的基础目录名称不因大写偏好而修改。
- 日志名中 `-` 负责分隔**编号 / 日期 / 时间 / 任务名**，如 `000001-20261117-1031-workspace-client.md`。

#### 4.1.2 `_`：有明确数据 / 资源 / 外部约定时使用

- 对**本项目手写 TS/TSX、业务包和 React 组件**，默认**不使用 `_`** 来分隔单词；避免把同一类源码拆成两套命名体系。
- 资源目录可按用途选择 `snake_case`，例如 `workspace_empty_state.svg`、`sidebar_folder_open.svg`；确定该目录的命名后，后续同类素材必须沿用，不能与 `workspace-empty-state.svg` 随机混用。
- 结构化测试夹具可使用 `snake_case` 描述数据场景，再以点号标记角色：`workspace_invalid_path.fixture.json`、`agent_session_expired.fixture.json`。已有项目若选择 `kebab-case` 夹具命名，应坚持原约定。
- 原生代码如 C/C++、FFI、第三方 SDK 或数据库字段**需要匹配既有命名契约**时可以采用 `window_bridge.cpp`、`native_handle.h`、`session_id`；此时兼容性优先于 TS 风格。
- `__tests__`、`__mocks__`、`_app.tsx` 等带 `_` 的框架特殊名称，**只有对应工具链确实需要时才使用**，不得为了装饰额外创建。
- TS 参数里的 `_unused` 可表明约定要求但未使用的形参；**下划线不是 TypeScript 私有性机制**，不要用 `_name` 冒充访问控制，应使用 `private` 或其他适当手段。
- 不因为“想让文件更特殊”而使用下划线，不创建 `new_function.ts`、`Ai_Work.tsx`、`workspace__service.ts` 这样的随意命名。

#### 4.1.3 `.`：功能修饰符与文件后缀

- 使用点号叠加有明确含义的后缀，遵循**基础名称 + 功能/变体修饰符 + 最终扩展名**的顺序。
- UI 组件：`Ai-Work.tsx`；对应样式：`Ai-Work.module.css`；对应测试：`Ai-Work.test.tsx`。
- 服务代码及测试：`workspace-service.ts`、`workspace-service.test.ts`；测试工具若采用 `*.spec.ts`，应在该包统一测试后缀，不在同类测试里任意混用 `test/spec`。
- CSS 声明：`css-modules.d.ts`；不要改成 `css_modules_d_ts`。
- 文档与多语言：`README.md`、`README.zh.md`、`README.i18n.yaml`；其中 `zh` 代表语言、`i18n` 代表翻译源角色。
- 工具配置：`vite.config.ts`、`vitest.config.ts`、`tsconfig.client.json`、`package.json`、`pnpm-workspace.yaml`，**优先使用工具能识别的约定名**。
- 环境与特殊配置：`.gitignore`、`.env.example`、`.env.local` 属于既定点号规则，不因首字母大写习惯更名。
- 一个文件名不允许堆叠无定义修饰符，如 `Ai-Work.new.final.v2.module.css`；版本由 Git 和明确的迁移规范管理，不靠 `final2` 命名。

#### 4.1.4 类型速查表

| 文件 / 目录类别 | 推荐命名 | 分隔依据 |
|---|---|---|
| 包组与包 | `packages/browser-use/browser-provider/` | `-`：小写语义词 |
| 业务代码 | `workspace-service.ts` | `-`：功能词 |
| React UI | `Ai-Work.tsx` | `-`：首字母大写的组件文件风格 |
| CSS Modules | `Ai-Work.module.css` | `-`：组件名称，`.`：样式模块与扩展名 |
| React Hook | `useWorkspace.ts` | React 社区惯例优先，导出 `useWorkspace`；不强制改成 `Use-Workspace.ts` |
| 测试 | `Ai-Work.test.tsx`、`workspace-service.spec.ts` | `.`：测试角色，所属包统一 `test/spec` |
| UI 多语言 | `locales.ts` | 约定功能名，简单名称不必插入符号 |
| CSS 类型 | `css-modules.d.ts` | `-`：词语，`.`：声明后缀 |
| 多语言文档 | `README.i18n.yaml`、`README.zh.md` | `.`：语言、功能、格式 |
| 项目配置 | `package.json`、`vite.config.ts` | `.`：工具固定名称、配置角色 |
| 测试夹具 | `workspace_invalid_path.fixture.json` | `_`：场景字段，`.`：夹具格式 |
| 图片素材 | `workspace_empty_state.svg` | `_`：同一素材目录统一的 snake_case |
| 原生接口 | `window_bridge.cpp` | `_`：匹配原生/FFI 风格 |
| 开发日志 | `000001-20261117-1031-workspace-client.md` | `-`：任务元数据分段，`.`：文档格式 |

#### 4.1.5 AI Agent 的命名检查规则（强制）

1. 创建文件前先读取所在目录的真实命名方式、工具链与包 README；新增文件应沿用**同类别的既有风格**。
2. 新建组件时，一次性确定 `组件.tsx`、`组件.module.css`、`组件.test.tsx` 的相同基础名；不得各用一套拼写或大小写。
3. 变更文件名时同步维护所有 import、exports、动态加载清单、测试路径、README 与相关构建配置。
4. 在 Windows、macOS、Linux 上避免仅靠大小写区分两个文件；不得使用空格、尾部点号、Windows 保留文件名或路径中无意义符号叠加。
5. 仅当工具、外部协议、历史兼容或已批准 ADR 明确要求时允许例外，并在 `dev-log` 记录理由。
6. 不进行未经请求的仓库全量批量重命名；新规范首先约束新增和本轮实际维护的文件，旧文件逐步有计划迁移。

### 4.1.6 命名与内容不是一回事

- TS/TSX 内部函数、变量优先使用 `camelCase`；React 组件、类型和类使用 `PascalCase`；常量可按既有项目的 `UPPER_SNAKE_CASE` 约定。
- CSS Modules 的类名优先采用 `camelCase`，如 `.workspaceHeader`；CSS 自定义属性使用 `--workspace-header-height`，不因文件命名方案改成 `_`。
- 外部 JSON/API/数据库字段如 `session_id` 必须按契约保持一致；可以在内部 TypeScript 类型边界映射为 `sessionId`，但不能擅自修改协议字段。
- 文件名中的点号不是 TypeScript 属性访问符，不将 `.` 加在普通业务标识符或文件夹名中制造伪命名空间。

### 4.1.7 文件名必须简短、可理解、有语义（强制）

- **命名先回答“这是什么、负责什么”，再决定拼写**。文件名应让新开发者和 AI Agent 不打开源码也能判断大致职责；`-`、`_`、`.` 只承担必要的结构信息，不为看起来“专业”而叠加。
- 新建普通手写文件的**基础名建议不超过 30 个英文字符、原则上不超过 3 个语义单词**（不含 `.tsx`、`.module.css`、`.test.ts` 等扩展与角色后缀）；超出不是自动禁止，但必须检查是否职责不清、重复上下文或可更短。**超过 40 个英文字符需要在代码评审中说明理由**。工具固定名、协议固定名、迁移生成名与文件哈希等依外部契约例外。
- 优先选择**领域实体 + 主要职责**：`Workspace-Panel.tsx`、`session-store.ts`、`agent-loop.ts`；所在包已经明确领域且无歧义时，可省去重复前缀，例如 `packages/workspace/workspace/src/paths.ts`。
- 避免一层层重复目录词，如 `workspace/workspace/client/components/Workspace-Workspace-Client-Panel.tsx`；避免把全部上下游功能拼到一个文件名里。
- 不用空泛词 `Thing.ts`、`Data.ts`、`Helper.ts`、`New-File.ts`、`Temp.ts`、`Final.ts`、`Manager2.ts`，也不使用 `file1.ts`、`part2.ts` 或无公认含义的私有缩写。`index.ts`、`types.ts` 等经过项目约定的标准入口/类型集合除外；标准名也不得成为堆积多个无关职责的借口。
- 已形成行业或本项目认可的缩写可以使用，例如 `UI`、`API`、`RPC`、`LLM`、`CSS`、`i18n`；**不强制将好理解的词组压缩成密码式首字母串**。
- 当短名称发生冲突，先根据所属目录、职责边界区分，必要时补一个确有含义的限定词，不通过连续加 `-new-v2-final` 或数字来解决。
- 如果无法起一个简洁而准确的名字，**优先重新检查是否把多项职责塞进了一个文件**，不要通过长文件名掩盖设计问题。

**示例：**

| 避免 | 推荐 | 原因 |
|---|---|---|
| `Workspace-Client-Menu-Navigation-Panel-View.tsx` | `Workspace-Menu.tsx` | 目录已表达 Client，文件名只保留职责 |
| `workspace-session-data-process-handler.ts` | `session-service.ts` | 避免模糊堆叠动作词 |
| `Ai-Work-New-Final2.tsx` | `Ai-Work.tsx` | 不在文件名保存版本历史 |
| `xwsp-hnd.ts` | `workspace-handler.ts` | 不使用难以理解的自造缩写 |
| `Utils.ts` | `path-utils.ts`（仅负责路径工具时） | 具体范围比“杂项”清楚 |

**Agent 自查：**在新增或重命名文件前，必须检查名称语义、长度、同目录重名/相似名与职责数量；可用路径上下文减少重复，不得未经批准全仓批量改名；违反规则时先调整职责或名称再提交交付。

### 4.2 i18n

- 界面文案走本包 `locales.ts` 的中英字典；包级文档走三件套 `README.md`（英文）/ `README.zh.md`（中文）/ `README.i18n.yaml`。
- `README.i18n.yaml` 是**双语配对哈希记录**，不是翻译源：由 `pnpm readme:pair -- . --write` 按英文标题分段生成，用于检测两版是否同步。
- 修改任一侧文档后，必须同步另一侧并重新生成记录；`pnpm readme:pair` 校验失败即视为文档不一致。
- 生成 README 用 `pnpm readme:sync`（依据 `package.json` 与脚本内登记的英文摘要）；新增包时在 `scripts/sync-readmes.mjs` 的 `META` 中登记英文摘要。

- `locales.ts` 至少提供简体中文和英文词典；以统一 key 集为准，缺失项通过类型检查或测试报告。
- 组件不得散落硬编码中英文业务提示；展示文案从所在功能包的 locale 获取。
- 不在业务包中重复定义项目通用按钮文案；通用控件文案归共享 UI 包。
- `README.i18n.yaml` 服务于文档翻译，`README.md` 和 `README.zh.md` 为发布给人看的版本；更新产品行为时同步维护本包 README。
- 日志、技术字段、错误码、协议键不应为了翻译改变稳定的数据格式。

## 5. 中文注释强制规则

### 5.1 覆盖范围

每个新建或实质修改的 TS、TSX、JS、MJS、CSS、HTML 等源码文件都必须有**简洁中文文件头**：`职责 / 关键关联 / 运行环境`。适用内容：

1. 主要函数、类、Service、导出 API：一句话说明用途；边界复杂时补充输入、返回、异常或副作用。
2. 特殊的 `import`、重导出、依赖注入：按**导入分组或业务关联**说明为什么依赖它，不对显而易见的每个 import 反复写废话。
3. TSX/HTML 的主要页面区域、特殊布局容器、复杂条件渲染：说明结构的业务职责。
4. CSS Modules：为关键样式分组、响应式规则、非直观层叠或修复特例写中文注释。
5. 并发、回滚、事件订阅、权限、安全、跨包边界：说明**为什么**这样做以及清理/失败路径。
6. 纯声明文件（`*.d.ts`）：说明类型声明解决什么问题；自动生成文件不手改，记录生成源与步骤。

**禁止**：注释与代码含义相反；大段流水账；重复解释每个自明的变量赋值；用注释替代合理命名或拆分。大修改必须同步修正旧注释。

### 5.2 注释范例

```tsx
/**
 * 工作区选择面板：负责展示、搜索和切换工作区。
 * 关联：workspace/contract 的公开类型；通过客户端服务获取数据。
 * 运行环境：浏览器 Client，不调用 Node API。
 */
import styles from './Ai-Work.module.css'

/** 导出工作区选择面板，供本插件的 UI 插槽注册使用。 */
export function AiWork() {
  return (
    // 主面板只承担展示与交互，不直接实现工作区持久化。
    <section className={styles.root}>
      {/* 工作区列表容器：由独立组件维护行展示。 */}
      <div className={styles.list} />
    </section>
  )
}
```

```css
/* 工作区选择面板：与 Ai-Work.tsx 一一对应；仅负责本组件呈现。 */
/* 容器布局：优先使用共享主题 token，不覆盖全局颜色。 */
.root { display: flex; flex-direction: column; }

/* 列表区域：控制滚动，避免页面整体滚动。 */
.list { min-height: 0; overflow: auto; }
```

上述是**注释风格示意**，不是完整可运行组件；真实提交必须连通数据与组件行为。

## 6. 文件规模、职责和可维护性门禁

- 单文件优先单一职责：组件负责呈现、Hook 负责交互逻辑、Service 负责业务、Adapter 负责外部系统。
- 多个无关业务动作不得写在一个超级组件或 `index.ts`；入口主要负责注册、导出和组合。
- **建议预警值**（非绝对禁止行数，包含注释/空行；特殊文件说明原因）：
  - `*.tsx`：超过 **250 行**触发拆分评审；超过 **400 行**必须解释为什么不能拆。
  - `*.ts` / `*.js` / `*.mjs`：超过 **300 行**触发拆分评审；超过 **500 行**必须解释。
  - `*.module.css`：超过 **250 行**触发样式归属检查；超过 **400 行**必须解释。
  - 一个函数超过 **60 行**、包含 3 个以上不相干步骤时应提取有意义的子函数。
- 拆分优先**按职责**，不准为了符合行数把同一逻辑切成 `part1.ts / part2.ts`。
- 提取函数后保留明确命名、稳定 API、真实单元测试；不得引入隐式共享全局状态。
- 禁止复制粘贴多个同步修改版本；修改前先全文查找是否已有组件或服务。
- 禁止无用测试、临时调试文件、未引用组件、孤儿 CSS、废弃的空目录；删除必须确认没有消费者。
- 禁止因为修一个 Bug 顺便格式化整个仓库或重构无关包；如发现系统性问题，另立任务。
- 允许技术债，但必须在日志记录**位置、风险和偿还条件**；不得编造“已彻底修复”。

## 7. AI Agent 必须遵循的执行流程

### 7.1 每轮步骤（必须）

```text
读取 AGENTS.md 与相关包 README
      ↓
核对当前 Git 状态、依赖、待改文件及既有实现
      ↓
复述目标与约束、列出不做什么、判断影响范围
      ↓
提出计划（变更文件、风险、测试、回滚、审批级别）
      ↓
新功能按 §7.3.1 先讨论、再写方案、获批后开工；其他任务按审批分级执行
      ↓
按最小差异逐步实现，涉及架构分层先建立契约
      ↓
执行针对性测试 → 类型检查 → lint → 构建 → 必要的集成/UI 验证
      ↓
检查 git diff、新增/删除/修改文件与重复代码
      ↓
写 dev-log；用户可感知变化再写 updata-log
      ↓
给出验收清单、真实测试结果、遗留问题和 Git 状态
```

### 7.2 审批分级（默认）

| 等级 | 例子 | Agent 权限 |
|---|---|---|
| A0 低风险 | 已授权范围内的局部 Bug 修复、单个组件样式微调、补测试与注释 | **先列简明计划**，可自主修改和验证；不能自行扩大范围 |
| A1 中风险 | 新功能、新增功能包、跨包 API 调整、拆分现有模块、升级依赖、改变 UI 数据流 | **先输出文件级计划并取得负责人批准**。新功能同时遵循 §7.3.1。 |
| A2 高风险 | 删除重要包/数据、数据库迁移、公开 API 破坏、认证权限、更换基础架构、修改 CI 发布/生产配置 | **必须逐项说明影响、备份、回滚方案并获明确批准**；敏感执行操作可能需要二次确认 |

- 当用户直接发出明确且覆盖计划范围的实施指令时，可视为该范围的实施授权。新功能须先完成 §7.3.1 的讨论和方案评审；负责人明确要求按已评审的方案开工，即授权实施该方案的范围。
- 未获 A1/A2 批准时只能分析、设计、查看代码和生成方案，不得进行相应修改。
- 用户没有要求提交或推送代码时，默认**不 `git commit`、不 `git push`、不合并 PR**；经授权后再操作。
- 不得强制重置、覆盖用户未提交的改动、强推历史、泄漏密钥或用 `rm -rf` 等破坏式命令逃避检查。
- 发现当前工作区存在用户改动时先保护差异，不能把自己的改动覆盖进去。

### 7.3 计划报告最小字段

每轮至少说明：`目标`、`涉及包与文件（预计）`、`实现思路/契约`、`不修改的范围`、`风险和审批级别`、`验证计划`、`回滚办法`。
如果任务很小，允许合并为一段简短计划，但不能省略风险判断。

#### 7.3.1 新功能开发方案评审（强制）

1. **先讨论。** 结合现有实现，与负责人确认要解决的问题、主要使用流程、功能范围和关键取舍。讨论阶段可以核对代码和分析可行性。
2. **再写开发方案。** 达成一致后，在 `docs/architecture/` 或已有的相关设计文档中记录方案。除 §7.3 的字段外，写明关键交互、公开接口、实施顺序与验收条件。可参考[扩展中心开发方案](../architecture/extensions.md)。
3. **确认后实施。** 把具体方案交给负责人评审。讨论方向获认可后可以写方案，具体方案获确认并获准开工后才改动实现。如果实施中需要改变已确认的功能范围、交互或公开契约，先更新方案并请负责人确认变更。

已授权的局部 Bug 修复、样式微调、注释和测试补充继续按 A0 规则执行，可使用简明计划。

### 7.4 执行完成最小字段

必须提供：`完成内容`、`实际变更文件/文件夹`、`测试命令与结果`、`未运行的测试及原因`、`遗留问题`、`日志路径`、`Git 状态`。禁止把“准备执行”“理论上可以”写成“已实现”。

## 8. 测试、构建与错误处理

### 8.1 最低验证车道

- **TypeScript**：开启 `strict`，业务代码禁止无理由 `any`、`@ts-ignore`；确有必要注明原因和替代计划。
- **单元测试**：领域逻辑、适配器边界、状态转换、解析器与错误路径须覆盖。
- **契约/集成测试**：Cordis 服务注入、插件安装/卸载、事件行为、重载和跨包契约需测试。
- **UI 测试与内置浏览器验收（强制）**：交互、空态、加载态、错误态、权限态、多语言、键盘操作与必要的可访问性需验证；凡涉及 Web UI、布局、样式或前端交互的任务，交付前必须使用 Agent 内置浏览器（`browser` 子代理）打开本地运行页面进行真实点击/拖拽/视觉验收，不得仅凭静态构建或单测宣布完成。
- **构建检查**：Host、Client、apps 各自构建验证，确保浏览器构建不引入 Node 专属依赖。
- **修复 Bug**：先能复现，再增加回归测试，再修复；无法复现时必须说明依据和验证限制。
- **测试真实性**：不能删测试、注释断言、调低门禁、伪造输出或用 mock 掩盖集成断裂以制造绿色。

示例检查入口（实际命令以根目录 `package.json#scripts` 为准，不允许只写不存在的命令）：

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
# 如项目创建了以下车道，再运行：
pnpm run test:integration
pnpm run test:client
```

### 8.2 错误与清理

- 预期错误使用明确类型、错误码或领域 Result；不静默吞掉异常。
- 面向用户的信息本地化，日志保留足够上下文，但不记录明文密钥、Token、个人隐私和高风险数据。
- 异步任务应支持取消、超时和资源清理；插件重载/卸载不得遗留监听器或进程。
- 数据写入要考虑幂等、失败回滚及并发一致性；避免“先修改再发现未授权”。
- **构建失败就是未完成**；需要在完成报告和日志标红阻塞原因。

### 8.3 建议的自动门禁脚本

将下列检查逐步实现到 `scripts/`，以便规则不仅靠 Agent 记忆：

- `verify-package-boundaries.ts`：检查 `packages/*/*`、禁止跨包深层相对引用、Host 引用 Client。
- `verify-client-isolation.ts`：检查浏览器打包是否引入 Node 专属模块。
- `verify-file-budgets.ts`：报告超长文件；例外须在配置中登记说明。
- `verify-locales.ts`：中文和英文 key 一致性。
- `verify-log-entries.ts`：日志编号、时间、必填字段、路径存在性与 Git 差异一致性。
- `verify-package-docs.ts`：新增包的 README、契约说明、构建入口与测试是否齐全。
- `verify-file-names.ts`：提示过长、缺乏语义、同目录相似/混用符号的命名；工具固有名称和合约生成文件需例外表。
- `verify-layout-contract.ts`：校验四个逻辑区域的插槽所有权与贡献注册（配套 UI 行为测试才能验证真实联动）。

**这些脚本是推荐新增的实现任务，不能在它们尚未编写时声称“已具备自动校验”。**

## 9. Git、提交与版本管理

- 主分支保护；任务按 `feat/<task>`、`fix/<task>`、`refactor/<task>` 建分支（是否建分支按仓库策略，不在无授权时切换用户工作区）。
- 小步提交，避免将重构、功能、格式化、日志补丁混为一个无法审查的大提交。
- 推荐 Conventional Commits：`feat(workspace): 新增工作区选择面板`、`fix(agent): 修复服务释放时序`、`docs(standards): 更新开发约定`。
- 提交前检查 `git status`、`git diff --check`、改动范围、测试与日志；提交后报告 SHA。
- 禁止在 Git 中提交 `.env`、密钥、临时测试数据、构建缓存、用户隐私信息。
- 任何破坏兼容性的变更必须写迁移说明，注明受影响消费者、升级路径与回滚条件。
- 引入/升级依赖应说明原因、协议/许可证、兼容性及 lockfile 变化；不能随意改写整个锁文件。

## 10. 每轮开发日志（强制）

用户明确要求使用 `updata-log` 拼写，**保留原名不擅自改成 `update-log`**。

### 10.1 两类日志职责

- `docs/dev-log/`：面向维护者/AI 的**实施事实**，记录本轮做什么、为什么、哪些文件和文件夹新增/修改/删除、测试结果、风险和关联提交。为控制目录文件数量，每 200 个任务编号汇总为一个卷文件（如 `000001-000200.md`）；卷内逐条保留完整日志正文及原始单条文件名索引。
- `docs/updata-log/`：面向使用者的**更新说明**，记录新增功能、修复 Bug、性能/体验优化、破坏性行为变化。纯内部重命名、注释或无用户可见变化时不强制新增 updata-log，但 dev-log 必须记录原因。
- “一轮”定义为**一次明确开发任务的实际文件变更交付**，不是每条闲聊消息；一轮涉及多个包也共用一个任务 ID，并列出完整文件清单。
- 日志必须根据本轮真实 `git diff` / 文件树填写；未经验证不得记录“已通过测试”。

### 10.2 编号、日期与命名

**推荐统一格式**：

```text
docs/dev-log/000001-20261117-1031-workspace-client.md
docs/updata-log/000001-20261117-1031-workspace-client.md
```

- 单条记录沿用 `<六位递增编号>-<YYYYMMDD>-<HHmm>-<任务英文短名>.md` 元数据格式；`dev-log` 将每 200 个编号收录到范围卷 `000001-000200.md`、`000201-000400.md` 等，未满 200 条的当前卷持续追加。`updata-log` 继续使用单条任务文件名。
- 开始每轮开发时预留一个编号，两类日志使用相同编号；同一天可以有多个任务。
- **编号在整个项目内单调递增、不得复用**；取消任务可以保留编号并在 dev-log 标记取消或未实施。
- 时间统一按项目配置确定的时区，例如 `Asia/Shanghai`，日志正文必须写时区偏移，禁止根据 Agent 自身环境猜测用户当地时间。
- 记录创建时间与完成时间；如果跨天，应以开始时刻命名并在正文记实际完成时间。
- Windows 文件名不允许 `:`，时间必须用 `HHmm`，任务短名用 `kebab-case`。
- 已发布日志保持可追溯。需要更正时追加“更正记录”，不得无痕覆盖既有事实。

### 10.3 开发日志模板

```markdown
# DEV-000001｜工作区 Client 内聚
- 任务编号：000001
- 开始时间：2026-11-17 10:31 +08:00
- 完成时间：待填写
- 类型：feat / fix / refactor / perf / docs / chore
- 状态：完成 / 部分完成 / 阻塞 / 取消
- 审批：A1，批准记录或链接
- 关联：需求/Issue/PR/Commit（如无写“无”）

## 目标与范围
- 目标：……
- 不在范围：……

## 文件与文件夹变更（必须写完整相对路径）
| 操作 | 路径 | 原因及内容 |
|---|---|---|
| 新增文件夹 | `packages/workspace/workspace/client/` | 承载功能私有 UI |
| 新增文件 | `packages/workspace/workspace/client/components/Ai-Work.tsx` | 工作区选择入口 |
| 修改文件 | `packages/workspace/workspace/package.json` | 新增 ./client 导出 |
| 删除文件 | `...` | 如无则写“无” |

## 验证证据
| 命令/测试 | 结果 | 备注 |
|---|---|---|
| `pnpm run typecheck` | 待执行 | 不得提前写通过 |

## 风险、回滚与遗留项
- 风险：……
- 回滚：……
- 遗留问题：……
- Git 状态 / Commit：……
```

**示例路径与示例编号仅用于解释格式，不代表项目已发生这些改动。**

### 10.4 更新日志模板

```markdown
# UPDATE-000001｜工作区界面整理
- 时间：2026-11-17 10:31 +08:00
- 类型：新增 / 修复 / 优化 / 兼容性调整
- 关联开发日志：../dev-log/000001-20261117-1031-workspace-client.md

## 用户能看到的变化
- ……

## 影响范围与使用提示
- ……

## 已知限制
- ……
```

### 10.5 日志审核

- 每次完成前检查本轮 `git diff --name-status` 和新目录，逐一核实记录；新增/删除/重命名都要有对应路径。dev-log 的逐轮记录可位于对应范围卷内，不要求每轮创建一个目录文件。
- 记录本轮确实改动的文件，而不只是写“修改了 Workspace 包”。
- 大量生成文件可列出生成命令、输入与产物目录，并附独立清单；不得用“若干文件”等模糊描述掩盖改动。
- dev-log 范围卷必须保留每轮完整详细记录，不得只保留摘要；原单条记录归卷后可从目录移除。发布时可汇总多个 `updata-log` 生成 `CHANGELOG.md`。

## 11. 新包创建和删除规则

### 新建包前回答

- 为什么现有包不能承担？新增能力的稳定契约是什么？由哪个分组拥有？
- 哪些消费者需要这个包？它是否真的需要 Client？
- 是否产生新的依赖环、重复的 Service、重复 UI、重复状态源？
- 如何启动/注册/卸载/测试？是否能在不读取私有源码的情况下使用它？

### 创建成功的定义

- 正确放在 `packages/<group>/<package>`；有 `package.json`、可解析的 exports 和 README。
- 有必要的 TypeScript/构建配置与测试；包被实际产品入口或测试装配引用，非空壳。
- 有中文文件头/公共 API 说明；有 Host/Client 分离的检查（如有 UI）。
- 更新包索引及 dev-log；面向用户的功能变化同步 updata-log。

### 删除或替换插件

- 按 A1/A2 评估审批；列出全部消费者及可迁移路径。
- 清理注册项、UI 入口、命令、事件、配置、测试、资源及不再使用的依赖。
- 验证卸载后没有功能残留；若仍需保留历史数据，提供迁移/读取策略。
- 不得直接清除用户数据或替换整个持久化目录。

## 12. 安全、性能、可访问性和质量底线

- 默认最小权限；敏感工具调用有审批与审计；不向前端暴露服务器密钥。
- 使用共享主题 token、CSS Modules、复用已有基础控件；禁止功能包自行维护一套全局主题。
- UI 至少支持加载、空态、错误、重试、键盘可达性和中英文切换；避免无障碍标签缺失。
- 关键路径避免无界请求/事件监听/重复渲染；需要时记录性能基线，不凭主观声称性能提升。
- 第三方代码、补丁、原生模块、许可证和来源可查；补丁说明何时可移除。
- 不执行与开发无关的网络上传、系统设置变更、密钥读取或危险命令。
- 临时兼容代码必须注明移除条件，禁止永久沉积 `TODO` 而没有归属任务。

## 13. Agent 最终验收检查清单

- [ ] 已查阅 `AGENTS.md`、所属包 README、架构文档与当前 Git 状态。
- [ ] 先给出计划；涉及 A1/A2 时已取得批准，未超出范围。
- [ ] 新功能已先讨论并形成仓库内方案，负责人已确认方案并同意实施。
- [ ] 包遵守 `packages/*/*`、入口与对外导出明确。
- [ ] Host/Client 分离；私有 UI 放本包 `client/`；共享 UI 正确复用。
- [ ] 新增或改动的源码有简洁、准确的中文职责与关联注释。
- [ ] 已评估文件规模、重复实现、循环依赖、无用文件与死代码。
- [ ] 新增文件名短而清楚，符号分工正确，无无意义长串、重复词、含混缩写。
- [ ] 桌面 UI 遵循当前架构决策：本项目 Web 首版为三栏 Shell；其他项目按其已批准布局验收，插槽/状态联动已验证。
- [ ] `locales.ts` 的中英文词条一致；UI 组件 CSS Modules 配套。
- [ ] 必要测试已执行，记录准确；类型检查、Lint、构建结果可查；涉及前端改动已通过 Agent 内置浏览器实测验收。
- [ ] 错误、资源清理、权限与异常路径已考虑。
- [ ] 新增/修改/删除的文件及文件夹已逐项写入 dev-log。
- [ ] 用户可见变化已写入 updata-log；无可见变化时标明不创建原因。
- [ ] Git diff 检查完成；未经授权未提交/推送/合并。
- [ ] 最终交付列明完成、未完成、风险、验证和下一步建议。

## 14. 与 DeepSeek Harness 原仓库的关系

以下内容通过 2026-11-17 对 `deepseek-ai/deepseek-harness` 默认分支源码和文档核对：

- [仓库架构（中文）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.zh.md)：Cordis 插件树、Service、事件、Profile、可逆注册。
- [Cordis 入门（中文）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.zh.md)：`inject`、服务、类型化事件、disposer。
- [包组索引（中文）](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.zh.md)：`packages/*/*` 下分组与独立 package。
- [Workspace 领域包](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/workspace/workspace) 与 [Workspace UI 包](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-workspace)：展示 DSH 当前**业务包与 UI 包分离**的模式。
- [Web 样式规范（中文）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/web-styling.zh.md)：CSS Modules、共享 Token、组件归属。
- [开发指南（中文）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/development.zh.md)：Host 与 Client 类型项目分离，pnpm 构建与校验。
- [测试策略（中文）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/testing.zh.md)：单元、集成、E2E、Web 验证。

**迁移关键区别**：原仓库 `packages/client/ui-workspace` 是独立 workspace package，`src/client` 是其浏览器入口；本项目将它收拢到 `packages/workspace/workspace/client`，但需要调整 Client 入口发现、模块打包、`exports`、UI 注册与 TS project references。这些不是简单移动文件就能自动完成。其余 DSH 规则应按新项目使用的 Cordis / 构建器版本进行可执行验证。

---

### 首版实施次序（建议）

1. **P0**：建立 `packages/*/*`、pnpm workspace、Host/Client TS 工程引用、Cordis 基础装配、根 `AGENTS.md`。
2. **P1**：先建立四栏共享 Shell、基础插槽和状态契约；通过一个真实 `workspace` 纵切片：Service + `client/` + 左侧菜单/中间工作视图/右侧上下文贡献 + i18n + CSS Modules + 卸载测试，证明“功能与 UI 同包”且四栏联动完整可行。
3. **P2**：建立 `ui/primitives`、`ui/theme`、`ui/slots` 共享基础设施，并通过第二个功能包验证复用与隔离。
4. **P3**：接入自动检查脚本、CI、Git 约定、dev-log/updata-log 模板与生成器。
5. **P4**：在上述约束真正通过测试后，再成规模添加业务插件；拒绝先铺满大量空包。

本文件是用于后续新项目开发的规范，不意味着上述 P0–P4 已实施。
