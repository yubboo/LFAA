/**
 * 移植自 deepseek-harness packages/spill/spill-local（MIT, commit 639ed01）。
 * 本地溢出存储：把超大工具结果写到系统临时目录下的 spill 子目录，每个会话一个子文件夹。
 *
 * 文件：index.ts
 * 功能：SpillStore 的本地文件实现。
 * 作用：agent-loop 上下文压力达到 spill 阈值时，用它把巨型工具结果外置。
 * 不负责：决定何时溢出（spill-policy）；也不负责把引用塞回消息（由调用方完成）。
 */
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SpillRef, SpillStore } from "lfaa-spill/src/index.js";

/** 默认溢出根目录：系统临时目录下的 lfaa-spill。 */
export function defaultSpillRoot(): string {
  return join(tmpdir(), "lfaa-spill");
}

/**
 * 创建本地文件 SpillStore。rootDir 缺省时用系统临时目录。
 * 进程内缓存每个会话的子目录路径，避免重复 mkdtemp。
 */
export function createLocalSpillStore(rootDir: string = defaultSpillRoot()): SpillStore {
  const sessionDirs = new Map<string, string>();

  async function sessionDir(sessionId: string): Promise<string> {
    const cached = sessionDirs.get(sessionId);
    if (cached) return cached;
    // 会话目录用 sessionId 派生的安全名（避免路径穿越）。
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dir = join(rootDir, safe);
    await mkdtemp(`${dir}-`).catch(async () => {
      // 目录已存在时直接复用（容错）。
      return dir;
    });
    sessionDirs.set(sessionId, dir);
    return dir;
  }

  return {
    async spill({ sessionId, content }): Promise<SpillRef> {
      const dir = await sessionDir(sessionId);
      const name = `${Date.now()}-${randomUUID()}.txt`;
      const location = join(dir, name);
      await writeFile(location, content, "utf8");
      return {
        backend: "local-file",
        location,
        sizeBytes: Buffer.byteLength(content, "utf8"),
        storedAt: new Date().toISOString()
      };
    },

    async load(ref: SpillRef): Promise<string> {
      if (ref.backend !== "local-file") throw new Error(`spill-local 不支持后端：${ref.backend}`);
      return readFile(ref.location, "utf8");
    },

    async dropSession(sessionId: string): Promise<void> {
      const dir = sessionDirs.get(sessionId);
      if (!dir) return;
      sessionDirs.delete(sessionId);
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
