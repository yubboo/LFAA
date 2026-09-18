# LFAA 开发规范

> 当前唯一有效开发规范。
> 用户说“按照开发规范开发”时，默认必须执行本文件、`AGENTS.md`、当前架构、当前模块 Plan/Progress 与当前任务 Prompt。

## 1. 开发目标

LFAA 必须长期做到：

- 模块一眼可定位；
- 当前架构一眼可判断；
- 历史架构不会污染当前开发；
- 当前开发进度一眼可判断；
- 父子级状态边界明确；
- 改一个子模块不牵动无关父模块；
- AI 不靠全仓库盲搜猜结构；
- 所有业务有 Prompt；
- 所有模块有 Plan；
- 所有开发有 Progress 留痕；
- 所有业务变更有 Changelog；
- 所有可交付版本可追溯。
- 所有 LFAA 自有成果身份明确；
- 所有第三方成果保留来源、作者和许可证；
- 所有 Skills、Experts、Plugins、Extensions 与 MCP 资源跟随项目；
- 所有性能、安全与质量要求可测量、可自动验证。

---

## 2. AI 四大规则

### 规则一：文档先行

开发前：

```text
AGENTS.md
→ DEVELOPMENT.md
→ ARCHITECTURE.md
→ PROJECT_PLAN.md
→ Module README
→ Module PLAN
→ Module PROGRESS
→ Active Prompt
→ Code
```

没有读完，不修改代码。

### 规则二：边界优先

每个任务开始前必须明确：

- 主开发模块；
- 允许修改模块；
- 禁止修改模块；
- 允许新增文件；
- 状态 Owner；
- 对外 API；
- 是否改 Agent Protocol；
- 是否改 DB Schema；
- 是否改安全边界。

未明确允许的区域默认不修改。

### 规则三：验证闭环

至少执行：

- TypeScript typecheck；
- 相关单元测试；
- 相关集成测试；
- Rust `cargo test` / `cargo check`（涉及 Rust 时）；
- UI 变更对应 UI/E2E；
- Agent 行为对应 Eval / Trace；
- Durable Run 对应 Resume / Crash Recovery；
- 权限/执行对应安全路径检查；
- 无无关文件修改检查。

### 规则四：全程可追溯

每次新业务必须同步：

- Prompt；
- Plan；
- Progress；
- 中文代码注释；
- 模块 README；
- 测试记录；
- CHANGELOG；
- 达到发布条件时同步版本与发行记录。

---

## 3. 模块聚焦开发

### 3.1 一次一个主模块

当前模块没有达到：

```text
deliverable
```

前，原则上不切换无关模块。

### 3.2 示例：配置系统

如果当前主模块：

```text
config-system
```

必须围绕它依次完成：

```text
config-system
├── settings
├── model-management
├── account-management
├── permission-settings
├── config-storage
├── config-ui
├── tests
└── docs
```

不要中途跳去写 Browser Agent、Plugin Marketplace 或 Knowledge UI。

### 3.3 允许跨模块的情况

仅允许：

1. 当前模块被基础依赖阻塞；
2. 当前模块需要公共 Protocol 变更；
3. P0/P1 缺陷阻塞开发；
4. 安全问题必须立即修复。

跨模块前必须写入当前模块 `PLAN.md` 和 `PROGRESS.md`。

---

## 4. 统一开发状态

只能使用：

```text
pending-development   待开发
planned               已计划
in-progress           进行中
pending-test          待测试
testing               测试中
pending-optimization  待优化
deliverable           可交付
not-delivered         未交付完成
delivered             交付完成
blocked               阻塞
deprecated            已废弃
archived              已归档
```

推荐流转：

```text
pending-development
→ planned
→ in-progress
→ pending-test
→ testing
→ deliverable
→ delivered
```

需要优化：

```text
testing
→ pending-optimization
→ in-progress
```

不能交付：

```text
not-delivered
```

---

## 5. Plan 制度

每个主模块必须存在：

```text
docs/plans/modules/<module>/PLAN.md
```

至少包含：

- 开发目的；
- 范围；
- 子模块；
- 开发顺序；
- 依赖；
- 非目标；
- 验收条件；
- 测试计划；
- 风险；
- 版本目标；
- 当前状态。

Plan 变更时先改 Plan，再改代码。

---

## 6. Progress 留痕

每个主模块必须存在：

```text
docs/progress/modules/<module>/PROGRESS.md
```

每次开发后追加：

- 日期；
- 任务编号；
- 当前状态；
- 本次目标；
- 已完成；
- 进行中；
- 待开发；
- 待测试；
- 测试结果；
- 待优化；
- 阻塞项；
- 是否可交付；
- 是否已交付；
- 涉及文件；
- 下一步。

Progress 记录事实，不写“预计已经完成”。

