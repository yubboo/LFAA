/**
 * 功能：游戏库一级入口与共享运行环境页面。
 * 作用：聚合现有 Minecraft/SteamCMD 入口，环境操作统一调用 RuntimeManager。
 * 关联文件：Workbench、connection/runtime-api、games/runtime-manager。
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Spin, Typography } from "antd";
import { getErrorMessage, type ApplicationId, type ApplicationMode, type User } from "lfaa-client-connection/src/api.js";
import { loadRuntimeOverview, runRuntimeOperation, loadRuntimeTask, listRuntimeTasks,cancelRuntimeTask, type RuntimeOverview, type RuntimeTask } from "lfaa-client-connection/src/runtime-api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import "./GameLibraryPage.css";
import {RuntimeEnvironmentPanel} from "./RuntimeEnvironmentPanel.js";

export function GameLibraryPage({ user, environments = false, onNavigate, onOpenApplication,onOpenStorage }: {
  user: User; environments?: boolean; onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  onOpenStorage:()=>void;
}) {
  const [overview, setOverview] = useState<RuntimeOverview | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [targetId, setTargetId] = useState(()=>new URLSearchParams(window.location.search).get("target")??"local");
  const [task, setTask] = useState<RuntimeTask | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(()=>{if(user.role==="member")return;const controller=new AbortController();void listRuntimeTasks(controller.signal).then(value=>{if(!controller.signal.aborted)setTask(current=>current??value.tasks.find(item=>["queued","running"].includes(item.status))??null);}).catch(reason=>{if(!controller.signal.aborted)setError(getErrorMessage(reason));});return()=>controller.abort();},[user.id,user.role]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void loadRuntimeOverview(controller.signal).then(value=>{if(!controller.signal.aborted)setOverview(value);}).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    });
    return () => controller.abort();
  }, [revision, user.id]);
  useEffect(() => {
    if (!task || !["queued", "running"].includes(task.status)) return;
    const controller = new AbortController();
    let poller: ReturnType<typeof createReadPoller> | undefined;
    const read = async () => {
      try {
        const next = await loadRuntimeTask(task.id, controller.signal);
        if (controller.signal.aborted) return;
        setTask(next);
        if (!["queued", "running"].includes(next.status)) { poller?.stop(); setRevision(value => value + 1); }
      } catch (reason) { if (!controller.signal.aborted) setError(getErrorMessage(reason)); }
    };
    poller = createReadPoller(read, 1500);
    return () => { controller.abort(); poller?.stop(); };
  }, [task?.id, user.id]);
  const operate = useCallback(async (operation: string, values: Record<string, unknown> = {}) => {
    setBusy(true); setError("");
    try { setTask(await runRuntimeOperation({ targetId, operation, ...values })); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  }, [targetId]);
  const canOperate = user.role !== "member" && !busy && !["queued", "running"].includes(task?.status ?? "");
  const openMinecraft=async(path:string)=>{await onOpenApplication("minecraft","normal");onNavigate(path);};
  return <section className={`game-library${environments?" game-library--environments":""}`} aria-labelledby="game-library-heading">
    <header className="game-library__header">
      <div><Typography.Title id="game-library-heading" level={1}>{environments ? "运行环境" : "游戏库"}</Typography.Title>
        <Typography.Paragraph>{environments ? "本机与远程设备各自管理环境，Minecraft 和 SteamCMD 共用已验证的运行资源。" : "从环境准备到服务器运行，在同一个入口管理游戏服务。"}</Typography.Paragraph></div>
      <Button onClick={() => onNavigate(environments ? "/games" : "/")}>{environments ? "返回游戏库" : "返回应用中心"}</Button>
    </header>
    {error ? <Alert type="error" showIcon message={error} action={<Button onClick={() => setRevision(value => value + 1)}>重试读取</Button>} /> : null}
    {!environments ? <div className="game-library__grid">
      <article className="game-library__card">
        <span className="game-library__icon"><WorkbenchIcon name="settings" size={28} /></span>
        <Typography.Title level={2}>运行环境</Typography.Title>
        <Typography.Paragraph>检测、安装和复用 Java，集中查看 SteamCMD 环境与设备状态。</Typography.Paragraph>
        <p className="game-library__status">{overview ? `${overview.devices.length} 个设备 · ${overview.devices.reduce((total, item) => total + item.runtimes.length, 0)} 个已检测环境` : error ? "环境状态读取失败" : "正在读取实际环境…"}</p>
        <Button type="primary" onClick={() => onNavigate("/games/environments")}>管理运行环境</Button>
      </article>
      <article className="game-library__card game-library__card--primary">
        <span className="game-library__icon"><WorkbenchIcon name="monitor" size={28} /></span>
        <Typography.Title level={2}>Minecraft 开服部署</Typography.Title>
        <Typography.Paragraph>保留已有实例、世界和配置。手动部署或交给 AI Work 准备并启动。</Typography.Paragraph>
        <p className="game-library__status">已有部署与服务器管理</p>
        <div className="game-library__actions"><Button type="primary" onClick={() => void onOpenApplication("minecraft", "normal")}>进入 Minecraft</Button><Button onClick={() => void onOpenApplication("minecraft", "ai-work")}>AI Work</Button></div>
      </article>
      <article className="game-library__card">
        <span className="game-library__icon"><WorkbenchIcon name="terminal" size={28} /></span>
        <Typography.Title level={2}>SteamCMD</Typography.Title>
        <Typography.Paragraph>管理 SteamCMD 安装、更新与节点命令，沿用现有游戏服务能力。</Typography.Paragraph>
        <p className="game-library__status">环境与命令已接入 · 游戏开服待接入</p>
        <div className="game-library__actions"><Button type="primary" onClick={() => void onOpenApplication("steamcmd", "normal")}>进入 SteamCMD</Button><Button onClick={() => void onOpenApplication("steamcmd", "ai-work")}>AI Work</Button></div>
      </article>
    </div> : <>
      {overview?<RuntimeEnvironmentPanel overview={overview} targetId={targetId} setTargetId={setTargetId} canOperate={canOperate} operate={operate} task={task} onNavigate={path=>void openMinecraft(path)} onOpenStorage={onOpenStorage} onOpenSteamcmd={()=>void onOpenApplication("steamcmd","normal")} />:!error?<div role="status"><Spin/> 正在读取设备的实际环境…</div>:null}
      {task ? <section className="game-library__runtime" aria-label="运行环境任务"><div><Typography.Title level={3}>环境任务</Typography.Title><p>{task.message}</p>{task.result&&typeof task.result==="object"&&"message" in task.result?<p>{String(task.result.message)}</p>:null}{task.result&&typeof task.result==="object"&&"installerPath" in task.result?<code>{String(task.result.installerPath)}</code>:null}<p>{({ queued: "等待中", running: "执行中", succeeded: "已完成", failed: "失败", cancelled: "已取消" })[task.status]}</p></div>{["queued", "running"].includes(task.status) ? <Button disabled={task.cancelRequested} onClick={() => void cancelRuntimeTask(task.id).then(setTask).catch(reason => setError(getErrorMessage(reason)))}>{task.cancelRequested ? "等待确认取消" : "取消任务"}</Button> : null}</section> : null}
      <Button onClick={() => void onOpenApplication("steamcmd", "normal")}>管理 SteamCMD 环境</Button>
    </>}
  </section>;
}
