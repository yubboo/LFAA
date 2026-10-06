# `lfaa-client-ui-workflow`

跨 App 的节点图编辑器，共享 Web/Desktop React 实现。React Flow 只管理视图交互；保存的数据通过 `lfaa-client-connection` 到已认证 API，不将 UI 内部 Store 当持久化 Owner。

应用可传入本 App 已注册的节点目录和节点字段编辑器。核心文本/结果节点有通用呈现；缺少插件 renderer 的未知节点显示不可运行占位并保留原始配置。

构建输出由工作区脚本写入根目录 `dist/packages/client/ui-workflow/`。
