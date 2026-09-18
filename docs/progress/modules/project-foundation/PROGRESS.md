# project-foundation PROGRESS

## 2026-09-18 / #21.14 最小尺寸吸附收起语义修正

- 当前状态：pending-windows-visual-test
- 用户实机发现：v0.0.45 允许右栏在 min 以下继续作为展开布局存在，导致工具文字 / 快捷键被挤坏；吸附语义被错误实现成“吸附展开到超窄尺寸”。
- 已完成：删除 `elasticSize()` / `snapCommitThreshold()` 当前算法。
- 已完成：左 / 右 / Bottom 到达 min 即进入 snap capture / 收起预览。
- 已完成：Pointer 按住期间仍可反向拖过 `min + snapHysteresis`，恢复到至少 min 并继续拉伸。
- 已完成：左栏 min 提升到 280px，右栏 min 提升到 360px，Bottom min 提升到 180px。
- 已完成：Desktop / Compact 边界调整为 1240 / 760，避免更大的最小尺寸压坏中央区。
- 已完成：UI contract 改成“禁止 min 以下展开态”的新契约。
- 不改：Sync / GitHub / Setup / Update、PTY bridge、Agent Runtime。
- 用户版本：v0.0.46
- 待完成：Windows Chrome / Edge 实机确认吸附手感与最小宽度可读性。

## 2026-09-18 / #21.13 响应式重构与弹性吸附

- 当前状态：pending-windows-visual-test
- 用户实机发现：v0.0.44 在窄窗口中右栏覆盖过宽、核心按钮可见性不足，页面布局会崩；三向吸附从 min 到 0 的过渡过硬。
- 已完成：新增 Desktop / Compact / Mobile 三档 LayoutMode（1180 / 760）。
- 已完成：Compact 右栏改 Drawer，Mobile 左右栏改 Drawer；核心 Header 按钮始终保留。
- 已完成：响应式 Drawer 从 48px Header 下方出现，移除旧版 88vw 覆盖方案。
- 已完成：Tooltip start/end 对齐，防止贴边裁切。
- 已完成：左右栏 / Bottom Terminal 统一 elasticSize + snapCommitThreshold。
- 已完成：Pointer 按住时进入 snap capture 后可反向拖回 min；只有 Pointer Up 才正式 collapsed。
- 已完成：拖拽期间彻底关闭 Workbench transition，正式展开/收起统一 ease-out。
- 已完成：UI contract 门禁加入响应式和弹性吸附静态契约。
- 不改：Sync / GitHub / Setup / Update、PTY bridge、Agent Runtime。
- 用户版本：v0.0.45
- 待完成：Windows Chrome / Edge 多尺寸实机视觉与手感确认。

## 2026-09-18 / #21.11 Header 联动与按钮归属修正

- 当前状态：pending-test
- 用户实机发现：v0.0.42 的左右 Shell 按钮虽然位置接近目标，但仍漂在正文层，没有进入顶部工作区 Header。
- 已完成：Center Header 结构化为正常第一行；左栏按钮 + 标题 + 更多 / 分享进入中间 Header。
- 已完成：右栏展开时终端 / 右栏按钮进入 Right Shell Header；右栏收起时回到 Center Header。
- 已完成：新增自定义快捷键 Tooltip，保留 `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`。
- 保留：左栏 Hover Preview、三向吸附、真实 PTY、资源桥。
- 不改：Sync / GitHub / Setup / Update 业务逻辑。
- 用户版本：v0.0.43
- 待完成：Windows 浏览器实机视觉确认。

## 2026-09-18 / #4.3 + #20.4 PowerShell 编码回归修复

