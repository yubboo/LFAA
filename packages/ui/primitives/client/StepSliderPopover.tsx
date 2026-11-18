// 提供可复用的离散档位滑块弹窗内容组件（如推理强度调节）：支持平滑拖拽与磁吸阈值、圆点点击、键盘调节、无规则流星粒子流及闪电极强开关。
import { useRef, useState } from "react";
import { IconBolt, IconChevronRight, IconRotateClockwise2 } from "@tabler/icons-react";
import { computeStepRatio, type StepSliderOption } from "../src/index";
import styles from "./StepSliderPopover.module.css";

// 18 颗错落分布的圆形微光流星（含独立垂直漂移量与周期），随强度档位动态增减数量
const SLIDER_METEORS: ReadonlyArray<{
  top: string;
  size: string;
  driftY: string;
  delaySec: number;
  durationSec: number;
}> = [
  { top: "18%", size: "2.2px", driftY: "-2.5px", delaySec: 0.15, durationSec: 3.5 },
  { top: "50%", size: "3.4px", driftY: "2px", delaySec: 0.65, durationSec: 4.1 },
  { top: "74%", size: "2.4px", driftY: "-2px", delaySec: 1.15, durationSec: 3.3 },
  { top: "33%", size: "2.8px", driftY: "3px", delaySec: 1.65, durationSec: 3.9 },
  { top: "63%", size: "3.5px", driftY: "-3px", delaySec: 2.15, durationSec: 4.3 },
  { top: "82%", size: "2px", driftY: "1.5px", delaySec: 2.65, durationSec: 3.4 },
  { top: "24%", size: "3px", driftY: "-1.5px", delaySec: 3.1, durationSec: 3.8 },
  { top: "57%", size: "2.5px", driftY: "2.5px", delaySec: 3.55, durationSec: 3.6 },
  { top: "42%", size: "3px", driftY: "-2.5px", delaySec: 0.45, durationSec: 4.0 },
  { top: "69%", size: "2.5px", driftY: "2px", delaySec: 1.35, durationSec: 3.55 },
  { top: "29%", size: "2px", driftY: "-3px", delaySec: 2.45, durationSec: 4.2 },
  { top: "77%", size: "3.2px", driftY: "1.8px", delaySec: 3.35, durationSec: 3.85 },
  { top: "15%", size: "2.4px", driftY: "2.8px", delaySec: 0.9, durationSec: 3.7 },
  { top: "46%", size: "2px", driftY: "-2.2px", delaySec: 1.9, durationSec: 3.45 },
  { top: "84%", size: "2.8px", driftY: "-1.8px", delaySec: 2.9, durationSec: 4.05 },
  { top: "38%", size: "3.2px", driftY: "2.2px", delaySec: 0.3, durationSec: 3.65 },
  { top: "60%", size: "2.2px", driftY: "-2.8px", delaySec: 1.5, durationSec: 4.15 },
  { top: "22%", size: "2.6px", driftY: "1.6px", delaySec: 2.75, durationSec: 3.75 },
];

/** 定义离散档位和当前选择，使滑块不依赖具体业务模型。 */
export interface StepSliderPopoverProps<T extends string = string> {
  options: Array<StepSliderOption<T>>;
  value: T;
  subtitle?: string;
  onSubtitleClick?: () => void;
  resetLabel?: string;
  onReset?: () => void;
  onChange: (nextValue: T) => void;
}

