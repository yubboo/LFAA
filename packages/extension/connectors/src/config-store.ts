// 用本机独立密钥加密 CLI 连接器配置（环境变量可能带凭据），以原子替换写入 ~/.lfaa/connectors.json。
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CliConnectorConfig } from "../contract";
import { parseCliConnector } from "./cli-config";

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid connector configuration.");
  return value as Record<string, unknown>;
}

export class ConnectorStore {
  constructor(private readonly file: string) {}

  async load(): Promise<CliConnectorConfig[]> {
    let data: Buffer;
    try {
      data = await readFile(this.file);
    } catch (error) {
      if (hasCode(error, "ENOENT")) return [];
      throw error;
    }
    const payload = record(JSON.parse(data.toString("utf8")));
    if (payload.version !== 1 || typeof payload.data !== "string") throw new Error("Invalid connector configuration.");
    const encrypted = Buffer.from(payload.data, "base64");
    const key = await readFile(this.file + ".key");
    const cipher = createDecipheriv("aes-256-gcm", key, encrypted.subarray(0, 12));
    cipher.setAuthTag(encrypted.subarray(12, 28));
    const plain = Buffer.concat([cipher.update(encrypted.subarray(28)), cipher.final()]);
    const connectors = record(record(JSON.parse(plain.toString("utf8"))).connectors);
    return Object.entries(connectors).map(([id, config]) => parseCliConnector(id, config));
  }

  async save(configs: readonly CliConnectorConfig[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const key = await this.key();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const connectors = Object.fromEntries(configs.map((config) => [config.id, config]));
    const bytes = Buffer.concat([cipher.update(JSON.stringify({ connectors }), "utf8"), cipher.final()]);
    const data = Buffer.concat([nonce, cipher.getAuthTag(), bytes]).toString("base64");
    const temporary = this.file + "." + randomUUID();
    await writeFile(temporary, JSON.stringify({ version: 1, data }) + "\n", { mode: 0o600, flag: "wx" });
    try {
      await rename(temporary, this.file);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private async key(): Promise<Buffer> {
    const path = this.file + ".key";
    try {
      return await readFile(path);
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error;
    }
    const temporary = path + "." + randomUUID();
    await writeFile(temporary, randomBytes(32), { mode: 0o600, flag: "wx" });
    try {
      await link(temporary, path);
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    } finally {
      await rm(temporary, { force: true });
    }
    return readFile(path);
  }
}