---

## 7. 命名规则摘要

详细见：

`docs/standards/NAMING.md`

原则：

- 目录默认 `kebab-case`
- React 组件文件 `PascalCase.tsx`
- TS 业务文件 `<name>.<role>.ts`
- `_` 不用于 TS 文件/目录单词分隔
- Rust module 允许 `snake_case.rs`
- DB 字段允许 `snake_case`
- `.` 只表示职责后缀、扩展名或隐藏配置

---

## 8. UI / Feature / Runtime 边界

### UI

负责：

- 展示；
- 用户交互；
- local visual state。

不负责：

- SQLite；
- Agent Runtime；
- Rust；
- Provider SDK；
- Secret；
- Tool 执行。

### Feature / App Shell

负责：

- 页面业务；
- Feature state；
- Use Case 编排。

### Runtime / Domain

负责：

- Session；
- Run；
- Agent；
- Tool；
- Permission；
- Model；
- Knowledge；
- Plugin。

同一事实状态只能有一个 Owner。

---

## 9. 父子级规则

### UI

```text
Parent
↓ props / command
Child
↓ event / result
Parent
```

禁止 Child 直接 import Parent 私有 Store 并修改。

### Agent

```text
Parent Agent
↓ ChildRunRequest
Child Agent
↓ ChildRunEvent / ChildRunResult / ArtifactRef
Parent Agent
```

Child 默认不能继承：

- 全部 Secret；
- 全部 Tool；
- 全部 Context；
- 全部 Permission。

必须显式授予。

---

## 10. 中文注释

重要源码文件必须使用文件头注释：

```ts
/**
 * 文件：
 * 作用：
 * 负责：
 * 不负责：
 * 状态归属：
 * 对外接口：
 * 关联文件：
 * 修改注意事项：
 */
```

注释重点说明边界、设计原因和关联，不做逐行中文翻译。

---

## 11. 新业务标准流程

```text
确认主模块
→ 更新 PLAN
→ 创建 Active Prompt
→ PROGRESS 标记 in-progress
→ 实现
→ 测试
→ 更新模块 README
→ 更新 PROGRESS
→ 更新 CHANGELOG
→ 判断 deliverable / not-delivered
→ 达到发布条件后更新版本与 Release
```

---

## 12. Definition of Done

只有同时满足才算完成：

- Prompt 与实际需求一致；
- Plan 与实现一致；
- 代码完成；
- 中文注释完整；
- 测试通过；
- 无无关修改；
- README 同步；
- Progress 留痕；
- Changelog 更新；
- 明确 `deliverable` / `delivered` / `not-delivered`。


---

## 13. 打包规范

正式发行必须遵守：

`docs/standards/PACKAGING.md`

正式包名只允许：

```text
LFAA-v<MAJOR.MINOR.PATCH>.zip
```

不得加入 `flat`、`fixed`、`final`、`latest` 等临时后缀。


---

## 14. 导入路径强制规范

完整规范：

`docs/standards/IMPORT_PATHS.md`

统一规则：

```text
同目录 / 同小模块
→ ./

当前 workspace 内跨目录
→ @/

跨 LFAA package
→ @lfaa/*
```

禁止：

```text
../../
../../../
../../../../
```

禁止跨 package 访问：

```text
@lfaa/<package>/src/internal/*
```

任何新 TypeScript workspace 必须建立自己的 `tsconfig.json`，让 `@/*` 指向本 workspace 的 `src/*`。

`@lfaa/*` 必须是真实 pnpm workspace package，不允许用 `paths` 假映射代替。

修改导入边界后必须执行：

```text
npm run imports:check
```


---

## 15. 稳定工作区与版本快照

完整规范：

`docs/standards/WORKSPACE_SYNC.md`

固定原则：

```text
版本快照
LFAA-v0.0.x
    ↓ LFAA-Sync.bat
稳定工作区
H:\lfaa\lfaa
    ↓ LFAA-GitHub.bat
GitHub
```

`.git` 只常驻稳定工作区。

每个正式版本包必须自带 Sync、GitHub、Update、Setup 启动器与对应 PowerShell 脚本，以便迁移、更新和误删后恢复。

同步脚本必须：

1. 先真实对比；
2. 列举所有新增/修改/删除路径；
3. 用户确认后执行；
4. 保护 `.git` / Secret / 本地缓存；
5. 同步后重新做 SHA-256 完整校验；
6. 产生同步日志到 `docs/logs/workspace-sync/`。

禁止使用不可审查的“直接覆盖”脚本。


---

## 16. GitHub 提交名称与推送规则

`LFAA-GitHub.bat` 只作为启动器，真实逻辑必须在：

```text
scripts/windows/lfaa-github.ps1
```

Commit 名称由用户每次手工输入，包括首次提交。

