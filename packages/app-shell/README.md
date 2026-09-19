# 应用壳

## 目录

`packages/app-shell`

## 当前职责

页面与 Feature 编排，供 Web / Desktop 共用。

当前已实现：

- `AgentWorkbench`
- 左侧导航 / 会话区
- 中间工作区 / 对话区
- 右侧工具 / `.lfaa` 资源区
- 浅色 / 深色中性主题
- AI 设置 Feature 组装：`@lfaa/config-system` Provider Registry → `@lfaa/ui` ViewModel；不拥有 Provider 业务事实

视觉方向：Codex / ChatGPT 类生产力工具风格，但保留 LFAA 自有品牌和信息结构。

Vite 特有的 `.lfaa` 开发桥接不放在本包，保持 App Shell 与运行环境解耦。

源码导航：`packages/app-shell/src/README.md`。

## v0.0.64 Shell 交互

App Shell 负责 Settings / UserMenu / ThemeMenu 的打开关闭和主题 preference；共享 UI 本身位于 `@lfaa/ui`。设置使用独立 Surface，不再塞入 ResizableWorkbench center pane。
