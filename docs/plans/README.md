# 规划方案索引

跨阶段、需要评审的重构与能力规划放这里。方案实施完成后，把状态写回本篇并在对应 `features/` 文档沉淀现状。

- [多 Agent 任务编排（Crew Tasks）方案](crew-tasks.md)：Agent → Task → Process 三层原语、任务接力与验收、run 级记忆。**C1–C4 已实施（v1 sequential）**。
- [Agent 记忆系统升级方案](agent-memory.md)：本地记忆内核（结构化记录 + BM25/可选向量召回）+ 每轮 LLM 提炼 + 多 Agent 共享 team 记忆。**P1–P2、P4 已实施，P3 待排期**。
- [任务清单开发方案](task-list-plan.md)：数据契约、文件级改动清单、P0–P3 实施顺序与验收。**C1–C4 已实施（v1 sequential）**。
- [两个巨型循环拆分方案](loop-refactor-plan.md)：Agent Loop 与 Chat Run Actions 的状态归属与分阶段边界。**已实施**（A1–A4、B1、A5/B2）。
- [目标自动续跑与跨会话协调](goal-coordination-plan.md)：goal 续跑、工作区租约、工作树并行、交接协议。**已实施**（P1–P5）。
- [浏览器预览与定向验收修复](browser-preview-and-verification.md)：显式展示、验收范围、右栏协同画面与截图证据。
- [浏览器子智能体丝滑操控与全过程可视化方案](browser-agent-live-control-and-trace.md)：意图硬分流、15 步定向验收、页面内真人操控光标与高亮、防闪屏与实时截图缩略图。**已实施**。
- [LFAA 桌面端原生 WebContentsView 内置浏览器方案](desktop-native-webview-browser.md)：Electron 原生 Chromium 视口、安全 Preload 桥与 `lfaa.bat` 菜单 3 自动构建启动。**已实施**。
- [@lfaa/ui-primitives 接入 Base UI 无头组件底座方案](ui-primitives-base-ui.md)：零 Tailwind 接入 `@base-ui/react` 封装高频交互原语（DropdownMenu / Switch / Select / Tabs / Tooltip）。**已实施**。
- [LFAA 原生 MCP（Model Context Protocol）客户端接入方案](mcp-client-support.md)：支持 Stdio 与 Streamable HTTP 协议、按需动态注册进 `@lfaa/tools` 与设置中心管理页。**待评审**。
- [LFAA 超级智能体体验、性能与 Git/工作树一体化升级方案](super-agent-perf-git-overhaul.md)：四阶段整治方案——刷新性能秒开、解放 DeepSeek 与改代码安全气囊、多职能子 Agent 编排与右栏多标签舞台、内置 Git 与工作树彻底收口。**已实施**。
- [内置浏览器完整设置体系与 Windows 原生目录选择器优化方案](browser-settings-and-native-picker.md)：秒开高 DPI 原生资源管理器目录选择器 + 内置浏览器完整设置与历史/下载/密码/站点权限/扩展管理子页。**已实施**。
- [内置浏览器下载闭环方案](browser-downloads.md)：Playwright / Electron 下载权限、保存位置、持久化历史与双引擎验收。**已实施**。
- [右栏标签菜单与快捷键系统方案](workbench-shortcuts-and-tab-menu.md)：注册表契约、标签右键菜单与可改键设置页。**已实施**。
- [外观背景图片方案](appearance-backgrounds.md)：主题包内置背景自动发现、个人背景免构建生效、整壳铺放与工作区/设置中心两处目标。**已实施**。
- [外观「主题风格」与「背景图片」合并方案](appearance-theme-background-merge.md)：主题就是背景，一面主题卡墙容纳纯色、内置背景与个人图，一次点击应用整套外观。**已实施**。
- [聊天消息列窗口化（虚拟列表）方案](thread-virtualization.md)：大会话切会话与滚动的渲染成本、TanStack Virtual 只借窗口不接管跟随、分阶段接入与回滚开关。**已实施**。
- [真实终端 + 右侧/底部双位置方案](terminal-panel.md)：Host PTY（node-pty）+ xterm.js、WebSocket 双向流、右栏/底部两种展示位置与位置切换（默认右侧）。**待评审**。
- [连接器（MCP + CLI）统一入口方案](connectors.md)：把 MCP 服务器与声明式 CLI 工具收进同一个「集成 → 连接器」页，含动作参数 schema、逐次审批、超时与进程树回收。**P0 已实施**。
- [插件清单对齐 DSH（内置插件页 + Loader 全量装配）方案](plugin-inventory-parity.md)：以 Loader 为唯一真相的只读投影、每包 locale 元数据、设置页只读清单与插件中心启停分工。**待评审**。

状态标记只用三种：**待评审**、**已实施**、**已放弃**（并在正文写原因）。

