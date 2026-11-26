# 右栏标签菜单与快捷键系统方案

| 项目 | 内容 |
| --- | --- |
| 状态 | 已实施（2026-11-26） |
| 日期 | 2026-11-26（Asia/Shanghai） |
| 实施级别 | A1（新增跨包快捷键契约、设置页与标签右键菜单） |
| 前置 | [IDE 化右侧工作台](../features/right-workbench-ide.md) |

## 1. 目标与边界

- 目标：右栏标签支持右键快捷操作；设置中心提供可自定义的键盘快捷键，覆盖当前真实功能。
- 不做：固定标签（pin）、系统级全局热键、未接入功能的占位快捷键。
- 约束：快捷键必须与界面按钮走同一实现；没注册的动作不得出现在设置页。

## 2. 方案

1. **契约下沉到 `@lfaa/ui/layout`**：`WorkbenchShortcutContribution` / `WorkbenchShortcutState` 进入 contract；`WorkbenchClientService` 增加 `registerShortcut` / `setShortcutKeys` / `resetShortcutKeys` / `runShortcut` / `getShortcutKeys`，快照新增 `shortcuts`。
2. **分发集中在 Shell**：`useShellShortcuts` 注册壳层与导航动作，并维护唯一的全局 `keydown`；`Esc` 保持固定。
3. **动作由所有者注册**：聊天插件注册会话/工作台入口动作；标签栏注册 4 个标签级动作（工作台挂载期间有效）。
4. **菜单由标签栏拥有**：`useWorkbenchTabMenu` 生成有序标签、当前标签与关闭/切换动作；`WorkbenchTabMenu` 只负责渲染与定位。
5. **设置页在聊天插件**：`settings:shortcuts` 视图 + 设置中心目录项；键位存 `localStorage`，录制、冲突提示与恢复默认都在页面内完成。

## 3. 取舍

- 键位保存在本机 `localStorage`（与外观偏好一致，不动宿主、无需重启 5173）；换设备不跟随，接受。
- 浏览器标签级动作随工作台挂载注册：这是「没注册就不出现」的直接结果，也避免工作台收起时快捷键空触发的假象。
- 默认键位避开浏览器保留组合；同时允许用户用录制的任意组合覆盖。

## 4. 验证

- `pnpm test`：新增 6 条用例（快捷键纯逻辑 5 条、设置页 1 条）。
- `pnpm build` / `pnpm verify:web`：通过。
- 内置浏览器实测：见 [功能文档](../features/keyboard-shortcuts.md#4-验收)。