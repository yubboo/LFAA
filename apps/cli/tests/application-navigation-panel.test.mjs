import assert from "node:assert/strict";
import test from "node:test";
import { buildApplicationNavigationGroups } from "lfaa-client-ui-workspace/src/application-workspace/application-navigation-model.js";

test("应用导航将领域应用与 Canvas 共享能力分组并保留活动项规则", () => {
  const items = [
    { id: "minecraft", title: "Minecraft", applicationId: "minecraft" },
    { id: "games", title: "游戏", route: "/games" },
    { id: "canvas", title: "画布", applicationId: "workspace" },
  ];
  const groups = buildApplicationNavigationGroups("minecraft", items, true, () => undefined, async () => undefined);

  assert.deepEqual(groups.map(group => group.id), ["module-context-domain-applications", "module-context-shared-capabilities"]);
  assert.deepEqual(groups[0].items.map(item => item.id), ["module-context-application-minecraft", "module-context-application-games"]);
  assert.deepEqual(groups[1].items.map(item => item.id), ["module-context-application-canvas"]);
  assert.equal(groups[0].items[0].active, true);
  assert.equal(groups[0].items[1].active, true);
  assert.equal(groups[1].items[0].active, false);
});

test("应用导航优先执行真实路由，否则沿现有回调打开应用", async () => {
  const navigated = [];
  const opened = [];
  const groups = buildApplicationNavigationGroups("workspace", [
    { id: "games", title: "游戏", route: "/games", applicationId: "minecraft" },
    { id: "minecraft", title: "Minecraft", applicationId: "minecraft" },
  ], false, path => navigated.push(path), async (app, mode) => { opened.push({ app, mode }); });

  groups[0].items[0].onSelect();
  groups[0].items[1].onSelect();
  await Promise.resolve();

  assert.deepEqual(navigated, ["/games"]);
  assert.deepEqual(opened, [{ app: "minecraft", mode: "ai-work" }]);
});
