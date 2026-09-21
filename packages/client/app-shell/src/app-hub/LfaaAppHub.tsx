/**
 * 文件：packages/client/app-shell/src/app-hub/LfaaAppHub.tsx
 * 作用：登录后的 LFAA Smart Home；同时提供自然语言主入口与手动工作区入口。
 * 负责：欢迎区、Smart Composer、快捷任务、App/Workspace 入口、当前用户摘要与退出登录。
 * 不负责：Intent Router、App Pack Registry、Capability Scope、项目/Session 真值、Agent 执行。
 * 状态归属：只持有 Smart Composer 临时输入；入口清单由上层 Composition 注入。
 * 对外接口：LfaaAppHub、AppHubEntry。
 * 关联文件：packages/client/web/src/App.tsx、@lfaa/plugin-runtime、AgentWorkbench.tsx。
 * 修改注意事项：没有真实 Intent Router 时禁止关键词假路由；未接入真实 App Pack 的入口必须 disabled。
 */
import { useMemo, useState, type FormEvent } from "react";
import type { LfaaAuthenticatedUser } from "@lfaa/identity";
import "../product-surface.css";
import styles from "./AppHub.module.css";

export interface AppHubEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly glyph: string;
  readonly available: boolean;
  readonly badge?: string;
}

const QUICK_TASKS = [
  "写一篇文章",
  "分析一个项目",
  "做一份研究",
  "规划服务器部署",
] as const;

function ArrowIcon({ direction = "up" }: { direction?: "up" | "right" }) {
  return direction === "up" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" /></svg>
  );
}

function SparkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8c.6 4 2.8 6.2 6.8 6.8-4 .6-6.2 2.8-6.8 6.8-.6-4-2.8-6.2-6.8-6.8 4-.6 6.2-2.8 6.8-6.8Z" /><path d="M18.6 15.2c.25 1.75 1.2 2.7 2.95 2.95-1.75.25-2.7 1.2-2.95 2.95-.25-1.75-1.2-2.7-2.95-2.95 1.75-.25 2.7-1.2 2.95-2.95Z" /></svg>;
}

function GridIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>;
}

export function LfaaAppHub({ identity, entries, onEnter, onStartIntent, onLogout }: {
  identity: LfaaAuthenticatedUser;
  entries: readonly AppHubEntry[];
  onEnter: (entry: AppHubEntry) => void;
  onStartIntent: (input: string) => void;
  onLogout: () => void;
}) {
  const [draft, setDraft] = useState("");
  const availableEntries = useMemo(() => entries.filter((entry) => entry.available), [entries]);
  const primaryWorkspace = availableEntries[0] ?? null;
  const submitIntent = (event?: FormEvent) => {
    event?.preventDefault();
    const input = draft.trim();
    if (!input || !primaryWorkspace) return;
    onStartIntent(input);
  };
  const startQuickTask = (task: string) => {
    if (!primaryWorkspace) return;
    setDraft(task);
    onStartIntent(task);
  };

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true"><span/><span/><span/></div>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.brand}><span>L</span><strong>LFAA</strong></div>
          <nav className={styles.nav} aria-label="Smart Home 导航">
            <span className={styles.navActive}>首页</span>
            {primaryWorkspace ? <button type="button" onClick={() => onEnter(primaryWorkspace)}>工作区</button> : null}
            <a href="#manual-entry">应用</a>
          </nav>
        </div>
        <div className={styles.user}>
          <span className={styles.avatar}>{identity.user.displayName.slice(0, 1).toUpperCase()}</span>
          <span className={styles.userCopy}><strong>{identity.user.displayName}</strong><small>{identity.roles.map((role) => role.name).join(" · ") || identity.user.username}</small></span>
          <button className={styles.logout} type="button" onClick={onLogout}>退出</button>
        </div>
      </header>

      <section className={styles.hero}>
        <aside className={styles.sideNote} aria-hidden="true">
          <span>一个入口，<br/>连接你的全部创造力。</span>
          <i/>
          <small>Chat · Work · Manual<br/>源于同一核心。</small>
        </aside>
        <div className={styles.heroCenter}>
          <p className={styles.eyebrow}>YOUR AI WORKSPACE</p>
          <h1>{identity.user.displayName}，今天想做什么？</h1>
          <p className={styles.lead}>告诉 LFAA 你的目标。你也可以跳过智能入口，直接手动进入任何已经可用的工作区。</p>
          <form className={styles.composer} onSubmit={submitIntent}>
            <span className={styles.spark}><SparkIcon/></span>
            <textarea
              aria-label="告诉 LFAA 你想完成什么"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitIntent();
                }
              }}
              placeholder="告诉 LFAA 你想完成什么，我会把任务带入当前可用工作区…"
            />
            <button className={styles.send} type="submit" disabled={!draft.trim() || !primaryWorkspace} aria-label="开始任务"><ArrowIcon/></button>
          </form>
          <div className={styles.quickTasks} aria-label="快捷任务">
            {QUICK_TASKS.map((task, index) => <button key={task} type="button" onClick={() => startQuickTask(task)} disabled={!primaryWorkspace}><span>{index + 1}</span>{task}</button>)}
            {primaryWorkspace ? <button type="button" onClick={() => onEnter(primaryWorkspace)}><span>↗</span>手动进入工作台</button> : null}
          </div>
          <div className={styles.routingNote}><span className={styles.routingDot}/><span>智能路由接口已预留；当前任务会完整交给通用工作台，不做关键词假判断。</span></div>
        </div>
        <aside className={styles.rightNote} aria-hidden="true"><span>更少的切换<br/>更专注的创造</span><i/><small>LESS TOOLS<br/>MORE POSSIBILITIES</small></aside>
      </section>

      <section className={styles.manualSection} id="manual-entry">
        <div className={styles.sectionHeader}>
          <div><span className={styles.sectionIcon}><GridIcon/></span><div><p>MANUAL ENTRY</p><h2>手动进入</h2></div></div>
          <span>不需要等待 AI 判断，直接选择你想去的地方。</span>
        </div>
        <div className={styles.grid}>
          {entries.map((entry) => (
            <button key={entry.id} type="button" className={styles.card} data-disabled={!entry.available} disabled={!entry.available} onClick={() => onEnter(entry)}>
              <span className={styles.glyph}>{entry.glyph}</span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}><strong>{entry.title}</strong><small>{entry.available ? (entry.badge ?? "可用") : "即将开放"}</small></span>
                <span>{entry.description}</span>
              </span>
              <span className={styles.cardArrow}>{entry.available ? <ArrowIcon direction="right"/> : "·"}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className={styles.footer}><span>本地安全访问 · Identity Gate 保护</span><span>Chat · Work · Manual · 同一核心</span></footer>
    </main>
  );
}
