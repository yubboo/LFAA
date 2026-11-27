# 内置浏览器排障与缺陷发现能力强化方案

> 状态：负责人已确认实施
> 范围：`packages/core/browser`、`packages/core/subagent`

## 1. 目标与改造点

1. **新增一键页面体检工具 `browser_diagnose`**：单次调用扫描 7 类高频前端缺陷（控制台报错/未捕获异常、HTTP ≥ 400 失败请求、破图、横向溢出与撑宽元素、透明/隐形内容陷阱、白屏/空挂载、可交互控件遮挡），以纯字符串表达式在页面上下文安全求值，避免 Agent 手写 `browser_evaluate` 出现语法错误与多轮 Token 浪费。
2. **操作快照自动透出报错**：`browser_navigate` / `browser_click` / `browser_type` / `browser_press_key` 返回的快照在 `errorCount > 0` 或存在失败网络请求时，自动附带最新 3 条真实报错摘要。
3. **视觉验收双证据化（`browser_visual_check`）**：调用视觉模型审查截图时，自动附带当前视口的客观 DOM 体检摘要（控制台错误、破图、横向溢出、透明文字预警），消除纯看图盲区。
4. **浏览器子智能体排障 SOP 升级**：在 `buildBrowserSubagentPrompt` 中固化「定位 → `browser_diagnose` 体检 → 真人交互复现 → 视觉复核 → 按严重程度结构化回报」闭环，并补齐 `browser_diagnose` 可读步骤标签。

## 2. 调研与参考

- **本仓库现有实现**（2026-11-27 查阅）：`packages/core/browser/src/tools/browser-tools.ts` 已有 `runtime.evaluate`、`runtime.getConsole`、`runtime.getNetwork`、`runtime.snapshot`；`packages/core/browser/src/session/page-init.ts` 证明页面内脚本应使用纯字符串 IIFE 以避免 bundler 注入 `__name` 辅助函数。
- **外部参考**：
  - [Chrome DevTools Protocol / Lighthouse Diagnostics](https://developer.chrome.com/docs/lighthouse/overview)（2026-11-27 查阅）：以确定性 DOM/布局/网络/控制台探针输出结构化问题列表，替代人工逐项排查。
  - [Playwright Web-First Assertions & Page Errors](https://playwright.dev/docs/api/class-page)（2026-11-27 查阅）：结合 `console`、`pageerror`、`response >= 400` 与 `elementFromPoint` 遮挡检测构建端到端排障证据。
- **适配结论**：无需新增依赖，在 `@lfaa/browser` 内独立拆出 `browser-diagnose.ts` 实现零依赖页面探针与结构化报告格式化。

## 3. 验收与回滚

- 单元测试覆盖诊断报告格式化、7 类缺陷分类汇总、快照错误自动透出与子智能体标签映射。
- 执行 `pnpm test:pkg core/browser`、`pnpm test:pkg core/subagent`、`tsc -b` 编译受影响包、`pnpm map:sync`、`pnpm check`，并重启本地 `http://127.0.0.1:5173/` 加载最新 Host 代码。
- 仅增量新增工具与增强输出文本，向后兼容，可按文件单轮无损回退。
