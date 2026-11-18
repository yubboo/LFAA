# 000103-20261118-1604-lightning-only-fixed-meteors

- 时间：2026-11-18 16:04:00 +08:00
- 任务：将滑块流星粒子数量固定为恒定 `14` 颗，并调整为仅在闪电开启（最高思考强度）时触发流星粒子

## 变更文件

- `M` [StepSliderPopover.tsx](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.tsx)
  - 移除拖拽过程中随档位动态增减粒子数量的 `visibleMeteorCount`，改为仅在 `isMax`（闪电开启）时固定渲染 `14` 颗流星粒子；非最高档（`低` / `高`，闪电关闭）不渲染流星粒子，仅保留未选档位小白点。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`584ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - `低` 档位：闪电 `aria-pressed="false"`，流星粒子 `0` 颗，未选小白点 `2` 个。
  - `高` 档位：闪电 `aria-pressed="false"`，流星粒子 `0` 颗，未选小白点 `2` 个。
  - `极高` 档位（闪电开启）：闪电 `aria-pressed="true"`，流星粒子恒定 `14` 颗，小白点 `0` 个。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
