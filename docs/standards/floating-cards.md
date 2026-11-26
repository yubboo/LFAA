# 悬浮卡片规范（强制）

> 状态：已实施（2026-11-26 负责人确认「以后所有悬浮卡片都按账号卡片这套要求做，全部统一」）。
> 适用：任何从入口展开的悬浮层 —— 账号菜单、更多/应用菜单、项目与会话操作菜单、模型与推理选择、工作台标签菜单、设置里的下拉与气泡等。
> 基线实现：`packages/ui/layout/client/navigation/UserMenu.*` + `user-menu-geometry.ts`（几何单测 `packages/ui/layout/tests/user-menu-geometry.test.ts`）。
> 尺寸令牌：`@lfaa/ui-theme` 的 `client/tokens.css`（`--popover-*` 一组）。参照样张：`pnpm ui:shot --only=app-user-menu`。

悬浮卡片是「临时工具」，不是第二个页面。它必须**贴着入口出现、不越出所在栏、不压住别人的滚动条**，同样内容下尽量矮、尽量紧。账号卡片（204×292）就是这套要求的基准样张。

## 1. 宽度与锚点

- 卡片宽度跟随它所属的栏或触发元素，**不得盖住相邻栏的正文**。
- 贴着左二栏 / 右栏时用**不对称内缩**：左缘 = 栏左缘 + 2px（贴左边线），右缘 = 栏右缘 − 12px（滚动条 10px + 2px 间隙）。对应令牌 `--popover-edge` / `--popover-scrollbar-gutter`。
- 从图标栏条目展开、没有所属栏时：左缘 = 触发按钮右缘 + 8px，宽度按剩余空间夹紧，四周至少留 8px。
- 宽度上限 21.5rem（`--popover-max-width`）：栏比它宽也不放大，避免「栏越宽卡片越肥」。
- 左二栏收起或窄屏（≤767px）时回到独立浮层 / 底部抽屉，仍不得出视口。

## 2. 尺寸与密度

以账号卡片为基线（1500 窗口下 204×292）：

| 项 | 值 | 令牌 |
|---|---|---|
| 面板内边距 | 0.45rem | `--popover-padding` |
| 面板圆角 | 1rem | `--popover-radius` |
| 动作行高 | 1.9rem | `--popover-row-height` |
| 动作行字号 | 0.8rem | `--popover-row-font` |
| 行内图标 | 0.98rem | `--popover-icon` |
| 标题 / 副标题 | 0.82rem（600）/ 0.66rem（muted） | `--popover-title-font` / `--popover-subtitle-font` |

- 首屏目标：7 行动作 + 账号头 ≤ 300px 高（1829 窗口实测 292px，高宽比 1.16；参考产品约 1.19）。
- 行与行之间不加额外留白；分组之间用 1px 分隔线 + 0.08rem / 0.3rem 边距，**不给分组加卡片、边框、底色**（与设置中心同一条纪律）。
- 不靠放大圆角、加深阴影来「显得高级」；阴影与玻璃质感一律取主题令牌。

## 3. 圆角同心

- 卡片内所有嵌套控件的圆角必须**同心**：外圈圆角 = 内圈圆角 + 间隙。
  例：主题开关滑块 8.32px + 3px 间隙 = 轨道 11.32px。
- 同一张卡片里禁止混用「胶囊 + 方块」两套圆角语言。轨道是胶囊而滑块是方块时，四角间隙会比直边大一倍多，肉眼能直接看出滑块「浮」在外框里。
- 焦点轮廓（`outline`）用与外框相同的圆角，不另起一套。

## 4. 窄宽度降级（容器查询）

- 卡片自身 `container-type: inline-size`，按**内容盒**宽度逐级收缩，顺序固定：先撤辅助状态（如「暂未接入」）→ 再撤快捷键徽章 → 最后撤可选控件（如主题开关）。
- 文字一律单行 + 省略号；不允许折行把行高撑开。
- 头部放不下时，右侧控件换到第二行、与标题块**左对齐**；不得右漂浮成「悬空控件」。
- 极窄（内容盒 ≤112px）允许整块收起非必要控件，但入口本身要保留。

## 5. 视觉与主题

- 只消费 `@lfaa/ui-theme` 语义变量：底色 `--color-shell` + `--color-popover` 叠加 + `--glass-sheen`，阴影 `--color-menu-shadow`，描边 `--glass-border`。组件样式禁止写死颜色（`pnpm check` 的 `css-theme-literal` 会拦）。
- 深色 / 浅色必须成对可读；新增状态色回 `tokens.css` 成对定义，不在组件里写浅色覆盖。
- 层级用令牌不写死数字：`--z-popover` 高于 `--z-dialog`（见 [设置中心界面规范](settings-ui.md) §2 的层级说明）。

## 6. 交互与无障碍

- `createPortal` 到 `body`；打开时透明遮罩吃掉第一次点击，点外部 / Esc 关闭，Esc 关闭后焦点回到触发按钮。
- 语义按内容选：菜单 `role="menu"` + `menuitem`；单选用 `radiogroup` + `radio`（逐项 `aria-label`）；多档开关支持方向键 / Home / End。
- 展开前先量几何再显示（首帧就是最终位置），不要在打开过程中跳位。

## 7. 交付自检

1. 打开卡片：不出所属栏，且不压住栏内滚动条（右侧留 12px）。
2. 1829 / 1500 / 1440 / 1024 四档各看一遍：`scrollWidth − clientWidth = 0`，文字不折行。
3. 深浅两套主题目视：卡片是实底，不透出下层内容。
4. 控制台 0 报错；Esc 关闭并回焦触发按钮。
5. `pnpm ui:shot` 有对应任务，manifest 的 `consoleErrors` 为空。
6. 基线数字若调整，同轮更新本页与 `--popover-*` 令牌。

## 8. 现有浮层收敛清单

以下浮层在本规范之前实现，宽度 / 密度仍是旧口径。新建或改到这些文件时必须顺手收敛，不搞一次性大改：

- `packages/ui/layout/client/navigation/AppMenu.*`（图标栏「更多」菜单）：固定 `min(21.5rem, …)` 宽度、行高偏大。
- `packages/ui/layout/client/navigation/NavigationSidebar.module.css`：模式菜单、搜索浮层。
- `packages/ui/layout/client/navigation/GroupHeaderTools.tsx`：排序菜单。
- `packages/client/ui-chat/client/models/ModelReasoningPicker.tsx`、`ModelReasoningTrigger.tsx`。
- `packages/client/ui-chat/client/workbench/WorkbenchTabMenu.*`：标签页右键菜单。

已符合新基线的参照实现：`UserMenu.*`（几何 + 密度 + 容器查询）与 `ThemeModeQuickSwitch.*`（60×30 三档开关、同心圆角）。