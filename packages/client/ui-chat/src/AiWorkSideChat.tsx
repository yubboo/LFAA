/**
 * 文件：AiWorkSideChat.tsx
 * 功能：在 AI Work 右侧栏提供独立的上下文问答。
 * 作用：从当前会话已记录事件创建只读解释分支，并维护独立消息、草稿和流订阅，不控制主聊天任务。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-chat/src/AiMarkdown.tsx。
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Empty, Input, Spin } from "antd";
import { ApiError, getErrorMessage, loadAiMessages, openAiSideChatSession, streamAiSideChat, type AiMessage, type AiSession, type ApplicationId } from "lfaa-client-connection/src/api.js";
import { AiMarkdown } from "./AiMarkdown.js";
import "./ai-work-chat.css";

interface AiWorkSideChatProps {
  appId: ApplicationId;
  sourceSessionId: string | null;
  sourceSessionTitle: string | null;
  open: boolean;
  initialQuestion: string;
  initialQuestionRevision: number;
  onClose: () => void;
  onSessionCreated: (session: AiSession) => void;
}

function appendMessage(messages: AiMessage[], message: AiMessage): AiMessage[] {
  return [...messages.filter((item) => item.id !== message.id), message];
}

export function AiWorkSideChat({ appId, sourceSessionId, sourceSessionTitle, open, initialQuestion, initialQuestionRevision, onClose, onSessionCreated }: AiWorkSideChatProps) {
  const [sideSession, setSideSession] = useState<AiSession | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const sessionsBySource = useRef(new Map<string, AiSession>());
  const creationBySource = useRef(new Map<string, Promise<AiSession>>());
  const streamController = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !sourceSessionId) return;
    let alive = true;
    setLoading(true);
    setError("");
    setSideSession(sessionsBySource.current.get(sourceSessionId) ?? null);
    const existing = sessionsBySource.current.get(sourceSessionId);
    const pending = existing ? Promise.resolve(existing) : creationBySource.current.get(sourceSessionId) ?? (() => {
      const request = openAiSideChatSession(sourceSessionId).then(({ session }) => {
        sessionsBySource.current.set(sourceSessionId, session);
        return session;
      }).finally(() => creationBySource.current.delete(sourceSessionId));
      creationBySource.current.set(sourceSessionId, request);
      return request;
    })();
    void pending.then(async (session) => {
      if (!alive) return;
      setSideSession(session);
      onSessionCreated(session);
      const result = await loadAiMessages(session.id);
      if (alive) setMessages(result.messages);
    }).catch((loadError: unknown) => {
      if (alive) setError(getErrorMessage(loadError));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [open, sourceSessionId, onSessionCreated]);

  useEffect(() => {
    if (open && initialQuestionRevision > 0) setDraft(initialQuestion);
  }, [initialQuestionRevision, initialQuestion, open]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages]);

  useEffect(() => () => streamController.current?.abort(), []);

  async function sendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !sideSession || loading || sending) return;
    setDraft("");
    setError("");
    setSending(true);
    const controller = new AbortController();
    streamController.current = controller;
    try {
      await streamAiSideChat({
        appId,
        sessionId: sideSession.id,
        content,
        signal: controller.signal,
        onSession: ({ session, userMessage, assistantMessage }) => {
          sessionsBySource.current.set(sourceSessionId!, session);
          setSideSession(session);
          onSessionCreated(session);
          setMessages((current) => appendMessage(appendMessage(current, userMessage), assistantMessage));
        },
        onActivity: () => undefined,
        onDelta: ({ messageId, delta }) => setMessages((current) => current.map((message) => message.id === messageId ? { ...message, content: message.content + delta } : message)),
        onUsage: () => undefined,
        onError: setError,
        onDone: () => setSending(false)
      });
    } catch (sendError) {
      if (!controller.signal.aborted) setError(sendError instanceof ApiError ? sendError.message : getErrorMessage(sendError));
    } finally {
      if (streamController.current === controller) streamController.current = null;
      if (!controller.signal.aborted) setSending(false);
    }
  }

  return <section className="ai-work-side-chat" aria-label="侧边聊天">
    <header className="ai-work-side-chat__heading">
      <div><strong>侧边聊天</strong><small title={sourceSessionTitle ?? undefined}>{sourceSessionTitle ? `关于：${sourceSessionTitle}` : "当前聊天"}</small></div>
      <Button type="text" aria-label="返回工具与资源" title="返回工具与资源" onClick={onClose}>返回</Button>
    </header>
    <p className="ai-work-side-chat__context-note">侧聊使用打开时已记录的上下文快照。主聊天任务会继续运行；正在生成的内容和实时进度不会同步，侧聊也不会执行工具。</p>
    {!sourceSessionId ? <Empty className="ai-work-side-chat__empty" description="先在主聊天发送一条消息，再开启侧边聊天。" /> : <>
      {error ? <Alert className="ai-work-side-chat__error" type="error" showIcon message={error} /> : null}
      <div className="ai-work-side-chat__messages" ref={transcriptRef} role="log" aria-live="polite" aria-relevant="additions text">
        {loading && messages.length === 0 ? <div className="ai-work-side-chat__loading"><Spin size="small" /><span>正在读取当前聊天上下文…</span></div> : null}
        {messages.map((message) => <article key={message.id} className={`ai-work-side-chat__message ai-work-side-chat__message--${message.role}`}>
          {message.role === "user" ? <p>{message.content}</p> : <div className="ai-work-chat__markdown"><AiMarkdown content={message.content || (message.status === "streaming" ? "正在思考…" : "")} /></div>}
          {message.role === "assistant" && (message.status === "interrupted" || message.status === "error") ? <small>本条侧聊未能完成</small> : null}
        </article>)}
      </div>
      <form className="ai-work-side-chat__composer" onSubmit={(event) => void sendMessage(event)}>
        <Input.TextArea aria-label="侧边聊天提问" placeholder="针对当前聊天提问…" value={draft} onChange={(event) => setDraft(event.target.value)} autoSize={{ minRows: 2, maxRows: 7 }} disabled={!sideSession || loading || sending} />
        <div><small>独立于主任务</small><Button type="primary" htmlType="submit" disabled={!draft.trim() || !sideSession || loading || sending} loading={sending}>发送</Button></div>
      </form>
    </>}
  </section>;
}
