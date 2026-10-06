/** 功能：登记跨 App 工作流核心。作用：拥有图/运行存储合同，并在插件卸载时撤销能力。 */
import type { Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import * as capability from "./service.js";
import { clearWorkflowRegistrations, registerWorkflowNodeProvider } from "./registry.js";
export const name = "lfaaWorkflow";
export function apply(ctx: Context): void {
  ctx.provide(name, capability);
  registerWorkflowNodeProvider(ctx, {
    id: "lfaa.workflow.core",
    applicationIds: APPLICATION_IDS,
    nodes: [
      {
        type: "core.text-input", version: 1, name: "文本输入", description: "向后续节点提供文本。", applicationIds: APPLICATION_IDS,
        defaultData: { text: "" },
        inputPorts: [], outputPorts: [{ id: "text", valueType: "text" }],
        normalizeData(value) {
          const text = value.text === undefined ? "" : value.text;
          if (typeof text !== "string" || text.length > 12_000) throw new Error("文本输入必须是 12000 字符以内的文本。");
          return { text };
        },
        execute: (execution) => ({ outputs: { text: execution.node.data.text as string } })
      },
      {
        type: "core.result", version: 1, name: "结果", description: "显示上游节点的实际输出。", applicationIds: APPLICATION_IDS,
        defaultData: {},
        inputPorts: [{ id: "value", valueType: "any" }], outputPorts: [{ id: "value", valueType: "any" }],
        normalizeData(value) { return value; },
        execute: (execution) => ({ outputs: { value: execution.inputs.value ?? "" } })
      }
    ]
  });
  ctx.effect(() => () => { capability.closeWorkflowRuns(); clearWorkflowRegistrations(); });
}
