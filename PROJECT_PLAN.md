# LFAA 项目主计划

> 本文件只保存当前开发顺序和主模块状态。

## 当前主开发模块

```text
config-system
```

当前状态：

```text
implementing
```

最近完成的治理修复：

```text
#20.16 pnpm 控制台直连原生输出修复
version: v0.0.62
status: delivered
```

配置系统当前业务任务：

```text
#2.6 工作台吸附反向展开动效修复
version: v0.0.66
status: pending-user-acceptance
```

`project-foundation` 已建立可交付骨架。`#16` 和 `#17` 属于 Config Schema 前置治理/工具链修复，不改变当前主业务模块。

用户已明确要求按照开发规范进入配置系统。#21 Web 工作台历史/实机验收状态保留，不再阻塞业务顺序；当前 `config-schema` 基线仍等待用户验收。#20.9 的提示去重与路径展示已由用户 Windows 实机确认通过。随后用户主动删除 `pnpm store path` 指向的 Store，发现菜单 1 仍误报“全部依赖已就绪”，暴露 #20.8 只做浅层 manifest/指纹检查的真实健康缺口。用户随后通过 `pnpm setup` + 删除全局 `storeDir` 验证了 Store 路径会随机器配置实时变化，且要求 LFAA 不让用户自行判断机器级路径。#20.10 / v0.0.56 因尚未覆盖 Store 来源与 PNPM_HOME/PATH 实时事实，被 #20.11 / v0.0.57 取代。用户实机运行 v0.0.57 时发现 PowerShell `$home` 与只读自动变量 `$HOME` 冲突，#20.11 的实时环境设计因此无法进入后续执行。v0.0.58 已修复 `$HOME` 冲突并继续进入依赖同步，但实机进一步发现 lockfile 落后时仍错误调用 frozen install，且写操作缺少稳定实时进度。当前 #20.13 / v0.0.59 已分离开发期同步与发布期 frozen 校验，但 Windows 实机确认 `--reporter=append-only` 并没有恢复用户熟悉的 pnpm 原生进度，安装阶段仍呈现无输出等待。#20.14 / v0.0.60 撤销自定义 reporter 后，Windows 实机仍未呈现与 CMD 直接 `pnpm install` 一致的 Scope / Progress / Packages 原生输出，同时菜单 1 中文解释过多。v0.0.61 实机继续确认：仅优先 `pnpm.cmd` 仍不足以恢复 CMD 原生动态进度，因为 PowerShell native-command 管道仍位于中间。当前 #20.16 / v0.0.62 改为由 `cmd.exe` 在同一控制台直接启动 `pnpm.cmd`，PowerShell 不捕获 stdout/stderr，只等待退出码；菜单 1 保持精简。v0.0.62 已由用户 Windows 实机确认 pnpm 原生输出恢复并验收通过。#2.3 / v0.0.63 已完成目录职责硬规范、机器边界门禁、AI Provider Registry、六家首批 Provider 配置插件和共享 AI 设置 UI 基线。用户验收确认架构方向正确，但设置/个人中心交互未通过：设置仍嵌在工作区 center pane，个人菜单和主题入口不符合参考体验。v0.0.64 已完成独立 Settings Surface、三态主题与底部工具布局，但用户实机确认个人菜单几何仍不合格：菜单越过左栏宽度，且菜单与底部用户条未形成同一聚焦整体。v0.0.65 已由用户实机明确验收通过。当前 #2.6 / v0.0.66 只修复工作台吸附后反向拉出的动效连续性：保持 Pointer 未松手可反向展开与原 snap 状态机不变，增加短 release 过渡后恢复直接跟手；通过后再进入 Account/Auth/Secret/真实连接闭环。

## 模块顺序

| 顺序 | 模块 | 状态 | 目标 |
|---|---|---|---|
| 1 | project-foundation | delivered | 项目骨架、规范、边界、文档治理 |
| 2 | config-system | implementing | 设置、模型管理、账号、权限配置、配置存储与 UI |
| 3 | session-system | pending-development | Session / Turn / Run |
| 4 | permission-system | pending-development | Ask / Auto / Full |
| 5 | tool-runtime | pending-development | Tool Registry / Tool Pipeline |
| 6 | rust-execution | pending-development | FS / Process / PTY / Sandbox |
| 7 | coding-agent | pending-development | 第一条真正可工作 Agent |
| 8 | eval-system | pending-development | Agent Eval / Regression |
| 9 | context-engine | pending-development | Working Set / Compaction |
| 10 | knowledge-system | pending-development | 本地知识库 |
| 11 | skill-mcp-plugin | pending-development | Skills / MCP / Plugin |
| 12 | model-routing | pending-development | 多模型 Router / Fallback / Usage |
| 13 | subagent-system | pending-development | Parent / Child Agent |
| 14 | productization | pending-development | Update / Signing / Crash Recovery |


## 文档治理前置任务

```text
#20.5 文档体系单文件时间线重构
version: v0.0.50
status: pending-user-acceptance
```

模块详细 Plan / Progress 已合并至 `docs/MODULES.md`。
