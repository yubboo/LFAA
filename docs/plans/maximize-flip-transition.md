# 方案：最大化/还原的平滑过渡（FLIP）

- 状态：待评审（负责人已口头选择「方案 1：FLIP/transform」）
- 关联：`packages/ui/layout/client/shell/WorkbenchShell.tsx`、`packages/ui/layout/client/shell/WorkbenchShell.module.css`
- 相关记录：DEV-000563（去白屏）、DEV-000564（纯 CSS 过渡两次失败）

## 1. 问题

最大化/还原目前是**瞬时切换**：不闪白，但很硬。纯 CSS 过渡两次都失败，原因是「轨道宽度」和「面板固定的 `--right-panel-width`」不在同一个插值节奏上——中心轨瞬间归零、右轨按 260ms 展开，中间就露出空白帧（实测最大化 2–3 帧、还原 1–5 帧）。

## 2. 目标

1. 最大化与还原都是 **260ms 的连续动画**，任何一帧都不能出现「两列合计宽度 < 内容宽」的空白；
2. 动画期间**不参与栅格布局**，避免列宽插值与面板宽度打架；
3. 两端布局（聊天区在左 / 预览区在左）都生效；
4. 动画期间聊天滚动位置不变（已有滚动记忆，不允许被动画触发的重排影响）。

## 3. 方案：FLIP

FLIP = First / Last / Invert / Play，先量前后位置，再用 `transform` 从「反位置」动画回「正位置」。动画只用 `transform`，不触发布局，因此不会出现空白帧。

### 步骤

1. **First（点击瞬间）**：在切换状态前，记录受影响元素的 `getBoundingClientRect()`：
   - 右侧面板容器 `[data-region="context-panel"]`；
   - 中间列 `main[data-region="workspace"]`（会话列）。
2. **Last（状态切换后）**：`requestAnimationFrame` 中再量一次矩形，计算 `dx = first.left - last.left`、`dw = first.width / last.width`。
3. **Invert**：给面板设置 `transform: translateX(${dx}px) scaleX(${dw})`、`transform-origin: left center`，并加 `will-change: transform`；同时显式设置 `transition: none`，确保这一帧是「跳回旧位置」。
4. **Play**：下一帧（第二个 rAF）去掉内联 transform 并设 `transition: transform 260ms var(--motion-ease-emphasized)`，让它动画回原位。
5. **清理**：`transitionend` 或 300ms 定时器兜底，移除内联样式与 `will-change`，避免影响后续拖拽。
6. **降级**：`prefers-reduced-motion: reduce` 或测量失败（矩形为 0）时直接瞬时切换——即当前行为。

### 关键约束

- `scaleX` 会让文字横向压缩。缓解：**动画期间给面板加一层 `data-flip="true"`**，内部主内容 `visibility: hidden`，只动画外壳背景与边框；动画结束后恢复可见。这样不会有文字被压扁的观感。（若评审更希望「看得见内容参与动画」，则退化为纯 `translate` + 宽度由 JS 逐帧写 `--right-pane-track`，见 §5。）
- 动画期间禁用指针事件，避免用户误点。
- 任何异常都必须回落到「瞬时切换」，不允许出现白屏或卡死。

## 4. 验证方法

用无头 Edge 采样，每 16ms 记录 `workspace.width`、`panel.width` 与两者合计：

1. 两种排版各切一次最大化、一次还原；
2. 断言：空白帧（合计 < 1100）为 **0**；
3. 断言：宽度序列至少有 6 个不同值（说明是连续动画而非跳变）；
4. 断言：动画结束后矩形与切换前一致（无残留位移）；
5. 断言：控制台 0 报错、聊天滚动位置不变。

## 5. 备选：JS 逐帧驱动宽度

不满足 `scaleX` 隐形内容的表现时，改用 `requestAnimationFrame` 在 260ms 内逐帧写 `--center-pane-track` / `--right-pane-track`（都是像素值）。优点：内容始终真实布局、无缩放；缺点：每帧触发一次栅格重排，长列表可能掉帧，需要实测。

## 6. 风险

| 风险 | 处理 |
|---|---|
| 动画期间重排导致滚动跳动 | 动画只改 transform；滚动记忆已独立生效 |
| 缩放导致文字变形 | 动画期间隐藏面板内容，只动画外壳 |
| Shell 文件已达 400 行上限 | FLIP 逻辑放独立 hook 文件（`use-pane-flip.ts`），Shell 只增加一次调用 |
| 快速连点 | 动画未结束再切换时先 `finish()` 收尾，再开始新一次 |

## 7. 不采用

- 纯 CSS 轨道过渡（已实测失败，见 DEV-000564）。
- 引入动画库（framer-motion 等）：为一次面板动效增加运行时依赖，收益不匹配。