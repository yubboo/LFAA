// 樱花粉预设回归：契约取样、深浅令牌成对、正文与弱化文字对比度是否达标。
// 主题色一旦调深或调浅，本用例先拦下来，避免「看起来还行、实际正文糊在底色里」。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ACCENT_PRESETS, THEME_PRESETS, resolveAccentColor } from "../contract/index";

const tokensCss = readFileSync(new URL("../client/tokens.css", import.meta.url), "utf8");

/** 取 WCAG 相对亮度：把 #RRGGBB 转成 0–1 的加权亮度。 */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** 两色的对比度，按 WCAG 公式取值 ≥ 1。 */
function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 抽出某个樱花粉令牌块的变量声明，用于比对深浅两套是否成对。 */
function tintBlock(scheme: "light" | "dark"): Map<string, string> {
  const pattern = new RegExp(
    `html\\[data-preset="sakura"\\]\\[data-resolved-theme="${scheme}"\\]\\s*\\{([^}]*)\\}`,
    "u",
  );
  const match = pattern.exec(tokensCss);
  assert.ok(match, `tokens.css 缺少樱花粉 ${scheme} 令牌块`);
  const body = match[1] ?? "";
  return new Map(
    [...body.matchAll(/(--tint-[a-z0-9-]+):\s*([^;]+);/gu)].map((entry) => [
      entry[1] ?? "",
      (entry[2] ?? "").trim(),
    ]),
  );
}

test("樱花粉预设同时提供浅色与深色两套配色", () => {
  const preset = THEME_PRESETS.sakura;
  assert.equal(preset.id, "sakura");
  assert.equal(preset.labelZh, "樱花粉");
  assert.equal(preset.labelEn, "Sakura");
  assert.equal(preset.glassEnabled, true);
  // 浅色是樱花白底 + 深褐字，深色是梅红酒底 + 浅粉字，两套方向相反才算和谐配对。
  assert.match(preset.light.background, /^#FFF/iu);
  assert.match(preset.dark.background, /^#1/iu);
  assert.equal(relativeLuminance(preset.light.background) > relativeLuminance(preset.dark.background), true);
  // 强调色在浅深两套里都是樱花粉（前景字不能被浅底吃掉，所以两套都用同一枚强调色）。
  assert.equal(preset.light.accent, "sakura");
  assert.equal(preset.dark.accent, "sakura");
});

test("樱花粉强调色已登记在强调色预设里，且可直接解析为十六进制", () => {
  const entry = ACCENT_PRESETS.find((item) => item.id === "sakura");
  assert.ok(entry, "ACCENT_PRESETS 缺少 sakura 条目");
  assert.equal(entry.labelZh, "樱花粉");
  assert.equal(entry.labelEn, "Sakura");
  assert.match(entry.color, /^#[0-9A-F]{6}$/u);

  const resolvedLight = resolveAccentColor(
    { accent: "sakura", customAccent: "#C9558A", background: "#FFF6F8", foreground: "#3B2A33", font: "system" },
    "light",
  );
  assert.equal(resolvedLight, entry.color);
});

test("樱花粉两套正文与弱化文字的对比度不低于 4.5:1", () => {
  for (const scheme of ["light", "dark"] as const) {
    const variant = THEME_PRESETS.sakura[scheme];
    const bodyRatio = contrastRatio(variant.foreground, variant.background);
    assert.ok(bodyRatio >= 4.5, `${scheme} 正文对比度仅 ${bodyRatio.toFixed(2)}:1`);

    const muted = tintBlock(scheme).get("--tint-muted");
    assert.ok(muted, `樱花粉 ${scheme} 缺少 --tint-muted`);
    const mutedRatio = contrastRatio(muted, variant.background);
    assert.ok(mutedRatio >= 4.5, `${scheme} 弱化文字对比度仅 ${mutedRatio.toFixed(2)}:1`);
  }
});

test("首屏防闪脚本与主题契约保持一致（新增预设/强调色不会首屏回退）", () => {
  const html = readFileSync(new URL("../../../../apps/web/index.html", import.meta.url), "utf8");
  const glassBlock = /const PRESET_GLASS = \{([^}]*)\}/u.exec(html)?.[1] ?? "";
  const accentBlock = /const ACCENTS = \{([^}]*)\}/u.exec(html)?.[1] ?? "";

  for (const definition of Object.values(THEME_PRESETS)) {
    const entry = new RegExp(`${definition.id}\\s*:\\s*(true|false)`, "u").exec(glassBlock);
    assert.ok(entry, `apps/web/index.html 的 PRESET_GLASS 缺少 ${definition.id}`);
    assert.equal(entry[1] === "true", definition.glassEnabled, `${definition.id} 的玻璃标记与契约不一致`);
  }

  // default / custom 不是固定色值，不参与比对；其余强调色必须逐字相同。
  for (const accent of ACCENT_PRESETS) {
    if (accent.id === "default" || accent.id === "custom") continue;
    const entry = new RegExp(`${accent.id}\\s*:\\s*"(#[0-9A-F]{6})"`, "u").exec(accentBlock);
    assert.ok(entry, `apps/web/index.html 的 ACCENTS 缺少 ${accent.id}`);
    assert.equal(entry[1], accent.color, `${accent.id} 的强调色与契约不一致`);
  }
});

test("樱花粉浅深两套令牌一一成对，不出现只在单侧定义的颜色", () => {
  const light = tintBlock("light");
  const dark = tintBlock("dark");
  assert.deepEqual([...light.keys()].sort(), [...dark.keys()].sort());
  // 每套都必须给出栏、面板、卡片、描边与弱化文字，缺一项就会退回中性默认色。
  for (const token of ["--tint-rail-rgb", "--tint-panel-rgb", "--tint-card-rgb", "--tint-line-rgb", "--tint-muted"]) {
    assert.ok(light.has(token), `浅色缺少 ${token}`);
    assert.ok(dark.has(token), `深色缺少 ${token}`);
  }
  // 同色裸值（不带透明度）必须能落到 rgb(var(--tint-*))；因此三元组只允许三个 0–255 数字。
  for (const value of [...light.values(), ...dark.values()]) {
    if (value.startsWith("#")) continue;
    assert.match(value, /^\d{1,3} \d{1,3} \d{1,3}$/u, `色调三元组格式异常：${value}`);
  }
});
