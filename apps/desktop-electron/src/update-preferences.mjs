import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { compareStableVersions } from "./update-manifest.mjs";

const DEFAULT_PREFERENCES = Object.freeze({ autoDownloadAndInstall: false, ignoredVersion: "" });
const MAX_PREFERENCES_BYTES = 4 * 1024;

function normalizePreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_PREFERENCES };
  const ignoredVersion = typeof value.ignoredVersion === "string" ? value.ignoredVersion : "";
  let validIgnoredVersion = "";
  if (ignoredVersion) {
    try {
      compareStableVersions(ignoredVersion, ignoredVersion);
      validIgnoredVersion = ignoredVersion;
    } catch {
      validIgnoredVersion = "";
    }
  }
  return {
    autoDownloadAndInstall: value.autoDownloadAndInstall === true,
    ignoredVersion: validIgnoredVersion
  };
}

export function createDesktopUpdatePreferencesStore(filePath) {
  let writeQueue = Promise.resolve();

  async function read() {
    await writeQueue;
    try {
      const contents = await readFile(filePath, "utf8");
      if (Buffer.byteLength(contents, "utf8") > MAX_PREFERENCES_BYTES) return { ...DEFAULT_PREFERENCES };
      return normalizePreferences(JSON.parse(contents));
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  function update(mutator) {
    const operation = writeQueue.then(async () => {
      const current = await readFile(filePath, "utf8")
        .then(contents => Buffer.byteLength(contents, "utf8") <= MAX_PREFERENCES_BYTES ? normalizePreferences(JSON.parse(contents)) : { ...DEFAULT_PREFERENCES })
        .catch(() => ({ ...DEFAULT_PREFERENCES }));
      const next = normalizePreferences(mutator(current));
      await mkdir(dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        await rename(temporaryPath, filePath);
      } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
      }
      return next;
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  return Object.freeze({
    read,
    setAutoDownloadAndInstall(enabled) {
      if (typeof enabled !== "boolean") throw new TypeError("自动更新偏好必须是布尔值。");
      return update(current => ({ ...current, autoDownloadAndInstall: enabled }));
    },
    ignoreVersion(version) {
      if (typeof version !== "string") throw new TypeError("跳过的更新版本无效。");
      try {
        compareStableVersions(version, version);
      } catch {
        throw new TypeError("跳过的更新版本无效。");
      }
      return update(current => ({ ...current, ignoredVersion: version }));
    }
  });
}
