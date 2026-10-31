# 左一导航浮卡最小宽与底部对齐

<a id="lfaa-global-feature-popover-bottom-anchor-20261031"></a>

## 用户目标与验收

- 左一“更多功能”、“个人账户”和“键盘快捷键”浮卡都按左二工作区最小宽度收敛，并垂直落到导航轨最底部的安全留白上。
- 浮卡贴齐左二栏起点，并在右侧为左二滚动条留出 12px；功能列表与快捷键内容在短屏时可滚动。
- 短屏下浮卡保持在屏幕内，顶部留出可见区域；功能列表和快捷键条目可滚动访问；无横向溢出。

## Owner、设置与范围

- 浮卡由 `packages/client/ui-sidebar/src/GlobalNavigationRail.tsx` 与同目录 CSS 持有；不迁移导航或菜单状态。
- 三张目标浮卡底边沿用导航轨自身的 `max(14px, env(safe-area-inset-bottom))` 底部留白；宽度由调用方传入的 Workbench 左栏最小宽减去 12px 滚动槽，并受视口限制。基础浮卡其余菜单的 84px 偏移不变。
- 不新增或修改设置中心配置、用户偏好、CSS 变量、数据或权限；外观沿用现有主题令牌。

## 批次与验收记录

### 批次 1：将浮卡垂直锚点移至导航轨底部

- 实施：移除功能浮卡 `top: 50%` 与 `translateY(-50%)` 的垂直居中；恢复基础浮卡的底部安全间距，并基于底部偏移和顶部 24px 余量收缩短屏最大高度。
- 定向回归：`pnpm exec node --test apps/cli/tests/client-global-navigation-feature-launcher.test.mjs`，3/3 通过，新增断言覆盖底部安全间距、去除居中变换与短屏高度收缩。
- 类型检查与构建：`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-sidebar run build`、`pnpm run build:web` 通过；Web 转换 3951 个模块，产物位于根 `dist/apps/web/`。`node scripts/runtime-build-state.mjs web` 返回 `[]`。
- 正式运行：按前序明确授权运行 `pnpm lfaa web`；`http://127.0.0.1:3000/api/health` 返回 `status=ok`、`persistence=ready`。重启后重新加载并验收了当前源码对应的 `/work` 页面。
- ChatGPT 内置浏览器桌面实页：`/work`，879×849。左二栏 x=64..264、宽 200px；浮卡 x=64..252、宽 188px，纵向 y=375..765；浮卡距导航轨底部 84px，左二栏可见且保留 12px 外侧槽，未横向溢出。菜单保持打开，左二栏已恢复为验收前的展开状态。
- ChatGPT 内置浏览器短屏实页：同一路由 390×400。浮卡 x=48、宽 188px、y=24..316；顶部余量 24px，底部余量 84px。标题与搜索框可见，功能列表 `scrollHeight=241px`、`clientHeight=179px` 且可滚动；文档宽度等于视口 390px。验收后恢复浏览器默认视口。
- Impeccable 布局扫描：`impeccable.cmd detect --json --scope layout packages/client/ui-sidebar/src/GlobalNavigationRail.css` 返回 `[]`。
- 设置与外观：未新增或修改设置项、CSS 变量、用户偏好或主题；批次 1 首次实现沿用全局浮卡 84px 底部间距，批次 2 按反馈让本功能对齐导航轨底部 14px/安全区留白，其他浮卡仍沿用 84px；左栏最小宽与主题令牌不变。
- 性能、安全与维护：本次仅改变 CSS 定位/可用高度和对应回归断言，无新增请求、订阅、监听器、计时器或数据写入；菜单项在有限列表区域内滚动，认证/权限链未改。未测真实设备、Electron 宿主和帧时间。
- 差异空白检查：本轮改动文件 `git diff --check` 通过；全仓已有 Minecraft 文件尾随空格与本轮无关，未改动。

### 批次 2：按用户反馈继续下移到最底部

- 实施目标：功能浮卡底边从首批实测的 84px 间距继续下移，改为与导航轨自身的 14px/安全区底部留白对齐；顶部空间和短屏高度收缩继续由短屏布局公式保证。
- 实施：功能浮卡覆盖基础浮卡的 84px 间距，改为 `max(14px, env(safe-area-inset-bottom, 0px))`；短屏最大高度根据同一底部留白和顶部 24px 计算。
- 定向回归：`pnpm exec node --test apps/cli/tests/client-global-navigation-feature-launcher.test.mjs`，3/3 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`git diff --check` 通过。
- 构建与正式运行：`pnpm --filter lfaa-client-ui-sidebar run build`、`pnpm run build:web` 通过（Web 3951 个模块）；构建前后 Web 指纹均为 `[]`。按前序明确授权安全重启，健康端点返回 `status=ok`、`persistence=ready`。
- ChatGPT 内置浏览器桌面实页：`/work`，879×849。左二栏宽 200px 且可见；浮卡 x=64..252、宽 188px，y=445..835，距导航轨底部 14px，无横向溢出。最终截图中浮卡在左二栏最底部，左二栏保持展开。
- ChatGPT 内置浏览器短屏实页：`/work`，390×300。浮卡 x=48..236、宽 188px，y=24..286；顶部留白 24px、底部留白 14px。搜索框可见；菜单列表 `scrollHeight=241px`、`clientHeight=149px` 且可滚动；文档宽度为 390px。
- Impeccable 布局扫描：`impeccable.cmd detect --json --scope layout packages/client/ui-sidebar/src/GlobalNavigationRail.css` 返回 `[]`。
- 设置与性能：不新增设置、CSS 变量、请求、订阅、监听器、计时器或数据写入；沿用现有 Workbench 最小栏宽及主题令牌。
- 未测边界：真实移动设备、Electron 宿主及浏览器帧时间未测。

