# 000098-20261118-1539-draggable-slider-detent-and-dynamic-meteors

- 时间：2026-11-18 15:39:00 +08:00
- 任务：为推理强度滑块新增平滑拖拽与磁吸阈值感、最高档隐藏静态小白点，以及随强度动态增减的无规则流星粒子

## 变更文件

- `M` [StepSliderPopover.tsx](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.tsx)
  - 扩充 `SLIDER_METEORS` 至 18 颗含独立垂直漂移量（`--meteor-drift-y`）与周期的流星粒子，按强度动态控制显示数量：`visibleMeteorCount = Math.round(5 + (activeRatio / 100) * 11)`（`低` 5 颗、`高` 11 颗、`极高` 16 颗）。
  - 仅在非最高档（`!isMax`）且未选中档位（`idx !== safeIdx`）上渲染静态小白点 `.dotMark`；切换至最高档（闪电开启）后全部隐藏。
  - 新增 `onPointerDown` / `onPointerMove` / `onPointerUp` 指针捕获连续拖拽：拖动时填充条与手柄 60fps 跟手，跨过档位中心时触发磁吸阈值阻尼与微弹脉冲（`detentPulse`），松手平滑吸附回目标档位。
- `M` [StepSliderPopover.module.css](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.module.css)
  - 新增 `.trackDragging`（`cursor: grabbing` 且拖拽中关闭 `transition` 消除顿挫）、`.thumb` 绝对定位平滑过渡与 `.thumbDetent` 阈值微弹缩放。
  - 更新 `sliderMeteorShoot` 关键帧加入 `--meteor-drift-y` 垂直无规则浮动轨迹。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`629ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - `低` 档位：未选小白点 `2` 个，流星粒子 `5` 颗。
  - `高` 档位：未选小白点 `2` 个，流星粒子 `11` 颗。
  - 从 `高` 水平拖拽至 `极高`：平滑切换至 `极高`（闪电 `aria-pressed="true"`），静态小白点归 `0`，流星粒子增至 `16` 颗。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
