<a id="lfaa-ai-work-assistant-motion-20261026"></a>

# LFAA-AI-WORK-ASSISTANT-MOTION-20261026：流式回复复测与小鱼助手动效

## 用户问题与目标

用户要求复测 AI Work 流式回复是否存在问题，并将回复标识从通用“AI 助手”打磨成更明确的“小鱼助手”，配合图标和可动效果。目标是在等待/生成时让回复头部更有辨识度与生命感，同时保持正文、耗时和真实运行状态清楚可读。

## Owner、入口与设置

- 运行入口：Web 与 Desktop 共用 Client 的 `/work` AI Work 页面。
- 回复头部与过程时间线 Owner：`packages/client/ui-chat/src/AiWorkResponse.tsx`；对应样式归 `packages/client/ui-chat/src/ai-work-chat.css`。
- 当前状态与整轮耗时继续由 `activity-duration.ts`/`activity-clock.ts` 从真实 `AiMessage` 和活动记录计算；小鱼标识只呈现身份，不生成或持久化业务状态。
- 设置盘点：复用 Appearance 主题强调色、字体/字号；动效服从 Workbench 已映射的 `appearance.advanced.reducedMotion`（默认 `system`）及 `prefers-reduced-motion`。回复区域继续继承 `aiWorkOutputFocusBlurEnabled`、`aiWorkOutputFocusBlurIdleSeconds`、`aiWorkOutputFocusBlurPercent` 现有空闲显示规则。不添加或重置设置。
- 数据与权限：视觉改动不读写用户项目/会话以外的数据、不改变会话、Provider、工具、权限或授权行为。流式复测使用临时普通聊天会话，完成后归档；原会话保持不变。

## 允许范围与边界

- 在回复处理摘要与完成后的可展开记录中显示轻量鱼形 SVG 标识和“小鱼助手”名称，保留当前真实状态与耗时文案。
- 仅当回复真实处于处理中时播放短幅 `transform` 动画；等待用户、等待审批、完成、错误和停止状态静止。遵从账户与系统减少动态效果偏好；不新增视频解码、Canvas、定时器、动画帧订阅或外部资源请求。
- 先运行现有流式/响应时间线回归并在真实页面复测，记录观察到的缺陷和结果；若无可复现的新缺陷则不扩大修复范围。
- 只修改 AI Work 回复组件、其样式、直接相关长期回归、包 README、任务合同和索引。

## 可观察验收条件

1. 实时处理中可见“小鱼助手”、真实整轮耗时和当前回复正文；完成后过程摘要显示同一身份标识，最终答案与记录展开行为保持正确。
2. 鱼形图标在真实处理中有轻微循环运动，结束/等待/错误/停止后稳定静止；`appearance.advanced.reducedMotion` 设为 `on` 或系统偏好要求减少动态时不动，主题颜色/字体随现有共享令牌。
3. 直接回归覆盖运行与完成渲染、真实耗时/状态、减少动态样式约束，并复跑流式 delta 的边界合并、顺序、上限和取消清理测试。受影响 Client 类型检查与包/Web 构建成功，产物只在根 `dist/`。
4. ChatGPT 内置浏览器打开当前源码 `/work` 实页，至少检查桌面和一处手机或短屏尺寸；以真实流式交互观察处理中动效、正文与最终静止状态，检查换行/滚动和输入可达性，并记录截图证据。
5. 性能记录当前改动的活动动画数量与属性，区分自动化回归/构建、实页流式体验和帧时间；未做帧时间测量时明确说明。

## 实施记录

### 实现

