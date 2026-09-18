# LFAA v0.0.46 Release

本版本以 v0.0.45 为历史基线，修正三向拖拽吸附的语义错误：**到最小可用尺寸就吸附收起，不允许继续以更窄尺寸展开。**

交付内容：

- 左栏 min 280px / initial 300px；
- 右栏 min 360px / initial 400px；
- Bottom Terminal min 180px / initial 280px；
- 左 / 右 / Bottom 到 min 即进入 snap capture；
- Pointer 按住时可从已吸附状态反向拖回并恢复到至少 min；
- Pointer Up 时仍 snapped 才正式 collapsed；
- 正式 collapsed 后 separator 继续禁止反向展开；
- Desktop / Compact 断点更新为 1240 / 760；
- 删除旧的 min 以下弹性展开算法；
- UI 静态门禁更新为“min 即吸附收起”契约。

未修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- Windows PowerShell 编码契约；
- PTY bridge 与 node-pty 行为；
- Agent / Tool / Permission / Config 边界。

发布前要求：治理、导入、开发日志、文档、注释、Windows PowerShell 编码、版本一致性、UI 静态契约、TS/TSX 语法、ZIP 根目录与 Round-trip 全部通过。
