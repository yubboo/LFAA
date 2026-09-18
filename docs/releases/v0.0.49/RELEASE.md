# LFAA v0.0.49 Release

本版本以 v0.0.48 为历史基线，只调整 Composer 底部安全间距和对应静态 UI 契约。

## 交付内容

- 新增 `--agent-composer-bottom-gap`；
- Desktop / Compact / Mobile 分别使用响应式底部留白；
- safe-area 与布局间距取较大值；
- Composer 保持正常 Grid 文档流；
- UI contract 增加 bottom-gap 防回归；
- #21.16 归档，#21.17 Active。

## 未修改

- 三向吸附 / reverse unlock / collapsed 规则；
- 容器响应式 Mode 计算；
- Hover / Click 左栏宽度统一；
- Sync / GitHub / Setup / Update；
- Windows PowerShell 编码；
- PTY bridge / node-pty。

真实视觉状态：`pending-windows-visual-test`。
