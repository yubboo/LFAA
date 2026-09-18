# LFAA 开发规范

> **当前唯一有效开发规范。**
> 用户说“按照开发规范开发 / 按照开发要求做”时，AI 必须把本文件当执行合同，而不是建议。

## 0. 唯一开发顺序

```text
01 读取当前事实源
02 分配任务 #NN.x + 功能名称 + 目标版本
03 先在 docs/PROMPTS.md 写 Prompt 合同
04 更新 PROJECT_PLAN / docs/DEVELOPMENT_LOG.md 的当前条目
05 冻结允许修改 / 禁止修改 / 验收条件 / 必须测试
06 才允许修改 Code
07 AI 自测 + 自动门禁 + 能做的实际运行验证
08 更新 Progress / Log / CHANGELOG / RELEASES
09 状态 = pending-user-acceptance
10 打包交给用户验收
11 用户验收通过后，下一次变更把对应记录改为 delivered
12 用户验收不通过：新子编号 + 新 Prompt + 新递增版本，禁止覆盖旧包
```

**用户没有明确验收前，AI 不得自行写 `delivered`。**

## 1. 开发前强制阅读顺序

1. `AGENTS.md`
2. `DEVELOPMENT.md`
3. `docs/README.md`
4. `docs/PROMPTS.md` 当前任务
5. `docs/DEVELOPMENT_LOG.md` 对应编号
6. `ARCHITECTURE.md`
7. `PROJECT_PLAN.md`
8. `docs/MODULES.md`
9. 任务相关的 `docs/UI.md` / `docs/TESTING.md` / `docs/RUNTIME.md`
10. `docs/项目结构与代码地图.md`（不熟悉目录/文件时）
11. Code

未完成必要阅读和 Prompt 合同前，禁止开始改业务代码。

## 2. 文档体系：按职责分文件，不按任务分文件

当前 `docs/` 只允许少量长期文档：

- `README.md`：文档入口；
- `项目结构与代码地图.md`：目录 / 文件导航；
- `PROMPTS.md`：所有 Prompt 时间线；
- `DEVELOPMENT_LOG.md`：所有开发日志时间线；
- `MODULES.md`：模块职责、Plan、Progress；
- `UI.md`：当前 UI 事实；
- `TESTING.md`：测试与验收；
- `RELEASES.md`：版本发布记录；
- `RUNTIME.md`：Sync / GitHub / Update / Setup 与运行日志规则。

禁止重新创建：

```text
docs/prompts/active/
docs/prompts/archive/
docs/logs/development/active/
docs/logs/development/archive/
docs/changelog/v*.md
docs/releases/v*/RELEASE.md
```

历史时间线采用“一个文件持续追加 `#编号 + 名称 + 版本 + 状态`”，不再靠目录移动表达新旧。

## 3. 当前事实与历史记录

当前事实可以覆盖更新：

- `DEVELOPMENT.md`
- `ARCHITECTURE.md`
- `PROJECT_PLAN.md`
- `docs/MODULES.md` 当前状态
- `docs/UI.md`
- `docs/TESTING.md`
- `docs/RUNTIME.md`

历史只能追加：

- `docs/PROMPTS.md`
- `docs/DEVELOPMENT_LOG.md`
- `CHANGELOG.md`
- `docs/RELEASES.md`

旧记录不删除、不伪造；被替代时修改状态并指向新编号。

## 4. Prompt 合同硬规则

每次新功能 / 修复都必须先在 `docs/PROMPTS.md` 新增条目，至少包含：

- 编号和功能名称；
- 主模块；
- 任务目标 / 背景；
- 允许修改 / 禁止修改；
- 状态所有权；
- 实现约束 / 安全约束；
- 验收条件；
- 必须测试；
- 必须更新的文档；
- CHANGELOG 编号；
- 版本目标；
- 当前状态；
- AI 验证；
- 用户验收。

需求变化：**先更新 Prompt 和 Development Log，再继续改代码。**

## 5. 状态机与验收

允许开发状态：

`planned → implementing → testing → pending-user-acceptance → delivered`

也允许：`blocked / superseded / cancelled`。

AI 的测试通过只代表 `pending-user-acceptance`，不能代表用户验收。

## 6. 代码可读性

关键实现文件必须有结构化中文文件头：作用、负责、不负责、状态归属、对外接口、关联文件、修改注意事项。

复杂算法说明“为什么”和不变量；CSS 按盒子 / 页面区域分区；重要目录必须有 README 或项目地图入口。

Windows `scripts/windows/*.ps1` 必须保持 UTF-8 with BOM。

## 7. 边界与执行安全

每次任务先明确：主模块、允许修改、禁止修改、State Owner、API / Protocol / DB / Security 是否变化。

执行能力唯一链路：

