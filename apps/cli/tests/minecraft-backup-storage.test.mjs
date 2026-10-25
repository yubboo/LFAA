/** Verify Daemon bootstrap keeps game backups under their matching data/backups roots. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { initializeGameBackupDirectories } from "../../../packages/host/daemon/src/minecraft-backup-storage.mjs";

const temporaryRoot = resolve("../../dist/.tmp");
mkdirSync(temporaryRoot, { recursive: true });

function createDataRoot() {
  const dataDirectory = mkdtempSync(join(temporaryRoot, "minecraft-backups-"));
  mkdirSync(join(dataDirectory, "games", "minecraft"), { recursive: true });
  return dataDirectory;
}

test("creates game-scoped backup roots and removes only an empty legacy folder", async () => {
  const dataDirectory = createDataRoot();
  const legacyDirectory = join(dataDirectory, "games", "minecraft-backups");
  mkdirSync(legacyDirectory);
  try {
    const result = await initializeGameBackupDirectories(dataDirectory);
    assert.equal(result.legacyMigration.kind, "removed-empty-legacy-directory");
    assert.ok(existsSync(join(dataDirectory, "backups", "minecraft")));
    assert.ok(existsSync(join(dataDirectory, "backups", "steam")));
    assert.equal(existsSync(legacyDirectory), false);
    assert.deepEqual(readdirSync(join(dataDirectory, "games")).sort(), ["minecraft"]);
  } finally {
    rmSync(dataDirectory, { recursive: true, force: true });
  }
});

test("moves nonempty legacy backup data intact beneath the Minecraft backup root", async () => {
  const dataDirectory = createDataRoot();
  const legacyDirectory = join(dataDirectory, "games", "minecraft-backups");
  mkdirSync(join(legacyDirectory, "world", "region"), { recursive: true });
  writeFileSync(join(legacyDirectory, "world", "region", "r.0.0.mca"), "preserve-this-backup");
  mkdirSync(join(dataDirectory, "backups", "minecraft"), { recursive: true });
  writeFileSync(join(dataDirectory, "backups", "minecraft", "keep.txt"), "existing");
  try {
    const result = await initializeGameBackupDirectories(dataDirectory);
    assert.equal(result.legacyMigration.kind, "moved-legacy-backup-directory");
    assert.ok(result.legacyMigration.targetDirectory.startsWith(join(dataDirectory, "backups", "minecraft")));
    assert.equal(readFileSync(join(result.legacyMigration.targetDirectory, "world", "region", "r.0.0.mca"), "utf8"), "preserve-this-backup");
    assert.equal(readFileSync(join(dataDirectory, "backups", "minecraft", "keep.txt"), "utf8"), "existing");
    assert.equal(existsSync(legacyDirectory), false);
    assert.ok(existsSync(join(dataDirectory, "backups", "steam")));
  } finally {
    rmSync(dataDirectory, { recursive: true, force: true });
  }
});

test("initialization is idempotent after the legacy folder has been handled", async () => {
  const dataDirectory = createDataRoot();
  try {
    await initializeGameBackupDirectories(dataDirectory);
    const second = await initializeGameBackupDirectories(dataDirectory);
    assert.equal(second.legacyMigration, null);
    assert.deepEqual(readdirSync(join(dataDirectory, "backups")).sort(), ["minecraft", "steam"]);
  } finally {
    rmSync(dataDirectory, { recursive: true, force: true });
  }
});
