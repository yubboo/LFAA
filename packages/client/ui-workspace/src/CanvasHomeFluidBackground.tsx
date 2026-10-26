import { useEffect, useRef, useState } from "react";

type ReducedMotion = "system" | "on" | "off";

export interface CanvasHomeFluidBackgroundProps {
  accentColor: string;
  reducedMotion: ReducedMotion;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

/*
 * Original LFAA flow field: layered analytic wave interference bends a dark
 * accent-colored surface. It deliberately does not import or port an upstream
 * shader or image asset.
 */
const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform vec3 u_accent;
uniform float u_phase;
uniform vec2 u_pointer;
uniform float u_pointer_active;
uniform float u_ripple_age;
varying vec2 v_uv;

vec2 bendSurface(vec2 p, float phase) {
  float sweep = sin(p.y * 1.55 + phase * 0.50 + cos(p.x * 1.10 - phase * 0.25) * 0.72);
  float returnFlow = cos(p.x * 1.42 - phase * 0.375 + sin(p.y * 1.32 + phase * 0.25) * 0.76);
  vec2 q = p + vec2(sweep, returnFlow) * 0.27;
  float crossCurrent = sin((q.x - q.y) * 1.18 + phase * 0.75);
  return q + vec2(crossCurrent, -crossCurrent) * 0.105;
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * vec2(aspect, 1.0);
  vec2 q = bendSurface(p, u_phase);

  float sweepPhase = q.x * 1.16 + q.y * 0.22 + u_phase * 0.24;
  float returnPhase = q.y * 1.20 - q.x * 0.30 - u_phase * 0.19;
  float eddyPhase = (q.x - q.y * 0.52) * 0.82
    + sin((q.x + q.y) * 0.60 + u_phase * 0.14) * 0.95 + u_phase * 0.10;
  float sweepHeight = sin(sweepPhase);
  float returnHeight = cos(returnPhase);
  float eddyHeight = sin(eddyPhase);
  float height = sweepHeight * 0.42 + returnHeight * 0.36 + eddyHeight * 0.22;
  float eddyBend = cos((q.x + q.y) * 0.60 + u_phase * 0.14) * 0.57;
  vec2 slope = vec2(
    cos(sweepPhase) * 1.16 * 0.42 + sin(returnPhase) * 0.30 * 0.36 + cos(eddyPhase) * (0.82 + eddyBend) * 0.22,
    cos(sweepPhase) * 0.22 * 0.42 - sin(returnPhase) * 1.20 * 0.36 + cos(eddyPhase) * (-0.426 + eddyBend) * 0.22
  );
  vec3 normal = normalize(vec3(-slope * 0.82, 1.0));
  vec3 keyLight = normalize(vec3(-0.44, 0.62, 0.78));
  float reflection = pow(max(0.0, dot(normal, keyLight)), 11.0);
  float basin = smoothstep(-0.60, 0.06, height) * (1.0 - smoothstep(0.44, 0.96, height));
  float caustic = pow(max(0.0, sin(height * 9.2 + q.x * 1.08 - q.y * 0.72 + u_phase * 0.11)), 8.0)
    * smoothstep(-0.18, 0.74, height);

  vec2 pointerPoint = (u_pointer - 0.5) * vec2(aspect, 1.0);
  float pointerDistance = length(p - pointerPoint);
  float wake = exp(-pointerDistance * pointerDistance * 3.0) * u_pointer_active;
  float ring = 0.0;
  if (u_ripple_age >= 0.0 && u_ripple_age < 2.8) {
    float radius = u_ripple_age * 0.22;
    float ringDistance = abs(pointerDistance - radius);
    ring = exp(-ringDistance * ringDistance * 720.0) * exp(-u_ripple_age * 1.05);
  }

  float edge = 1.0 - smoothstep(0.18, 0.94, length((v_uv - 0.5) * vec2(0.90, 1.04)));
  float hueShift = clamp(0.30 + height * 0.38 + basin * 0.16 + reflection * 0.34, 0.0, 1.0);
  vec3 deepTone = u_accent * 0.48;
  vec3 luminousTone = mix(u_accent, vec3(1.0), 0.50);
  vec3 coolTone = mix(u_accent, u_accent.bgr, 0.18);
  vec3 fluidColor = mix(deepTone, luminousTone, hueShift);
  fluidColor = mix(fluidColor, coolTone, clamp((q.x + 0.6) * 0.20, 0.0, 0.28));

  float glow = 0.08 + basin * 0.11 + reflection * 0.24 + caustic * 0.17 + wake * 0.13 + ring * 0.42;
  vec3 light = fluidColor * (0.22 + basin * 0.38 + reflection * 0.88 + caustic * 0.42);
  light += vec3(1.0) * (reflection * 0.30 + caustic * 0.22 + ring * 0.16);
  gl_FragColor = vec4(light, clamp(glow * edge, 0.0, 0.62));
}`;

function parseAccent(value: string): [number, number, number] {
  const input = value.trim();
  const hex = input.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu)?.[1];
  if (hex) {
    const normalized = hex.length <= 4 ? [...hex].slice(0, 3).map(part => part + part).join("") : hex.slice(0, 6);
    return [0, 2, 4].map(index => Number.parseInt(normalized.slice(index, index + 2), 16) / 255) as [number, number, number];
  }

  const rgb = input.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/iu);
  if (rgb) return [1, 2, 3].map(index => Math.min(255, Number(rgb[index])) / 255) as [number, number, number];
  return [52 / 255, 87 / 255, 213 / 255];
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

export function CanvasHomeFluidBackground({ accentColor, reducedMotion }: CanvasHomeFluidBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = canvas?.parentElement;
    const home = canvas?.closest<HTMLElement>(".lfaa-cnv-home");
    if (!canvas || !surface || !home) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      premultipliedAlpha: false,
      stencil: false,
    });
    if (!gl) {
      canvas.dataset.fluidMode = "css";
      return;
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      canvas.dataset.fluidMode = "css";
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      canvas.dataset.fluidMode = "css";
      return;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      canvas.dataset.fluidMode = "css";
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      canvas.dataset.fluidMode = "css";
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolutionUniform = gl.getUniformLocation(program, "u_resolution");
    const accentUniform = gl.getUniformLocation(program, "u_accent");
    const phaseUniform = gl.getUniformLocation(program, "u_phase");
    const pointerUniform = gl.getUniformLocation(program, "u_pointer");
    const pointerActiveUniform = gl.getUniformLocation(program, "u_pointer_active");
    const rippleAgeUniform = gl.getUniformLocation(program, "u_ripple_age");
    const accent = parseAccent(accentColor);
    let rafId = 0;
    let elapsed = 0;
    let lastFrame = 0;
    let pointer: [number, number] = [0.5, 0.5];
    let pointerActive = 0;
    let rippleStartedAt = -1;
    let disposed = false;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    const motionSuppressed = () => reducedMotion === "on" || (reducedMotion === "system" && motionPreference.matches);
    const paint = (now: number, deltaSeconds = 0) => {
      elapsed += Math.min(deltaSeconds, 0.05);
      const phase = (elapsed * 0.22) % (Math.PI * 4);
      const rippleAge = rippleStartedAt < 0 ? -1 : (now - rippleStartedAt) / 1000;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (resolutionUniform) gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
      if (accentUniform) gl.uniform3f(accentUniform, accent[0], accent[1], accent[2]);
      if (phaseUniform) gl.uniform1f(phaseUniform, phase);
      if (pointerUniform) gl.uniform2f(pointerUniform, pointer[0], pointer[1]);
      if (pointerActiveUniform) gl.uniform1f(pointerActiveUniform, pointerActive);
      if (rippleAgeUniform) gl.uniform1f(rippleAgeUniform, rippleAge < 2.8 ? rippleAge : -1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const stop = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      lastFrame = 0;
    };
    const tick = (now: number) => {
      rafId = 0;
      if (disposed || document.visibilityState === "hidden" || motionSuppressed()) return;
      const delta = lastFrame ? Math.max(0, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      paint(now, delta);
      rafId = window.requestAnimationFrame(tick);
    };
    const syncMotion = () => {
      stop();
      paint(performance.now());
      if (!disposed && document.visibilityState !== "hidden" && !motionSuppressed()) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      const rect = surface.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const preferredScale = Math.min(window.devicePixelRatio || 1, width < 640 ? 1.12 : 1.32);
      const pixelBudgetScale = Math.sqrt(1_250_000 / (width * height));
      const scale = Math.min(preferredScale, pixelBudgetScale);
      const nextWidth = Math.max(1, Math.round(width * scale));
      const nextHeight = Math.max(1, Math.round(height * scale));
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      paint(performance.now());
    });
    const onPointerMove = (event: PointerEvent) => {
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer = [
        Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      ];
      pointerActive = 1;
    };
    const onPointerLeave = () => { pointerActive = 0; };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button, a, input, textarea, select, [role='button']"))) return;
      onPointerMove(event);
      rippleStartedAt = performance.now();
    };
    const onVisibility = () => syncMotion();
    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
      canvas.dataset.fluidMode = "css";
    };
    const onContextRestored = () => setContextVersion(version => version + 1);

    canvas.dataset.fluidMode = "webgl";
    gl.clearColor(0, 0, 0, 0);
    resizeObserver.observe(surface);
    home.addEventListener("pointermove", onPointerMove, { passive: true });
    home.addEventListener("pointerleave", onPointerLeave, { passive: true });
    home.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    motionPreference.addEventListener("change", syncMotion);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    syncMotion();

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      home.removeEventListener("pointermove", onPointerMove);
      home.removeEventListener("pointerleave", onPointerLeave);
      home.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
      motionPreference.removeEventListener("change", syncMotion);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [accentColor, contextVersion, reducedMotion]);

  return (
    <div
      className="lfaa-cnv-home__background"
      data-reduced-motion={reducedMotion}
      aria-hidden="true"
    >
      <span className="lfaa-cnv-home__fluid-cloud lfaa-cnv-home__fluid-cloud--deep" />
      <span className="lfaa-cnv-home__fluid-cloud lfaa-cnv-home__fluid-cloud--sheen" />
      <canvas ref={canvasRef} className="lfaa-cnv-home__fluid-surface" />
    </div>
  );
}
