/**
 * 文件：AiWorkChat.tsx
 * 功能：提供 SteamCMD、Minecraft 和写作工作区的 AI Work 流式聊天。
 * 作用：调用控制端会话 API，显示持久化历史、悬停式提问锚点、Provider 输出、真实用量状态和消息输入区；呈现带权限说明的账户级模式选择，并把完成、错误和审批事件交给工作台通知中心。
 * 不负责：业务规则、节点任务执行和审批授权；这些由 server 核心及 Daemon 完成。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/store/src/scroll-restoration.ts、packages/api/gateway/src/index.ts。
 * 修改注意事项：只展示 server 发来的真实 Agent、工具、子 Agent、Skill 和审批状态。
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type UIEvent } from "react";
import { Alert, Button, Dropdown, Empty, Input, Modal, Spin, Tag, Tooltip, Typography } from "antd";
import { appendAiRunInput, cancelAiRun, decideAiApproval, getErrorMessage, loadAiAccounts, loadAiMessages, loadAiSessions, saveSettings, streamAiChat, updateAiAccountModel, type AiAccount, type AiMessage, type AiSession, type ApplicationId, type UserSettings } from "lfaa-client-connection/src/api.js";
import { notifyAiWorkAction, notifyAiWorkCompletion, type AiWorkNotificationInput } from "lfaa-client-resources/src/notification-runtime.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { AiMarkdown } from "./AiMarkdown.js";
import { supportsVoiceInput, startVoiceInput, readResponseAloud, stopVoicePlayback } from "./voice.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./ai-work-chat.css";

interface AiWorkChatProps {
  userId: string;
  appId: ApplicationId;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  sessions: AiSession[];
  activeSessionId: string | null;
  initialDraft: string;
  newSessionKey: number;
  onSessionsChange: (sessions: AiSession[]) => void;
  onActiveSessionChange: (sessionId: string | null) => void;
  onDraftChange: (draft: string) => void;
  onProviderStatusChange: (status: string) => void;
  onBusyChange: (busy: boolean) => void;
  onOpenSettings: (section?: "ai" | "permissions") => void;
  onNotification: (notification: AiWorkNotificationInput) => void;
}

type MessageUsage = { promptTokens: number | null; completionTokens: number | null; providerId: string; modelId: string };

const aiAccountSnapshots = new Map<string, AiAccount[]>();
const aiMessageSnapshots = new Map<string, AiMessage[]>();

function applicationNameFor(appId: ApplicationId): string {
  return appId === "workspace" ? "通用任务" : appId === "steamcmd" ? "SteamCMD" : appId === "minecraft" ? "Minecraft" : "写作";
}

function aiMessageSnapshotKey(userId: string, appId: ApplicationId, sessionId: string): string {
  return `${userId}:${appId}:${sessionId}`;
}

/** 根据当前滚动位置返回最近经过的用户消息锚点，目录仅映射已有会话消息。 */
function getVisibleConversationAnchorId(container: HTMLElement): string | null {
  const anchorElements = container.querySelectorAll<HTMLElement>("[data-ai-anchor-id]");
  if (!anchorElements.length) return null;

  const threshold = container.getBoundingClientRect().top + Math.min(128, container.clientHeight * 0.28);
  let activeId = anchorElements[0].dataset.aiAnchorId ?? null;
  for (const anchorElement of anchorElements) {
    if (anchorElement.getBoundingClientRect().top > threshold) break;
    activeId = anchorElement.dataset.aiAnchorId ?? activeId;
  }
  return activeId;
}

function conversationAnchorLabel(content: string): string {
  const compactContent = content.replace(/\s+/gu, " ").trim();
  let label = "";
  let characterCount = 0;
  for (const character of compactContent) {
    if (characterCount === 38) return `${label}…`;
    label += character;
    characterCount += 1;
  }
  return label;
}

function getConversationAnchorPositions(container: HTMLElement): Record<string, number> {
  const anchorElements = Array.from(container.querySelectorAll<HTMLElement>("[data-ai-anchor-id]"));
  const contentHeight = Math.max(container.scrollHeight, container.clientHeight);
  const containerTop = container.getBoundingClientRect().top;

  return Object.fromEntries(anchorElements.map((element, index) => {
    const id = element.dataset.aiAnchorId;
    if (!id) return ["", 0];
    const contentTop = element.getBoundingClientRect().top - containerTop + container.scrollTop;
    const position = contentHeight > container.clientHeight
      ? contentTop / contentHeight * 100
      : (index + 1) / (anchorElements.length + 1) * 100;
    return [id, Math.min(98, Math.max(2, position))];
  }).filter(([id]) => id));
}

