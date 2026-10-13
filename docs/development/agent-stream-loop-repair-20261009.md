# AI Work 流式显示与 Agent 重复失败修复合同

## 目标、运行入口与 Owner

- Web 产品入口为 `apps/web` → AI Work；流式正文由 Provider/`packages/llm/llm` 产生，Agent Run/预算/工具派发由 `packages/core/agent-loop` 管理，SSE 由 `packages/api/session-controller` 订阅，客户端消费由 `packages/client/connection` 与 `packages/client/ui-chat` 持有。
- 修复截图中已删除的末尾闪烁光标仍存在于 `dist/apps/web` 的旧 Web 产物；重新构建实际 Web 入口并核验其 CSS。
- Agent 在同一运行中收到已派发工具的确定失败或结果未知后，若模型请求完全相同的工具和有效参数，不得再次派发；明确写入未派发结果并停止该轮，避免模型反复执行不确定操作。
- 修正前次全量验证暴露的迁移测试夹具、App 范围期望和 Wallpaper Engine 测试来源文件清单，使长期回归符合当前迁移与应用合同。

## 现状证据

- `packages/client/ui-chat/src/ai-work-chat.css` 已不含流式光标规则；当时 `dist/apps/web/assets/ai-work-chat-CYCUQcJz.css` 仍含 `:after` 光标规则，且 Web 资产时间早于当前源码改动。上次只构建 UI 包，没有重建 Web 应用。
- 对应的 2026-10-09 会话为 19 次模型请求、38 次工具调用，完成 280 项测试中的 274 项、5 项失败、1 项跳过后继续定位失败；最终状态为用户中断，最后一个已派发读取结果标记为 `unconfirmed`。未观察到完全相同且失败的工具调用被重复派发，不能将该次有限的调查称为无限循环。
- 该会话中 `maxModelRequests=0`、`maxToolCalls=0` 的语义是不限量；本任务不更改账户预算或其设置默认值。Provider 发出隐藏推理而没有可展示文本时，“正在思考”是当前协议状态；以 SSE 回归确认可展示 delta 到达即更新正文。
- 前次全量测试的 5 项失败可在单文件串行复现：Vanilla 迁移测试把当前数据库版本降到 34 却保留高版本项目表；两个旧测试漏列当前 `connectivity` App；插件安装夹具缺少当前官方来源合同要求的 `lib/routes/scene-serve.js`。

## 设置、数据与权限

- 沿用 Appearance 的 `accentColor` 与减少动态效果/主题令牌，删除的光标不由设置重新启用；本任务不新增外观设置。
- Agent 沿用 `permissions.mode`、`aiRuntime.requestTimeoutSeconds`、`aiRuntime.maxModelRequests`、`aiRuntime.maxToolCalls` 和既有 Provider/模型；不重置用户值、不新增第二权限门、不放宽工具参数、节点、身份或授权检查。
- 防重仅作用于当前 Agent Run 已记录的失败或结果未知工具签名；状态查询等不同工具仍可继续，未知副作用不得盲目重放。
- 仅修改与本目标直接相关的 Agent Loop、Web 样式/产物构建、长期回归和本合同。保留现有工作树内容；不重启 Web、Daemon、Provider 或其他运行服务，不改真实项目数据，不提交或发布。

## 验收

- 新增 Agent 回归：模型在同一 Run 内重复请求失败/结果未知的同一工具与有效参数时，工具执行器只被派发一次，Session 保存第二次拒绝原因，助手以清楚的错误终态结束；不同参数或状态查询仍按现有目录和权限流程执行。
- Agent/SSE 回归验证 Provider 可展示 delta 在当前页面实时到达、最终 Session 正文一致；隐藏推理不作为可见正文。完成实际浏览器检查前不声称真实 Provider/浏览器已验收。
- 单文件串行运行本合同涉及的 Agent、Minecraft 迁移、Plugin Manager API、Plugin Manager 与 Wallpaper Engine Runtime 回归；修正 5 项既有失败后，运行相关类型检查、`pnpm run build:web`、UI 包构建、`pnpm run check:workspace` 和 `git diff --check`。
- Web 产物必须位于根 `dist/apps/web`；当前入口引用的 AI Work CSS 不含 `.ai-work-chat__message-content--streaming ...:after` 光标规则。旧哈希资源按三代保留策略继续存在，不应拿旧资源判断当前入口。不得将构建通过描述为浏览器已加载；页面刷新/帧时间未实测时明确说明。

## 实施记录

- `packages/core/agent-loop/src/execute-turn.ts` 对已派发后失败或结果未知的工具，按工具 ID 与经 `prepare` 后的有效参数生成稳定签名；同一 Run 再遇到相同签名时记录 `dispatched=false`、`executionState=not_started` 并停止本轮。失败签名集合上限为 256，防止无界内存增长。没有更改模型/工具预算或账户设置。
- `packages/client/ui-chat/src/ai-work-chat.css` 的流式回复末尾光标规则已移除。`pnpm --filter lfaa-client-ui-chat run build` 与 `pnpm run build:web` 均完成；当前 AI Work chunk 引用 `dist/apps/web/assets/ai-work-chat-rQH0ZfnQ.css`。本机 `127.0.0.1:3000/tasks` 和该 CSS 均返回 HTTP 200；当前 CSS 不含光标规则。三代资源保留策略仍保留上一版 CSS，其中有旧光标规则。打开中的浏览器页面尚未重载，真实渲染和帧时间未实测。
- 更正先前标准测试暴露的 5 项失败：迁移测试不再把已有 v36+ 表结构伪装成 v34 数据库；两项旧插件目录期望纳入当前 `connectivity` App；Wallpaper Engine 安装夹具补齐当前来源合同需要的 Host 路由及客户端视频就绪锚点。
- 验证通过：`pnpm test`（279 通过、1 跳过、0 失败）；`pnpm run typecheck`；`pnpm run check:workspace`（178 个包）；`pnpm --filter lfaa-client-ui-chat run build`；`pnpm run build:web`；`pnpm run build:control-plane`；`git diff --check`。逐帧文本合并与 SSE 解析回归 21/21 通过；完整 Harness Agent/工具/自动化回归通过。
- 对运行服务的只读静态检查确认新 CSS 可获取，但未进行真实 Provider 请求、浏览器页面刷新/渲染验收或运行时帧时间测量。为保留现有任务和 Minecraft 服务，Control Plane 构建后未重启当前进程；因此 Agent 防重逻辑已进入构建产物，需服务下次受控启动后才会运行。
