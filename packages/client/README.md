# Client packages

## 类型化 Remote

`connection/src/api.ts` 的 `invokeTypertRemote()` 复用现有 `/api` 同源请求、HttpOnly 会话 Cookie、取消信号与统一错误处理。调用使用 `TypertRemoteClientContract` 将方法输入和输出绑定到静态 TypeScript 类型；Host 仍以注册方法的授权器及解析器为运行时权威。当前 `auth/me` 是首个消费该传输的 Client 方法，类型生成与其他 API 迁移待后续 P0 实施。

## AI Work 模型卡片

`connection/src/api.ts` 提供不含 Provider 密钥的账户和模型目录类型；`ui-settings-models/src/model-options.ts` 是设置中心与 AI Work 共用的思考选项映射。`ui-settings/src/SettingsPage.tsx` 和 `ui-chat/src/AiWorkChat.tsx` 均使用同一映射与账户 API，保存到已有的 AI 账户 `reasoning_mode`。

AI Work 的模型悬浮卡片展示账户目录中的模型、真实模型思考档位和已有的输出长度策略。输出长度读取 `UserSettings.aiRuntime.speed`，只影响 LFAA 输出上限，不代表 Provider 思考力度；主题、强调色、字体、字号、背景遮罩、模糊和减少动态效果继续由工作区外观设置提供。客户端不读取 Provider 凭据，也不猜测目录未声明的模型能力。

## AI Work 侧边聊天

`ui-workspace/src/ApplicationWorkspace.tsx` 在右侧工具与资源栏提供“侧边聊天”，并使用账户快捷键设置 `shortcuts.openSideChat`（默认 `Ctrl+Alt+S`）；旧 Host 响应缺少该新增字段时，读取 `ui-settings-general` 的同一默认值，保留按钮与快捷键且不覆盖已保存的空绑定。`ui-chat/src/client/index.ts` 将 `AiWorkSideChat` 登记到 Client Module Registry，供工作区按需加载。`ui-chat/src/AiWorkChat.tsx` 在主聊天发送前识别 `/side` 命令，后缀文本保留为侧聊草稿。`ui-chat/src/AiWorkSideChat.tsx` 使用独立的 Session、草稿、消息状态和 SSE 流；主聊天 Busy、续问、选中 Session 与取消入口不进入侧聊。侧聊只看到打开时 Session Owner 已记录的上下文，主聊天尚未持久化的流片段/实时进度不复制，面板会明确说明这一点。Server 会基于 `session/side-chat` 来源标记强制零工具、禁止澄清和记忆写入。

## AI Work Run 断流恢复

`connection/src/api.ts` 收到首个 Session 快照后记录助手消息的 Run ID；同一 SSE 流在明确 `done` 前 EOF、读取断开或遇到 408/425/429/5xx 时，按 250ms 起步、最多 8 秒的指数退避，通过认证 GET 重新订阅同一 Run。重连快照覆盖已持久化正文，后续 delta 接在快照后；不会重放创建 Run 的 POST。等待和流读取沿用当前请求的 `AbortSignal`，只有终态 `done` 才让调用完成。尚未收到 Run ID 就断流时会报告传输错误，避免猜测或重复创建任务。

外部 Claude Agent SDK 的顶层文本增量沿 `subagent-delta` 事件临时展示在对应工具活动的展开详情中，不进入 Session 快照或本地消息正文；连接层校验活动 Run ID，并与助手正文 delta 保持事件顺序。预览长度和并发项目数有界，Run 结束、切换会话或卸载后会清除。

## AI Work Run 暂停与继续

`ui-chat/src/AiWorkChat.tsx` 的暂停/继续控件与独立的显式停止控件分别作用于同一 Run；`connection/src/api.ts` 通过认证 Run API 发起暂停/继续，并消费 SSE `pause-state`。当前 Provider 请求或已派发工具未结束时显示“正在暂停”，Agent 到达安全检查点后显示“已暂停”；继续复用原 Run，不创建新消息、不重发已派发工具。审批和澄清等待时可立即暂停，收到交互结果后仍保持暂停，直到用户继续。服务重启会按现有 Run 恢复合同把未完成任务标记为中断。

## AI Work 澄清问题

Agent 通过 `lfaa_ask_user` 暂停当前 Run 时，`ui-chat/src/AiWorkChat.tsx` 将问题卡片嵌在发起问题的助手消息中，选项、自由回答和跳过都在卡片内完成。答案只作为原问题工具的结果继续，不新增普通用户消息；完成后问题卡仍展示在原助手消息下。通知提示由 `general.questionNotifications` 控制，关闭通知不隐藏卡片；主题、字体、字号、遮罩和模糊沿用外观设置令牌。