禁止脚本自动固定：

```text
first commit
chore: update ...
```

而不允许用户修改。

GitHub Push 前必须显示文件变化并二次确认。


---

## 17. Git origin 配置

Git 远程地址属于稳定工作区 Git 配置。

唯一事实源：

```text
.git/config
```

首次没有 `origin` 时，推送脚本必须询问用户并保存。

后续不得重复要求输入，也不得在代码里写死某个 GitHub 仓库地址。


---

## 18. 终端结束状态必须明确

任何 LFAA 一键脚本在退出前必须明确显示：

- 成功 / 失败；
- 是否已经彻底结束；
- 用户现在是否可以关闭终端。

禁止脚本执行完后只留下一个空白光标，让用户猜测是否仍在运行。


---

## 19. Git Commit 交互规则

用户在：

```text
【输入】【提交名称】
```

完成输入后，即视为确认创建本地 Commit。

脚本不得再次询问：

```text
是否确认创建 Commit
```

Push 属于远程写操作，因此 Push 前确认继续保留。


---

## 20. Git Clone 与源码更新

`git clone` 只执行一次。

已克隆仓库后，使用：

```text
LFAA-Update.bat
```

拉取远程最新源码。

更新脚本遵循“本地工作优先保护”原则：

- 未提交修改不自动覆盖；
- 分支分叉不自动改写历史；
- 只有纯 fast-forward 更新才自动拉取。


---

## 21. Windows 一键脚本菜单化

`LFAA-Sync.bat`、`LFAA-GitHub.bat`、`LFAA-Update.bat`、`LFAA-Setup.bat` 双击后只允许打开菜单。

禁止双击即执行同步、Push、Pull 等写操作。

危险级较高的操作必须作为独立菜单项显示，并建立恢复机制。


---

## 22. 脚本路径无关原则

LFAA Windows 工具不得把开发机盘符或用户目录写死到代码中。

凡涉及 Git 项目定位，应使用 Git 自身的仓库根目录识别能力。

用户把项目移动到其他磁盘后，脚本应继续正常工作。


---

## 23. Update Git 状态优先

Git 拉取脚本必须先使用 ahead/behind 判断是否真的需要更新。

如果本地与远程已经相同，不允许继续执行额外 diff 并把非必要步骤的失败误判为更新失败。


---

## 24. LFAA 项目身份与第三方归属

完整规范：

- `docs/standards/PROJECT_IDENTITY_AND_ATTRIBUTION.md`
- `/NOTICE.md`

强制原则：

- LFAA 作者署名为“二鱼”；
- 官方外部组件可使用 `lfaa-<domain>-<role>`；
- TypeScript workspace 使用 `@lfaa/*`；
- `lfaa` 官方命名空间不得用于掩盖第三方来源；
- 使用第三方成果必须保留原作者、来源、许可证和修改说明；
- 根许可证未确定前禁止伪造 SPDX 标识。


---

## 25. 项目级资源安装

完整规范：

`docs/standards/PROJECT_RESOURCES.md`

Skills、Experts、Plugins、Extensions、MCP 和同类资源只能安装在：

```text
<project>/.lfaa/
```

禁止把用户目录或系统级目录作为项目资源事实源。

项目移动后必须继续可解析；嵌套项目默认不合并父项目资源；Secret 明文不得进入 `.lfaa/`。


---

## 26. 质量门禁

完整规范：

`docs/standards/QUALITY_GATES.md`

`build`、`typecheck`、`test`、`lint`、`security` 必须执行真实检查。

禁止占位命令输出一句提示后返回成功。未配置的检查必须明确失败，不能制造“假绿”。

业务模块未通过真实编译、测试、构建、安全与依赖边界检查，不得进入 `deliverable`。


---

## 27. 安全硬边界

完整规范：

`docs/standards/SECURITY.md`

`Full` 只减少授权范围内的逐次询问，不得绕过硬拒绝、项目边界、Secret 隔离、capability 和 Rust Broker 最终校验。

审批必须绑定规范化后的具体操作，关键参数变化后必须重新决策。


---

## 28. 性能与资源预算

完整规范：

`docs/standards/PERFORMANCE.md`

涉及运行时、数据库、UI、网络、Agent、Tool 或大文件的模块，进入 `in-progress` 前必须定义测量场景、延迟、吞吐、资源、超时、并发和回归预算。

没有可复现数据的“性能很好”不算验收。


---

## 29. 开发环境与依赖菜单

统一入口：

```text
LFAA-Setup.bat
→ scripts/windows/lfaa-setup.ps1
```

脚本负责项目依赖下载、环境检查、项目级资源目录、治理检查、typecheck、测试、build 和完整验证菜单。

下载依赖前必须检查项目根和工具链；不得把项目依赖安装到用户级 LFAA 目录。
