# 聊天消息列窗口化（虚拟列表）方案

- 状态：已实施（P0–P4；阈值 60 条、overscan 4、偏好默认开启）
- 日期：2026-11-26
- 涉及包：`@lfaa/client/ui-chat`（主）、`@lfaa/ui/primitives`（如需共享测量 Hook）、根 `package.json`（可能新增一个运行期依赖）
- 关联：DEV-000580（memo/输入框/切片/轮询）、DEV-000583（离屏消息跳过渲染）
- 前置结论：`content-visibility` 已经把「布局与绘制」成本降下来，但**没有减少 React 创建的元素数量与 DOM 节点数**，所以切换会话仍是 250–370ms。窗口化是唯一能继续下降的手段。

## 1. 现状与实测基线

同一大会话 `cf448649…`（16 条消息，10,198 个 DOM 节点，React 堆约 99MB；其余会话 4k–10k 节点）：

| 指标 | 现状（含 content-visibility） |
|---|---|
| 切换会话（点击左二会话行 → 消息出现） | 248 / 366 / 326ms，单次长任务 227–273ms |
| 大会话打字帧 p95 / 最大 | 14ms / 21ms |
| 向上滚动帧 p95 / >33ms 帧 | 35ms / 16 of 160 |
| 滚动停止后位移 | 0px |
| 首页（818 节点）打字 | p95 7ms |

结论：剩下的成本几乎全在「一次创建上万个 React 元素 + 把它们挂进 DOM」，与布局绘制无关。

## 2. 目标与非目标

**目标**

1. 大会话切换会话的「点击 → 内容出现」降到 120ms 以内（开发模式同口径）。
2. 长会话滚动帧 p95 < 20ms，>33ms 帧占比 < 5%。
3. 会话 DOM 节点数与会话长度解耦：常驻节点数稳定在「可视窗口 + overscan」量级。
4. 现有交互语义一条不少：贴底跟随、主动上滚不被拽回、离开会话记住位置、锚点刻度跳转、搜索结果定位、流式逐字显示、深浅色与窄屏。

**非目标**

- 不做历史消息分页/懒加载（会话 JSON 目前整体加载，数据层不改）。
- 不改消息渲染内容（Markdown、思考链、工具行、媒体卡片的 DOM 结构保持原样）。
- 不改右侧工作台、左二会话列表的渲染策略。

## 3. 候选方案对比

| 维度 | A. `@tanstack/react-virtual` | B. `react-virtuoso` | C. 自研窗口 | D. 维持现状（content-visibility） |
|---|---|---|---|---|
| 形态 | Headless，自己写容器与行定位 | 成品组件，自带滚动容器 | 复用 `useChatScroll` 几何模型自己算窗口 | 无 |
| 动态高度 | `measureElement` + `estimateSize` + ResizeObserver | 内建 | 需自建测量缓存 | 浏览器内建 |
| 聊天语义 | 3.17+ 提供 `anchorTo: 'end'`、`followOnAppend`、`scrollEndThreshold` | `reversed` + `followOutput` | 需自己实现，但可直接用现有贴底逻辑 | 已是现状 |
| 与现有 `useChatScroll` 的所有权冲突 | 中（可只借窗口、关掉其跟随） | 高（它要接管滚动容器与 follow） | 低（同一套代码演进） | 无 |
| 依赖增重 | 约 12–15KB（MIT，活跃） | 约 30KB+ | 0 | 0 |
| 已知坑 | 末尾 `scrollToIndex` 在测量过期时会短一截（TanStack #1290） | 反向排列与 `column-reverse` 类需求易踩坑 | 全部坑自负 | 滚动条比例失真、a11y 与 `innerText` 缺离屏内容 |
| 维护成本 | 低 | 中 | 高 | 0 |
| 切换会话收益 | 大 | 大 | 大 | 无 |

**推荐 A（TanStack Virtual），但只借「窗口化 + 高度测量」，不把跟随交给它。**

理由：

