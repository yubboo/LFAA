import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Empty, Tag, Typography } from "antd";
import { loadAiOffice, type AiOfficeEmployee, type AiOfficeRun, type AiOfficeSnapshot, type ApplicationId, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { GlobalNavigationRail, type ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import "./agent-office.css";

interface AgentOfficePageProps {
  user: User;
  settings: UserSettings;
  serverState: ServiceState;
  applications: ApplicationNavigationItem[];
  navigationApplications: ApplicationNavigationItem[];
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: "normal" | "ai-work") => Promise<void>;
  onOpenApplications: () => void;
  onOpenRecentSessions: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

const POLL_INTERVAL_MS = 5_000;
const mainEmployee: AiOfficeEmployee = {
  id: "lfaa.main-agent",
  name: "小鱼主 Agent",
  description: "接收当前目标，根据实际可用能力安排工具和员工协作。",
  applicationIds: ["workspace"]
};
const subagentEmployee: AiOfficeEmployee = {
  id: "lfaa.subagent",
  name: "委派协作 Agent",
  description: "通过 LFAA 已接入的子代理驱动处理拆分任务。",
  applicationIds: []
};

function applicationName(appId: ApplicationId): string {
  if (appId === "minecraft") return "Minecraft";
  if (appId === "steamcmd") return "Steam 游戏服务";
  if (appId === "workspace") return "小鱼工作台";
  return appId;
}

function runState(run: AiOfficeRun): { label: string; tone: "blue" | "gold" | "default" } {
  if (run.pauseState === "paused") return { label: "已暂停", tone: "gold" };
  if (run.pauseState === "pausing") return { label: "正在暂停", tone: "gold" };
  if (run.status === "queued") return { label: "排队中", tone: "default" };
  return { label: "工作中", tone: "blue" };
}

function activityState(status: string): string {
  if (status === "running") return "进行中";
  if (status === "waiting_input") return "等待回复";
  if (status === "approval_required") return "等待审批";
  if (status === "error") return "失败";
  if (status === "unavailable") return "不可用";
  return "已完成";
}

function EmployeeDesk({ employee, runs, parentLabels }: { employee: AiOfficeEmployee; runs: AiOfficeRun[]; parentLabels: Map<string, string> }) {
  const current = runs.length > 0;
  const badge = employee.name.trim().slice(0, 1) || "AI";
  return (
    <article className={`agent-office-desk${current ? " agent-office-desk--active" : ""}`} aria-labelledby={`agent-office-${employee.id}`}>
      <header className="agent-office-desk__header">
        <span className="agent-office-desk__avatar" aria-hidden="true">{badge}</span>
        <div className="agent-office-desk__identity">
          <Typography.Title id={`agent-office-${employee.id}`} level={4}>{employee.name}</Typography.Title>
          <Typography.Text type="secondary">{employee.description}</Typography.Text>
        </div>
        <Tag color={current ? "processing" : undefined}>{current ? `${runs.length} 项工作` : "待命"}</Tag>
      </header>
      {employee.applicationIds.length > 0 ? <div className="agent-office-desk__scopes" aria-label="应用范围">
        {employee.applicationIds.map(appId => <Tag key={appId}>{applicationName(appId)}</Tag>)}
      </div> : <div className="agent-office-desk__scopes"><Tag>通用协作</Tag></div>}
      {current ? <div className="agent-office-desk__tasks">
        {runs.map(run => {
          const state = runState(run);
          const latestActivity = run.activities.at(-1);
          const parentLabel = run.parentRunId ? parentLabels.get(run.parentRunId) ?? "上级 Agent" : null;
          return <section className="agent-office-task" key={run.id} aria-label={`${run.label}：${state.label}`}>
            <div className="agent-office-task__heading">
              <span className={`agent-office-task__state agent-office-task__state--${state.tone}`}><i aria-hidden="true" />{state.label}</span>
              <time dateTime={run.startedAt}>{new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} 开始</time>
            </div>
            <p className="agent-office-task__goal">{run.task || run.label}</p>
            <div className="agent-office-task__meta">
              <span>{applicationName(run.appId)}</span>
              {parentLabel ? <span>由 {parentLabel} 委派</span> : null}
              {run.driver ? <span>{run.driver} 驱动</span> : null}
            </div>
            <div className="agent-office-task__activity">
              <WorkbenchIcon name={latestActivity?.kind === "agent" ? "branch" : latestActivity?.kind === "command" ? "terminal" : "tools"} size={15} />
              {latestActivity ? <><span className="agent-office-task__activity-title">{latestActivity.title}</span><span className="agent-office-task__activity-state">{activityState(latestActivity.status)}</span></>
                : <span className="agent-office-task__activity-title">已启动，等待首个公开执行回报</span>}
            </div>
          </section>;
        })}
      </div> : <p className="agent-office-desk__idle">桌位空闲 · 当前没有活动任务</p>}
    </article>
  );
}

export function AgentOfficePage({ user, settings, serverState, applications, navigationApplications, onNavigate, onOpenApplication, onOpenApplications, onOpenRecentSessions, onOpenSettings, onLogout }: AgentOfficePageProps) {
  const [snapshot, setSnapshot] = useState<AiOfficeSnapshot | null>(null);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let requestActive = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const clearTimer = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
    const schedule = () => {
      clearTimer();
      if (!disposed && document.visibilityState === "visible") timer = window.setTimeout(refresh, POLL_INTERVAL_MS);
    };
    const refresh = async () => {
      if (disposed || requestActive || document.visibilityState !== "visible") return;
      requestActive = true;
      const current = new AbortController();
      controller = current;
      setRefreshing(true);
      try {
        const result = await loadAiOffice(current.signal);
        if (!disposed && !current.signal.aborted) {
          setSnapshot(result);
          setError(null);
          setUpdatedAt(new Date().toISOString());
        }
      } catch (loadError) {
        if (!disposed && !current.signal.aborted) setError(loadError instanceof Error ? loadError.message : "办公室状态读取失败。");
      } finally {
        if (controller === current) controller = undefined;
        requestActive = false;
        if (!disposed) {
          setFirstLoad(false);
          setRefreshing(false);
          schedule();
        }
      }
    };
    const onVisibilityChange = () => {
      clearTimer();
      if (document.visibilityState === "hidden") controller?.abort();
      else if (!requestActive) void refresh();
    };
    refreshRef.current = () => { clearTimer(); void refresh(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void refresh();
    return () => {
      disposed = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      refreshRef.current = null;
    };
  }, []);

  const activeRuns = snapshot?.runs ?? [];
  const employees = useMemo(() => {
    if (!snapshot) return [mainEmployee];
    const known = new Map<string, AiOfficeEmployee>([[mainEmployee.id, mainEmployee], ...snapshot.employees.map(employee => [employee.id, employee] as const)]);
    if (activeRuns.some(run => run.employeeId === subagentEmployee.id)) known.set(subagentEmployee.id, subagentEmployee);
    for (const run of activeRuns) if (!known.has(run.employeeId)) known.set(run.employeeId, { id: run.employeeId, name: run.label, description: "当前运行中的已登记 Agent。", applicationIds: [run.appId] });
    return [...known.values()];
  }, [snapshot, activeRuns]);
  const parentLabels = useMemo(() => new Map(activeRuns.map(run => [run.id, run.label])), [activeRuns]);
  const queuedCount = activeRuns.filter(run => run.status === "queued").length;
  const childCount = activeRuns.filter(run => run.parentRunId !== null).length;

  return (
    <div className="agent-office-stage module-workbench-stage">
      <GlobalNavigationRail
        username={user.username} role={user.role} serverState={serverState} shortcuts={settings.shortcuts}
        activePage="office" applications={applications} navigationApplications={navigationApplications}
        showServiceStatus={settings.general.showServiceStatus}
        onToggleApplications={onOpenApplications} onOpenRecentSessions={onOpenRecentSessions} onNavigate={onNavigate}
        onOpenApplication={onOpenApplication} onOpenFiles={() => onNavigate("/files")}
        onOpenSettings={onOpenSettings} onLogout={onLogout}
      />
      <main className="agent-office-page" aria-labelledby="agent-office-title">
        <div className="agent-office-content">
          <header className="agent-office-hero">
            <div className="agent-office-hero__heading">
              <span className="agent-office-hero__eyebrow"><WorkbenchIcon name="grid" size={15} />LFAA / AI 员工办公室</span>
              <Typography.Title id="agent-office-title" level={2}>看看团队正在做什么</Typography.Title>
              <Typography.Paragraph>员工来自当前已登记的专家和 Agent；任务状态、层级与执行步骤由运行中的任务实时汇报。</Typography.Paragraph>
            </div>
            <div className="agent-office-hero__actions">
              <span className="agent-office-sync" role="status">{error ? "同步遇到问题" : firstLoad ? "正在连接" : `状态更新于 ${updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}`}</span>
              <Button icon={<WorkbenchIcon name="refresh" size={16} />} onClick={() => refreshRef.current?.()} loading={refreshing}>立即刷新</Button>
            </div>
          </header>

          {error ? <Alert className="agent-office-error" type={snapshot ? "warning" : "error"} showIcon message={snapshot ? "办公室状态暂时未能同步" : "无法读取办公室状态"} description={snapshot ? `保留上次成功读取的状态。${error}` : error} /> : null}
          {snapshot?.truncated ? <Alert className="agent-office-error" type="info" showIcon message="当前显示前 100 个活动任务或员工" /> : null}

          <section className="agent-office-stats" aria-label="办公室概览">
            <div className="agent-office-stat"><span>登记员工</span><strong>{snapshot ? employees.length : firstLoad ? "…" : 0}</strong></div>
            <div className="agent-office-stat"><span>活动任务</span><strong>{snapshot ? activeRuns.length : firstLoad ? "…" : 0}</strong></div>
            <div className="agent-office-stat"><span>排队等待</span><strong>{snapshot ? queuedCount : firstLoad ? "…" : 0}</strong></div>
            <div className="agent-office-stat"><span>子 Agent</span><strong>{snapshot ? childCount : firstLoad ? "…" : 0}</strong></div>
          </section>

          <section className="agent-office-floor" aria-labelledby="agent-office-floor-title">
            <header className="agent-office-floor__header">
              <div><Typography.Title id="agent-office-floor-title" level={3}>团队工位</Typography.Title><Typography.Text type="secondary">没有活动任务时会显示“待命”；完成或中断的任务不会被标成正在工作。</Typography.Text></div>
              <Tag color={activeRuns.length ? "processing" : undefined}>{activeRuns.length ? `${activeRuns.length} 个活动任务` : "当前空闲"}</Tag>
            </header>
            {firstLoad && !snapshot ? <div className="agent-office-loading" role="status" aria-live="polite">正在读取已登记员工与真实运行状态…</div>
              : snapshot && employees.length === 0 ? <Empty description="当前没有已登记的专家员工" />
              : <div className="agent-office-desks">{employees.map(employee => <EmployeeDesk key={employee.id} employee={employee} runs={activeRuns.filter(run => run.employeeId === employee.id)} parentLabels={parentLabels} />)}</div>}
            {!firstLoad && !snapshot && !error ? <Empty description="办公室状态暂不可用" /> : null}
          </section>
          <footer className="agent-office-footnote">只读观察 · 每 5 秒同步一次 · 页面切到后台时暂停刷新</footer>
        </div>
      </main>
    </div>
  );
}
