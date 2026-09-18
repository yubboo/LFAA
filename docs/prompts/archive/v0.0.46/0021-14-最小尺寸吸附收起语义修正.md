# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell / ui-workbench`

## 当前任务目标

在 v0.0.45 的响应式基线上，修正三向吸附语义：**吸附目标是收起，不是把仍然展开的面板压到 min 以下。** 同时提高左栏、右栏、底部终端的可用最小尺寸，保证内容在展开状态下仍可阅读。

## 当前交互事实

### 1. 三档响应式

```text
Desktop >= 1240px
→ 左 / 中 / 右 Dock 布局

Compact 760 ~ 1239px
→ 左栏 Dock
→ 右栏 Drawer

Mobile < 760px
→ 中间主区全宽
→ 左右栏 Drawer
```

### 2. 可用最小尺寸

```text
左栏：min 280 / initial 300 / max 640
右栏：min 360 / initial 400 / max 760
Bottom：min 180 / initial 280 / max 560
```

min 是“展开态还能正常排版”的硬下限，不能再拿 min 以下的宽度显示内容。

### 3. 三向拖拽吸附

左栏、右栏、底部终端统一：

```text
Pointer Down
→ 正常跟手 Resize
→ 到达 min
→ 立即进入 snap capture / 收起预览
→ 预览尺寸吸到 0
```

如果鼠标仍然按住：

```text
snap capture
→ 反向拖动
→ 达到 min + snapHysteresis
→ 退出 snap capture
→ 面板恢复到至少 min
→ 可继续向外拉伸
```

只有：

```text
Pointer Up 时仍处于 snapped
```

才真正提交 collapsed。

正式 collapsed 后 separator 不能重新拉开，只能通过：

```text
Ctrl+B       左栏
Ctrl+J       Bottom Terminal
Ctrl+Alt+B   右栏
```

或对应 Header 按钮恢复。

### 4. 动画手感

- 普通 pointermove 阶段不启用 Grid transition；
- 到 min 触发 snap preview 时允许一个很短的磁吸收起过渡；
- 不允许出现 min 以下的“半残废展开态”；
- 正式开合继续使用平滑 ease-out。

## 允许修改

- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- `scripts/ui-contract-check.mjs`
- UI / Testing / Development Log / Plan / Progress / Changelog / Release / Code Map

## 禁止修改

- GitHub / Sync / Setup / Update 业务逻辑
- PTY 协议和 node-pty bridge
- Agent Runtime / Tool Runtime / Permission Engine
- Config Storage / Secret Store

## 验收条件

- 左右栏展开时不允许小于 min；
- 拖到 min 立即进入吸附收起预览；
- Pointer 不松手可从已吸附状态反向拖回并恢复至少 min；
- 松手后正式 collapsed，separator 不可展开；
- 右栏最小宽度足以完整显示“审查 / 终端 / 浏览器 / 文件”及快捷键，不再出现截图中的文字截断；
- Desktop / Compact 断点与新 min 相容；
- Windows PowerShell 脚本不修改且 BOM 不回退；
- Development Log / UI Layout / Test / Code Map / Changelog / Release 同步。

## 当前状态

`active / pending-windows-visual-test`
