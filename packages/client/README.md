# Client packages

## 类型化 Remote

`connection/src/api.ts` 的 `invokeTypertRemote()` 复用现有 `/api` 同源请求、HttpOnly 会话 Cookie、取消信号与统一错误处理。调用使用 `TypertRemoteClientContract` 将方法输入和输出绑定到静态 TypeScript 类型；Host 仍以注册方法的授权器及解析器为运行时权威。当前 `auth/me` 是首个消费该传输的 Client 方法，类型生成与其他 API 迁移待后续 P0 实施。

## AI Work 模型卡片

`connection/src/api.ts` 提供不含 Provider 密钥的账户和模型目录类型；`ui-settings-models/src/model-options.ts` 是设置中心与 AI Work 共用的思考选项映射。`ui-settings/src/SettingsPage.tsx` 和 `ui-chat/src/AiWorkChat.tsx` 均使用同一映射与账户 API，保存到已有的 AI 账户 `reasoning_mode`。

AI Work 的模型悬浮卡片展示账户目录中的模型、真实模型思考档位和已有的输出长度策略。输出长度读取 `UserSettings.aiRuntime.speed`，只影响 LFAA 输出上限，不代表 Provider 思考力度；主题、强调色、字体、字号、背景遮罩、模糊和减少动态效果继续由工作区外观设置提供。客户端不读取 Provider 凭据，也不猜测目录未声明的模型能力。

## AI Work 侧边聊天

`ui-workspace/src/ApplicationWorkspace.tsx` 在右侧工具与资源栏提供“侧边聊天”，并使用账户快捷键设置 `shortcuts.openSideChat`（默认 `Ctrl+Alt+S`）；旧 Host 响应缺少该新增字段时，读取 `ui-settings-general` 的同一默认值，保留按钮与快捷键且不覆盖已保存的空绑定。`ui-chat/src/client/index.ts` 将 `AiWorkSideChat` 登记到 Client Module Registry，供工作区按需加载。`ui-chat/src/AiWorkChat.tsx` 在主聊天发送前识别 `/side` 命令，后缀文本保留为侧聊草稿。`ui-chat/src/AiWorkSideChat.tsx` 使用独立的 Session、草稿、消息状态和 SSE 流；主聊天 Busy、续问、选中 Session 与取消入口不进入侧聊。侧聊只看到打开时 Session Owner 已记录的上下文，主聊天尚未持久化的流片段/实时进度不复制，面板会明确说明这一点。Server 会基于 `session/side-chat` 来源标记强制零工具、禁止澄清和记忆写入。

## AI Work 空闲虚化

`ui-chat/src/AiWorkChat.tsx` 通过单个可撤销的空闲控制器监听页面活动：捕获阶段的鼠标、键盘、滚动、触屏或焦点操作会清晰显示输出；超过外观设置的账户延迟后，消息、锚点刻度、滚动条和回到底部控件使用同一虚化状态。`appearance.advanced.aiWorkOutputFocusBlurEnabled` 控制启用，`aiWorkOutputFocusBlurIdleSeconds` 默认 60 秒且范围 60–3600 秒、按整分钟递增，`aiWorkOutputFocusBlurPercent` 控制 0–8px 强度映射。虚化状态不做大型滚动层的逐帧滤镜动画，也不改变输出透明度。输入框和输入卡片底色始终不应用滤镜；隐藏页面暂停计时，卸载时撤销事件监听和计时器。

## AI Work 消息操作

`ui-chat/src/AiWorkChat.tsx` 为用户消息复制原始提问、编辑并重新发送，为已完成助手消息复制完整 Markdown、提交正负向反馈或分支到新聊天。编辑活动中的回复时先经取消 API 请求停止，并通过临时 run 事件流等待终态；随后 `connection/src/api.ts` 请求认证的用户问题前缀分支，再把修订文本提交到新 Session。Session Controller 让会话 Owner 验证独立用户轮次、拒绝仍有活动运行的会话并从目标问题前推导边界。源消息与后续历史保留在原会话中。助手回答分支与 Workspace Worktree 分支仍按选中回答继承上下文；Workspace Controller 校验受管 Worktree 的账户、App、源项目和 Daemon 归属后创建绑定该项目的新 Session。符合在线节点能力条件时才展示新 Worktree 选项。历史工具操作不重放。按钮、编辑器、弹窗和错误态使用既有主题令牌；不增加设置或样式变量。

