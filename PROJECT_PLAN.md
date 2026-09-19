# LFAA 项目主计划

> 本文件只保存当前开发顺序和主模块状态。

## 当前主开发模块

```text
agent-runtime + workbench
```

当前状态：

```text
pending-user-acceptance
```


当前架构升级任务：

```text
#22.0 统一 Agent Runtime、三档权限与无限画布工作台
version: v0.0.77
status: pending-user-acceptance
```

同版本 Windows 工具链修复：

```text
#4.3 Sync/GitHub 统一工作区预检与可诊断失败修复
version: v0.0.77
status: pending-user-acceptance
```

该升级不推翻既有 Config System：配置层继续负责账号/模型事实；运行层开始承接模型执行、Harness、Tool/Skill/Subagent 与权限快照。#2.16 v0.0.76 的 ChatGPT/Codex 登录成果继续保留，待 Windows 实机后再单独验收。

最近完成的治理修复：

```text
#20.16 pnpm 控制台直连原生输出修复
version: v0.0.62
status: delivered
```

配置系统当前业务任务：

```text
#2.16 OpenAI ChatGPT 套餐 / Codex App Server 登录闭环
version: v0.0.76
status: pending-user-acceptance
```

`project-foundation` 已建立可交付骨架。`#16` 和 `#17` 属于 Config Schema 前置治理/工具链修复，不改变当前主业务模块。

用户已明确要求按照开发规范进入配置系统。#21 Web 工作台历史/实机验收状态保留，不再阻塞业务顺序；当前 `config-schema` 基线仍等待用户验收。#20.9 的提示去重与路径展示已由用户 Windows 实机确认通过。随后用户主动删除 `pnpm store path` 指向的 Store，发现菜单 1 仍误报“全部依赖已就绪”，暴露 #20.8 只做浅层 manifest/指纹检查的真实健康缺口。用户随后通过 `pnpm setup` + 删除全局 `storeDir` 验证了 Store 路径会随机器配置实时变化，且要求 LFAA 不让用户自行判断机器级路径。#20.10 / v0.0.56 因尚未覆盖 Store 来源与 PNPM_HOME/PATH 实时事实，被 #20.11 / v0.0.57 取代。用户实机运行 v0.0.57 时发现 PowerShell `$home` 与只读自动变量 `$HOME` 冲突，#20.11 的实时环境设计因此无法进入后续执行。v0.0.58 已修复 `$HOME` 冲突并继续进入依赖同步，但实机进一步发现 lockfile 落后时仍错误调用 frozen install，且写操作缺少稳定实时进度。当前 #20.13 / v0.0.59 已分离开发期同步与发布期 frozen 校验，但 Windows 实机确认 `--reporter=append-only` 并没有恢复用户熟悉的 pnpm 原生进度，安装阶段仍呈现无输出等待。#20.14 / v0.0.60 撤销自定义 reporter 后，Windows 实机仍未呈现与 CMD 直接 `pnpm install` 一致的 Scope / Progress / Packages 原生输出，同时菜单 1 中文解释过多。v0.0.61 实机继续确认：仅优先 `pnpm.cmd` 仍不足以恢复 CMD 原生动态进度，因为 PowerShell native-command 管道仍位于中间。当前 #20.16 / v0.0.62 改为由 `cmd.exe` 在同一控制台直接启动 `pnpm.cmd`，PowerShell 不捕获 stdout/stderr，只等待退出码；菜单 1 保持精简。v0.0.62 已由用户 Windows 实机确认 pnpm 原生输出恢复并验收通过。#2.3 / v0.0.63 已完成目录职责硬规范、机器边界门禁、AI Provider Registry、六家首批 Provider 配置插件和共享 AI 设置 UI 基线。用户验收确认架构方向正确，但设置/个人中心交互未通过：设置仍嵌在工作区 center pane，个人菜单和主题入口不符合参考体验。v0.0.64 已完成独立 Settings Surface、三态主题与底部工具布局，但用户实机确认个人菜单几何仍不合格：菜单越过左栏宽度，且菜单与底部用户条未形成同一聚焦整体。v0.0.65 已由用户实机明确验收通过。#2.6 / v0.0.66 的吸附反向展开动效也已由用户实机确认“丝滑”并验收通过。#2.7 / v0.0.67 已完成六家 Provider 的 API Key / Token Plan Account/Auth/Secret/真实连接与模型发现闭环，但 Windows 实机启动出现 Vite native config 兼容 warning。v0.0.68 已保留 Vite Native Config 兼容修复成果；同一实机验收阶段用户继续发现 Settings 左栏仍为固定宽度且未复用 Workbench 侧栏能力。v0.0.69 已将 Settings 导航改为共享 ResizableWorkbench 单侧模式，但 Windows 实机启动暴露 `@/workbench` 仅被 TypeScript alias 解析、Vite 运行时无法解析的验证漏洞。当前 #2.10 / v0.0.70 改为 `@lfaa/ui/workbench` 公共 Subpath Export，并增加运行时导入解析门禁；共享侧栏交互语义保持不变。 v0.0.70 实机已能正常运行，但用户继续发现 Settings 与主工作台只“复用算法”而没有共享 leftWidth；#2.11 / v0.0.71 将 Shell leftPaneWidth 作为两者唯一宽度事实源，实现跨 Surface 同宽与双向同步，并已由用户实机确认通过。随后真实 DeepSeek Account 测试中，连接与模型发现成功，但保存账户在 Windows Credential Manager Secret Adapter 失败。v0.0.72 的 PowerShell/C# helper 又在 Windows 实机出现 `FILETIME` 类型冲突，且用户明确 LFAA 技术栈必须保持 TypeScript + Rust；当前 #2.13 / v0.0.73 将 Secret 正式迁入 Rust Broker，并同步把 Provider 模型列表与模型能力配置升级为官方 API / 官方文档驱动。 v0.0.73 仍等待 Windows Secret/Provider 业务实机验收；用户随后要求先优化共享侧栏防误触吸附手感。v0.0.74 将 `minWidth` 与 snap capture 阈值解耦并集中变量化，但实机发现防误触区错误地继续视觉缩窄，导致正常 resize 出现“吸附展开 / 无法任意停宽”回归。当前 #2.15 / v0.0.75 已由用户确认通过：视觉宽度在 min 后锁定，只累计隐藏超拖，达到阈值后才正式吸附。随后 #2.16 / v0.0.76 接入 OpenAI ChatGPT 套餐 / Codex App Server 登录闭环；在该配置能力基础上，v0.0.77 正式进入 #22.0：把“配置好模型”提升为“同一 Agent Runtime 真正做事”，并以 Chat / Work 两种 Surface 暴露。

