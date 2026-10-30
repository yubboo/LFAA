/**
 * 功能：以同目录临时文件原子提交已经校验的 Minecraft 属性变更。
 * 作用：只合并真实当前文件中由调用方提供的已校验键值，避免整文件重建后覆盖未修改项。
 * 安全边界：调用方负责读取安全文件、核对快照与字段；本模块负责同卷原子替换及写入大小上限。
 */
import { rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { MINECRAFT_PROPERTIES_TOTAL_LIMIT } from "lfaa-util-values/src/minecraft-property-contract.mjs";

export async function commitMinecraftPropertyFile({ propertyPath, temporaryPath, properties, sourceText, changes, assertSafeTarget }) {
  if (!(properties instanceof Map) || typeof sourceText !== "string" || !changes || typeof changes !== "object" || Array.isArray(changes) || typeof assertSafeTarget !== "function") throw new Error("server.properties 写入输入无效。");
  const target = resolve(propertyPath);
  const temporary = resolve(temporaryPath);
  if (dirname(target) !== dirname(temporary)) throw new Error("server.properties 临时文件必须位于同一目录。");
  const seen = new Set();
  const lines = sourceText.split(/(\r\n|\n|\r)/u);
  const updatedLines = [];
  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index] ?? "";
    const lineEnding = lines[index + 1] ?? "";
    const trimmed = line.trim();
    const delimiter = trimmed.indexOf("=");
    const key = !trimmed || trimmed.startsWith("#") || trimmed.startsWith("!") || delimiter < 1 ? null : trimmed.slice(0, delimiter);
    if (key && Object.hasOwn(changes, key)) {
      if (!properties.has(key)) throw new Error(`属性 ${key} 已不在当前 server.properties 中，拒绝写入。`);
      seen.add(key);
      const value = changes[key];
      if (value !== null) updatedLines.push(`${key}=${value}${lineEnding}`);
    } else {
      updatedLines.push(`${line}${lineEnding}`);
    }
  }
  if (seen.size !== Object.keys(changes).length) throw new Error("有属性已不在当前 server.properties 中，拒绝写入。");
  const content = updatedLines.join("");
  if (Buffer.byteLength(content, "utf8") > MINECRAFT_PROPERTIES_TOTAL_LIMIT) throw new Error("server.properties 写入后超过 64 KiB 安全上限。");
  await assertSafeTarget(target);
  await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
  try {
    await assertSafeTarget(target);
    await rename(temporaryPath, target);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return content;
}
