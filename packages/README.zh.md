# 包目录索引

所有可复用能力按 `packages/<group>/<package>` 组织。第二层目录是实际 pnpm package，包组目录不单独作为 package。

```text
packages/
├── core/          # 后续按需创建的 Agent、工具、聊天会话核心包（当前不建空包）
├── ui/
│   ├── layout/    # (@lfaa/ui-layout) 纯四栏可折叠 Shell、侧栏导航骨架与 Cordis workbench 插槽契约
│   └── theme/     # (@lfaa/ui-theme) 液态玻璃主题系统、浅深配色/字体 Token 与“外观”设置插件
├── workspace/
│   ├── sections/  # (@lfaa/sections) 侧栏自定义分区 Host 持久化与 Client 创建/重命名/删除插件
│   └── workspace/ # (@lfaa/workspace) 本地项目 CRUD、多源目录、悬浮卡/菜单与目录工作区插件
└── util/          # 至少有两个真实消费者时才提取的纯工具或跨包平台桥接
```

以上包均具备独立职责、公开 exports、Host/Client 环境隔离与对应测试；新业务（如聊天会话、Agent、远端连接）将按同样单一职责原则独立成包，不往既有包内堆砌职责。pnpm workspace 模式为 `packages/*/*`。