v0.0.67 的 Web API-Key/Token Plan Account 闭环成果保留，但用户 Windows 实机启动 Web 时发现 Vite 8.2.2 native config loader 兼容 warning。v0.0.68 的 Vite Native Config 修复继续保留；v0.0.69 的 Settings/Workbench 共享侧栏成果保留；当前 #2.10 / v0.0.70 先修复公共导入的真实运行时解析。随后 #2.16 进入 OpenAI ChatGPT 套餐 / Codex App Server 登录子任务；API Key 的 Rust Secret Broker 业务成果继续保留。当前 v0.0.77 的主线已切换为统一 Agent Runtime / Workbench 架构基础。

## 模块顺序

| 顺序 | 模块 | 状态 | 目标 |
|---|---|---|---|
| 1 | project-foundation | delivered | 项目骨架、规范、边界、文档治理 |
| 2 | config-system | implementing | 设置、模型管理、账号、认证、模型选择配置与 UI |
| 3 | agent-runtime | implementing | Chat / Work 单一 Run 契约、Harness Registry、能力注册与运行时编排 |
| 4 | session-system | pending-development | Session / Turn / Run Event Store |
| 5 | permission-system | implementing | 请求审批 / 替我审批 / 完全权限，审批生命周期与风险 Reviewer |
| 6 | tool-runtime | pending-development | Tool / Skill / Expert / Command Registry 与执行 Pipeline |
| 7 | rust-execution | pending-development | FS / Process / PTY / Sandbox / Secret 二次校验 |
| 8 | coding-agent | pending-development | 第一条官方 Harness 驱动的真正可工作 Agent |
| 9 | eval-system | pending-development | Agent Eval / Regression |
| 10 | context-engine | pending-development | Working Set / Compaction |
| 11 | knowledge-system | pending-development | 本地知识库 |
| 12 | skill-mcp-plugin | pending-development | Skills / MCP / Plugin |
| 13 | model-routing | pending-development | 多模型 Router / Fallback / Usage |
| 14 | subagent-system | pending-development | Parent / Child Agent |
| 15 | productization | pending-development | Update / Signing / Crash Recovery |


## 文档治理前置任务

```text
#20.5 文档体系单文件时间线重构
version: v0.0.50
status: pending-user-acceptance
```

模块详细 Plan / Progress 已合并至 `docs/MODULES.md`。
