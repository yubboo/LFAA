/**
 * 文件：account-state-repository.ts
 * 作用：Web 开发宿主的 AI 账户元数据与当前模型绑定 JSON Repository。
 * 负责：账户 CRUD、Active Model 持久化、v1→v2 状态迁移、原子写入和 Secret 字段防泄漏扫描。
 * 不负责：Secret 明文、Provider HTTP、最终 SQLite Config Storage。
 * 状态归属：项目本地开发状态；正式 Config Storage 接入后由 Repository Adapter 替换。
 * 对外接口：JsonAiAccountRepository。
 * 关联文件：ai-config-bridge.ts、@lfaa/config-system AiAccountRepositoryPort。
 * 修改注意事项：文件中严禁写入 apiKey/token/password/secret 等明文字段；modelCatalog 只能保存公开模型元数据。
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AiAccountRecord, AiAccountRepositoryPort, AiActiveModelBinding } from "@lfaa/config-system";

interface AccountStateFileV1 { version: 1; accounts: AiAccountRecord[]; }
interface AccountStateFileV2 { version: 2; accounts: AiAccountRecord[]; activeModel: AiActiveModelBinding | null; }
type AccountStateFile = AccountStateFileV1 | AccountStateFileV2;

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

function normalizeAccounts(accounts: readonly AiAccountRecord[]): AiAccountRecord[] {
  return accounts.map((account) => ({
    ...account,
    modelSettings: account.modelSettings ?? {},
    modelCatalog: Array.isArray(account.modelCatalog) ? account.modelCatalog : [],
  }));
}

function fallbackActive(accounts: readonly AiAccountRecord[]): AiActiveModelBinding | null {
  const account = accounts.find((item) => Boolean(item.selectedModelId));
  return account?.selectedModelId ? { accountId: account.id, providerId: account.providerId, modelId: account.selectedModelId } : null;
}

export class JsonAiAccountRepository implements AiAccountRepositoryPort {
  readonly #file: string;
  readonly #dir: string;

  constructor(projectRoot: string) {
    this.#dir = path.join(projectRoot, ".lfaa", "state");
    this.#file = path.join(this.#dir, "ai-accounts.json");
  }

  async #state(): Promise<AccountStateFileV2> {
    try {
      const parsed = JSON.parse(await readFile(this.#file, "utf8")) as AccountStateFile;
      if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.accounts)) throw new Error("AI 账户状态文件格式无效。");
      assertNoPlaintextSecret(parsed);
      const accounts = normalizeAccounts(parsed.accounts);
      return {
        version: 2,
        accounts,
        activeModel: parsed.version === 2 ? parsed.activeModel ?? null : fallbackActive(accounts),
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return { version: 2, accounts: [], activeModel: null };
      throw error;
    }
  }

  async list(): Promise<readonly AiAccountRecord[]> {
    return (await this.#state()).accounts;
  }

  async getActiveModel(): Promise<AiActiveModelBinding | null> {
    return (await this.#state()).activeModel;
  }

  async setActiveModel(binding: AiActiveModelBinding | null): Promise<void> {
    const state = await this.#state();
    await this.#write(state.accounts, binding);
  }

  async put(record: AiAccountRecord): Promise<void> {
    const state = await this.#state();
    const current = [...state.accounts];
    const index = current.findIndex((item) => item.id === record.id);
    if (index >= 0) current[index] = record;
    else current.push(record);
    await this.#write(current, state.activeModel);
  }

  async delete(id: string): Promise<void> {
    const state = await this.#state();
    const accounts = state.accounts.filter((item) => item.id !== id);
    const activeModel = state.activeModel?.accountId === id ? fallbackActive(accounts) : state.activeModel;
    await this.#write(accounts, activeModel);
  }

  async #write(accounts: readonly AiAccountRecord[], activeModel: AiActiveModelBinding | null): Promise<void> {
    const payload: AccountStateFileV2 = { version: 2, accounts: normalizeAccounts(accounts), activeModel };
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
