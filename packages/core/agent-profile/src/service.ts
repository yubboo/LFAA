// @lfaa/agent-profile Host 服务：agent 定义与模型绑定的读写、校验、内置项保护与默认回落。
// 存两份额外配置文件（agents.json / bindings.json），写操作串行化，避免并发覆盖掉别人的改动。
import { join } from "node:path";
import { homedir } from "node:os";
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { readSnapshot, sanitizeAgents, sanitizeBindings, sanitizeToolPolicy } from "./sanitize";
import { JsonFileStore } from "./store";
import { requireAgentId, requireAgentName, requireCooldown, requireInstructions, requireTargets } from "./validate";
import {
  BUILTIN_AGENT_ID,
  DEFAULT_BINDING_ID,
  createAgentId,
  normalizeAgentKind,
  normalizeBindingOnError,
  normalizeBindingStrategy,
  normalizeName,
  resolveBindingIdFor,
  type AgentCreateInput,
  type AgentDefinition,
  type AgentProfileSnapshot,
  type AgentUpdateInput,
  type BindingCreateInput,
  type BindingUpdateInput,
  type ModelBinding,
} from "./types";

/** 服务配置：测试可指向临时文件，避免污染真实用户目录。 */
export interface AgentProfilePluginConfig {
  agentsFilePath?: string;
  bindingsFilePath?: string;
}

const defaultAgentsFile = () => join(homedir(), ".lfaa", "agents.json");
const defaultBindingsFile = () => join(homedir(), ".lfaa", "bindings.json");

/** agent 定义与模型绑定服务：也是「谁能用哪个模型」的唯一事实来源。 */
export class AgentProfileService extends Service {
  private readonly agentsStore: JsonFileStore;
  private readonly bindingsStore: JsonFileStore;
  private agentsQueue: Promise<unknown> = Promise.resolve();
  private bindingsQueue: Promise<unknown> = Promise.resolve();
  private seedPromise: Promise<void> | undefined;

  constructor(ctx: Context, config: AgentProfilePluginConfig = {}) {
    super(ctx, "agentProfile");
    this.agentsStore = new JsonFileStore(config.agentsFilePath ?? defaultAgentsFile());
    this.bindingsStore = new JsonFileStore(config.bindingsFilePath ?? defaultBindingsFile());
  }

  /**
   * 首次访问把内置项真正落盘：用户能直接打开配置文件看到小鱼与默认绑定，
   * 而不是只在内存里"看起来有"。写失败不影响读取，下次访问会重试。
   */
  private ensureSeeded(): Promise<void> {
    this.seedPromise ??= (async () => {
      if (await this.agentsStore.read() === undefined) {
        await this.agentsStore.write({ version: 1, agents: sanitizeAgents(undefined) }).catch(() => undefined);
      }
      if (await this.bindingsStore.read() === undefined) {
        await this.bindingsStore.write({ version: 1, bindings: sanitizeBindings(undefined) }).catch(() => undefined);
      }
    })();
    return this.seedPromise;
  }

  private async readAgents(): Promise<AgentDefinition[]> {
    await this.ensureSeeded();
    return sanitizeAgents(await this.agentsStore.read());
  }

  private async readBindings(): Promise<ModelBinding[]> {
    await this.ensureSeeded();
    return sanitizeBindings(await this.bindingsStore.read());
  }

  /** 串行执行 agent 写操作：读 → 改 → 原子写。 */
  private mutateAgents<T>(task: (agents: AgentDefinition[]) => { items: AgentDefinition[]; result: T }): Promise<T> {
    const run = async () => {
      const agents = await this.readAgents();
      const { items, result } = task(agents);
      await this.agentsStore.write({ version: 1, agents: items });
      return result;
    };
    const chained = this.agentsQueue.then(run, run);
    this.agentsQueue = chained.catch(() => undefined);
    return chained;
  }