## AI Work 空闲虚化

`ui-chat/src/AiWorkChat.tsx` 通过单个可撤销的空闲控制器监听页面活动：捕获阶段的鼠标、键盘、滚动、触屏或焦点操作会平滑恢复输出；超过外观设置的账户延迟后，消息、锚点刻度、滚动条和回到底部控件使用同一虚化与淡出状态。`appearance.advanced.aiWorkOutputFocusBlurEnabled` 控制启用，`aiWorkOutputFocusBlurIdleSeconds` 默认 60 秒且范围 60–3600 秒、按整分钟递增，`aiWorkOutputFocusBlurPercent` 同时控制 0–8px 模糊半径与 100% 时完全淡出；中间值渐增模糊并降低不透明度。状态变化使用 CSS 过渡并遵循减少动态效果设置；输入框保持清晰，隐藏页面暂停计时，卸载时撤销事件监听和计时器。

## Electron 桌面更新体验

`ui-layout/src/Workbench.tsx` 在更新可用时提供鼠标悬浮/键盘聚焦的版本日志卡片；点击顶栏“更新”继续调用 Electron 唯一更新 Owner 的检查 IPC 和既有下载确认，不新增下载入口。下载期间显示来自 electron-updater 的真实字节、比例和速度，顶栏保留状态入口，面板可取消当前下载；完成后只通过既有更新提示等待用户选择“稍后”或“重启并安装”。卡片、下载面板与弹窗跟随账户外观主题、强调色、字体/字号、对比度、模糊和减少动态效果；`appearance.updateSurfaceOpacity` 由设置中心外观页管理，默认 92%、范围 70–100%，通过 Settings Owner 校验及持久化。Electron 用系统代理可用的 Chromium 网络栈读取版本清单，从单一稳定版清单确定目标版本，并要求 Release feed 与清单匹配，因此旧客户端直接取得当前 latest 稳定版。当前版本不低于清单时不请求 Release feed。检查网络对超时、连接重置及 HTTP 408/425/429/5xx 最多重试一次；UI 使用可操作的错误分类，主进程日志只写检查阶段、请求步骤与已知安全状态码/错误码，不记录响应头、Cookie、Token、原始响应或下载 URL。

## AI Work 消息操作

`connection/src/api.ts` 的消息读取支持可选游标；主聊与侧聊每次先读最新 50 条，再按需向前加载。Session Owner 在账户归属检查后提供最多 100 条的稳定页，并在每页完整校验 JSONL 哈希链；大日志读取仍有随日志增长的同步 CPU 成本，尚无长会话实机性能曲线。

`ui-chat/src/AiWorkChat.tsx` 在模型回复处于 `streaming` 状态时只更新保留换行的纯文本节点，避免每个流式帧重新解析整段 Markdown；回复进入完成、失败或中断状态后再由 `AiMarkdown.tsx` 格式化。该呈现沿用外观设置令牌，不含闪烁光标。

`ui-chat/src/AiWorkChat.tsx` 为用户消息复制原始提问、编辑并重新发送，为已完成助手消息复制完整 Markdown、提交正负向反馈或分支到新聊天。编辑活动中的回复时先经取消 API 请求停止，并通过临时 run 事件流等待终态；随后 `connection/src/api.ts` 请求认证的用户问题前缀分支，再把修订文本提交到新 Session。Session Controller 让会话 Owner 验证独立用户轮次、拒绝仍有活动运行的会话并从目标问题前推导边界。源消息与后续历史保留在原会话中。助手回答分支与 Workspace Worktree 分支仍按选中回答继承上下文；Workspace Controller 校验受管 Worktree 的账户、App、源项目和 Daemon 归属后创建绑定该项目的新 Session。符合在线节点能力条件时才展示新 Worktree 选项。历史工具操作不重放。按钮、编辑器、弹窗和错误态使用既有主题令牌；不增加设置或样式变量。

## AI Work Git 变更审阅

`ui-workspace/src/GitChangeSummary.tsx` 是当前项目真实 Git 状态的右栏入口；`GitChangeReview.tsx` 通过目标 Daemon 的 Git Owner 浏览单文件差异，通过认证 Workspace Controller 与 `project-files-v1` 分段读取或编辑已登记项目中的普通 UTF-8 文本。保存携带 SHA-256，遇到并发改写保留草稿并要求重新读取；差异加载按当前项目和文件丢弃过期响应。审阅器提供统一/并排、空白过滤、导入过滤、自动换行、Markdown 预览、完整文件、完整视图、补丁文本复制和手工 `git apply` 命令复制；命令只进入剪贴板，不会在产品中执行。界面沿用 Appearance 的代码字体/字号、主题、强调色、遮罩、模糊、差异标记和减少动态效果设置。