```text
Agent / Plugin / MCP / DSH
→ Capability / Tool Adapter
→ Tool Runtime
→ Policy Engine
→ Permission Engine
→ Rust Broker
→ OS
```

禁止绕过。

## 8. 包管理、版本与发布

Node workspace 只允许 pnpm。版本使用 `MAJOR.MINOR.PATCH`，`lfaa.release.json` 是版本事实源。

旧版本只读保留；任何修复进入新版本。ZIP 根目录必须直接是项目内容，不能再套 `lfaaXX/`。

## 9. 质量门禁

按改动范围执行 TypeScript / Rust / UI / Eval / 安全测试；发布前至少执行 `pnpm run governance:check` 和相关专项验证。

任何门禁失败都不能称为完成版。

## 10. Runtime / Stable Workspace

稳定 Git 工作区固定为用户实际稳定目录（当前 Windows 工作流为 `H:\\lfaa\\lfaa`）。版本包只作为同步来源；Sync / GitHub / Update / Setup 职责严格分离。详细规则见 `docs/RUNTIME.md`。

---

# 合并后的详细规范

以下章节由 v0.0.49 以前 `docs/standards/*.md` 合并而来。若与上方 0-10 节冲突，以上方当前规则为准。

> 迁移来源：`docs/standards/PACKAGING.md`

## LFAA 打包规范

### 正式包名

只允许：

```text
LFAA-v<MAJOR.MINOR.PATCH>.zip
```

例如：

```text
LFAA-v0.0.1.zip
```

禁止正式包名出现：

```text
-flat
-fixed
-final
-latest
-new
```

### ZIP 内部结构

ZIP 内部必须直接包含项目根内容。

禁止再次套一层 `LFAA-v版本号/`。

这样用户选择“解压到 LFAA-v0.0.1”时，最终只会产生一层项目目录。

### 发布前检查

- 包名符合版本规范
- ZIP 无双层根目录
- `lfaa.release.json` 与 package/Cargo 版本一致
- CHANGELOG/Release Notes 一致
- governance check 通过

### Windows 脚本编码验证

正式 ZIP 除了目录结构和中文路径外，还必须保证：

```text
scripts/windows/*.ps1
→ UTF-8 with BOM
```

打包前和 ZIP 解压 Round-trip 后都要验证 BOM 未丢失。

检查入口：

```text
node scripts/windows-script-encoding-check.mjs
```

> 迁移来源：`docs/standards/PERFORMANCE.md`

## LFAA 性能与资源预算规范

涉及运行时、数据库、UI、网络、Agent、Tool 或大文件的模块，在进入 `in-progress` 前必须定义：

- 测量场景与数据规模；
- P50/P95/P99 延迟；
- 吞吐或最大并发；
- CPU、内存、磁盘、网络预算；
- 超时、取消、背压；
- 可接受回归阈值。

UI 主线程不得执行数据库、文件扫描、模型调用或阻塞式系统操作。

SQLite 必须定义事务、busy timeout、WAL、索引、慢查询、Migration 和恢复预算。


### Web 开发启动预算

`LFAA-Setup.bat → 2 启动 Web` 属于高频开发操作。

性能要求：

- 端口检测不得逐个执行 1 秒级网络超时；
- 无已有 LFAA、5173 空闲时，端口解析应只做本机 Listener 查询；
- 已占用端口只探测实际 Listener；
- 单个 LFAA 识别请求超时应小于 500ms；
- 启动动作不得隐式执行 `pnpm install`；
- 缺依赖时快速失败，并提示运行菜单 1。

Windows 实机启动耗时需要在实际环境中记录，不允许用静态检查伪造性能通过。


### Web Terminal 性能

- xterm resize 必须使用 `ResizeObserver`；
- Shell I/O 使用 WebSocket/HMR 事件流，不允许轮询；
- 终端滚动缓冲默认限制，避免无限增长；
- PTY session 数量必须设置上限；
- UI 主线程不得直接执行进程操作。

> 迁移来源：`docs/standards/NAMING.md`

## LFAA 命名规范

### `-`

默认用于项目目录、package、普通 TS 文件单词分隔：

```text
agent-runtime/
left-sidebar/
model-router/
deepseek-harness/
```

### `_`

TypeScript 目录/文件默认禁止用 `_` 分隔单词。

允许：

- Rust module：`process_broker.rs`
- DB field：`session_id`
- Python
- 生成代码
- 上游兼容层必须保持原命名

### `.`

只用于：

- 语义职责后缀
- 文件扩展名
- 隐藏配置

```text
session.store.ts
session.types.ts
session.test.ts
.env.example
```

禁止：

```text
left.sidebar.ts
agent.runtime.ts
```

### React 组件

```text
LeftSidebar.tsx
AgentRunPanel.tsx
```

组件目录：

