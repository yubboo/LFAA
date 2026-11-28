// CLI 代理配置与本地隔离账户持久化：保存在 ~/.lfaa/cli-agents.json，账户目录隔离在 ~/.lfaa/cli-accounts/。
// 关联：packages/host/web-server/src/cli-agents/catalog.ts；运行环境：Node Host。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  CLI_AGENT_CATALOG,
  findCliAgentDefinition,
  type CliAgentAccount,
  type CliAgentDetection,
  type CliAgentMode,
  type CliAgentSnapshot,
  type CliAgentsOverview,
  type CliAgentUserConfig,
} from "./catalog";
import { detectAllCliAgents } from "./detector";

interface PersistedCliAgentsFile {
  version: 1;
  defaultOpenMode: CliAgentMode;
  agents: Record<string, CliAgentUserConfig>;
}

const DEFAULT_PERSISTED: PersistedCliAgentsFile = {
  version: 1,
  defaultOpenMode: "chat",
  agents: {},
};

function defaultAgentConfig(supportsChat: boolean): CliAgentUserConfig {
  return {
    enabled: false,
    openMode: supportsChat ? "chat" : "terminal",
    extraArgs: "",
    activeAccountId: null,
    accounts: [],
  };
}

/** 管理 CLI 代理配置、本机探测缓存与隔离账户目录。 */
export class CliAgentsStore {
  private readonly configPath: string;
  private readonly accountsRoot: string;
  private detectionCache: Record<string, CliAgentDetection> | null = null;

  constructor(options?: { configPath?: string; accountsRoot?: string }) {
    const base = join(homedir(), ".lfaa");
    this.configPath = resolve(options?.configPath ?? join(base, "cli-agents.json"));
    this.accountsRoot = resolve(options?.accountsRoot ?? join(base, "cli-accounts"));
  }

  private async readConfig(): Promise<PersistedCliAgentsFile> {
    try {
      const raw = await readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PersistedCliAgentsFile>;
      return {
        version: 1,
        defaultOpenMode: parsed.defaultOpenMode === "terminal" ? "terminal" : "chat",
        agents: parsed.agents && typeof parsed.agents === "object" ? parsed.agents : {},
      };
    } catch {
      return { ...DEFAULT_PERSISTED, agents: {} };
    }
  }

