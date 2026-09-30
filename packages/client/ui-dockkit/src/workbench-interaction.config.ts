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
 * - captureRatio 表示“Pointer 虚拟尺寸”的触发比例；视觉栏宽永远不会低于 minWidth。
 * - 默认 0.50 表示到达 minWidth 后继续向内超拖半个 minWidth，才正式捕获。
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
     * 吸附捕获比例：侧栏视觉宽度到达 minWidth 后保持不变；Pointer 仍可继续向内“超拖”。
     * 只有 Pointer 对应的虚拟尺寸到 `minWidth × captureRatio` 才进入 snap capture。
     * 默认 0.50 = 在 minWidth 位置继续向内拖半个 minWidth 的距离后才吸附。
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
    captureDurationMs: 260,
    /** Pointer 不松手从吸附态反向拉出的短动画，结束后恢复 1:1 跟手。 */
    releaseDurationMs: 220,
    /** 非拖拽状态下普通展开/收起与“未达到 capture 阈值就松手恢复 min”的归位动画。 */
    settleDurationMs: 320,
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
 * 例如 minWidth=220、ratio=0.50：侧栏视觉宽度到 220px 后固定不再变窄；
 * Pointer 继续向内超拖 110px（虚拟尺寸到 110px）才进入 snap preview。
 * 阈值前松手仍保持 220px，不会误收起。
 */
export function resolveSnapCaptureThreshold(minSize: number, captureRatio: number): number {
  const safeMin = Math.max(0, minSize);
  return Math.round(safeMin * normalizeSnapCaptureRatio(captureRatio));
}


export interface SnapDragFrameInput {
  /** Pointer 对应的原始/虚拟尺寸；允许低于 min，用于累计隐藏超拖。 */
  rawSize: number;
  /** 正常展开态最小视觉尺寸；capture 前视觉尺寸绝不能低于该值。 */
  minSize: number;
  /** 当前容器允许的最大尺寸。 */
  maxSize: number;
  /** 正式吸附触发线（Pointer 虚拟尺寸），不是视觉尺寸。 */
  captureThreshold: number;
  /** 上一帧是否已经进入 snap capture。 */
  snapped: boolean;
  /** 已 capture 后反向拖出需要越过 min 的额外距离。 */
  releaseHysteresis: number;
}

export interface SnapDragFrameResult {
  /** 夹在 0..max 的 Pointer 虚拟尺寸。 */
  rawSize: number;
  /** 用户真正看到的尺寸；capture 前始终夹在 min..max。 */
  visualSize: number;
  snapped: boolean;
  capturedThisFrame: boolean;
  releasedThisFrame: boolean;
}

/**
 * 统一解析一次吸附拖拽帧。
 *
 * 关键语义：
 * - `rawSize` 可以继续越过 min，用来累计“隐藏超拖距离”；
 * - `visualSize` 在 capture 前始终不低于 min，所以用户不会看到栏继续变窄；
 * - 到 captureThreshold 后才把 visualSize 切到 0，进入统一吸附动画；
 * - 已 capture 时反向越过 `min + releaseHysteresis` 才释放，继续复用既有丝滑展开。
 */
export function resolveSnapDragFrame(input: SnapDragFrameInput): SnapDragFrameResult {
  const safeMax = Math.max(0, input.maxSize);
  const safeMin = Math.min(Math.max(0, input.minSize), safeMax);
  const rawSize = Math.min(safeMax, Math.max(0, input.rawSize));
  let snapped = input.snapped;

  if (!snapped && rawSize <= input.captureThreshold) snapped = true;
  else if (snapped && rawSize >= safeMin + Math.max(0, input.releaseHysteresis)) snapped = false;

  return {
    rawSize,
    visualSize: snapped ? 0 : Math.min(safeMax, Math.max(safeMin, rawSize)),
    snapped,
    capturedThisFrame: !input.snapped && snapped,
    releasedThisFrame: input.snapped && !snapped,
  };
}
