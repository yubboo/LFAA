// 单轮代码修改「安全气囊」：在 Agent 单轮首次写入/编辑某个文件前记录原文快照，支持按消息轮次一键无损撤销。
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** 单文件改前快照条目：只保存本轮首次触碰前的状态，绝不触碰用户其他未提交文件。 */
export interface TurnFileSnapshotEntry {
  filePath: string;
  existed: boolean;
  /** 改前内容的 Base64（existed=true 时存在）。 */
  beforeBase64?: string;
  /** 改前内容的 SHA-256 哈希，用于审计。 */
  beforeSha256?: string;
}

export interface TurnSnapshotRecord {
  sessionId: string;
  assistantMessageId: string;
  createdAt: number;
  files: Record<string, TurnFileSnapshotEntry>;
}

export interface UndoTurnResult {
  restored: string[];
  removed: string[];
  skipped: Array<{ filePath: string; reason: string }>;
}

const MAX_SNAPSHOT_FILE_BYTES = 2 * 1024 * 1024;

function sanitizeSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]+/gu, "_").slice(0, 120) || "default";
}

function snapshotFilePath(sessionId: string, assistantMessageId: string, rootDir?: string): string {
  const base = rootDir ?? join(homedir(), ".lfaa", "snapshots");
  return join(base, sanitizeSegment(sessionId), `${sanitizeSegment(assistantMessageId)}.json`);
}

function resolveTargetPath(rawPath: string, workspaceRoots: string[]): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  const primary = workspaceRoots[0]?.trim();
  if (isAbsolute(trimmed)) return resolve(trimmed);
  if (!primary) return null;
  return resolve(primary, trimmed);
}

/** 在 write_file / edit_file 执行前记录该文件在本轮的初始状态（同一文件一轮只记一次）。 */
export async function captureBeforeMutation(
  sessionId: string,
  assistantMessageId: string,
  rawPath: string,
  workspaceRoots: string[],
  rootDir?: string,
): Promise<void> {
  const target = resolveTargetPath(rawPath, workspaceRoots);
  if (!target) return;
  const storePath = snapshotFilePath(sessionId, assistantMessageId, rootDir);
  let record: TurnSnapshotRecord;
  try {
    record = JSON.parse(await readFile(storePath, "utf8")) as TurnSnapshotRecord;
  } catch {
    record = { sessionId, assistantMessageId, createdAt: Date.now(), files: {} };
  }
  const key = process.platform === "win32" ? target.toLowerCase() : target;
  if (record.files[key]) return;

  try {
    const buf = await readFile(target);
    if (buf.length > MAX_SNAPSHOT_FILE_BYTES) return;
    record.files[key] = {
      filePath: target,
      existed: true,
      beforeBase64: buf.toString("base64"),
      beforeSha256: createHash("sha256").update(buf).digest("hex"),
    };
  } catch {
    record.files[key] = { filePath: target, existed: false };
  }

  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(record, null, 2), "utf8");
}

/** 按消息轮次撤销该轮 Agent 的全部文件写入/编辑（已存在文件还原原文，新建文件删除）。 */
export async function undoTurnChanges(
  sessionId: string,
  assistantMessageId: string,
  rootDir?: string,
): Promise<UndoTurnResult> {
  const storePath = snapshotFilePath(sessionId, assistantMessageId, rootDir);
  let record: TurnSnapshotRecord;
  try {
    record = JSON.parse(await readFile(storePath, "utf8")) as TurnSnapshotRecord;
  } catch {
    throw new Error("未找到该轮次的改前快照，无法撤销。");
  }
  const restored: string[] = [];
  const removed: string[] = [];
  const skipped: Array<{ filePath: string; reason: string }> = [];

  for (const entry of Object.values(record.files)) {
    try {
      if (entry.existed) {
        if (typeof entry.beforeBase64 !== "string") {
          skipped.push({ filePath: entry.filePath, reason: "快照内容缺失" });
          continue;
        }
        await mkdir(dirname(entry.filePath), { recursive: true });
        await writeFile(entry.filePath, Buffer.from(entry.beforeBase64, "base64"));
        restored.push(entry.filePath);
      } else {
        await rm(entry.filePath, { force: true });
        removed.push(entry.filePath);
      }
    } catch (error) {
      skipped.push({
        filePath: entry.filePath,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { restored, removed, skipped };
}
