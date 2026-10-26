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

- 待实施。