```text
left-sidebar/
agent-run-panel/
```

辅助文件：

```text
left-sidebar.types.ts
left-sidebar.store.ts
left-sidebar.test.tsx
```

### 禁止模糊命名

```text
utils2.ts
new-helper.ts
final-final.ts
abc.ts
common-all.ts
```



### 文档命名

#### 稳定目录

`docs/` 顶层目录使用短英文，作为稳定工具路径：

```text
standards
architecture
modules
plans
progress
prompts
logs
changelog
releases
testing
```

禁止随意增加同义目录，例如：

```text
doc
documents
notes
history-new
temp-docs
```

新增 docs 顶层目录必须先更新文档结构规范和治理检查。

#### 固定入口文件

保持固定名称：

```text
README.md
INDEX.md
PLAN.md
PROGRESS.md
RELEASE.md
```

#### 编号类人类文档

使用中文短名：

```text
NNNN-中文短名.md
NNNN-NN-中文短名.md
```

示例：

```text
0002-配置系统.md
0020-开发日志与文档规范.md
0020-01-历史编号迁移.md
```

#### 普通技术源码

继续遵守原代码命名规则，不因为文档支持中文就把源码文件全部改成中文。

### 中文文档硬要求

LFAA 自有文档：

- 中文为主；
- 标题清楚；
- 一项一项列明；
- 文件名能直接看懂职责；
- 英文只保留命令、路径、API、代码、专有名词。

禁止模糊命名：

```text
其他.md
新文档.md
最终版.md
最新版.md
说明2.md
```

> 迁移来源：`docs/standards/VERSIONING.md`

## LFAA 版本规范

### 1. 正式版本格式

LFAA 统一使用标准三段式版本号：

```text
主版本.次版本.修订版本
MAJOR.MINOR.PATCH
```

首个版本：

```text
0.0.1
```

正式项目包：

```text
LFAA-v0.0.1.zip
```

### 2. 版本递增规则

每次正常小版本递增 PATCH：

```text
0.0.1
0.0.2
0.0.3
...
0.0.99
```

累计 100 个 PATCH 版本后进入下一 MINOR：

```text
0.0.99
→
0.1.0
```

之后继续：

```text
0.1.1
0.1.2
...
0.1.99
→
0.2.0
```

当项目进入明确的大版本阶段时再提升 MAJOR：

```text
0.x.x
→
1.0.0
```

MAJOR 提升必须有明确架构/产品级发布决策，不按普通小版本自动提升。

### 3. 正式发行文件名

必须使用：

```text
<项目简称>-v<MAJOR.MINOR.PATCH>.<ext>
```

源码/项目包：

```text
LFAA-v0.0.1.zip
```

桌面发行包：

```text
LFAA-v0.0.1-windows-x64.exe
LFAA-v0.0.1-macos-arm64.dmg
LFAA-v0.0.1-linux-x64.AppImage
```

正式包名禁止增加：

```text
flat
fixed
final
new
new2
latest
```

这类临时后缀。

### 4. ZIP 目录规则

正式 ZIP 内部直接放项目内容，不额外嵌套同名顶层目录。

正确：

```text
LFAA-v0.0.1.zip
解压到 LFAA-v0.0.1/
├── apps/
├── packages/
├── crates/
├── docs/
└── ...
```

禁止：

```text
LFAA-v0.0.1/
└── LFAA-v0.0.1/
```

### 5. 版本唯一来源

版本统一由：

```text
lfaa.release.json
```

作为项目级版本事实源。

构建/发布脚本负责同步：

- root `package.json`
- workspace package versions
- Rust crate versions
- CHANGELOG
- Release Notes
- 最终包名

禁止开发者在多个位置手工维护互相冲突的版本。

### 6. 兼容版本独立

以下版本不得与产品版本混为一谈：

- Agent Protocol Version
- Plugin API Version
- Database Schema Version
- DSH Compatibility Version

例如：

```text
Product: 0.0.1
Agent Protocol: 1
Plugin API: 1
DB Schema: 1
DSH Compatibility: 0.1
```

> 迁移来源：`docs/standards/SECURITY.md`

## LFAA 安全开发规范

### 1. 信任模型

Model 输出、React/Web 输入、文档、Skills、Experts、Plugins、Extensions、MCP、Tool 参数、网络响应和项目内外部可修改文件默认不可信。

### 2. 不可绕过链路

```text
Untrusted Input
→ typed capability
→ Tool Runtime
→ Policy
→ Permission / Approval
→ Rust Broker re-validation
→ OS
```

### 3. Full

`Full` 只减少逐次询问，不绕过硬拒绝、项目边界、Secret 隔离、系统保留路径、capability 范围和 Rust Broker 校验。

### 4. Secret

