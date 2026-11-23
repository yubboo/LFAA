// @lfaa/agent-profile 落盘数据归一：坏项丢弃、缺字段补默认，内置小鱼与默认绑定始终存在。
// 归一原则是「宁可少一个 agent，也不要让整个配置文件读不出来」；内置项只允许改名字与内容，不允许丢。
import {
  BUILTIN_AGENT_ID,
  DEFAULT_BINDING_ID,
  createBuiltinAgent,
  createDefaultBinding,
  normalizeAgentKind,
  normalizeAgentSource,
  normalizeBindingOnError,
  normalizeBindingStrategy,
  normalizeInstructions,
  normalizeName,
  normalizeStringList,
  normalizeTargets,
  type AgentDefinition,
  type AgentProfileSnapshot,
  type AgentToolPolicy,
  type ModelBinding,
} from "./types";

const MAX_TOOL_POLICY_ENTRIES = 128;

/** 归一工具边界：allow / deny 各自去空白去重；两者都空时整段丢弃。 */
export function sanitizeToolPolicy(raw: unknown): AgentToolPolicy | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as { allow?: unknown; deny?: unknown };
  const allow = normalizeStringList(record.allow, MAX_TOOL_POLICY_ENTRIES);
  const deny = normalizeStringList(record.deny, MAX_TOOL_POLICY_ENTRIES);
  if (allow.length === 0 && deny.length === 0) return undefined;
  return {
    ...(allow.length > 0 ? { allow } : {}),
    ...(deny.length > 0 ? { deny } : {}),
  };
}

/** 还原 agent 列表；缺 id / 缺名称 / 重复 id 的条目直接丢弃，内置小鱼缺失时补回。 */
export function sanitizeAgents(raw: unknown, now = Date.now()): AgentDefinition[] {
  const record = raw as { agents?: unknown } | undefined;
  const items = Array.isArray(record?.agents) ? record.agents : [];
  const seen = new Set<string>();
  const out: AgentDefinition[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const source = item as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim() : "";
    const name = normalizeName(source.name);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const isBuiltin = id === BUILTIN_AGENT_ID;
    const instructions = normalizeInstructions(source.instructions);
    const skillIds = normalizeStringList(source.skillIds);
    const toolPolicy = sanitizeToolPolicy(source.toolPolicy);
    const bindingId = typeof source.bindingId === "string" ? source.bindingId.trim() : "";
    const createdAt = typeof source.createdAt === "number" && Number.isFinite(source.createdAt) ? source.createdAt : now;
    const updatedAt = typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt) ? source.updatedAt : createdAt;
    out.push({
      id,
      name,
      // 内置项的身份字段由代码决定，落盘数据里被改坏也不会变成「用户自建」。
      kind: normalizeAgentKind(source.kind),
      source: isBuiltin ? "builtin" : normalizeAgentSource(source.source),
      enabled: source.enabled !== false,
      createdAt,
      updatedAt,
      ...(typeof source.description === "string" && source.description.trim()
        ? { description: source.description.trim() }
        : {}),
      ...(typeof source.icon === "string" && source.icon.trim() ? { icon: source.icon.trim() } : {}),
      ...(instructions ? { instructions } : {}),
      ...(source.instructionsMode === "replace" ? { instructionsMode: "replace" as const } : {}),
      ...(skillIds.length > 0 ? { skillIds } : {}),
      ...(toolPolicy ? { toolPolicy } : {}),
      ...(bindingId ? { bindingId } : {}),
    });
  }
  if (!seen.has(BUILTIN_AGENT_ID)) out.unshift(createBuiltinAgent(now));
  return out;
}

/** 还原绑定列表；内置 default 缺失时补回，inheritGlobal 只认 default 自己的值。 */
export function sanitizeBindings(raw: unknown, now = Date.now()): ModelBinding[] {
  const record = raw as { bindings?: unknown } | undefined;
  const items = Array.isArray(record?.bindings) ? record.bindings : [];
  const seen = new Set<string>();
  const out: ModelBinding[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const source = item as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim() : "";
    const name = normalizeName(source.name);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const isDefault = id === DEFAULT_BINDING_ID;
    const createdAt = typeof source.createdAt === "number" && Number.isFinite(source.createdAt) ? source.createdAt : now;
    const updatedAt = typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt) ? source.updatedAt : createdAt;
    const cooldownMs = typeof source.cooldownMs === "number" && Number.isFinite(source.cooldownMs) && source.cooldownMs > 0
      ? Math.min(600_000, Math.floor(source.cooldownMs))
      : undefined;
    out.push({
      id,
      name,
      strategy: normalizeBindingStrategy(source.strategy),
      targets: normalizeTargets(source.targets),
      onError: normalizeBindingOnError(source.onError),
      createdAt,
      updatedAt,
      ...(cooldownMs !== undefined ? { cooldownMs } : {}),
      ...(isDefault ? { inheritGlobal: true, builtin: true } : {}),
    });
  }
  if (!seen.has(DEFAULT_BINDING_ID)) out.unshift(createDefaultBinding(now));
  return out;
}
/** 读取导入快照：必须是带 agents / bindings 数组的对象，其余字段忽略并按落盘规则归一。 */
export function readSnapshot(raw: unknown): AgentProfileSnapshot | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as { agents?: unknown; bindings?: unknown };
  if (!Array.isArray(record.agents) || !Array.isArray(record.bindings)) return undefined;
  return {
    version: 1,
    exportedAt: Date.now(),
    agents: sanitizeAgents({ agents: record.agents }),
    bindings: sanitizeBindings({ bindings: record.bindings }),
  };
}