const suggestions: Record<ApplicationId, string[]> = {
  workspace: ["读取我的项目说明，分析需要修复的问题并运行验证。", "先检查当前可用节点和工具，再规划这项任务。"],
  steamcmd: ["帮我列出一份 SteamCMD 部署专用服务器前的检查清单。", "如何规划游戏服务器端口、备份和更新流程？"],
  minecraft: ["给我一份升级 Minecraft Java 服务端前的兼容性检查清单。", "比较 Paper、Fabric 和原版服务端的适用场景。"],
  writing: ["帮我梳理这个故事的核心设定和待确认问题。", "请分析这段正文的节奏、人物动机与表达问题。", "围绕这个角色，帮我补出清晰的目标、阻碍与变化。"]
};

const permissionModeLabels: Record<UserSettings["permissions"]["mode"], string> = {
  ask: "请求审批",
  approve_remembered: "替我审批",
  full_access: "完全权限"
};

const permissionModeOptions: Array<{
  mode: UserSettings["permissions"]["mode"];
  label: string;
  description: string;
  icon: "shield" | "review";
}> = [
  { mode: "ask", label: "请求审批", description: "写入和高风险操作逐项确认。", icon: "shield" },
  { mode: "approve_remembered", label: "替我审批", description: "精确匹配已记住范围后自动执行。", icon: "review" },
  { mode: "full_access", label: "完全权限", description: "模型自主执行项目操作与任意主机命令，不再逐项审批。", icon: "shield" }
];

function getPermissionModeHint(applicationId: ApplicationId, mode: UserSettings["permissions"]["mode"]): string {
  const appContext = applicationId === "writing"
    ? "AI 可围绕当前作品大纲和章节正文工作，并按你的指令选择写入目标。"
    : "AI 可调用当前应用的项目管理、节点、文件及主机终端能力。";
  if (mode === "full_access") return `${appContext}完全权限已开启，模型可在在线 Daemon 上执行任意命令并指定任意工作目录，不再逐项等待审批。`;
  if (mode === "approve_remembered") return `${appContext}匹配已记住的精确范围时自动执行，其他写入和高风险操作会请求审批。`;
  return `${appContext}写入和高风险操作会先请求你的逐项审批。`;
}

const runtimeSpeedLabels: Record<UserSettings["aiRuntime"]["speed"], string> = {
  fast: "快速",
  balanced: "平衡",
  deep: "深入"
};

