# `@lfaa/workspace`

LFAA 的工作区与本地项目插件包。

- `src/index.ts`：Host 侧 Cordis 服务（`WorkspaceService`），不包含任何 React、DOM 或 CSS 依赖。
- `client/index.tsx`：Client 侧 Cordis 插件（`inject: ["workbench"]`），向四栏 Shell 注册本地项目存储、项目概览与详情视图、创建弹窗以及右侧上下文面板，并在插件卸载时自动清理全部贡献。
