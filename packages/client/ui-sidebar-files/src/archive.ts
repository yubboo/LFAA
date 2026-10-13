/**
 * 功能：将选中的受管文件打包为浏览器可下载的 TAR。
 * 作用：批量下载只产生一个有界归档；长路径使用 POSIX PAX 扩展，不静默截断文件名。
 * 关联文件：FileManagerPage.tsx、apps/cli/tests/file-manager-foundation.test.mjs。
 */
export function createTarArchive(files: Array<{ path: string; bytes: Uint8Array }>): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const writeOctal = (header: Uint8Array, offset: number, length: number, value: number) => {
    const text = value.toString(8).padStart(length - 1, "0").slice(-(length - 1)) + "\0";
    header.set(encoder.encode(text), offset);
  };
  const appendTarEntry = (name: string, prefix: string, bytes: Uint8Array, type: "0" | "x") => {
    const header = new Uint8Array(512);
    header.set(encoder.encode(name), 0);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, bytes.length);
    writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    header.fill(32, 148, 156);
    header[156] = type === "x" ? 120 : 48;
    header.set(encoder.encode("ustar\0"), 257);
    header.set(encoder.encode("00"), 263);
    if (prefix) header.set(encoder.encode(prefix), 345);
    const checksum = header.reduce((sum, value) => sum + value, 0);
    const checksumText = checksum.toString(8).padStart(6, "0") + "\0 ";
    header.set(encoder.encode(checksumText), 148);
    chunks.push(header, bytes);
    const padding = (512 - bytes.length % 512) % 512;
    if (padding) chunks.push(new Uint8Array(padding));
  };
  files.forEach((file, index) => {
    if (!file.path || file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").some(part => !part || part === "." || part === "..")) {
      throw new Error("归档包含无效的相对文件路径。");
    }
    const lastSeparator = file.path.lastIndexOf("/");
    const name = lastSeparator >= 0 ? file.path.slice(lastSeparator + 1) : file.path;
    const prefix = lastSeparator >= 0 ? file.path.slice(0, lastSeparator) : "";
    if (encoder.encode(name).length <= 100 && encoder.encode(prefix).length <= 155) {
      appendTarEntry(name, prefix, file.bytes, "0");
      return;
    }
    let recordLength = encoder.encode(`path=${file.path}\n`).length + 2;
    let record = "";
    while (true) {
      record = `${recordLength} path=${file.path}\n`;
      const actualLength = encoder.encode(record).length;
      if (actualLength === recordLength) break;
      recordLength = actualLength;
    }
    appendTarEntry(`PaxHeaders/${index}`, "", encoder.encode(record), "x");
    appendTarEntry(`file-${index}`, "", file.bytes, "0");
  });
  chunks.push(new Uint8Array(1024));
  return new Blob(chunks, { type: "application/x-tar" });
}
