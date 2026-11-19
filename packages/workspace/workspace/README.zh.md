# `@lfaa/workspace`

LFAA 的工作区与本地项目插件包。

- `src/index.ts`：Host 侧 Cordis 服务（`WorkspaceService`），不包含任何 React、DOM 或 CSS 依赖。
- `client/index.tsx`：Client 侧 Cordis 插件（`inject: ["workbench"]`），向四栏 Shell 注册本地项目存储、项目概览与详情视图、创建弹窗以及右侧上下文面板，并在插件卸载时自动清理全部贡献。

仅填写项目名时，默认目录下创建同名文件夹。已有同名文件夹时，用户确认信任后使用该文件夹，保留其中的内容。信任弹窗显示的默认路径变化时，需重新确认后才能保存绑定。
