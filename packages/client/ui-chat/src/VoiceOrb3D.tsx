import { useEffect, useRef } from "react";

type VoiceOrbStatus = "ready" | "connected" | "listening" | "thinking" | "speaking";

interface VoiceOrb3DProps {
  fallbackSrc: string;
  status: VoiceOrbStatus;
  speechActivity: number;
  reducedMotion: "system" | "on" | "off";
}

interface OrbVisualState {
  status: VoiceOrbStatus;
  speechActivity: number;
}

const PARTICLE_COUNT = 3600;

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute float aSeed;
uniform float uTime;
uniform float uMode;
uniform float uMotion;
uniform float uPixelRatio;
uniform float uPulse;
varying float vSeed;
varying float vDepth;
void main() {
  float turnSpeed = uMode == 1.0 ? 0.23 : uMode == 2.0 ? 0.46 : uMode == 3.0 ? 0.31 : 0.14;
  float angle = uTime * turnSpeed;
  float breatheSpeed = uMode == 1.0 ? 3.2 : uMode == 2.0 ? 1.45 : uMode == 3.0 ? 4.2 : 0.85;
  float breatheSize = uMode == 1.0 ? 0.035 : uMode == 2.0 ? 0.014 : uMode == 3.0 ? 0.044 : 0.022;
  float wave = sin(aSeed * 29.0 + uTime * breatheSpeed) * breatheSize * uMotion;
  float breath = sin(uTime * breatheSpeed * 0.5) * 0.018 * uMotion;
  float pulse = uPulse * (0.075 + sin(uTime * 13.0) * 0.022);
  vec3 p = aPosition * (0.86 + wave + breath + pulse);
  float yRotation = angle;
  float x = p.x * cos(yRotation) - p.z * sin(yRotation);
  float z = p.x * sin(yRotation) + p.z * cos(yRotation);
  float xTilt = sin(uTime * 0.17) * 0.12;
  float y = p.y * cos(xTilt) - z * sin(xTilt);
  z = p.y * sin(xTilt) + z * cos(xTilt);
  float depth = 2.7 - z;
  float perspective = 2.0 / depth;
  gl_Position = vec4(x * perspective, y * perspective, 0.0, 1.0);
  gl_PointSize = (1.2 + aSeed * 2.3 + uPulse * 1.5) * uPixelRatio * perspective;
  vSeed = aSeed;
  vDepth = clamp((z + 0.9) / 1.8, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uAccent;
uniform vec3 uGlow;
uniform float uMode;
uniform float uEnergy;
uniform float uPulse;
varying float vSeed;
varying float vDepth;
void main() {
  vec2 point = gl_PointCoord - vec2(0.5);
  float distanceToCenter = length(point);
  float core = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
  float halo = (1.0 - smoothstep(0.0, 0.5, distanceToCenter)) * 0.22;
  float gold = smoothstep(0.72, 0.96, vSeed);
  vec3 color = mix(uAccent, uGlow, gold);
  color = mix(color * 0.62, color, vDepth);
  float energy = 0.54 + uEnergy * 0.4 + (uMode == 1.0 ? 0.15 : 0.0) + uPulse * 0.32;
  gl_FragColor = vec4(color, (core * 0.88 + halo) * energy);
}`;

function shader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const result = gl.createShader(type);
  if (!result) return null;
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    gl.deleteShader(result);
    return null;
  }
  return result;
}

function makeParticles(): Float32Array {
  const values = new Float32Array(PARTICLE_COUNT * 4);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const y = 1 - (index / (PARTICLE_COUNT - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = goldenAngle * index;
    const offset = index * 4;
    values[offset] = Math.cos(angle) * radius;
    values[offset + 1] = y;
    values[offset + 2] = Math.sin(angle) * radius;
    values[offset + 3] = ((index * 37) % PARTICLE_COUNT) / PARTICLE_COUNT;
  }
  return values;
}

function cssColor(element: Element | null, tokens: string[], fallback: string): Float32Array {
  const styles = element ? getComputedStyle(element) : null;
  const value = styles ? tokens.map(token => styles.getPropertyValue(token).trim()).find(Boolean) ?? "" : "";
  const color = value || fallback;
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const channels = hex.length === 3
      ? [...hex].map(channel => Number.parseInt(channel + channel, 16))
      : hex.length === 6 ? [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) : [];
    if (channels.length === 3 && channels.every(Number.isFinite)) return new Float32Array(channels.map(channel => channel / 255));
  }
  const values = color.match(/[\d.]+/g)?.map(Number) ?? [];
  if (values.length >= 3) {
    return new Float32Array(values.slice(0, 3).map(channel => channel / 255));
  }
  return new Float32Array([0.25, 0.85, 0.8]);
}

export function VoiceOrb3D({ fallbackSrc, status, speechActivity, reducedMotion }: VoiceOrb3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualRef = useRef<OrbVisualState>({ status, speechActivity });
  const motionPreferenceRef = useRef(reducedMotion);
  const reducedRef = useRef(reducedMotion === "on");
  const motionQueryRef = useRef<MediaQueryList | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const reconcileRef = useRef<(() => void) | null>(null);
  visualRef.current = { status, speechActivity };
  motionPreferenceRef.current = reducedMotion;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) {
      root.dataset.webgl = "unavailable";
      return;
    }

    const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      root.dataset.webgl = "unavailable";
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      root.dataset.webgl = "unavailable";
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      root.dataset.webgl = "unavailable";
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, makeParticles(), gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const seedLocation = gl.getAttribLocation(program, "aSeed");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(seedLocation);
    gl.vertexAttribPointer(seedLocation, 1, gl.FLOAT, false, 16, 12);
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const modeLocation = gl.getUniformLocation(program, "uMode");
    const motionLocation = gl.getUniformLocation(program, "uMotion");
    const pixelRatioLocation = gl.getUniformLocation(program, "uPixelRatio");
    const accentLocation = gl.getUniformLocation(program, "uAccent");
    const glowLocation = gl.getUniformLocation(program, "uGlow");
    const energyLocation = gl.getUniformLocation(program, "uEnergy");
    const pulseLocation = gl.getUniformLocation(program, "uPulse");
    const shell = root.closest(".workbench-shell");
    let frame = 0;
    let lastTime = 0;
    let elapsed = 0;
    let inView = true;
    let pageVisible = !document.hidden;
    let accentColor = new Float32Array([0.25, 0.85, 0.8]);
    let glowColor = new Float32Array([0.95, 0.82, 0.55]);

    const readPalette = () => {
      accentColor = cssColor(shell ?? root, ["--settings-accent", "--color-brand"], "#50d8d2");
      glowColor = cssColor(shell ?? root, ["--color-text-heading", "--color-text-primary"], "#f4d79a");
    };
    const draw = () => {
      const bounds = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      const current = visualRef.current;
      const mode = current.status === "listening" ? 1 : current.status === "thinking" ? 2 : current.status === "speaking" ? 3 : 0;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeLocation, elapsed);
      gl.uniform1f(modeLocation, mode);
      gl.uniform1f(motionLocation, reducedRef.current ? 0 : 1);
      gl.uniform1f(pixelRatioLocation, dpr);
      gl.uniform1f(energyLocation, current.status === "listening" ? 0.72 : current.status === "speaking" ? 0.8 : 0.22);
      gl.uniform1f(pulseLocation, current.speechActivity);
      gl.uniform3fv(accentLocation, accentColor);
      gl.uniform3fv(glowLocation, glowColor);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const tick = (now: number) => {
      frame = 0;
      if (!inView || !pageVisible || reducedRef.current) return;
      if (lastTime) elapsed += Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const reconcile = () => {
      if (reducedRef.current || !inView || !pageVisible) {
        stop();
        lastTime = 0;
        draw();
      } else if (!frame) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      stop();
      root.dataset.webgl = "unavailable";
    };
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQueryRef.current = motionQuery;
    const updateMotion = () => {
      reducedRef.current = motionPreferenceRef.current === "on" || motionPreferenceRef.current === "system" && motionQuery.matches;
      reconcile();
    };
    const updateVisibility = () => {
      pageVisible = !document.hidden;
      reconcile();
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(draw);
    resizeObserver?.observe(root);
    const intersectionObserver = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      inView = Boolean(entries[0]?.isIntersecting);
      reconcile();
    });
    intersectionObserver?.observe(root);
    const themeObserver = typeof MutationObserver === "undefined" || !shell ? null : new MutationObserver(() => { readPalette(); draw(); });
    themeObserver?.observe(shell!, { attributes: true, attributeFilter: ["style", "data-theme"] });
    document.addEventListener("visibilitychange", updateVisibility);
    motionQuery.addEventListener("change", updateMotion);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    drawRef.current = draw;
    reconcileRef.current = reconcile;
    root.dataset.webgl = "ready";
    readPalette();
    updateMotion();
    draw();

    return () => {
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      themeObserver?.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
      motionQuery.removeEventListener("change", updateMotion);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      motionQueryRef.current = null;
      drawRef.current = null;
      reconcileRef.current = null;
      delete root.dataset.webgl;
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    reducedRef.current = reducedMotion === "on" || reducedMotion === "system" && Boolean(motionQueryRef.current?.matches);
    drawRef.current?.();
    reconcileRef.current?.();
  }, [status, speechActivity, reducedMotion]);

  return (
    <div ref={rootRef} className="ai-work-voice__core" data-voice-status={status} data-speech-active={speechActivity > 0 ? "true" : "false"} data-motion-preference={reducedMotion} aria-hidden="true">
      <img className="ai-work-voice__core-image" src={fallbackSrc} alt="" draggable={false} />
      <canvas ref={canvasRef} className="ai-work-voice__core-canvas" />
    </div>
  );
}
