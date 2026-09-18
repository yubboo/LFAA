# Web 工作台本地测试

## v0.0.47 / #21.15 容器响应式与布局变量化重点

本版本优先验证：

1. 小窗口不再同时被固定 280 / 360 侧栏挤压；
2. LayoutMode 根据 Workbench 容器实际可用宽度计算，而不是 window 固定断点；
3. 1024 左右可在空间允许时保持合理双 Dock；
4. 950 / 820 / 760 左右自动进入左 Dock + 右 Overlay；
5. 更窄容器进入双 Overlay；
6. 大屏保存的侧栏宽度切到小窗后自动重新 clamp；
7. 左 / 右 / Bottom 到动态 min 后吸附收起；
8. Pointer 不松手时仍能从 snap preview 反向拖回；
9. CSS 变量 / clamp / calc 不产生横向溢出；
10. Tooltip / Header / Composer 保持可用。

## 前置

```text
Node 24.x
pnpm 11.17.0
```

## 启动

```text
LFAA-Setup.bat
→ 2 启动 Web
```

浏览器：

```text
http://127.0.0.1:5173
```

## 1. 响应式矩阵

依次把“浏览器内容区 / 工作台容器”调到接近：

```text
1600x900
1280x800
1100x800
1024x768
950x800
820x900
760x900
680x800
640x800
390x844
```

不要只看浏览器外框像素；最终以页面内容区实际宽度为准。

### 期望

- 1600 / 1280 / 1100 / 1024：通常能进入 Desktop 双 Dock；
- 950 / 820 / 760 / 680：通常为 Compact（左 Dock + 右 Overlay）；
- 640 / 390：Mobile（双 Overlay）；
- 实际 Mode 由计算公式决定，边界附近允许因容器高度/宽度计算产生少量差异。

## 2. Desktop 双 Dock

1. 左 / 中 / 右三栏均参与布局；
2. 左 / 右默认宽度随容器变化，不是固定 300 / 400；
3. 中央区不得被压成细条；
4. Right Header 与 Center Header 底边连续；
5. 收起右栏后 Shell Actions 回到 Center Header；
6. 页面无水平滚动。

## 3. Compact：左 Dock + 右 Overlay

1. 左栏参与布局；
2. 右栏打开后覆盖在主区右侧，但不改变 Center 宽度；
3. 右 Overlay 大约为容器 34%，并受 15rem~20rem clamp 约束；
4. Overlay 从 Header 下方开始；
5. 终端 / 右栏按钮始终在 Center Header；
6. 关闭右 Overlay 后中央区几何不能跳动；
7. 从 1280 缩到 900 时，历史左栏宽度不能原样过大保留。

## 4. Mobile：双 Overlay

1. Center 占满可用宽度；
2. 左右栏默认收起；
3. 点击左栏 / 右栏按钮分别出现 Overlay；
4. Overlay 不参与 Center 几何；
5. Header 核心三个控制入口保留；
6. Tooltip 可隐藏；
7. Composer 不超出页面；
8. 不产生整页横向滚动。

## 5. 动态侧栏最小宽度

不要用“必须正好 280 / 360”验收。

当前公式输出大致：

```text
左 min：196~232
右 min：228~288
Bottom min：136~176
```

验证：

- 左栏在 min 时导航文字仍可读；
- 右栏在 min 时“审查 / 终端 / 浏览器 / 文件 + 快捷键”仍可正常排布；
- 如果容器不足以让右栏 Dock 后保持可用 Center，应切 Compact，而不是继续缩 Center。

## 6. 左侧 Resize / Snap

Desktop / Compact：

1. 向内拖左 separator；
2. 到本次动态 min 后进入 snap preview，视觉吸到 0；
3. 不松手，反向拖；
4. 超过 `min + snapHysteresis` 后恢复到 min；
5. 继续向外正常拉宽；
6. 再拖到 min 并松手，正式 collapsed；
7. collapsed 后 separator 不能拉开；
8. 用按钮 / `Ctrl+B` 恢复。

## 7. 右侧 Resize / Snap

仅 Desktop Dock：

步骤同左侧。Compact / Mobile 的右栏是 Overlay，不显示右 resize separator。

正式收起后用按钮 / `Ctrl+Alt+B` 恢复。

## 8. Bottom Resize / Snap

1. 打开 Terminal Dock；
2. 向下拖；
3. 到动态 bottom min 后 snap preview 收到 0；
4. 不松手向上反拖，超过 hysteresis 后恢复；
5. 松手确认收起后底边不能直接拉出；
6. 用 Header / `Ctrl+J` / 右栏“终端”入口恢复。

## 9. Tooltip

Desktop / Compact：

- 只出现一层自定义 Tooltip；
- 左栏提示向右展开；
- 终端 / 右栏提示向左展开；
- `Ctrl+B / Ctrl+J / Ctrl+Alt+B` 正确；
- 等待数秒不能再出现浏览器原生 `title`；
- Tooltip 不拦截 Click。

## 10. 左栏 Hover Preview

Desktop / Compact：

1. 正式 collapsed 左栏；
2. Hover 左栏按钮；
3. Preview 淡入但不改变 `leftCollapsed`；
4. 鼠标移动到 Preview 不闪退；
5. 离开后淡出；
6. Click / `Ctrl+B` 才正式展开。

## 11. 动画手感

慢速拖拽确认：

- 普通 Resize 直接跟手；
- 没到 min 前无 Grid transition 追鼠标；
- 到 min 才有短磁吸收起；
- 反向解锁不会卡住；
- 正式开合使用 ease-out；
- Drawer 打开 / 关闭不会推挤 Center。

## 12. 基础设施回归

保持原有验收：

- xterm + node-pty 可交互；
- Resize 后 FitAddon 正常；
- `.lfaa` 资源热刷新；
- Sync / GitHub / Setup / Update 行为不变化；
- Windows PowerShell BOM 保留。
