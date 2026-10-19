/**
 * 功能：为内置登录成功转场实时绘制背景引力透镜与蓝紫色吸积环。
 * 作用：只在短暂转场中对当前登录背景做有限分辨率的 GPU 采样，不更改外观设置或持久化数据。
 * 关联文件：packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-settings-account/src/auth.css。
 */
import { useEffect, useRef } from "react";

interface LoginTransitionSceneProps {
  backgroundImage: string | null;
  theme: "light" | "dark";
  overlay: number;
  accentColor: string;
  reducedMotion: boolean;
}

const transitionDurationMs = 2200;
const maxRenderPixels = 1_150_000;
const maxRenderEdge = 1500;

const vertexShaderSource = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragmentShaderSource = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBackground;
uniform vec2 uResolution;
uniform vec2 uImageResolution;
uniform float uProgress;
uniform float uHasImage;
uniform float uOverlayOpacity;
uniform vec3 uOverlayColor;
uniform vec3 uBaseColor;
uniform vec3 uAccent;

vec2 coverUv(vec2 uv) {
  float viewportAspect = uResolution.x / max(uResolution.y, 1.0);
  float imageAspect = uImageResolution.x / max(uImageResolution.y, 1.0);
  if (imageAspect > viewportAspect) {
    uv.x = (uv.x - 0.5) * viewportAspect / imageAspect + 0.5;
  } else {
    uv.y = (uv.y - 0.5) * imageAspect / viewportAspect + 0.5;
  }
  return uv;
}