  private async writeConfig(data: PersistedCliAgentsFile): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(data, null, 2), "utf8");
  }

  async getOverview(options?: { refresh?: boolean }): Promise<CliAgentsOverview> {
    if (options?.refresh || !this.detectionCache) {
      this.detectionCache = await detectAllCliAgents();
    }
    const persisted = await this.readConfig();
    const agents: CliAgentSnapshot[] = CLI_AGENT_CATALOG.map((def) => {
      const det = this.detectionCache?.[def.id];
      const saved = persisted.agents[def.id] ?? defaultAgentConfig(def.supportsChat);
      return {
        id: def.id,
        name: def.name,
        vendor: def.vendor,
        binary: def.binary,
        descriptionZh: def.descriptionZh,
        descriptionEn: def.descriptionEn,
        supportsChat: def.supportsChat,
        supportsAccounts: Boolean(def.accountEnvVar),
        accountEnvVar: def.accountEnvVar ?? null,
        loginCommand: def.loginCommand,
        terminalCommand: def.terminalCommand,
        installHint: def.installHint,
        docsUrl: def.docsUrl,
        installed: det?.installed ?? false,
        binaryPath: det?.binaryPath ?? null,
        version: det?.version ?? null,
        systemLoginDetected: det?.systemLoginDetected ?? false,
        enabled: saved.enabled,
        openMode: saved.openMode,
        extraArgs: saved.extraArgs,
        activeAccountId: saved.activeAccountId,
        accounts: saved.accounts,
      };
    });
    return { defaultOpenMode: persisted.defaultOpenMode, agents };
  }

  async updateGlobal(patch: { defaultOpenMode?: CliAgentMode }): Promise<CliAgentsOverview> {
    const data = await this.readConfig();
    if (patch.defaultOpenMode === "chat" || patch.defaultOpenMode === "terminal") {
      data.defaultOpenMode = patch.defaultOpenMode;
    }
    await this.writeConfig(data);
    return this.getOverview();
  }

  async updateAgent(
    agentId: string,
    patch: Partial<Pick<CliAgentUserConfig, "enabled" | "openMode" | "extraArgs" | "activeAccountId">>,
  ): Promise<CliAgentsOverview> {
    const def = findCliAgentDefinition(agentId);
    if (!def) throw new Error(`未知的 CLI 代理：${agentId}`);
    const data = await this.readConfig();
    const current = data.agents[agentId] ?? defaultAgentConfig(def.supportsChat);
    const next: CliAgentUserConfig = {
      ...current,
      ...(typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}),
      ...(patch.openMode === "chat" || patch.openMode === "terminal" ? { openMode: patch.openMode } : {}),
      ...(typeof patch.extraArgs === "string" ? { extraArgs: patch.extraArgs.trim() } : {}),
      ...(patch.activeAccountId !== undefined
        ? {
            activeAccountId:
              patch.activeAccountId === null || patch.activeAccountId === ""
                ? null
                : current.accounts.some((a) => a.id === patch.activeAccountId)
                  ? patch.activeAccountId
                  : current.activeAccountId,
          }
        : {}),
    };
    data.agents[agentId] = next;
    await this.writeConfig(data);
    return this.getOverview();
  }

  /** 为指定 CLI 代理创建独立本地登录上下文目录并登记为受管账户。 */
  async addAccount(agentId: string, label: string): Promise<{ account: CliAgentAccount; overview: CliAgentsOverview }> {
    const def = findCliAgentDefinition(agentId);
    if (!def) throw new Error(`未知的 CLI 代理：${agentId}`);
    if (!def.accountEnvVar) throw new Error(`${def.name} 暂不支持本地多账户隔离。`);
    const cleanLabel = label.trim() || `账户 ${Date.now().toString().slice(-4)}`;
    const accountId = randomUUID().slice(0, 8);
    const homeDir = join(this.accountsRoot, agentId, accountId);
    await mkdir(homeDir, { recursive: true });

    const data = await this.readConfig();
    const current = data.agents[agentId] ?? defaultAgentConfig(def.supportsChat);
    const account: CliAgentAccount = {
      id: accountId,
      label: cleanLabel,
      homeDir,
      createdAt: Date.now(),
    };
    data.agents[agentId] = {
      ...current,
      accounts: [...current.accounts, account],
      activeAccountId: accountId,
    };
    await this.writeConfig(data);
    return { account, overview: await this.getOverview() };
  }

  /** 删除受管账户及其隔离目录；若删除的是当前激活账户，自动回退到系统默认登录。 */
  async removeAccount(agentId: string, accountId: string): Promise<CliAgentsOverview> {
    const def = findCliAgentDefinition(agentId);
    if (!def) throw new Error(`未知的 CLI 代理：${agentId}`);
    const data = await this.readConfig();
    const current = data.agents[agentId];
    if (!current) return this.getOverview();
    const target = current.accounts.find((a) => a.id === accountId);
    if (target) {
      await rm(target.homeDir, { recursive: true, force: true }).catch(() => undefined);
    }
    const nextAccounts = current.accounts.filter((a) => a.id !== accountId);
    data.agents[agentId] = {
      ...current,
      accounts: nextAccounts,
      activeAccountId: current.activeAccountId === accountId ? null : current.activeAccountId,
    };
    await this.writeConfig(data);
    return this.getOverview();
  }

  /** 为指定 CLI 构造子进程环境变量增量（仅注入当前选定受管账户的隔离目录）。 */
  async resolveAgentExecution(agentId: string): Promise<{
    snapshot: CliAgentSnapshot;
    envOverlay: Record<string, string>;
    activeAccount: CliAgentAccount | null;
  }> {
    const overview = await this.getOverview();
    const snapshot = overview.agents.find((a) => a.id === agentId);
    if (!snapshot) throw new Error(`未知的 CLI 代理：${agentId}`);
    const activeAccount = snapshot.activeAccountId
      ? snapshot.accounts.find((a) => a.id === snapshot.activeAccountId) ?? null
      : null;
    const envOverlay: Record<string, string> = {};
    if (activeAccount && snapshot.accountEnvVar) {
      await mkdir(activeAccount.homeDir, { recursive: true });
      envOverlay[snapshot.accountEnvVar] = activeAccount.homeDir;
    }
    return { snapshot, envOverlay, activeAccount };
  }
}
