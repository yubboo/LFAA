---
name: ui-measure
description: 量页面元素的真实位置与间距，判断四栏宽度、活动行图标与标签、会话列表缩进、浮层边界是否只差 1～2px。用户说「对不齐 / 差几像素 / 左边多了 / 圆点没对齐 / 四栏宽度不对」，或改完布局要给证据时使用。
---

# ui-measure

用来回答「到底差在哪、差多少」，而不是截一张图说「看起来还行」。

## 何时用

- 用户说对不齐、差几像素、缩进不对、圆点没居中、四栏宽度不对。
- 改完布局要给出可核对的证据，而不是主观判断。
- 怀疑是某个 CSS 变量、padding 还是容器宽度导致的偏移。

## 先选工具，两套浏览器不要混用

**内置浏览器（`browser_*`，默认用它）**：带登录态，和用户看到的一致。

```text
browser_navigate → browser_set_viewport（1440×900 / 1024×768 / 390×844）→ browser_evaluate 量 → browser_console 查报错
```

`browser_screenshot` 只看整体观感，**不能当对齐证据**：缩放、取整和 DPR 都会骗人。

**Chrome DevTools MCP（`mcp__chrome-devtools__*`）**：无头、隔离、没有登录态，只在需要 `get_css_styles`（层叠来源）、`list_network_requests`、`performance_start_trace` 时用。它要求 `pageId`：先 `list_pages` 拿 id，再传给 `evaluate_script`；需要登录态的页面不要用它下结论。

## 量的三个前提

1. 等布局稳定：先 `await document.fonts.ready`；动画没结束时量到的值不可信，必要时 `document.getAnimations().forEach((a) => a.finish())`。
2. 一律用 `getBoundingClientRect()` + `Math.round`，比较用 `Math.abs(a - b) <= 1`（子像素取整）。
3. **一次 evaluate 把所有要比较的元素一起返回**，分多次调用会因为滚动、悬停、动画导致前后状态不一致。

## 判定口径

| 检查 | 期望 | 允许误差 |
|---|---|---|
| 相邻两栏 | 前一栏 `left + width` = 后一栏 `left` | ≤ 1px |
| 同行图标与文字 | 图标 `right` + 间距 = 文字 `left` | ≤ 1px |
| 子行缩进 | 子行文字 `left` ≥ 父行文字 `left`（不许倒挂） | 0 |
| 浮层贴栏 | 左缘 = 栏左缘 + 2、右缘 = 栏右缘 − 12 | ≤ 1px |
| 会话状态标记 | 圆心与行首图标中线同 x | ≤ 0.5px |
| resize handle 压边 | 压住栏边界 2px | 属设计，不算错 |

四栏的固定叫法：**左一图标栏 rail → 左二会话项目栏 sidebar → 中间区域 workspace → 右侧栏 rightPane**，中间还有两条 `resizeHandle`。

## 交付格式

一段结论 + 一张表：

| 元素 | 期望 | 实际 | 差 |
|---|---|---|---|
| sidebar 右缘 / handle 左缘 | 259 | 257 | −2（压边设计） |

表后写修复落点：是哪个 CSS 变量、哪个 padding、还是容器宽度；不要只贴截图，也不要只说「看起来对齐了」。

需要落成脚本时写 `Python/<用途>.py`，图写 `shots/`：一次性的跑完当场删，判断以后还会再跑（四栏测量、裁图对照）才留下。

## 现成片段

按场景改选择器，直接跑：见 `references/recipes.md`（四栏、活动行、会话列表、浮层边界、CSS 变量取值、多视口复测）。

## 限制

- 无头 MCP 浏览器没有登录态，登录后的页面要用内置浏览器量。
- 滚动容器的 `scrollHeight` 与可视高度不是一回事，判断是否溢出要用 `scrollWidth > clientWidth`。
- 值来自真实渲染，换字体、换缩放、换主题都可能变；给出结论时注明视口与主题。