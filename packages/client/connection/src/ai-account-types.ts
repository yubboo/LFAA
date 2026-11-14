export interface AiProvider {
  id: string;
  name: string;
  description: string;
  options: Array<{ id: string; label: string; choices: Array<{ value: string; label: string }> }>;
  discovery: "api" | "official-list";
  scope?: "system" | "user";
  modelInput?: "catalog" | "manual";
  documentationUrl?: string;
  secretLabel?: string;
}

export type AiModelThinkingControl =
  | { kind: "effort"; parameter: "reasoning_effort"; values: string[]; defaultValue?: string }
  | { kind: "toggle"; parameter: "thinking"; values: Array<"enabled" | "disabled">; defaultValue?: "enabled" | "disabled" }
  | { kind: "fixed"; value: string };

export interface AiModel {
  id: string;
  name: string;
  versionTag?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  taskType?: "chat" | "embedding" | "image-generation" | "video-generation" | "text-to-speech" | "speech-to-text";
  inputModalities?: Array<"text" | "image" | "audio" | "video">;
  planTiers?: Array<"small" | "medium" | "large" | "max" | "lite" | "pro">;
  catalogSource?: string;
  catalogNote?: string;
  thinking: AiModelThinkingControl | null;
  thinkingSource: "provider-model-catalog" | null;
}

export interface AiProviderProbe {
  status: "connected" | "unverified";
  message: string;
  models: AiModel[];
}

export interface AiModelTestResult {
  status: "connected";
  modelId: string;
  elapsedMs: number;
  sample: string;
  verificationToken?: string;
}

export interface AiAccount {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  models: AiModel[];
  options: Record<string, string>;
  reasoningMode: string;
  active: boolean;
  createdAt: string;
  hasSecret: true;
  scope: "system" | "user";
}

export interface ClaudeAgentCredentialStatus {
  configured: boolean;
  updatedAt?: string;
}
