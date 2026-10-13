# LFAA-AI-WORK-STREAM-CARET-FLICKER-20261009

## 目标与运行入口

移除 AI Work 中间主聊天区域 Agent 流式回复末尾的光标。此前 `ui-chat` 在正在输出的 Markdown 末尾绘制了会闪烁的伪光标；目标是移除整个光标提示，同时继续按现有流式链路更新。

运行入口为现有 Workbench 内的 AI Work 主聊天；消息与 SSE 仍由当前 Client Connection 和 `AiWorkChat` 消费。

## Owner 与设置

- `packages/client/ui-chat` 持有主聊天回复的展示样式；`AiWorkChat` 仅消费既有 SSE 回调。
- 不修改 Agent Loop、SSE、Session、滚动 Owner 或公开接口。
- 不新增或修改设置。回复颜色继续读取现有 Appearance 强调色令牌；主题、字体和字号仍由现有外观令牌控制。

## 范围与验收

- 流式回复末尾不再绘制光标或其他光标提示。
- 保留回复逐步显示、Markdown、跟随最新回复、暂停跟随及已有 Appearance 映射。
- UI 包构建成功；直接相关的现有流式性能回归通过。
- 不重启正在运行的 Web/Daemon。若未在当前登录浏览器中复验，将视觉运行验收单独标记为待验。
- 构建产物只写仓库根 `dist/`。

## 实施记录

- `ai-work-chat.css` 移除了流式回复末尾的整个伪光标规则。Agent Loop、SSE 帧合并、Markdown 内容、滚动跟随和用户设置未改。
- 设置：无设置中心配置新增或修改；该提示不再读取强调色令牌。
- 验证：`pnpm --filter lfaa-client-ui-chat run build` 通过，产物写入 `dist/packages/client/ui-chat/`；从 `apps/cli` 运行 `node --import tsx --import ./register-package-loader.mjs --test tests/client-performance.test.mjs`，21/21 通过；`git diff --check` 通过；源文件与构建产物中均已确认不再有流式光标规则或 `ai-work-chat-caret` 动画。
- 性能证据与边界：现有 SSE 回归确认 1000 个同帧片段合并为一次回调且顺序完整，本次仅删除 1 秒循环动画，没有宣称整体渲染耗时下降。登录浏览器视觉、真实长回复和帧时间未测；没有重启 Web/Daemon。
