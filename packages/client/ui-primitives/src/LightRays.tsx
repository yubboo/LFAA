/*
 * React Bits LightRays source © 2026 David Haz.
 * Source: @react-bits/LightRays-JS-CSS, adapted for LFAA.
 * MIT + Commons Clause License Condition v1.0
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, and distribute the Software, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies
 * or substantial portions of the Software.
 *
 * Commons Clause Restriction: You may use this Software, including for any commercial
 * purpose, so long as you do not sell, sublicense, or redistribute the components
 * themselves-whether alone, in a bundle, or as a ported version. The same restriction
 * covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage,
 * Sound Lab and any tools added later) and the sounds in the sound library. You may not
 * sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools
 * or a substantially similar copy of them as a hosted service-whether alone, in a bundle,
 * or as a ported version. What you make with the tools is yours to use. You can use
 * exported code, images, videos, and audio files in any personal or commercial application,
 * website, or product, including paid ones. You may not sell or redistribute the exports on
 * their own, either individually or as the product itself, such as a sound, texture,
 * background, or template pack.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 * Full notice: packages/client/ui-primitives/THIRD-PARTY-NOTICES.md
 */
'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import './LightRays.css';

const PIXEL_BUDGET = 1.25e6;
const MAX_PULSES = 4;

type RayOrigin = 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
type RGB = [number, number, number];
type Origin = { anchor: [number, number]; dir: [number, number] };
type ReducedMotionMode = 'system' | 'on' | 'off';

interface LightRaysProps {
  raysOrigin?: RayOrigin;
  raysColor?: string;
  raysSpeed?: number;
  lightSpread?: number;
  rayLength?: number;
  rayDensity?: number;
  tilt?: number;
  raySharpness?: number;
  glow?: number;
  haze?: number;
  atmosphere?: number;
  intensity?: number;
  pulsating?: boolean;
  fadeDistance?: number;
  saturation?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  cursorShadow?: boolean;
  clickPulse?: boolean;
  noiseAmount?: number;
  mist?: number;
  distortion?: number;
  intro?: boolean;
  opacity?: number;
  maxDevicePixelRatio?: number;
  reducedMotion?: ReducedMotionMode;
  className?: string;
  style?: CSSProperties;
}

type RaySettings = {
  origin: Origin;
  color: RGB | null;
  speed: number;
  spread: number;
  length: number;
  density: number;
  tilt: number;
  sharpness: number;
  glow: number;
  haze: number;
  atmosphere: number;
  intensity: number;
  pulsating: boolean;
  fade: number;
  saturation: number;
  follow: boolean;
  influence: number;
  cursorShadow: boolean;
  clickPulse: boolean;
  noise: number;
  mist: number;
  distortion: number;
  intro: boolean;
  opacity: number;
  maxRatio: number;
  reducedMotion: ReducedMotionMode;
};

const ORIGINS: Record<RayOrigin, Origin> = {
  'top-left': { anchor: [0, -0.2], dir: [0, 1] },
  'top-center': { anchor: [0.5, -0.2], dir: [0, 1] },
  'top-right': { anchor: [1, -0.2], dir: [0, 1] },
  left: { anchor: [-0.2, 0.5], dir: [1, 0] },
  right: { anchor: [1.2, 0.5], dir: [-1, 0] },
  'bottom-left': { anchor: [0, 1.2], dir: [0, -1] },
  'bottom-center': { anchor: [0.5, 1.2], dir: [0, -1] },
  'bottom-right': { anchor: [1, 1.2], dir: [0, -1] }
};