Secret 不得进入普通 SQLite、模型上下文、Event Store、日志、Trace、错误、崩溃报告、`.lfaa/`、Git 和发行包。

### 5. Remote / Web

交付前必须具备 TLS、身份认证、逐资源授权、隔离、CSRF/CORS/Origin 校验、限流、超时和审计。


### 6. Web 开发终端

Vite Web 可以提供本地开发期真实终端，但必须与 Agent Tool Runtime 严格区分。

允许：

```text
人类在浏览器中直接键入
→ localhost Vite dev bridge
→ node-pty
→ 本地 Shell
```

要求：

- 仅 `127.0.0.1`；
- cwd 限定为当前项目根起点；
- 不自动提升权限；
- 不自动读取或注入 Secret；
- 页面 / dev server 结束时回收 PTY；
- 不允许 Agent 通过该开发桥接自动执行命令。

未来 Agent 自动 Shell 必须走正式：

```text
Tool Runtime → Policy → Permission → Rust PTY Broker → OS
```

> 迁移来源：`docs/standards/PROJECT_IDENTITY_AND_ATTRIBUTION.md`

## LFAA 项目身份、命名、版权与第三方归属规范

### 1. 项目身份

- 产品：Little Fish AI Agent
- 简称：LFAA
- 作者署名：二鱼
- 官方命名空间：`lfaa`、`@lfaa/*`、`lfaa-*`

### 2. 官方命名

所有 `package.json` 必须写入 `"author": "二鱼"`，所有 LFAA Rust crate 必须写入 `authors = ["二鱼"]`。

### 3. 自有文件署名

重要的新源码、脚本、模板可使用：

```text
Copyright (c) 2026 二鱼.
Part of the LFAA project.
```

根许可证尚未确定前，不得擅自填写虚构 SPDX 标识。

### 4. 第三方成果

必须确认许可证、保留版权与许可证，并在 `NOTICE.md` 或模块 NOTICE 中记录来源和修改范围。

### 5. AI 生成内容

AI 参与不改变责任归属；无法确认来源的长代码片段不得直接进入仓库。

> 迁移来源：`docs/standards/COMMENTS.md`

## 中文代码注释与可读性规范

> 目标不是“给每一行翻译中文”，而是让第一次打开项目的人能知道：这个文件干什么、状态归谁、和谁关联、页面哪块由它负责。

### 1. 关键实现文件必须有结构化文件头

关键 TS / TSX / JS / MJS / CSS / PowerShell 文件必须在文件开头说明：

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

TypeScript 示例：

```ts
/**
 * 文件：AgentWorkbench.tsx
 * 作用：共享工作台壳。
 * 负责：区域编排和 Shell UI 状态。
 * 不负责：PTY 创建和拖拽算法。
 * 状态归属：Shell collapsed/open 状态归本组件。
 * 对外接口：AgentWorkbench。
 * 关联文件：agent-workbench.css、ResizableWorkbench.tsx。
 * 修改注意事项：不要制造第二份 collapsed 状态。
 */
```

PowerShell 使用同样字段的 `#` 注释。

### 2. 什么叫“关键实现文件”

至少包括：

- 页面 / Feature 主组件；
- Layout / 状态 Owner；
- 与 OS / 网络 / PTY / 文件系统交互的桥接代码；
- 关键类型契约；
- 关键 CSS；
- Setup / Sync / GitHub / Update 等用户会直接运行的脚本；
- 治理 / 安全检查脚本。

纯占位骨架可以使用较短模块说明，但一旦加入真实逻辑，就升级为完整文件头。

### 3. 复杂代码必须解释“为什么”

重点注释：

- 为什么这样设计；
- 状态为什么归这个文件；
- 边界在哪里；
- 与哪些模块关联；
- 哪些事情明确不属于本文件；
- 算法的关键不变量；
- 容易被误改的地方。

例如拖拽吸附要说明：

```text
为什么使用 requestAnimationFrame
为什么需要 hysteresis
为什么 collapsed 后 separator 不能反向展开
```

禁止把每一行代码逐字翻译成中文制造噪声。

### 4. CSS 必须按“盒子 / 区域”分区

关键 CSS 文件除了文件头，还必须写清楚 DOM / 盒子关系。

推荐：

```css
/**
 * 文件：agent-workbench.css
 * 盒子结构：
 * .agent-theme
 * ├─ .agent-web-header
 * └─ .agent-workbench-stage
 *    └─ .agent-center
 */

/* ===== 1. 全局和主题 ===== */
/* ===== 2. 左右侧栏 ===== */
/* ===== 3. 中间主区 ===== */
/* ===== 4. 输入框 ===== */
/* ===== 5. 右栏 ===== */
/* ===== 6. 终端 ===== */
```

CSS 注释必须能回答：

