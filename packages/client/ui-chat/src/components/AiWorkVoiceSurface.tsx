/**
 * 文件：components/AiWorkVoiceSurface.tsx
 * 功能：呈现 AI Work 的专用语音会话界面。
 * 作用：消费聊天层传入的语音/Run/设置快照并派发回调，不单独管理运行状态。
 * 不负责：麦克风会话、模型请求、语音开关持久化或 Session 生命周期。
 * 关联文件：AiWorkChat.tsx、../voice.ts、../VoiceOrb3D.tsx、../ai-work-chat.css。
 */
import { Alert, Button, Input, Tooltip } from "antd";
import type { AiAccount, UserSettings } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { VoiceOrb3D } from "../VoiceOrb3D.js";
import voiceParticleCore from "../assets/voice-particle-core.png";
import { supportsVoiceInput, supportsVoiceOutput } from "../voice.js";

export interface AiWorkVoiceSurfaceProps {
  busy: boolean;
  voiceSpeaking: boolean;
  listening: boolean;
  voiceSessionActive: boolean;
  voiceSpeechActivity: number;
  draft: string;
  settings: UserSettings;
  error: string;
  activeAccount: AiAccount | undefined;
  onExitVoice: () => void;
  onEndVoiceSession: () => void;
  onOpenSettings: (section: "ai") => void;
  onClearError: () => void;
  onToggleVoiceConversation: () => void;
  onDraftChange: (value: string) => void;
  onSendMessage: (value: string) => void;
  onSettingsChange: (settings: UserSettings) => void;
}

