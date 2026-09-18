# #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.12
- **状态：** superseded
- **关键词：** Web、三栏、Header联动、Tooltip、Hover、左栏预览、终端、PTY、ChatGPT、Codex
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

- **已由：** #21.13 响应式重构与弹性吸附
- **当前查看：** `../active/0021-Web工作台UI.md`

## 当前结论

当前 Web 工作台继续使用 #21.11 确立的 Header 联动结构；本次只修正 Shell Header 三个框架按钮的提示层契约：

```text
左栏按钮      → 单一自定义 Tooltip：Ctrl+B
终端按钮      → 单一自定义 Tooltip：Ctrl+J
右栏按钮      → 单一自定义 Tooltip：Ctrl+Alt+B
```

同一个按钮禁止同时存在：

```text
HTML title 原生 Tooltip
+
.agent-shell-tooltip 自定义 Tooltip
```

否则浏览器会延迟再弹出第二层原生提示，形成用户实机照片中的“双层黑框/互相挤压”。

`aria-label` 继续保留给无障碍语义；自定义 Tooltip 必须 `pointer-events:none`，不能抢鼠标事件。

## 最新变更

### #21.12 Shell Tooltip 单一提示源

v0.0.44 根据用户实机照片修复三处重复 Tooltip：

1. 左栏按钮删除原生 `title`；
2. 底部终端按钮删除原生 `title`；
3. 右侧栏按钮删除原生 `title`；
4. 三个按钮统一只使用 `ShellHeaderButton` 内的 `.agent-shell-tooltip`；
5. 保留 `aria-label` 与快捷键文本；
6. Tooltip 继续 `pointer-events:none`，避免 Hover/Click 被提示层截获；
7. 新增 `scripts/ui-contract-check.mjs`，发布门禁禁止 Shell Header 按钮再次出现 `title + 自定义 Tooltip` 双提示源；
8. #21.11 的 Header 联动、左栏 Hover Preview、三向吸附、真实 PTY 全部保持不变。

### #21.11 Header 联动与按钮归属修正（历史基线）

结构方案仍然有效，但 v0.0.43 的 Tooltip 同时保留了原生 `title` 和自定义提示，导致视觉重复。历史快照：

`archive/0021-11-Header联动与按钮归属修正.md`

## 影响范围

- `packages/app-shell/src/AgentWorkbench.tsx`
- `scripts/ui-contract-check.mjs`
- `scripts/governance-check.mjs`
- `scripts/comment-check.mjs`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`

## 验证结果

静态实现要求：

- `ShellHeaderButton` 内不存在 `title=`；
- 仍存在 `.agent-shell-tooltip`；
- `.agent-shell-tooltip` 使用 `pointer-events:none`；
- `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B` 三个提示仍在；
- Header 联动结构不回退；
- Sync / GitHub / Setup / Update 业务逻辑不修改。

真实视觉仍需 Windows 浏览器实机验证。

## 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.10 | superseded / delivered | `archive/` 对应历史文件 |
| #21.11 | delivered-with-tooltip-defect | `archive/0021-11-Header联动与按钮归属修正.md` |
| #21.12 | active | `active/0021-Web工作台UI.md` |