- 这组 selector 对应页面哪一块；
- 这个盒子的父子关系是什么；
- 几何布局由当前文件还是另一个 Layout 文件负责。

### 5. 目录必须能被人读懂

项目一级业务 / 技术目录应有 README 或在项目地图中有明确入口。

当前总地图：

```text
docs/项目结构与代码地图.md
```

至少需要覆盖：

- 根目录文件 / 目录；
- `apps/`；
- `packages/`；
- `crates/`；
- `scripts/`；
- `docs/`；
- 当前重点功能的源码调用链。

目录职责发生变化时，必须同步项目地图。

### 6. 代码与文档必须互相指路

关键源码文件头的“关联文件”要指向直接相关实现。

目录 README / 项目地图则要从人类视角告诉读者“下一步去哪”。

例如 Web UI：

```text
App.tsx
→ AgentWorkbench.tsx
→ agent-workbench.css
→ ResizableWorkbench.tsx
→ workbench.css
→ LocalTerminal.tsx
→ vite.config.ts
```

### 7. 治理门禁

关键文件注释由：

```text
scripts/comment-check.mjs
```

检查。

`governance:check` 必须包含该检查，防止以后新增真实逻辑后又出现“代码能跑，但没人看得懂”的回退。

### 8. Windows PowerShell 注释与编码必须同时成立

`scripts/windows/*.ps1` 既属于关键实现文件，也属于 Windows PowerShell 5.1 可直接执行的用户脚本。

因此必须同时满足：

```text
结构化中文文件头
+
UTF-8 with BOM
```

禁止出现：

```text
为了统一 UTF-8 no BOM
→ 重写 .ps1
→ BOM 丢失
→ Windows PowerShell 5.1 误解码
```

任何批量格式化、脚本生成、Python/Node 重写 `.ps1` 时都必须显式保留 BOM。

自动检查：

```text
node scripts/windows-script-encoding-check.mjs
```

> 迁移来源：`docs/standards/QUALITY_GATES.md`

## LFAA 质量门禁规范

### 1. 禁止假成功

`build`、`typecheck`、`test`、`lint`、`security` 等质量命令必须执行真实检查。尚未实现时必须明确返回失败。

### 2. 最小合入门禁

- 治理一致性；
- 格式化；
- lint 零 warning；
- TypeScript `tsc --noEmit`；
- 单元/集成/协议契约测试；
- 真实 build；
- Rust 相关检查；
- 依赖边界；
- 安全扫描和依赖审计；
- 无无关文件修改；
- 关键实现文件结构化中文注释检查；
- 项目结构 / 目录职责文档同步检查；
- Windows PowerShell `UTF-8 with BOM` 编码检查；
- 当前发布版本 / CHANGELOG / Release 一致性检查；
- Web Shell Tooltip 单一提示源与鼠标事件契约检查。

### 3. Node.js 工具链

Node.js 依赖安装和 workspace 任务统一使用 pnpm。CI、本地脚本和文档命令不得混用 npm/npx/yarn/bun。

### 4. 变更分级

A：架构、安全、协议、数据库。  
B：普通功能。  
C：局部缺陷、文档和低风险脚本修复。


### 5. Setup 菜单依赖安装语义

`LFAA-Setup.bat` 菜单 `1` 用于安装“当前环境可用”的全部项目依赖：

- Node + pnpm/corepack 可用：安装 Node workspace 依赖；
- Cargo 可用：安装 Rust workspace 依赖；
- 某一工具链缺失：明确显示跳过，不得把已完成的另一类依赖安装误判为整体失败；
- 两类工具链都不可用：才视为菜单 1 无法执行。

菜单 `4`（Rust 依赖）和菜单 `10`（完整检查）属于严格操作，缺少 Cargo 时必须失败，不能伪装通过。


### Setup 环境检测真实性

环境准备不得使用以下方式伪造“已安装”：

- 只检查 `node_modules/` 是否存在；
- 只检查目录大小；
- 只检查命令名，不检查项目要求版本；
- Cargo 缺失时仍显示全部完成。

本地 Setup 依赖准备以：

```text
pnpm install
```

的真实结果为准，允许在开发新增依赖后同步 lockfile。

CI、正式质量门禁和可复现验证必须使用：

```text
pnpm install --frozen-lockfile
```

Rustup 自动下载必须来自 Rust 官方 HTTPS 地址，并在执行前通过官方 SHA-256 校验。


#### Rust 工具链安装诊断

Rust 工具链自动准备必须满足：

1. 支持 `CARGO_HOME` 自定义路径；
2. Rust 缺失时直接使用官方 `rustup-init`；
3. Windows 必须先检测宿主 CPU 架构并映射到官方 target tuple；
4. Rust 官方 `rustup-init` 只允许从官方 HTTPS 来源下载；
5. 执行前必须通过官方 SHA-256；
6. 官方 rustup 原始输出允许保留英文；
7. LFAA 自身状态提示必须中文清楚。

