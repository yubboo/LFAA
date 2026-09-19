/**
 * 文件：workbench-interaction.config.ts
 * 作用：集中定义 Workbench 拖拽、吸附、反向释放与键盘缩放的交互参数，避免把手感数字散落在 TSX / CSS。
 * 负责：snap capture 比例、release hysteresis 规则、动画时长、键盘 resize 步长，以及 capture threshold 计算。
 * 不负责：左右栏 min/max 几何、React 状态、业务内容、具体 CSS 布局。
 * 状态归属：纯配置 / 纯函数，无运行时状态。
 * 对外接口：WORKBENCH_INTERACTION_TOKENS、normalizeSnapCaptureRatio、resolveSnapCaptureThreshold。
 * 关联文件：ResizableWorkbench.tsx、workbench-layout.config.ts、workbench.css、workbench-layout.types.ts。
 * 修改注意事项：
 * - 优先修改本文件变量调手感，不要在 Pointer 事件或 CSS 中新增同义魔法数字；
 * - captureRatio 越小越难误触收起，越大越容易吸附；默认 0.50 表示拖到 minWidth 的一半才正式捕获；
 * - 组件允许单独覆盖 captureRatio / duration，但工作台与 Settings 默认必须共用这里的统一值。
 */

interface ResponsiveScalarRule {
  ratio: number;
  floor: number;
  ceiling: number;
}

export const WORKBENCH_INTERACTION_TOKENS = Object.freeze({
  snap: {
    /**
     * 吸附捕获比例：正常侧栏到达 minWidth 后仍可继续临时缩窄；
     * 只有拖到 `minWidth × captureRatio` 才进入 snap capture。
     * 默认 0.50 = 到最小宽度的一半才吸附，降低误触收起概率。
     */
    captureRatio: 0.50,
    /** 防止极端覆盖值导致“几乎碰到 min 就吸附”或“必须拖到 0 才吸附”。 */
    captureRatioRange: { min: 0.15, max: 0.90 },
    /**
     * 已进入 snap capture 后，反向拖出必须超过 `min + releaseHysteresis` 才释放；
     * 使用响应式规则，避免不同窗口尺寸下手感差异过大。
     */
    releaseHysteresis: { ratio: 0.018, floor: 14, ceiling: 24 } satisfies ResponsiveScalarRule,
    /** 正式进入吸附预览（当前尺寸 -> 0）的短动画。 */
    captureDurationMs: 180,
    /** Pointer 不松手从吸附态反向拉出的短动画，结束后恢复 1:1 跟手。 */
    releaseDurationMs: 150,
    /** 非拖拽状态下普通展开/收起与“未达到 capture 阈值就松手恢复 min”的归位动画。 */
    settleDurationMs: 240,
  },
  keyboard: {
    /** 键盘方向键每次 Resize 的普通步长。 */
    stepPx: 12,
    /** Shift + 方向键每次 Resize 的加速步长。 */
    fastStepPx: 36,
  },
} as const);

export function normalizeSnapCaptureRatio(value: number): number {
  const range = WORKBENCH_INTERACTION_TOKENS.snap.captureRatioRange;
  if (!Number.isFinite(value)) return WORKBENCH_INTERACTION_TOKENS.snap.captureRatio;
  return Math.min(range.max, Math.max(range.min, value));
}

/**
 * 计算本次拖拽的正式吸附触发线。
 * 例如 minWidth=220、ratio=0.50，则 Pointer 可以继续把临时侧栏拖到 110px；
 * 到 110px 才进入 snap preview，110px 之前松手只会恢复到 220px，不会误收起。
 */
export function resolveSnapCaptureThreshold(minSize: number, captureRatio: number): number {
  const safeMin = Math.max(0, minSize);
  return Math.round(safeMin * normalizeSnapCaptureRatio(captureRatio));
}
