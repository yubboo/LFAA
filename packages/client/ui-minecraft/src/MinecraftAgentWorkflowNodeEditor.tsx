/** 功能：编辑 Minecraft Agent 节点配置。作用：作为 App 插件字段编辑器注入共享 Workflow 画布。 */
import { Input, Select, Typography } from "antd";
import type { WorkflowNodeEditorProps } from "lfaa-client-ui-workflow/src/index.js";
import type { MinecraftWorkflowTool } from "lfaa-client-connection/src/api.js";

export function MinecraftAgentWorkflowNodeEditor({ node, nodeType, disabled, runtime, updateData }: WorkflowNodeEditorProps) {
  const options = nodeType.configurationOptions as { tools?: MinecraftWorkflowTool[] } | undefined;
  const tools = options?.tools ?? [];
  const prompt = typeof node.data.prompt === "string" ? node.data.prompt : "";
  const toolNames = Array.isArray(node.data.toolNames) ? node.data.toolNames.filter((item): item is string => typeof item === "string") : [];
  return <>
    <Input.TextArea aria-label="Agent 节点目标" value={prompt} maxLength={6000} rows={3} disabled={disabled} placeholder="写清目标、约束和期望结果。" onChange={(event) => updateData({ prompt: event.target.value })} />
    <Select mode="multiple" aria-label="Agent 允许使用的 Minecraft 工具" value={toolNames} disabled={disabled} onChange={(value: string[]) => updateData({ toolNames: value })} options={tools.map((tool) => ({ value: tool.name, label: tool.name, title: tool.description }))} placeholder="选择此节点可以使用的工具" />
    {!tools.length ? <Typography.Text type="secondary">当前账户暂时没有可用的 Minecraft 工具。</Typography.Text> : null}
    {runtime?.progress?.agentStatus && typeof runtime.progress.agentStatus === "string" ? <Typography.Text type="secondary">Agent 状态：{runtime.progress.agentStatus}</Typography.Text> : null}
  </>;
}