Windows 当前允许的 Rustup target：

```text
x86_64-pc-windows-msvc
aarch64-pc-windows-msvc
i686-pc-windows-msvc
```


#### Rust 工具链分层

- `rustup` / toolchain 使用共享安装，避免多项目重复占用空间；
- 根 `rust-toolchain.toml` 是项目 Rust 版本事实源；
- Setup 不得执行 `rustup default` 改写用户全局默认；
- `Cargo.lock` 必须跟项目走；
- Cargo build `target` 属于项目构建缓存；
- `CARGO_HOME` / `RUSTUP_HOME` 可自定义到非系统盘。


### 工具链与项目依赖边界

质量检查按以下边界判断环境是否完整：

```text
电脑基础工具
→ Node / pnpm / Git / Rust / Cargo

项目内容
→ node_modules / Cargo.lock / rust-toolchain.toml / target / .lfaa
```

禁止为了“项目隔离”给每个项目复制完整 Rust 工具链。

Rust 自动安装只走 Rust 官方 `rustup-init`：

- 官方 HTTPS；
- 官方 `.sha256`；
- 本地 SHA-256 校验；
- 校验通过后执行。

已有 Rust/Cargo 直接复用，不迁移、不覆盖。


#### pnpm 原生构建脚本门禁

- `strictDepBuilds` 必须保持 `true`；
- 原生依赖必须以精确包名 + 版本进入 `allowBuilds`；
- 当前批准：`node-pty@1.1.0`；
- 禁止 `dangerouslyAllowAllBuilds: true`；
- 菜单 1 安装后必须验证 node-pty 可以被 Node 实际加载。


#### node-pty Smoke Check

- 菜单 1 安装后必须验证 `node-pty` 可以被 Node 实际加载；
- node-pty Smoke Check 必须使用独立脚本文件；
- 禁止用依赖复杂引号的 `node -e` 内嵌代码作为 Windows PowerShell 校验；
- 当前校验入口：`scripts/check-node-pty.mjs`；
- 必须检查 `pty.spawn` 为函数。


### 代码可读性门禁

关键实现文件必须通过：

```text
node scripts/comment-check.mjs
```

该检查至少验证结构化文件头、关联文件说明和关键 CSS 分区注释。


### Windows 脚本编码门禁

所有 `scripts/windows/*.ps1` 必须通过：

```text
node scripts/windows-script-encoding-check.mjs
```

该门禁用于防止 Windows PowerShell 5.1 因 BOM 丢失而错误解析中文脚本。

### 发布版本一致性门禁

正式发布前必须通过：

```text
node scripts/release-consistency-check.mjs
```

它以 `lfaa.release.json` 为唯一版本事实源，检查 package / crate / README / CHANGELOG / Changelog / Release 是否仍混用旧版本。


### Web UI 静态契约门禁

工作台 Shell Header 的三个框架按钮必须通过：

```text
node scripts/ui-contract-check.mjs
```

该检查禁止 `title + 自定义 Tooltip` 双提示源，并要求 Tooltip `pointer-events:none`，防止提示层抢 Hover / Click。

> 迁移来源：`docs/standards/IMPORT_PATHS.md`

## LFAA 导入路径规范

> 本规范用于避免 `../../../` 深层相对路径、跨模块内部引用和未来目录重构造成的大面积修改。

### 1. 三种导入方式

#### 1.1 同目录 / 同一小模块内部

使用相对路径：

```ts
import { type SidebarItem } from "./left-sidebar.types";
import { SidebarItem } from "./SidebarItem";
```

#### 1.2 当前 App / Package 内跨目录

使用：

```text
@/
```

`@/` 永远表示**当前 workspace 的 `src/`**。

示例：

```ts
import { useNavigationStore } from "@/features/navigation/navigation.store";
import { createSession } from "@/services/session.service";
```

#### 1.3 跨 LFAA Workspace Package

使用真实 pnpm workspace package：

```text
@lfaa/*
```

示例：

```ts
import { type AgentEvent } from "@lfaa/protocol";
import { type AgentRun } from "@lfaa/domain";
import { Button } from "@lfaa/ui";
```

`@lfaa/*` 必须来自真实 `package.json.name`，不是靠 TypeScript `paths` 伪造。

---

### 2. 禁止深层相对路径

禁止：

```ts
import x from "../../something";
import x from "../../../something";
import x from "../../../../something";
```

默认规则：

- `./`：允许；
- 单层 `../`：仅限同一 Feature/模块内部确有必要时；
- `../../` 及更深：禁止，改用 `@/` 或 `@lfaa/*`。

---

### 3. 禁止跨 Package Internal

禁止：

