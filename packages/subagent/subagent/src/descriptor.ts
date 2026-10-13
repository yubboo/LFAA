/**
 * 功能：子代理子任务的版本化描述（descriptor）。
 * 作用：在派发前把任务组合（驱动/模式/标签/可选模型）detach 为无损 JSON 记录，作为该子任务的稳定身份。
 * 关联文件：internal.ts、catalog.ts、continuation.ts。
 * 移植自 DeepSeek Harness subagent/descriptor（MIT License，commit 639ed01），去掉 dsh-session/dsh-tools 依赖，按 LFAA 适配。
 */
import { safeJsonSnapshot } from "./internal.js";

/** 当前描述格式版本。 */
export const SUBAGENT_DESCRIPTOR_VERSION = 1;

/** 一次性（终态）子任务描述。 */
export interface OneShotDescriptor {
  readonly version: number;
  readonly mode: "one-shot";
  readonly driver: string;
  readonly label?: string;
}

/** 可续接子任务描述（保留恢复所需组合）。 */
export interface ContinuableDescriptor {
  readonly version: number;
  readonly mode: "continuable";
  readonly driver: string;
  readonly label: string;
  readonly model?: string;
}

/** 子任务描述联合。 */
export type SubagentDescriptor = OneShotDescriptor | ContinuableDescriptor;

/** 派发前的描述输入。 */
export type SubagentDescriptorInput =
  | { readonly mode: "one-shot"; readonly driver: string; readonly label?: string }
  | { readonly mode: "continuable"; readonly driver: string; readonly label: string; readonly model?: string };

/** 构造并 detach 一份描述；不可序列化时抛错。 */
export function snapshotDescriptor(input: SubagentDescriptorInput): SubagentDescriptor {
  const candidate: SubagentDescriptor = input.mode === "one-shot"
    ? { version: SUBAGENT_DESCRIPTOR_VERSION, mode: "one-shot", driver: input.driver, ...input.label ? { label: input.label } : {} }
    : { version: SUBAGENT_DESCRIPTOR_VERSION, mode: "continuable", driver: input.driver, label: input.label, ...input.model ? { model: input.model } : {} };
  const snapshot = safeJsonSnapshot(candidate);
  if (snapshot === undefined) throw new Error("子代理描述无法无损 JSON 序列化。");
  return snapshot;
}

/** 判断一个描述是否可续接。 */
export function isContinuableDescriptor(descriptor: SubagentDescriptor): descriptor is ContinuableDescriptor {
  return descriptor.mode === "continuable";
}
