/**
 * 功能：展示 Agent 在节点上派发的真实命令与文件任务输出。
 * 作用：按当前账户读取任务、退出码与截断状态；运行入口使用聊天与权限合同，不伪装交互式 PTY。
 * 关联文件：ApplicationWorkspace.tsx、connection/api.ts、api/session-controller、jobs/ai-host-tasks.ts。
 */
import { useEffect, useMemo, useState } from "react";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { Alert, Button, Select } from "antd";
import { getErrorMessage, loadAiHostTasks, loadAiHostTask, cancelAiHostTask, type AiHostTask } from "lfaa-client-connection/src/api.js";
import { sameTerminalTask } from "./terminal-snapshot.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export function TaskTerminal({ onClose }: { onClose: () => void }) {
  const [tasks, setTasks] = useState<AiHostTask[]>([]), [selectedId, setSelectedId] = useState<string>(), [current, setCurrent] = useState<AiHostTask | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const result = await loadAiHostTasks(); if (!alive) return;
        setTasks(current => current.length === result.tasks.length && current.every((task, index) => sameTerminalTask(task, result.tasks[index]!)) ? current : result.tasks);
        const id = selectedId ?? result.tasks[0]?.id;
        if (id) { const detail = await loadAiHostTask(id); if (alive) setCurrent(current => sameTerminalTask(current, detail.task) ? current : detail.task); } else setCurrent(null);
        if (alive) setError("");
      } catch (error) { if (alive) setError(getErrorMessage(error)); }
    };
    const poller = createReadPoller(refresh, 2000);
    return () => { alive = false; poller.stop(); };
  }, [selectedId]);
  const options = useMemo(() => tasks.map(task => ({ value: task.id, label: `${task.shell} · ${task.status} · ${task.id.slice(0, 8)}` })), [tasks]);
  const output = useMemo(() => current ? `${current.message}\n${current.result ? `退出码：${current.result.exitCode ?? "未知"}${current.result.timedOut ? " · 已超时" : ""}${current.result.outputTruncated ? " · 输出已截断" : ""}\n${current.result.stdout}${current.result.stderr ? `\n${current.result.stderr}` : ""}` : current.status === "succeeded" || current.status === "failed" ? "输出保留期已结束或结果缺失。" : "任务尚未回传输出。"}` : "", [current]);
  return <section className="module-terminal" aria-label="节点任务输出">
    <header className="module-terminal__header"><div><WorkbenchIcon name="terminal" size={15} /><strong>节点任务输出</strong></div><button className="module-shell-icon-button" type="button" aria-label="关闭任务输出" onClick={onClose}><WorkbenchIcon name="close" size={15} /></button></header>
    <div className="module-terminal__body module-terminal__tasks">
      <Select aria-label="选择节点任务" value={selectedId ?? tasks[0]?.id} placeholder="暂无节点任务" options={options} onChange={setSelectedId} />
      {current && ["queued", "running"].includes(current.status) ? <Button disabled={current.cancelRequested} onClick={() => void cancelAiHostTask(current.id).then(({ task }) => setCurrent(selected => selected?.id === task.id ? task : selected)).catch(error => setError(getErrorMessage(error)))}>{current.cancelRequested ? "等待节点确认终止" : "停止节点任务"}</Button> : null}
      {error ? <Alert type="error" message={error} /> : current ? <pre className="module-terminal__output _block_lfaa_wallpaper_terminal">{output}</pre> : <span>通过聊天提出命令或验证目标；节点派发的真实任务会在这里显示。</span>}
    </div>
  </section>;
}