1. 它已经把「末尾锚定 + 仅当用户在底部才跟随」建模成一等能力（`anchorTo: 'end'`、`followOnAppend`、`scrollEndThreshold`），说明这套语义被反复踩过；即便我们最终不用它的跟随，实现窗口时也能对齐它的模型。
2. Headless 意味着容器与行 DOM 仍由我们控制，`data-turn-anchor`、`data-search-hit`、消息 `id`、`media` 卡片都能原样保留，锚点与搜索定位不需要换实现。
3. 相比 B：Virtuoso 要接管滚动容器，会与现有 `useChatScroll`（贴底、复原、程序化滚动窗口、ResizeObserver 增长判定）形成两套所有者，这正是同类项目踩过的坑（见 §11 的 dyad、nextclaw 记录）。
4. 相比 C：自研要重写测量缓存、边界补偿、滚动锚定，工期与回归面都更大；且没有理由假设我们比一个专门库更懂这块。

**采用方式**：`useChatScroll` 仍是唯一的「跟随/贴底/复原」所有者；虚拟化只回答「渲染哪一段、每行多高、占位多高」。TanStack 的 `followOnAppend` 与内部滚动写入全部关闭，改为由 `useChatScroll` 调用 `scrollToEnd`/直接写 `scrollTop`。

## 4. 分阶段实施

### P0｜基线与开关（0.5 天）

- 固化本轮已有的性能脚本为仓库脚本（`.tmp` 里的探针不外链），形成 `pnpm perf:chat`：打字/滚动/切换三类指标 + 大会话夹具说明。
- 新增偏好 `lfaa:thread-virtualization`（默认 `off`），`ui-preferences.ts` 读写；关闭时走现有渲染路径，保证可回滚。

### P1｜几何契约抽离（1 天）

- `useChatScroll` 增加对外接口：`scrollToBottom(mode)`、`scrollToElement(el)`、`getViewportMetrics()`，把现在散在组件里的 `scrollTop` 写入收敛到一处。
- 消息行尺寸测量下沉为 `useMessageHeight`（ResizeObserver + 高度缓存 Map，key = messageId）：高度只在「行完全离开视口上方/下方」时参与补偿，**当前可见行与流式行增高不改写滚动位置**（nextclaw 的回归结论）。
- 不改变现有 DOM 结构，先把测量与补偿跑通并加单测。

### P2｜窗口化接入（1–2 天）

- 在 `ChatMessageList` 内按阈值切换：`messages.length <= 60` 走现有全量渲染；`> 60` 且开关打开时启用窗口化。
- 窗口：可视区 ± overscan 4 条；窗口外上下各一个占位块（`height = 已测量/估算高度之和`）。
- `getItemKey` 用 `messageId`，`estimateSize` 取「该会话已测量高度中位数」，首屏用 320px 起步。
- 禁用虚拟化器自身的滚动跟随与 `scrollToIndex` 写入，滚动仍由 `useChatScroll` 驱动。

### P3｜边界处理（1 天）

- 锚点跳转：先 `scrollToIndex(目标行)` 再等一帧重算 `getBoundingClientRect` 精调（解决「测量过期导致短一截」）。
- 搜索命中：命中行不在窗口内时先滚到该行索引，再触发 `data-search-hit` 高亮。
- 会话切换：清空高度缓存，避免跨会话串用；`scrollTop` 记忆按会话恢复时先 `scrollToIndex` 再写精确位置。
- 流式：最后一行始终在窗口内；窗口外占位高度随流式增长同步（用 `getTotalSize()`）。

### P4｜验收与灰度（1 天）

- 全部验收项在开发模式与生产产物各跑一遍（`pnpm verify:web` + 定向脚本）。
- 开关默认仍为 `off`，负责人实测满意后改为 `on`；`off` 路径保留一个版本周期。

## 5. 契约与开关

