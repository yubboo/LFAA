/**
 * 文件：account-state-repository.ts
 * 作用：Web 开发宿主的 AI 账户元数据仓库。
 * 负责：把不含 Secret 的账户记录原子写入 .lfaa/state/ai-accounts.json。
 * 不负责：Secret、Provider HTTP、最终 SQLite Config Storage。
 * 状态归属：项目本地开发状态；正式 Config Storage 接入后由 Repository Adapter 替换。
 * 对外接口：JsonAiAccountRepository。
 * 关联文件：ai-config-bridge.ts、@lfaa/config-system AiAccountRepositoryPort。
 * 修改注意事项：文件中严禁写入 apiKey/token/password/secret 等明文字段。
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AiAccountRecord, AiAccountRepositoryPort } from "@lfaa/config-system";

interface AccountStateFile { version: 1; accounts: AiAccountRecord[]; }

function assertNoPlaintextSecret(value: unknown, pathText = "root"): void {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[-_]/g, "");
    if (["apikey", "accesstoken", "refreshtoken", "password", "passwd", "secret", "clientsecret", "privatekey"].includes(normalized)) {
      throw new Error(`账户状态禁止 Secret 字段：${pathText}.${key}`);
    }
    assertNoPlaintextSecret(item, `${pathText}.${key}`);
  }
}

export class JsonAiAccountRepository implements AiAccountRepositoryPort {
  readonly #file: string;
  readonly #dir: string;

  constructor(projectRoot: string) {
    this.#dir = path.join(projectRoot, ".lfaa", "state");
    this.#file = path.join(this.#dir, "ai-accounts.json");
  }

  async list(): Promise<readonly AiAccountRecord[]> {
    try {
      const parsed = JSON.parse(await readFile(this.#file, "utf8")) as AccountStateFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.accounts)) throw new Error("AI 账户状态文件格式无效。");
      assertNoPlaintextSecret(parsed);
      return parsed.accounts;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
      throw error;
    }
  }

  async put(record: AiAccountRecord): Promise<void> {
    const current = [...await this.list()];
    const index = current.findIndex((item) => item.id === record.id);
    if (index >= 0) current[index] = record;
    else current.push(record);
    await this.#write(current);
  }

  async delete(id: string): Promise<void> {
    const current = [...await this.list()];
    await this.#write(current.filter((item) => item.id !== id));
  }

  async #write(accounts: readonly AiAccountRecord[]): Promise<void> {
    const payload: AccountStateFile = { version: 1, accounts: [...accounts] };
    assertNoPlaintextSecret(payload);
    await mkdir(this.#dir, { recursive: true });
    const temp = `${this.#file}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temp, this.#file);
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
  }
}
