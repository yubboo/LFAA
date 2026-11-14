# 模型选择界面

`lfaa-client-ui-model-selection` 呈现聊天内模型目录和推理能力选择，不持有模型配置或认证写入。

- 稳定入口：`src/index.ts`；当前由 `packages/client/ui-chat` 静态引用，随聊天模块加载，不独立注册 Cordis 服务、路由、Profile 或 Bundle 能力。
- 视图：`ModelSelectionPopover.tsx` 呈现模型搜索/选择、Provider 已声明的推理选项和设置中心入口；专属 CSS 位于 `model-selection.css`。账户目录、当前选择和动作均由聊天协调层传入。
- 能力与设置：目录投影、推理参数映射由 `ui-settings-models` 提供；账户隔离和认证模型/推理设置写入继续由 Settings/Connection Owner 负责。
- 设置/数据/权限：不新增设置、持久化、授权或 API，不把模型目录缓存到本包；UI 禁用态不代替服务端校验。
- 运行状态：源码实现并作为聊天静态依赖消费；本批通过包构建、Client 类型检查和工作区 Gate。实页交互、窄短视口和桌面宿主尚未按此包单独验收。
