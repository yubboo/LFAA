// 用本机独立密钥加密所有连接字段，并以原子替换写入 MCP 配置。
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseServer, record, type ServerConfig } from "./server-config";

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export class ConfigStore {
  constructor(private readonly file: string) {}

  async load(): Promise<ServerConfig[]> {
    let data: Buffer;
    try {
      data = await readFile(this.file);
    } catch (error) {
      if (hasCode(error, "ENOENT")) return [];
      throw error;
    }
    const payload = record(JSON.parse(data.toString("utf8")));
    if (payload.version !== 1 || typeof payload.data !== "string") throw new Error("Invalid MCP configuration.");
    const encrypted = Buffer.from(payload.data, "base64");
    const key = await readFile(this.file + ".key");
    const cipher = createDecipheriv("aes-256-gcm", key, encrypted.subarray(0, 12));
    cipher.setAuthTag(encrypted.subarray(12, 28));
    const plain = Buffer.concat([cipher.update(encrypted.subarray(28)), cipher.final()]);
    return Object.entries(record(JSON.parse(plain.toString("utf8")))).map(([id, config]) => parseServer(id, config));
  }

  async save(servers: ServerConfig[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const key = await this.key();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const bytes = Buffer.concat([
      cipher.update(JSON.stringify(Object.fromEntries(servers.map((server) => [server.id, server]))), "utf8"),
      cipher.final(),
    ]);
    const data = Buffer.concat([nonce, cipher.getAuthTag(), bytes]).toString("base64");
    const tmp = this.file + "." + randomUUID();
    await writeFile(tmp, JSON.stringify({ version: 1, data }) + "\n", { mode: 0o600, flag: "wx" });
    try {
      await rename(tmp, this.file);
    } finally {
      await rm(tmp, { force: true });
    }
  }

  private async key(): Promise<Buffer> {
    const path = this.file + ".key";
    try {
      return await readFile(path);
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error;
    }
    const tmp = path + "." + randomUUID();
    await writeFile(tmp, randomBytes(32), { mode: 0o600, flag: "wx" });
    try {
      await link(tmp, path);
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    } finally {
      await rm(tmp, { force: true });
    }
    return readFile(path);
  }
}