/** 把拖拽、点击和键盘输入转换为离散档位，并通过回调提交选择。 */
export function StepSliderPopover<T extends string = string>({
  options,
  value,
  subtitle,
  onSubtitleClick,
  resetLabel = "重设默认",
  onReset,
  onChange,
}: StepSliderPopoverProps<T>) {
  const safeIdx = Math.max(
    0,
    options.findIndex((item) => item.id === value),
  );
  const current = options[safeIdx] ?? options[0];
  const maxOption = options[options.length - 1];
  const fallbackNonMaxOption = options[Math.max(0, options.length - 2)] ?? options[0];
  const isMax = Boolean(maxOption && current?.id === maxOption.id && options.length > 1);
  const prevNonMaxRef = useRef<T | null>(null);
  if (!isMax && current) {
    prevNonMaxRef.current = current.id;
  }

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const [detentPulse, setDetentPulse] = useState(false);
  const lastDragIdxRef = useRef(safeIdx);

  const stepRatio = computeStepRatio(safeIdx, options.length);
  const activeRatio = dragRatio ?? stepRatio;
  const fillWidth =
    options.length <= 1
      ? "calc(100% - 0.36rem)"
      : `max(1.68rem, calc((100% - 2.04rem) * ${activeRatio / 100} + 1.68rem))`;
  // 思考强度越低流星越慢（0.55x），最高强度更快（2.00x）；粒子总数恒定为 14 颗，拖拽时不增减闪烁
  const particleSpeed = 0.55 + Math.pow(activeRatio / 100, 1.3) * 1.45;

  const computeDragState = (clientX: number) => {
    const el = trackRef.current;
    if (!el || options.length <= 1) return { pct: 100, nearestIdx: 0 };
    const rect = el.getBoundingClientRect();
    const usable = Math.max(1, rect.width - 28);
    const rawPct = ((clientX - rect.left - 14) / usable) * 100;
    const clampedPct = Math.max(0, Math.min(100, rawPct));
    const nearestIdx = Math.min(
      options.length - 1,
      Math.max(0, Math.round((clampedPct / 100) * (options.length - 1))),
    );
    // 磁吸阈值感：接近档位中心时轻微吸附，保留细腻手感
    const snapPct = (nearestIdx / (options.length - 1)) * 100;
    const dist = clampedPct - snapPct;
    const magneticPct = Math.abs(dist) < 5.5 ? snapPct + dist * 0.32 : clampedPct;
    return { pct: Math.max(0, Math.min(100, magneticPct)), nearestIdx };
  };

  return (
    <div className={styles.card}>
      <div className={styles.topBar}>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.boltBtn} ${isMax ? styles.boltBtnOn : ""}`}
          aria-pressed={isMax}
          aria-label={maxOption ? maxOption.label : undefined}
          title={maxOption ? maxOption.label : undefined}
          onClick={() => {
            if (!maxOption) return;
            if (isMax) {
              const restoreId =
                prevNonMaxRef.current && options.some((o) => o.id === prevNonMaxRef.current && o.id !== maxOption.id)
                  ? prevNonMaxRef.current
                  : fallbackNonMaxOption?.id;
              if (restoreId) onChange(restoreId);
            } else {
              if (current) prevNonMaxRef.current = current.id;
              onChange(maxOption.id);
            }
          }}
        >
          <IconBolt size={15} stroke={isMax ? 2.1 : 1.8} />
        </button>

        {onSubtitleClick ? (
          <button
            type="button"
            className={`${styles.centerMeta} ${styles.centerMetaInteractive}`}
            aria-label={subtitle ? `${current?.label ?? value} · ${subtitle}` : current?.label ?? value}
            onClick={onSubtitleClick}
          >
            <span className={styles.activeLabel}>{current?.label ?? value}</span>
            {subtitle && (
              <span className={styles.targetRow}>
                <span>{subtitle}</span>
                <IconChevronRight size={12} stroke={1.9} />
              </span>
            )}
          </button>
        ) : (
          <div className={styles.centerMeta}>
            <span className={styles.activeLabel}>{current?.label ?? value}</span>
            {subtitle && (
              <span className={styles.targetRow}>
                <span>{subtitle}</span>
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          className={styles.iconBtn}
          aria-label={resetLabel}
          title={resetLabel}
          onClick={onReset}
        >
          <IconRotateClockwise2 size={15} stroke={1.8} />
        </button>
      </div>

      <div
        ref={trackRef}
        className={`${styles.trackWrap} ${dragRatio !== null ? styles.trackDragging : ""}`}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, options.length - 1)}
        aria-valuenow={safeIdx}
        aria-valuetext={current?.label ?? value}
        onPointerDown={(event) => {
          if (event.button !== 0 || options.length <= 1) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          lastDragIdxRef.current = safeIdx;
          const { pct, nearestIdx } = computeDragState(event.clientX);
          setDragRatio(pct);
          if (nearestIdx !== safeIdx) {
            lastDragIdxRef.current = nearestIdx;
            const next = options[nearestIdx];
            if (next) onChange(next.id);
          }
        }}
        onPointerMove={(event) => {
          if (dragRatio === null) return;
          const { pct, nearestIdx } = computeDragState(event.clientX);
          setDragRatio(pct);
          if (nearestIdx !== lastDragIdxRef.current) {
            lastDragIdxRef.current = nearestIdx;
            setDetentPulse(true);
            window.setTimeout(() => setDetentPulse(false), 140);
            const next = options[nearestIdx];
            if (next) onChange(next.id);
          }
        }}
        onPointerUp={(event) => {
          if (dragRatio === null) return;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setDragRatio(null);
        }}
        onPointerCancel={() => setDragRatio(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            const next = options[Math.min(options.length - 1, safeIdx + 1)];
            if (next) onChange(next.id);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            const prev = options[Math.max(0, safeIdx - 1)];
            if (prev) onChange(prev.id);
          }
        }}
      >
        <div className={styles.fill} style={{ width: fillWidth }} data-particle-speed={particleSpeed.toFixed(2)}>
          {isMax && SLIDER_METEORS.slice(0, 14).map((m, idx) => (
            <span
              key={idx}
              className={styles.particle}
              style={{
                top: m.top,
                width: m.size,
                height: m.size,
                ["--meteor-drift-y" as string]: m.driftY,
                animationDelay: `-${(m.delaySec / particleSpeed).toFixed(2)}s`,
                animationDuration: `${(m.durationSec / particleSpeed).toFixed(2)}s`,
              }}
            />
          ))}
        </div>
        <div className={styles.dotsRow}>
          {options.map((opt, idx) => {
            const showDot = !isMax && idx !== safeIdx;
            return (
              <button
                key={opt.id}
                type="button"
                className={styles.dotBtn}
                aria-label={opt.label}
                title={opt.label}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(opt.id);
                }}
              >
                {showDot && <span className={styles.dotMark} />}
              </button>
            );
          })}
        </div>
        <span
          className={`${styles.thumb} ${detentPulse ? styles.thumbDetent : ""}`}
          style={{
            left:
              options.length <= 1
                ? "calc(100% - 1.7rem)"
                : `calc((100% - 1.88rem) * ${activeRatio / 100} + 0.18rem)`,
          }}
        />
      </div>
    </div>
  );
}
