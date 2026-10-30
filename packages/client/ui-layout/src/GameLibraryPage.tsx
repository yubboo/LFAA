/**
 * 功能：游戏服务聚合入口与共享运行环境页面。
 * 作用：聚合现有 Minecraft/SteamCMD 入口，环境操作统一调用 RuntimeManager。
 * 关联文件：Workbench、connection/runtime-api、games/runtime-manager。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Spin, Typography } from "antd";
import { getErrorMessage, type User } from "lfaa-client-connection/src/api.js";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { setFileManagerLocation } from "lfaa-client-connection/src/file-manager-location.js";
import { loadRuntimeOverview, runRuntimeOperation, loadRuntimeTask, listRuntimeTasks,cancelRuntimeTask, type RuntimeOverview, type RuntimeTask } from "lfaa-client-connection/src/runtime-api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import "./GameLibraryPage.css";
import {RuntimeEnvironmentPanel} from "./RuntimeEnvironmentPanel.js";

const runtimeOverviewSnapshots=createSnapshotCache<{ overview: RuntimeOverview; refreshedAt: number }>();
const RUNTIME_OVERVIEW_FRESHNESS_MS = 30_000;

export function GameLibraryPage({ user, environments = false, canBrowseLocalFiles, onNavigate, onOpenStorage }: {
  user: User; environments?: boolean; canBrowseLocalFiles:boolean; onNavigate: (path: string) => void; onOpenStorage:()=>void;
}) {
  const snapshotKey=`${user.id}\u001f${user.role}`;
  const cachedSnapshot=useRef(runtimeOverviewSnapshots.get(snapshotKey)??null).current;
  const [overviewState, setOverviewState] = useState<{key:string;snapshot:{overview:RuntimeOverview;refreshedAt:number}|null}>(()=>({key:snapshotKey,snapshot:cachedSnapshot}));
  const overview=overviewState.key===snapshotKey?overviewState.snapshot?.overview??null:null;
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [targetId, setTargetId] = useState(()=>new URLSearchParams(window.location.search).get("target")??"local");
  const [task, setTask] = useState<RuntimeTask | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(()=>{if(user.role==="member")return;const controller=new AbortController();void listRuntimeTasks(controller.signal).then(value=>{if(!controller.signal.aborted)setTask(current=>current??value.tasks.find(item=>["queued","running"].includes(item.status))??null);}).catch(reason=>{if(!controller.signal.aborted)setError(getErrorMessage(reason));});return()=>controller.abort();},[user.id,user.role]);
  useEffect(() => {
    const cached = runtimeOverviewSnapshots.get(snapshotKey) ?? null;
    setOverviewState({key:snapshotKey,snapshot:cached});
    if (revision === 0 && cached && Date.now() - cached.refreshedAt < RUNTIME_OVERVIEW_FRESHNESS_MS) return;
    const controller = new AbortController();
    setError("");
    void loadRuntimeOverview(controller.signal).then(value=>{if(!controller.signal.aborted){const snapshot={overview:value,refreshedAt:Date.now()};runtimeOverviewSnapshots.set(snapshotKey,snapshot);setOverviewState({key:snapshotKey,snapshot});}}).catch(reason => {
      if (!controller.signal.aborted) setError(getErrorMessage(reason));
    });
    return () => controller.abort();
  }, [revision, snapshotKey]);
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
    poller = createReadPoller(read, 3000);
    return () => { controller.abort(); poller?.stop(); };
  }, [task?.id, user.id]);
  const operate = useCallback(async (operation: string, values: Record<string, unknown> = {}) => {
    setBusy(true); setError("");
    try { setTask(await runRuntimeOperation({ targetId, operation, ...values })); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  }, [targetId]);
  const canOperate = user.role !== "member" && !busy && !["queued", "running"].includes(task?.status ?? "");
  const returnValue=environments?new URLSearchParams(window.location.search).get("return"):null;
  const returnPath=returnValue==="minecraft"?"/games/minecraft/deployment":returnValue==="overview"?"/games/minecraft/overview":returnValue&&/^[a-f0-9-]{36}$/iu.test(returnValue)?`/games/minecraft/instance/${returnValue}/overview`:null;
  return <section className={`game-library${environments?" game-library--environments":""}`} aria-labelledby="game-library-heading">
    <header className="game-library__header">
      <div><Typography.Title id="game-library-heading" level={1}>{environments ? "运行环境" : "游戏服务"}</Typography.Title>
        <Typography.Paragraph>{environments ? "本机与远程设备各自管理环境，Minecraft 和 SteamCMD 共用已验证的运行资源。" : "从环境准备到服务器运行，在同一个入口管理游戏服务。"}</Typography.Paragraph></div>
      {environments ? <nav className="game-library__header-actions" aria-label="运行环境页面导航">
        {returnPath?<Button type="primary" className="game-library__return-minecraft" aria-label={returnValue==="minecraft"?"返回部署草稿":"返回 Minecraft"} title={returnValue==="minecraft"?"返回部署草稿":"返回 Minecraft"} icon={<WorkbenchIcon className="game-library__return-minecraft-icon" name="arrowRight" size={16}/>} onClick={()=>onNavigate(returnPath)}><span className="game-library__action-label">{returnValue==="minecraft"?"返回部署草稿":"返回 Minecraft"}</span></Button>:null}
        <Button className="game-library__return-action" aria-label="返回游戏服务" title="返回游戏服务" icon={<WorkbenchIcon className="game-library__return-icon" name="arrowRight" size={16} />} onClick={() => onNavigate("/games")}><span className="game-library__action-label">返回游戏服务</span></Button>
      </nav> : null}
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
        <Typography.Paragraph>保留已有实例、世界和配置。手动部署或交给 小鱼智能体 准备并启动。</Typography.Paragraph>
        <p className="game-library__status">已有部署与服务器管理</p>
        <Button type="primary" onClick={() => onNavigate("/games/minecraft")}>进入 Minecraft</Button>
      </article>
      <article className="game-library__card">
        <span className="game-library__icon"><WorkbenchIcon name="terminal" size={28} /></span>
        <Typography.Title level={2}>Steam 游戏服务器</Typography.Title>
        <Typography.Paragraph>部署和更新 Steam 专用服务端，按目标设备管理游戏服务器实例。</Typography.Paragraph>
        <p className="game-library__status">支持 Steam 已发布的专用服务端 AppID</p>
        <Button type="primary" onClick={() => onNavigate("/games/steamcmd")}>管理 Steam 游戏服务器</Button>
      </article>
    </div> : <>
      {overview?<RuntimeEnvironmentPanel overview={overview} targetId={targetId} setTargetId={setTargetId} canOperate={canOperate} canBrowseLocalFiles={canBrowseLocalFiles} operate={operate} task={task} onNavigate={onNavigate} onOpenStorage={onOpenStorage} onOpenSteamcmd={()=>onNavigate("/games/steamcmd")} onManageSteamcmd={nodeId=>{setFileManagerLocation(user.id,`.lfaa-library/game-storage/${nodeId}/steamcmd-runtime`);onNavigate("/files");}} />:!error?<div role="status"><Spin/> 正在读取设备的实际环境…</div>:null}
      {task ? <section className="game-library__runtime" aria-label="运行环境任务"><div><Typography.Title level={3}>环境任务</Typography.Title><p>{task.message}</p>{task.result&&typeof task.result==="object"&&"message" in task.result?<p>{String(task.result.message)}</p>:null}{task.result&&typeof task.result==="object"&&"installerPath" in task.result?<code>{String(task.result.installerPath)}</code>:null}<p>{({ queued: "等待中", running: "执行中", succeeded: "已完成", failed: "失败", cancelled: "已取消" })[task.status]}</p></div>{["queued", "running"].includes(task.status) ? <Button disabled={task.cancelRequested} onClick={() => void cancelRuntimeTask(task.id).then(setTask).catch(reason => setError(getErrorMessage(reason)))}>{task.cancelRequested ? "等待确认取消" : "取消任务"}</Button> : null}</section> : null}
    </>}
  </section>;
}
