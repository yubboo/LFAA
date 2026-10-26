<a id="lfaa-ai-work-stream-naturalness-20261026"></a>

# LFAA-AI-WORK-STREAM-NATURALNESS-20261026：让流式回复更自然

## 用户问题与目标

用户反馈 AI Work 的流式回复同时存在显示节奏和回复措辞生硬的问题，实页截图进一步显示长任务正文只有内部阶段/工具记录。目标是让真实 Provider 文本按自然短语/词边界成批呈现，长任务在正文中自然说明开工事项并随着实质进展更新，内部状态作为辅助记录；最终回复避免固定套话与不必要结构。文本不得合成、改写、丢失或乱序，最终持久化正文与 Provider 原文保持一致。

## Owner、入口与设置

- 运行入口：Web 与 Desktop 共用 Client 的 `/work` AI Work 页面。
- 流式展示 Owner：`packages/client/connection/src/stream-deltas.ts` 合并真实 SSE delta；`packages/client/ui-chat/src/AiWorkResponse.tsx` 与 `AiMarkdown.tsx` 展示分段正文。
- 回复风格 Owner：`packages/core/system-prompt/src/index.ts` 组合核心对话指引；不改 Provider、模型或领域能力。
- 设置盘点：沿用账户 Appearance 的主题、强调色、字体/字号、透明度与模糊共享映射。`appearance.advanced.reducedMotion` 默认 `system`，由 Settings Owner 持久化并由 Workbench 映射；本任务不新增 CSS 动画。`aiWorkOutputFocusBlurEnabled`、`aiWorkOutputFocusBlurIdleSeconds`、`aiWorkOutputFocusBlurPercent` 只控制空闲回复虚化，与正在接收的文字节奏无关。所有用户值保持原样。
- 数据与权限：文本继续由已选 Provider 生成并经原 Agent Loop/SSE/Session/Permission Owner 处理。本任务不扩展工具、授权、权限、账户或数据范围，不发起写操作。

## 允许范围与边界

- 调整同一消息的客户端 delta 合并策略，使标点、空白等自然边界优先成批显示，并给无边界输出设置 72ms 最大等待与 2048 UTF-16 字符上限；非正文事件、完成和错误及时冲刷尾段，取消/卸载撤销调度并清理失效订阅内容。
- 调整系统提示词中长任务阶段说明和最终答复的风格指引，避免固定开场、重复进度播报和不必要标题/列表；保持技术准确、事实依据、用户语言和关键不确定性。
- 运行中省略已经完成的内部模型阶段行，只显示助手正文、一个当前状态和可展开的真实工具活动；完成后仍可查看完整过程记录。
- 只改直接相关的长期回归及 `packages/client/connection`、`packages/core/system-prompt`、`packages/client/ui-chat` README 和本合同/索引。
- 不引入模拟打字、虚构进度/内容、隐藏长延迟、第二套状态或新设置；不改 Provider 参数、模型选择、流协议、最终正文、权限模式、会话数据和现有偏好。

## 可观察验收条件

1. 小片段按标点/词边界合并，持续无边界文本在短时间或达到有界字符数后继续显示；输出顺序与字符内容完整，完成/错误/取消时无残留计时器或未交付尾段。
2. 多步/长时间任务开始操作前有具体简短的用户可见说明，每有实质进展后自然更新发现与下一步；不生成空话、重复播报、内部阶段标签或隐藏推理。运行中只呈现助手正文与一个当前状态，已完成的内部模型阶段收进完成后的可展开记录；保留真实状态、错误、权限和未确认事实。
3. 运行直接相关的 delta 调度与系统提示词回归、受影响包构建、Client 类型检查、Control Plane/Web 构建及 `git diff --check`，产物只写入仓库根 `dist/`。
4. 内置浏览器检查当前源码 `/work` 的真实页面/流式交互并记录视口、交互与截图；真实 Provider 样本覆盖长任务的开工说明、实质进展更新及工具记录呈现；不得把构建或静态页面检查写成流式体验通过。
5. 报告性能依据与边界：展示调度增加的最大缓冲时间/队列上限，确认高频消息仍按帧或语义边界合并、无重复订阅/无界内存增长，帧时间未实测则照实列出。

## 实施记录

### 第一批实施记录（自然度范围未通过用户实页反馈，待补修）

