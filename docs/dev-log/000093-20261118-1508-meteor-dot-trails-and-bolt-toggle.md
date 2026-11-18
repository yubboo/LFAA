# 000093-20261118-1508-meteor-dot-trails-and-bolt-toggle

- 时间：2026-11-18 15:08:00 +08:00
- 任务：将滑块粒子调整为带柔和拖影的圆形微光流星（从右向左飘移、适中可辨速度），并将左上角闪电按钮升级为「更强推理强度」开/关切换器

## 变更文件

- `M` [StepSliderPopover.tsx](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.tsx)
  - 更新 `SLIDER_METEORS` 为 12 颗 `2px`–`3.5px` 圆形微光粒子，采用负值错峰 `animationDelay`（打开弹窗即可见满条分布），并将速度倍率调优为 `0.55 + Math.pow(ratio / 100, 1.3) * 1.45`（`低` `0.55x`、`高` `1.14x`、`极高` `2.00x`）。
  - 将左上角闪电按钮实现为真正的双向开关（`aria-pressed`）：非最高档时熄灭，点击开启 `极高` 并记录原档位；处于 `极高` 时点亮，再次点击关闭并恢复原档位；手动切换至其他档位时闪电自动熄灭。
- `M` [StepSliderPopover.module.css](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.module.css)
  - `.particle` 恢复圆形微光点并新增 `::after` 14px 渐隐右向拖影（`linear-gradient(90deg, rgb(255 255 255 / 0.45) 0%, transparent 100%)`），配合 `sliderMeteorShoot` 从右向左飞驰。
  - 新增 `.boltBtn`（默认熄灭态）与 `.boltBtnOn`（最高档点亮发光态）。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`506ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - `高` 档位：闪电按钮 `aria-pressed="false"`（熄灭态），`data-particle-speed="1.14"`，12 颗 `2px`–`3.5px` 圆形粒子带 `14px` 拖影伪元素，周期 `2.99s`–`3.78s`。
  - 点击闪电开启 `极高`：闪电按钮 `aria-pressed="true"`（点亮态），`data-particle-speed="2.00"`，周期 `1.7s`–`2.15s`，粒子分布清晰可见。
  - 再次点击闪电关闭：恢复至 `高` 档位，`aria-pressed="false"`（熄灭态）。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