const VERTEX = `in vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
uniform vec2 uResolution;
uniform float uScale;
uniform float uTime;
uniform vec2 uSource;
uniform vec2 uAim;
uniform float uReach;
uniform vec3 uColor;
uniform float uSpread;
uniform float uLength;
uniform float uFade;
uniform float uSaturation;
uniform float uPulsating;
uniform float uNoise;
uniform float uMist;
uniform float uDistortion;
uniform float uDensity;
uniform float uSharpness;
uniform float uGlow;
uniform float uHaze;
uniform float uAtmosphere;
uniform float uIntensity;
uniform vec4 uShadow;
uniform vec4 uPulses[${MAX_PULSES}];
uniform vec2 uIntro;
uniform float uLight;
uniform float uOpacity;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x), w.y);
}

float shape(float strength, float width) {
  float edge = max(mix(0.5, 0.08, uSharpness), width);
  return mix(strength, smoothstep(0.62 - edge, 0.62 + edge, strength), uSharpness);
}

vec4 addMist(vec4 source, vec3 mistColor, float alpha) {
  vec4 haze = vec4(mistColor * alpha, alpha);
  return source + haze * (1.0 - source.a);
}

void main() {
  vec2 coord = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uScale;
  vec2 uv = coord / max(uResolution / uScale, vec2(1.0));
  float mistLevel = 0.0;
  if (uMist > 0.0) {
    vec2 mistDrift = uv * vec2(3.6, 1.5) + vec2(uTime * 0.012, -uTime * 0.008);
    float mistNoise = 0.62 * valueNoise(mistDrift) + 0.38 * valueNoise(mistDrift * vec2(2.1, 1.7) + 3.4);
    float lowHaze = smoothstep(0.08, 0.9, uv.y);
    mistLevel = min(0.055, uMist * 0.22 * smoothstep(0.38, 0.78, mistNoise) * lowHaze);
  }
  vec3 mistColor = mix(vec3(0.72), uColor, 0.1);
  vec2 delta = coord - uSource;
  float distance = length(delta);
  vec2 dir = delta / max(distance, 1e-4);
  float cosAngle = dot(dir, uAim);
  float angle = cosAngle + uDistortion * sin(uTime * 2.0 + distance * 0.02) * 0.2;
  float slope = fwidth(angle);
  float depth = distance / uReach;

  float source = exp(-depth * depth * 9.0) * 0.9 + exp(-depth * 3.2) * 0.25;
  float glowLight = uGlow * source * smoothstep(-0.2, 0.6, cosAngle);
  float spread = pow(max(angle, 0.0), 1.0 / uSpread);
  float lengthFalloff = clamp(1.0 - distance / (uReach * uLength), 0.0, 1.0);
  float fadeFalloff = clamp(1.0 - distance / (uReach * uFade), 0.5, 1.0);
  float envelope = spread * lengthFalloff * fadeFalloff;
  float reveal = uIntensity * uIntro.y * (1.0 - smoothstep(uIntro.x - 0.35, uIntro.x, depth));
  if ((envelope * 1.6 + glowLight) * reveal < 0.0015) {
    fragColor = addMist(vec4(0.0), mistColor, mistLevel);
    return;
  }

  float phaseA = angle * 36.2214 * uDensity + uTime * 1.5;
  float phaseB = -angle * 21.11349 * uDensity + uTime * 1.5;
  float phaseC = angle * 22.3991 * uDensity + uTime * 1.1;
  float phaseD = -angle * 18.0234 * uDensity + uTime * 1.1;
  float strengthA = clamp(0.75 + 0.15 * sin(phaseA) + 0.2 * cos(phaseB), 0.0, 1.0);
  float strengthB = clamp(0.75 + 0.15 * sin(phaseC) + 0.2 * cos(phaseD), 0.0, 1.0);
  float widthA = abs(0.15 * 36.2214 * cos(phaseA) + 0.2 * 21.11349 * sin(phaseB)) * uDensity * slope;
  float widthB = abs(0.15 * 22.3991 * cos(phaseC) + 0.2 * 18.0234 * sin(phaseD)) * uDensity * slope;
  float pulseA = uPulsating > 0.5 ? 0.8 + 0.2 * sin(uTime * 4.5) : 1.0;
  float pulseB = uPulsating > 0.5 ? 0.8 + 0.2 * sin(uTime * 3.3) : 1.0;
  float rayLight = envelope * (0.5 * shape(strengthA, widthA) * pulseA + 0.4 * shape(strengthB, widthB) * pulseB);

  if (uHaze > 0.0) {
    float around = atan(uAim.x * dir.y - uAim.y * dir.x, cosAngle);
    vec2 drift = vec2(around * 2.2 + uTime * 0.035, depth * 2.6 - uTime * 0.11);
    float fog = 0.65 * valueNoise(drift * vec2(3.0, 1.0)) + 0.35 * valueNoise(drift * vec2(7.0, 2.3) + 4.1);
    rayLight *= mix(1.0, 0.25 + 1.2 * fog, uHaze);
  }

  if (uShadow.z > 0.0) {
    vec2 toCursor = uShadow.xy - uSource;
    float cursorDistance = length(toCursor);
    float along = dot(delta, toCursor) / max(cursorDistance * cursorDistance, 1e-4);
    float side = abs(delta.x * toCursor.y - delta.y * toCursor.x) / max(cursorDistance, 1e-4);
    float trail = max(along - 1.0, 0.0);
    float width = uShadow.w * along + 0.22 * trail * cursorDistance;
    float behind = smoothstep(0.97, 1.25, along) * exp(-trail * 1.1);
    float shade = (1.0 - smoothstep(width * 0.3, width * 1.6, side)) * behind;
    rayLight *= 1.0 - uShadow.z * 0.62 * shade;
  }

  float boost = 0.0;
  for (int i = 0; i < ${MAX_PULSES}; i++) {
    vec4 wave = uPulses[i];
    if (wave.z <= 0.0) continue;
    float x = (depth - wave.x) / wave.y;
    boost += wave.z * exp(-x * x);
  }
  float light = (rayLight * (1.0 + boost) + glowLight) * reveal;

  if (uNoise > 0.0) {
    float n = fract(sin(dot(coord * 0.02 + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453123);
    light *= 1.0 - uNoise + uNoise * n;
  }

  float near = clamp(1.2 - distance / (uResolution.y / uScale), 0.0, 1.0);
  vec3 tint = mix(vec3(0.9), vec3(0.1, 0.3, 0.5) + near * vec3(0.8, 0.6, 0.5), uAtmosphere);
  float gray = dot(tint, vec3(0.299, 0.587, 0.114));
  vec3 hue = max(mix(vec3(gray), tint, uSaturation), 0.0) * uColor;

  float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  if (uLight > 0.5) {
    vec3 color = hue * light;
    float energy = max(color.r, max(color.g, color.b));
    vec3 tone = clamp(1.0 - (1.0 - hue / max(max(hue.r, max(hue.g, hue.b)), 1e-4)) * 1.8, 0.0, 1.0);
    float warm = clamp((min(tone.r, tone.g) - tone.b) * 2.0, 0.0, 1.0);
    vec3 ink = tone * (mix(0.66, 0.94, warm) - 0.1 * smoothstep(0.4, 1.2, energy));
    float density = clamp(0.82 * (1.0 - exp(-1.5 * energy * energy)) * uOpacity + grain, 0.0, 1.0);
    fragColor = addMist(vec4(ink * density, density), mistColor, mistLevel);
    return;
  }
  float level = light < 0.75 ? light : 0.75 + 0.25 * (1.0 - exp(-(light - 0.75) / 0.25));
  float top = max(hue.r, max(hue.g, hue.b));
  hue = mix(hue, vec3(top), smoothstep(0.8, 1.0, level) * 0.45);
  vec3 shown = clamp(hue * level, 0.0, 1.0) * level;
  fragColor = addMist(vec4(clamp(shown + grain, 0.0, level) * uOpacity, level * uOpacity), mistColor, mistLevel);
}`;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const parseColor = (value: string | undefined): RGB | null => {
  const text = String(value || '').trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, digit => digit + digit) : hex[1];
    return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255) as RGB;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map(channel => clamp(parseFloat(channel) / 255, 0, 1)) as RGB;
  return null;
};

