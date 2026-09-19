# Settings UI

配置设置类图形界面的父目录。业务真值来自 `packages/config-system` 的公开能力，UI 不复制配置逻辑。

## 左侧导航几何

Settings 左栏必须直接复用 `packages/ui/src/workbench/ResizableWorkbench.tsx` 的左栏能力；禁止在 Settings CSS 中写固定侧栏宽度或自建 Pointer resize/snap。左栏宽度由 App Shell 的共享 `leftPaneWidth` 统一受控：工作台调整后进入 Settings 必须同宽，Settings 调整后返回工作台也必须同宽。`lfaa.settings.layout.v1` 只允许保存 Settings 自身布局辅助状态，不得成为第二个左栏宽度真值。