- 当前状态：delivered
- 缺陷来源：v0.0.41 补中文注释时意外移除 Windows PowerShell 脚本 UTF-8 BOM
- 影响：Sync / GitHub / Setup / Update 四个 `.ps1` 都存在 Windows PowerShell 5.1 误解码风险
- 已完成：4 个 `.ps1` 恢复 UTF-8 BOM，且去除 BOM 后正文与 v0.0.41 完全一致
- 已完成：新增 Windows 脚本编码门禁，负向测试可正确阻止 BOM 缺失
- 已完成：新增发布版本一致性门禁，DEVELOPMENT / AGENTS 固化开发规范触发器
- 已完成：#20.3 归档、#20.4 Active、#4.3 delivered，Prompt / Changelog / Release / Standards 同步
- 验证：governance / import / dev-log / docs / comment / Windows encoding / release consistency 全部通过
- 验证：ZIP 无额外根目录，中文路径 UTF-8 标志正常，解压 Hash Round-trip 0 缺失 / 0 多余 / 0 不一致，PowerShell BOM 保留
- 配置系统业务实现：不改动
- 用户版本：v0.0.42

## 2026-09-18 / #20.3 + #21.10 可读性与当前 UI 事实源同步

- 当前状态：pending-test
- #21 当前实现：中间主区左上角左栏按钮、右上角终端/右栏按钮、左栏 Hover 临时预览
- #20.3 已完成：结构化中文源码注释、CSS 盒子分区、项目结构地图、一级目录 README、comment-check 门禁
- 已修正文档漂移：UI Layout / Active Prompt / Development Log / Web UI Test 与代码重新一致
- 配置系统业务实现：未改动
- 用户版本：v0.0.41
- 待完成：Windows 浏览器实机视觉与交互验证

## 2026-09-18 / #21.9 Web 常驻工作台 Chrome

- 当前状态：pending-test
- 已完成代码：Web 全宽 Workbench Chrome、左栏 / 终端 / 右栏常驻按钮、侧栏 Hover 壳层入口移除
- 保留：三向拖拽吸附、真实 PTY、GitHub 推送修复、中文路径保护
- 待完成：Windows 浏览器实机视觉位置与交互验证
- 用户版本：v0.0.38

## 2026-09-18 / #19.10 Rustup Windows Target 缺失修复

- 当前状态：delivered
- 已完成：
  - 恢复 Get-WindowsRustupTarget
  - Windows x64 / ARM64 / x86 target 映射
  - 未知架构安全失败
  - Governance 防回归门禁
- #21 真实终端状态：pending-test
- 是否已交付：Setup 修复已交付（v0.0.35）

## 2026-09-18 / #19.9 node-pty Smoke Check 引号兼容

- 当前状态：delivered
- 已完成：
  - node-pty 独立 Smoke Check 脚本
  - 移除 Windows Setup 内嵌 node -e 检查
  - PowerShell 5 参数引号兼容修复
- #21 真实终端状态：pending-test
- 是否已交付：Setup 修复已交付（v0.0.34）

## 2026-09-18 / #19.8 node-pty 跨机器安装

- 当前状态：delivered
- 已完成：pnpm 精确 allowBuilds、严格门禁保留、Setup node-pty Smoke Check
- 解决：全新机器 ERR_PNPM_IGNORED_BUILDS
- 是否已交付：v0.0.33

## 2026-09-18 / #21.7 侧栏 Hover 与真实终端

- 当前状态：pending-test
- 已完成代码：侧栏 Hover / 底部 Dock / xterm / node-pty PTY
- 待完成：Windows 实机 PTY 启动验证
- 用户版本：v0.0.32

## 2026-09-18 / #21.6 三栏交互与终端停靠

- 当前状态：delivered
- 已完成：
  - 分隔条仅拖拽
  - 顶部淡入式左右栏 / 终端控制
  - 中间底部终端停靠区
  - 右栏终端入口联动
- 是否已交付：Web 工作台 UI 继续交付（v0.0.31)

## 2026-09-18 / #19.7 Setup 主菜单循环

- 当前状态：delivered
- 已完成：
  - Setup 主菜单循环
  - 普通操作不再退出终端
  - 取消/错误返回菜单
  - Web Ctrl+C 返回菜单
- #21 Web 工作台：#21.5 Web 启动延迟修复
- 是否已交付：基础设施变更已交付（v0.0.30）

## 2026-09-18 / #19.6 依赖模型简化

