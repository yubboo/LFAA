# LFAA-GIT-MENU-SAFETY-20261113

<a id="lfaa-git-menu-safety-20261113"></a>

## 用户问题、入口与目标

- 用户担心菜单 6/8 会误改、误推或让本地源码和 GitHub 不一致，要求检查后修复设计缺陷。
- 入口：`lfaa.bat` → `scripts/project-menu.mjs`（Node 可用时）→ `scripts/install-dependencies.ps1`；6 由 `Push-GitHubRepository` 负责，8 委托 `scripts/update-project.ps1`。
- 目标：菜单 6 只允许从本地 `main` 向固定 GitHub `main` 推送；提交/推送必须在展示完整待提交路径与统计后得到明确肯定确认；取消或校验失败不应改写用户的 Git 索引；若远端已领先或分叉，提交前停止。菜单 8 在保留当前分支独有提交时仍可继续更新安全快进的本地 `main`。

## Owner、设置与数据边界

- 唯一 Git 菜单 Owner 为 `scripts/install-dependencies.ps1`，安全快进实现 Owner 为 `scripts/update-project.ps1`；`lfaa.bat` 与 `scripts/project-menu.mjs` 只负责启动。
- 运行数据路径继续由 `scripts/resolve-data-directory.mjs` 唯一解析；保留现有数据根、敏感路径、凭据和大文件检查。
- 无设置中心配置、产品运行数据写入、认证/权限变化或 UI 变更。Git 操作限定在当前仓库；验证只使用 `dist/.tmp/` 下的隔离本地 bare Git 仓库，不访问 GitHub、不执行真实推送。

## 允许、禁止与验收

- 允许修改：`scripts/install-dependencies.ps1`、`scripts/update-project.ps1`、`apps/cli/tests/workspace-maintenance.test.mjs`、直接相关的 PowerShell 回归及本合同/索引。
- 禁止：拉取/修改当前真实远端引用、提交或推送到 GitHub、重置或清理当前工作区、暂存本任务以外的改动、修改用户数据或其他功能代码。
- 验收：菜单 6 的非 `main`/detached/远端落后或分叉路径在提交前拒绝；待提交内容在临时索引中检查并展示，拒绝时真实索引保持原样；仅在完整摘要展示后用户明确输入肯定值才提交/推送；正常推送仍为非强制快进。菜单 8 保留领先的当前分支，同时按用户确认安全快进未检出的本地 `main`；既有脏工作区、数据根保护和分叉保护继续有效。
- 运行直接隔离 Git 回归、PowerShell 5.1 与 PowerShell 7 脚本解析（环境可用时）、目标测试及 `git diff --check`。不运行产品构建、浏览器、真实 Provider 或真实 GitHub 写入。

## 实施与验收记录

- 状态：已完成。
- 方案：菜单 6 仅允许从本地 `main` 操作；读取远端提交并在本地提交前拒绝远端领先/分叉；暂存、过滤、敏感内容扫描和差异预览使用 `.git` 下唯一临时索引，明确拒绝时删除临时索引而保持原索引逐字节不变。确认提示默认否，显示路径与差异统计后才创建提交；提交前后复核真实索引、当前分支和 HEAD，并按已审核提交 SHA 推送到 `main`。菜单 8 在当前分支领先远端时不再提前返回，会保留当前分支并继续安全快进未检出的本地 `main`。
- 变更文件：
  - `scripts/install-dependencies.ps1` — 菜单 6 本地分支/远端历史预检、隔离索引、确认与并发状态复核；其余原有敏感路径、凭据、大文件和正常推送保护保留。
  - `scripts/update-project.ps1` — 当前分支领先时继续处理独立的本地 `main` 引用，并准确报告保留的当前 HEAD。
  - `scripts/tests/push-version.Tests.ps1` — 分支保护、索引指纹、原有锁保护和“查看后明确确认”的长期回归。
  - `apps/cli/tests/workspace-maintenance.test.mjs` — 本地隔离 bare Git 场景覆盖错误分支拒绝、远端领先时不创建提交、取消后完整保留暂存/未暂存/未跟踪状态、明确确认后推送；并覆盖菜单 8 当前分支领先但安全快进本地 `main`。
  - `docs/PROMPTS.md` — 登记合同与验证结果。
  - `docs/development/git-menu-safety-20261113.md` — 本任务边界及实施证据。
- 实际验证：`Invoke-Pester -Script scripts/tests/push-version.Tests.ps1 -PassThru` 12/12；`node --test apps/cli/tests/workspace-maintenance.test.mjs` 20/20；PowerShell 5.1 与 7 对 `install-dependencies.ps1`、`update-project.ps1` 和 Pester 文件解析通过；`git diff --check` 通过。菜单 6 的集成推送仅写入 `dist/.tmp/` 中创建的隔离 bare 仓库，没有访问或推送真实 GitHub。
- Workspace Gate：`pnpm run check:workspace` 未通过，共 6 项：包目录 JSON/Markdown 清单过期；旧悬停验收文档引用的两张 `dist/.tmp` 截图不存在；`docs/PROMPTS.md` 中两个既有合同锚点缺失（browser-newtab 与 right-terminal）。本任务新合同锚点已被 Gate 识别；未顺手更改无关清单、旧截图链接或既有合同。
- 设置与界面：不涉及设置中心或 UI，浏览器验收不适用。实现只在菜单 6/8 的一次性 Git 操作中运行，不增加服务、轮询或常驻开销；SHA-256 只用于复核当前索引文件。测试运行数据位于临时 fixture 并随测试清理；未触碰真实用户数据、提交或发布。
