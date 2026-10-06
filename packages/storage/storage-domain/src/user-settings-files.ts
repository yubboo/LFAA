/**
 * 功能：保存每个账户的设置与应用偏好文件。
 * 作用：把灵活的用户设置从 SQLite 表迁出，并在迁移期间校验旧记录。
 * 关联文件：configuration.ts、settings/settings、util/home-paths/data-layout.mjs。
 */
import { existsSync, lstatSync, readFileSync, rmSync } from "node:fs";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { config } from "lfaa-launch-environment/src/config.js";
import { atomicWrite, decode, encode } from "lfaa-storage-json/src/index.js";

export type UserConfigurationRecord = Record<string, unknown>;

export interface UserSettingsFileDocument {
  version: 1;
  revision: number;
  settings: UserConfigurationRecord[];
  preferences: UserConfigurationRecord | null;
}

const emptyDocument = (): UserSettingsFileDocument => ({ version: 1, revision: 0, settings: [], preferences: null });

export class UserSettingsFiles {
  read(userId: string): UserSettingsFileDocument | null {
    const path = resolveUserDataPaths(config.dataDirectory, userId).settingsDocument;
    if (!existsSync(path)) return null;
    const file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error("用户设置文件类型无效；拒绝跟随链接读取。 ");
    const saved = decode(readFileSync(path, "utf8")) as Partial<UserSettingsFileDocument> | null;
    if (!saved || saved.version !== 1 || !Number.isSafeInteger(saved.revision) || Number(saved.revision) < 0 || !Array.isArray(saved.settings)) {
      throw new Error("用户设置文件损坏或版本不支持；原文件已保留。 ");
    }
    const seen = new Set<string>();
    for (const row of saved.settings) {
      if (!row || typeof row !== "object" || row.user_id !== userId || typeof row.category !== "string" || typeof row.value_json !== "string" || seen.has(row.category)) {
        throw new Error("用户设置文件中的记录无效或重复；原文件已保留。 ");
      }
      seen.add(row.category);
    }
    if (saved.preferences !== null && (!saved.preferences || typeof saved.preferences !== "object" || saved.preferences.user_id !== userId)) {
      throw new Error("用户应用偏好文件中的记录无效；原文件已保留。 ");
    }
    return {
      version: 1,
      revision: Number(saved.revision),
      settings: structuredClone(saved.settings),
      preferences: saved.preferences === null ? null : structuredClone(saved.preferences)
    };
  }

  write(userId: string, settings: UserConfigurationRecord[], preferences: UserConfigurationRecord | null, expected?: UserSettingsFileDocument | null): UserSettingsFileDocument {
    const previous = this.read(userId);
    if (expected !== undefined && encode(previous) !== encode(expected)) throw new Error("用户设置文件已变化，请重启并重新读取后再保存。");
    const next: UserSettingsFileDocument = {
      version: 1,
      revision: (previous?.revision ?? 0) + 1,
      settings: structuredClone(settings),
      preferences: preferences === null ? null : structuredClone(preferences)
    };
    const path = resolveUserDataPaths(config.dataDirectory, userId).settingsDocument;
    atomicWrite(path, next);
    const actual = this.read(userId);
    if (!actual || encode(actual) !== encode(next)) throw new Error("用户设置文件回读校验失败。 ");
    return next;
  }

  removeSettings(userId: string): void {
    const path = resolveUserDataPaths(config.dataDirectory, userId).settingsDocument;
    if (!existsSync(path)) return;
    const file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error("用户设置文件类型无效；拒绝删除链接目标。 ");
    rmSync(path);
  }

  removeUserDirectory(userId: string): void {
    const path = resolveUserDataPaths(config.dataDirectory, userId).root;
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  }
}

export const userSettingsFiles = new UserSettingsFiles();

export function createEmptyUserSettingsDocument(): UserSettingsFileDocument { return emptyDocument(); }
