# LFAA 1.0 P1-A2：ApplicationWorkspace 应用导航面板抽取

<a id="lfaa-agent-app-rearchitecture-p1-a2-20261113"></a>

## 用户目标

继续按《LFAA-1.0架构与体验重构实施计划》的 P1 顺序拆分 `ApplicationWorkspace`。P1-A1 已完成纯类型/纯函数抽取；本批从 P1-A2 的 Sidebar/Header/Tab 视图中抽取边界明确的应用导航面板，保持页面显示、路由、应用打开和滚动恢复行为。

## 入口、Owner 与边界

- 入口：共享 Workbench 的 `/work` 与应用工作区导航区域；普通应用菜单仍由现有页面入口传入应用、区段和导航项。
- Owner：`ui-workspace` 继续装配工作区；组件只消费 `Workbench` 提供的 `ApplicationNavigationItem[]` 与路由回调。应用目录、真实路由、应用启动、Writing/Minecraft/SteamCMD/Connectivity 领域规则及数据 Owner 不迁移、不复制。
- 设置：无新增设置；当前导航面板不读写设置中心偏好。外观、主题和字体继续由现有上层容器提供。
- 数据与权限：不新增 API、订阅、计时器、存储、权限判断或领域数据访问；`onNavigate`、`onOpenApplication` 与 `onOpenGameFiles` 继续沿既有入口执行。

## 允许与禁止范围

- 允许将 `ApplicationNavigationPanel`、其最小视图属性合同及纯导航分组模型移至 `src/application-workspace/components/`，由 `ApplicationWorkspace` 继续传入同一属性；增加分组/回调定向回归，并同步更新包 README、本任务合同与 `docs/PROMPTS.md`。
- 禁止改动 DOM、可访问名称、文案、CSS、断点、导航项筛选/分组、Minecraft 区段判断、画布入口、Portal 挂载、滚动恢复 key、路由、调用顺序和公开包 API；不修复本批以外的产品 Bug，不重启未知服务，不操作用户数据或偏好。

## 可观察验收

1. 代码回归确认导航分组、活动项、路由优先级、应用打开回调与无路由应用回调映射与抽取前一致；组件只有原有滚动恢复 hook，无新增订阅或副作用。
2. `ui-workspace` 构建、Client 类型检查、直接相关回归、`check:workspace` 与差异检查通过。
3. 以当前 checkout 启动 Web，在 ChatGPT 内置浏览器实际检查 `/work` 桌面和窄/短视口；确认工作区导航可见、文档无横向溢出，并实际触发一个安全导航入口后返回。未执行的 Provider、Daemon、帧时间和其他设备验收明确记录。
4. 任务完成后记录所有真实改动文件及职责、使用设置和实际验证结果。

## 实施记录

- 状态：代码与当前源码页面检查完成；正式菜单运行树的最终验收仍待补齐。
- 实施：将 `ApplicationNavigationPanel` 与其最小属性合同迁入 `src/application-workspace/components/ApplicationNavigationPanel.tsx`；将纯应用/共享能力分组、活动项和选择回调模型迁入 `src/application-workspace/application-navigation-model.ts`。`ApplicationWorkspace.tsx` 只保留装配和传参，行数由 P1-A1 后的 2,939 降至 2,846（减少 93 行）。DOM、可访问名称、文案、CSS、应用项、导航顺序、路由、区段判断、Portal 和 `module-app-menu` 滚动恢复 key 保持原样；滚动恢复 Hook 仍由同一导航组件持有，没有新增订阅、请求、计时器或状态存储。
- 定向回归：`node --import tsx --import ./apps/cli/register-package-loader.mjs --import ./apps/cli/tests/isolated-test-environment.mjs --test --test-concurrency=2 apps/cli/tests/application-navigation-panel.test.mjs apps/cli/tests/application-workspace-pure-utils.test.mjs`，7/7 通过；其中新导航分组/活动项/回调回归 2/2，P1-A1 纯函数回归 5/5。
- 工程验证：`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run check:workspace`（226 包）、`git diff --check` 均通过。`impeccable detect --json` 对相关界面源码返回 `[]`。Web 候选构建 `pnpm --dir apps/web exec vite build --outDir ../../dist/.tmp/p1a2-web-candidate-20261113` 通过，转换 3,957 个模块；存在大于 500 kB 的 chunk 提示，产物仅位于根 `dist/.tmp/`。
- 当前源码实页：本轮从 checkout 启动 Vite 服务 `http://127.0.0.1:5173`，内置浏览器打开 `/games/minecraft/overview`（1280×720）；点击“管理”后实际进入 `/games/minecraft/instances`，管理分类及实例导航可见、活动项正确。1280×720 与 960×620 的 `documentElement.scrollWidth` 分别等于视口宽度（1280/960），导航面板宽 206px，无横向溢出。截图为本轮内置浏览器的桌面与窄短视口观察结果；无页面运行异常，仅见现存 Ant Design `Tooltip.overlayClassName` 弃用提示。验收没有打开/保存用户项目、修改设置或操作服务数据；本轮临时标签已关闭、视口已恢复，Vite 进程已停止。
- 正式运行边界：最终 `node scripts/runtime-build-state.mjs web` 返回 `["host","web"]`，正式 Host/Web 运行树均与当前源码指纹不一致。3000 端口现有服务归属未确认，因此没有覆盖构建产物或重启它；本次 Vite 当前源码实页能证明组件路由交互，不能代替正式菜单启动验收。
- 设置/性能/未测：未新增或写入设置；本组件没有新增配置读取。已静态核对生命周期与副作用数量未增加；未测真实 Provider、Daemon、桌面 WebView、手机实机、帧时间或性能指标，不宣称性能提升。正式 Host/Web 指纹对账和菜单服务实页待适当环境下补验。
- 本批文件职责：`ApplicationWorkspace.tsx` 保留组合层调用；`application-workspace/components/ApplicationNavigationPanel.tsx` 拥有导航视图与窄组件属性合同；`application-workspace/application-navigation-model.ts` 唯一生成导航分组和选择回调；`apps/cli/tests/application-navigation-panel.test.mjs` 覆盖分组、活动状态和路由/应用回调；`docs/harness-packages.json` 登记测试消费者；`packages/client/ui-workspace/README.md` 记录内部导航边界；本合同与 `docs/PROMPTS.md` 记录范围、证据和待验项。
