/**
 * 文件：workbench/contracts.ts
 * 作用：工作台父子模块之间的最小 ViewModel / Props 公共契约。
 * 负责：只定义区域间需要共享的类型，不持有运行时状态。
 * 不负责：Provider 真值、React UI 实现、Host Bridge、CSS。
 * 状态归属：无状态；业务真值继续由 AgentWorkbench / Config System / Agent Runtime Owner 持有。
 * 对外接口：ResolvedTheme、LayoutMode、QuickModelOption、ActiveReasoningControl、ChatProjectionMessage。
 * 修改注意事项：只放“父子边界需要共享”的类型；禁止把某个子模块的私有 State 提升为全局共享类型。
 */
import type { AiModelSettingField, AiModelSettingValue } from "@lfaa/config-system";
import type { WorkbenchLayoutMode } from "@lfaa/ui";
export type { AgentAiSettingsHost, AgentPluginSettingsHost, AgentWorkbenchProps, DevResourceItem, ResourceKind } from "../workbench.types";

export type ResolvedTheme = "light" | "dark";
export type LayoutMode = WorkbenchLayoutMode;

export interface QuickModelOption {
  accountId: string;
  providerId: string;
  accountName: string;
  modelId: string;
  modelName?: string;
  active: boolean;
  unavailable: boolean;
}

export interface ActiveReasoningControl {
  field: AiModelSettingField;
  value: AiModelSettingValue | undefined;
  /** 账户 + Provider + 模型共同定义一次 Runtime Control 会话，避免同名模型跨账户复用临时状态。 */
  modelKey: string;
}

export interface ChatProjectionMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  runId?: string;
}