- 当前状态：delivered
- 已完成：
  - 工具链 / 项目依赖边界定稿
  - Setup 用户提示简化
  - Rust 安装路径收敛为官方 rustup-init
  - 移除 WinGet Rust 安装分支
  - 保留 Rust 官方 SHA-256 校验
  - 已有工具链直接复用
- #21 Web 工作台状态：in-progress
- 是否已交付：基础设施变更已交付（v0.0.29）

## 2026-09-18 / #19.5 / #21.4

- Rust 工具链分层已调整；
- 项目 Rust 版本由 rust-toolchain.toml 锁定；
- Web 端口冲突处理已加入；
- Windows 实机待验证；
- #21 UI 仍为 in-progress。

## 2026-09-18 / #21.2 黑白工作台重构

- 当前状态：in-progress
- UI 视觉：从水墨改为 Codex / ChatGPT 类黑白灰生产力工具风格
- 已实现：浅色 / 深色、本地主题偏好、动态侧栏最大宽度、松开吸附策略
- `.lfaa` Vite 热插拔桥接：保持现有协议
- 静态治理检查：PASS
- 变更 TS/TSX 语法检查：PASS
- 完整 Vite build：当前环境缺少可用 pnpm 11.17.0，待用户 Windows 实机验证
- 配置系统业务实现：未改动

## 2026-09-18 / #19.4 Rust 安装诊断优化

- 当前状态：delivered
- Windows 实机：Cargo / rustc 已成功安装
- 已完成：
  - CARGO_HOME 检测
  - WinGet 返回码语义化
  - WinGet 后环境重新检测
  - 官方 rustup 英文日志保留说明
  - SHA-256 安全链保留
- #21 Web 工作台状态：in-progress
- 是否已交付：基础设施变更已交付（v0.0.25）

## 2026-09-18 / #19.3 统一开发入口

- 当前状态：delivered
- 已完成：
  - Setup 统一 Web / Desktop / Build / Release 入口
  - 删除 LFAA-Web.bat
  - 删除 lfaa-web.ps1
  - Desktop 未实现功能真实门禁
  - Governance 禁止重复启动器
- #21 Web 工作台状态：in-progress
- 是否已交付：基础设施变更已交付（v0.0.24）

## 2026-09-18 / #19.1 一键准备真实检测

- 当前状态：delivered
- 主任务：#19 一键准备与依赖检测
- 最新变更：#19.1
- 已完成：
  - Node 24.x 真实检测
  - pnpm 版本/路径真实检测
  - workspace / Node 依赖统计
  - Rust winget 回退
  - Rust 官方 rustup-init 回退
  - 官方 SHA-256 校验
  - 部分完成状态
- 配置系统业务实现：未改动
- 是否已交付：是（v0.0.22）
- 下一步：进入 `config-schema`

## 2026-09-18 / #10.1 GitHub 推送确认优化

- 当前状态：delivered
- 主任务：#10 GitHub 推送确认交互
- 最新变更：#10.1
- 已完成：
  - 移除远程 Push 二次确认
  - 保留 origin 配置确认
  - DEVELOPMENT 同步
  - WORKSPACE_SYNC 同步
  - Development Log 留痕
- 配置系统业务实现：未改动
- 是否已交付：是（v0.0.21）
- 下一步：进入 `config-schema`

## 2026-09-18 / #20.2 中文命名与 docs 整理

- 当前状态：delivered
- 主任务：#20 开发日志与文档规范
- 最新变更：#20.2
- 已完成：
  - Development Log 中文文件名
  - Prompt 中文编号文件名
  - docs/README 总入口
  - 主要分类 README 索引
  - Development / Runtime Log 分离
  - runtime 日志目录迁移
  - docs-check 自动检查
  - 历史 #20.0 / #20.1 保留
- 原历史文件：保留
- 配置系统业务实现：未改动
- 是否可交付：是
- 是否已交付：是（v0.0.20）
- 下一步：进入 `config-schema`

## 2026-09-18 / #20.1 历史编号迁移

