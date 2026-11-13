# LFAA 1.0 P1-A1：ApplicationWorkspace 第一批纯逻辑抽取

<a id="lfaa-agent-app-rearchitecture-p1-a1-20261113"></a>

## 用户目标

继续执行《LFAA-1.0架构与体验重构实施计划》。计划第 3 节的优先顺序指定先做 P1-A `ApplicationWorkspace`，第 4 节却把 P1-A1 写成 `Workbench`。用户已明确选择“按优先顺序：先拆 ApplicationWorkspace”。本批据此将 P1-A1 定义为 `ApplicationWorkspace` 的第一批**纯类型/纯函数抽取**；不改产品行为，也不开始 P1-B/C/D。

## 运行入口、Owner、设置与数据边界

- 运行入口：共享 `/work` 工作区；App 入口和 Canvas/领域页面共用 `ApplicationWorkspace`。
- Owner：组件仍持有所有 React state、订阅、计时器、请求和副作用；本批新增的模块只拥有显式输入到输出的类型/纯辅助函数，不读取浏览器全局、设置、API 或运行数据。
- 相关设置：不新增设置、不改偏好；继续使用 Settings Owner 提供的 `UserSettings`。此批次只移动不含设置读写的会话任务标签、tab 选择与地址/时间展示等纯逻辑。`general.navigationLayout`、appearance、`browserUse.showFullUrl` 的消费合同保持不变。
- 数据/权限：不读写 Session、项目、Canvas、Browser、Git、Host Task 或 Provider 数据；不改变认证、账户/App 范围、Permission Owner、API 参数或操作授权。
- 工作树：保留当前未提交 `contextApplicationId` 与其他现存改动。任务开始时 `ApplicationWorkspace.tsx` 已有该功能差异，本批只调整纯声明的位置及导入，不回退或改写其语义。

## 本批允许与禁止范围

- 允许：把 `ApplicationSummary`、`BrowserOpenTab`、`WorkspaceUtilityTab` 类型，以及其关联的纯展示/比较/查找函数移到 `packages/client/ui-workspace/src/application-workspace/`；原组件改为从新模块导入；为抽取后的纯函数增加直接回归；更新本包 README、本拆分边界说明、本合同和 `docs/PROMPTS.md`。
- 禁止：抽取或重写 `ApplicationWorkspace` JSX、React hooks/effects、数据请求、Session/Project/Git/Browser/Host Task 状态；改变公开导出、DOM/CSS、设置、路由、localStorage key、轮询或取消逻辑；修复其他已知/新发现的产品 Bug；清理或重置共享工作树/用户数据；停止/重启身份不明的现有 Web/Daemon。

## 可观察验收

1. 被移动的函数由同一参数得到与原实现一致的结果；对应直接回归覆盖 tab 选择、Host Task 等价/标签、浏览器地址展示和无效访问时间。
2. `ApplicationWorkspace` 保持原始公开组件 API 与全部现有 JSX/交互；不重复订阅或引入新的生命周期、副作用和可变缓存。
3. 本包构建、直接回归、`check:workspace`、适用类型检查及 Web 候选构建结果都记录；候选产物只在仓库根 `dist/.tmp/`。
4. 按仓库规则尝试在独立于现有用户 Tab 的内置浏览器中验收 `/work`，桌面与相关窄/短视口都不改变原有交互；若无法启动当前源码服务，记明构建/端口/归属证据，不把其他 checkout 的服务算通过。
5. 检查订阅、请求、计时器、DOM/状态改动为零；帧时间、真实 Provider、Daemon 等与本批无关或未测的项目明确标注。

## 实施记录

- 状态：P1-A1 本批完成。开始前已确认 `main` 与 HEAD `808ec53114ff97749b75b604928ba6a7a0180363`；工作树存在多处未提交改动，其中 `ApplicationWorkspace.tsx` 含来源 App 上下文改动，需原样保留。
- 计划取舍：遵从用户对计划矛盾的明确选择；只做 ApplicationWorkspace 纯类型/纯函数第一批，后续其他拆分仍须单独批次和回归。
- 实施：把 `ApplicationSummary`、`BrowserOpenTab`、`WorkspaceUtilityTab`、`ChromeState`、`NavigationLayout` 与 `ChromeStorageMetadata` 移入 `src/application-workspace/types.ts`；把 tab 查找、Host Task 比较/状态标签、浏览器 host/address 展示、默认 Chrome 计算移入 `pure-utils.ts`。`ApplicationWorkspace.tsx` 从 3,075 行减至 2,939 行（减少 136 行）。依赖当前时钟/locale 的 `browserVisitTime` 留在组件文件，React 状态/副作用没有移动。公开 `ApplicationWorkspace` API、DOM/CSS、设置读取和持久化保持原样；既有 `contextApplicationId` 差异保留。
- 验证：新纯函数回归 5/5；现有 `client-workbench-tabs-appearance` 回归 3/3；`pnpm --filter lfaa-client-ui-workspace run build` 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；本轮末次 `pnpm run typecheck` 通过；`pnpm run check:workspace` 通过（226 包，含新增测试消费者登记）；`git diff --check` 通过。
- Web 构建：`pnpm --dir apps/web exec vite build --outDir ../../dist/.tmp/p1a1-web-candidate-20261113` 成功（3,955 modules），出现大于 500 kB 的既有 chunk 警告。产物在仓库根 `dist/.tmp/`。构建后共享工作树中的 `AiWorkChat.tsx` 收到并行 HMR 修改；最终 `runtime-build-state.mjs web` 返回 `web`，因此正式 Web 运行树已过期，不能把候选构建说成与后续修改完全一致。
- 浏览器：独立的当前 checkout Vite 服务 `http://127.0.0.1:5173/work`；内置浏览器分别检查 1440×900 与 960×620。Work 页面和工作区内容可见，页面文档宽度与视口相同；有一个 Ant Design `Tooltip.overlayClassName` 弃用警告，没有观察到运行错误。截图时现有 Canvas 项目显示未保存更改；本轮没有操作画布、保存或触碰原有 3000 服务。Vite 自有服务在验收后已停止，视口已恢复。
- 设置/数据：使用 Settings Owner 传入的现有 `UserSettings`，包括调用处现有的 `browserUse.showFullUrl` 与 `general.navigationLayout` 映射；没有新增或改动设置。没有改用户数据、Session、Canvas、Provider、Daemon 或 Minecraft 服务。
- 尚未测：真实 Provider/Daemon、交互帧时间与内存/网络指标。此批是纯函数搬移，不以静态或构建结果声称性能提升，也没有修复其他产品 Bug。
