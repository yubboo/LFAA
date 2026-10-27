/** 功能：通用 App 工作流画布面板。作用：编辑并执行当前 App 已登记的真实工作流节点。 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Input, Select, Space, Spin, Tag, Typography } from "antd";
import { WorkflowGraphEditor, type WorkflowNodeEditorProps, type WorkflowNodeEditors } from "./index.js";
import {
  answerAiRunQuestion,
  cancelWorkflowRun,
  createWorkflow,
  decideAiApproval,
  deleteWorkflow,
  getErrorMessage,
  loadWorkflowEngineTypes,
  loadWorkflowNodeTypes,
  loadWorkflowRuns,
  loadWorkflows,
  saveWorkflow,
  startWorkflowRun,
  type AiWorkbenchView,
  type ApplicationId,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowRun,
  type WorkflowRunNode
} from "lfaa-client-connection/src/api.js";
import { APPLICATION_LABELS } from "lfaa-util-values/src/application-id.js";
import "./application-workflow-canvas.css";

interface ApplicationWorkflowCanvasProps {
  applicationId: ApplicationId;
  userId: string;
  visible: boolean;
  onWorkflowContextChange?: (workflow: AiWorkbenchView["workflow"] | null) => void;
}
interface WorkflowDraft { id: string | null; title: string; engineId: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }
const terminalStatuses = new Set(["succeeded", "failed", "interrupted"]);
const statusLabel: Record<WorkflowRun["status"], string> = { queued: "排队中", running: "运行中", succeeded: "已完成", failed: "失败", interrupted: "已中断" };
const nodeStatusLabel: Record<WorkflowRunNode["status"], string> = { waiting: "等待中", running: "运行中", succeeded: "已完成", failed: "失败", interrupted: "已中断" };
function statusColor(status: string): string { return status === "succeeded" ? "green" : status === "failed" ? "red" : status === "interrupted" ? "orange" : status === "running" ? "blue" : "default"; }
function nextNodePosition(nodes: WorkflowNode[]): { x: number; y: number } {
  const offsets: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  for (let ring = 1; ring <= nodes.length + 1; ring += 1) offsets.push({ x: ring, y: 0 }, { x: 0, y: ring }, { x: -ring, y: 0 }, { x: 0, y: -ring }, { x: ring, y: ring }, { x: -ring, y: ring }, { x: -ring, y: -ring }, { x: ring, y: -ring });
  for (const offset of offsets) {
    const position = { x: 80 + offset.x * 400, y: 80 + offset.y * 300 };
    if (!nodes.some(node => Math.abs(node.x - position.x) < 360 && Math.abs(node.y - position.y) < 280)) return position;
  }
  return { x: 80, y: 80 + nodes.length * 300 };
}
function record(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function pendingQuestion(node: WorkflowRunNode) {
  const value = record(node.progress).pendingQuestion;
  return value && typeof value === "object" ? value as { questionId: string; question: string; options: string[] } : null;
}
function pendingApproval(node: WorkflowRunNode) {
  const value = record(node.progress).pendingApproval;
  return value && typeof value === "object" ? value as { approvalId: string; title: string; detail: string } : null;
}
function agentRunId(node: WorkflowRunNode): string | null { return node.references?.find(reference => reference.kind === "ai-run")?.id ?? null; }

function AppAgentWorkflowNodeEditor({ node, nodeType, disabled, runtime, updateData }: WorkflowNodeEditorProps) {
  const configuration = nodeType.configurationOptions as { tools?: Array<{ id: string; name: string; description: string }> } | undefined;
  const tools = configuration?.tools ?? [];
  const prompt = typeof node.data.prompt === "string" ? node.data.prompt : "";
  const toolNames = Array.isArray(node.data.toolNames) ? node.data.toolNames.filter((item): item is string => typeof item === "string") : [];
  return <>
    <Input.TextArea aria-label="Agent 节点目标" value={prompt} maxLength={6000} rows={3} disabled={disabled} placeholder="写清目标、约束和期望结果。" onChange={event => updateData({ prompt: event.target.value })} />
    <Select mode="multiple" aria-label="Agent 可用工具" value={toolNames} disabled={disabled} onChange={(value: string[]) => updateData({ toolNames: value })} options={tools.map(tool => ({ value: tool.name, label: tool.name, title: tool.description }))} placeholder="选择此节点可调用的当前 App 工具" />
    {!tools.length ? <Typography.Text type="secondary">当前账户与权限模式下暂时没有已登记工具。</Typography.Text> : null}
    {typeof runtime?.progress?.agentStatus === "string" ? <Typography.Text type="secondary">Agent 状态：{runtime.progress.agentStatus}</Typography.Text> : null}
  </>;
}

export function ApplicationWorkflowCanvas({ applicationId, userId, visible, onWorkflowContextChange }: ApplicationWorkflowCanvasProps) {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [nodeTypes, setNodeTypes] = useState<WorkflowNodeType[]>([]);
  const [engineTypes, setEngineTypes] = useState<Array<{ id: string; version: number; name: string }>>([]);
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [nodeToAdd, setNodeToAdd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [answeringQuestion, setAnsweringQuestion] = useState<string | null>(null);
  const [decidingApproval, setDecidingApproval] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodeEditors = useMemo<WorkflowNodeEditors>(() => ({ [`${applicationId}.agent`]: AppAgentWorkflowNodeEditor }), [applicationId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDraft(null);
    setRuns([]);
    setDirty(false);
    setError(null);
    Promise.all([loadWorkflows(applicationId), loadWorkflowNodeTypes(applicationId), loadWorkflowEngineTypes(applicationId)]).then(([workflowResult, nodeResult, engineResult]) => {
      if (!alive) return;
      setWorkflows(workflowResult.workflows);
      setNodeTypes(nodeResult.nodes);
      setEngineTypes(engineResult.engines);
      setNodeToAdd(nodeResult.nodes.find(node => node.type === `${applicationId}.agent`)?.type ?? nodeResult.nodes[0]?.type ?? "");
      const first = workflowResult.workflows[0];
      setDraft(first ? { id: first.id, title: first.title, engineId: first.engineId, nodes: first.nodes, edges: first.edges } : null);
      setLoading(false);
    }).catch(reason => {
      if (!alive) return;
      setError(getErrorMessage(reason));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [applicationId, userId]);

  const selectedId = draft?.id ?? "";
  const activeRun = useMemo(() => runs.some(run => !terminalStatuses.has(run.status)), [runs]);
  const updatedAt = workflows.find(workflow => workflow.id === draft?.id)?.updatedAt;
  useEffect(() => {
    if (!visible || !draft?.id || !updatedAt) { onWorkflowContextChange?.(null); return; }
    onWorkflowContextChange?.({ applicationId, workflowId: draft.id, title: draft.title, updatedAt });
    return () => onWorkflowContextChange?.(null);
  }, [applicationId, draft?.id, draft?.title, onWorkflowContextChange, updatedAt, visible]);

  useEffect(() => {
    if (!visible || !selectedId) { setRuns([]); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (!alive || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const result = await loadWorkflowRuns(applicationId, selectedId, controller.signal);
        if (!alive) return;
        setRuns(current => JSON.stringify(current) === JSON.stringify(result.runs) ? current : result.runs);
        if (result.runs.some(run => !terminalStatuses.has(run.status))) timer = setTimeout(() => void refresh(), 2500);
      } catch (reason) {
        if (alive && !controller.signal.aborted) setError(getErrorMessage(reason));
      } finally { inFlight = false; }
    };
    const onVisibilityChange = () => {
      if (document.hidden) { if (timer) clearTimeout(timer); timer = null; }
      else { if (timer) clearTimeout(timer); timer = null; void refresh(); }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void refresh();
    return () => { alive = false; controller.abort(); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [applicationId, selectedId, activeRun, visible]);

  const markChanged = useCallback((change: (current: WorkflowDraft) => WorkflowDraft) => {
    setDraft(current => current ? change(current) : current);
    setDirty(true);
    setError(null);
  }, []);
  const onGraphChange = useCallback((nodes: WorkflowNode[], edges: WorkflowEdge[]) => markChanged(current => ({ ...current, nodes, edges })), [markChanged]);
  const addNode = useCallback(() => {
    if (!draft) return;
    const nodeType = nodeTypes.find(item => item.type === nodeToAdd);
    if (!nodeType) { setError("所选节点插件当前不可用。"); return; }
    const position = nextNodePosition(draft.nodes);
    markChanged(current => ({ ...current, nodes: [...current.nodes, { id: crypto.randomUUID(), type: nodeType.type, version: nodeType.version, title: nodeType.name, data: structuredClone(nodeType.defaultData), ...position }] }));
  }, [draft, markChanged, nodeToAdd, nodeTypes]);
  const selectWorkflow = useCallback((id: string) => {
    if (dirty && !window.confirm("当前工作流有未保存修改。切换会放弃这些修改，是否继续？")) return;
    if (id === "__new") { setDraft({ id: null, title: "新工作流", engineId: engineTypes[0]?.id ?? "", nodes: [], edges: [] }); setRuns([]); }
    else {
      const workflow = workflows.find(item => item.id === id);
      if (workflow) { setDraft({ id: workflow.id, title: workflow.title, engineId: workflow.engineId, nodes: workflow.nodes, edges: workflow.edges }); setRuns([]); }
    }
    setDirty(false);
    setError(null);
  }, [dirty, engineTypes, workflows]);
  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true); setError(null);
    try {
      const input = { title: draft.title, engineId: draft.engineId, nodes: draft.nodes, edges: draft.edges };
      const result = draft.id ? await saveWorkflow(applicationId, draft.id, input) : await createWorkflow(applicationId, input);
      setDraft({ id: result.workflow.id, title: result.workflow.title, engineId: result.workflow.engineId, nodes: result.workflow.nodes, edges: result.workflow.edges });
      setWorkflows(current => [result.workflow, ...current.filter(item => item.id !== result.workflow.id)]);
      setDirty(false);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setSaving(false); }
  }, [applicationId, draft]);
  const handleDelete = useCallback(async () => {
    if (!draft?.id || !window.confirm(`删除工作流“${draft.title}”？此工作流的运行历史也会一并删除。`)) return;
    try {
      await deleteWorkflow(applicationId, draft.id);
      const remaining = workflows.filter(item => item.id !== draft.id);
      setWorkflows(remaining);
      const first = remaining[0];
      setDraft(first ? { id: first.id, title: first.title, engineId: first.engineId, nodes: first.nodes, edges: first.edges } : null);
      setRuns([]); setDirty(false); setError(null);
    } catch (reason) { setError(getErrorMessage(reason)); }
  }, [applicationId, draft, workflows]);
  const selectedEngineAvailable = Boolean(draft && engineTypes.some(engine => engine.id === draft.engineId));
  const allNodeTypesAvailable = Boolean(draft && draft.nodes.every(node => nodeTypes.some(type => type.type === node.type && type.version === node.version)));
  const handleRun = useCallback(async () => {
    if (!draft?.id || dirty) return;
    setRunning(true); setError(null);
    try {
      const result = await startWorkflowRun(applicationId, draft.id);
      setRuns(current => [result.run, ...current.filter(run => run.id !== result.run.id)]);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setRunning(false); }
  }, [applicationId, draft, dirty]);
  const handleCancel = useCallback(async (runId: string) => {
    try { const result = await cancelWorkflowRun(applicationId, runId); setRuns(current => current.map(run => run.id === runId ? result.run : run)); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }, [applicationId]);
  const handleQuestionAnswer = useCallback(async (runId: string, node: WorkflowRunNode, answer: string, skipped = false) => {
    const runIdRef = agentRunId(node);
    const question = pendingQuestion(node);
    if (!runIdRef || !question || (!skipped && !answer.trim())) return;
    const key = `${runId}:${question.questionId}`;
    setAnsweringQuestion(key);
    try { await answerAiRunQuestion(runIdRef, question.questionId, answer, skipped); setQuestionAnswers(current => { const next = { ...current }; delete next[key]; return next; }); setError(null); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setAnsweringQuestion(null); }
  }, []);
  const handleApprovalDecision = useCallback(async (approvalId: string, decision: "approved" | "denied") => {
    setDecidingApproval(approvalId);
    try { await decideAiApproval(approvalId, decision); setError(null); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setDecidingApproval(null); }
  }, []);

  if (loading) return <div className="lfaa-app-workflow__loading" role="status"><Spin /><Typography.Text type="secondary">正在读取工作流与已登记节点…</Typography.Text></div>;
  const runtimeNodes = runs.find(run => !terminalStatuses.has(run.status))?.nodes ?? runs[0]?.nodes ?? [];
  return <section className="lfaa-app-workflow" aria-label={`${APPLICATION_LABELS[applicationId]}工作流`}>
    <header className="lfaa-app-workflow__heading">
      <div><span className="lfaa-app-workflow__eyebrow">APP WORKFLOW</span><Typography.Title className="lfaa-app-workflow__title" level={3}>{APPLICATION_LABELS[applicationId]} · 工作流</Typography.Title><Typography.Paragraph className="lfaa-app-workflow__description">节点来自当前 App 已登记的能力。连线形成可执行流程，工具与审批仍由各自 Owner 处理。</Typography.Paragraph></div>
      <Space wrap>
        <Select aria-label="选择工作流" value={draft?.id ?? "__new"} onChange={selectWorkflow} options={[...workflows.map(workflow => ({ value: workflow.id, label: workflow.title })), { value: "__new", label: "＋ 新建工作流" }]} />
        <Select aria-label="选择工作流引擎" value={draft?.engineId} onChange={engineId => markChanged(current => ({ ...current, engineId }))} options={engineTypes.map(engine => ({ value: engine.id, label: engine.name }))} disabled={!draft || activeRun || !engineTypes.length} />
        <Select aria-label="选择要添加的节点" value={nodeToAdd} onChange={setNodeToAdd} options={nodeTypes.map(node => ({ value: node.type, label: node.name }))} disabled={!draft || activeRun || !nodeTypes.length} />
        <Button onClick={addNode} disabled={!draft || activeRun || !nodeToAdd || draft.nodes.length >= 64}>添加节点</Button>
        <Button type="primary" onClick={() => void handleSave()} disabled={!draft || !dirty || activeRun || !draft.engineId} loading={saving}>保存</Button>
        <Button type="primary" disabled={!draft?.id || dirty || !draft.nodes.length || activeRun || !selectedEngineAvailable || !allNodeTypesAvailable} loading={running} onClick={() => void handleRun()}>运行</Button>
        {draft?.id ? <Button danger onClick={() => void handleDelete()}>删除</Button> : null}
      </Space>
    </header>
    {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}
    {draft && (!selectedEngineAvailable || !allNodeTypesAvailable) ? <Alert type="warning" showIcon message="工作流所需的插件当前未启用" description="定义和未知节点配置已保留；启用匹配的节点或引擎提供方后才能运行。" /> : null}
    <Card className="lfaa-app-workflow__editor">
      {!draft ? <Empty description="还没有工作流。新建一个流程，再从当前 App 已登记的节点中添加。"><Button type="primary" onClick={() => selectWorkflow("__new")}>新建工作流</Button></Empty> : <>
        <div className="lfaa-app-workflow__toolbar"><Input aria-label="工作流名称" value={draft.title} maxLength={80} disabled={activeRun} onChange={event => markChanged(current => ({ ...current, title: event.target.value }))} /><span>{draft.nodes.length} 个节点 · {draft.edges.length} 条连线{dirty ? " · 尚未保存" : " · 已保存"}</span></div>
        <WorkflowGraphEditor nodes={draft.nodes} edges={draft.edges} nodeTypes={nodeTypes} runtimeNodes={runtimeNodes} nodeEditors={nodeEditors} onChange={onGraphChange} />
      </>}
    </Card>
    {runs.length ? <Card className="lfaa-app-workflow__runs"><div className="lfaa-app-workflow__run-title"><div><Typography.Title level={4}>运行记录</Typography.Title><Typography.Text type="secondary">状态和结果来自已登记节点执行器与其领域 Owner。</Typography.Text></div><Tag>{runs.length}</Tag></div>
      {runs.map(run => <article className="lfaa-app-workflow__run" key={run.id}>
        <header><strong>{statusLabel[run.status]}</strong><Tag color={statusColor(run.status)}>{new Date(run.createdAt).toLocaleString("zh-CN")}</Tag>{!terminalStatuses.has(run.status) ? <Button size="small" danger onClick={() => void handleCancel(run.id)}>取消运行</Button> : null}</header>
        {run.nodes.map(node => {
          const question = pendingQuestion(node);
          const approval = pendingApproval(node);
          const questionKey = question ? `${run.id}:${question.questionId}` : "";
          return <div className="lfaa-app-workflow__run-node" key={node.nodeId}>
            <span>{node.title}</span><Tag color={statusColor(node.status)}>{nodeStatusLabel[node.status]}</Tag>
            {node.output ? <Typography.Paragraph className="lfaa-app-workflow__output">{node.output}{node.outputTruncated ? "…" : ""}</Typography.Paragraph> : null}
            {node.error ? <Typography.Text type="danger">{node.error}</Typography.Text> : null}
            {question ? <div className="lfaa-app-workflow__pending"><strong>{question.question}</strong><Space wrap>{question.options.map(option => <Button key={option} size="small" loading={answeringQuestion === questionKey} disabled={Boolean(answeringQuestion)} onClick={() => void handleQuestionAnswer(run.id, node, option)}>{option}</Button>)}</Space><Space.Compact block><Input aria-label="回答 Agent 澄清问题" value={questionAnswers[questionKey] ?? ""} maxLength={12000} onChange={event => setQuestionAnswers(current => ({ ...current, [questionKey]: event.target.value }))} onPressEnter={() => void handleQuestionAnswer(run.id, node, questionAnswers[questionKey] ?? "")} /><Button type="primary" disabled={!questionAnswers[questionKey]?.trim()} loading={answeringQuestion === questionKey} onClick={() => void handleQuestionAnswer(run.id, node, questionAnswers[questionKey] ?? "")}>发送回答</Button><Button disabled={Boolean(answeringQuestion)} onClick={() => void handleQuestionAnswer(run.id, node, "", true)}>跳过</Button></Space.Compact></div> : null}
            {approval ? <div className="lfaa-app-workflow__pending"><strong>需要你审批：{approval.title}</strong><Typography.Text>{approval.detail}</Typography.Text><Space><Button type="primary" size="small" loading={decidingApproval === approval.approvalId} disabled={Boolean(decidingApproval)} onClick={() => void handleApprovalDecision(approval.approvalId, "approved")}>批准本次操作</Button><Button danger size="small" disabled={Boolean(decidingApproval)} onClick={() => void handleApprovalDecision(approval.approvalId, "denied")}>拒绝</Button></Space></div> : null}
          </div>;
        })}
      </article>)}
    </Card> : null}
  </section>;
}
