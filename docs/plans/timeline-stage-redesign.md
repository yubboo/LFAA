# 对话流式时间线重排：思考 / 正文 / 工具总菜单分离与阶段合并

> 状态：待负责人评审确认
> 范围：`packages/client/ui-chat`（纯前端展示层改造，不改动 Host/SSE/持久化契约）

## 1. 目标与核心改动

针对当前 `AssistantTimeline` 在多轮工具调用与流式输出时出现的 5 个体验问题进行收敛重构：

1. **顶部过程汇总行精简并突出耗时与 Token**
   - 去掉顶部汇总行前半段冗长的工具统计串（如 `7 条命令、7 项读取、30 个文件改动 等`）；
   - 将 `用时 X 分 X 秒`、`XXXk tokens` 与展开/收起箭头作为视觉主体突出展示（深浅双主题均使用 `@lfaa/ui-theme` 语义变量保证清晰层次）。
2. **一轮结构解耦并按真实执行顺序排布**
   - 彻底拆开原本揉在同一个 `ThinkingBlock` 里的「思维链」与「工具链」；
   - 每一阶段严格按真实因果顺序排布：
     1. **思维链折叠块**（只包思维链正文，标题只表达思考态，如 `正在思考…` / `已思考 17 秒`）
     2. **本轮正文**（明文常驻，不受折叠影响，告诉用户这一阶段要做什么）
     3. **工具总菜单**（独立折叠入口，点开后完整平铺原有工具/文件/命令/技能明细行，100% 保留现有 `FileActivityRow` / `ToolStepRow` 样式与交互）
3. **工具总菜单包裹明细行**
   - 收起态为简洁单行动作概括（如 `分析了 5 个文件、加载了技能 >`、`更新了任务清单、编辑了 6 个文件 >`，若有失败项显式标出 `· N 项失败`）；
   - 展开态以左侧柔和细竖线包裹本阶段所有工具明细行。
4. **合并连续无正文间隔的碎包裹点**
   - 以「模型输出新的可见正文」作为自然阶段分界；
   - 两段正文之间连续发起的多次 LLM 工具往返，自动合并进同一个阶段：工具按时间顺序合进同一个工具总菜单，同阶段连续思考正文按顺序合进同一个思维链块，消除多个碎折叠条堆叠。
5. **上下外边距与阅读节奏**
   - 同一阶段内部（思维链 ↔ 正文 ↔ 工具总菜单）留出舒适呼吸间距（约 `0.6rem`）；
   - 不同阶段之间（上一阶段结束 ↔ 下一阶段开始）拉开明显梯度（约 `1.25rem`），让肉眼自然区分每一轮边界。

## 2. 调研与参考

- **检索关键词**：`Vercel AI Elements reasoning tool call collapsible streaming UI`、`assistant-ui ToolGroup GroupedParts`、`Claude Cursor thinking chain tool call group collapsible timeline UX`
- **本仓库现有实现**（2026-11-27 查阅）：
  - `packages/client/ui-chat/client/conversation/AssistantTimeline.tsx`：`text = isStreaming ? content : (progressText ?? "")`，每轮工具记录的 `textOffset` 天然位于该轮思考之后、正文之后、工具之前，因此拆分为「思维链 → 本轮正文 → 工具总菜单」无需改动后端协议。
  - `packages/client/ui-chat/client/conversation/Thinking-Block.tsx` 与 `StepTraceList.tsx`：已有 `ScrollArea` 限高流式贴底、统一单一定时器与双主题语义令牌，可直接复用。
- **外部参考方案**：
  1. **Vercel AI Elements (`Reasoning` & `Tool` primitives)**（https://ai-sdk.dev/elements，2026-11-27 查阅）：采用「流式自动展开 + 完成后自动收起成单行摘要」的渐进披露模式，并将思考块与工具调用拆为独立原语，保证正文始终处于视觉中心。
  2. **assistant-ui (`GroupedParts` & `ToolGroup`)**（https://www.assistant-ui.com/docs/ui/ToolGroup，2026-11-27 查阅）：将连续无正文间隔的工具调用自动聚合成单一可折叠 `ToolGroup` 行，展开后按时间顺序平铺单步明细，解决多步工具调用造成的垂直碎片化。
