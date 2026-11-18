# Dev Log 000065 — 重构资料库中心界面并实现左一图标驱动的领域专属左二功能菜单切换

- **编号**：000065
- **时间**：2026-11-18 10:37:03 +08:00
- **任务名**：`library-ui-and-domain-sidebars`
- **状态**：已完成实现、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 修复与重构目标

1. **左一图标驱动左二专属功能菜单切换**：修复此前除「设置」外所有左一图标（`资料库`、`插件`、`定时任务`、`代码审查`、`图像` 与扩展视图）点击后左二菜单栏仍停留在聊天侧边栏（`新聊天 / 置顶 / 项目 / 最近`）的问题，实现与各领域视图一一对应的左二菜单与页眉。
2. **修复并重构资料库（`LibraryView`）界面布局**：此前 `LibraryView.module.css` 定义了 3 行网格（`auto auto minmax(0, 1fr)`），但 `LibraryView.tsx` 存在 4 个直接子节点导致中部工具栏被动吸收整屏剩余高度，产生大面积纵向空白且工具栏错位；通过将存储路径合并为标题区胶囊标签、收口为紧凑 3 行结构并重写空状态展示卡片与自适应卡片栅格，消除空白断层。
3. **双向状态同步**：`WorkbenchClientService` 新增 `activeLibraryTab` 与 `activeDomainItem` 状态及切换方法，使左二「资料库」分类菜单与中心区「资料库与资产库」分类标签页（`全部` / `Agent 产物` / `本地资产` / `Agent 记忆`）双向联动。

---

## 2. 实际变更清单

- **左一 / 左二领域路由与专属菜单（`packages/ui/layout`）**：
  - [workbench-domains.ts](file:///e:/lfaa/packages/ui/layout/client/workbench-domains.ts)：将 `WorkbenchDomainId` 扩展为 `"workspace" | "settings" | "library" | "images" | "scheduled" | "plugins" | "codeReview" | "extension"`，并为 `SidebarHeaderConfig` 新增 `"sectionTitle"` 模式。
  - [workbench-service.ts](file:///e:/lfaa/packages/ui/layout/client/workbench-service.ts) 与 [index.tsx](file:///e:/lfaa/packages/ui/layout/client/index.tsx)：新增 `LibraryTabKey` 类型、`activeLibraryTab`、`activeDomainItem` 及 `setLibraryTab` / `setDomainItem` 状态同步契约。
  - [DomainSidebarMenu.tsx](file:///e:/lfaa/packages/ui/layout/client/components/DomainSidebarMenu.tsx)（226 行，新增）：复用 `SidebarSectionList` 实现 `library`（资料库分类 + 存储设置）、`plugins`（自定义 / 扩展与技能 / 已安装的插件）、`scheduled`、`codeReview`、`images` 与扩展视图的专属左二菜单。
  - [NavigationSidebar.tsx](file:///e:/lfaa/packages/ui/layout/client/components/NavigationSidebar.tsx) 与 [WorkbenchShell.tsx](file:///e:/lfaa/packages/ui/layout/client/components/WorkbenchShell.tsx)：支持 `"sectionTitle"` 标题头渲染，非 `workspace` / `settings` 域自动委派至 `<DomainSidebarMenu>`。
  - [persistence-lifecycle.test.ts](file:///e:/lfaa/packages/ui/layout/tests/persistence-lifecycle.test.ts)：补充 `resolveWorkbenchDomain` 全域解析与 `WorkbenchClientService.setLibraryTab` / `setDomainItem` 单元测试。
- **资料库中心界面重构与同步（`packages/core/chat`）**：
  - [LibraryView.module.css](file:///e:/lfaa/packages/core/chat/client/components/LibraryView.module.css)（363 行，低于 400 行强约束阈值；保持单视图样式内聚）：重写 3 行网格（`.topBar` / `.tabStrip` / `.mainBody`），修复中部空白拉伸问题，统一胶囊标签、快速记忆输入栏、居中空状态卡片及网格/抽屉样式。
  - [LibraryView.tsx](file:///e:/lfaa/packages/core/chat/client/components/LibraryView.tsx)（313 行，低于 400 行强约束阈值；后续若持续扩展卡片/抽屉功能再行拆分子组件）：合并存储目录为顶部内联路径胶囊，精简为 3 个直接子节点并接入受控 `activeTab` / `onChangeTab` 同步。
  - [index.tsx](file:///e:/lfaa/packages/core/chat/client/index.tsx)：将 `wbSnap.activeLibraryTab` 与 `context.workbench.setLibraryTab` 注入 `<LibraryView>`。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test` 运行全部 10 个测试文件 | **37/37 通过**（`duration_ms 3137.3494`） |
| TypeScript 类型检查 | `pnpm run typecheck` | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 742ms`） |
| 内置浏览器实测 | `browser` 子代理访问 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0/50） |

- 实测核验（`browser` 子代理 `ad36e2ee-37a3-4bc8-986d-db9e09d74232`）：
  1. `资料库`：`topBar` 高 `99.09px`、`tabStrip` 高 `38.72px`、`mainBody` 与标签栏间距仅 `14.39px`，无纵向空白拉伸；点击左二 `Agent 产物` 后中心标签切换至 `Agent 产物`，点击中心 `Agent 记忆` 标签后左二同步高亮 `Agent 记忆`。
  2. 依次点击 `插件`（左二页眉为 `自定义`）、`定时任务`、`代码审查`、`图像` 均显示各自领域专属左二菜单，返回 `首页` 后正常恢复 `新聊天 / 置顶 / 项目 / 最近`。
  3. 资料库视图最终截图：[final_step_26.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/ad36e2ee-37a3-4bc8-986d-db9e09d74232/final_step_26.png)。
- Web 服务 `pnpm lfaa web`（`task-1215`）已保持在后台运行，可随时访问 `http://127.0.0.1:5173/`。