- `createStreamDeltas` 在空格或中英文标点后安排下一帧交付；无边界输出由 72ms 定时器兜底，达到 2048 个 UTF-16 字符立即冲刷。消息/分段切换与协议非正文事件先交付旧尾段，取消卸载撤销计时器/帧并丢弃已失效订阅尾段。Provider 原文、字段、顺序与 Session 记录不变。
- 系统提示词将阶段播报改为有帮助时再自然简短说明，并要求避免重复状态和固定开场/收尾；简单回答优先自然段，结构化内容按可读性决定，同时保留真实状态、证据、权限和不确定性。
- 设置中心：无新增、无修改；继续沿用 Appearance 主题/颜色/字体/字号/对比度/壁纸/透明度/模糊映射。`reducedMotion` 未被改写，且本批未新增动画。
- 直接回归：首次合并运行 40 项中 39 项通过；唯一失败是 `apps/cli/tests/client-performance.test.mjs` 第 231 行既有静态断言仍查找旧表达式 `pauseLabel ?? summary.label`，与本次 Connection/系统提示词改动无关。随后直接相关流式测试 4/4、`agent-runtime.test.mjs` 6/6、系统提示词缓存前缀与小鱼人格回归 7/7 通过。
- 构建与检查：`lfaa-client-connection`、`lfaa-system-prompt`、Client/Host `pnpm run typecheck`、Control Plane 与 Web 构建均通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。Web 构建仅报告既有约 501 kB `cpp` chunk 提示。
- 工作区合同检查：`pnpm run check:workspace` 仍因其他记录缺失 3 个链接失败：`left-preview-hover-flicker-20261025.md` 指向的两张临时截图，以及 `PROMPTS.md` 中旧的 `#lfaa-compact-application-center-anchor-20261025` 锚点；本合同锚点已修复并通过该项检查。
- 实页验收：最新 Web 构建重启后，`http://127.0.0.1:3000/api/health` 返回 200，内置浏览器实际路由为 `http://127.0.0.1:3000/work`。截图为 769×1312 像素窄竖屏；聊天列与工具侧栏并列时回复可折行、无可见横向溢出。两次真实 `deepseek-flash` 交互均按请求自然收尾、未出现固定开场或不必要列表；第一次生成期间观察到未完成文本按流更新，约 3 秒后完整结束，第二次在最新 Web 构建上约 1 秒完成。两条临时验收会话已归档，原会话视图已恢复。桌面宽屏、短屏与真实帧时间未测；截图随内置浏览器验收工具回传，未另存为仓库文件。
- 性能依据与边界：最大调度等待 72ms，待交付缓冲上限 2048 UTF-16 字符，边界到达后下一帧交付；取消与卸载测试确认 RAF/计时器清理和失效尾段丢弃。未测真实帧时间；单次 Provider 实页样本只能验证一次措辞/节奏，不代表所有模型与网络条件。

### 用户反馈后的补修批次

- 用户实页截图显示长工具任务的回复区只有重复模型阶段和工具摘要，没有持续的自然语言正文；此前单轮快速文本回答的验收不足以覆盖该情形。
- 根因包含系统指引过度限制阶段正文，以及运行时展开重复的已完成状态阶段。现将长任务的开工说明/实质进展更新写入核心 Prompt，并在流式期间省略已完成的内部状态阶段；当前活动与正文由页面显示，完整阶段历史在完成后仍可展开。
- 直接回归：`agent-runtime.test.mjs`、`ai-work-response-timeline.test.mjs`、`client-performance.test.mjs` 合计 48/48 通过。修正了与当前 `getAiActivityActionLabel` 实现不一致的过时静态断言，并让跨段流式用例包含真实中文标点边界。
- 构建与检查：Client/Host `pnpm run typecheck`、`lfaa-system-prompt`、`lfaa-client-ui-chat` 包构建、Control Plane、Web 构建通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`；Web health 返回 HTTP 200。构建产物仅写入根 `dist/`。工作区链接检查仍报告此前记录的 3 个旧文档引用缺失，见第一批记录。
- 实页验收：ChatGPT 内置浏览器路由 `http://127.0.0.1:3000/work`。桌面 1312×1244 下运行真实 DeepSeek Flash Provider，对公共示例页做只读两步对比：正文先显示核查计划，核实第一项后再显示事实和下一步，最后交付结果；重复的模型阶段不再铺满回复区，真实工具组仍可展开。390×740 窄屏和 390×420 短屏下，正文折行、聊天区纵向滚动、输入框仍可达，无可见横向溢出。临时验收会话已归档，原 Minecraft 会话和宽屏工作区布局已恢复。截图由内置浏览器工具回传，未另存为仓库文件。
- 设置中心：未新增或修改设置；Appearance 共享令牌与 `appearance.advanced.reducedMotion` 均保持原值。流式缓冲参数不变：最多等待 72ms、待处理文本上限 2048 UTF-16 字符；未增加订阅或运行时计时器。真实帧时间未测。
- 状态：已按用户指出的问题补修并通过真实 Provider 多步实页验收；其他 Provider、网络延迟和更长 Daemon 执行仍需更多样本确认更新质量。
