# Canvas Agent 生图落点、侧栏切换与 App 手动入口

<a id="lfaa-canvas-agent-image-and-app-handoff-20261113"></a>

## 用户目标与可复现证据

- 用户从通用 Work 要求在画布里生成图片后，真实图片只出现在资产库，画布没有图片节点，也没有定位到结果。
- `/apps/workspace/canvas` 的 App 聊天栏占用了右侧上下文栏；用户需要能从画布右下角打开通用 Work 会话、收起会话，并继续访问原有工具与资源栏。
- 用户报告写作 App 的手动面板消失。截图地址为 `/apps/workspace/canvas`，这不是写作 App 手动入口；必须单独检查 `/apps/writing/normal`，不将工作区画布误判为写作页面。
- 源码检查确认：`canvas_generate_image` 允许不传 `nodeId`，生成 Owner 仅提交素材；进入 Canvas 时 `enteredCanvas` 分支会在没有显式侧栏覆盖时强制展开聊天，忽略 `canvas.agentPanelDefaultOpen`。

## Owner、设置、数据与权限

- 画布项目/节点/素材和并发写入：`packages/canvas/canvas`；图片生成和原子素材提交：`packages/canvas/canvas-generation`；Agent 工具与模型目录检查：`packages/canvas/tool-canvas`。
- 画布与通用 Work 的 Chat Dock、项目上下文和 Canvas 刷新：`packages/client/ui-workspace`、`packages/client/ui-chat`、`packages/client/ui-layout`。写作手动页仍由 Writing App 路由装配，其编辑器与写作数据归既有 Writing Owner。
- 复用现有 `canvas.agentPanelDefaultOpen`、Canvas 项目选择、图片生成账户/模型和当前 `permissions.mode`；不新增、重置或修改用户偏好，不直接调用真实图片/视频 Provider。
- 图片文件必须先由生成 Owner 真实返回，再由 Canvas Owner 原子保存素材和节点；所有 Agent 写操作继续经过统一 Permission Owner。

## 修改边界

1. 对支持 `image` 节点的 Canvas App，Agent 图片生成成功时将图片素材和引用它的图片节点一起原子落盘；已有生成节点路径继续更新原生成节点。当前 Canvas 恰好因 Agent 更新新增图片节点时，刷新并将视口定位到新节点。
2. Canvas 中聊天面板按账户现有默认配置初始化，不因切入画布强制打开；增加右下角“与 AI 对话”入口。聊天关闭后显示既有右侧上下文/工具栏；原布局折叠偏好仍有效。
3. 用真实路由实测写作手动入口。若 `/apps/writing/normal` 已正常装配，记录截图路由误认的根因，不改写作 App；若失败，只沿当前路由 Owner 做最小修复。

## 验收

- 定向回归覆盖：生成无 `nodeId` 时新图片节点引用正确素材、原生成节点流仍正常、素材/节点原子提交失败不留孤儿；Canvas 侧栏默认值、开关和右下角入口。
- 构建 Canvas Owner、Canvas Generation、Tool Canvas、Workspace 与正式 Web，并检查 `git diff --check`。
- ChatGPT 内置浏览器使用 admin 当前账户，实测 `/apps/workspace/canvas` 与 `/apps/writing/normal`；检查常用桌面和一处窄分栏/短屏、右下入口、打开/收起聊天、已有图片节点定位、写作作品/章节手动区可见。
- 页面验收不生成新 Provider 图片/视频、不更改设置、不新建/删除真实项目或节点；源码和隔离回归不能替代真实 Provider 计费验收。

## 实施记录

- 状态：进行中。
- 初步证据：当前工作树来源码显示无 `nodeId` 的 Agent 生图只保存 asset；`enteredCanvas` 在无覆盖时使用 `true`；用户截图页面 URL 是 `/apps/workspace/canvas`，不是写作手动路由。
- 后续按批次记录源码、回归、构建、真实页面视口/交互、截图证据、设置和未验范围。