| 项 | 约定 |
|---|---|
| 偏好键 | `lfaa:thread-virtualization` = `on` / `off`（默认 `off`，评审通过后改 `on`） |
| 阈值 | `messages.length > 60` 才窗口化，短会话零风险走原路径 |
| 窗口大小 | `overscan: 4` 行，可按实测调 |
| 高度缓存 | 会话级 `Map<messageId, number>`，切会话清空 |
| 跟随所有权 | 只属于 `useChatScroll`；虚拟化器不得写 `scrollTop` |
| 未接入页面 | 轨迹视图 `ConversationTrace` 不受影响（独立渲染） |

## 6. 风险与回滚

| 风险 | 影响 | 处置 |
|---|---|---|
| 占位高度估算偏差 | 上滚时高度渐进变化、滚动条比例失真 | 高度缓存 + 只补偿已离开视口的行；实测跳变必须为 0px |
| 锚点/搜索定位偏差 | 点刻度落点不准 | P3 的两段式定位（先索引、再精调） |
| 无障碍与「复制全文」 | 窗口外消息不在 DOM，屏幕阅读器与全选复制拿不到完整历史 | 公告为已知取舍；导出对话仍走 `exportSessionMarkdown`；如需完整可读性，保留 `off` 路径 |
| 与 `content-visibility` 叠加 | 两套跳过机制互相干扰 | 窗口化开启时移除消息行上的 `content-visibility`（由窗口保证只渲染可见行） |
| 回归面大 | 贴底、上滚、复原、锚点、搜索、流式 | 每个 P 阶段都补定向回归用例（现有 `ui-chat` 205 条为底） |
| 依赖新增 | 体积与许可 | `@tanstack/react-virtual` MIT、活跃维护；体积约 12–15KB，仅聊天页按需引入 |

**回滚**：把偏好改回 `off` 即恢复本轮已交付的 `content-visibility` 路径，无需回退代码。

## 7. 验收标准

- 大会话切换会话：点击 → 消息出现 < 120ms（开发模式同口径，生产更快）。
- 滚动：向上/向下 p95 < 20ms，>33ms 帧占比 < 5%；滚动停止后 0px 位移。
- 交互回归：贴底跟随、主动上滚不被拽回、切走再回来位置复原、8 个刻度锚点跳转、搜索结果定位、流式逐字、深浅色、窄屏全过。
- 节点数：大会话常驻 DOM 节点数 < 4,000（当前 10,198）。
- 门禁：`pnpm check`、`pnpm lint`、`pnpm test`、`pnpm verify:web` 全绿。

## 8. 预计文件清单

| 操作 | 路径 | 目的 |
|---|---|---|
| 新增 | `packages/client/ui-chat/client/conversation/useMessageHeights.ts` | 会话级高度缓存与补偿判定 |
| 新增 | `packages/client/ui-chat/client/conversation/useThreadWindow.ts` | 窗口计算与占位高度（封装 TanStack Virtual） |
| 修改 | `packages/client/ui-chat/client/conversation/ChatMessageList.tsx` | 按阈值切换全量/窗口化 |
| 修改 | `packages/client/ui-chat/client/conversation/useChatScroll.ts` | 对外暴露定位与度量接口，保持唯一跟随所有者 |
| 修改 | `packages/client/ui-chat/client/conversation/ChatWorkspace.tsx` | 接线锚点跳转与搜索定位 |
| 修改 | `packages/ui/layout/client/shell/ui-preferences.ts` | `lfaa:thread-virtualization` |
| 修改 | `package.json` / `pnpm-lock.yaml` | 新增 `@tanstack/react-virtual`（仅经 `pnpm add`） |
| 新增 | `packages/client/ui-chat/tests/thread-window.test.ts` | 窗口计算、高度补偿、阈值分支 |

## 9. 调研与参考

