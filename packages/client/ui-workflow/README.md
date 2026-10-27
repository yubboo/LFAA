# `lfaa-client-ui-workflow`

跨 App 的节点图编辑器，共享 Web/Desktop React 实现。React Flow 只管理视图交互；保存的数据通过 `lfaa-client-connection` 到已认证 API，不将 UI 内部 Store 当持久化 Owner。

应用可传入本 App 已注册的节点目录和节点字段编辑器。核心文本/结果节点有通用呈现；缺少插件 renderer 的未知节点显示不可运行占位并保留原始配置。

`ApplicationWorkflowCanvas` 在共享 Canvas 外壳内按当前 App 读取工作流、节点/引擎目录和实际运行状态；Agent 节点编辑器从该 App 节点目录返回的工具选项读取，不自建工具或权限状态。当前工作流 ID、标题和 Owner 更新时间只经 Client Connection 作为当前画布对话的临时 `workspaceView` 提示传递，不能代替 Agent 读取最新定义或授权。

构建输出由工作区脚本写入根目录 `dist/packages/client/ui-workflow/`。
