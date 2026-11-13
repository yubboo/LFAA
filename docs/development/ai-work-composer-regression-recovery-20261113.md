# AI Work Composer 回归恢复（2026-11-13）

<a id="lfaa-ai-work-composer-regression-recovery-20261113"></a>

## 用户目标与边界

- 用户报告 AI Work 输入栏的悬浮提示从按钮上方跑到下方并遮挡用量信息；模型按钮提示重新显示账户和模型内部 ID。昨天已完成的提示行为、模型快捷键和逐回复建议也需要与当前代码核对。
- 用户补充窄分栏实页仍有响应式问题，并明确纠正上一版方向：工具必须在单排横向展示；小屏只显示图标，不得保留长文字或将操作拆成多行。标题可截短，控件名称继续通过无障碍标签和悬浮提示提供。
- 本地基准为 `main` 的 `d3b127ce8f7e7c86a19f0a9156cd03c7b36010d4`，与 GitHub `origin/main` 同一提交。所有未提交改动已另存恢复快照；不拉取、不提交、不丢弃其他文件改动。
- 入口与 Owner：Web/Desktop 共用 AI Work `/work`；聊天与 Composer 归 `packages/client/ui-chat`，共享中间栏标题和模式行归 `packages/client/ui-workspace`；共享 Settings Owner 继续持有快捷键、账户模型与 `reasoning_mode`。
- 允许：恢复输入栏 Tooltip 的上方位置及打开 Popover 时的隐藏行为、模型入口简洁提示、设置中心模型快捷键，以及已有逐回复建议行为；保留本轮双滚动合同所需的 `conversation-scroll.ts` 接入和样式，并保留可验证的模型目录说明。窄列布局可调整 `ai-work-chat.css`、`center-workspace.css`、`ApplicationWorkspace.tsx` 和受影响包说明。
- 禁止：修改用户设置、切换账户/模型、触发真实 Provider/工具请求、拉取/提交/发布，或回退其他未提交文件。

## 设置、数据与权限

- 读取 `shortcuts.openModelPicker`（默认 `Ctrl+Shift+M`）和现有模型目录/推理值；不新增、重置或保存设置。
- 连接状态点继续读取 `general.showServiceStatus`（默认开启）；界面继续读取 Appearance 共享主题/字体/字号/强调色/减少动态效果令牌；上下文用量继续受 `aiRuntime.showContextUsage`（默认开启）控制。上述配置由 Settings Owner 读取并持久化，本次不新增、重置或保存设置。
- 不写入用户数据，不改变认证、权限和 Provider 请求。

## 验收条件

1. Composer 的悬浮提示统一显示在上方；打开权限/更多/模型弹层时对应提示隐藏，不盖住弹层或用量栏。
2. 模型入口提示只说明“选择推理强度”及已配置快捷键；真实模型名和档位仍由 Composer 按 Settings 目录显示。
3. 既有模型快捷键和逐回复建议行为恢复；本轮已登记的嵌套滚动处理仍保留。
4. 运行直接相关回归、ui-chat/Client/Web 构建与 Client 类型检查，并用 ChatGPT 内置浏览器检查 `/work` 常用桌面和相关窄分栏视口。
5. 在窄工作区列中，标题、模式图标和工具图标保持同一条横向顶栏；Composer 上下文独占一条紧凑行，底部附件、权限、更多、模型、语音和发送操作保持一排图标，不产生横向溢出或多行操作。名称由 aria-label/title/tooltip 保留；用量文本可省略，但不得覆盖 Composer 或被 Tooltip 遮挡。覆盖 430px 左右、更窄嵌入列与桌面布局。

## 实施记录