## AI Work Git 变更审阅

`ui-workspace/src/GitChangeSummary.tsx` 是当前项目真实 Git 状态的右栏入口；`GitChangeReview.tsx` 通过目标 Daemon 的 Git Owner 浏览单文件差异，通过认证 Workspace Controller 与 `project-files-v1` 分段读取或编辑已登记项目中的普通 UTF-8 文本。保存携带 SHA-256，遇到并发改写保留草稿并要求重新读取；差异加载按当前项目和文件丢弃过期响应。审阅器提供统一/并排、空白过滤、导入过滤、自动换行、Markdown 预览、完整文件、完整视图、补丁文本复制和手工 `git apply` 命令复制；命令只进入剪贴板，不会在产品中执行。界面沿用 Appearance 的代码字体/字号、主题、强调色、遮罩、模糊、差异标记和减少动态效果设置。

## DSH 工作区扩展

`ui-workspace/src/sidebar-right-runtime.ts` 负责 DSH `sidebarRightTabs` 的登记、选择和展开；`ApplicationWorkspace.tsx` 渲染上游 tab 的 `guide` 图标入口，点击后通过同一 Runtime 激活并展开该 tab。`ui-layout/src/Workbench.tsx` 在存在右侧上下文栏的应用路由消费 `shell.overlay`，使浮动扩展留在 `.workbench-shell` 的 LFAA 外观继承树中。插件正文仍通过 `DshSlotOutlet` 渲染上游组件；共享主题、强调色、字体、字号、模糊、遮罩、对比度和减少动态效果由 LFAA Settings Owner 提供。

`client/modules/src/client/session-scope.ts` 为 DSH Renderer 提供稳定的无 DSH Session 投影，因为 LFAA 不把自己的会话模型伪装成 DSH Session。当前根级 DSH Slots（包括 Wallpaper Engine Settings 和右侧栏）可正常渲染；显式 DSH Session target 与要求 `SessionProvider` 的扩展仍不可用。若后续正式装配 DSH `uiSession` Owner，该 Owner 保持唯一作用域来源。

`DshSlotOutlet` 透传上游 `renderSlot` 的 `fallback` 选项；Settings 与已登记的右侧扩展 tab 在 Client renderer 缺失或 Slot 没有内容时展示真实未就绪原因。可选 `shell.overlay` 不设 fallback，避免将正常的无浮层状态误报为插件故障。

## 工作区窄屏分栏

`ui-dockkit/src/ResizableWorkbench.tsx` 默认保持通用单侧布局；应用工作区通过 `responsiveRightDock` 启用窄屏右栏联动。`useWorkbenchMetrics` 的对应布局策略将应用中心最小宽度设为 260px：空间足够时右栏参与网格并可拖动，较窄时左栏改用 Overlay、中心与右栏继续并排；不足以同时保留中心和右栏时，右栏转为可拖动宽度的 Overlay。Settings 不启用此策略，仍沿用既有断点与单侧导航行为。

## Markdown 知识库

`connection/src/api.ts` 提供账户知识库与已登记项目来源 API；`ui-settings/src/KnowledgeLibraryPanel.tsx` 在设置中心“插件”页管理知识、用户 Skills、提示词和领域专家 Markdown，可上传 `.md`/`.markdown`、编辑/删除，并把 Workspace/Minecraft 项目中的相对目录链接为实时来源。列表只请求短摘要；完整正文仅在用户打开编辑器时读取，上传与手工编辑限制为 64 KiB UTF-8。范围下拉明确区分单 App 和所有 App 共享；本地项目来源始终保持项目 App 隔离。界面不改变扩展、权限、MCP 或外观设置，由既有 `plugins.enabled`、`permissions.mode`、MCP App 范围及外观令牌控制运行行为。
