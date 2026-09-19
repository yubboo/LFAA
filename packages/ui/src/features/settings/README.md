# Settings UI

配置设置类图形界面的父目录。业务真值来自 `packages/config-system` 的公开能力，UI 不复制配置逻辑。

## 左侧导航几何

Settings 左栏必须直接复用 `packages/ui/src/workbench/ResizableWorkbench.tsx` 的左栏能力；禁止在 Settings CSS 中写固定侧栏宽度或自建 Pointer resize/snap。设置使用独立 `lfaa.settings.layout.v1` 持久化 key，不污染工作台布局。