```ts
import x from "@lfaa/domain/src/internal/x";
import x from "@lfaa/tool-runtime/src/x";
```

跨 Package 只能使用对外公开 Export：

```ts
import { x } from "@lfaa/domain";
```

如模块需要新增公共能力：

1. 在该 Package `src/index.ts` 增加明确 Export；
2. 更新该模块 README；
3. 如属于公共协议变更，记录 Prompt / Progress / Changelog。

---

### 4. `@/` 配置

每一个 TypeScript App / Package 自己拥有 `tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

特殊深度目录按实际路径调整 `extends`。

`@/` 不在根 `tsconfig.base.json` 中统一指向某个目录，因为每个 workspace 的 `@/` 都必须指向自己的 `src/`。

---

### 5. 构建工具必须同步识别

仅 TypeScript 能识别别名还不够。

以后启用真实构建工具时必须保证：

```text
TypeScript
Vite
Vitest
Electron build
Node bundle
```

对 `@/` 的解释一致。

如果某个运行环境不能解析 `@/`，不得临时退回 `../../../`；应该修复该 workspace 的构建配置。

---

### 6. Rust 不使用 `@/`

Rust 保持 Rust 原生模块路径：

```rust
use crate::process::ProcessRequest;
use super::ProcessState;
use lfaa_native_protocol::ProcessRequest;
```

禁止为了“统一视觉”给 Rust 发明自定义 `@` Alias。

---

### 7. 快速判断

```text
兄弟文件
→ ./

当前 workspace 内跨目录
→ @/