function AiWorkChatView({ userId, appId, settings, onSettingsChange, sessions, activeSessionId, initialDraft, newSessionKey, onSessionsChange, onActiveSessionChange, onDraftChange, onProviderStatusChange, onBusyChange, onOpenSettings, onNotification }: AiWorkChatProps) {
  const [permissionModal, permissionModalContext] = Modal.useModal();
  const cachedAccounts = useRef(aiAccountSnapshots.get(userId) ?? null).current;
  const cachedMessages = useRef(activeSessionId ? aiMessageSnapshots.get(aiMessageSnapshotKey(userId, appId, activeSessionId)) ?? null : null).current;
  const [messages, setMessages] = useState<AiMessage[]>(() => cachedMessages ?? []);
  const [draft, setDraft] = useState(initialDraft);
  const [messagesReady, setMessagesReady] = useState(() => !activeSessionId || cachedMessages !== null);
  const [usageByMessage, setUsageByMessage] = useState<Record<string, MessageUsage>>({});
  const [accounts, setAccounts] = useState<AiAccount[]>(() => cachedAccounts ?? []);
  // 区分 Provider 尚未返回、成功但没有活动账户与读取失败，避免把加载中的空数组误报为未配置。
  const [accountLoadState, setAccountLoadState] = useState<"loading" | "ready" | "error">(() => cachedAccounts === null ? "loading" : "ready");
  const [loading, setLoading] = useState(() => Boolean(activeSessionId && cachedMessages === null));
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const stopListening = useRef<(() => void) | null>(null);
  const draftRef = useRef(draft); draftRef.current = draft;
  useEffect(() => () => { stopListening.current?.(); stopVoicePlayback(); }, []);
  useEffect(() => { if (!settings.aiRuntime.voiceInputEnabled) { stopListening.current?.(); stopListening.current = null; setListening(false); } if (!settings.aiRuntime.readResponsesAloud) stopVoicePlayback(); }, [settings.aiRuntime.voiceInputEnabled, settings.aiRuntime.readResponsesAloud]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [toolbarBusy, setToolbarBusy] = useState<"permissions" | "aiRuntime" | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [anchorPositions, setAnchorPositions] = useState<Record<string, number>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const activeRunRef = useRef<string | null>(null);
  const autoFollowAttempt = useRef<string | null>(null);
  const sessionIdForTurn = useRef(activeSessionId);
  const notifiedTurnEvents = useRef(new Set<string>());
  const messagesElementRef = useRef<HTMLDivElement | null>(null);
  const activeScrollConversationRef = useRef(`${appId}:${activeSessionId ?? "new-session"}`);
  // 默认展示会话最新消息；用户主动上翻后暂停跟随，回到底部时再恢复。
  const followLatestMessageRef = useRef(true);
  const messagesScroll = useScrollRestoration(
    createScrollRestorationKey(userId, "ai-messages", appId, activeSessionId ?? "new-session"),
    messagesReady
  );
  const setMessagesElement = useCallback((node: HTMLDivElement | null) => {
    messagesElementRef.current = node;
    messagesScroll.ref(node);
  }, [messagesScroll.ref]);
  const handleMessagesScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    messagesScroll.onScroll(event);
    const element = event.currentTarget;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 64;
    followLatestMessageRef.current = isNearBottom;
    setShowScrollToLatest(!isNearBottom && messages.length > 0);
    const nextAnchorId = getVisibleConversationAnchorId(element);
    setActiveAnchorId((current) => current === nextAnchorId ? current : nextAnchorId);
  }, [messages.length, messagesScroll.onScroll]);
  const scrollToLatest = useCallback((smooth = false) => {
    const element = messagesElementRef.current;
    if (!element) return;
    followLatestMessageRef.current = true;
    stopVoicePlayback();
    const reducedMotion = settings.appearance.advanced.reducedMotion === "on"
      || settings.appearance.advanced.reducedMotion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (smooth && !reducedMotion) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    else element.scrollTop = element.scrollHeight;
    setShowScrollToLatest(false);
  }, [settings.appearance.advanced.reducedMotion]);
  const activeAccount = accounts.find((account) => account.active);

  useLayoutEffect(() => {
    const conversationKey = `${appId}:${activeSessionId ?? "new-session"}`;
    if (activeScrollConversationRef.current !== conversationKey) {
      activeScrollConversationRef.current = conversationKey;
      followLatestMessageRef.current = true;
    }
    const element = messagesElementRef.current;
    if (!element) return;
    const nextAnchorPositions = getConversationAnchorPositions(element);
    setAnchorPositions((current) => {
      const currentEntries = Object.entries(current);
      const nextEntries = Object.entries(nextAnchorPositions);
      return currentEntries.length === nextEntries.length
        && nextEntries.every(([id, position]) => Math.abs((current[id] ?? -100) - position) < 0.5)
        ? current
        : nextAnchorPositions;
    });
    if (followLatestMessageRef.current) {
      element.scrollTop = element.scrollHeight;
      const anchors = element.querySelectorAll<HTMLElement>("[data-ai-anchor-id]");
      setActiveAnchorId(anchors.length ? anchors[anchors.length - 1].dataset.aiAnchorId ?? null : null);
      if (showScrollToLatest) setShowScrollToLatest(false);
      return;
    }
    const isAwayFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight > 64;
    if (isAwayFromBottom !== showScrollToLatest) setShowScrollToLatest(isAwayFromBottom);
    const nextAnchorId = getVisibleConversationAnchorId(element);
    setActiveAnchorId((current) => current === nextAnchorId ? current : nextAnchorId);
  }, [activeSessionId, appId, busy, messages, showScrollToLatest]);

  useEffect(() => {
    let alive = true;
    void loadAiAccounts().then((accountResult) => {
      if (!alive) return;
      aiAccountSnapshots.set(userId, accountResult.accounts);
      setAccounts(accountResult.accounts);
      setAccountLoadState("ready");
      const account = accountResult.accounts.find((item) => item.active);
      onProviderStatusChange(account ? `${account.displayName} · ${account.modelId}` : "未配置模型");
    }).catch((loadError: unknown) => {
      if (alive) {
        if (cachedAccounts === null) setAccountLoadState("error");
        setError(getErrorMessage(loadError));
        onProviderStatusChange("模型状态不可用");
      }
    });
    return () => { alive = false; };
  }, [appId, cachedAccounts, onProviderStatusChange, userId]);

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (!busy) return;
    setElapsedSeconds(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  useEffect(() => {
    setMessages([]);
    setUsageByMessage({});
    setActiveAnchorId(null);
    setError("");
  }, [newSessionKey]);

  useEffect(() => {
    if (busy) {
      setMessagesReady(true);
      return;
    }
    setError("");
    if (!activeSessionId) {
      setMessages([]);
      setActiveAnchorId(null);
      setMessagesReady(true);
      setLoading(false);
      return;
    }
    const cacheKey = aiMessageSnapshotKey(userId, appId, activeSessionId);
    const sessionSnapshot = aiMessageSnapshots.get(cacheKey);
    let alive = true;
    if (sessionSnapshot) {
      setMessages(sessionSnapshot);
      setLoading(false);
      setMessagesReady(true);
    } else {
      setLoading(true);
      setMessagesReady(false);
    }
    void loadAiMessages(activeSessionId).then((result) => {
      if (alive) {
        aiMessageSnapshots.set(cacheKey, result.messages);
        setMessages(result.messages);
        const running = result.messages.find(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued"));
        if (running && autoFollowAttempt.current !== running.id) { autoFollowAttempt.current = running.id; void sendMessage("", running.id); }
      }
    }).catch((loadError: unknown) => {
      if (alive) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (alive) {
        setLoading(false);
        setMessagesReady(true);
      }
    });
    return () => { alive = false; };
  }, [activeSessionId, appId, busy, userId]);

  async function sendMessage(value = draft, followRunId?: string): Promise<void> {
    const content = value.trim();
    if (!content && !followRunId) return;
    if (busy) {
      if (!activeRunRef.current || !content) return;
      try {
        const result = await appendAiRunInput(activeRunRef.current, content);
        setDraft(""); onDraftChange("");
        setMessages(current => { const incoming = result.mode === "queue" ? [result.userMessage, result.run.message] : [result.userMessage]; return [...current.filter(item => !incoming.some(next => next.id === item.id)), ...incoming]; });
      } catch (error) { setError(getErrorMessage(error)); }
      return;
    }
    if (!activeAccount && !followRunId) {
      setError("请先到设置中心的“AI 与模型”添加并启用一个 Provider 账户。");
      return;
    }
    followLatestMessageRef.current = true;
    if (!followRunId) { setDraft(""); onDraftChange(""); }
    setError("");
    setBusy(true);
    sessionIdForTurn.current = activeSessionId;
    notifiedTurnEvents.current.clear();
    const controller = new AbortController();
    controllerRef.current = controller;
    let spokenContent = "";
    let followedExistingCompletion = false;
    try {
      await streamAiChat({
        ...(followRunId ? { runId: followRunId } : {}),
        appId,
        sessionId: activeSessionId,
        content,
        signal: controller.signal,
        onSession: ({ session, userMessage, assistantMessage }) => {
          spokenContent = assistantMessage.content;
          followedExistingCompletion = assistantMessage.status === "complete";
          activeRunRef.current = assistantMessage.id;
          autoFollowAttempt.current = assistantMessage.id;
          sessionIdForTurn.current = session.id;
          onActiveSessionChange(session.id);
          onSessionsChange([session, ...sessions.filter((item) => item.id !== session.id)]);
          setMessages((current) => {
            const incoming = [userMessage, assistantMessage];
            return [...current.map(item => incoming.find(next => next.id === item.id) ?? item), ...incoming.filter(next => !current.some(item => item.id === next.id))];
          });
        },
        onInput: (message) => setMessages(current => [...current.filter(item => item.id !== message.id), message]),
        onActivity: ({ messageId, activity }) => {
          setMessages((current) => current.map((item) => {
            if (item.id !== messageId) return item;
            const nextActivity = item.activity.filter((entry) => entry.id !== activity.id);
            nextActivity.push(activity);
            // 同一条活动后续会多次更新状态，重新按首次开始时间排序以保留真实执行顺序。
            nextActivity.sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt));
            return { ...item, activity: nextActivity };
          }));
          if (activity.status === "approval_required" && settings.general.permissionNotifications) {
            notifySessionAction(`approval:${activity.approvalId ?? activity.id}`, "approval", "需要审批", `${activity.title} 正在等待你的审批。`);
          }
          if (activity.status === "error") notifySessionIssue("AI Work 步骤未能完成，请打开会话查看活动详情。");
        },
        onDelta: ({ messageId, delta }) => { spokenContent += delta; setMessages((current) => current.map((item) => item.id === messageId ? { ...item, content: item.content + delta } : item)); },
        onUsage: ({ messageId, ...usage }) => {
          if (messageId) setUsageByMessage((current) => ({ ...current, [messageId]: usage }));
          else setUsageByMessage((current) => {
            const latestAssistant = [...messages].reverse().find((item) => item.role === "assistant");
            return latestAssistant ? { ...current, [latestAssistant.id]: usage } : current;
          });
        },
        onError: setError,
        onDone: (status) => {
          setMessages((current) => current.map((item) => item.id === activeRunRef.current ? { ...item, status } : item));
          if (status === "error") notifySessionIssue("本轮 AI Work 回复未能完成，请打开会话查看错误详情。");
          if (status === "complete" && sessionIdForTurn.current) {
            if (settings.aiRuntime.readResponsesAloud && spokenContent && !followedExistingCompletion) { try { readResponseAloud(spokenContent, settings.general.language); } catch (error) { setError(getErrorMessage(error)); } }
            notifyAiWorkCompletion({
              notification: {
                appId,
                applicationName: applicationNameFor(appId),
                sessionId: sessionIdForTurn.current,
                kind: "complete",
                title: "回复已完成",
                body: `${applicationNameFor(appId)} 会话已完成回复，点击查看。`
              },
              policy: settings.general.completionNotification,
              sound: settings.general.notificationSound,
              onNotification
            });
          }
        }
      });
      const sessionResult = await loadAiSessions({ appId });
      onSessionsChange(sessionResult.sessions);
    } catch (sendError) {
      if (!(sendError instanceof DOMException && sendError.name === "AbortError")) {
        setError(getErrorMessage(sendError));
        notifySessionIssue("本轮 AI Work 回复发生错误，请打开会话查看详情。");
      }
      // 传输错误只代表订阅中断；服务端任务继续运行，不能在本地伪造已停止状态。
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  }

  function toggleVoiceInput(): void {
    if (listening) { stopListening.current?.(); stopListening.current = null; setListening(false); return; }
    try {
      stopVoicePlayback(); setListening(true);
      stopListening.current = startVoiceInput(settings.general.language, text => { const next = `${draftRef.current}${draftRef.current ? "\n" : ""}${text}`.slice(0, 12000); setDraft(next); onDraftChange(next); }, setError, () => { setListening(false); stopListening.current = null; });
    } catch (error) { setListening(false); setError(getErrorMessage(error)); }
  }

  function notifySessionAction(key: string, kind: "approval" | "issue", title: string, body: string): void {
    const sessionId = sessionIdForTurn.current;
    if (!sessionId || notifiedTurnEvents.current.has(key)) return;
    notifiedTurnEvents.current.add(key);
    notifyAiWorkAction({
      notification: { appId, applicationName: applicationNameFor(appId), sessionId, kind, title, body },
      sound: settings.general.notificationSound,
      onNotification
    });
  }

  function notifySessionIssue(body: string): void {
    if (!settings.general.sessionIssueNotifications) return;
    notifySessionAction("issue:turn", "issue", "会话遇到问题", body);
  }

  async function resolveInlineApproval(approvalId: string, decision: "approved" | "denied"): Promise<void> {
    if (approvalBusyId) return;
    setApprovalBusyId(approvalId);
    setError("");
    try {
      await decideAiApproval(approvalId, decision);
    } catch (approvalError) {
      setError(`审批处理失败：${getErrorMessage(approvalError)}`);
    } finally {
      setApprovalBusyId(null);
    }
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const shouldSend = settings.general.sendShortcut === "enter"
      ? event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey
      : event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (!shouldSend) return;
    event.preventDefault();
    void sendMessage();
  };

  async function saveToolbarSetting<K extends "permissions" | "aiRuntime">(category: K, value: UserSettings[K]): Promise<void> {
    setToolbarBusy(category);
    setError("");
    try {
      const result = await saveSettings(category, value);
      onSettingsChange(result.settings);
    } catch (saveError) {
      setError(`设置保存失败：${getErrorMessage(saveError)}`);
    } finally {
      setToolbarBusy(null);
    }
  }

  function selectPermissionMode(mode: UserSettings["permissions"]["mode"]): void {
    if (mode === settings.permissions.mode || toolbarBusy) return;
    const saveMode = () => saveToolbarSetting("permissions", { mode });
    if (mode === "full_access") {
      permissionModal.confirm({
        rootClassName: "lfaa-permission-mode-confirm",
        getContainer: () => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body,
        icon: <WorkbenchIcon name="shield" size={17} />,
        title: "开启项目完全权限？",
        content: "模型将按你的指令自主执行项目操作，可在在线 Daemon 上执行任意终端命令并访问其 OS 账户有权访问的路径；文件、部署和配置操作也不再逐项审批。",
        okText: "开启完全权限",
        cancelText: "取消",
        centered: true,
        width: 400,
        onOk: saveMode
      });
      return;
    }
    void saveMode();
  }

  async function selectModel(modelId: string): Promise<void> {
    if (!activeAccount || activeAccount.modelId === modelId || modelBusy || busy) return;
    setModelBusy(true);
    setError("");
    try {
      const result = await updateAiAccountModel(activeAccount.id, modelId);
      setAccounts((current) => current.map((account) => account.id === result.account.id ? result.account : account));
      onProviderStatusChange(`${result.account.displayName} · ${result.account.modelId}`);
    } catch (modelError) {
      setError(`模型切换失败：${getErrorMessage(modelError)}`);
    } finally {
      setModelBusy(false);
    }
  }

  function selectRuntimeSpeed(speed: UserSettings["aiRuntime"]["speed"]): void {
    if (speed === settings.aiRuntime.speed || toolbarBusy) return;
    void saveToolbarSetting("aiRuntime", { ...settings.aiRuntime, speed });
  }

  function jumpToConversationAnchor(messageId: string): void {
    const container = messagesElementRef.current;
    if (!container) return;
    const anchorElement = Array.from(container.querySelectorAll<HTMLElement>("[data-ai-anchor-id]")).find((element) => element.dataset.aiAnchorId === messageId);
    if (!anchorElement) return;

    const targetTop = anchorElement.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
    const reducedMotion = settings.appearance.advanced.reducedMotion === "on"
      || settings.appearance.advanced.reducedMotion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) container.scrollTop = Math.max(0, targetTop);
    else container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    setActiveAnchorId(messageId);
  }

  const conversationAnchors = messages.filter((message) => message.role === "user");

  return (
    <section className={`ai-work-chat ai-work-chat--${appId}`} aria-label="AI Work 会话">
      {permissionModalContext}
      <div className="ai-work-chat__conversation">
        <div className="ai-work-chat__alerts">
          {accountLoadState === "ready" && !activeAccount ? <Alert type="warning" showIcon message="尚未配置活动 Provider" description="先在 AI 与模型中添加并启用一个 Provider 账户。" action={<Button size="small" onClick={() => onOpenSettings("ai")}>打开 AI 与模型</Button>} /> : null}
          {error ? <Alert type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}
          {!busy && messages.some(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued")) ? <Button onClick={() => { const run = messages.find(item => item.role === "assistant" && (item.status === "streaming" || item.status === "queued")); if (run) void sendMessage("", run.id); }}>恢复任务跟随</Button> : null}
        </div>
        <div className="ai-work-chat__message-stage">
          {conversationAnchors.length ? <nav className="ai-work-chat__anchors" aria-label="本会话对话锚点">
            <div className="ai-work-chat__anchor-list">
              {conversationAnchors.map((message, index) => {
                const label = conversationAnchorLabel(message.content) || "（无内容）";
                const isActive = message.id === activeAnchorId;
                return <button
                  type="button"
                  className={`ai-work-chat__anchor${isActive ? " is-active" : ""}`}
                  key={message.id}
                  style={{ top: `${anchorPositions[message.id] ?? ((index + 1) / (conversationAnchors.length + 1) * 100)}%` }}
                  aria-current={isActive ? "location" : undefined}
                  aria-label={`跳转到第 ${index + 1} 条提问：${label}`}
                  onClick={() => jumpToConversationAnchor(message.id)}
                >
                  <span className="ai-work-chat__anchor-mark" aria-hidden="true" />
                  <span className="ai-work-chat__anchor-preview" aria-hidden="true"><strong>{label}</strong><span>{message.content.trim() || "（无内容）"}</span></span>
                </button>;
              })}
            </div>
          </nav> : null}
          <div ref={setMessagesElement} onScroll={handleMessagesScroll} className="ai-work-chat__messages" aria-live="polite">
            <div className="ai-work-chat__message-list">
              {loading ? <Spin /> : messages.length ? messages.map((item) => {
            const usage = usageByMessage[item.id];
            const runningActivity = [...item.activity].reverse().find((activity) => activity.status === "running" || activity.status === "approval_required");
            const activityTimes = item.activity.flatMap((activity) => [Date.parse(activity.startedAt), activity.completedAt ? Date.parse(activity.completedAt) : 0]).filter((value) => Number.isFinite(value) && value > 0);
            const activitySeconds = item.status === "streaming" ? elapsedSeconds : activityTimes.length ? Math.round((Math.max(...activityTimes) - Math.min(...activityTimes)) / 1000) : 0;
            return <article className={`ai-work-chat__message ai-work-chat__message--${item.role}`} key={item.id} data-ai-anchor-id={item.role === "user" ? item.id : undefined}>
              {item.status === "queued" || item.status === "streaming" || item.status === "error" || item.status === "interrupted" ? <div className="ai-work-chat__message-meta">{item.status === "queued" ? <Tag>排队中</Tag> : item.status === "streaming" ? <Tag color="processing">正在回复</Tag> : item.status === "error" ? <Tag color="error">失败</Tag> : <Tag>已停止</Tag>}</div> : null}
              <div className={`ai-work-chat__message-content${item.status === "streaming" ? " ai-work-chat__message-content--streaming" : ""}`}>
                {item.role === "assistant" ? item.content ? <AiMarkdown content={item.content} /> : item.status === "streaming" ? <span className="ai-work-chat__thinking" role="status" aria-label="AI 正在思考"><i /><i /><i /></span> : "" : item.content}
                {item.role === "assistant" && item.content && item.status === "streaming" ? <span className="ai-work-chat__stream-caret" aria-hidden="true" /> : null}
              </div>
              {item.role === "assistant" && item.activity.length ? <details className="ai-work-chat__activity">
                <summary>
                  <span className="ai-work-chat__activity-summary-main"><WorkbenchIcon name="terminal" size={14} />已处理 {activitySeconds} 秒</span>
                  <span className="ai-work-chat__activity-summary-state">{runningActivity?.title ?? `${item.activity.filter((activity) => activity.status !== "unavailable").length} 项活动`}</span>
                </summary>
                <div className="ai-work-chat__activity-list">
                  {item.activity.map((activity) => <div className={`ai-work-chat__activity-row ai-work-chat__activity-row--${activity.status}`} key={activity.id}>
                    <WorkbenchIcon name={activity.status === "running" ? "spark" : activity.status === "approval_required" ? "shield" : activity.status === "error" ? "close" : activity.status === "unavailable" ? "help" : "review"} size={14} />
                    <div className="ai-work-chat__activity-copy"><strong>{activity.title}</strong><span>{activity.detail}</span>
                      {activity.status === "approval_required" && activity.approvalId ? <div className="ai-work-chat__approval-actions">
                        <Button size="small" type="primary" loading={approvalBusyId === activity.approvalId} disabled={approvalBusyId !== null} onClick={() => void resolveInlineApproval(activity.approvalId!, "approved")}>批准本次操作</Button>
                        <Button size="small" danger disabled={approvalBusyId !== null} onClick={() => void resolveInlineApproval(activity.approvalId!, "denied")}>拒绝</Button>
                      </div> : null}
                    </div>
                  </div>)}
                </div>
              </details> : null}
              {item.role === "assistant" && settings.aiRuntime.showContextUsage && usage ? <small className="ai-work-chat__usage">{`${usage.promptTokens ?? "?"} 输入 · ${usage.completionTokens ?? "?"} 输出 tokens · ${usage.providerId} / ${usage.modelId}`}</small> : null}
            </article>;
            }) : <div className={`ai-work-chat__welcome${appId === "writing" ? " ai-work-chat__welcome--writing" : ""}`}>
            {appId === "writing" ? <>
              <span className="ai-work-chat__welcome-mark" aria-hidden="true"><WorkbenchIcon name="spark" size={22} /></span>
              <div className="ai-work-chat__welcome-copy"><h1>从一个创作目标开始</h1><p>梳理故事设定、人物动机与章节节奏，也可以直接贴一段文字来讨论。</p></div>
              </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>{appId === "workspace" ? "告诉 LFAA 你的任务目标" : `开始与 ${appId === "steamcmd" ? "SteamCMD 开服顾问" : "Minecraft 开服顾问"} 对话`}</span>} />}
            {settings.aiRuntime.promptSuggestions ? <div className={`ai-work-chat__suggestions${appId === "writing" ? " ai-work-chat__suggestions--writing" : ""}`}>{suggestions[appId].map((suggestion) => <button type="button" key={suggestion} disabled={!activeAccount || busy} onClick={() => void sendMessage(suggestion)}>{suggestion}</button>)}</div> : null}
            <Typography.Text type="secondary">{getPermissionModeHint(appId, settings.permissions.mode)}</Typography.Text>
              </div>}
            </div>
          </div>
          {showScrollToLatest ? <Button className="ai-work-chat__scroll-latest" type="default" onClick={() => scrollToLatest(true)} aria-label="回到底部查看最新回复"><WorkbenchIcon name="chevron" size={16} /><span>{busy ? "有新内容 · 回到底部" : "回到底部"}</span></Button> : null}
        </div>
        <form className="ai-work-chat__composer" aria-label="AI Work 消息输入" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <div className="ai-work-chat__composer-context" aria-label="当前对话上下文">
              <span className="ai-work-chat__composer-app"><WorkbenchIcon name="folder" size={13} />{applicationNameFor(appId)}</span>
            <Typography.Text className="ai-work-chat__composer-count" aria-label={`已输入 ${draft.length}，最多 12000 个字符`}>{draft.length}<span>/12000</span></Typography.Text>
          </div>
          <Input.TextArea
            aria-label="输入 AI Work 消息"
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              onDraftChange(value);
            }}
            onKeyDown={handleComposerKeyDown}
            placeholder={busy ? settings.general.followupBehavior === "queue" ? "发送跟进，当前任务完成后继续处理…" : "发送约束，引导当前任务的下一步…" : activeAccount ? "向 LFAA AI 提问…" : accountLoadState === "loading" ? "正在读取活动 Provider…" : accountLoadState === "error" ? "活动 Provider 状态不可用，请查看错误提示" : "请先在“AI 与模型”配置活动 Provider"}
            autoSize={{ minRows: 2, maxRows: 7 }}
            maxLength={12000}
            disabled={!activeAccount && !busy}
          />
          <div className="ai-work-chat__composer-actions">
            <div className="ai-work-chat__composer-actions-group" aria-label="添加与权限">
              <Dropdown
                trigger={["click"]}
                placement="topLeft"
                menu={{ items: [{ key: "attachment-unavailable", label: "文件和文件夹 · 暂未接入", disabled: true }] }}
              >
                <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label="添加附件；当前未接入" title="文件和文件夹附件尚未接入 AI Work 会话" icon={<WorkbenchIcon name="plus" size={18} />} />
              </Dropdown>
              <Dropdown
                trigger={["click"]}
                placement="topLeft"
                overlayClassName="ai-work-chat__permission-overlay"
                getPopupContainer={(trigger) => trigger.closest<HTMLElement>(".workbench-shell") ?? trigger.parentElement ?? document.body}
                popupRender={(menu) => (
                  <div className="ai-work-chat__permission-popover">
                    <div className="ai-work-chat__permission-popover-header">
                      <strong>项目权限模式</strong>
                      <Button className="ai-work-chat__permission-help" type="link" onClick={() => onOpenSettings("permissions")}>权限说明</Button>
                    </div>
                    {menu}
                  </div>
                )}
                menu={{
                  items: [
                    ...permissionModeOptions.map((option) => ({
                      key: option.mode,
                      label: (
                        <span className={`ai-work-chat__permission-option ai-work-chat__permission-option--${option.mode}`}>
                          <span className="ai-work-chat__permission-option-icon"><WorkbenchIcon name={option.icon} size={16} /></span>
                          <span className="ai-work-chat__permission-option-copy">
                            <span className="ai-work-chat__permission-option-title">{option.label}</span>
                            <span className="ai-work-chat__permission-option-description">{option.description}</span>
                          </span>
                          {settings.permissions.mode === option.mode && <span className="ai-work-chat__permission-option-selected" aria-label="当前选择">✓</span>}
                        </span>
                      )
                    }))
                  ],
                  className: "ai-work-chat__permission-menu",
                  selectedKeys: [settings.permissions.mode],
                  onClick: ({ key }) => selectPermissionMode(key as UserSettings["permissions"]["mode"])
                }}
              >
                <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--permission" type="text" aria-label={`LFAA 权限模式：${permissionModeLabels[settings.permissions.mode]}`} title="切换 LFAA 项目权限模式" disabled={toolbarBusy === "permissions"}>
                  <WorkbenchIcon name="shield" size={15} />
                  <span className="ai-work-chat__composer-control-label">{permissionModeLabels[settings.permissions.mode]}</span>
                  <WorkbenchIcon name="chevron" size={12} />
                </Button>
              </Dropdown>
            </div>
            <div className="ai-work-chat__composer-actions-group ai-work-chat__composer-actions-group--right" aria-label="模型、推理与发送">
              <Dropdown
                trigger={["click"]}
                placement="topRight"
                disabled={!activeAccount || !activeAccount.models.length || modelBusy || busy}
                menu={{
                  items: activeAccount?.models.map((model) => ({ key: model.id, label: model.name === model.id ? model.id : `${model.name} · ${model.id}` })) ?? [],
                  selectedKeys: activeAccount ? [activeAccount.modelId] : [],
                  onClick: ({ key }) => void selectModel(key)
                }}
              >
                <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--model" type="text" aria-label={`模型：${activeAccount?.modelId ?? "未配置"}`} title={activeAccount ? `${activeAccount.displayName} · ${activeAccount.modelId}` : "请先在设置中心配置活动模型"} disabled={!activeAccount || !activeAccount.models.length || modelBusy || busy}>
                  <WorkbenchIcon name="spark" size={14} />
                  <span className="ai-work-chat__composer-control-label">{modelBusy ? "切换中…" : activeAccount?.modelId ?? "模型未配置"}</span>
                  <WorkbenchIcon name="chevron" size={12} />
                </Button>
              </Dropdown>
              <Dropdown
                trigger={["click"]}
                placement="topRight"
                disabled={toolbarBusy === "aiRuntime" || busy}
                menu={{
                  items: [
                    { key: "fast", label: "快速 · 短输出" },
                    { key: "balanced", label: "平衡" },
                    { key: "deep", label: "深入 · 长输出" }
                  ],
                  selectedKeys: [settings.aiRuntime.speed],
                  onClick: ({ key }) => selectRuntimeSpeed(key as UserSettings["aiRuntime"]["speed"])
                }}
              >
                <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--speed" type="text" aria-label={`推理档位：${runtimeSpeedLabels[settings.aiRuntime.speed]}`} title="推理档位；选择后立即保存" disabled={toolbarBusy === "aiRuntime" || busy}>
                  <span className="ai-work-chat__composer-control-label">{runtimeSpeedLabels[settings.aiRuntime.speed]}</span>
                  <WorkbenchIcon name="chevron" size={12} />
                </Button>
              </Dropdown>
              <Tooltip title={!settings.aiRuntime.voiceInputEnabled ? "请在设置中心的语音页面开启语音输入" : !supportsVoiceInput() ? "当前宿主不支持语音识别" : listening ? "停止语音输入" : "语音输入，识别后由你发送"}>
                <span className="ai-work-chat__composer-disabled-wrap">
                  <Button className="ai-work-chat__composer-control ai-work-chat__composer-control--icon" type="text" aria-label={listening ? "停止语音输入" : "语音输入"} aria-pressed={listening} disabled={!settings.aiRuntime.voiceInputEnabled || !supportsVoiceInput()} onClick={toggleVoiceInput} icon={<WorkbenchIcon name="microphone" size={17} />} />
                </span>
              </Tooltip>
            {busy && draft.trim() ? <Button htmlType="submit" disabled={!activeRunRef.current}>{settings.general.followupBehavior === "queue" ? "发送跟进" : "引导任务"}</Button> : null}
            {settings.aiRuntime.readResponsesAloud ? <Button type="text" onClick={stopVoicePlayback}>停止播报</Button> : null}
            {busy
                ? <Button className="ai-work-chat__composer-submit" danger shape="circle" aria-label="停止生成" title="停止生成" icon={<WorkbenchIcon name="close" size={15} />} onClick={() => { const runId = activeRunRef.current; if (runId) void cancelAiRun(runId).catch(error => setError(getErrorMessage(error))); }} />
                : <Button className="ai-work-chat__composer-submit" type="primary" shape="circle" htmlType="submit" aria-label="发送消息" title={settings.general.sendShortcut === "enter" ? "发送消息 · Enter" : "发送消息 · Ctrl+Enter"} icon={<WorkbenchIcon name="spark" size={15} />} disabled={!draft.trim() || !activeAccount} />}
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

export const AiWorkChat = memo(AiWorkChatView);