- 当前状态：delivered
- 主任务：#20 开发日志分层规范
- 最新变更：#20.1
- 问题：#20.0 只直接显示 #20，旧编号只有 legacy 指针
- 已完成：
  - #1 - #19 逐条迁入 Development Log
  - #2 保持 active
  - #1、#3 - #19 进入 archive
  - #20.0 历史快照保留
  - INDEX 全编号可搜索
  - 主编号连续性自动检查
- 原历史文件：全部保留
- 是否可交付：是
- 是否已交付：是（v0.0.19）
- 下一步：进入 `config-schema`

## 2026-09-18 / #20 开发日志分层规范

- 当前状态：delivered
- 最新变更：#20.0
- 本次目标：当前/历史开发日志分层、命名、中文与读取顺序硬规则
- 已完成：
  - development active/archive
  - development INDEX
  - DEV_LOGS standard
  - AGENTS 读取顺序
  - DEVELOPMENT 重构
  - NAMING 文档规则
  - dev-log-check
  - legacy 历史入口
- 配置系统业务实现：未改动
- 是否可交付：是
- 是否已交付：是（v0.0.18）
- 下一步：进入 `config-schema`

## 2026-09-18 / #19 一键准备与项目资源根收敛

- 当前状态：delivered
- 已完成：
  - Setup 1 改为一键准备
  - 缺少 Cargo 时支持 winget 安装 Rustup
  - Rust 依赖锁文件安全策略
  - 删除根 skills/plugins 双重目录
  - `.lfaa` 唯一资源根
  - Hot Plug Registry Generation 规范
- 配置系统业务实现：未改动
- 是否已交付：是（v0.0.17）
- 下一步：进入 `config-schema`

## 2026-09-18 / #18 Setup 缺少 Cargo 容错修复

- 当前状态：delivered
- 问题：菜单 1 在 pnpm 成功后因 Cargo 缺失错误终止
- 已完成：
  - Node/Rust 工具链预检
  - 可用工具链独立安装
  - 缺失工具链安全跳过
  - 部分完成状态明确提示
  - 菜单 4 / 10 保持严格检查
- 配置系统业务实现：未改动
- 是否可交付：是
- 是否已交付：是（v0.0.16）
- 下一步：进入 `config-schema`

## 2026-09-18 / #17 pnpm-only 一致性修复

- 当前状态：delivered
- 已完成：
  - 根 test 脚本改为 pnpm
  - `preinstall` pnpm-only 门禁
  - Governance 禁止 root scripts 使用 npm/npx/yarn/bun
  - DEVELOPMENT/AGENTS/README 统一 pnpm-only
  - Setup 环境页不再展示 npm
- 配置系统业务实现：未改动
- 是否可交付：是
- 是否已交付：是（v0.0.15）
- 下一步：进入 `config-schema`

## 2026-09-18 / #16 项目治理与项目级资源边界加固

- 当前状态：delivered
- 已完成：归属、项目资源、安全、性能、质量门禁、Setup 菜单、pnpm lockfile
- 配置系统业务实现：未改动
- 是否已交付：是（v0.0.15）

## 2026-09-17 / #1

- 当前状态：deliverable
- 本次目标：建立 LFAA v0.0.1 首包骨架
- 已完成：
  - 产品命名与定位
  - 根目录 AI 入口
  - 开发规范
  - 当前架构
  - 项目计划
  - 更新日志
  - Monorepo 目录
  - TS package 边界
  - Rust crate 边界
  - DSH Compatibility 边界
  - Prompt / Plan / Progress 制度
  - 版本规则
  - Governance check
- 进行中：无
- 待开发：
  - 真实 React/Electron 依赖初始化
  - 真实数据库初始化
  - CI 完整流水线
- 待测试：
  - 真实 Node/pnpm toolchain 初始化后的完整 build
- 测试结果：
  - 文档/目录治理检查可执行
  - Rust crates 包含基础单测
- 待优化：
  - 后续增加命名自动检查
  - 后续增加架构依赖 lint
- 阻塞项：无
- 是否可交付：是
- 是否已交付：是（作为 v0.0.1 架构骨架包）
- 下一步：进入 config-system


## 2026-09-17 / #3

