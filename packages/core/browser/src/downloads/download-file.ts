// 安全命名并提交浏览器下载文件，避免网页文件名越界或并发下载覆盖已有文件。
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, link, mkdir, rm, stat } from "node:fs/promises";
import { extname, isAbsolute, join } from "node:path";

/** 将网页建议名称限制为单个文件名，并兼顾 Windows 保留名。 */
export function downloadFilename(name: string): string {
  const safe = (name.split(/[\\/]/u).pop() ?? "")
    .replace(/[:*?"<>|]/gu, "_")
    .replace(/\p{Cc}/gu, "_")
    .trim()
    .replace(/[. ]+$/u, "");
  if (!safe || /^\.+$/u.test(safe)) return "download";
  const stem = safe.split(".")[0]?.trimEnd() ?? "";
  const prefix = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/iu.test(stem) ? "_" : "";
  const extension = extname(safe);
  const base = safe.slice(0, safe.length - extension.length);
  return prefix + [...base].slice(0, 55).join("") + [...extension].slice(0, 10).join("");
}

/** 在目标目录提交完整文件，保留原文件并在同名时尝试编号。 */
export async function publishDownload(stagedFile: string, directory: string, filename: string) {
  if (!isAbsolute(directory)) throw new Error("下载目录必须是本机绝对路径。");
  await mkdir(directory, { recursive: true });
  const staged = join(directory, `.lfaa-download-${randomUUID()}.tmp`);
  const extension = extname(filename);
  const base = filename.slice(0, filename.length - extension.length);
  let useHardLink = true;
  try {
    await copyFile(stagedFile, staged, constants.COPYFILE_EXCL);
    const { size } = await stat(staged);
    for (let suffix = 0; suffix < 1000; suffix += 1) {
      const finalName = suffix ? `${base} (${suffix})${extension}` : filename;
      const savePath = join(directory, finalName);
      try {
        if (useHardLink) await link(staged, savePath);
        else await copyFile(staged, savePath, constants.COPYFILE_EXCL);
        return { filename: finalName, savePath, sizeBytes: size };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "EEXIST") continue;
        if (useHardLink && (code === "ENOTSUP" || code === "ENOSYS" || code === "EPERM")) {
          useHardLink = false;
          suffix -= 1;
          continue;
        }
        throw error;
      }
    }
    throw new Error("下载目录中的同名文件过多。");
  } finally {
    await rm(staged, { force: true });
  }
}
