# 应用壳

## 目录

`packages/app-shell`

## 当前职责

产品 Shell / Chrome / Composition，供 Web / Desktop 共用；Chat/Work Workspace 内部实现由 `@lfaa/workspace` 提供。

当前已实现：

- `AgentWorkbench`
- 左侧导航 / 会话区
- 中间 Shell / Header / Composer，并装配 `@lfaa/workspace` 的 Chat/Work 工作模式
- 右侧工具 / `.lfaa` 资源区
- 浅色 / 深色中性主题
- Settings 页面、Plugin 管理页与 AI 设置 Feature 组装：`@lfaa/config-system` Provider Registry → App Shell Controller/ViewModel → `@lfaa/ui` AI 配置面板；不拥有 Provider 业务事实

视觉方向：Codex / ChatGPT 类生产力工具风格，但保留 LFAA 自有品牌和信息结构。

Vite 特有的 `.lfaa` 开发桥接不放在本包，保持 App Shell 与运行环境解耦。

源码导航：`packages/app-shell/src/README.md`。

## v0.0.64 Shell 交互

App Shell 负责 Settings/Page/Plugin 管理页与 UserMenu 的产品 View、打开关闭和主题 preference；通用 ThemeModeMenu、ResizableWorkbench 与 AI 配置图形面板继续来自 `@lfaa/ui`。设置使用独立 Surface。
