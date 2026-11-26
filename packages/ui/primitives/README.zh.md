---
description: "LFAA 共享交互基础 UI 原语包：统一封装居中弹窗（ModalDialog）、浮层卡片（PopoverCard）、步进滑块弹窗（StepSliderPopover）、强调色滚动容器（ScrollArea）及统一样式动效。"
kind: "package"
---

# @lfaa/ui-primitives

[English](README.md) | 中文

## 摘要

LFAA 共享交互基础 UI 原语包：统一封装居中弹窗（ModalDialog）、浮层卡片（PopoverCard）、步进滑块弹窗（StepSliderPopover）、强调色滚动容器（ScrollArea）及统一样式动效。

本包位于 `packages/ui/primitives`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./contract` | `./lib/types/contract/index.js` | 公开契约，无 Node 或 DOM 依赖 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

无 workspace 依赖。

## 开发说明

共享的展开/收起交互，任何面板都可直接复用（现存用例：`packages/ui/layout` 的左右两栏）。两件套都消费 `@lfaa/ui-theme` 的动效令牌，开启「减少动态效果」时自动归零。

- `PanelToggleButton`：可访问的展开/收起按钮。分栏线随状态滑动并淡出；`side="right"` 复用同一图形整体镜像，左右两栏不必各写一份。

  ```tsx
  <PanelToggleButton side="left" expanded={open} label={open ? collapseLabel : expandLabel} onClick={toggle} />
  ```

- `CollapsePane`（配合 `usePanePresence`）：收起时保留面板到过渡结束再卸载，把溢出内容裁掉而不是挤压重排，收起的瞬间标记 `inert` / `aria-hidden`。容器宽度动画由调用方负责（Shell 动画的是栅格轨道），它只管挂载保持与裁剪。

  ```tsx
  <CollapsePane open={open} side="left" className={styles.leftPane}>{children}</CollapsePane>
  ```

- `CapsuleBar`：共享的头部胶囊外壳。左二栏头部与中间区顶栏都把各自的动作组放进同一个壳里，圆角、描边、底色、阴影与 `--capsule-*` 尺寸只在这里定义一次；调用方只覆盖 `--capsule-height` / `--capsule-gap` / `--capsule-padding` 这类栏位差异。

  ```tsx
  <CapsuleBar className={styles.barCapsule}>{leftGroup}{rightGroup}</CapsuleBar>
  ```

各断点可用 `--panel-toggle-size`、`--panel-toggle-radius` 覆盖尺寸，默认是 2rem 方块。

## 滚动容器

`ScrollArea` 是工作台各栏、弹窗与列表统一使用的滚动视口。它把浏览器默认的灰轨道换成透明轨道，只画一条内嵌的圆角强调色胶囊滑块：静止时是强调色混入弱化文字色，滚动中或指针压上去会加深到更接近强调色。两种颜色都来自 `@lfaa/ui-theme` 令牌（`--color-scrollbar-thumb`、`--color-scrollbar-thumb-hover`），所以在设置里换强调色，所有滚动条一起跟着变。

```tsx
<ScrollArea stableGutter className={styles.panelBody} ref={bodyRef}>
  {children}
</ScrollArea>
```

- `axis="y" | "x" | "both"` 声明默认滚动方向；默认值写在 `:where()` 里，调用方的类仍可在断点处覆盖方向（如设置目录在手机上改成横向滚动）。
- `stableGutter` 常驻 `scrollbar-gutter: stable`，长页面出现滚动条时内容不再左右抖动。
- `ref` 指向滚动视口本身，调用方可直接读写 `scrollTop`。
- Chromium 与 Safari 走 `::-webkit-scrollbar`；Firefox 在 `@supports not selector(::-webkit-scrollbar)` 里使用 `scrollbar-width` / `scrollbar-color`——这两个标准属性一旦在 Chromium 生效，会直接关掉上面的自定义滑块。

## 设置页骨架

设置页本质是配置清单，不是排版作品，所以骨架只做一份、页面只做组合（规范见 `docs/standards/settings-ui.md`）。

| 组件 | 职责 |
|---|---|
| `SettingsPage` | 页外壳：标题、可选说明、可选页级 `actions`，以及分组之间的纵向节奏。 |
| `SettingGroup` | 带标题的分组，可选说明；不加边框、底色、圆角、阴影，分组只靠留白区分。 |
| `SettingRow` | 一行一项：名称与说明在左，控件在右并右对齐。 |
| `SettingSwitch` / `SettingSegmented` / `SettingSelect` / `SettingMultiSelect` | 布尔、短枚举、可搜索长枚举、多选四种控件。 |
| `SettingFormField` / `SettingFormBlock` / `SettingFormActions` | 上下排表单布局（标签在上、控件在下），顺序填写的表单只用它，不套行式布局。 |
| `SettingDangerGroup` | 删除 / 清空 / 重置类动作，固定放页面最末并用危险色。 |

`settingsStyles` 合并排版层（`SettingsSurface.module.css`）与控件层（`SettingsControls.module.css`），页面仍然只导入一个 class 映射即可拿到输入框、按钮与只读值样式。

## Base UI 交互原语

基于无头组件库 `@base-ui/react` 与 CSS Modules + `@lfaa/ui-theme` 双主题语义变量封装（零 Tailwind）：

- `DropdownMenu`（`DropdownMenuItem`、`DropdownMenuCheckboxItem`、`DropdownMenuSeparator`）：自动视口防溢出定位、键盘导航与焦点恢复的下拉菜单。
- `UiSwitch`：双主题触感开关。
- `UiSelect`：支持键盘导航与防溢出定位的下拉选择器。
- `UiTabs`：带平滑指示条与方向键切换的分段标签。
- `UiTooltip`：悬停防抖与自动避障定位的轻量提示。
- `HoverTip`：用于紧凑工具栏的提示胶囊，只淡入不位移，避免分数像素下的动作行视觉抖动。
