/**
 * 文件：DiscreteSlider.tsx
 * 作用：共享离散档位 Slider，供模型推理强度、质量档位、速度档位等 UI 复用。
 * 负责：点击、拖拽、Pointer Capture、键盘 Home/End/方向键、preview/commit 分离。
 * 不负责：业务持久化、模型语义、特效定义。
 * 状态归属：只拥有 pointerId / dragging 临时交互态；业务 value 由调用方持有。
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
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
  onPreview?: (index: number | null) => void;
  onCommit: (index: number) => void;
  onInteractionStart?: () => void;
}

export function DiscreteSlider({ ariaLabel, steps, valueIndex, disabled = false, effect, onPreview, onCommit, onInteractionStart }: DiscreteSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const safeIndex = Math.max(0, Math.min(Math.max(0, steps.length - 1), valueIndex));
  const progress = steps.length <= 1 ? 0 : (safeIndex / (steps.length - 1)) * 100;
  const current = steps[safeIndex];

  const indexAtClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track || steps.length <= 1) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    return Math.round(ratio * (steps.length - 1));
  };

  const commit = (index: number) => {
    if (disabled || !steps.length) return;
    const next = Math.max(0, Math.min(steps.length - 1, index));
    onPreview?.(next);
    onCommit(next);
    onPreview?.(null);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !steps.length) return;
    onInteractionStart?.();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onPreview?.(indexAtClientX(event.clientX));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    onPreview?.(indexAtClientX(event.clientX));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const next = indexAtClientX(event.clientX);
    pointerIdRef.current = null;
    setDragging(false);
    commit(next);
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
    commit(next);
  };

  return (
    <div
      ref={trackRef}
      className={`lfaa-discrete-slider${dragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
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
      onPointerUp={onPointerUp}
      onPointerCancel={() => { pointerIdRef.current = null; setDragging(false); onPreview?.(null); }}
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
