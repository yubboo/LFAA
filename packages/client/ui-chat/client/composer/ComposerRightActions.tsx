// 渲染输入栏右下角语音听写、发送与运行中取消按钮及其快捷键提示；组合键由工作台快捷键注册表提供。
import { useEffect } from "react";
import { IconArrowUp, IconMicrophone, IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import { shortcutHint } from "@lfaa/ui-layout/client";
import type { ChatLocaleMessages } from "../locales";
import { useVoiceDictation } from "./useVoiceDictation";
import { provideComposerCommand } from "./composer-commands";
import styles from "./ComposerRightActions.module.css";

export { mergeDictationTranscript } from "./useVoiceDictation";

/** 空态发送位图标：三根高低错落的圆角竖条 + 右上角内凹四角星芒，随按钮文字色切换深浅。 */
function IdleSparkWaveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <line x1="4.8" y1="8.4" x2="4.8" y2="14.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="8.4" y1="6.2" x2="8.4" y2="16.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="12" y1="10.2" x2="12" y2="13.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M15.1 2.2Q15.45 5.45 18.7 5.8Q15.45 6.15 15.1 9.4Q14.75 6.15 11.5 5.8Q14.75 5.45 15.1 2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 按照录音、等待回复和空闲状态显示麦克风、取消或发送动作。 */
export function ComposerRightActions({
  locale,
  draft,
  canSend,
  isRunning,
  paused,
  onChangeDraft,
  onSend,
  onStop,
  onContinue,
  onNotice,
}: {
  locale: ChatLocaleMessages;
  draft: string;
  canSend: boolean;
  isRunning: boolean;
  /** 运行已中断且最后一条回复可续写；输入框为空时发送位改为「继续生成」。 */
  paused: boolean;
  onChangeDraft: (nextDraft: string) => void;
  onSend: () => void;
  onStop: () => void;
  onContinue: () => void;
  onNotice: (message: string) => void;
}) {
  const dictationHint = shortcutHint("composer.dictation");
  const stopHint = shortcutHint("session.abort");
  const { recording, transcribing, toggleRecording } = useVoiceDictation({
    locale,
    draft,
    onChangeDraft,
    onNotice,
  });

  // 听写与中止交给快捷键注册表统一分发；这里只登记命令处理，提示键位也从注册表读。
  useEffect(() => {
    const disposers = [provideComposerCommand("dictation", () => toggleRecording())];
    if (isRunning) disposers.push(provideComposerCommand("stop", () => onStop()));
    return () => { for (const dispose of disposers) dispose(); };
  }, [isRunning, onStop, toggleRecording]);

  return (
    <div className={styles.actions}>
      <HoverTip
        label={transcribing ? locale.speechTranscribingNotice : recording ? locale.stopRecording : locale.recordAudio}
        shortcut={transcribing ? undefined : dictationHint}
      >
        <button
          type="button"
          className={`${styles.micBtn} ${recording ? styles.micBtnRecording : ""}`}
          aria-pressed={recording}
          aria-label={recording ? locale.stopRecording : locale.recordAudio}
          disabled={transcribing}
          onClick={toggleRecording}
        >
          {recording ? (
            <span className={styles.waveBars} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : (
            <IconMicrophone size={16} aria-hidden="true" />
          )}
        </button>
      </HoverTip>

      {isRunning ? (
        <HoverTip label={locale.pauseRunTooltip} shortcut={stopHint}>
          <button
            type="button"
            className={styles.pauseBtn}
            aria-label={locale.pauseRunTooltip}
            onClick={onStop}
          >
            <IconPlayerPauseFilled size={14} aria-hidden="true" />
          </button>
        </HoverTip>
      ) : paused ? (
        <HoverTip label={locale.continueRunTooltip}>
          <button
            type="button"
            className={styles.continueBtn}
            aria-label={locale.continueRun}
            onClick={onContinue}
          >
            <IconPlayerPlayFilled size={14} aria-hidden="true" />
          </button>
        </HoverTip>
      ) : (
        <HoverTip label={locale.send} shortcut="Enter">
          <button
            type="button"
            className={styles.sendBtn}
            data-ready={canSend ? "true" : "false"}
            aria-label={locale.send}
            disabled={!canSend}
            onClick={onSend}
          >
            {canSend ? <IconArrowUp size={16} aria-hidden="true" /> : <IdleSparkWaveIcon />}
          </button>
        </HoverTip>
      )}
    </div>
  );
}