- `AiWorkResponse.tsx` 在处理中摘要和完成后的可展开摘要统一显示“小鱼助手”身份与内嵌鱼形 SVG；不加载图片、循环视频或外部资源。仅真实处理中且未暂停时添加 `--processing` 状态类，等待和完成后移除。
- `ai-work-chat.css` 使用现有强调色绘制圆形标识，仅用两条 `transform` CSS 动画轻微游动和摆尾；无 JS 计时器、帧循环、观察器或新增订阅。`appearance.advanced.reducedMotion` 与系统减少动态效果分别关闭动画。字体、颜色继续跟随现有主题令牌，未新增/重置设置。
- 移除每秒刷新的耗时容器 `role="status"`，防止屏幕阅读器重复朗读秒数；“正在回复”等真实阶段状态仍保留可访问状态提示。
- 长期回归覆盖小鱼身份、真实运行态动画类、完成/等待时静止、耗时不进入秒级 live region，以及减少动态效果样式约束。

### 测试与实页验收

- 定向流式与时间线回归：`node --import tsx/esm --test apps/cli/tests/agent-runtime.test.mjs apps/cli/tests/ai-work-response-timeline.test.mjs apps/cli/tests/ai-work-activity-duration.test.mjs apps/cli/tests/client-performance.test.mjs`，57/57 通过；覆盖 Provider 增量自然边界合并、有界缓冲/切片、Unicode 代理项、顺序、切换消息与取消清理，以及回复时间线和时钟。
- `pnpm run typecheck` 通过；`pnpm --filter lfaa-client-ui-chat run build` 和 `pnpm run build:web` 通过；`git diff --check` 通过。Web 运行指纹为 `[]`，`/api/health` 返回 `status=ok`、`persistence=ready`。
- ChatGPT 内置浏览器实页：`http://127.0.0.1:3000/work`。以 DeepSeek-V4.1-Flash 1017（`deepseek-flash`）发送不调用工具的普通问题。约 1 秒时已显示自然语言正文开头；约 3 秒后完成，最终正文 224 输出 tokens、整轮用时 3 秒。真实流式期间鱼标识为 `ai-work-chat__assistant-mark--processing`，计算样式显示 `ai-work-chat-assistant-swim` 与 `ai-work-chat-assistant-tail`；完成后 DOM 类回到 `ai-work-chat__assistant-mark`，没有残留动效。该临时测试会话已归档。
- 同一路由桌面 `1312×1244` 与窄屏 `390×740` 实测。窄屏下正文可换行、输入框和发送操作可见可达，未见横向溢出；临时视口已重置，验收时收起的右侧工具栏也已恢复展开。另观察到既有工具任务的真实处理中正文在工具摘要前可见，且同一页面的鱼形标识处于处理动画类。
- 浏览器控制台 errors 为 0。调尺寸后曾短暂看到“控制端未连接”，整页重载后状态恢复为“控制端已连接”；期间健康接口正常，未复现，未改控制端代码。实页截图已在本轮内置浏览器验收输出中留存：生成中、完成态与窄屏。

### 性能与未测范围

- 动效在单条当前处理中回复上运行，属性仅为图标与鱼尾的 `transform`；结束立即移除动画状态，不存在无界数据或额外常驻工作。自动化回归、构建和浏览器交互已分别记录。
- 未进行浏览器帧时间/掉帧测量，也未在本轮实际切换用户减少动态设置；设置读取映射和系统偏好分支由直接回归与样式选择器覆盖。截图中的真实工具任务仍由原会话继续处理，本轮没有中断或修改它。

### 对话留白与记录展开修复（2026-10-26）

