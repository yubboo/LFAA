/** 功能：长期回归外观预设可移植文件。作用：锁定版本头、素材完整性、唯一背景搬运和失败回滚。关联文件：client/ui-settings/src/AppearancePresetFile.ts。 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_USER_SETTINGS } from "lfaa-util-values/src/settings-contract.js";
import { createAppearancePresetSnapshot } from "lfaa-util-values/src/appearance-presets.js";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { APPEARANCE_PRESET_FILE_MIME_TYPE, APPEARANCE_PRESET_MANIFEST_MAX_BYTES, AppearancePresetCommitUncertainError, createAppearancePresetFile, importAppearancePresetWithAssets, parseAppearancePresetFile } = await import(pathToFileURL(resolve(repo, "packages/client/ui-settings/src/AppearancePresetFile.ts")).href);

function makePreset(snapshot = createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS)) {
  return { id: `preset-${randomUUID()}`, name: "湖畔专注", description: "跨设备外观。", snapshot };
}

function makeRawFile(manifest, assetBytes = []) {
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const header = new Uint8Array(12);
  new TextEncoder().encode("LFAAAP01").forEach((byte, index) => { header[index] = byte; });
  new DataView(header.buffer).setUint32(8, manifestBytes.byteLength, false);
  return new Blob([header, manifestBytes, ...assetBytes], { type: APPEARANCE_PRESET_FILE_MIME_TYPE });
}

test("预设文件往返保留快照并只打包一次重复引用的私有背景", async () => {
  const snapshot = createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS);
  const sourceId = `user-${randomUUID()}`;
  snapshot.appearance.backgrounds.appCenter = sourceId;
  snapshot.appearance.backgrounds.settings = sourceId;
  const sourceBytes = Uint8Array.from([0, 1, 2, 127, 255]);
  let reads = 0;
  const archive = await createAppearancePresetFile(makePreset(snapshot), async (id) => {
    reads += 1;
    assert.equal(id, sourceId);
    return { name: "湖畔.png", mimeType: "image/png", blob: new Blob([sourceBytes], { type: "image/png" }) };
  });

  const parsed = await parseAppearancePresetFile(archive);
  assert.equal(reads, 1);
  assert.equal(parsed.name, "湖畔专注");
  assert.deepEqual(parsed.snapshot, snapshot);
  assert.equal(parsed.assets.length, 1);
  assert.equal(parsed.assets[0].sourceId, sourceId);
  assert.deepEqual(new Uint8Array(await parsed.assets[0].blob.arrayBuffer()), sourceBytes);
});

test("格式解析拒绝无效版本、超大清单、背景长度不符和额外字节", async () => {
  const snapshot = createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS);
  const valid = makePreset(snapshot);
  const manifest = { format: "lfaa-appearance-preset", version: 1, preset: { name: valid.name, description: valid.description, snapshot }, assets: [] };
  const badVersion = makeRawFile({ ...manifest, version: 2 });
  await assert.rejects(parseAppearancePresetFile(badVersion), /版本或清单字段/u);
  const oversizedManifest = makeRawFile({ ...manifest, extra: "x".repeat(APPEARANCE_PRESET_MANIFEST_MAX_BYTES) });
  await assert.rejects(parseAppearancePresetFile(oversizedManifest), /清单长度无效/u);
  const trailingBytes = new Blob([await createAppearancePresetFile(valid, async () => { throw new Error("不应读取素材"); }), Uint8Array.of(1)]);
  await assert.rejects(parseAppearancePresetFile(trailingBytes), /多余内容/u);
  const malformedAsset = makeRawFile({ ...manifest, assets: [{ sourceId: `user-${randomUUID()}`, name: "image.png", mimeType: "image/png", byteLength: 1 }] });
  await assert.rejects(parseAppearancePresetFile(malformedAsset), /素材与快照引用不一致/u);
});

test("导出拒绝自定义登录背景和超过 3 MiB 的素材", async () => {
  const loginSnapshot = createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS);
  loginSnapshot.appearance.backgrounds.login = `user-${randomUUID()}`;
  await assert.rejects(createAppearancePresetFile(makePreset(loginSnapshot), async () => { throw new Error("不应读取素材"); }), /登录页只能使用内置背景/u);

  const oversizedSnapshot = createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS);
  oversizedSnapshot.appearance.backgrounds.appCenter = `user-${randomUUID()}`;
  await assert.rejects(createAppearancePresetFile(makePreset(oversizedSnapshot), async () => ({ name: "huge.png", mimeType: "image/png", blob: new Blob([new Uint8Array(3 * 1024 * 1024 + 1)], { type: "image/png" }) })), /3 MiB/u);
});

test("私有背景逐个重映射；预设保存失败时逆序清理本轮新素材", async () => {
  const snapshot = createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS);
  const firstSourceId = `user-${randomUUID()}`;
  const secondSourceId = `user-${randomUUID()}`;
  snapshot.appearance.backgrounds.appCenter = firstSourceId;
  snapshot.appearance.backgrounds.settings = firstSourceId;
  snapshot.appearance.backgrounds.minecraft = secondSourceId;
  const imported = {
    name: "重映射",
    description: "恢复素材引用",
    snapshot,
    assets: [
      { sourceId: firstSourceId, name: "a.png", mimeType: "image/png", blob: new Blob([Uint8Array.of(1)], { type: "image/png" }) },
      { sourceId: secondSourceId, name: "b.webp", mimeType: "image/webp", blob: new Blob([Uint8Array.of(2)], { type: "image/webp" }) }
    ]
  };
  const uploadedIds = ["user-new-first", "user-new-second"];
  const deletedIds = [];
  let uploadIndex = 0;
  await assert.rejects(importAppearancePresetWithAssets(imported, {
    upload: async (asset) => ({ id: uploadedIds[uploadIndex++], source: asset.sourceId }),
    remove: async (id) => { deletedIds.push(id); },
    commit: async (mapped) => {
      assert.equal(mapped.appearance.backgrounds.appCenter, "user-new-first");
      assert.equal(mapped.appearance.backgrounds.settings, "user-new-first");
      assert.equal(mapped.appearance.backgrounds.minecraft, "user-new-second");
      throw new Error("预设保存失败");
    }
  }), /预设保存失败/u);
  assert.deepEqual(deletedIds, ["user-new-second", "user-new-first"]);
});

test("无法确认预设提交结果时保留可能已被预设引用的素材", async () => {
  const snapshot = createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS);
  const sourceId = `user-${randomUUID()}`;
  snapshot.appearance.backgrounds.appCenter = sourceId;
  const deletedIds = [];
  await assert.rejects(importAppearancePresetWithAssets({
    name: "提交状态未知", description: "网络中断", snapshot,
    assets: [{ sourceId, name: "a.png", mimeType: "image/png", blob: new Blob([Uint8Array.of(1)], { type: "image/png" }) }]
  }, {
    upload: async () => ({ id: "user-created" }),
    remove: async (id) => { deletedIds.push(id); },
    commit: async () => { throw new AppearancePresetCommitUncertainError("无法确认"); }
  }), /无法确认/u);
  assert.deepEqual(deletedIds, []);
});
