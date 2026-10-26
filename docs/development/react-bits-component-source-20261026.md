<a id="lfaa-react-bits-component-source-20261026"></a>

## React Bits 组件与动效来源约定（2026-10-26）

### 目标、Owner 与设置

- 将 React Bits 作为按需选用的外部组件/动效来源，限定先选具体组件，再按 LFAA 当前 checkout、目标包职责与样式体系适配。
- UI 共享 Owner 仍由现有包职责规范决定：跨应用控件/交互归 `packages/client/ui-primitives`，主题令牌/共享材质归 `packages/client/ui-theme`，页面专属实现留在对应业务包；React Bits 只是上游来源，不成为 LFAA UI Owner。
- 设置中心：不新增/修改设置。后续实现沿用外观设置、减少动态效果映射、响应式、无障碍和资源清理规则。
- 上游资料：[React Bits 仓库](https://github.com/DavidHDev/react-bits)、[许可证文本](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md)、[安装文档](https://reactbits.dev/get-started/installation)、[shadcn MCP 指南](https://reactbits.dev/get-started/mcp)。仓库当前许可证为 MIT + Commons Clause，包含对组件单独或打包再分发的限制；每个选定组件需在实际引入前核对对应许可证/第三方声明，并判断与 LFAA 分发方式兼容。不能仅因上游标注可商业使用或 CLI 可安装就认定可随 LFAA 产品分发；有疑义时改用许可兼容来源或取得明确授权。

### 修改范围与验收

- 允许修改：本合同、`docs/PROMPTS.md` 与根 `开发规范.md` 中的 React Bits 通用约定。
- 禁止修改：本任务不实现产品组件、不新增依赖/组件源码、不连接或配置 shadcn MCP、不改变 UI Owner/设置/权限或分发配置。
- 验收：规范涵盖当前 checkout 与目标包 README/技术栈/Owner 检查、选择具体组件及最小源码、按 CSS/Tailwind 适配但不迁移全站、共享组件与页面专属 Owner、主题与无障碍/响应式/动效约束、许可证和上游来源记录，以及 shadcn MCP 先搜索展示候选、选定后才写入的流程；`git diff --check` 与合同索引/锚点检查通过。此文档任务不运行产品构建或页面验收。

### 实施与验证记录

- 官方仓库说明组件以源码形式安装，提供 JS/TS 与 CSS/Tailwind 变体，并支持 CLI 或手动复制；shadcn MCP 以 React Bits Registry 提供按名称读取组件。LFAA 规则要求先展示/选择具体候选，避免整库引入。
- 已核对上游 `LICENSE.md`：许可证为 MIT + Commons Clause Condition v1.0，明确允许商业用途，同时限制单独、打包或移植版本出售/再许可/再分发组件本身。因此本次只规定组件级兼容性审查，没有下载或装入任何 React Bits 组件。
- `开发规范.md` 新增 React Bits 来源规则，覆盖当前 checkout、目标包 README/技术栈/Owner、最小源码与样式变体、共享/页面 Owner、现有设置与响应式/无障碍/生命周期、来源和许可证记录，以及 shadcn MCP 的只读候选搜索与用户选定后写入流程。
- 文件职责：`开发规范.md`（项目通用 React Bits 使用门槛）；`docs/PROMPTS.md`（本轮索引和状态）；本合同（用户目标、上游许可事实、边界与验证）。
- 设置中心：无新增/修改；未改产品代码、依赖、运行数据、权限、插件、MCP 配置或任何组件源码。
- 验证：`git diff --check` 通过；本合同 Markdown 文件及 `PROMPTS.md` 中的路径/锚点存在；对本任务变更的 Markdown 文件扫描未发现行尾空格。未运行产品测试、构建或浏览器验收（纯文档任务）。
