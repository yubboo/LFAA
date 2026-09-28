/**
 * 文件：AiWorkChat.tsx
 * 功能：提供 SteamCMD、Minecraft 和写作工作区的 AI Work 流式聊天。
 * 作用：调用控制端会话 API，显示持久化历史、Provider 输出、真实用量状态和消息输入区；把符合用户策略的完成事件交给工作区通知卡片。
 * 不负责：主机操作、文件读写、插件安装或工具审批。
 * 关联文件：frontend/src/api.ts、frontend/src/components/ApplicationWorkspace.tsx、frontend/src/shared/scroll-restoration.ts。
 * 修改注意事项：未注册的业务工具不能在界面上伪装成可执行操作。
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Alert, Button, Empty, Input, Spin, Tag, Typography } from "antd";
import { getErrorMessage, loadAiAccounts, loadAiMessages, loadAiSessions, streamAiChat, type AiAccount, type AiMessage, type AiSession, type ApplicationId, type UserSettings } from "../api.js";
import { notifyAiWorkCompletion } from "../shared/notification-runtime.js";
import { createScrollRestorationKey, useScrollRestoration } from "../shared/scroll-restoration.js";
import { WorkbenchIcon } from "./workbench/shared/WorkbenchIcon.js";
import "./ai-work-chat.css";

interface AiWorkChatProps {
  userId: string;
  appId: ApplicationId;
  settings: UserSettings;
  sessions: AiSession[];
  activeSessionId: string | null;
  initialDraft: string;
  newSessionKey: number;
  onSessionsChange: (sessions: AiSession[]) => void;
  onActiveSessionChange: (sessionId: string | null) => void;
  onDraftChange: (draft: string) => void;
  onProviderStatusChange: (status: string) => void;
  onBusyChange: (busy: boolean) => void;
  onOpenSettings: () => void;
  onNotification: (applicationName: string) => void;
}

type MessageUsage = { promptTokens: number | null; completionTokens: number | null; providerId: string; modelId: string };

const suggestions: Record<ApplicationId, string[]> = {
  steamcmd: ["帮我列出一份 SteamCMD 部署专用服务器前的检查清单。", "如何规划游戏服务器端口、备份和更新流程？"],
  minecraft: ["给我一份升级 Minecraft Java 服务端前的兼容性检查清单。", "比较 Paper、Fabric 和原版服务端的适用场景。"],
  writing: ["帮我构思一个故事设定，并指出还需要确定的关键信息。", "请分析这段文字的节奏、人物动机和表达问题。"]
};

export function AiWorkChat({ userId, appId, settings, sessions, activeSessionId, initialDraft, newSessionKey, onSessionsChange, onActiveSessionChange, onDraftChange, onProviderStatusChange, onBusyChange, onOpenSettings, onNotification }: AiWorkChatProps) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [messagesReady, setMessagesReady] = useState(false);
  const [usageByMessage, setUsageByMessage] = useState<Record<string, MessageUsage>>({});
  const [accounts, setAccounts] = useState<AiAccount[]>([]);
  // 区分 Provider 尚未返回、成功但没有活动账户与读取失败，避免把加载中的空数组误报为未配置。
  const [accountLoadState, setAccountLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const messagesScroll = useScrollRestoration(
    createScrollRestorationKey(userId, "ai-messages", appId, activeSessionId ?? "new-session"),
    messagesReady
  );
  const activeAccount = accounts.find((account) => account.active);

  useEffect(() => {
    let alive = true;
    setAccountLoadState("loading");
    setLoading(true);
    void loadAiAccounts().then((accountResult) => {
      if (!alive) return;
      setAccounts(accountResult.accounts);
      setAccountLoadState("ready");
      setMessages([]);
      setUsageByMessage({});
      const account = accountResult.accounts.find((item) => item.active);
      onProviderStatusChange(account ? `${account.displayName} · ${account.modelId}` : "未配置模型");
    }).catch((loadError: unknown) => {
      if (alive) {
        setAccountLoadState("error");
        setError(getErrorMessage(loadError));
        onProviderStatusChange("模型状态不可用");
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [appId, onProviderStatusChange]);

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  useEffect(() => {
    setMessages([]);
    setUsageByMessage({});
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
      setMessagesReady(true);
      return;
    }
    let alive = true;
    setLoading(true);
    setMessagesReady(false);
    void loadAiMessages(activeSessionId).then((result) => {
      if (alive) setMessages(result.messages);
    }).catch((loadError: unknown) => {
      if (alive) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (alive) {
        setLoading(false);
        setMessagesReady(true);
      }
    });
    return () => { alive = false; };
  }, [activeSessionId, busy]);

  async function sendMessage(value = draft): Promise<void> {
    const content = value.trim();
    if (!content || busy) return;
    if (!activeAccount) {
      setError("请先到设置中心的“AI 与模型”添加并启用一个 Provider 账户。");
      return;
    }
    setDraft("");
    onDraftChange("");
    setError("");
    setBusy(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await streamAiChat({
        appId,
        sessionId: activeSessionId,
        content,
        signal: controller.signal,
        onSession: ({ session, userMessage, assistantMessage }) => {
          onActiveSessionChange(session.id);
          onSessionsChange([session, ...sessions.filter((item) => item.id !== session.id)]);
          setMessages((current) => [...current, userMessage, assistantMessage]);
        },
        onDelta: ({ messageId, delta }) => setMessages((current) => current.map((item) => item.id === messageId ? { ...item, content: item.content + delta } : item)),
        onUsage: ({ messageId, ...usage }) => {
          if (messageId) setUsageByMessage((current) => ({ ...current, [messageId]: usage }));
          else setUsageByMessage((current) => {
            const latestAssistant = [...messages].reverse().find((item) => item.role === "assistant");
            return latestAssistant ? { ...current, [latestAssistant.id]: usage } : current;
          });
        },
        onError: setError,
        onDone: (status) => {
          setMessages((current) => current.map((item) => item.status === "streaming" ? { ...item, status } : item));
          if (status === "complete") {
            const applicationName = appId === "steamcmd" ? "SteamCMD" : appId === "minecraft" ? "Minecraft" : "写作";
            const shouldNotify = notifyAiWorkCompletion({
              applicationName,
              policy: settings.general.completionNotification,
              sound: settings.general.notificationSound
            });
            if (shouldNotify) onNotification(applicationName);
          }
        }
      });
      const sessionResult = await loadAiSessions({ appId });
      onSessionsChange(sessionResult.sessions);
    } catch (sendError) {
      if (!(sendError instanceof DOMException && sendError.name === "AbortError")) setError(getErrorMessage(sendError));
      setMessages((current) => current.map((item) => item.status === "streaming" ? { ...item, status: "interrupted" } : item));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
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

  return (
    <section className="ai-work-chat" aria-label="AI Work 会话">
      <div className="ai-work-chat__conversation">
        {accountLoadState === "ready" && !activeAccount ? <Alert type="warning" showIcon message="尚未配置活动 Provider" description="先在 AI 与模型中添加 API 账户并设为当前使用。" action={<Button size="small" onClick={onOpenSettings}>打开 AI 与模型</Button>} /> : null}
        {error ? <Alert type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}
        <div ref={messagesScroll.ref} onScroll={messagesScroll.onScroll} className="ai-work-chat__messages" aria-live="polite">
          {loading ? <Spin /> : messages.length ? messages.map((item) => {
            const usage = usageByMessage[item.id];
            return <article className={`ai-work-chat__message ai-work-chat__message--${item.role}`} key={item.id}>
              <div className="ai-work-chat__message-meta"><strong>{item.role === "user" ? "你" : "LFAA AI"}</strong>{item.status === "streaming" ? <Tag color="processing">生成中</Tag> : item.status === "error" ? <Tag color="error">失败</Tag> : item.status === "interrupted" ? <Tag>已停止</Tag> : null}</div>
              <div className="ai-work-chat__message-content">{item.content || (item.status === "streaming" ? <Spin size="small" /> : "")}</div>
              {item.role === "assistant" && settings.aiRuntime.showContextUsage ? <small className="ai-work-chat__usage">{usage ? `${usage.promptTokens ?? "?"} 输入 · ${usage.completionTokens ?? "?"} 输出 tokens · ${usage.providerId} / ${usage.modelId}` : item.status === "complete" ? "Provider 未提供 token 用量" : null}</small> : null}
            </article>;
          }) : <div className="ai-work-chat__welcome"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>开始与 {appId === "steamcmd" ? "SteamCMD 开服顾问" : appId === "minecraft" ? "Minecraft 开服顾问" : "AI 写作顾问"} 对话</span>} />
            {settings.aiRuntime.promptSuggestions ? <div className="ai-work-chat__suggestions">{suggestions[appId].map((suggestion) => <button type="button" key={suggestion} disabled={!activeAccount || busy} onClick={() => void sendMessage(suggestion)}>{suggestion}</button>)}</div> : null}
            <Typography.Text type="secondary">当前连接模型对话与会话记录；主机操作、游戏安装和本地文件读写尚未接入。</Typography.Text>
          </div>}
        </div>
        <form className="ai-work-chat__composer" aria-label="AI Work 消息输入" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <div className="ai-work-chat__composer-context" aria-label="当前对话上下文">
            <span className="ai-work-chat__composer-app"><WorkbenchIcon name="folder" size={13} />{appId === "steamcmd" ? "SteamCMD" : appId === "minecraft" ? "Minecraft" : "写作"}</span>
            <span className="ai-work-chat__composer-model" title={activeAccount ? `${activeAccount.displayName} · ${activeAccount.modelId}` : accountLoadState === "loading" ? "正在读取活动模型" : accountLoadState === "error" ? "活动模型状态不可用" : "请先配置活动模型"}>
              <WorkbenchIcon name="spark" size={13} />{activeAccount ? `${activeAccount.displayName} · ${activeAccount.modelId}` : accountLoadState === "loading" ? "正在读取模型…" : accountLoadState === "error" ? "模型状态不可用" : "模型未配置"}
            </span>
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
            placeholder={activeAccount ? "向 LFAA AI 提问…" : accountLoadState === "loading" ? "正在读取活动 Provider…" : accountLoadState === "error" ? "活动 Provider 状态不可用，请查看错误提示" : "请先在“AI 与模型”配置活动 Provider"}
            autoSize={{ minRows: 2, maxRows: 7 }}
            maxLength={12000}
            disabled={!activeAccount && !busy}
          />
          <div className="ai-work-chat__composer-actions">
            <Typography.Text type="secondary" className="ai-work-chat__composer-shortcut">
              {settings.general.sendShortcut === "enter" ? "Enter 发送 · Shift+Enter 换行" : "Enter 换行 · Ctrl+Enter 发送"}
            </Typography.Text>
            {busy
              ? <Button className="ai-work-chat__composer-submit" danger shape="circle" aria-label="停止生成" title="停止生成" icon={<WorkbenchIcon name="close" size={15} />} onClick={() => controllerRef.current?.abort()} />
              : <Button className="ai-work-chat__composer-submit" type="primary" shape="circle" htmlType="submit" aria-label="发送消息" title="发送消息" icon={<WorkbenchIcon name="spark" size={15} />} disabled={!draft.trim() || !activeAccount} />}
          </div>
        </form>
      </div>
    </section>
  );
}