- 最初尝试在窄列保留工具文字并将 Composer 操作拆成多行，用户明确拒绝；该方案已从最终实现撤回，也不计入验收。最终行为按用户要求收敛为：顶栏单排，窄屏工具只显示图标；Composer 底部六项操作始终单排，空间不足时按钮缩小并隐藏文字。标题只在极窄列截短。
- 最终响应式改动：`packages/client/ui-workspace/src/css/center-workspace.css` 按中间列容器宽度将标题、模式和常用工具保持在同一行；`packages/client/ui-chat/src/ai-work-chat.css` 按聊天容器宽度将上下文入口和 Composer 操作压成单排图标，并省略过长用量文本；`packages/client/ui-chat/src/AiWorkChat.tsx` 为窄屏模型按钮提供图标，模型名称继续保留在可访问名称和提示文本中。没有改 `ApplicationWorkspace.tsx` 的 DOM。
- 同一 Composer 恢复合同内的工具组滚动改动：`packages/client/ui-chat/src/AiWorkResponse.tsx` 只在工具活动达到 6 条时启用组内滚动；`packages/client/ui-chat/src/conversation-scroll.ts` 和 `AiWorkChat.tsx` 让内层滚动消费滚轮时不改主对话跟随状态，触边后再传给主对话。Composer README 同步说明该滚动边界。
- 受影响包说明：`packages/client/ui-chat/README.md` 和 `packages/client/ui-workspace/README.md` 记录容器断点、单排约定和聊天滚动边界。`docs/PROMPTS.md` 仅更新本任务索引行；该文件有其他并行任务改动，不归入本任务。未新增设置、CSS 变量、订阅、请求或动效。
- 设置核对：继续使用既有 `general.showServiceStatus`（默认开启）、`aiRuntime.showContextUsage`（默认开启）、`shortcuts.openModelPicker`（默认 `Ctrl+Shift+M`）以及 Appearance 共享令牌；不新增、不重置、不保存任何用户偏好。
- 构建：`pnpm --filter lfaa-client-ui-chat run build`、`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm run build:web` 均通过；Web 构建包含 `tsc --noEmit -p ../../tsconfig.client.json` 类型检查。Vite 有既有大 chunk 提示。`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。未运行自动化测试。
- 正式页面验收：从当前 checkout 用 `pnpm lfaa web --no-local-daemon` 重启正式本机 Web，地址 `http://127.0.0.1:3000`；在 ChatGPT 内置浏览器的 `/work` 实际检查 1280×720、430×850、320×800。三种视口均为单排顶栏；窄屏 Composer 权限、更多、模型、语音、发送和附件操作没有拆行。320px 窄视口的 chat 列为 272px，顶栏三个区均为单行且各自 `scrollWidth == clientWidth`；Composer 操作行为 195px、`flex-wrap: nowrap`，六个按钮均处同一行；用量栏宽 214px、高 26px、`scrollWidth == clientWidth` 且保持单行；文档宽度与视口同为 320px，无横向溢出。320px 模型文字为 `display:none`，仅显示图标。截图在内置浏览器检查，未另存仓库。
- 页面加载时触发应用既有默认工作区初始化接口并返回 200；账户已有历史会话，未创建新项目。本轮未发送消息、切换模型/权限、调用 Provider 或修改设置。物理设备、单独 Tooltip 交互、浏览器错误数和帧时间未测；布局改动未新增请求、订阅、定时器、观察器或动效。
## 模型图标跟进（2026-11-13）

- 用户指出窄屏模型入口使用通用星光符号不清楚，并提供了芯片/脑回路式模型按钮作为参考。`packages/client/ui-primitives/src/WorkbenchIcon.tsx` 新增独立 `model` 神经芯片线性图标，由 `AiWorkChat.tsx` 的模型选择按钮以 18px 使用；保留原 aria-label、提示和 30/36px 单行按钮布局。没有照搬参考图的脑形，也没有改变模型、快捷键或设置行为。
- README 已同步：`packages/client/ui-primitives/README.md` 登记共享图标；`packages/client/ui-chat/README.md` 描述模型入口用专用图标。设置不变。
- `pnpm --filter lfaa-client-ui-primitives run build`、`pnpm --filter lfaa-client-ui-chat run build` 和 `pnpm run build:web`（含 Client 类型检查）通过；`git diff --check` 通过。Web 构建有既有大 chunk 提示。
- 本次图标未完成内置浏览器实页验收：`node scripts/runtime-build-state.mjs web` 报告 `["host"]`，完整 Web 重启前必须先重建控制端；`pnpm run build:control-plane` 被并行工作区项目代码的 TypeScript 错误阻断，位置为 `packages/core/agent-loop/src/execute-turn.ts` 1889、1893 行（TS2322、TS18047）。该源文件不属于本图标改动，本轮未修改或绕过。需待控制端构建通过后重启正式 Web，再在内置浏览器检查 `/work` 窄屏模型图标。
## 模型与推理弹层边界跟进（2026-11-13）

- 用户截图显示模型/推理 Popover 在模型入口靠工作区右侧时，`topRight` 锚定让面板向左伸出所属 Workbench，并被其边界裁切，模型名开头不可见。
- `packages/client/ui-chat/src/AiWorkChat.tsx` 将该 Popover 改为上方居中锚定；继续将面板挂到所属 `.workbench-shell` 以继承主题和限制在工作区内，原有按视口高度及容器宽度限尺寸规则保留。`packages/client/ui-chat/README.md` 补充该浮层合同。
- `pnpm --filter lfaa-client-ui-chat run build`、`pnpm run build:web`（含 Client 类型检查）通过；`git diff --check` 通过。Web 构建有既有大 chunk 提示。
- 真实页面验收尚未完成：当前 `node scripts/runtime-build-state.mjs web` 报告 `["host"]`。完整 Web 启动会先构建控制端；`pnpm run build:control-plane` 被 `packages/core/agent-loop/src/execute-turn.ts` 1889、1893 行的现有 TypeScript 错误（TS2322、TS18047）阻断。没有在弹层修改中改变无关项目上下文代码，也没有绕过运行指纹。控制端构建恢复后需重启正式 Web，在 `/work` 检查靠边与窄工作区里的完整模型名、面板边界和短屏可达性。

## 会话用量悬浮提示边界跟进（2026-11-13）