const smoother = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export function LightRays({
  raysOrigin = 'top-center',
  raysColor = 'var(--settings-accent)',
  raysSpeed = 1,
  lightSpread = 0.5,
  rayLength = 3,
  rayDensity = 1,
  tilt = 0,
  raySharpness = 0.35,
  glow = 0.6,
  haze = 0.25,
  atmosphere = 1,
  intensity = 1,
  pulsating = false,
  fadeDistance = 1,
  saturation = 1,
  followMouse = true,
  mouseInfluence = 0.1,
  cursorShadow = true,
  clickPulse = true,
  noiseAmount = 0,
  mist = 0,
  distortion = 0,
  intro = true,
  opacity = 1,
  maxDevicePixelRatio = 2,
  reducedMotion = 'system',
  className = '',
  style
}: LightRaysProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const [generation, setGeneration] = useState(0);

  const settings: RaySettings = {
    origin: ORIGINS[raysOrigin],
    color: parseColor(raysColor),
    speed: Math.max(0, raysSpeed),
    spread: Math.max(0.001, lightSpread),
    length: Math.max(0.01, rayLength),
    density: clamp(rayDensity, 0.1, 6),
    tilt: (clamp(tilt, -90, 90) * Math.PI) / 180,
    sharpness: clamp(raySharpness, 0, 1),
    glow: Math.max(0, glow),
    haze: clamp(haze, 0, 1),
    atmosphere: clamp(atmosphere, 0, 1),
    intensity: Math.max(0, intensity),
    pulsating,
    fade: Math.max(0.01, fadeDistance),
    saturation: Math.max(0, saturation),
    follow: followMouse,
    influence: clamp(mouseInfluence, 0, 1),
    cursorShadow,
    clickPulse,
    noise: clamp(noiseAmount, 0, 1),
    mist: clamp(mist, 0, 1),
    distortion,
    intro,
    opacity: clamp(opacity, 0, 1),
    maxRatio: clamp(maxDevicePixelRatio, 0.5, 3),
    reducedMotion
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    wakeRef.current?.();
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    container.dataset.renderer = 'fallback';

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance'
      });
    } catch {
      return;
    }

    const pulseData = new Float32Array(MAX_PULSES * 4);
    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uScale: { value: 1 },
      uTime: { value: 0 },
      uSource: { value: new THREE.Vector2() },
      uAim: { value: new THREE.Vector2() },
      uReach: { value: 1 },
      uColor: { value: new THREE.Vector3(1, 1, 1) },
      uSpread: { value: 1 },
      uLength: { value: 1 },
      uFade: { value: 1 },
      uSaturation: { value: 1 },
      uPulsating: { value: 0 },
      uNoise: { value: 0 },
      uMist: { value: 0 },
      uDistortion: { value: 0 },
      uDensity: { value: 1 },
      uSharpness: { value: 0 },
      uGlow: { value: 0 },
      uHaze: { value: 0 },
      uAtmosphere: { value: 0 },
      uIntensity: { value: 1 },
      uShadow: { value: new THREE.Vector4() },
      uPulses: { value: pulseData },
      uIntro: { value: new THREE.Vector2() },
      uLight: { value: 0 },
      uOpacity: { value: 1 }
    };
    const material = new THREE.RawShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      glslVersion: THREE.GLSL3,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const drawBufferSize = new THREE.Vector2(1, 1);
    renderer.setPixelRatio(1);
    renderer.setSize(1, 1, false);
    renderer.setClearColor(0x000000, 0);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = settingsRef.current.reducedMotion === 'on' || (settingsRef.current.reducedMotion === 'system' && motionQuery.matches);
    container.dataset.renderer = 'three';
    const size = { width: 1, height: 1, ratio: 1 };
    const pointer = { x: 0.5, y: 0.5, inside: false, seen: false };
    const aim = { x: 0.5, y: 0.5 };
    const shade = { x: 0.5, y: 0.5, presence: 0 };
    const pulses: Array<{ age: number }> = [];
    let time = 0;
    let opening = settingsRef.current.intro && !reduced && generation === 0 ? 0 : 1;
    let animationRunning = false;
    let last = 0;
    let visible = true;
    let pageVisible = document.visibilityState !== 'hidden';
    let lost = false;
    const palette = { color: [1, 1, 1] as RGB, lightMode: false };

    const refreshPalette = () => {
      const shell = container.closest<HTMLElement>('.workbench-shell');
      const accent = getComputedStyle(container).getPropertyValue('--settings-accent').trim();
      palette.color = settingsRef.current.color ?? parseColor(accent) ?? [1, 1, 1];
      palette.lightMode = shell?.dataset.theme === 'light';
      container.dataset.theme = palette.lightMode ? 'light' : 'dark';
    };
    refreshPalette();

    const resize = () => {
      const s = settingsRef.current;
      const rect = container.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width);
      const cssHeight = Math.max(1, rect.height);
      const detail = s.density * (0.35 + 0.65 * s.sharpness);
      const sampling = Math.max(clamp(0.35 + 0.3 * detail, 0.5, 2), s.noise > 0 ? 1 : 0);
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        s.maxRatio,
        sampling,
        Math.sqrt(PIXEL_BUDGET / (cssWidth * cssHeight))
      );
      renderer.setPixelRatio(ratio);
      renderer.setSize(cssWidth, cssHeight, false);
      renderer.getDrawingBufferSize(drawBufferSize);
      size.width = cssWidth;
      size.height = cssHeight;
      size.ratio = drawBufferSize.x / cssWidth;
      uniforms.uResolution.value.copy(drawBufferSize);
      uniforms.uScale.value = size.ratio;
    };

    const stop = () => {
      if (!animationRunning) return;
      renderer.setAnimationLoop(null);
      animationRunning = false;
    };
    const syncReducedMotion = () => {
      const nextReduced = settingsRef.current.reducedMotion === 'on' || (settingsRef.current.reducedMotion === 'system' && motionQuery.matches);
      if (nextReduced === reduced) return;
      reduced = nextReduced;
      if (!reduced) return;
      time = 0;
      opening = 1;
      pulses.length = 0;
      shade.presence = 0;
    };
    const frame = (now: number) => {
      if (lost || !visible || !pageVisible) {
        stop();
        return;
      }
      syncReducedMotion();
      const s = settingsRef.current;
      const dt = clamp((now - last) / 1000 || 0, 0, 0.05);
      last = Math.max(last, now);
      if (reduced) {
        time = 0;
        opening = 1;
      } else {
        time += dt * s.speed;
        if (opening < 1) opening = Math.min(1, opening + dt / 1.8);
      }

      const steer = 1 - Math.exp(-dt / 0.2);
      const aimX = s.follow && pointer.seen ? pointer.x : 0.5;
      const aimY = s.follow && pointer.seen ? pointer.y : 0.5;
      aim.x += (aimX - aim.x) * steer;
      aim.y += (aimY - aim.y) * steer;
      const glide = 1 - Math.exp(-dt / 0.08);
      shade.x += (pointer.x - shade.x) * glide;
      shade.y += (pointer.y - shade.y) * glide;
      const shading = pointer.inside && s.cursorShadow && !reduced;
      shade.presence += ((shading ? 1 : 0) - shade.presence) * (1 - Math.exp(-dt / (shading ? 0.25 : 0.5)));

      for (let index = pulses.length - 1; index >= 0; index--) {
        pulses[index].age += dt;
        if (pulses[index].age >= 2) pulses.splice(index, 1);
      }
      pulseData.fill(0);
      pulses.forEach((pulse, index) => {
        const t = pulse.age;
        pulseData[index * 4] = 0.05 + t * 1.05;
        pulseData[index * 4 + 1] = 0.14 + t * 0.14;
        pulseData[index * 4 + 2] = 0.9 * smoother(t / 0.15) * (1 - smoother(t / 2));
      });

      const width = size.width;
      const height = size.height;
      const sourceX = s.origin.anchor[0] * width;
      const sourceY = s.origin.anchor[1] * height;
      const cos = Math.cos(s.tilt);
      const sin = Math.sin(s.tilt);
      let dirX = s.origin.dir[0] * cos - s.origin.dir[1] * sin;
      let dirY = s.origin.dir[0] * sin + s.origin.dir[1] * cos;
      if (s.follow && s.influence > 0) {
        const mx = aim.x * width - sourceX;
        const my = aim.y * height - sourceY;
        const ml = Math.hypot(mx, my) || 1;
        const bx = dirX + (mx / ml - dirX) * s.influence;
        const by = dirY + (my / ml - dirY) * s.influence;
        const bl = Math.hypot(bx, by) || 1;
        dirX = bx / bl;
        dirY = by / bl;
      }
      const eased = 1 - Math.pow(1 - opening, 3);

      uniforms.uResolution.value.copy(drawBufferSize);
      uniforms.uScale.value = size.ratio;
      uniforms.uTime.value = time;
      uniforms.uSource.value.set(sourceX, sourceY);
      uniforms.uAim.value.set(dirX, dirY);
      uniforms.uReach.value = Math.max(width, height);
      uniforms.uColor.value.set(palette.color[0], palette.color[1], palette.color[2]);
      uniforms.uSpread.value = s.spread;
      uniforms.uLength.value = s.length;
      uniforms.uFade.value = s.fade;
      uniforms.uSaturation.value = s.saturation;
      uniforms.uPulsating.value = s.pulsating ? 1 : 0;
      uniforms.uNoise.value = s.noise;
      uniforms.uMist.value = s.mist;
      uniforms.uDistortion.value = s.distortion;
      uniforms.uDensity.value = s.density;
      uniforms.uSharpness.value = s.sharpness;
      uniforms.uGlow.value = s.glow;
      uniforms.uHaze.value = s.haze;
      uniforms.uAtmosphere.value = s.atmosphere;
      uniforms.uIntensity.value = s.intensity;
      uniforms.uShadow.value.set(shade.x * width, shade.y * height, shade.presence, 16);
      uniforms.uIntro.value.set(eased * 2.6, smoother(opening / 0.5));
      uniforms.uLight.value = palette.lightMode ? 1 : 0;
      uniforms.uOpacity.value = s.opacity;
      renderer.render(scene, camera);

      const settling =
        Math.abs(aim.x - aimX) > 1e-4 ||
        Math.abs(aim.y - aimY) > 1e-4 ||
        (shade.presence > 1e-3 && Math.abs(shade.x - pointer.x) + Math.abs(shade.y - pointer.y) > 1e-4) ||
        Math.abs((shading ? 1 : 0) - shade.presence) > 1e-3 ||
        pulses.length > 0;
      const busy = !reduced && (s.speed > 0 || opening < 1 || settling);
      if (!busy) stop();
    };

    const wake = () => {
      syncReducedMotion();
      if (lost || !visible || !pageVisible || animationRunning) return;
      last = performance.now();
      animationRunning = true;
      renderer.setAnimationLoop(frame);
    };
    wakeRef.current = () => {
      refreshPalette();
      resize();
      wake();
    };

    const onMotionPreferenceChange = () => {
      wake();
    };
    motionQuery.addEventListener('change', onMotionPreferenceChange);

    const shell = container.closest<HTMLElement>('.workbench-shell');
    const themeObserver = shell && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => {
        refreshPalette();
        wake();
      })
      : null;
    themeObserver?.observe(shell!, { attributes: true, attributeFilter: ['data-theme', 'style'] });

    const locate = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / Math.max(1, rect.width),
        y: (event.clientY - rect.top) / Math.max(1, rect.height),
        inside:
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const spot = locate(event);
      if (!pointer.inside && spot.inside) {
        shade.x = spot.x;
        shade.y = spot.y;
      }
      pointer.x = spot.x;
      pointer.y = spot.y;
      pointer.inside = spot.inside;
      pointer.seen = true;
      wake();
    };
    const onPointerDown = (event: PointerEvent) => {
      const s = settingsRef.current;
      const spot = locate(event);
      if (!spot.inside || !s.clickPulse || reduced) return;
      pulses.push({ age: 0 });
      if (pulses.length > MAX_PULSES) pulses.shift();
      wake();
    };
    const onLeave = () => {
      pointer.inside = false;
      wake();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') onLeave();
    };
    const tracksPointer = settingsRef.current.follow || settingsRef.current.cursorShadow;
    const tracksClicks = settingsRef.current.clickPulse;
    if (tracksPointer) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }
    if (tracksClicks) window.addEventListener('pointerdown', onPointerDown, { passive: true });
    if (tracksPointer || tracksClicks) {
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      window.addEventListener('pointercancel', onPointerUp, { passive: true });
    }

    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      container.dataset.renderer = 'fallback';
      stop();
    };
    const onRestored = () => setGeneration(value => value + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    const onResize = () => {
      resize();
      wake();
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    resizeObserver?.observe(container);
    if (!resizeObserver) window.addEventListener('resize', onResize);

    const intersection = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) wake();
      else stop();
    }) : null;
    intersection?.observe(container);

    const onVisibility = () => {
      pageVisible = document.visibilityState !== 'hidden';
      if (pageVisible) wake();
      else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    resize();
    wake();

    return () => {
      stop();
      wakeRef.current = null;
      resizeObserver?.disconnect();
      intersection?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', onResize);
      if (tracksPointer) {
        window.removeEventListener('pointermove', onPointerMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
      }
      if (tracksClicks) window.removeEventListener('pointerdown', onPointerDown);
      if (tracksPointer || tracksClicks) {
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionPreferenceChange);
      themeObserver?.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      delete container.dataset.renderer;
      delete container.dataset.theme;
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [generation]);

  return (
    <div ref={containerRef} className={`light-rays${className ? ` ${className}` : ''}`} style={style}>
      <div className="light-rays__fallback" aria-hidden="true" />
      <canvas ref={canvasRef} className="light-rays__canvas" aria-hidden="true" />
    </div>
  );
}

export default LightRays;
