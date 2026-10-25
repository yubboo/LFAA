/**
 * 移植自 deepseek-harness packages/spill/spill-local（MIT, commit 639ed01）。
 * 本地溢出存储：把超大工具结果写到私有目录下的独立会话子目录。
 *
 * 文件：index.ts
 * 功能：SpillStore 的本地文件实现。
 * 作用：为上层 Agent Context Owner 提供本机文件存储能力。
 * 不负责：决定何时溢出（spill-policy）；也不负责把引用塞回消息（由调用方完成）。
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { protectPrivateDirectory } from "lfaa-home-paths/src/private-directory.mjs";
import { MAX_SPILL_READ_CHARACTERS, type SpillRef, type SpillStore } from "lfaa-spill/src/index.js";

/** 默认溢出根目录：系统临时目录下的 lfaa-spill。 */
export function defaultSpillRoot(): string {
  return join(tmpdir(), "lfaa-spill");
}

/**
 * 创建本地文件 SpillStore。rootDir 缺省时用系统临时目录。
 * 进程内缓存每个会话的子目录路径，避免重复 mkdtemp。
 */
export function createLocalSpillStore(rootDir: string = defaultSpillRoot()): SpillStore {
  const storageRoot = resolve(rootDir);
  const sessionDirs = new Map<string, Promise<string>>();
  const references = new Map<string, { sessionId: string; location: string; totalCharacters: number; byteOffsets: Array<{ characters: number; bytes: number }> }>();

  function indexUtf8Characters(content: string): { totalCharacters: number; byteOffsets: Array<{ characters: number; bytes: number }> } {
    const byteOffsets = [{ characters: 0, bytes: 0 }];
    let totalCharacters = 0, bytes = 0;
    for (const character of content) {
      totalCharacters += 1;
      bytes += Buffer.byteLength(character, "utf8");
      if (totalCharacters % 4096 === 0) byteOffsets.push({ characters: totalCharacters, bytes });
    }
    return { totalCharacters, byteOffsets };
  }

  async function ensurePrivateRoot(): Promise<void> {
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    protectPrivateDirectory(storageRoot);
  }

  async function sessionDir(sessionId: string): Promise<string> {
    const cached = sessionDirs.get(sessionId);
    if (cached) return cached;
    // 不将原始 Session ID 写入路径；mkdtemp 返回的新目录才是实际存储目录。
    const safe = createHash("sha256").update(sessionId, "utf8").digest("hex").slice(0, 24);
    const creating = (async () => {
      await ensurePrivateRoot();
      return mkdtemp(join(storageRoot, `${safe}-`));
    })();
    sessionDirs.set(sessionId, creating);
    try {
      return await creating;
    } catch (error) {
      if (sessionDirs.get(sessionId) === creating) sessionDirs.delete(sessionId);
      throw error;
    }
  }

  function containsPath(directory: string, target: string): boolean {
    const relativePath = relative(directory, target);
    return relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
  }

  return {
    async spill({ sessionId, content }): Promise<SpillRef> {
      const dir = await sessionDir(sessionId);
      const referenceId = randomUUID();
      const location = join(dir, `${Date.now()}-${referenceId}.txt`);
      const index = indexUtf8Characters(content);
      await writeFile(location, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
      references.set(referenceId, { sessionId, location, ...index });
      return {
        backend: "local-file",
        location: referenceId,
        sizeBytes: Buffer.byteLength(content, "utf8"),
        storedAt: new Date().toISOString()
      };
    },

    async load(ref: SpillRef): Promise<string> {
      if (ref.backend !== "local-file") throw new Error(`spill-local 不支持后端：${ref.backend}`);
      const entry = references.get(ref.location);
      const pendingRoot = entry && sessionDirs.get(entry.sessionId);
      if (!entry || !pendingRoot) throw new Error("spill-local 只允许读取当前存储实例创建的会话文件。");
      const sessionRoot = await pendingRoot;
      if (!containsPath(sessionRoot, entry.location)) throw new Error("spill-local 拒绝读取会话目录之外的文件。");
      const [metadata, actualLocation] = await Promise.all([lstat(entry.location), realpath(entry.location)]);
      if (!metadata.isFile() || metadata.isSymbolicLink() || !containsPath(sessionRoot, actualLocation)) {
        throw new Error("spill-local 拒绝读取会话目录之外或重定向的文件。");
      }
      return readFile(actualLocation, "utf8");
    },

    async readRange(ref: SpillRef, { offset, limit }): Promise<{ text: string; totalCharacters: number }> {
      if (ref.backend !== "local-file") throw new Error(`spill-local 不支持后端：${ref.backend}`);
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SPILL_READ_CHARACTERS || offset > Number.MAX_SAFE_INTEGER - limit) {
        throw new Error("spill-local 的字符范围无效或超出单次读取上限。");
      }
      const entry = references.get(ref.location);
      const pendingRoot = entry && sessionDirs.get(entry.sessionId);
      if (!entry || !pendingRoot) throw new Error("spill-local 只允许读取当前存储实例创建的会话文件。");
      const sessionRoot = await pendingRoot;
      if (!containsPath(sessionRoot, entry.location)) throw new Error("spill-local 拒绝读取会话目录之外的文件。");
      const [metadata, actualLocation] = await Promise.all([lstat(entry.location), realpath(entry.location)]);
      if (!metadata.isFile() || metadata.isSymbolicLink() || !containsPath(sessionRoot, actualLocation)) {
        throw new Error("spill-local 拒绝读取会话目录之外或重定向的文件。");
      }
      if (offset >= entry.totalCharacters) return { text: "", totalCharacters: entry.totalCharacters };
      let low = 0, high = entry.byteOffsets.length;
      while (low + 1 < high) {
        const middle = (low + high) >>> 1;
        if (entry.byteOffsets[middle]!.characters <= offset) low = middle;
        else high = middle;
      }
      const checkpoint = entry.byteOffsets[low]!;
      let skipCharacters = offset - checkpoint.characters;
      let remaining = Math.min(limit, Math.max(0, entry.totalCharacters - offset));
      const pieces: string[] = [];
      const stream = createReadStream(actualLocation, { start: checkpoint.bytes, encoding: "utf8", highWaterMark: 64 * 1024 });
      try {
        for await (const chunk of stream) {
          for (const character of chunk) {
            if (skipCharacters > 0) { skipCharacters -= 1; continue; }
            if (remaining <= 0) break;
            pieces.push(character);
            remaining -= 1;
          }
          if (remaining <= 0) break;
        }
      } finally {
        stream.destroy();
      }
      return { text: pieces.join(""), totalCharacters: entry.totalCharacters };
    },

    async dropSession(sessionId: string): Promise<void> {
      const pendingDir = sessionDirs.get(sessionId);
      if (!pendingDir) return;
      sessionDirs.delete(sessionId);
      for (const [referenceId, entry] of references) if (entry.sessionId === sessionId) references.delete(referenceId);
      const dir = await pendingDir;
      await rm(dir, { recursive: true, force: true });
    }
  };
}

/** Cordis 服务：提供本地文件 SpillStore 工厂。 */
import type { Context } from "@deepseek-ai/cordis";
export const name = "lfaaSpillLocal";
export const inject = [] as const;
export function apply(ctx: Context): void {
  ctx.provide(name, { createLocalSpillStore });
}
