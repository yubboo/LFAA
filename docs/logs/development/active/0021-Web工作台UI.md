# #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.17
- **状态：** active
- **关键词：** Web、Composer、底部留白、Safe Area、Responsive、Layout Token
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

## 当前结论

v0.0.49 在 v0.0.48 的响应式 / 三向吸附 / Hover 宽度统一基础上，只调整 Composer 的垂直落点。

Composer 不再使用固定 `.5rem` 底部 padding，而是读取单一设计变量：

```text
--agent-composer-bottom-gap
→ Desktop / Compact / Mobile 分别定义
→ .agent-composer-wrap
→ max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))
```

这样全屏时输入框不会贴近窗口底边，小屏又不会因为过大的固定留白浪费可用高度；安全区设备仍优先尊重 `safe-area-inset-bottom`。

## #21.17 Composer 底部安全间距

### 问题来源

用户 Windows 实机发现 v0.0.48 输入框距离页面底边过近，下方留白太薄，整体视觉重心偏低。该问题不是 Composer 本体高度错误，而是 `.agent-composer-wrap` 的 bottom padding 仍是固定 `.5rem`，没有跟随布局模式和容器高度变化。

### 当前实现

- 新增 `--agent-composer-bottom-gap`；
- Desktop：`clamp(1rem, 2.4vh, 1.75rem)`；
- Compact：`clamp(.875rem, 1.8vh, 1.375rem)`；
- Mobile：`.75rem`；
- Composer Wrap 使用 `max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))`；
- 不通过 `position:absolute` / `bottom` 强行抬高，仍保持正常 Grid 文档流；
- UI contract 增加 Composer bottom-gap 单一变量检查。

### 为什么这样做

- 使用 `vh + clamp()`：大屏适当上移，但不会随屏幕高度无限增加；
- Compact 减小间距：避免短窗口浪费主区高度；
- Mobile 使用较小稳定值：触摸屏空间优先；
- `safe-area` 仍是底部最终保护下限。

## 最新变更

### #21.17 Composer 底部安全间距

- Composer 底部位置改为 `--agent-composer-bottom-gap` 单一变量；
- Desktop / Compact / Mobile 使用不同响应式取值；
- safe-area 作为最终底部保护下限；
- UI contract 增加固定 bottom padding 防回归；
- 不改三向吸附、响应式模式、PTY 和基础设施。

## 影响范围

- `packages/app-shell/src/agent-workbench.css`
- `scripts/ui-contract-check.mjs`
- UI Layout / Web UI Test / Prompt / Plan / Progress / Changelog / Release / Version

## 不影响

- 左 / 右 / Bottom 三向吸附状态机；
- Hover Preview 与 Click 左栏宽度单一事实源；
- Desktop / Compact / Mobile 模式计算；
- Header / Tooltip；
- Sync / GitHub / Setup / Update；
- PTY / node-pty。

## 验证结果

发布前必须通过 governance / imports / dev-log / docs / comments / Windows BOM / release consistency / UI contract / TS syntax / ZIP round-trip。

Windows 实机重点确认：全屏与小窗下 Composer 底部留白自然，不贴底、不悬得过高，终端打开时仍保持合理间距。

## 历史基线

- #21.16 已归档：`archive/0021-16-Hover与点击左栏宽度统一.md`
- #21.15 及更早继续保留在 archive。

## 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.15 | superseded / delivered | `archive/` 对应历史文件 |
| #21.16 | superseded | `archive/0021-16-Hover与点击左栏宽度统一.md` |
| #21.17 | active | `active/0021-Web工作台UI.md` |
