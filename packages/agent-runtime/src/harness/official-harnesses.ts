/**
 * 文件：official-harnesses.ts
 * 作用：声明 LFAA 允许桥接的官方 Agent Harness 与能力边界。
 * 负责：Codex / DeepSeek Harness 官方运行时标识、传输方式和 capability seam 元数据。
 * 不负责：复制 Harness 内部 Agent Loop、私有协议或进程实现。
 * 状态归属：静态兼容目录；真实可用性由宿主 Adapter 探测。
 * 对外接口：OFFICIAL_HARNESSES、resolveOfficialHarness、createHarnessRegistry。
 * 关联文件：packages/agent-runtime/src/core/contracts.ts、ARCHITECTURE.md。
 * 修改注意事项：只登记有官方公开入口的 Harness；“支持”必须由 Host capability probe 证明。
 */

export type OfficialHarnessId = "openai-codex" | "deepseek-harness";

/**
 * Harness seam 描述上游 Runtime 暴露的能力面，不等同于 LFAA Plugin Capability kind。
 * 例如 filesystem/process/sandbox 是 Harness 执行面，真正注册给 Agent 的对象仍由 Adapter 转为 Tool/Skill 等公共 Capability。
 */
export type OfficialHarnessCapabilitySeam =
  | "tool"
  | "skill"
  | "command"
  | "sandbox"
  | "subagent"
  | "browser"
  | "filesystem"
  | "process"
  | "mcp";

export interface OfficialHarnessDescriptor {
  readonly id: OfficialHarnessId;
  readonly displayName: string;
  readonly vendor: "OpenAI" | "DeepSeek";
  readonly bridge: "app-server" | "acp-or-sdk";
  readonly officialEntry: string;
  readonly capabilityKinds: readonly OfficialHarnessCapabilitySeam[];
}

export const OFFICIAL_HARNESSES: Readonly<Record<OfficialHarnessId, OfficialHarnessDescriptor>> = {
  "openai-codex": {
    id: "openai-codex",
    displayName: "OpenAI Codex",
    vendor: "OpenAI",
    bridge: "app-server",
    officialEntry: "codex app-server",
    capabilityKinds: ["tool", "skill", "command", "sandbox", "subagent", "browser", "filesystem", "process", "mcp"],
  },
  "deepseek-harness": {
    id: "deepseek-harness",
    displayName: "DeepSeek Harness",
    vendor: "DeepSeek",
    bridge: "acp-or-sdk",
    officialEntry: "@deepseek-ai/dsh / ACP / SDK",
    capabilityKinds: ["tool", "skill", "command", "sandbox", "subagent", "filesystem", "process", "mcp"],
  },
};

export function resolveOfficialHarness(id: OfficialHarnessId): OfficialHarnessDescriptor {
  return OFFICIAL_HARNESSES[id];
}

/** 创建只读 Registry，拒绝重复 ID，避免 Adapter 覆盖彼此。 */
export function createHarnessRegistry(
  descriptors: readonly OfficialHarnessDescriptor[] = Object.values(OFFICIAL_HARNESSES),
): ReadonlyMap<OfficialHarnessId, OfficialHarnessDescriptor> {
  const registry = new Map<OfficialHarnessId, OfficialHarnessDescriptor>();
  for (const descriptor of descriptors) {
    if (registry.has(descriptor.id)) {
      throw new Error(`Duplicate harness id: ${descriptor.id}`);
    }
    registry.set(descriptor.id, descriptor);
  }
  return registry;
}
