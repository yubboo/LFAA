# 规划方案索引

跨阶段、需要评审的重构与能力规划放这里。方案实施完成后，把状态写回本篇并在对应 `features/` 文档沉淀现状。

- [任务清单开发方案](task-list-plan.md)：数据契约、文件级改动清单、P0–P3 实施顺序与验收。**待评审，未开工**。
- [两个巨型循环拆分方案](loop-refactor-plan.md)：Agent Loop 与 Chat Run Actions 的状态归属与分阶段边界。**已实施**（A1–A4、B1、A5/B2）。
- [目标自动续跑与跨会话协调](goal-coordination-plan.md)：goal 续跑、工作区租约、工作树并行、交接协议。**已实施**（P1–P5）。
- [浏览器预览与定向验收修复](browser-preview-and-verification.md)：显式展示、验收范围、右栏协同画面与截图证据。
- [浏览器子智能体丝滑操控与全过程可视化方案](browser-agent-live-control-and-trace.md)：意图硬分流、15 步定向验收、页面内真人操控光标与高亮、防闪屏与实时截图缩略图。**已实施**。
- [LFAA 桌面端原生 WebContentsView 内置浏览器方案](desktop-native-webview-browser.md)：Electron 原生 Chromium 视口、安全 Preload 桥与 `lfaa.bat` 菜单 3 自动构建启动。**已实施**。
- [@lfaa/ui-primitives 接入 Base UI 无头组件底座方案](ui-primitives-base-ui.md)：零 Tailwind 接入 `@base-ui/react` 封装高频交互原语（DropdownMenu / Switch / Select / Tabs / Tooltip）。**已实施**。
- [LFAA 原生 MCP（Model Context Protocol）客户端接入方案](mcp-client-support.md)：支持 Stdio 与 Streamable HTTP 协议、按需动态注册进 `@lfaa/tools` 与设置中心管理页。**待评审**。
- [LFAA 超级智能体体验、性能与 Git/工作树一体化升级方案](super-agent-perf-git-overhaul.md)：四阶段整治方案——刷新性能秒开、解放 DeepSeek 与改代码安全气囊、多职能子 Agent 编排与右栏多标签舞台、内置 Git 与工作树彻底收口。**已实施**。
- [内置浏览器完整设置体系与 Windows 原生目录选择器优化方案](browser-settings-and-native-picker.md)：秒开高 DPI 原生资源管理器目录选择器 + 内置浏览器完整设置与历史/下载/密码/站点权限/扩展管理子页。**已实施**。

状态标记只用三种：**待评审**、**已实施**、**已放弃**（并在正文写原因）。
