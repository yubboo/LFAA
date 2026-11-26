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
            aria-label={locale.send}
            disabled={!canSend}
            onClick={onSend}
          >
            <IconArrowUp size={16} aria-hidden="true" />
          </button>
        </HoverTip>
      )}
    </div>
  );
}


