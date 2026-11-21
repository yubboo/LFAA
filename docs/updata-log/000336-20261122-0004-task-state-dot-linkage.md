# UPDATA-000336｜进行中/已完成状态联动：转圈=进行中，小圆点=完成未读

- 时间：2026-11-22 00:04 +0800。负责人补充：之前做的未读小圆点代表任务完成，希望与工作转圈联动起来——进行中显示转圈，完成后显示小圆点。
- 状态互斥：运行中的会话只显示转圈，不显示未读点（即使服务端仍带着旧的未读标记）；运行结束由 Host 标记未读后，才显示完成小圆点。正在查看的当前会话不显示完成点，切走后尚未读的会话才显示。
- 覆盖范围：项目下子会话、置顶副本与「最近」分组共用同一套规则；点击会话打开时照常清除未读点，恢复铅笔图标。
- 动效：完成小圆点出现时做 240ms 的轻微放大淡入，让「转圈消失 → 圆点出现」的状态切换被看见；`prefers-reduced-motion` 下关闭动画。
- 样式拆分：把转圈与完成点样式从已到 400 行硬上限的 `SidebarSectionList.module.css` 拆到新的 `SidebarStatus.module.css`，列表样式文件降到 367 行，避免给并发中的图钉样式继续加压。
- 实测（真实 5173 + 无头 Edge，浅色）：后台会话运行中为转圈且无圆点；在新聊天等待其完成，转圈消失并出现小圆点（`animation: sidebarDoneDot 0.24s`）。截图：`%TEMP%\lfaa-pw\agent-working\10-completed-dot.png`、`11-done-dot-animation.png`。拆分样式后再次实测：未读完成行为 `_sidebarDoneDot_*` 动画、圆点 7.03px；打开后转圈为 `_sidebarWorkingSpin_*`、强调色 `rgb(230,106,168)`、圆点消失。截图 `15-status-css-split-ok.png`。测试会话已删除。
- 测试：`session-running-indicator.test.tsx` 扩到 9 条（运行中隐藏完成点、已完成显示、当前会话隐藏、最近分组规则、只为未读完成行渲染圆点）；该文件 9/9 通过，`chat-running-sessions` 3/3 通过。
- 门禁（并发改动收尾后复跑）：`pnpm test` **445 项全部通过**；`pnpm check` 0 错误 / 4 条既有警告（53 包 / 428 源文件）；`pnpm lint` 419 文件 0 问题；`pnpm typecheck`、`pnpm build` 通过。收尾前另一并发会话的构建残留与置顶用例曾短暂让全仓门禁变红，对方收尾后已恢复。
- 本轮文件：`docs/updata-log/000336-20261122-0004-task-state-dot-linkage.md`、`packages/ui/layout/client/components/navigation-items.ts`、`packages/ui/layout/client/components/SidebarSectionList.tsx`、`packages/ui/layout/client/components/SidebarSectionList.module.css`、`packages/ui/layout/client/components/SidebarStatus.module.css`、`packages/ui/layout/tests/session-running-indicator.test.tsx`、`docs/dev-log/000201-000400.md`。
- Git：保留工作区内此前未提交的改动；未提交或推送。