export function AiWorkVoiceSurface({
  busy,
  voiceSpeaking,
  listening,
  voiceSessionActive,
  voiceSpeechActivity,
  draft,
  settings,
  error,
  activeAccount,
  onExitVoice,
  onEndVoiceSession,
  onOpenSettings,
  onClearError,
  onToggleVoiceConversation,
  onDraftChange,
  onSendMessage,
  onSettingsChange
}: AiWorkVoiceSurfaceProps) {
  const voiceStatus = voiceSpeaking ? "正在播报" : busy ? "AI 正在思考" : listening ? "正在聆听" : voiceSessionActive ? "语音对话已连接" : draft.trim() ? "语音已识别" : "准备就绪";
  const voiceStatusDetail = voiceSpeaking
    ? "回复播报结束后会自动恢复聆听。"
    : busy
      ? "正在当前 AI Work 会话中生成回复。"
      : listening
        ? "请开始说话；识别完成后会自动发送。"
        : voiceSessionActive
          ? "没有识别到语音；点麦克风继续聆听，或结束语音对话。"
          : draft.trim()
            ? "可以编辑文字后发送，也可以开始语音对话。"
            : settings.aiRuntime.voiceInputEnabled
              ? "点麦克风开始语音对话；回复完成后会自动恢复聆听。"
              : "开启语音输入后，就可以直接和我说话。";
  const voiceHeadline = voiceSpeaking ? "正在播报" : busy ? "正在思考" : listening ? "正在聆听" : voiceSessionActive ? "语音已连接" : draft.trim() ? "语音已识别" : "准备就绪";
  const voiceOrbStatus = voiceSpeaking ? "speaking" : busy ? "thinking" : listening ? "listening" : voiceSessionActive ? "connected" : "ready";
  const voiceInputAvailable = settings.aiRuntime.voiceInputEnabled && supportsVoiceInput();

  return (
    <section className="ai-work-chat ai-work-chat--voice" aria-label="AI 语音主脑">
      <main className="ai-work-voice" data-voice-status={voiceOrbStatus}>
        <header className="ai-work-voice__header">
          <span className="ai-work-voice__brand-mark" aria-label="小鱼 AI 主脑"><WorkbenchIcon name="spark" size={16} /></span>
          <nav className="ai-work-voice__header-actions" aria-label="主脑操作">
            <Tooltip title="返回文字对话"><Button className="ai-work-voice__header-action" type="text" aria-label="返回文字对话" onClick={() => { onEndVoiceSession(); onExitVoice(); }} icon={<WorkbenchIcon name="history" size={17} />} /></Tooltip>
            <Tooltip title="AI 与模型设置"><Button className="ai-work-voice__header-action" type="text" aria-label="打开 AI 与模型设置" onClick={() => onOpenSettings("ai")} icon={<WorkbenchIcon name="settings" size={17} />} /></Tooltip>
            <Tooltip title={voiceSessionActive ? "结束语音对话" : "语音对话尚未开始"}><Button className="ai-work-voice__header-action" type="text" aria-label="结束语音对话" disabled={!voiceSessionActive} onClick={onEndVoiceSession} icon={<WorkbenchIcon name="close" size={17} />} /></Tooltip>
          </nav>
        </header>
        <div className="ai-work-voice__body">
          <section className="ai-work-voice__hero" aria-label="语音主脑状态">
            <VoiceOrb3D fallbackSrc={voiceParticleCore} status={voiceOrbStatus} speechActivity={voiceSpeechActivity} reducedMotion={settings.appearance.advanced.reducedMotion} />
            <div className="ai-work-voice__hero-copy" role="status" aria-live="polite">
              <h1>{voiceHeadline}</h1>
              <p>{voiceStatusDetail}</p>
            </div>
          </section>
          <div className="ai-work-voice__control">
            {error ? <Alert className="ai-work-voice__error" type="error" showIcon closable message={error} onClose={onClearError} /> : null}
            <div className="ai-work-voice__composer">
              <Tooltip title={!settings.aiRuntime.voiceInputEnabled ? "请先在这里开启语音输入" : !supportsVoiceInput() ? "当前宿主不支持安全语音识别" : listening ? "结束聆听" : "开始语音对话"}>
                <Button className="ai-work-voice__mic" type="text" aria-label={!voiceSessionActive ? "开始语音对话" : busy || voiceSpeaking || listening ? "结束语音对话" : "继续聆听"} aria-pressed={voiceSessionActive} disabled={!voiceSessionActive && (!voiceInputAvailable || busy)} onClick={onToggleVoiceConversation} icon={<WorkbenchIcon name={voiceSessionActive && (busy || voiceSpeaking || listening) ? "close" : "microphone"} size={19} />} />
              </Tooltip>
              <Input.TextArea aria-label="语音识别文本，可编辑" value={draft} maxLength={12000} autoSize={{ minRows: 1, maxRows: 3 }} placeholder="有什么想和我聊的吗…" onChange={event => onDraftChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (draft.trim() && !busy) onSendMessage(draft); } }} />
              <Button className="ai-work-voice__send" type="text" aria-label="发送消息" title="发送消息" disabled={!draft.trim() || busy || !activeAccount} loading={busy} onClick={() => onSendMessage(draft)} icon={<WorkbenchIcon name="arrowRight" size={19} />} />
            </div>
            <section className="ai-work-voice__assistant" aria-label="当前智能助手">
              <span className="ai-work-voice__assistant-icon"><WorkbenchIcon name="browser" size={17} /></span>
              <span className="ai-work-voice__assistant-copy"><strong>智能助手</strong><span>沿用当前 AI Work 会话</span></span>
              <WorkbenchIcon className="ai-work-voice__assistant-spark" name="spark" size={15} />
            </section>
          </div>
          <div className="ai-work-voice__status-bar">
            <span className="ai-work-voice__status-label"><i aria-hidden="true" />AI 主脑 · {voiceStatus}</span>
            <div className="ai-work-voice__settings" aria-label="语音设置">
              {!supportsVoiceInput() ? <span className="ai-work-voice__support-note">当前宿主不支持语音识别</span> : null}
              {settings.aiRuntime.readResponsesAloud && !supportsVoiceOutput() ? <span className="ai-work-voice__support-note">当前宿主不支持语音播报</span> : null}
              <Button className="ai-work-voice__setting-toggle" size="small" type="text" aria-pressed={settings.aiRuntime.voiceInputEnabled} onClick={() => onSettingsChange({ ...settings, aiRuntime: { ...settings.aiRuntime, voiceInputEnabled: !settings.aiRuntime.voiceInputEnabled } })}><WorkbenchIcon name="microphone" size={13} />语音输入 · {settings.aiRuntime.voiceInputEnabled ? "开" : "关"}</Button>
              <span className="ai-work-voice__setting-divider" aria-hidden="true" />
              <Button className="ai-work-voice__setting-toggle" size="small" type="text" aria-pressed={settings.aiRuntime.readResponsesAloud} onClick={() => onSettingsChange({ ...settings, aiRuntime: { ...settings.aiRuntime, readResponsesAloud: !settings.aiRuntime.readResponsesAloud } })}><WorkbenchIcon name="spark" size={13} />回复播报 · {settings.aiRuntime.readResponsesAloud ? "开" : "关"}</Button>
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}
