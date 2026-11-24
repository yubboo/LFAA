// 验证主题网格取样：模式卡与预设卡的数量、选中标记、强调色解析与「跟随系统」双取样。
import assert from "node:assert/strict";
import test from "node:test";
import {
  MODE_TILE_PREFIX,
  PRESET_TILE_PREFIX,
  buildThemeTiles,
  sampleOfPreset,
} from "../client/components/theme-tiles";
import { THEME_PRESETS } from "../contract/index";

test("主题网格 = 3 张明暗模式卡 + 每套预设一张配色卡", () => {
  const tiles = buildThemeTiles({ mode: "dark", preset: "softMist", scheme: "dark", isZh: true });
  const modeTiles = tiles.filter((tile) => tile.id.startsWith(MODE_TILE_PREFIX));
  const presetTiles = tiles.filter((tile) => tile.id.startsWith(PRESET_TILE_PREFIX));

  assert.deepEqual(modeTiles.map((tile) => tile.id), ["mode:system", "mode:light", "mode:dark"]);
  assert.equal(presetTiles.length, Object.keys(THEME_PRESETS).length);
  assert.deepEqual(modeTiles.map((tile) => tile.label), ["跟随系统", "浅色", "深色"]);
  // 当前模式与当前预设各有一张选中卡（两条轴互不覆盖）。
  assert.deepEqual(tiles.filter((tile) => tile.active).map((tile) => tile.id), ["mode:dark", "preset:softMist"]);
});

test("「跟随系统」卡同时给出左侧浅色与右侧深色取样", () => {
  const [system, light, dark] = buildThemeTiles({ mode: "system", preset: "liquidGlass", scheme: "light", isZh: false });
  assert.ok(system?.secondarySample);
  assert.equal(system.sample.background, THEME_PRESETS.liquidGlass.light.background);
  assert.equal(system.secondarySample?.background, THEME_PRESETS.liquidGlass.dark.background);
  assert.equal(light?.secondarySample, undefined);
  assert.equal(dark?.sample.background, THEME_PRESETS.liquidGlass.dark.background);
  assert.deepEqual(
    [system?.label, light?.label, dark?.label],
    ["System", "Light", "Dark"],
  );
});

test("「樱花粉」作为独立预设卡出现在主题网格里", () => {
  const tiles = buildThemeTiles({ mode: "light", preset: "sakura", scheme: "light", isZh: true });
  const sakuraTile = tiles.find((tile) => tile.id === `${PRESET_TILE_PREFIX}sakura`);
  assert.ok(sakuraTile, "主题网格缺少樱花粉配色卡");
  assert.equal(sakuraTile.label, "樱花粉");
  assert.equal(sakuraTile.active, true);
  assert.equal(sakuraTile.sample.background, THEME_PRESETS.sakura.light.background);

  // 英文界面用英文名，且同一预设的深色取样取深色底色。
  const enTiles = buildThemeTiles({ mode: "dark", preset: "sakura", scheme: "dark", isZh: false });
  const enTile = enTiles.find((tile) => tile.id === `${PRESET_TILE_PREFIX}sakura`);
  assert.equal(enTile?.label, "Sakura");
  assert.equal(enTile?.sample.background, THEME_PRESETS.sakura.dark.background);
});

test("预设取样解析强调色为十六进制，并标记玻璃质感", () => {
  const mist = sampleOfPreset("softMist", "light");
  assert.equal(mist.background, "#EBF0F2");
  assert.equal(mist.foreground, "#1D2428");
  assert.match(mist.accent, /^#[0-9A-Fa-f]{6}$/u);
  assert.equal(mist.glass, THEME_PRESETS.softMist.glassEnabled);
  assert.equal(mist.scheme, "light");

  const midnight = sampleOfPreset("midnightInk", "dark");
  assert.equal(midnight.background, "#11141C");
  assert.equal(midnight.glass, true);
});