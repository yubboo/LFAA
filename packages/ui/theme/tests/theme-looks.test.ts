// 验证主题墙取样：主题 = 配色 + 背景；纯色、内置背景与个人背景排在同一面墙上，只有配色与背景都对上才算当前主题。
import assert from "node:assert/strict";
import test from "node:test";
import { THEME_PRESETS } from "../contract/index";
import {
  CUSTOM_LOOK_PREFIX,
  IMAGE_LOOK_PREFIX,
  PRESET_LOOK_PREFIX,
  buildThemeLooks,
  sameBackgroundChoice,
} from "../client/components/theme-looks";

const BUILTINS = [
  { id: "waterfront", src: "/waterfront.webp", labelZh: "樱花水岸", labelEn: "Cherry Waterfront", preset: "sakura" as const },
  { id: "server", src: "/server.webp", labelZh: "服务机房", labelEn: "Server Room", preset: "midnightInk" as const },
];

test("主题墙 = 5 套纯色主题 + 内置背景主题 + 个人背景主题", () => {
  const looks = buildThemeLooks({
    builtins: BUILTINS,
    customs: [{ id: "uuid-1", name: "my-shot.png" }],
    scheme: "light",
    isZh: true,
    preset: "liquidGlass",
    background: { kind: "default" },
  });

  assert.equal(looks.length, Object.keys(THEME_PRESETS).length + BUILTINS.length + 1);
  assert.equal(looks[0]?.label, "LFAA 液态玻璃");
  assert.equal(looks[0]?.background.kind, "default");
  assert.equal(looks[0]?.sample.image, undefined);

  const waterfront = looks.find((look) => look.id === `${IMAGE_LOOK_PREFIX}waterfront`);
  assert.equal(waterfront?.label, "樱花水岸");
  assert.deepEqual(waterfront?.background, { kind: "builtin", id: "waterfront" });
  assert.equal(waterfront?.sample.background, THEME_PRESETS.sakura.light.background);
  assert.equal(waterfront?.sample.image, "/waterfront.webp");
  assert.equal(waterfront?.active, false);

  const custom = looks.find((look) => look.id === `${CUSTOM_LOOK_PREFIX}uuid-1`);
  assert.equal(custom?.label, "my-shot");
  assert.equal(custom?.deletable, true);
  assert.equal(custom?.sample.image, "/api/backgrounds/uuid-1/file");
});

test("只有配色与背景都对上才算当前主题", () => {
  const imageActive = buildThemeLooks({
    builtins: BUILTINS,
    customs: [],
    scheme: "dark",
    isZh: false,
    preset: "sakura",
    background: { kind: "builtin", id: "waterfront" },
  });
  assert.deepEqual(imageActive.filter((look) => look.active).map((look) => look.id), [`${IMAGE_LOOK_PREFIX}waterfront`]);

  // 同一配色但纯色背景：当前主题变成纯色卡，不是图片卡。
  const solidActive = buildThemeLooks({
    builtins: BUILTINS,
    customs: [],
    scheme: "dark",
    isZh: false,
    preset: "sakura",
    background: { kind: "default" },
  });
  assert.deepEqual(solidActive.filter((look) => look.active).map((look) => look.id), [`${PRESET_LOOK_PREFIX}sakura`]);
});

test("背景选择比较只看类型与 id", () => {
  assert.equal(sameBackgroundChoice({ kind: "default" }, { kind: "default" }), true);
  assert.equal(sameBackgroundChoice({ kind: "builtin", id: "a" }, { kind: "builtin", id: "a" }), true);
  assert.equal(sameBackgroundChoice({ kind: "builtin", id: "a" }, { kind: "builtin", id: "b" }), false);
  assert.equal(sameBackgroundChoice({ kind: "custom", id: "a" }, { kind: "builtin", id: "a" }), false);
});