- 当前状态：delivered
- 本次目标：建立 TypeScript 导入路径与 Alias 基础规范
- 已完成：
  - 新增 `docs/standards/IMPORT_PATHS.md`
  - 定义 `./` / `@/` / `@lfaa/*` 三层导入规则
  - 禁止 `../../` 及更深相对导入
  - 禁止跨 Package 访问 `src/internal`
  - 为所有 TS workspace 增加本地 `tsconfig.json`
  - 新增 `scripts/import-path-check.mjs`
  - governance check 接入导入检查
  - 同步 DEVELOPMENT / ARCHITECTURE / MODULE_BOUNDARIES
- 进行中：无
- 待开发：真实 Vite/Electron/Node bundler 初始化时同步 runtime alias
- 待测试：真实构建工具引入后的运行时 alias 测试
- 测试结果：
  - Node import-path check 通过
  - Governance check 通过
- 待优化：未来接入 ESLint architecture/import rules
- 阻塞项：无
- 是否可交付：是
- 是否已交付：是
- 下一步：继续主模块 `config-system`


## 2026-09-17 / #4

- 当前状态：delivered
- 本次目标：建立稳定工作区同步与 GitHub 一键推送机制
- 已完成：
  - `LFAA-Sync.bat`
  - `scripts/windows/lfaa-sync.ps1`
  - `LFAA-GitHub.bat`
  - `scripts/windows/lfaa-github.ps1`
  - 新增/修改/删除真实对比
  - 全路径彩色输出
  - `.git` 永久保护
  - 本地 Secret / 缓存保护
  - 删除差异确认机制
  - 同步后 SHA-256 镜像验证
  - `.lfaa-local/sync-logs` 留痕
  - GitHub Push 前 governance check
  - WORKSPACE_SYNC 开发规范
- 进行中：无
- 待开发：正式 Release Tag/发布脚本（后续独立任务）
- 待测试：Windows 实机首次同步与首次 GitHub 授权
- 测试结果：
  - 项目静态治理检查通过
  - 导入路径检查通过
  - ZIP 根目录结构检查通过
- 待优化：未来可增加 GUI 版同步报告
- 阻塞项：当前执行环境无 Windows PowerShell，需用户 Windows 实机验证 PowerShell UI/颜色
- 是否可交付：是
- 是否已交付：是
- 下一步：继续主模块 `config-system`


## 2026-09-17 / #5

- 当前状态：delivered
- 本次目标：将稳定工作区同步日志迁移到 docs 可见目录
- 已完成：
  - 日志路径改为 `docs/logs/workspace-sync/`
  - 新增日志目录 README
  - 运行生成的 `*.log` 不参与镜像差异判断
  - 运行生成的 `*.log` 默认加入 `.gitignore`
  - 旧 `.lfaa-local` 不再作为同步日志目录
  - WORKSPACE_SYNC / DEVELOPMENT / Governance 同步更新
- 进行中：无
- 待开发：无
- 待测试：Windows 实机执行一次同步，确认日志真实生成到新目录
- 测试结果：静态路径与治理规则已更新
- 待优化：未来可增加日志归档/清理策略
- 阻塞项：无
- 是否可交付：是
- 是否已交付：是
- 下一步：继续主模块 `config-system`


## 2026-09-18 / #6

- 当前状态：delivered
- 本次目标：修复 GitHub 一键推送脚本首次 `git init` 失败，并按同步脚本标准重构推送体验
- 问题根因：
  - PowerShell 函数参数使用 `$Args`，与自动变量冲突
  - 导致 `git init` 实际未接收到 `init`
- 已完成：
  - `Run-Git` 重构为 `Invoke-Git -GitArgs`
  - 首次 `.git` 初始化修复
  - Git 变化真实检测
  - 新增/修改/删除/重命名彩色列表
  - staged 文件再次确认
  - 首次 Commit 名称用户自定义
  - 后续 Commit 名称同样用户自定义
  - Commit 前确认
  - Push 前确认
  - Pull --rebase 失败保护
  - GitHub Push 本地日志
