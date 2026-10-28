import assert from "node:assert/strict";
import test from "node:test";
import { getAssetGroup, isFeaturedMinecraftJar } from "../src/asset-classification.ts";

test("Minecraft JARs keep the registered plugin or mod category", () => {
  assert.equal(getAssetGroup({ artifactKind: "minecraft-plugin", fileName: "plugin.jar" }), "minecraft-plugin");
  assert.equal(getAssetGroup({ artifactKind: "minecraft-mod", fileName: "mod.jar" }), "minecraft-mod");
  assert.equal(isFeaturedMinecraftJar({ artifactKind: "minecraft-plugin", fileName: "plugin.jar" }), true);
  assert.equal(isFeaturedMinecraftJar({ artifactKind: "other", fileName: "library.jar" }), false);
});

test("published Minecraft resources are grouped by file extension", () => {
  assert.equal(getAssetGroup({ artifactKind: "other", fileName: "mob.bbmodel" }), "models");
  assert.equal(getAssetGroup({ artifactKind: "other", fileName: "texture.png" }), "textures");
  assert.equal(getAssetGroup({ artifactKind: "other", fileName: "fabric.mod.json" }), "resources");
  assert.equal(getAssetGroup({ artifactKind: "other", fileName: "notes.txt" }), "other");
});