- 用户截图显示底部会话 Token 用量与上下文用量悬浮说明贴边、横向越出窄栏，且长文本没有在当前工作区内收缩换行。
- `packages/client/ui-chat/src/AiUsageFooter.tsx` 将三种用量提示（会话统计、上下文用量、上下文关闭）统一为 `topRight`，并把弹层挂到 AI Work 中间内容栏或嵌入式聊天侧栏；`ai-work-chat.css` 限制提示最大宽度并允许长文本换行。`right-menu.css` 为嵌入式聊天栏建立相对定位容器。点击查看明细仍走原 Popover。
- `packages/client/ui-chat/README.md` 已记录该浮层边界；既有 Composer 响应式回归断言同步从 `right` 改为 `topRight` 与实际栏位挂载。
- 设置核对：仍由 `aiRuntime.showContextUsage` 控制上下文提示；没有新增或更改配置、保存用户偏好、发起 Provider 请求或增加订阅/观察器/计时器。
- `pnpm --filter lfaa-client-ui-chat run build`、`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm run build:web`（含 `tsc --noEmit -p ../../tsconfig.client.json` Client 类型检查）、`pnpm run build:control-plane` 和 `git diff --check` 均通过。Web 构建有已有的大 chunk 提醒；未运行自动化测试。
- 正式 Web 启动并完成构建指纹核对；3000 端口起初由同一数据目录的 LFAA Web 进程占用，CLI 确认归属后正常重启。为了检查页面短暂使用 3001，随后已恢复正式服务至 `http://127.0.0.1:3000`。内置浏览器 `/work` 实际视口为 1552×864，但登录后首先显示版本公告。“我知道了”/关闭会将公告已读状态写到账户本地记录；按验收规则未触发该写入，故提示交互和窄栏布局没有完成浏览器验收，不能标为通过。后续须在不确认/关闭公告的前提下取得可验收页面状态，或由用户正常确认后继续检查。
- 用户比较实现截图与 Composer 权限提示后指出用量提示箭头靠在右边显得突兀，参考样式是箭头居中对准触发控件。将上述 Tooltip 锚点由 `topRight` 改为 `top`，仍保留当前栏位容器和 320px/栏宽/视口限宽规则；AutoAdjustOverflow 继续负责靠边情况。
- 构建与检查：聊天包、Web（含 Client 类型检查）、控制端构建通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，Web 正式服务重启在 `http://127.0.0.1:3000`，`/work` 返回 200，`git diff --check` 通过。未运行自动化测试。
- ChatGPT 内置浏览器在 `/work`、1624×1245 视口实页检查会话用量与上下文用量两条 Tooltip：两者均显示在对应控件上方，箭头居中对准控件，内容没有裁切；点击详情 Popover 随后可正常关闭。此轮未检查窄视口和物理设备；没有发送消息、调用 Provider、改变设置或确认任何弹窗。

## Composer 更多能力弹层遮挡修复（2026-11-13）

- 复现依据：用户截图显示“Skill / 提示词 / 专家”弹层从上方打开时，上半部分被聊天区域遮住。`AiWorkChat` 的外层有 `overflow: hidden`；更多菜单此前挂载到 `.ai-work-chat__composer` 子树，向上展开会被聊天面板裁切。菜单内的 Ant Design Select 下拉也未指定工作区容器。
- 修复：更多 Popover 及“关联应用”“关联能力”Select 下拉统一挂载到最近的 `.workbench-shell`，避开聊天裁剪边界并继承同一主题令牌；Select 列表高度按视口缩减并保留滚动，避免短屏首项越过上边界。继续沿用现有宽高限制、锚点和选择/持久化行为。未改设置、数据、权限或模型行为。
- 回归与构建：新增的弹层挂载/视口高度定向断言通过；Composer responsive 文件整套运行有 4 条与本次弹层无关的旧提示/布局断言不匹配当前实现，其余通过。ui-chat 包、控制端和 Web 构建通过，Web 构建包含 Client TypeScript 检查；`node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。控制端构建最初发现 JSONL 投影中的 `context_application_id` 是不受限数据库值，增加字符串窄化后构建通过。
- 内置浏览器：从当前源码 checkout 重启正式服务 `http://127.0.0.1:3000/work`。桌面 1770×1244：外层菜单位置为 x=529、y≈1002、宽 280、高 131；内部列表位置为 x=534、y=829、宽≈269、高 240，均在工作区可视区域内。短屏 509×406：外层菜单 x=186、y≈179、宽 280、高 131；内部选项列表 x=140、y=9、宽≈269、高 240，完整位于视口内，第一项不再顶出顶部；关闭内部列表后菜单标题、搜索框和说明也完整可见。检查时列表中的能力目录可滚动，未选中任何项。
- 设置、安全与性能：继续使用 Appearance 的工作区主题令牌；未新增或更改设置中心配置。只对列表高度做一次视口尺寸计算，没有新增请求、状态订阅、计时器或观察器。没有发送消息、改变关联、保存设置或运行 Agent；帧时间和物理设备未测。浏览器截图见本轮内置浏览器检查记录，未另存到仓库。