Agent Loop 只将 Daemon 成功返回的新建/修改/删除路径记录到助手活动中；`AiWorkChat` 展示路径并把点击交给 `ApplicationWorkspace`。`GitChangeActivityReview` 以当前已登记项目 Git 状态将项目相对路径匹配为仓库相对路径后复用 `GitChangeReview`。无 Git 差异、已提交/忽略文件或项目解绑时显示真实不可用原因。展示的是项目当前 Git 基线差异，源项目既有改动可能也在其中；活动记录不保存文件正文或原始工具输出。

## DSH 工作区扩展

`ui-workspace/src/sidebar-right-runtime.ts` 负责 DSH `sidebarRightTabs` 的登记、选择和展开；`ApplicationWorkspace.tsx` 渲染上游 tab 的 `guide` 图标入口，点击后通过同一 Runtime 激活并展开该 tab。`ui-layout/src/Workbench.tsx` 在存在右侧上下文栏的应用路由消费 `shell.overlay`，使浮动扩展留在 `.workbench-shell` 的 LFAA 外观继承树中。插件正文仍通过 `DshSlotOutlet` 渲染上游组件；共享主题、强调色、字体、字号、模糊、遮罩、对比度和减少动态效果由 LFAA Settings Owner 提供。

`ui-renderer` 注册通用 `conversation.input.right` DSH Client Slot；主聊天的 `ui-chat` 在模型选择器前消费该 Slot 并透传当前 Session ID。该接缝只在 Host 已装配并授权相应 Client 扩展后呈现内容。

`client/modules/src/client/session-scope.ts` 为 DSH Renderer 提供稳定的无 DSH Session 投影，因为 LFAA 不把自己的会话模型伪装成 DSH Session。当前根级 DSH Slots（包括 Wallpaper Engine Settings 和右侧栏）可正常渲染；显式 DSH Session target 与要求 `SessionProvider` 的扩展仍不可用。若后续正式装配 DSH `uiSession` Owner，该 Owner 保持唯一作用域来源。

`DshSlotOutlet` 透传上游 `renderSlot` 的 `fallback` 选项；Settings 与已登记的右侧扩展 tab 在 Client renderer 缺失或 Slot 没有内容时展示真实未就绪原因。可选 `shell.overlay` 不设 fallback，避免将正常的无浮层状态误报为插件故障。

## 工作区窄屏分栏

`ui-dockkit/src/ResizableWorkbench.tsx` 默认保持通用单侧布局；应用工作区通过 `responsiveRightDock` 启用窄屏右栏联动。`useWorkbenchMetrics` 的对应布局策略将中间工作区最小宽度设为 260px：空间足够时右栏参与网格并可拖动，较窄时左栏改用 Overlay、中间工作区与右栏继续并排；不足以同时保留中间工作区和右栏时，右栏转为可拖动宽度的 Overlay。Settings 不启用此策略，仍沿用既有断点与单侧导航行为。

## Markdown 知识库

`connection/src/api.ts` 提供账户知识库与已登记项目来源 API；`ui-settings/src/KnowledgeLibraryPanel.tsx` 在设置中心“插件”页管理知识、用户 Skills、提示词和领域专家 Markdown，可上传 `.md`/`.markdown`、编辑/删除，并把 Workspace/Minecraft 项目中的相对目录链接为实时来源。列表只请求短摘要；完整正文仅在用户打开编辑器时读取，上传与手工编辑限制为 64 KiB UTF-8。范围下拉明确区分单 App 和所有 App 共享；本地项目来源始终保持项目 App 隔离。界面不改变扩展、权限、MCP 或外观设置，由既有 `plugins.enabled`、`permissions.mode`、MCP App 范围及外观令牌控制运行行为。

## 游戏库入口

`/games` 组合运行环境、Minecraft 与 SteamCMD 三个入口，`/games/environments` 消费 RuntimeManager 认证接口。原 App ID、路由、会话和实例 Owner 保持原归属；窄容器以 Grid 换行，沿用主题与减少动态设置。环境读取串行、隐藏页暂停并在卸载时取消；操作任务持久化后以执行器回报为准。
