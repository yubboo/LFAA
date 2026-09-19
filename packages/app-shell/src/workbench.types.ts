/**
 * 文件：workbench.types.ts
 * 作用：定义共享工作台壳对宿主暴露的最小数据契约。
 * 负责：开发资源、终端插槽与 AI 设置 Host Client 契约。
 * 不负责：UI 布局、Secret 实现、Provider HTTP、宿主持久化细节。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：AgentWorkbenchProps、AgentAiSettingsHost、DevResourceItem、ResourceKind。
 * 关联文件：AgentWorkbench.tsx、apps/web/src/App.tsx、apps/web/src/host/ai-settings-client.ts。
 * 修改注意事项：Host Client 只能暴露业务结果，不能泄漏 Vite/Node/Secret 明文存储细节。
 */
import type { ReactNode } from "react";
import type { AiAccountDraft, AiAccountProbeResult, AiAccountSnapshot, AiModelSettingValue } from "@lfaa/config-system";

export type ResourceKind = "skills" | "experts" | "plugins" | "extensions" | "mcp";

export interface DevResourceItem {
  kind: ResourceKind;
  name: string;
  relativePath: string;
  entryType: "file" | "directory";
  updatedAt: number;
}

export interface AgentAiSettingsHost {
  snapshot(): Promise<AiAccountSnapshot>;
  probe(draft: AiAccountDraft, secret: string): Promise<AiAccountProbeResult>;
  save(draft: AiAccountDraft, secret: string): Promise<{ probe: AiAccountProbeResult; snapshot: AiAccountSnapshot }>;
  reprobe(accountId: string): Promise<AiAccountProbeResult>;
  deleteAccount(accountId: string): Promise<AiAccountSnapshot>;
  selectModel(accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiModelSettingValue>>): Promise<AiAccountSnapshot>;
}

export interface AgentWorkbenchProps {
  resources?: readonly DevResourceItem[];
  resourceBridgeStatus?: "connected" | "refreshing" | "offline";
  terminal?: ReactNode;
  aiSettingsHost?: AgentAiSettingsHost;
}