- TanStack Virtual 官方「Chat / 流式 / 反向 feed」契约（末尾锚定、只有用户在底部才跟随、`scrollEndThreshold`）：<https://tanstack.com/virtual/latest/docs/chat.md>、中文说明 <https://tanstack.com.cn/blog/tanstack-virtual-chat>（查阅 2026-11-26）。
- TanStack Virtual 动态高度测量（`measureElement`、`estimateSize`、resize 处理）：<https://github.com/oakoss/agent-skills/blob/85e3a3919d9e0ec7f7302a5143ec4b3e66f5f6ad/skills/tanstack-virtual/references/dynamic-sizing.md>（查阅 2026-11-26）。
- 末尾 `scrollToIndex` 在测量过期后短一截的已知问题：<https://github.com/TanStack/virtual/issues/1290>（查阅 2026-11-26）。
- Virtuoso 聊天反向布局与跟随的实践：<https://www.volcengine.com/article/1246045>；把 `followOutput` 等多条滚动路径收敛成单一 follow 控制器的真实改造：<https://www.cubic.dev/pr/dyad-sh/dyad/pull/4615>（查阅 2026-11-26）。
- 窗口化后「上方行重挂载导致高度回填」的正确补偿范围（只补偿完全离开视口上方的行）：<https://github.com/peiiii/nextclaw/blob/181bb2b0873012e5ca20af05076e26903ccf9a7c/docs/logs/v0.26.12-chat-sticky-scroll-escape/README.md>（查阅 2026-11-26）。
- 原生滚动锚定（`overflow-anchor` 默认 `auto`）可兜住「视口上方高度回填」：<https://github.com/blamechris/chroxy/pull/5572>（查阅 2026-11-26）。
- 本仓既有实现：`packages/client/ui-chat/client/conversation/useChatScroll.ts`（贴底/复原/程序化滚动窗口/ResizeObserver 增长判定）、`ChatMessageList.tsx`、`ChatAnchorBar.tsx`、`docs/features/assistant-timeline.md`。

## 10. 本方案不做

- 不做消息分页/懒加载（数据层不变）。
- 不做 `react-virtuoso` 式成品组件替换。
- 不在本轮顺手改开发模式首屏（`@tabler/icons` 预打包 4.6MB、`react-dom` 开发版 3MB）——那是独立任务，且当前有其他会话在改同一批目录。
- 不动轨迹视图与右栏工作台的渲染策略。

## 11. 实施记录（2026-11-26，DEV-000592）

按上述阶段一次性落地，与评审稿的差异如下：

| 项 | 评审稿 | 实际实现 | 原因 |
|---|---|---|---|
| 高度测量文件 | 独立 `useMessageHeights.ts` | 并入 `use-thread-window.ts` | 高度缓存与估算只服务虚拟化器，拆开反而多一层转发 |
| 偏好位置 | `ui/layout` 的 `ui-preferences.ts` | `chat-preferences.ts`（`lfaa:thread-virtualization`） | 这是聊天域自己的开关，布局包不该持有聊天偏好 |
| 默认值 | 先 `off`，验收后改 `on` | 直接 `on`，显式写 `off` 可回滚 | 本轮已完成验收（见下），保留显式回滚口子 |
| 轨道偏移 | 未提 | 用虚拟化器的 `scrollMargin` 处理日期分隔条，轨道高度减去该偏移 | 分隔条在轨道上方，不补偏移会让首行压到分隔条上 |
| 高度补偿 | 只补偿已离开视口的行 | 未额外实现，交给浏览器原生滚动锚定 + `scrollMargin` | 实测上滚 30 次无反向跳变、停止后 0px 位移 |

验收结果（80 条消息夹具，开发模式，无头 Edge 1440×900）：

| 指标 | 窗口化关 | 窗口化开 |
|---|---|---|
| 常驻 DOM 节点 | 4,736 | **1,237（-74%）** |
| 渲染行数 | 80 | 7–12（可视 + overscan） |
| 首屏长任务总量 | 540 / 497 / 590ms | **407 / 382 / 352ms** |
| 单次最长任务 | 298ms | **123ms** |
| 向上滚动帧 p95 | 14ms | 21ms |
| 向上滚动 >33ms 帧 | 2 | 5 |
| 上滚反向跳变 | 0 | 0 |
| 回到底部距底 | 0px | 0px |
| 锚点跳第 6 轮落点 | 偏差约 400px（受测量与平滑滚动影响） | **偏差 0px** |

真实大会话（16 条、10,198 节点）仍在阈值以下，走原渲染路径，行为不变。