# 000089-20261118-1454-slider-particle-speed-and-bolt-shortcut

- 时间：2026-11-18 14:54:00 +08:00
- 任务：实现思考强度与粒子速度非线性联动（极高档位极速流动）、消除滑块右端空隙、将左上角闪电图标改为一键切换最高思考强度按钮

## 变更文件

- `M` [StepSliderPopover.tsx](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.tsx)
  - 根据档位比例计算非线性粒子速度倍率 `particleSpeed = 0.45 + Math.pow(ratio / 100, 1.6) * 5.05`（`低` `0.45x`、`高` `2.12x`、`极高` `5.50x`），动态缩放各粒子 `animationDuration` 与 `animationDelay`。
  - 修正 `fillWidth` 为 `max(1.68rem, calc((100% - 2.04rem) * ${ratio / 100} + 1.68rem))`，使最高档位填充条右端与白色圆形滑块精确贴合。
  - 将左上角闪电图标升级为 `<button>`，点击直接将思考强度切换至最高档（`options[options.length - 1]`），并在处于最高档时展示激活态。
- `M` [StepSliderPopover.module.css](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.module.css)
  - 调整 `.trackWrap` 内边距（`0.18rem`）、`.dotsRow` 内边距（`0 0.08rem`）与 `.dotBtn/.thumb` 尺寸（`1.52rem`），消除最高档位右侧空隙。
  - 增强 `sliderParticleTwinkle` 水平漂移与闪烁幅度，并新增 `.boltIconActive` 激活样式。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`540ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - `低` 档位：`data-particle-speed="0.45"`，首颗粒子周期 `6.22s`。
  - 点击左上角闪电按钮一键切至 `极高`：`data-particle-speed="5.50"`，首颗粒子周期 `0.51s`；`.fill.right`（`1196.84`）与白色 `.thumb.right`（`1195.58`）仅差 `1.26px` 圆角内缩，无右侧紫条空隙。
  - `高` 档位：`data-particle-speed="2.12"`，首颗粒子周期 `1.32s`。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
