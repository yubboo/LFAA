import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageRoot = new URL("../../../packages/client/ui-workspace/src/", import.meta.url);
const homeSource = readFileSync(new URL("CanvasHome.tsx", packageRoot), "utf8");
const backgroundSource = readFileSync(new URL("CanvasHomeFluidBackground.tsx", packageRoot), "utf8");
const homeStyles = readFileSync(new URL("canvas-home.css", packageRoot), "utf8");

test("画布首页使用原创流体着色器，持续呈现、响应轻触并遵循外观设置", () => {
  assert.match(homeSource, /<CanvasHomeFluidBackground[\s\S]*?accentColor=\{settings\.appearance\.accentColor\}[\s\S]*?reducedMotion=\{settings\.appearance\.advanced\.reducedMotion\}/u);
  assert.doesNotMatch(homeSource, /lfaa-cnv-home__fiber|<svg className="lfaa-cnv-home__background"/u);
  assert.match(backgroundSource, /getContext\("webgl"/u);
  assert.match(backgroundSource, /bendSurface\(vec2 p, float phase\)/u);
  assert.match(backgroundSource, /vec3 normal = normalize\(vec3\(-slope/u);
  assert.match(backgroundSource, /float caustic =/u);
  assert.doesNotMatch(backgroundSource, /float filament =/u);
  assert.match(backgroundSource, /u_accent/u);
  assert.match(backgroundSource, /requestAnimationFrame\(tick\)/u);
  assert.match(backgroundSource, /document\.visibilityState === "hidden"/u);
  assert.match(backgroundSource, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/u);
  assert.match(backgroundSource, /reducedMotion === "on"/u);
  assert.match(backgroundSource, /pointerdown/u);
  assert.match(backgroundSource, /u_ripple_age/u);
  assert.match(backgroundSource, /ResizeObserver/u);
  assert.match(backgroundSource, /cancelAnimationFrame\(rafId\)/u);
  assert.match(backgroundSource, /resizeObserver\.disconnect\(\)/u);
  assert.match(backgroundSource, /removeEventListener\("visibilitychange"/u);
  assert.match(backgroundSource, /canvas\.dataset\.fluidMode = "css"/u);
  assert.match(backgroundSource, /aria-hidden="true"/u);
  assert.match(homeStyles, /\.lfaa-cnv-home > \.lfaa-cnv-home__background\s*\{[^}]*z-index:\s*0[^}]*pointer-events:\s*none/u);
  assert.match(homeStyles, /\.lfaa-cnv-home__background > \.lfaa-cnv-home__fluid-cloud--deep[\s\S]*?animation:/u);
  assert.match(homeStyles, /\.lfaa-cnv-home__background > \.lfaa-cnv-home__fluid-cloud--sheen[\s\S]*?animation:/u);
  assert.match(homeStyles, /data-reduced-motion="on"[\s\S]*?animation:\s*none/u);
  assert.match(homeStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?data-reduced-motion="system"[\s\S]*?animation:\s*none/u);
  assert.match(homeStyles, /\.lfaa-cnv-home__topbar,?\s*\{[^}]*z-index:\s*1/u);
  assert.match(homeStyles, /\.lfaa-cnv-home__scroll\s*\{[^}]*z-index:\s*1/u);
});
