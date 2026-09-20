/**
 * 文件：ParticleStreamCanvas.tsx
 * 作用：使用单 Canvas 2D 绘制 reasoning 强力推理的轨道内星光粒子。
 * 负责：requestAnimationFrame 生命周期、DPR 清晰度、ResizeObserver、Palette Token、已填充区裁剪、星点/星芒 twinkle。
 * 不负责：业务开关、Provider reasoning 档位、Slider Pointer 算法或配置持久化。
 * 状态归属：动画时间与 Canvas 绘制状态仅存在于 Renderer 内部；不使用逐帧 React State。
 * 对外接口：ParticleStreamCanvas(props)。
 * 修改注意事项：Canvas 必须由 Slider rail clip host 约束；禁止重回 DOM keyframes，也禁止绘制箭头/长尾短线。
 */
import { useEffect, useRef } from "react";
import type { UiEffectDefinition, UiEffectVariant } from "./contracts";

interface ParticleStreamCanvasProps {
  effect: UiEffectDefinition;
  active: boolean;
  variant: UiEffectVariant;
}

const DEFAULT_STANDARD = ["#ffc1dc", "#f578ad", "#ea5a9d", "#df4b92"] as const;
const DEFAULT_EXTREME = ["#ffc1dc", "#f05aa6", "#9b5cff", "#5d2ecb"] as const;

function parseCssVarExpression(value: string) {
  const match = value.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/u);
  return match ? { token: match[1], fallback: match[2]?.trim() } : null;
}

function resolveCssColor(element: HTMLElement, value: string, fallback: string) {
  const parsed = parseCssVarExpression(value);
  if (!parsed) return value || fallback;
  const resolved = getComputedStyle(element).getPropertyValue(parsed.token).trim();
  return resolved || parsed.fallback || fallback;
}

function resolvePalette(element: HTMLElement, effect: UiEffectDefinition, variant: UiEffectVariant) {
  const defaults = variant === "extreme" ? DEFAULT_EXTREME : DEFAULT_STANDARD;
  const source = variant === "extreme" ? (effect.extremePalette ?? effect.palette) : effect.palette;
  return defaults.map((fallback, index) => resolveCssColor(element, source?.[index] ?? fallback, fallback));
}

function readSliderProgressRatio(canvas: HTMLCanvasElement) {
  const track = canvas.closest(".lfaa-discrete-slider");
  if (!(track instanceof HTMLElement)) return 1;
  const visual = track.style.getPropertyValue("--lfaa-slider-visual-progress").trim();
  const committed = track.style.getPropertyValue("--lfaa-slider-progress").trim();
  const raw = visual || committed;
  if (raw.endsWith("%")) {
    const value = Number.parseFloat(raw.slice(0, -1));
    if (Number.isFinite(value)) return Math.max(0, Math.min(1, value / 100));
  }
  return 1;
}

function particleLane(index: number) {
  return 0.2 + (((index * 37) % 61) / 100);
}

function particlePhase(index: number, count: number) {
  return ((index * 0.61803398875) % 1 + index / Math.max(1, count)) % 1;
}

function drawSparkle(context: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number, fill: string) {
  context.save();
  context.translate(x, y);
  context.globalAlpha = alpha;
  context.fillStyle = fill;
  context.beginPath();
  context.moveTo(0, -radius);
  context.quadraticCurveTo(radius * 0.18, -radius * 0.18, radius, 0);
  context.quadraticCurveTo(radius * 0.18, radius * 0.18, 0, radius);
  context.quadraticCurveTo(-radius * 0.18, radius * 0.18, -radius, 0);
  context.quadraticCurveTo(-radius * 0.18, -radius * 0.18, 0, -radius);
  context.closePath();
  context.fill();
  context.restore();
}

export function ParticleStreamCanvas({ effect, active, variant }: ParticleStreamCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const variantRef = useRef<UiEffectVariant>(variant);
  variantRef.current = variant;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let disposed = false;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const count = Math.max(6, Math.min(30, effect.particleCount ?? 18));
    const duration = Math.max(900, Math.min(5200, effect.durationMs ?? 2100));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      const nextWidth = Math.max(1, Math.round(width * dpr));
      const nextHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const clear = () => context.clearRect(0, 0, width, height);

    const draw = (now: number) => {
      if (disposed) return;
      clear();
      if (!active || motionQuery.matches) return;

      const progressRatio = readSliderProgressRatio(canvas);
      const clipWidth = Math.max(0, width * progressRatio);
      if (clipWidth <= 1) {
        frameId = window.requestAnimationFrame(draw);
        return;
      }

      const liveVariant = variantRef.current;
      const palette = resolvePalette(canvas, effect, liveVariant);
      const trackGradient = context.createLinearGradient(0, 0, Math.max(1, clipWidth), 0);
      trackGradient.addColorStop(0, palette[0]);
      trackGradient.addColorStop(0.34, palette[1]);
      trackGradient.addColorStop(0.68, palette[2]);
      trackGradient.addColorStop(1, palette[3]);

      context.save();
      context.beginPath();
      context.rect(0, 0, clipWidth, height);
      context.clip();
      context.shadowBlur = liveVariant === "extreme" ? 6 : 4.5;
      context.shadowColor = liveVariant === "extreme" ? palette[2] : palette[1];

      const cycle = now / duration;
      const travel = clipWidth + 10;
      for (let index = 0; index < count; index += 1) {
        const phase = (cycle + particlePhase(index, count)) % 1;
        const x = -5 + travel * phase;
        const lane = particleLane(index);
        const y = height * lane + Math.sin((phase * Math.PI * 2) + index * 0.73) * 0.45;
        const twinkle = 0.5 + 0.5 * Math.sin((now / 230) + index * 1.71);
        const edgeFade = Math.min(1, phase / 0.08, (1 - phase) / 0.12);
        const alpha = Math.max(0.12, Math.min(0.95, edgeFade * (0.34 + twinkle * 0.56)));
        const radius = 0.55 + (index % 4) * 0.16 + twinkle * 0.16;

        context.globalAlpha = alpha;
        context.fillStyle = index % 5 === 0 ? "rgba(255,255,255,.96)" : trackGradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();

        // 少量四向星芒只做闪烁，不带方向尾线；保持图六那种细小星光感。
        if (index % 6 === 0 && twinkle > 0.58) {
          const sparkleColor = index % 12 === 0 ? "rgba(255,255,255,.98)" : (palette[Math.floor((index / 6) % 4)] ?? palette[1]);
          drawSparkle(context, x, y, 1.25 + twinkle * 0.7, alpha * 0.82, sparkleColor);
        }
      }
      context.restore();
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      frameId = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const handleMotionChange = () => {
      window.cancelAnimationFrame(frameId);
      clear();
      if (active && !motionQuery.matches) frameId = window.requestAnimationFrame(draw);
    };
    motionQuery.addEventListener?.("change", handleMotionChange);

    if (active && !motionQuery.matches) frameId = window.requestAnimationFrame(draw);
    else clear();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      motionQuery.removeEventListener?.("change", handleMotionChange);
      clear();
    };
  }, [active, effect]);

  return <canvas ref={canvasRef} className="lfaa-ui-effect lfaa-ui-effect--particle-stream" data-active={active ? "true" : "false"} data-variant={variant} aria-hidden="true" />;
}
