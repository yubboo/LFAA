# AI 配置图形界面

本目录只保留 AI 配置图形面板及旧公开名称兼容包装；Settings 导航与 Plugin 管理页归 `packages/app-shell/src/workbench/settings/`。业务真值来自 `packages/config-system` 的公开能力，UI 不复制配置逻辑。

## 与产品 Settings 的边界

App Shell Settings 页面复用 `@lfaa/ui/workbench` 的左栏 Resize/Snap 算法，并由 App Shell 的 `leftPaneWidth` 持有共享宽度。AI 面板只接收外部 ViewModel/回调，Secret 仅在未保存表单中短暂存在，不访问 Credential Manager 或浏览器 Storage。
