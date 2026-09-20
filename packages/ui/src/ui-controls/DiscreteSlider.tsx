/**
 * 文件：DiscreteSlider.tsx
 * 作用：共享离散档位 Slider，供模型推理强度、质量档位、速度档位等 UI 复用。
 * 负责：连续 Pointer 跟手、离散 preview/commit、Pointer Capture、键盘 Home/End/方向键、白色 Thumb settle 动画。
 * 不负责：业务持久化、模型语义、特效定义。
 * 状态归属：只拥有 pointerId / dragging / DOM visual-progress 临时交互态；业务 value 由调用方持有。
 * 修改注意事项：Pointer Move 的连续像素位置直接写 CSS variable，避免每一像素都触发父业务 React 重渲染；业务 preview 只在离散 index 改变时通知。
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import "./discrete-slider.css";

export interface DiscreteSliderStep {
  id: string;
  label: string;
}

export interface DiscreteSliderProps {
  ariaLabel: string;
  steps: readonly DiscreteSliderStep[];
  valueIndex: number;
  disabled?: boolean;
  effect?: ReactNode;
  variant?: "standard" | "extreme";
  onPreview?: (index: number | null) => void;
  onCommit: (index: number) => void;
  onInteractionStart?: () => void;
}

const SETTLE_MS = 220;

export function DiscreteSlider({
  ariaLabel,
  steps,
  valueIndex,
  disabled = false,
  effect,
  variant = "standard",
  onPreview,
  onCommit,
  onInteractionStart,
}: DiscreteSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const previewIndexRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const safeIndex = Math.max(0, Math.min(Math.max(0, steps.length - 1), valueIndex));
  const progress = steps.length <= 1 ? 0 : (safeIndex / (steps.length - 1)) * 100;
  const current = steps[safeIndex];

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
  }, []);

  const ratioAtClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track || steps.length <= 1) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
  };

  const indexAtRatio = (ratio: number) => Math.round(ratio * Math.max(0, steps.length - 1));
  const progressAtIndex = (index: number) => steps.length <= 1 ? 0 : (index / (steps.length - 1)) * 100;

  const writeVisualProgress = (percent: number) => {
    trackRef.current?.style.setProperty("--lfaa-slider-visual-progress", `${Math.max(0, Math.min(100, percent))}%`);
  };

  const settleVisualProgress = (index: number) => {
    writeVisualProgress(progressAtIndex(index));
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      trackRef.current?.style.removeProperty("--lfaa-slider-visual-progress");
      settleTimerRef.current = null;
    }, SETTLE_MS + 40);
  };

  const preview = (index: number) => {
    if (previewIndexRef.current === index) return;
    previewIndexRef.current = index;
    onPreview?.(index);
  };

  const commit = (index: number) => {
    if (disabled || !steps.length) return;
    const next = Math.max(0, Math.min(steps.length - 1, index));
    previewIndexRef.current = next;
    onPreview?.(next);
    onCommit(next);
    previewIndexRef.current = null;
    onPreview?.(null);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !steps.length) return;
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    onInteractionStart?.();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const ratio = ratioAtClientX(event.clientX);
    writeVisualProgress(ratio * 100);
    preview(indexAtRatio(ratio));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const ratio = ratioAtClientX(event.clientX);
    writeVisualProgress(ratio * 100);
    preview(indexAtRatio(ratio));
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const ratio = ratioAtClientX(event.clientX);
    const next = cancelled ? safeIndex : indexAtRatio(ratio);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerIdRef.current = null;
    previewIndexRef.current = null;
    setDragging(false);
    settleVisualProgress(next);
    if (cancelled) onPreview?.(null);
    else commit(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !steps.length) return;
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, safeIndex - 1);
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(steps.length - 1, safeIndex + 1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = steps.length - 1;
    if (next === null) return;
    event.preventDefault();
    onInteractionStart?.();
    settleVisualProgress(next);
    commit(next);
  };

  return (
    <div
      ref={trackRef}
      className={`lfaa-discrete-slider${dragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
      data-variant={variant}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, steps.length - 1)}
      aria-valuenow={safeIndex}
      aria-valuetext={current?.label ?? ""}
      style={{ "--lfaa-slider-progress": `${progress}%` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finishPointer(event)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onKeyDown={onKeyDown}
    >
      <span className="lfaa-discrete-slider__rail" aria-hidden="true" />
      <span className="lfaa-discrete-slider__fill" aria-hidden="true" />
      {steps.map((step, index) => (
        <i
          key={step.id}
          className={`lfaa-discrete-slider__mark${index <= safeIndex ? " is-filled" : ""}`}
          style={{ left: `${steps.length <= 1 ? 0 : (index / (steps.length - 1)) * 100}%` }}
          aria-hidden="true"
        />
      ))}
      {effect}
      <span className="lfaa-discrete-slider__thumb" aria-hidden="true" />
    </div>
  );
}
