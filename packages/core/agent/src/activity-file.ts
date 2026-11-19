// 读取成功文件步骤关联的当前文本，只允许访问会话授权工作区。
import { open } from "node:fs/promises";
import { resolveSafeWorkspacePath } from "@lfaa/tools";
import type { AgentFileChange } from "@lfaa/memory";

/** 打开校验后的实际文件并限制读取长度，同时将非文本文件交给错误反馈。 */
export async function readActivitySource(change: AgentFileChange, roots: string[]) {
  const { path } = await resolveSafeWorkspacePath(change.resolvedPath ?? change.path, roots);
  const limit = 96 * 1024;
  const file = await open(path, "r");
  try {
    if (!(await file.stat()).isFile()) throw new Error("只能预览普通文本文件。");
    const buffer = Buffer.alloc(limit + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const { bytesRead } = await file.read(buffer, bytes, buffer.length - bytes, bytes);
      if (!bytesRead) break;
      bytes += bytesRead;
    }
    const content = buffer.subarray(0, Math.min(bytes, limit));
    if (content.includes(0)) throw new Error("此文件不是可预览的文本。");
    const truncated = bytes > limit;
    return {
      content: new TextDecoder("utf-8", { fatal: true }).decode(content, { stream: truncated }),
      truncated,
    };
  } finally {
    await file.close();
  }
}