- **适配结论（改造适配）**：
  - 不引入第三方 UI 依赖（避免与 `@lfaa/ui-primitives`、`@lfaa/ui-theme` 和 CSS Modules 冲突）；
  - 吸收上述两个方案的核心模式（独立思维链块 + 连续工具聚合为单一折叠菜单 + 流式展开/完成自动收起），直接在现有 `ui-chat` 对话组件体系上改造实现，完整保留现有的文件彩标、行号、耗时与右栏联动能力。

## 3. 关键交互与流式状态机

| 区域 | 流式进行中 | 本阶段完成 / 回复完成后 | 用户手动点击 |
| --- | --- | --- | --- |
| 顶部汇总行（`用时 · tokens`） | 显示实时 `用时 X 秒`（呼吸态）+ 箭头 | 突出显示 `用时 X 分 X 秒` + `XXXk tokens` + 箭头 | 一键隐藏/显示整条回复的所有过程块（正文始终保留） |
| 思维链块（`ThinkingBlock`） | 正在思考时自动展开（限高滚动跟随底部） | 本轮进入正文/工具或回复结束后自动收起成一行（如 `已思考 17 秒 >`） | 随时展开/收起，尊重用户手动切换 |
| 本轮正文（`MarkdownContent`） | 随流式增量实时渲染在思维链下方 | 始终明文可见 | 不折叠 |
| 工具总菜单（`ToolGroupFold`） | 本阶段有工具运行/准备时自动展开看实时明细 | 本阶段工具全部完成进入下一阶段或回复结束后自动收起成一行 | 随时展开/收起，展开平铺全部明细行 |

- **顶部汇总行默认开关**：流式与完成后均默认展示各阶段收起后的简洁单行（`processOpen = true`，仅子智能体工作舞台 `defaultCollapsed` 默认隐藏），用户点击顶部 `用时 · tokens v` 可一键收起全部过程行只留纯正文。
- **流式零跳动保障**：
  - 当第 1 轮正在输出正文、尚未触发工具调用时，正文落在尾部流式区（位于第 1 轮思维链正下方）；
  - 工具一启动，`round.offset` 推进到当前正文长度，正文无缝留在思维链下方、新出现的工具总菜单上方，位置不跳动、内容不重复、不丢失。

## 4. 变更文件清单（严格小文件边界）

- `packages/client/ui-chat/client/conversation/StepTraceList.tsx` & `StepTraceList.module.css`：精简顶部汇总行，去掉长工具统计串，突出用时与 Token；调整阶段内/阶段间上下外边距。
- `packages/client/ui-chat/client/conversation/Thinking-Block.tsx` & `Thinking-Block.module.css`：纯化为只管思维链的折叠块，支持 `autoCollapse`（思考完自动收起）与手动切换记忆。
- `packages/client/ui-chat/client/conversation/Tool-Group-Fold.tsx` & `Tool-Group-Fold.module.css`（新增）：独立工具总菜单组件（收起单行概括 + 展开左侧竖线包裹 `RoundToolChain`），流式跑工具时展开、完成后自动收起。
- `packages/client/ui-chat/client/conversation/round-title.ts`：新增工具总菜单概括函数 `summarizeToolGroupMenu`（按本阶段动作生成简洁概括文案与语义图标，显式标注失败计数）。
- `packages/client/ui-chat/client/conversation/AssistantTimeline.tsx`：新增 `buildTimelineStages` 合并无正文间隔的连续轮次，按「思维链 → 正文 → 工具总菜单」三段顺序渲染。
- `packages/client/ui-chat/tests/timeline-streaming.test.tsx` & `packages/client/ui-chat/tests/thinking-block-scroll.test.tsx`：同步更新与补充阶段合并、三段顺序、自动展开/收起及顶部汇总行回归测试。
- `docs/features/assistant-timeline.md`：同步更新设计说明。

## 5. 验收与回滚

- **单测与门禁**：执行 `ui-chat` 针对性单测、`pnpm check`、`pnpm check:arch` 与 `pnpm verify:web`。
- **实测与双主题视觉核验**：在内置浏览器中打开本地 `http://127.0.0.1:5173/`，覆盖深色与浅色主题、流式输出过程与历史长会话回看、点击展开/收起思维链、工具总菜单与顶部汇总行，并使用 `pnpm ui:shot` 截图自查上下间距与对齐。
- **回滚策略**：本次仅修改 `packages/client/ui-chat` 前端渲染层与文档，不涉及数据库、会话格式或后端接口，随时可单提交无损回退。