void main() {
  vec2 centered = vUv - vec2(0.5, 0.5);
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  centered.x *= aspect;
  float radius = length(centered);
  float angle = atan(centered.y, centered.x);
  float progress = clamp(uProgress, 0.0, 1.0);
  float portalRadius = min(0.385, aspect * 0.44);
  float lens = (1.0 - smoothstep(0.07, 0.98, radius)) * exp(-radius * 0.55);

  // 反向采样让背景纹理向事件视界汇聚，同时沿切线旋转，形成真实的引力透镜感。
  float twist = progress * 2.8 * lens;
  float pull = progress * 0.3 * lens;
  float sourceRadius = radius + pull;
  vec2 sourcePoint = vec2(cos(angle + twist), sin(angle + twist)) * sourceRadius;
  vec2 sampleUv = coverUv(vec2(sourcePoint.x / (uResolution.x / max(uResolution.y, 1.0)), sourcePoint.y) + 0.5);
  vec3 color = uHasImage > 0.5 ? texture2D(uBackground, sampleUv).rgb : uBaseColor;
  color = mix(color, uOverlayColor, uOverlayOpacity);

  float portal = smoothstep(0.015, 0.28, progress);
  float eventHorizon = 1.0 - smoothstep(portalRadius * 0.81, portalRadius * 0.91, radius);
  float rimDistance = radius - (portalRadius + progress * 0.012);
  float rim = exp(-pow(rimDistance / (portalRadius * 0.036), 2.0));
  float halo = exp(-pow(rimDistance / (portalRadius * 0.19), 2.0));
  float spiralWave = sin(angle * 3.0 + radius * 27.0 - progress * 13.0);
  float filaments = pow(max(0.0, spiralWave), 10.0);
  float stream = exp(-pow((radius - portalRadius * 1.06 + portalRadius * 0.05 * sin(angle * 2.0 - progress * 9.0)) / (portalRadius * 0.14), 2.0)) * filaments;
  float outerLens = exp(-pow((radius - portalRadius * 1.3) / (portalRadius * 0.2), 2.0)) * (0.18 + 0.82 * pow(max(0.0, sin(angle * 5.0 - progress * 10.0)), 12.0));

  vec3 blue = mix(vec3(0.08, 0.34, 1.0), uAccent, 0.34);
  vec3 violet = mix(vec3(0.56, 0.2, 1.0), uAccent, 0.2);
  color *= 1.0 - portal * eventHorizon * 0.995;
  color += portal * (blue * (rim * 1.1 + halo * (0.12 + filaments * 0.38)) + violet * (stream * 0.72 + outerLens * 0.25));

  // 星屑随环绕方向移动，只绘制少量高亮点，避免全屏高频闪烁。
  float dustAngle = angle * 17.0 + progress * 24.0 + radius * 34.0;
  float dustCell = fract(sin(floor(dustAngle) * 127.1 + floor(radius * 180.0) * 311.7) * 43758.5453);
  float dust = smoothstep(0.992, 1.0, dustCell) * exp(-pow((radius - portalRadius * 1.12) / (portalRadius * 0.3), 2.0));
  color += portal * dust * vec3(0.42, 0.66, 1.0) * (0.55 + 0.45 * sin(progress * 18.0 + dustAngle));

  float edgeShade = smoothstep(0.48, 0.9, radius) * progress * 0.36;
  color *= 1.0 - edgeShade;
  gl_FragColor = vec4(color, 1.0);
}`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function parseHexColor(value: string): [number, number, number] {
  const match = /^#([\da-f]{6})$/iu.exec(value);
  if (!match) return [0.2, 0.38, 0.88];
  const color = Number.parseInt(match[1]!, 16);
  return [(color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255];
}

export function LoginTransitionScene({ backgroundImage, theme, overlay, accentColor, reducedMotion }: LoginTransitionSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
    } catch {
      return;
    }
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const position = gl.getAttribLocation(program, "aPosition");
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (position < 0 || !buffer || !texture) {
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    gl.useProgram(program);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl!.getUniformLocation(program, name);
    const uniforms = {
      background: uniform("uBackground"),
      resolution: uniform("uResolution"),
      imageResolution: uniform("uImageResolution"),
      progress: uniform("uProgress"),
      hasImage: uniform("uHasImage"),
      overlayOpacity: uniform("uOverlayOpacity"),
      overlayColor: uniform("uOverlayColor"),
      baseColor: uniform("uBaseColor"),
      accent: uniform("uAccent")
    };

    const page = canvas.closest<HTMLElement>(".auth-page");
    const pageBackground = page ? getComputedStyle(page).backgroundColor : "rgb(24, 24, 24)";
    const baseMatch = /rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/iu.exec(pageBackground);
    const baseColor: [number, number, number] = baseMatch
      ? [Number(baseMatch[1]) / 255, Number(baseMatch[2]) / 255, Number(baseMatch[3]) / 255]
      : theme === "dark" ? [24 / 255, 24 / 255, 24 / 255] : [243 / 255, 245 / 255, 248 / 255];
    const overlayColor: [number, number, number] = theme === "dark" ? [24 / 255, 24 / 255, 24 / 255] : [1, 1, 1];
    const accent = parseHexColor(accentColor);
    const image = backgroundImage ? new Image() : null;
    let imageWidth = 1;
    let imageHeight = 1;
    let hasImage = false;
    let animationFrame = 0;
    let startTime = 0;
    let stopped = false;
    let frameStarted = false;
    let needsResize = true;

    const onResize = () => { needsResize = true; };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    if (resizeObserver) resizeObserver.observe(canvas);
    else window.addEventListener("resize", onResize, { passive: true });

    const draw = (timestamp: number) => {
      if (stopped || gl!.isContextLost()) return;
      if (needsResize) {
        const bounds = canvas.getBoundingClientRect();
        const cssWidth = Math.max(1, bounds.width);
        const cssHeight = Math.max(1, bounds.height);
        const scale = Math.min(1, maxRenderEdge / Math.max(cssWidth, cssHeight), Math.sqrt(maxRenderPixels / (cssWidth * cssHeight)));
        canvas.width = Math.max(1, Math.round(cssWidth * scale));
        canvas.height = Math.max(1, Math.round(cssHeight * scale));
        needsResize = false;
      }

      if (!startTime) startTime = timestamp;
      const linearProgress = reducedMotion ? 1 : Math.min(1, (timestamp - startTime) / transitionDurationMs);
      const progress = linearProgress * linearProgress * (3 - 2 * linearProgress);
      gl!.viewport(0, 0, canvas.width, canvas.height);
      gl!.uniform1i(uniforms.background, 0);
      gl!.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl!.uniform2f(uniforms.imageResolution, imageWidth, imageHeight);
      gl!.uniform1f(uniforms.progress, progress);
      gl!.uniform1f(uniforms.hasImage, hasImage ? 1 : 0);
      gl!.uniform1f(uniforms.overlayOpacity, hasImage ? Math.min(0.75, Math.max(0, overlay / 100)) : 0);
      gl!.uniform3fv(uniforms.overlayColor, overlayColor);
      gl!.uniform3fv(uniforms.baseColor, baseColor);
      gl!.uniform3fv(uniforms.accent, accent);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      canvas.style.visibility = "visible";

      if (!reducedMotion && linearProgress < 1) animationFrame = requestAnimationFrame(draw);
    };

    const renderWhenReady = () => {
      if (stopped) return;
      if (image && image.complete && image.naturalWidth > 0) {
        imageWidth = image.naturalWidth;
        imageHeight = image.naturalHeight;
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
        try {
          gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, image);
          hasImage = true;
        } catch {
          hasImage = false;
        }
      }
      if ((!image || hasImage) && !frameStarted) {
        frameStarted = true;
        startTime = performance.now();
        animationFrame = requestAnimationFrame(draw);
      }
    };

    if (image) {
      image.decoding = "async";
      image.onload = renderWhenReady;
      image.onerror = () => undefined;
      image.src = backgroundImage!;
      if (image.complete && image.naturalWidth > 0) renderWhenReady();
    } else {
      startTime = performance.now();
      animationFrame = requestAnimationFrame(draw);
    }

    const onContextLost = (event: Event) => {
      event.preventDefault();
      stopped = true;
      cancelAnimationFrame(animationFrame);
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);

    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", onResize);
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
      gl!.deleteBuffer(buffer);
      gl!.deleteTexture(texture);
      gl!.deleteProgram(program);
    };
  }, [accentColor, backgroundImage, overlay, reducedMotion, theme]);

  return <canvas ref={canvasRef} className="auth-page__transition-scene" style={{ visibility: "hidden" }} aria-hidden="true" />;
}