  /** 串行执行绑定写操作。 */
  private mutateBindings<T>(task: (bindings: ModelBinding[]) => { items: ModelBinding[]; result: T }): Promise<T> {
    const run = async () => {
      const bindings = await this.readBindings();
      const { items, result } = task(bindings);
      await this.bindingsStore.write({ version: 1, bindings: items });
      return result;
    };
    const chained = this.bindingsQueue.then(run, run);
    this.bindingsQueue = chained.catch(() => undefined);
    return chained;
  }

  async listAgents(): Promise<AgentDefinition[]> {
    return this.readAgents();
  }

  async getAgent(id: string): Promise<AgentDefinition | undefined> {
    return (await this.readAgents()).find((agent) => agent.id === id);
  }

  async createAgent(input: AgentCreateInput): Promise<AgentDefinition> {
    const name = requireAgentName(input.name);
    const id = input.id ? requireAgentId(input.id) : createAgentId();
    if (id === BUILTIN_AGENT_ID) throw new Error("内置 agent 已存在，不能重复创建。");
    const instructions = requireInstructions(input.instructions);
    const bindingId = input.bindingId?.trim() ?? "";
    if (bindingId) await this.assertBindingExists(bindingId);
    const skillIds = input.skillIds?.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) ?? [];
    const toolPolicy = sanitizeToolPolicy(input.toolPolicy);
    return this.mutateAgents((agents) => {
      if (agents.some((agent) => agent.id === id)) throw new Error(`agent 已存在：${id}`);
      const now = Date.now();
      const agent: AgentDefinition = {
        id,
        name,
        kind: normalizeAgentKind(input.kind),
        // 客户端不能自称内置；导入来源只有显式 source=imported 才记，其余都算用户自建。
        source: input.source === "imported" ? "imported" : "user",
        enabled: input.enabled !== false,
        createdAt: now,
        updatedAt: now,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.icon?.trim() ? { icon: input.icon.trim() } : {}),
        ...(instructions ? { instructions } : {}),
        ...(input.instructionsMode === "replace" ? { instructionsMode: "replace" as const } : {}),
        ...(skillIds.length > 0 ? { skillIds } : {}),
        ...(toolPolicy ? { toolPolicy } : {}),
        ...(bindingId ? { bindingId } : {}),
      };
      return { items: [...agents, agent], result: agent };
    });
  }

  async updateAgent(id: string, patch: AgentUpdateInput): Promise<AgentDefinition> {
    const bindingId = patch.bindingId?.trim();
    if (bindingId) await this.assertBindingExists(bindingId);
    const name = patch.name === undefined ? undefined : requireAgentName(patch.name);
    const instructions = requireInstructions(patch.instructions);
    return this.mutateAgents((agents) => {
      const index = agents.findIndex((agent) => agent.id === id);
      if (index < 0) throw new Error(`agent 不存在：${id}`);
      const current = agents[index] as AgentDefinition;
      const next: AgentDefinition = { ...current, updatedAt: Date.now() };
      if (name) next.name = name;
      if (patch.kind !== undefined) next.kind = normalizeAgentKind(patch.kind);
      if (patch.description !== undefined) {
        const description = patch.description.trim();
        if (description) next.description = description;
        else delete next.description;
      }
      if (patch.icon !== undefined) {
        const icon = patch.icon.trim();
        if (icon) next.icon = icon;
        else delete next.icon;
      }
      // 指令清空时要真正删字段：留空串会让下游以为「有值但为空」，与「不配置」语义混淆。
      if (patch.instructions !== undefined) {
        if (instructions) next.instructions = instructions;
        else delete next.instructions;
      }
      if (patch.instructionsMode !== undefined) next.instructionsMode = patch.instructionsMode;
      if (patch.toolPolicy !== undefined) {
        const toolPolicy = sanitizeToolPolicy(patch.toolPolicy);
        if (toolPolicy) next.toolPolicy = toolPolicy;
        else delete next.toolPolicy;
      }
      if (patch.skillIds !== undefined) {
        const skillIds = patch.skillIds.filter((item) => item.trim());
        if (skillIds.length > 0) next.skillIds = skillIds;
        else delete next.skillIds;
      }
      if (bindingId !== undefined) {
        if (bindingId) next.bindingId = bindingId;
        else delete next.bindingId;
      }
      if (patch.enabled !== undefined) next.enabled = patch.enabled;
      return { items: agents.map((agent, position) => (position === index ? next : agent)), result: next };
    });
  }

  async removeAgent(id: string): Promise<boolean> {
    if (id === BUILTIN_AGENT_ID) throw new Error("内置 agent 不能删除；如需隐藏请停用。");
    return this.mutateAgents((agents) => {
      const items = agents.filter((agent) => agent.id !== id);
      return { items, result: items.length !== agents.length };
    });
  }

  async listBindings(): Promise<ModelBinding[]> {
    return this.readBindings();
  }

  async getBinding(id: string): Promise<ModelBinding | undefined> {
    return (await this.readBindings()).find((binding) => binding.id === id);
  }

  async createBinding(input: BindingCreateInput): Promise<ModelBinding> {
    const name = normalizeName(input.name);
    if (!name) throw new Error("绑定名称不能为空。");
    const id = input.id ? requireAgentId(input.id) : createAgentId();
    if (id === DEFAULT_BINDING_ID) throw new Error("default 是内置绑定 id，请换一个。");
    const strategy = normalizeBindingStrategy(input.strategy);
    const targets = requireTargets(input.targets, strategy);
    const cooldownMs = requireCooldown(input.cooldownMs);
    return this.mutateBindings((bindings) => {
      if (bindings.some((binding) => binding.id === id)) throw new Error(`绑定已存在：${id}`);
      const now = Date.now();
      const binding: ModelBinding = {
        id,
        name,
        strategy,
        targets,
        onError: normalizeBindingOnError(input.onError),
        createdAt: now,
        updatedAt: now,
        ...(cooldownMs !== undefined ? { cooldownMs } : {}),
      };
      return { items: [...bindings, binding], result: binding };
    });
  }

  async updateBinding(id: string, patch: BindingUpdateInput): Promise<ModelBinding> {
    if (id === DEFAULT_BINDING_ID) throw new Error("内置默认绑定跟随全局模型配置，不能修改；请新建绑定。");
    const name = patch.name === undefined ? undefined : normalizeName(patch.name);
    if (patch.name !== undefined && !name) throw new Error("绑定名称不能为空。");
    const cooldownMs = requireCooldown(patch.cooldownMs);
    return this.mutateBindings((bindings) => {
      const index = bindings.findIndex((binding) => binding.id === id);
      if (index < 0) throw new Error(`绑定不存在：${id}`);
      const current = bindings[index] as ModelBinding;
      const strategy = patch.strategy === undefined ? current.strategy : normalizeBindingStrategy(patch.strategy);
      const rawTargets: unknown = patch.targets === undefined ? current.targets : patch.targets;
      // 改策略时也要重算一次目标：从多目标切到 single 必须显式收敛，不能悄悄丢目标。
      const targets = requireTargets(rawTargets, strategy);
      const next: ModelBinding = {
        ...current,
        ...(name ? { name } : {}),
        strategy,
        targets,
        ...(patch.onError !== undefined ? { onError: normalizeBindingOnError(patch.onError) } : {}),
        ...(cooldownMs !== undefined && cooldownMs > 0 ? { cooldownMs } : {}),
        updatedAt: Date.now(),
      };
      // 显式传 0 表示清除冷却，与「没传」区分开。
      if (cooldownMs === 0) delete next.cooldownMs;
      return { items: bindings.map((binding, position) => (position === index ? next : binding)), result: next };
    });
  }

  async removeBinding(id: string): Promise<boolean> {
    if (id === DEFAULT_BINDING_ID) throw new Error("内置默认绑定不能删除。");
    const agents = await this.readAgents();
    const users = agents.filter((agent) => agent.bindingId === id);
    if (users.length > 0) {
      throw new Error(`绑定正被 agent 使用：${users.map((agent) => agent.name).join("、")}`);
    }
    return this.mutateBindings((bindings) => {
      const items = bindings.filter((binding) => binding.id !== id);
      return { items, result: items.length !== bindings.length };
    });
  }

  /** 导出 agent 与绑定的快照，供备份或换机导入；内置项一并导出，导入时按内置身份处理。 */
  async exportSnapshot(): Promise<AgentProfileSnapshot> {
    return {
      version: 1,
      exportedAt: Date.now(),
      agents: await this.readAgents(),
      bindings: await this.readBindings(),
    };
  }

  /**
   * 导入快照：按 id 覆盖同名项，新增项追加；内置 id 只允许更新内容（名字/指令/绑定），
   * 内置 default 绑定原样跳过。返回实际新增与覆盖的数量，便于界面如实汇报。
   */
  async importSnapshot(raw: unknown): Promise<{ agents: { added: number; updated: number }; bindings: { added: number; updated: number } }> {
    const snapshot = readSnapshot(raw);
    if (!snapshot) throw new Error("导入内容不是有效的 LFAA agent 快照。");
    const agentStats = { added: 0, updated: 0 };
    const bindingStats = { added: 0, updated: 0 };
    await this.mutateBindings((bindings) => {
      const next = [...bindings];
      for (const binding of snapshot.bindings) {
        if (binding.id === DEFAULT_BINDING_ID) continue;
        const index = next.findIndex((item) => item.id === binding.id);
        const merged: ModelBinding = {
          ...binding,
          createdAt: index >= 0 ? next[index]!.createdAt : binding.createdAt,
          updatedAt: Date.now(),
        };
        if (index >= 0) {
          next[index] = merged;
          bindingStats.updated += 1;
        } else {
          next.push(merged);
          bindingStats.added += 1;
        }
      }
      return { items: next, result: undefined };
    });
    await this.mutateAgents((agents) => {
      const next = [...agents];
      for (const agent of snapshot.agents) {
        const index = next.findIndex((item) => item.id === agent.id);
        if (index >= 0) {
          // 内置身份由本机决定，导入只更新内容字段。
          next[index] = {
            ...next[index]!,
            name: agent.name,
            kind: agent.kind,
            enabled: agent.enabled,
            updatedAt: Date.now(),
            ...(agent.description ? { description: agent.description } : {}),
            ...(agent.icon ? { icon: agent.icon } : {}),
            ...(agent.instructions ? { instructions: agent.instructions } : {}),
            ...(agent.skillIds ? { skillIds: agent.skillIds } : {}),
            ...(agent.toolPolicy ? { toolPolicy: agent.toolPolicy } : {}),
            ...(agent.bindingId ? { bindingId: agent.bindingId } : {}),
          };
          agentStats.updated += 1;
        } else {
          next.push({ ...agent, source: agent.source === "builtin" ? "user" : agent.source, updatedAt: Date.now() });
          agentStats.added += 1;
        }
      }
      return { items: next, result: undefined };
    });
    return { agents: agentStats, bindings: bindingStats };
  }

  /** 解析某个 agent 实际使用的绑定：会话覆盖 > agent 绑定 > 内置默认。 */
  async resolveBindingId(agentId?: string, overrideId?: string): Promise<string> {
    if (!agentId) return resolveBindingIdFor(undefined, overrideId);
    return resolveBindingIdFor(await this.getAgent(agentId), overrideId);
  }

  /** 目标里的 profile 是否存在由解析阶段校验；这里只保证引用的绑定 id 真实存在。 */
  private async assertBindingExists(bindingId: string): Promise<void> {
    const exists = (await this.readBindings()).some((binding) => binding.id === bindingId);
    if (!exists) throw new Error(`绑定不存在：${bindingId}`);
  }
}

/** 为 Host 上下文注册 agent 定义与绑定服务。 */
export function agentProfilePlugin(ctx: Context, config: AgentProfilePluginConfig = {}): void {
  new AgentProfileService(ctx, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    agentProfile: AgentProfileService;
  }
}