跨 LFAA workspace
→ @lfaa/*
```

> 迁移来源：`docs/standards/PROJECT_RESOURCES.md`

## LFAA 项目级资源与热插拔规范

### 1. 唯一项目资源根

LFAA 项目资源只允许位于：

```text
<project>/.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
├── mcp/
├── manifest.json
└── lock.json
```

禁止同时使用：

```text
<project>/skills/
<project>/plugins/
```

作为 LFAA 项目资源目录。

这样可以避免用户项目自身已经存在同名目录时发生冲突，也避免出现多个事实源。

### 2. `.lfaa` 的含义

`.lfaa` 是 LFAA 在项目中的专属 namespace，类似 `.git`、`.vscode`。

点号本身不会阻止程序访问：

- Windows：点号目录不是天然不可访问；
- Electron / Node.js：可以通过普通文件 API 读取和监听；
- Rust：可以通过普通 Path/File Watcher 读取和监听；
- macOS/Linux：默认文件管理器可能不展示点号目录，但程序访问不受影响。

Desktop UI 必须提供“打开项目资源目录”和资源管理界面，因此普通用户不需要依赖文件管理器显示隐藏文件。

### 3. 热插拔目录

后续 Resource Registry / File Watcher 必须显式监听：

```text
.lfaa/skills/
.lfaa/experts/
.lfaa/plugins/
.lfaa/extensions/
.lfaa/mcp/
```

文件变化处理流程：

```text
filesystem event
→ debounce
→ rescan changed resource
→ schema / manifest validation
→ source / version / hash / license validation
→ capability validation
→ build new registry generation
→ atomic publish
```

### 4. 运行中任务的一致性

热插拔不能直接修改正在执行中的资源对象。

规则：

- 新资源或新版本生成新的 registry generation；
- 新 Run 使用最新 generation；
- 已经开始的 Run 保持原 generation 引用直到结束；
- 删除资源只阻止新 Run 获取它；
- 正在执行的实例必须安全完成或按运行时取消协议退出。

这样可以避免用户替换 Plugin/Skill 时破坏正在运行的 Agent。

### 5. manifest / lock

```text
manifest.json
→ 项目声明希望使用哪些资源

lock.json
→ 实际解析到的来源、版本、哈希、许可证
```

资源安装和更新必须原子化，不能写到一半就被 Registry 加载。

### 6. 本机运行数据

```text
.lfaa/cache/
.lfaa/state/
.lfaa/tmp/
.lfaa/logs/
```

属于本机运行数据，不作为项目资源事实源，不进入正式发布包中的运行时内容。

### 7. Secret

Secret 明文禁止进入 `.lfaa/`。

只允许保存：

```text
credential_ref
```

真实 Secret 由 OS Credential Store / Rust Secret Broker 持有。

> 迁移来源：`docs/standards/MODULE_BOUNDARIES.md`

## 模块边界规范

### 依赖方向

```text
UI
↓
Feature/Application
↓
Agent Client/Protocol
↓
Runtime
↓
Tool/Policy/Permission
↓
Rust Broker
↓
OS
```

只能向下依赖。

### Public / Internal

重要 package 后续可使用：

```text
src/public/
src/internal/
src/index.ts
```

包外只能通过 package public export。

禁止：

```ts
import x from "@lfaa/package/src/internal/x";
```

### State Owner

同一个事实状态只允许一个 Owner。

禁止 UI Store、Feature Store、Runtime 各存一份相同真值。

### 父子级

Child 不直接修改 Parent 私有状态。

Agent Child 不共享 Parent 可变内部状态。


### Import Boundary

跨模块依赖必须使用可识别的公开边界：

```text
同目录
→ ./

当前 workspace
→ @/

跨 workspace
→ @lfaa/*
```

禁止：

```text
../../
@lfaa/package/src/internal/*
```

导入路径规范属于架构边界，而不是代码风格偏好。

## 历史规范快照：旧 Prompt / Development Log 文件制（已被 v0.0.50 取代）

> 以下仅用于解释迁移前为何存在大量 active/archive Markdown；不是当前执行规则。

> 迁移来源：`docs/standards/PROMPTS.md`

### 开发 Prompt 规范

每个新业务先创建：

```text
docs/prompts/active/NNNN-中文短名.md
```

同一主任务的补充变更可使用：

```text
NNNN-NN-中文短名.md
```

任务完成后进入：

```text
docs/prompts/archive/<version>/
```

#### Prompt 模板

```md
### #编号 问题名

#### 主模块
#### 任务目标
#### 背景
#### 允许修改
#### 禁止修改
#### 状态所有权
#### 输入
#### 输出
#### 关联模块
#### 实现约束
#### 安全约束
#### 验收条件
#### 必须测试
#### 必须更新的文档
#### CHANGELOG 编号
#### 版本目标
```

Prompt 是任务合同。

需求变化：

```text
先更新 Prompt
→ 更新 Development Log
→ 再改代码
```

> 迁移来源：`docs/standards/DEV_LOGS.md`

### 开发日志规范

> 开发日志用于记录需求、设计、架构和规则的变化。
> 机器运行日志不属于开发日志。

#### 1. 固定目录

```text
docs/logs/development/
├── README.md
├── INDEX.md
├── active/
└── archive/
```

#### 2. 当前与历史分开

```text
active/
→ 当前仍生效

archive/
→ 已交付、已替代或已废弃
```

开发时先查 `active/`，历史只用于对比。

#### 3. 文件命名

##### 当前主日志

```text
NNNN-中文短名.md
```

示例：

```text
0020-开发日志与文档规范.md
```

##### 历史变更

```text
NNNN-NN-中文短名.md
```

示例：

```text
0020-00-开发日志初始分层.md
0020-01-历史编号迁移.md
```

文件名不使用：

```text
0020.1-dev-logs.md
```

这种人类难以直接理解的格式。

#### 4. 编号显示

文档内部继续使用：

```text
#20
#20.1
#20.2
```

文件名里的：

```text
0020-01
```

对应：

```text
#20.1
```

#### 5. 中文命名要求

文件名必须：

- 至少包含中文；
- 短、准、可搜索；
- 通常 4 到 12 个汉字；
- 技术专有名词可保留，例如 Git、GitHub、pnpm、Cargo、Setup；
- 不使用完整需求句子。

禁止：

```text
dev-logs
final
latest
new
fix2
```

#### 6. Active 日志必须包含

```text
主编号：
名称：
最新变更：
状态：
关键词：
当前文件：

#### 当前结论
#### 最新变更
#### 影响范围
#### 验证结果
#### 历史索引
```

#### 7. Archive 规则

允许状态：

```text
delivered
archived
superseded
deprecated
```

##### superseded

必须写：

```text
已由：
当前查看：
```

##### delivered / archived

必须写：

```text
#### 原始来源
```

#### 8. INDEX 规则

每个真实主编号必须直接出现在：

```text
docs/logs/development/INDEX.md
```

不能只写“去旧目录找”。

索引至少包含：

- 主编号；
- 名称；
- 最新变更；
- 状态；
- 关键词；
- 文件路径。

#### 9. 开发前读取

用户说：

```text
按照开发要求做
```

必须：

```text
DEVELOPMENT.md
→ docs/logs/development/INDEX.md
→ 匹配任务的 active 日志
→ Architecture / Plan / Progress / Prompt / Standards
→ Code
```

#### 10. 开发后记录

发生以下变化必须更新：

- 用户要求；
- 设计；
- 架构；
- 安全规则；
- 文件/目录职责；
- 工具行为；
- 已有方案修正。

同一问题追加：

```text
#NN.x
```

独立问题才新建主编号。

#### 11. 历史不能消失

- 旧记录不删除；
- 主编号不能无记录缺失；
- 原 Prompt / Progress / Changelog / Release 保留；
- Development Log 是索引和摘要，不替代原始历史。

#### 12. 不伪造历史

不存在的编号不补造。

当前真实历史从 #1 开始，因此不创建虚假 #0。