### 批次 3：让个人账户浮卡沿用相同几何

- 实施目标：账户菜单宽度从通用 236px 调整为 Workbench 左栏最小宽扣除 12px 滚动槽后的宽度；左对齐左二栏起点，底边对齐导航轨 14px/安全区留白。
- 实施：功能菜单和账户菜单共用 Workbench 最小栏宽减去 12px 滚动槽的宽度计算；账户菜单单独覆盖定位，左边缘贴左二起点，底边贴导航轨 14px/安全区留白。设置中心、退出登录按钮行为保持原样。
- 定向回归：`pnpm exec node --test apps/cli/tests/client-global-navigation-feature-launcher.test.mjs`，3/3 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；本轮 `git diff --check` 通过。
- 构建与正式运行：`pnpm --filter lfaa-client-ui-sidebar run build`、`pnpm run build:control-plane`、`pnpm run build:web` 通过（Web 3951 个模块）。Host 构建首次因源码指纹在构建期间变化而退出，重跑成功；最终 `node scripts/runtime-build-state.mjs web` 为 `[]`。`pnpm lfaa web` 重启完成，健康端点返回 `status=ok`、`persistence=ready`。
- ChatGPT 内置浏览器桌面实页：`/work`，约 878×849。账户浮卡与左二栏起点对齐，宽 188px，底边距导航轨约 14px；用户名、角色、设置和退出登录项都可见，左二栏保持展开。最终截图已在内置浏览器中捕获并保留。
- ChatGPT 内置浏览器短屏实页：`/work`，390×300。账户浮卡宽 188px，底边距 14px；卡片与用户名、角色、设置和退出登录项均可见，页面没有横向溢出。验收后恢复默认视口并恢复左二栏展开状态。
- Impeccable 布局扫描：`impeccable.cmd detect --json --scope layout packages/client/ui-sidebar/src/GlobalNavigationRail.tsx packages/client/ui-sidebar/src/GlobalNavigationRail.css` 返回 `[]`。
- 设置与性能：未新增或修改设置中心配置、CSS 变量、用户偏好、请求、订阅、监听器、计时器或数据写入；宽度直接使用 Workbench 最小栏配置，底边复用现有安全区与主题令牌。未测真实移动设备、Electron 宿主和浏览器帧时间。

### 批次 4：让键盘快捷键浮卡沿用相同几何

- 实施目标：快捷键菜单宽度、左边缘和底边位置与功能及账户浮卡一致；短屏内所有快捷键仍可访问。
- 实施：键盘快捷键卡复用 Workbench 最小栏宽减去 12px 滚动槽的宽度；左边缘贴齐左二栏起点，底边贴导航轨 `14px/安全区` 留白；沿用通用卡片的最大高度和纵向滚动。
- 定向回归与类型：`pnpm exec node --test apps/cli/tests/client-global-navigation-feature-launcher.test.mjs` 3/3 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；本轮 `git diff --check` 通过。
- 构建与正式运行：`pnpm --filter lfaa-client-ui-sidebar run build` 与 `pnpm run build:web` 通过，Web 转换 3951 个模块，输出位于根 `dist/apps/web/`；正式 Web 重启前后 `node scripts/runtime-build-state.mjs web` 均返回 `[]`；按前序授权使用 `pnpm lfaa web` 安全重启，健康端点为 `status=ok`、`persistence=ready`。
- ChatGPT 内置浏览器桌面实页：`/work`，1280×720。快捷键卡左边缘约 x=64，宽 188px，底边距导航轨约 14px，六条快捷键可见。
- ChatGPT 内置浏览器窄短屏实页：`/work`，390×300。快捷键卡 x=48..236、宽 188px，底边约 y=286（距视口底部 14px）；标题及六条快捷键均可见，页面未出现横向溢出。验收后恢复浏览器默认视口，卡片仍打开。
- Impeccable 布局扫描：`C:\Users\Administrator\.codex\skills\impeccable\scripts\impeccable.cmd detect --json --scope layout packages/client/ui-sidebar/src/GlobalNavigationRail.tsx packages/client/ui-sidebar/src/GlobalNavigationRail.css` 返回 `[]`。
- 设置与性能：复用现有 Workbench 左二栏最小宽、主题令牌和安全区；未新增或修改设置中心配置、CSS 变量、用户偏好、请求、订阅、监听器、计时器或数据写入。此次只调整浮卡定位及宽度，未测真实设备、Electron 宿主和浏览器帧时间。
