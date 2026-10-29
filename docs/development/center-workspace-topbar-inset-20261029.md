# LFAA-CENTER-WORKSPACE-TOPBAR-INSET-20261029

<a id="lfaa-center-workspace-topbar-inset-20261029"></a>

## 用户问题与目标

用户在 `/apps/writing/ai-work` 发现中间工作区顶部栏左右留白过大；其他 App 共用该栏，也有同样表现。顶部操作栏应使用中间列完整宽度，聊天正文、输入框、消息和应用内容继续保留已有左右留白。

## 入口、Owner 与边界

- 入口：`/apps/:appId/ai-work` 中间区共用标题/模式工具栏；同一中心栏也服务 Canvas 与手动工作模式。
- 样式唯一 Owner：`packages/client/ui-workspace/src/css/center-workspace.css`。AI Work 聊天内的 header 曾套用正文间距 `--ai-work-chat-inline-gap` 缩窄；普通模式另有 header 专属内边距。Dock 几何和左右间距归现有 `ui-dockkit`/正文样式 Owner，本轮不改。
- 权限、会话、项目和领域数据不在本轮修改范围；不发送聊天消息、不更改设置。
- 设置：无顶部栏间距设置。继续使用 `general.navigationLayout` 及现有 Dock 宽度/折叠偏好；本轮不更改其默认值或持久化。Appearance 主题令牌继续由共享样式消费，不新增 CSS 变量或设置项。

## 允许范围与验收

- 产品代码只改 `packages/client/ui-workspace/src/css/center-workspace.css` 中顶部栏规则；删除顶部栏独享的内容留白/居中约束，使用其基线响应式 padding。
- 禁止改正文 `.module-center__content--application`、AI Work 对话/输入区间距、四栏几何、导航/Dock、其他应用组件或设置。
- 验收 `/apps/writing/ai-work` 的真实页面截图与顶部交互：顶部栏左右边缘回到中间列内侧基线位置；正文/输入框继续有留白；记录 Chat/Canvas 视图。内置浏览器至少记录实际视口与窄容器；设置值保持不变。
- 运行 `lfaa-client-ui-workspace` 构建、正式 Web 构建、Web 源码指纹检查及 `git diff --check`；不新增或运行测试。

## 实施与验收记录

- 实施前工作树干净，当前分支 `main`。设置盘点确认无顶部栏专用设置；`general.navigationLayout` 仍由 Settings Owner 管理，和本轮内边距规则无绑定。
- 产品源码仅修改 `packages/client/ui-workspace/src/css/center-workspace.css`：删除普通模式 header 的专属不对称 padding（含两个容器断点覆盖），删除 AI Work 聊天 header 使用正文间距变量缩窄并居中的规则。正文、输入区、Dock、四栏几何与其他组件规则未改。
- 修复前内置浏览器页面为 `http://127.0.0.1:3000/apps/writing/ai-work`，视口 `1048×922`；复现顶部栏和正文同受额外左右间距影响。修复后同一路由目视：中间栏约 `620px`，顶部工具栏回到中间栏宽度，聊天正文/输入框仍保留左右留白。
- 内置浏览器切到画布后，画布路由显示共享顶部栏及画布区域，未见黑屏；切回聊天后路由为 `/apps/writing/ai-work`。切换时聊天上下文显示“当前写作空间项目：未命名画布”；无法从本次页面证据判断这是既有项目还是画布入口自动建立的项目，因此没有执行删除。未发送消息、未更改设置。手动模式、手机/平板、触屏与完整桌面视口未验。
- `pnpm.cmd --dir packages/client/ui-workspace build` 通过；`pnpm.cmd run build:web` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过；`GET http://127.0.0.1:3000/api/health` 返回 `status: ok`。未新增或运行测试。
- 为使构建产物与源码一致，原 Web 服务按其退出清理流程停止并从当前 checkout 重启；`http://127.0.0.1:3000` 当前保持运行。本轮没有修改任何设置值或 CSS 自定义属性。
