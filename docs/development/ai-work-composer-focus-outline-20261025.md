# LFAA-AI-WORK-COMPOSER-FOCUS-OUTLINE-20261025

## 用户问题与目标

用户提供 `/work` 截图，输入框聚焦时出现深色矩形内框，未聚焦时消失；截图也标出了顶部操作区。修正重复的输入焦点边框，让外层输入框容器现有的强调色边框成为唯一焦点提示，并核对顶部操作区是否存在源码可确认的样式问题。

## 入口与 Owner

- 运行入口：Web/Desktop 共用 Client 的 `/work`。
- 输入框与 Composer 样式 Owner：`packages/client/ui-chat`，由 `AiWorkChat` 使用 `ai-work-chat.css`。
- 顶部操作区 Owner：`packages/client/ui-workspace` 的 `ApplicationWorkspace` 及中心工作区样式；仅在实页或样式链确认缺陷后修改。
- 权限、会话、消息和 Agent 行为沿用现有 Owner，本任务不改其合同。

## 设置、数据与边界

- 沿用设置中心 `appearance.theme`、当前主题的强调色、边框和字体共享令牌，以及已有的壁纸遮罩/模糊映射；无新增设置，不读取或写回新偏好。
- 不写入会话、账户、项目或权限数据；不改变 Permission Owner 与现有权限模式。
- 允许修改直接相关的 Client CSS、必要的长期回归、此合同和 `docs/PROMPTS.md` 索引；不调整无关布局或主题默认值。

## 可观察验收

- 聚焦与未聚焦状态下，输入文字区域不显示浏览器默认的深色内框；聚焦时外层 Composer 保留设置中心强调色焦点提示。
- 检查截图标出的顶部操作区；只有确认组件样式确实异常才修改。
- 运行直接相关构建，并在 ChatGPT 内置浏览器打开当前源码工作区的 `/work`，检查桌面和窄/短视口；记录路由、视口、交互、截图及未测范围。
- 性能与安全：不增加订阅、请求、观察器或动画；不改认证、授权、设置持久化和业务数据。

## 实施与验证记录

- `packages/client/ui-chat/src/ai-work-chat.css`：在输入框聚焦规则中增加 `outline: 0`。输入框原有的无边框/无阴影样式不变；聚焦提示继续由 `.ai-work-chat__composer:focus-within` 按当前强调色绘制。
- 顶部操作区经实页与计算样式核对后没有改动：语音按钮的边框透明；“变更/摘要”分组使用 `--color-border` 浅色描边；Composer 图标、权限、更多和模型按钮的边框透明，更多按钮仅使用现有浅色表面。
- 设置中心配置：沿用 Appearance 的主题、强调色、边框、字体、壁纸遮罩和模糊令牌；本轮未新增设置项，也未修改账户偏好。
- 实际构建：`pnpm run build:web` 通过，输出位于根 `dist/apps/web` 与 `dist/packages`；`node scripts/runtime-build-state.mjs web` 返回 `[]`。
- 正式服务：源码指纹更新后使用 `pnpm lfaa web --no-local-daemon`，官方预检识别并重启当前数据目录持有的 LFAA Web；就绪地址 `http://127.0.0.1:3000`。`/work` 返回 200，`/api/health` 返回 200 且 `status=ok`、`persistence=ready`。
- 内置浏览器实测：ChatGPT 内置浏览器的 `http://127.0.0.1:3000/work`，桌面 1280×720 与窄/短屏 820×520。鼠标聚焦输入框后，截图可见外层强调色边框且没有内层黑框；计算样式为输入框 `border: 0`、`outline: none 0px`，外层边框使用当前主题颜色。窄/短屏顶部操作保持可见，输入区未横向溢出。视口覆盖随后已恢复。
- 截图证据：本轮在 ChatGPT 内置浏览器分别捕获了 1280×720 聚焦页和 820×520 聚焦页；当前浏览器仍停留在验收后的 `/work` 页面。没有保存额外截图文件。
- `git diff --check` 通过。未新增或运行测试套件；此次为单条 CSS 声明调整，已完成正式 Web 构建和实际浏览器聚焦/响应式验收。未测帧时间、真实触屏和 Desktop WebView。
- 无消息发送、会话写入、Provider 请求、真实设置写入或权限模式变更；界面检查期间输入框保持为空。性能方面没有增加订阅、请求、动画或生命周期资源。
- 文件职责：`packages/client/ui-chat/src/ai-work-chat.css`（AI Work 聊天/输入区样式）；`docs/development/ai-work-composer-focus-outline-20261025.md`（本任务边界与实施、验收记录）；`docs/PROMPTS.md`（任务索引）。
