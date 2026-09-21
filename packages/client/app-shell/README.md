# @lfaa/app-shell

LFAA 产品 Shell / Workbench Composition。

负责 Identity Client Surface、Smart Home、三栏 Workbench、Header、Composer、Runtime Controls、Settings、User/Shell Menu 与 Chat Agent / Work Agent / Manual 三种表现层装配。Chat/Work 只改变交互方式，不允许改变 Agent 能力等级。

- Chat Agent：对话/插话干预；
- Work Agent：无限画布编辑 + 对话干预；
- Manual：无模型，直接操作画布、Terminal 和已注册真实工具。

不负责 Browser Host 连接、Vite/Node Adapter、Provider HTTP、PTY 创建或 Runtime Home 文件。右侧未注册 Tool 必须 disabled，不得伪造执行。


## Smart Home / Identity Surface

`src/identity/` 只负责 First Run/Login 表现层；`src/app-hub/` 当前承载 Smart Home（公开组件名暂保 `LfaaAppHub` 兼容）；`src/product-surface.css` 提供两者共享的产品视觉/Motion token。Smart Home 自然语言输入只能 handoff 到现有 Workbench Composer，真实 Intent Router 归未来 App Pack Runtime。
