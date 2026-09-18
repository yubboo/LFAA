# LFAA v0.0.45 Release

本版本以 v0.0.44 为历史基线，解决 Web 工作台响应式崩溃、边缘 Tooltip 裁切和三向吸附手感问题，不覆盖旧版本。

交付内容：

- Desktop / Compact / Mobile 三档响应式；
- Compact 右 Drawer、Mobile 左右 Drawer；
- 核心 Shell Actions 在窄屏始终可见；
- Tooltip start/end 贴边安全定位；
- 左 / 右 / Bottom 三向弹性吸附；
- Pointer 按住期间可从 snap capture 反向拖回 min；
- Pointer Up 后正式 collapsed，separator 继续禁止反向展开；
- 拖拽阶段取消 CSS transition 追鼠标；
- 正式开合动画平滑化；
- UI 静态契约门禁升级。

未修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- Windows PowerShell 编码契约；
- PTY bridge 与 node-pty 行为；
- Agent / Tool / Permission / Config 边界。

发布前要求：治理、导入、开发日志、文档、注释、Windows PowerShell 编码、版本一致性、UI 静态契约、TS/TSX 语法、ZIP 根目录与 Round-trip 全部通过。
