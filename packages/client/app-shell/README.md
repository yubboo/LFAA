# @lfaa/app-shell

LFAA 产品 Shell / Workbench Composition。

负责三栏 Workbench、Header、Composer、Runtime Controls、Settings、User/Shell Menu 与产品区域装配；消费 `@lfaa/workspace`、`@lfaa/ui`、Config/Runtime public contracts。

不负责 Browser Host 连接、Vite/Node Adapter、Provider HTTP、PTY 创建或 Runtime Home 文件。右侧资源区域当前展示 Runtime/Capability 视图，不再把仓库 `.lfaa` 文件夹当资源事实源。