- 进行中：无
- 待测试：Windows 实机完成首次 GitHub Push
- 测试结果：
  - 静态逻辑检查完成
  - GitHub 仓库地址/权限已确认
  - 当前执行环境无 Windows PowerShell，无法替用户完成本机脚本实跑
- 待优化：后续可以增加 Release Tag 独立脚本
- 阻塞项：无
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #7

- 当前状态：delivered
- 本次目标：修复首次 origin 检测和 Git 英文原始输出
- 已完成：
  - 先检测 `git remote`
  - 首次无 origin 自动新增
  - 已有 origin 才读取 URL
  - Git stdout/stderr 捕获
  - 默认中文控制台
  - 原始错误写入 Push 日志
  - 中文路径 `core.quotepath=false`
  - 兼容上一版残留的已初始化 `.git`
- 待测试：用户 Windows 实机完成首次 Push
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #8

- 当前状态：delivered
- 本次目标：将 Git origin 改为首次用户配置、后续自动复用
- 已完成：
  - 移除脚本硬编码仓库地址
  - 首次无 origin 提示用户输入
  - 地址格式基础验证
  - 用户确认后保存
  - `.git/config` 作为唯一事实源
  - 后续自动读取 origin
  - Push 日志记录实际 origin
- 待测试：Windows 实机首次输入 origin 并推送
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #9

- 当前状态：delivered
- 本次目标：明确同步/GitHub脚本的终端结束状态
- 已完成：
  - GitHub 成功结束显示“可关闭”
  - Sync 成功结束显示“可关闭”
  - 失败状态同样给出明确关闭提示
  - PowerShell 统一等待任意键
  - BAT 移除重复 pause
- 待测试：Windows 实机确认两套脚本结束提示与按键关闭体验
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #10

- 当前状态：delivered
- 本次目标：移除 Git Commit 二次确认
- 已完成：
  - Commit 名称输入后直接创建本地 Commit
  - 删除重复 Commit 确认
  - 保留 Push 前确认
- 待测试：Windows 实机确认交互流程
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #11

- 当前状态：delivered
- 本次目标：新增 Git Clone 后的一键源码更新工具
- 已完成：
  - `LFAA-Update.bat`
  - `scripts/windows/lfaa-update.ps1`
  - 自动定位 Git 工作区
  - origin 读取
  - 本地 dirty 检测
  - fetch
  - ahead / behind 判断
  - 远程文件差异展示
  - fast-forward only 拉取
  - 分叉保护
  - 更新后校验
  - source-update 日志
  - 可关闭终端提示
- 待测试：Windows 实机对有新远程 Commit 的仓库执行更新
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #12

- 当前状态：delivered
- 本次目标：三个 Windows 工具菜单化，并增加安全/强制更新模式
- 已完成：
  - Update 数字菜单
  - GitHub 数字菜单
  - Sync 数字菜单
  - 安全拉取
  - 仅检查更新
  - 强制拉取
  - backup branch
  - stash -u 保护未提交文件
  - 查看 Git 状态
  - 修改 origin
  - 同步预览/配置
- 待测试：Windows 实机逐项测试三个菜单分支
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #13

- 当前状态：delivered
- 本次目标：Update 脚本不依赖盘符和固定目录
- 已完成：
  - Git root 自动识别
  - 当前目录识别
  - 附近仓库扫描
  - 多仓库数字选择
  - 手工路径输入
  - Git 仓库真实性验证
- 待测试：Windows 不同盘符/不同目录名实机测试
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #14

- 当前状态：delivered
- 本次目标：调整同步菜单操作顺序
- 已完成：
  - 1 = 执行同步
  - 2 = 预览差异
  - 3 = 同步配置
  - 0 = 退出
- 同步核心逻辑：未改动
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


## 2026-09-18 / #15

- 当前状态：delivered
- 本次目标：修复安全拉取在 0/0 状态误执行文件 diff
- 已完成：
  - 0/0 提前返回
  - 本地纯领先提前返回
  - 安全模式分叉提前停止
  - 明确 ref 文件比较
  - diff-tree fallback
  - 双重失败技术日志
- 待测试：Windows 实机再次执行“已是最新”的安全拉取
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`
