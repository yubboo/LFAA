# LFAA-JAVA-ENVIRONMENT-MASTER-DETAIL-20261030

## 用户问题与目标

- 用户提供了 Java 环境管理参考图，希望把当前 `/games/environments` 做成更清楚的版本列表与选中版本详情布局。
- 当前 Java 主版本卡片、下载/登记表单、已发现记录依次纵向堆叠；列表与详情没有关联，窄分栏时留白和操作层次不理想。
- 目标：在保留用户选择的 LFAA 深色运维外观与设置中心偏好的前提下，采用参考图的 Java 管理横幅、筛选/搜索和主从式工作区；不呈现未接入的性能分数、兼容性评分或虚构状态。

## Owner、设置、数据与权限

- 运行入口：`/games/environments` → `GameLibraryPage` → `RuntimeEnvironmentPanel`。
- Java 环境列表、详情、筛选和页面布局 Owner：`packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx` 与 `GameLibraryPage.css`。
- 已安装 Java 的版本、来源、路径和可用性只读自目标设备 Runtime Manager 的真实目录；关联实例及其所需 Java 主版本只读自 `RuntimeOverview.devices[].servers`。
- 安装、验证、更新、卸载、手动登记继续调用既有 Runtime Manager 合同。SteamCMD、Microsoft Visual C++、DirectX 分类与对应 Owner 不在改动范围内。
- Appearance 沿用 `appearance.theme`、强调色、字体/字号、对比度、壁纸表面透明度和模糊令牌；卡片动效读取 `general.cardMotionEffect`，减少动态效果按 Appearance 既有映射执行。本次不改偏好、不新增设置。
- 本机 Java 路径浏览继续使用既有设置中心 `permissions.mode`、账户角色及 `SystemFileLibrary` 校验；远端路径仅接受用户输入并由目标 Daemon 验证。

## 允许范围与验收

- 修改运行环境页的 Java 管理视图及其局部样式、页头返回入口、长期直接回归、`ui-layout` README、本合同和 `docs/PROMPTS.md` 索引。
- Java 版本列表支持按实例需求、已检测、待准备筛选，搜索和排序；选中主版本后显示真实来源、版本、路径、可用状态及已有实例关系。
- 保留原有安装、校验、更新、卸载和手动登记按钮的参数、权限禁用条件和 Owner 调用；浏览器验收不触发这些写操作。
- 使用共享卡片动效，遵循账户卡片动效与减少动态效果偏好；不新增 CSS 自定义属性。
- 有可用运行时记录时，“校验并复用”放在该记录操作行的右端；没有可用记录时仅显示一次下载入口。
- 由 `return` 查询参数确定的“返回 Minecraft/部署草稿”入口位于运行环境页头，与“返回游戏服务”并列；不再在设备栏下方占用整行，并保留原有路由目标。
- 宽容器使用主从两列，真实窄容器切为单列；窄屏/短屏无横向溢出，全部筛选、详情和操作均可滚动到达。
- 先运行 Java 环境 UI 结构/响应式回归、Client 类型检查、`ui-layout` 构建和 Web 构建，再通过 ChatGPT 内置浏览器验收实际路由。记录视口、交互、截图/目视证据及未测边界；恢复临时视口与侧栏状态，并保留用户指定的运行环境结果页。

## 实施与验证结果

- 实施记录：`RuntimeEnvironmentPanel.tsx` 以主版本列表和详情区替代原先纵向堆叠的 Java 卡片/登记表单；真实版本状态、实例 Java 主版本需求、来源、版本、路径和可用性分别用于筛选与详情。实例回链保持原目标。可用 Runtime 记录的操作行内将“校验并复用”置于最右，避免原先卡片外独占一行；无可用记录时只留一个下载入口。`GameLibraryPage.tsx` 根据原 `return` 查询参数在页头并排呈现“返回 Minecraft/部署草稿”和“返回游戏服务”，移除设备栏下方的全宽返回条。安装、手动登记、校验、更新、卸载、权限禁用和 Runtime Owner 调用均保持原参数与合同。
- 响应式与动效：`GameLibraryPage.css` 按真实 `runtime-manager` 容器宽度切换双栏/单列、折叠工具栏，并在手机宽度将返回按钮收成保留可访问名称的图标控件；主从卡片继续使用 Appearance 动效令牌，不新增 CSS 变量或设置。
- 设置与数据边界：使用当前主题、强调色、字体/字号、对比度、壁纸表面透明度/模糊，以及 `general.cardMotionEffect` 和减少动态效果映射；未改动用户偏好。运行时信息来自 Runtime Manager；Java 需求来自实例 `requiredJavaMajor`。浏览器仅切换过滤、搜索、详情和表单标签，没有触发 Java 安装、校验、更新、卸载、登记、文件选择或环境重新检测。
- 验证：`node --test apps/cli/tests/runtime-environment-master-detail.test.mjs` 3/3；`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm.cmd --filter lfaa-client-ui-layout run build` 通过；`pnpm.cmd run build:web` 通过（3907 个模块，产物写入根 `dist/apps/web/`）；`git diff --check` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。内置浏览器实际路由为 `/games/environments?target=57702d78-5f53-45cb-8193-51c87c5fa568&return=17e265c3-a9a8-419b-b43c-ae4592d2480d`：桌面视口 1750×1244 目视确认页头双返回按钮、Java 主从布局及记录内右对齐的复用操作；筛选“实例需求”只列 Java 11，搜索“Java 21”只列该版本，关联实例显示 `xiaoyu-e2e-paper1122-20261026` 要求 Java 11，安装/登记标签可达。390×520 检查确认页头按钮保留名称、详情/操作滚动可达、`documentElement.scrollWidth === clientWidth === 390`，Java 工作区未发现内部横向溢出；窄屏验收时临时收起覆盖主内容的右侧应用工具栏并已恢复，视口已重置。浏览器只记录到已有 Ant Design Modal `destroyOnClose` 弃用警告，没有触发运行时写操作。
- 未测边界：没有在真实手机设备、其他桌面主题/字体设置、离线 Daemon 或无可用 Java 记录的线上实例上做设备级实测；没有做帧时间性能采样。构建的既有 Vite 大 chunk 提示与本轮 Java 页面改动无关。
- 本轮变更文件：`packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx`（Java 列表、详情、筛选及操作）；`packages/client/ui-layout/src/GameLibraryPage.tsx`（返回目标映射与页头操作组）；`packages/client/ui-layout/src/GameLibraryPage.css`（Java 工作区及页头响应式样式）；`packages/client/ui-layout/README.md`（Owner 与布局合同）；`apps/cli/tests/runtime-environment-master-detail.test.mjs`（数据、操作位置、路由与响应式结构回归）；`docs/development/java-environment-master-detail-20261030.md`（本合同）；`docs/PROMPTS.md`（任务索引和验收状态）。
