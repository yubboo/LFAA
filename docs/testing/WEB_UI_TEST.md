# Web 工作台本地测试

## v0.0.46 / #21.14 最小尺寸吸附收起重点

本版本必须优先验证：

1. 窄窗口主区不再被右栏大面积覆盖；
2. 右栏 Drawer 打开时关闭入口仍在 Header 可见；
3. Tooltip 在左右边缘不被裁切；
4. 左 / 右 / 底部展开态不得小于各自 min；
5. 拖到 min 立即进入吸附收起预览；
6. Pointer 不松手时可从吸附状态反向拖回并恢复到至少 min；
7. 松手确认收起后 separator 不能重新拖出；
8. 右栏在最小宽度下文字 / 快捷键仍应完整可读。

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

## 1. Desktop（>=1240 CSS px）

1. 左 / 中 / 右三栏正常 Dock；
2. 右栏展开：终端 / 右栏按钮位于 Right Header；
3. 右栏收起：按钮回到 Center Header；
4. Header 底边线连续；
5. Composer 保持居中，不被侧栏压扁；
6. 页面无横向滚动。

## 2. Compact（760~1239 CSS px）

建议测试：1024x768、820x900。

1. 进入该断点后右栏默认收起；
2. 左栏继续作为 Dock；
3. 点击右栏按钮，右栏从右侧以 Drawer 覆盖主内容；
4. Drawer 宽度不能超过约 420px / 56vw 上限，不允许旧版 88vw；
5. Drawer 从 48px Header 下方开始，不能盖住 Header；
6. 终端 / 右栏按钮始终留在 Center Header；
7. 点击右栏按钮可立即关闭 Drawer；
8. 缩小 / 放大窗口过程中不出现主区突然消失。

## 3. Mobile（<760 CSS px）

建议测试：759x900、640x800、390x844。

1. 中间主区占满宽度；
2. 左右栏和终端进入该断点时默认收起；
3. Header 必须保留左栏 / 终端 / 右栏三个核心入口；
4. 更多 / 分享可以隐藏；
5. 左栏点击后从 Header 下方以 Drawer 出现；
6. 右栏点击后从 Header 下方以 Drawer 出现；
7. 左右 Drawer 宽度 <= 86vw 且 <= 340px；
8. Drawer 打开时仍能通过 Header 按钮关闭；
9. Composer 宽度适配屏幕，不溢出；
10. 不出现整页水平滚动。

## 4. Tooltip

Desktop / Compact：

- 左栏 Tooltip 向右展开，不能被左边界裁掉；
- 终端 / 右栏 Tooltip 向左展开，不能被右边界裁掉；
- 只出现一层自定义 Tooltip；
- 快捷键为 `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`；
- 等待数秒不能再出现浏览器原生 `title`；
- Tooltip 不应拦截 Click。

Mobile：Tooltip 可以隐藏，操作入口本身必须仍可理解和点击。

## 5. 左栏 Hover Preview

仅 Desktop / Compact 验证：

1. 正式收起左栏；
2. Hover 左栏按钮；
3. Preview 淡入但不改变 `leftCollapsed`；
4. 鼠标移动到 Preview 不闪退；
5. 离开后短延迟淡出；
6. Click / `Ctrl+B` 才正式展开。

## 6. 左侧拖拽 / min 吸附收起

Desktop / Compact：

1. 从正常宽度向内拖；
2. 到达 280px min 时立即进入 snap capture，不能继续出现 280px 以下的展开布局；
3. snap preview 应表现为收起，而不是停在更窄宽度；
4. **不要松手**，反向拖；
5. 反向达到 min + hysteresis 后左栏恢复到至少 280px；
6. 继续向外可正常拉伸；
7. 再次拖到 min 并松手，左栏正式收起；
8. 松手后 separator 不允许重新拉开；
9. 通过按钮 / `Ctrl+B` 才能重新展开。

## 7. 右侧拖拽 / min 吸附收起

只在 Desktop Dock 模式验证：

步骤与左侧一致。右栏 min 为 360px；到 360px 即进入收起吸附预览，不允许以更小宽度继续展开。松手确认后只能通过按钮 / `Ctrl+Alt+B` 打开。

Compact / Mobile 的右栏是 Drawer，不要求侧边 separator Resize。

## 8. Bottom Terminal min 吸附收起

1. 打开 Terminal Dock；
2. 向下拖动高度；
3. 到达 180px min 时立即进入 snap capture，不允许继续显示更矮的展开终端；
4. **不要松手**，向上反向拖；
5. 达到 min + hysteresis 后恢复到至少 180px，并可继续拉高；
6. 再次拖到 min 并松手，终端正式关闭；
7. 关闭后不能从底边拖出；
8. 必须通过 Header / `Ctrl+J` / 右栏终端入口打开。

## 9. 动画手感

使用慢速拖拽验证：

- Pointer 跟手，无明显“拖一下、面板过一会儿追上”的感觉；
- 普通 Resize 跟手；到 min 后才触发短磁吸收起，不出现 min 以下的破碎布局；
- 松手提交收起约 220~280ms ease-out；
- 按钮重新展开约 220~280ms ease-out；
- opacity / translate 与宽高变化同步。

## 10. 快捷键

非输入框聚焦时：

```text
Ctrl+B       左栏
Ctrl+J       底部终端
Ctrl+Alt+B   右栏
```

输入框 / textarea / contentEditable 聚焦时不得抢文本输入。

## 11. 真实终端与资源桥

保持原有验收：

- xterm + node-pty 可交互；
- resize 后 FitAddon 正常；
- Vite 退出后 PTY 回收；
- `.lfaa` 资源变更自动刷新；
- 资源接口不泄露 Secret / Token / 绝对路径。
