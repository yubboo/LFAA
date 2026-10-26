<a id="lfaa-minecraft-task-card-motion-20261026"></a>

# LFAA-MINECRAFT-TASK-CARD-MOTION-20261026：任务卡片列表入场间隔

## 目标、Owner 与设置

- 目标：将 Minecraft 任务列表卡片依次入场的间隔由 24ms 调整为规范范围内的 40ms，保留当前入场效果、顺序、时长和六项动画上限。
- 运行入口：Web/Desktop 共用 Client 的 `/games/minecraft/tasks` 页面。
- Owner：`packages/client/ui-theme/src/common.css` 拥有共享卡片动效；`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 仅标记任务列表与卡片；`packages/client/ui-layout/src/Workbench.tsx` 把账户设置映射到主题根节点。
- 设置审计：卡片效果由 `general.cardMotionEffect` 控制，默认 `fluid`；`appearance.advanced.reducedMotion` 默认 `system`，并遵循系统 `prefers-reduced-motion`。不新增配置、不改变用户偏好；主题、字体和字号继续由现有共享令牌负责。
- 数据与权限：纯呈现调整，不读取或写入 Minecraft 实例、任务记录、账户数据、权限或远端节点。

## 修改边界与验收条件

- 仅修改共享卡片样式、直接回归、共享主题 README 与本合同/索引；不得调整其他动效、布局或业务流程。
- 第二至第六张卡片依序以 40ms 间隔开始，最多六张卡片使用列表入场；动效仍只改变 `transform`/`opacity` 并服从用户或系统减少动态效果设置。
- 运行直接回归、Client 类型检查、共享主题包和 Web 构建、运行指纹与 `git diff --check`。
- ChatGPT 内置浏览器打开 `/games/minecraft/tasks`，核对桌面和窄分栏视口下卡片顺序/布局与设置映射；记录视口、真实交互、截图能力及未测范围。构建和源码回归不能代替实页验收。

## 实施与验证记录

- 共享卡片列表第二至第六项的间隔由 24ms 倍数改为 40ms 倍数（40/80/120/160/200ms）；每个效果持续时间和曲线未变，最大延后为 200ms，配合最长 420ms 的 `lift` 动画总时长不超过 620ms。动画仍只使用 `transform`/`opacity`，最多六项入场，无新增观察器、订阅、计时器或运行时数据。
- 设置：`general.cardMotionEffect` 当前为 `fluid`，`appearance.advanced.reducedMotion` 为 `system`；沿用原设置映射和系统媒体查询，没有写入或重置用户偏好。
- 定向回归：`node --test apps/cli/tests/client-card-motion.test.mjs`，2/2 通过；覆盖五档间隔、前六项上限、关键帧变换属性、用户动效选择及用户/系统减少动态分支。
- `pnpm.cmd --filter lfaa-client-ui-theme run build` 通过；Client TypeScript 检查通过；`pnpm.cmd run build` 完成 Harness 218 包、Web（3867 modules）、Control Plane 与 CLI 构建，所有产物位于仓库根 `dist/`。`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。
- 正式 Web 由当前 checkout 的 `pnpm.cmd lfaa web` 启动/安全重启，地址 `http://127.0.0.1:3000`；健康接口 `status=ok, persistence=ready`，实际页面路由 `/games/minecraft/tasks` 返回 HTTP 200。内置浏览器桌面视口 1312×1244，应用工具栏保持原有展开状态；任务标题、状态统计及两张已完成卡片均显示正常。计算样式读取到第一张卡 0ms、第二张卡 40ms，列表宽约 523px，无页面横向溢出。
- 同一内置浏览器临时设为 580×800，并临时收起应用工具侧栏以露出任务页，卡片宽约 338px，计算间隔仍为 0/40ms，页面宽度等于视口、无横向溢出。随后重置 viewport 并恢复应用工具栏展开；没有改动任务、实例、设置、偏好或其他数据。桌面与窄屏截图由内置浏览器直接捕获并显示在本轮验收记录中，没有本地导出路径。
- 性能证据：静态列表最多动画六项，每项错开 40ms，最长动画连同排队延迟为 620ms；没有新增持续工作。未做真实帧时间/掉帧测量；窄屏交互验收为只读，没有触发刷新、删除或任务操作。
- 文件职责：`packages/client/ui-theme/src/common.css`（共享卡片列表节奏）；`packages/client/ui-theme/README.md`（共享动效合同说明）；`apps/cli/tests/client-card-motion.test.mjs`（节奏、上限及偏好回归）；`docs/PROMPTS.md` 与本合同（任务边界及验收证据）。
