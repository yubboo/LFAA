/** 功能：登记可替换的顺序 DAG 工作流引擎。作用：串行执行已注册节点并传递端口值。 */
import type { Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { DEFAULT_WORKFLOW_ENGINE_ID, topologicalOrder } from "lfaa-workflow/src/graph.js";
import { registerWorkflowEngine, type WorkflowEngineContext } from "lfaa-workflow/src/registry.js";

const MAX_VALUE_CHARS = 4_000;

function boundedValue(value: unknown, nodeTitle: string): unknown {
  const encoded = typeof value === "string" ? value : JSON.stringify(value);
  if ((encoded ?? "").length > MAX_VALUE_CHARS) throw new Error(`节点“${nodeTitle}”单个端口输出超过 ${MAX_VALUE_CHARS} 个字符。`);
  return value;
}

async function execute(context: WorkflowEngineContext): Promise<void> {
  const outputs = new Map<string, Record<string, unknown>>();
  for (const node of topologicalOrder(context.definition)) {
    context.signal.throwIfAborted();
    context.reportNodeState(node.id, "running");
    const inputs: Record<string, unknown> = {};
    for (const edge of context.definition.edges) {
      if (edge.to !== node.id) continue;
      const source = outputs.get(edge.from);
      if (!source || !(edge.fromPort in source)) throw new Error(`节点“${node.title}”缺少上游端口 ${edge.fromPort} 的输出。`);
      inputs[edge.toPort] = boundedValue(source[edge.fromPort], node.title);
    }
    try {
      const result = await context.executeNode(node.id, inputs);
      outputs.set(node.id, result.outputs);
      const preview = JSON.stringify(result.outputs) ?? "";
      context.reportNodeState(node.id, "succeeded", { output: preview, ...(result.references ? { references: result.references } : {}) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "节点执行失败。";
      context.reportNodeState(node.id, context.signal.aborted ? "interrupted" : "failed", { error: message });
      throw error;
    }
  }
}

export const name = "lfaaWorkflowDagEngine";
export const inject = ["lfaaWorkflow"];
export function apply(ctx: Context): void {
  registerWorkflowEngine(ctx, {
    id: DEFAULT_WORKFLOW_ENGINE_ID,
    version: 1,
    applicationIds: APPLICATION_IDS,
    name: "顺序 DAG",
    execute
  });
}
