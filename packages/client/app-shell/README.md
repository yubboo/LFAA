# @lfaa/app-shell

LFAA 产品 Shell / Workbench Composition。

负责三栏 Workbench、Header、Composer、Runtime Controls、Settings、User/Shell Menu 与 Chat Agent / Work Agent / Manual 三种表现层装配。Chat/Work 只改变交互方式，不允许改变 Agent 能力等级。

- Chat Agent：对话/插话干预；
- Work Agent：无限画布编辑 + 对话干预；
- Manual：无模型，直接操作画布、Terminal 和已注册真实工具。

不负责 Browser Host 连接、Vite/Node Adapter、Provider HTTP、PTY 创建或 Runtime Home 文件。右侧未注册 Tool 必须 disabled，不得伪造执行。
