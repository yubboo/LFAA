/** 功能：为首次进入的用户展示通用工作区与领域 App 的工作入口。作用：仅负责选择入口/模式并交由 Workbench 路由 Owner 完成。关联文件：Workbench.tsx、ui-renderer/App.tsx。 */
import { useState } from "react";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import type { ApplicationId } from "lfaa-client-connection/src/api.js";
import { APPLICATION_LABELS } from "lfaa-util-values/src/application-id.js";
import "./guided-system-entry.css";

type GuidedEntryMode = "chat" | "canvas" | "manual";
type BusinessApplicationId = Exclude<ApplicationId, "workspace">;

const businessApplications: Array<{
  id: BusinessApplicationId;
  description: string;
  icon: WorkbenchIconName;
}> = [
  { id: "minecraft", description: "管理服务端、核心版本与运行任务", icon: "grid" },
  { id: "steamcmd", description: "安装运行环境并管理游戏服务器", icon: "folder" },
  { id: "connectivity", description: "查看联机目标、连接配置与状态", icon: "browser" },
  { id: "writing", description: "围绕写作项目整理资料与内容", icon: "book" },
  { id: "aivideo", description: "规划漫剧内容并管理分镜素材", icon: "spark" }
];

interface GuidedSystemEntryProps {
  visibleApplications: readonly ApplicationId[];
  onComplete: (application: ApplicationId, mode: GuidedEntryMode) => Promise<string | null>;
}

export function GuidedSystemEntry({ visibleApplications, onComplete }: GuidedSystemEntryProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationId | null>(null);
  const [selectedMode, setSelectedMode] = useState<GuidedEntryMode>("chat");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableApplications = businessApplications.filter(application => visibleApplications.includes(application.id));
  const selectedLabel = selectedApplication ? APPLICATION_LABELS[selectedApplication] : "";
  const modes: Array<{ id: GuidedEntryMode; title: string; description: string; icon: WorkbenchIconName }> = [
    { id: "chat", title: "聊天", description: selectedApplication === "workspace" ? "直接对话、写代码或推进项目；不需要关联业务 App。" : "用自然语言描述目标，由 Agent 在当前 App 范围内协助完成。", icon: "spark" },
    { id: "canvas", title: "画布", description: "用可视化节点组织工作；节点能力由当前 App 提供。", icon: "branch" },
    ...(selectedApplication === "workspace" ? [] : [{ id: "manual" as const, title: "手动面板", description: "直接使用当前 App 已有的业务面板和操作入口。", icon: "tools" as const }])
  ];

  async function enter(application: ApplicationId, mode: GuidedEntryMode) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const message = await onComplete(application, mode);
      if (message) setError(message);
    } catch (entryError) {
      setError(entryError instanceof Error ? entryError.message : "暂时无法保存入口选择，请重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="guided-system-entry" aria-labelledby="guided-system-entry-title" aria-busy={saving}>
      <div className="guided-system-entry__content">
        <header className="guided-system-entry__header">
          <div className="guided-system-entry__brand"><span aria-hidden="true">L</span><span>LFAA</span></div>
          <p className="guided-system-entry__step">首次使用 · 第 {step} 步 / 共 2 步</p>
        </header>

        {step === 1 ? <section className="guided-system-entry__stage" aria-describedby="guided-system-entry-description">
          <div className="guided-system-entry__intro">
            <p className="guided-system-entry__eyebrow">一个 Agent，连接你的工作</p>
            <h1 id="guided-system-entry-title">你想从哪里开始？</h1>
            <p id="guided-system-entry-description">通用工作区可以直接聊天、写代码和推进项目。需要特定业务能力时，再进入对应 App。</p>
          </div>

          <div className="guided-system-entry__applications" role="group" aria-label="选择工作空间">
            <button
              className={`guided-system-entry__application${selectedApplication === "workspace" ? " is-selected" : ""}`}
              type="button"
              aria-pressed={selectedApplication === "workspace"}
              onClick={() => setSelectedApplication("workspace")}
            >
              <span className="guided-system-entry__application-icon"><WorkbenchIcon name="terminal" /></span>
              <span className="guided-system-entry__application-copy"><strong>通用工作区</strong><span>聊天、代码开发与项目工作，无需选择业务 App。</span></span>
              <span className="guided-system-entry__selection">{selectedApplication === "workspace" ? <WorkbenchIcon name="check" /> : null}</span>
            </button>

            {availableApplications.map(application => {
              return <button
                key={application.id}
                className={`guided-system-entry__application${selectedApplication === application.id ? " is-selected" : ""}`}
                type="button"
                aria-pressed={selectedApplication === application.id}
                onClick={() => setSelectedApplication(application.id)}
              >
                <span className="guided-system-entry__application-icon"><WorkbenchIcon name={application.icon} /></span>
                <span className="guided-system-entry__application-copy"><strong>{APPLICATION_LABELS[application.id]}</strong><span>{application.description}</span></span>
                <span className="guided-system-entry__selection">{selectedApplication === application.id ? <WorkbenchIcon name="check" /> : null}</span>
              </button>;
            })}
          </div>
        </section> : <section className="guided-system-entry__stage" aria-describedby="guided-system-entry-mode-description">
          <div className="guided-system-entry__intro">
            <p className="guided-system-entry__eyebrow">已选择 · {selectedLabel}</p>
            <h1 id="guided-system-entry-title">选择你的工作方式</h1>
            <p id="guided-system-entry-mode-description">聊天、画布与手动面板共享当前工作范围，可以按任务切换。</p>
          </div>
          <div className="guided-system-entry__modes" role="group" aria-label="选择工作方式">
            {modes.map(({ id, title, description, icon: Icon }) => <button
              key={id}
              className={`guided-system-entry__mode${selectedMode === id ? " is-selected" : ""}`}
              type="button"
              aria-pressed={selectedMode === id}
              onClick={() => setSelectedMode(id)}
            >
              <span className="guided-system-entry__mode-icon"><WorkbenchIcon name={Icon} /></span>
              <span className="guided-system-entry__mode-copy"><strong>{title}</strong><span>{description}</span></span>
              <span className="guided-system-entry__selection">{selectedMode === id ? <WorkbenchIcon name="check" /> : null}</span>
            </button>)}
          </div>
        </section>}

        <footer className="guided-system-entry__footer">
          <div className="guided-system-entry__footer-side">
            {step === 2 ? <button className="guided-system-entry__text-button" type="button" disabled={saving} onClick={() => { setStep(1); setError(null); }}>上一步</button> : null}
            <button className="guided-system-entry__text-button guided-system-entry__skip" type="button" disabled={saving} onClick={() => void enter("workspace", "chat")}>跳过，直接进入通用工作区</button>
          </div>
          {step === 1 ? <button className="guided-system-entry__primary" type="button" disabled={!selectedApplication || saving} onClick={() => { setSelectedMode("chat"); setError(null); setStep(2); }}>
            继续<WorkbenchIcon name="arrowRight" />
          </button> : <button className="guided-system-entry__primary" type="button" disabled={!selectedApplication || saving} onClick={() => selectedApplication && void enter(selectedApplication, selectedMode)}>
            {saving ? "正在进入…" : `进入${selectedLabel}`}<WorkbenchIcon name="arrowRight" />
          </button>}
        </footer>
        {error ? <p className="guided-system-entry__error" role="alert">{error}</p> : null}
      </div>
    </main>
  );
}
