# P0 四个热点文件拆分边界

本文件只给下一阶段建议。当前源码保持原状；不按行数机械拆分，不在 UI 包复制领域规则、设置、权限或数据 Owner。

## 当前结构快照

| 文件 | 当前行数 | React hooks（约） | 主要当前职责 | 计划顺序 |
|---|---:|---|---|---|
| `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` | 3,075 | state 78、ref 37、callback 63、memo 11、effect 约 29 | 四栏上下文、导航/会话/项目、Git、浏览器标签、侧栏/通知、Canvas/应用装配 | P1-A |
| `packages/client/ui-chat/src/AiWorkChat.tsx` | 3,167 | state 73、ref 56、callback 12、memo 14、effect 约 30 | 会话/消息、流式 Run、模型与推理、附件、Composer、审批、滚动锚点、来源 App 上下文 | P1-B |
| `packages/client/ui-workspace/src/CanvasWorkspace.tsx` | 2,448 | state 37、ref 44、callback 62、memo 11、effect 约 18 | Canvas 与 AI Video Owner 适配、项目读写、React Flow、历史、dirty/409 冲突、生成和面板 | P1-C |
| `packages/client/ui-layout/src/Workbench.tsx` | 1,300 | state 26、ref 15、callback 24、memo 5、effect 约 20 | 路由/入口装配、主题/外观引导、全局导航、设置和通知 | P1-D |

行数、hook 数与 effect 粗数来自当前文件静态 AST/源码检查；用于定位边界，不是性能指标。它们已受工作树里的未提交差异影响，不能直接与计划草案中的 3,074/3,127/2,449/1,298 行数比较成回归结论。

## 各文件责任切分

### P1-A：`ApplicationWorkspace.tsx`

- **薄组合层保留：** 定义工作区主区域关系，接收 `Workbench` 的用户偏好/入口上下文，组合会话侧栏、页面内容、Canvas 与领域 App 视图。
- **候选抽离：** 纯展示组件（header、sidebar、tabs、content/right panel）；各自唯一的导航/会话/项目/浏览器/Git 状态 hook；Canvas/Workflow 的定位通知适配器。
- **边界：** `WorkspaceProject` 文件夹/关联仍归 Workspace/项目 Owner；Session 读写仍归 Session Owner；Git 状态来自 Git Owner；浏览器归 Browser Owner；Canvas 内容/版本仍归 Canvas Owner。
- **保持条件：** `onCanvasToolsCompleted` 的 projectId/revision 过滤、本地 dirty 冲突、请求取消和既有响应式 chrome 状态不能因抽 hook 变成双订阅或重放旧快照。

### P1-B：`AiWorkChat.tsx`

- **薄组合层保留：** 对外组件 API、聊天区组合、把当前 Session/Run 与 Composer、时间线和活动视图接起来。
- **候选抽离：** `MessageTimeline`、`ChatComposer`、`RunActivity`、模型/推理选择视图；Session/消息加载、Composer 草稿/附件、Run stream 等按单一数据所有权抽 hook。
- **边界：** provider/model catalog 由 Settings/Provider Owner 提供；审批走统一 Permission Owner；附件走资源/上传 Owner；滚动锚点仍只有一份权威状态。
- **保持条件：** 取消/重试/审批等待、消息与 Run 对应关系、Session `contextApplicationId` 保存/恢复、流订阅 cleanup、输出锚点与用户滚动意图。

### P1-C：`CanvasWorkspace.tsx`

- **薄组合层保留：** 根据 applicationId 选择正确的 Canvas/AI Video Owner 适配器，并组合 stage、toolbar、panel。
- **候选抽离：** Stage、Toolbar、Panels；文档 load/save 与 `expectedUpdatedAt`；history；generation；selection/viewport 独立 hook。
- **边界：** 画布节点/边和项目格式仍由各自领域 Owner 定义；AI Video 不经通用 Canvas 创建副本；Provider 设置仍读 Settings/Provider Owner。
- **保持条件：** 409、dirty 状态、本地修改保护、请求 AbortSignal、服务端更新版本与工具完成后的仅目标项目刷新。

### P1-D：`Workbench.tsx`

- **薄组合层保留：** 把路由解析结果、用户设置和当前导航状态装配成统一 Shell 与应用内容。
- **候选抽离：** 纯路由解析函数、App 导航模型/组件、全局 Shell 组件及其小型外观映射。
- **边界：** 设置由 Settings Owner 提供，Workbench 不维护第二份默认值；应用路由映射仍在现有 App 装配/入口合同中；偏好存储与 localStorage 布局状态彼此独立。
- **保持条件：** 路由回退/深链、appearance/reduced-motion 映射、通知订阅 cleanup、App 可见性、默认布局与用户已保存布局。

## 批次与未决命名矛盾

实施计划第 3 节要求顺序为 P1-A（ApplicationWorkspace）→ P1-B（AiWorkChat）→ P1-C（CanvasWorkspace）→ P1-D（Workbench）；但第 4 节批次表把 `P1-A1` 标为“Workbench 纯类型/纯函数抽离”，和优先级及目录建议冲突。用户在 2026-11-13 明确选择遵从优先顺序，因此本轮将 P1-A1 作为 ApplicationWorkspace 首批纯类型/纯函数抽取；计划原文不改，其他 P1 顺序仍按原计划执行。

计划的 300–600 行组合层与 100–400 行模块只是指导线，不是验收门槛。每个抽取需有唯一状态源，保持公开导出和动态加载路径；将纯展示/纯函数与订阅/异步副作用分开迁移；不把相邻功能塞进新大 hook，也不重复订阅或复制 useEffect。
