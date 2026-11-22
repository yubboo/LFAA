// 重构后的右侧工作台面板：对齐参考图布局（搜索/URL、6 项入口、子智能体、后台任务）并保留文件标签与工作详情。
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  IconArrowLeft, IconCheck, IconChevronRight, IconCircleX, IconClock, IconDotsVertical,
  IconFile, IconFileSearch, IconMessageCircle, IconPuzzle, IconSearch, IconTerminal2, IconWorld,
} from "@tabler/icons-react";
import { RightBrowserPane } from "@lfaa/browser/client";
import type { ChatClientStore } from "../store/chat-store";
import type { ChatLocaleMessages } from "../locales";
import { RightSideAskPane } from "./RightSideAskPane";
import { RightSubagentsPane, type RightSubagentItem } from "./RightSubagentsPane";
import { RightTerminalPane, type RightJobItem } from "./RightTerminalPane";
import { WorkspaceFileTabs } from "./WorkspaceFileTabs";
import styles from "./AgentContextPanel.module.css";

type RightSubview = "overview" | "files" | "terminal" | "browser" | "sideAsk" | "subagents" | "details";

export function AgentContextPanel({
  locale,
  store,
  boundProjectName,
  showFilePreview,
  onOpenSettings,
  onOpenCodeReview,
  onOpenExtensions,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
  boundProjectName: string | null;
  showFilePreview: boolean;
  onOpenSettings: () => void;
  onOpenCodeReview?: (() => void) | undefined;
  onOpenExtensions?: (() => void) | undefined;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [subview, setSubview] = useState<RightSubview>("overview");
  const [query, setQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [jobs, setJobs] = useState<RightJobItem[]>([]);
  const [subagents, setSubagents] = useState<RightSubagentItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [selectedSubagentId, setSelectedSubagentId] = useState<string>();
  const [browserInitialUrl, setBrowserInitialUrl] = useState<string>();
  const [showAllJobs, setShowAllJobs] = useState(false);

  const sessionId = state.activeSession?.id ?? "default";
  const selection = showFilePreview ? state.filePreviewTabs?.find((tab) => tab.id === state.activeFilePreviewId) : undefined;
  const selectedStep = state.activeSession?.messages.find((message) => message.id === selection?.messageId)
    ?.steps?.find((step) => step.id === selection?.stepId);

  // 点击聊天内文件或工具栏「浏览器」入口时自动切到对应子视图。
  useEffect(() => {
    if (!state.rightPanelRequest) return;
    const req = state.rightPanelRequest;
    setSubview(req.tab as RightSubview);
    if (req.url) setBrowserInitialUrl(req.url);
  }, [state.rightPanelRequest]);

  useEffect(() => {
    if (showFilePreview && selection && selectedStep) {
      setSubview("files");
    }
  }, [selection, selectedStep, showFilePreview]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      try {
        const [jobsRes, subsRes] = await Promise.all([
          fetch(`/api/jobs?sessionId=${encodeURIComponent(sessionId)}`).then((r) => (r.ok ? r.json() : { jobs: [] })),
          fetch(`/api/subagents?sessionId=${encodeURIComponent(sessionId)}`).then((r) => (r.ok ? r.json() : { subagents: [] })),
        ]);
        if (!active) return;
        if (Array.isArray(jobsRes.jobs)) setJobs(jobsRes.jobs);
        if (Array.isArray(subsRes.subagents)) setSubagents(subsRes.subagents);
      } catch {
        // 忽略后台概览轮询偶发失败
      }
    };
    void loadSummary();
    const timer = setInterval(() => void loadSummary(), 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId]);

  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
  const activeRulesCount = state.rules.filter((r) => r.content.trim().length > 0).length;
  const trustedPatternCount = Object.values(state.smartTrustCounts).filter((count) => count >= 3).length;
  const permissionModeName = state.permissionMode === "full"
    ? locale.permissionFullLabel
    : state.permissionMode === "smart"
      ? locale.permissionSmartLabel
      : locale.permissionAskLabel;
  const toolsValue = state.permissionMode === "full"
    ? locale.toolsFullAccess
    : boundProjectName ? `${boundProjectName} · ${locale.toolsReady}` : locale.toolsUnbound;

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const val = query.trim();
    if (!val) return;
    if (/^(?:https?:\/\/|localhost[:/]|127\.0\.0\.1[:/])/iu.test(val)) {
      setBrowserInitialUrl(val);
      setSubview("browser");
    }
  };

  const renderDetails = () => (
    <div className={styles.subviewStack}>
      <div className={styles.card}>
        <div className={styles.item}>
          <span className={styles.label}>{locale.brainLabel}</span>
          <span className={styles.value}>{activeProfile ? `${activeProfile.name} (${activeProfile.model})` : "-"}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>{locale.toolsLabel}</span>
          <span className={styles.value}>{toolsValue}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>{locale.permissionLabel}</span>
          <span className={`${styles.value} ${state.permissionMode === "full" ? styles.valueDanger : ""}`}>
            {permissionModeName}
            {state.permissionMode === "smart" && trustedPatternCount > 0
              ? ` · ${locale.smartTrustedPrefix} ${trustedPatternCount} ${locale.smartTrustedSuffix}`
              : ""}
          </span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>{locale.memoryLabel}</span>
          <span className={styles.value}>{`${state.memories.length} ${locale.memoryCountSuffix}`}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>{locale.rulesLabel}</span>
          <span className={styles.value}>{`${activeRulesCount} ${locale.rulesLayersCountSuffix}`}</span>
        </div>
      </div>
      {Object.keys(state.smartTrustCounts).length > 0 && (
        <button type="button" className={styles.settingsBtn} onClick={() => void store.resetSmartTrust()}>
          {locale.resetSmartTrust}
        </button>
      )}
      <button type="button" className={styles.settingsBtn} onClick={onOpenSettings}>
        {locale.openAgentSettings}
      </button>
    </div>
  );

  if (subview !== "overview") {
    const titles: Record<Exclude<RightSubview, "overview">, string> = {
      files: locale.isZh ? "打开文件" : "Files",
      terminal: locale.isZh ? "终端与后台任务" : "Terminal & Tasks",
      browser: locale.isZh ? "内置浏览器" : "Built-in Browser",
      sideAsk: locale.isZh ? "侧边提问" : "Side Ask",
      subagents: locale.isZh ? "子智能体" : "Subagents",
      details: locale.isZh ? "工作详情" : "Work details",
    };
    return (
      <div className={styles.stack}>
        <div className={styles.subviewHeader}>
          <button type="button" className={styles.backBtn} onClick={() => setSubview("overview")}>
            <IconArrowLeft size={14} aria-hidden="true" />
            <span>{titles[subview]}</span>
          </button>
        </div>
        {subview === "files" && (
          selection && selectedStep && state.activeSession ? (
            <WorkspaceFileTabs
              active={selection}
              tabs={state.filePreviewTabs}
              step={selectedStep}
              sessionId={state.activeSession.id}
              projectId={state.activeSession.projectId}
              worktreeId={state.activeSession.worktree?.id}
              isZh={locale.isZh}
              store={store}
            />
          ) : (
            <div className={styles.emptyBox}>
              <span>{locale.isZh ? "在聊天中点击创建或编辑的文件行，即可在这里按标签页查看源码与变更。" : "Click any file change in chat to inspect it here."}</span>
            </div>
          )
        )}
        {subview === "terminal" && <RightTerminalPane sessionId={sessionId} isZh={locale.isZh} selectedJobId={selectedJobId} />}
        {subview === "browser" && (
          <RightBrowserPane sessionId={sessionId} isZh={locale.isZh} initialUrl={browserInitialUrl} />
        )}
        {subview === "sideAsk" && (
          <RightSideAskPane
            isZh={locale.isZh}
            profileId={state.activeProfileId || undefined}
            contextHint={boundProjectName ? `当前绑定项目：${boundProjectName}` : ""}
          />
        )}
        {subview === "subagents" && <RightSubagentsPane sessionId={sessionId} isZh={locale.isZh} selectedSubagentId={selectedSubagentId} />}
        {subview === "details" && renderDetails()}
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const actions = [
    { id: "review", label: locale.isZh ? "审查" : "Review", icon: IconFileSearch, onClick: () => onOpenCodeReview?.() },
    { id: "files", label: locale.isZh ? "打开文件" : "Open file", icon: IconFile, onClick: () => setSubview("files") },
    { id: "terminal", label: locale.isZh ? "终端" : "Terminal", icon: IconTerminal2, onClick: () => setSubview("terminal") },
    { id: "browser", label: locale.isZh ? "浏览器" : "Browser", icon: IconWorld, onClick: () => setSubview("browser") },
    { id: "sideAsk", label: locale.isZh ? "侧边提问" : "Side ask", icon: IconMessageCircle, onClick: () => setSubview("sideAsk") },
    { id: "extensions", label: locale.isZh ? "扩展" : "Extensions", icon: IconPuzzle, chevron: true, onClick: () => onOpenExtensions?.() },
  ].filter((item) => !q || item.label.toLowerCase().includes(q));

  const filteredSubs = subagents.filter((s) => !q || s.role.toLowerCase().includes(q));
  const filteredJobs = jobs.filter((j) => !q || j.title.toLowerCase().includes(q));
  const visibleJobs = showAllJobs ? filteredJobs : filteredJobs.slice(0, 4);

  return (
    <div className={styles.stack}>
      <div className={styles.topBar}>
        <form className={styles.searchWrap} onSubmit={handleSearchSubmit}>
          <IconSearch size={14} aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={query}
            placeholder={locale.isZh ? "搜索或输入 URL" : "Search or enter URL"}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <button
          type="button"
          className={styles.moreBtn}
          aria-label={locale.isZh ? "更多工作台选项" : "More panel options"}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <IconDotsVertical size={15} />
        </button>
        {moreOpen && (
          <div className={styles.moreMenu} role="menu">
            <button type="button" className={styles.menuRow} role="menuitem" onClick={() => { setMoreOpen(false); setSubview("details"); }}>
              <span>{locale.isZh ? "工作详情（大脑/权限/记忆）" : "Work details"}</span>
            </button>
            <button type="button" className={styles.menuRow} role="menuitem" onClick={() => { setMoreOpen(false); onOpenSettings(); }}>
              <span>{locale.openAgentSettings}</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.menuList}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.id} type="button" className={styles.menuRow} onClick={action.onClick}>
              <span className={styles.menuRowLeft}>
                <Icon size={15} aria-hidden="true" />
                <span>{action.label}</span>
              </span>
              {action.chevron && <IconChevronRight size={14} className={styles.menuChevron} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <section className={styles.sectionBlock} aria-label={locale.isZh ? "子智能体" : "Subagents"}>
        <div className={styles.sectionHeader}>
          <span>{locale.isZh ? "子智能体" : "Subagents"}</span>
          <span className={styles.sectionCount}>{filteredSubs.length}</span>
        </div>
        {filteredSubs.slice(0, 5).map((sub) => {
          const Icon = sub.status === "running" ? IconClock : sub.status === "done" ? IconCheck : IconCircleX;
          return (
            <button
              key={sub.id}
              type="button"
              className={styles.menuRow}
              onClick={() => { setSelectedSubagentId(sub.id); setSubview("subagents"); }}
            >
              <span className={styles.menuRowLeft}>
                <Icon size={14} className={styles.statusIcon} data-status={sub.status} aria-hidden="true" />
                <span className={styles.taskTitle}>{sub.role}</span>
              </span>
            </button>
          );
        })}
      </section>

      <section className={styles.sectionBlock} aria-label={locale.isZh ? "后台任务" : "Background tasks"}>
        <div className={styles.sectionHeader}>
          <span>{locale.isZh ? "后台任务" : "Background tasks"}</span>
          <span className={styles.sectionCount}>{filteredJobs.length}</span>
        </div>
        {visibleJobs.map((job) => {
          const Icon = job.status === "running" ? IconClock : job.status === "done" ? IconCheck : IconCircleX;
          return (
            <button
              key={job.id}
              type="button"
              className={styles.menuRow}
              onClick={() => { setSelectedJobId(job.id); setSubview("terminal"); }}
            >
              <span className={styles.menuRowLeft}>
                <Icon size={14} className={styles.statusIcon} data-status={job.status} aria-hidden="true" />
                <span className={styles.taskTitle}>{job.title}</span>
              </span>
            </button>
          );
        })}
        {filteredJobs.length > 4 && (
          <button type="button" className={styles.viewAllBtn} onClick={() => setShowAllJobs((v) => !v)}>
            {showAllJobs ? (locale.isZh ? "收起" : "Show less") : (locale.isZh ? "查看全部" : "View all")}
          </button>
        )}
      </section>
    </div>
  );
}
