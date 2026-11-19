// 定义 LFAA 资料库目录规范常量（data/ 下仅放 agent-outputs、user-assets、long-term-memory.json、vault-index.json），历史会话固定存放在 ~/.lfaa/sessions。
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LibraryAssetItem } from "./types";

/** 记录新资料库在数据根路径下使用的目录名称。 */
export const VAULT_DIRS = {
  artifacts: "agent-outputs",
  assets: "user-assets",
} as const;

/** 记录资料库的配置、索引与说明文件名。 */
export const VAULT_FILES = {
  longTermMemory: "long-term-memory.json",
  vaultIndex: "vault-index.json",
} as const;

/** 集中描述初始化时可能存在的旧版目录布局。 */
export const LEGACY_VAULT_DIRS = {
  artifacts: "artifacts",
  assets: "assets",
  sessions: "sessions",
  misplacedChatSessions: "chat-sessions",
} as const;

/** 集中描述读取旧档案时使用的历史文件名。 */
export const LEGACY_VAULT_FILES = {
  longTermMemory: "memory.json",
  vaultIndex: "library-index.json",
} as const;

async function moveDirEntries(fromDir: string, toDir: string): Promise<void> {
  if (!existsSync(fromDir)) return;
  const entries = await readdir(fromDir, { withFileTypes: true }).catch(() => []);
  if (entries.length === 0) {
    await rm(fromDir, { recursive: true, force: true }).catch(() => {});
    return;
  }
  await mkdir(toDir, { recursive: true });
  for (const entry of entries) {
    const src = join(fromDir, entry.name);
    const dst = join(toDir, entry.name);
    if (entry.isDirectory()) {
      await moveDirEntries(src, dst);
    } else if (!existsSync(dst)) {
      await rename(src, dst).catch(async () => {
        await copyFile(src, dst);
        await rm(src, { force: true });
      });
    }
  }
  const remaining = await readdir(fromDir).catch(() => ["keep"]);
  if (remaining.length === 0) {
    await rm(fromDir, { recursive: true, force: true }).catch(() => {});
  }
}

// 将旧版 data/ 命名无损升级，并把误放入 data/ 的历史会话文件无损归位到本机固定 ~/.lfaa/sessions 目录。
export async function upgradeVaultLayoutInRoot(rootDir: string, fixedSessionsDir?: string): Promise<void> {
  if (!existsSync(rootDir)) return;

  const dirPairs: Array<[string, string]> = [
    [LEGACY_VAULT_DIRS.artifacts, VAULT_DIRS.artifacts],
    [LEGACY_VAULT_DIRS.assets, VAULT_DIRS.assets],
  ];
  for (const [oldName, newName] of dirPairs) {
    const oldPath = join(rootDir, oldName);
    const newPath = join(rootDir, newName);
    if (existsSync(oldPath)) {
      if (!existsSync(newPath)) {
        await rename(oldPath, newPath).catch(() => moveDirEntries(oldPath, newPath));
      } else {
        await moveDirEntries(oldPath, newPath);
      }
    }
  }

  // 将之前放入 data/chat-sessions 或 data/sessions 的会话文件无损归还到 ~/.lfaa/sessions（不跟随项目目录）。
  if (fixedSessionsDir) {
    await mkdir(fixedSessionsDir, { recursive: true });
    for (const misplaced of [LEGACY_VAULT_DIRS.misplacedChatSessions, LEGACY_VAULT_DIRS.sessions]) {
      const srcDir = join(rootDir, misplaced);
      if (!existsSync(srcDir)) continue;
      const entries = await readdir(srcDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const src = join(srcDir, entry.name);
        const dst = join(fixedSessionsDir, entry.name);
        if (!existsSync(dst)) {
          await rename(src, dst).catch(async () => {
            await copyFile(src, dst);
            await rm(src, { force: true });
          });
        } else {
          await rm(src, { force: true }).catch(() => {});
        }
      }
      await rm(srcDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  const oldMem = join(rootDir, LEGACY_VAULT_FILES.longTermMemory);
  const newMem = join(rootDir, VAULT_FILES.longTermMemory);
  if (existsSync(oldMem) && !existsSync(newMem)) {
    await rename(oldMem, newMem).catch(async () => {
      await copyFile(oldMem, newMem);
      await rm(oldMem, { force: true });
    });
  }

  const oldIdx = join(rootDir, LEGACY_VAULT_FILES.vaultIndex);
  const newIdx = join(rootDir, VAULT_FILES.vaultIndex);
  if (existsSync(oldIdx) && !existsSync(newIdx)) {
    try {
      const raw = await readFile(oldIdx, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rewritten = (parsed as LibraryAssetItem[]).map((item) => {
          const rel = (item.relativePath ?? "").replaceAll("\\", "/");
          if (rel.startsWith(`${LEGACY_VAULT_DIRS.artifacts}/`)) {
            return { ...item, relativePath: `${VAULT_DIRS.artifacts}/${rel.slice(LEGACY_VAULT_DIRS.artifacts.length + 1)}` };
          }
          if (rel.startsWith(`${LEGACY_VAULT_DIRS.assets}/`)) {
            return { ...item, relativePath: `${VAULT_DIRS.assets}/${rel.slice(LEGACY_VAULT_DIRS.assets.length + 1)}` };
          }
          return item;
        });
        await writeFile(newIdx, JSON.stringify(rewritten, null, 2), "utf8");
        await rm(oldIdx, { force: true }).catch(() => {});
      }
    } catch {
      await rename(oldIdx, newIdx).catch(() => {});
    }
  }
}