- 运行入口与 Owner 沿用本合同：Web 与 Desktop 共用 Client `/work`；消息列表布局由 `ai-work-chat.css` 持有，回复过程和完成摘要由 `AiWorkResponse.tsx` 持有。沿用 Appearance 的主题和字号；本布局不需要新增设置，也不改现有偏好。
- 内置浏览器复现表明 `.ai-work-chat__message-list` 的 `justify-content: flex-end` 会把短对话压到消息视口底部，顶部留下大块空白。展开长过程后内容溢出，flex 底部对齐失效，摘要位置随之跳动。试行的坐标补偿又在用户消息和回复之间制造约 440px 的额外留白，已撤销。
- 最小修复先将消息列表改为 `justify-content: flex-start`，让短对话从视口顶部向下排列。实页第二次复测发现，消息高度观察器仍会按“跟随最新消息”规则把滚动条推到底。现由 `AiWorkChat.tsx` 在用户展开摘要时暂时暂停这一跟随，记录当前跟随状态；全部完成摘要收起后恢复原状态。过程记录与最终正文仍按现有 DOM 顺序向下流动，不插入负担布局的坐标补偿、额外观察器、计时器或请求。
  - 定向回归断言消息列表顶部对齐，展开时暂停并在全部收起后恢复跟随；原有时间线回归继续验证完成记录位于最终正文之前。直接回归 55/55 通过，`pnpm run typecheck`、ui-chat/Web 构建和 `git diff --check` 通过；Web 指纹检查为 `[]`。
  - ChatGPT 内置浏览器实页：`http://127.0.0.1:3000/work`，视口 1280×720；现有双侧栏布局中的聊天列宽 616px，消息滚动区高 436px。折叠时消息列表从顶部向下排列；展开“小鱼助手”记录后，历史详情从摘要下方增长，`scrollTop` 为 0（展开前约 79px），未被自动推到末尾，正文继续排在过程记录之后。展开详情高度约 2068px，消息区可滚动；“回到底部查看最新回复”可将滚动位置移至 2106px 并到达回复末段。窄分栏实页未见横向溢出，截图已在本轮内置浏览器验收输出中留存。
  - 本轮未改变设置中心偏好、Provider、工具权限、项目文件或会话数据；只展开了当前已有回复并使用页面滚动控件验收。手机宽度未单独实测；浏览器控制接口未提供改变 viewport 的 API，本批实测了 616px 嵌入式聊天列与 436px 高消息视口。未进行浏览器帧时间测量。

### 无滚动空间时误显示“回到底部”（2026-10-26）

- 用户截图显示只有一条短错误回复、消息区没有可滚动内容，却出现“回到底部”。聊天滚动与提示仍由 `AiWorkChat.tsx`/`conversation-scroll.ts` 唯一负责；沿用 Appearance 设置和现有 64px 跟随阈值，不新增设置、订阅或持久化。
- 根因是 `wheel` 处理把 `deltaY` 直接加到离底距离。短消息区没有滚动空间时，向上滚轮仍被算成“向上滚动了 120px”，触发提示。新增纯函数 `projectConversationWheelScroll`，将预测 `scrollTop` 限定在 `[0, scrollHeight - clientHeight]`；若预测位置没有实际变化，则不更新跟随或按钮状态。
- `client-performance.test.mjs` 覆盖短内容、顶部向上、底部向下（都不可滚动）及可移动的向上/向下滚轮。定向回归 35/35 通过；Client 类型检查、ui-chat 能力包构建与 Web 构建通过，Web/Host 运行指纹为 `[]`，`/api/health` 返回 `ok` / `ready`。
- ChatGPT 内置浏览器实页：`http://127.0.0.1:3000/work`，视口 1312×1244。截图中的短 HTTP 400 回复无滚动条；重启后的版本在空白消息区向上滚轮，AX 树没有“回到底部”按钮。切换到已有长回复，点击“回到底部”后按钮消失，再向上滚动实际内容，按钮重新显示；随后恢复原短错误会话，按钮未显示。无新增布局规则、额外观察器/计时器或状态订阅；滚轮只多做少量数值运算。未进行浏览器帧时间测量或窄屏专测；本次只改滚动状态判定，没有调整断点和布局。
- 没有修改设置中心偏好、账户、会话消息、Provider 或工具权限。验收仅切换了已有会话并滚动页面。
- `pnpm run check:workspace` 未通过，仍有 3 条其他任务的历史文档引用错误：`left-preview-hover-flicker-20261025.md` 引用的两张 `dist/.tmp` 截图缺失，以及 `PROMPTS.md` 的 Compact 任务锚点缺失。本次没有改动这些任务材料或补造截图。
