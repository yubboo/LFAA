// 渲染输入栏右下角语音输入（Ctrl+M 波形状态）、发送与运行中取消（Ctrl+D）按钮及快捷键提示。
import { useEffect } from "react";
import { IconArrowUp, IconMicrophone, IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import type { ChatLocaleMessages } from "../locales";
import { useVoiceDictation } from "./useVoiceDictation";
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
  const { recording, transcribing, toggleRecording } = useVoiceDictation({
    locale,
    draft,
    onChangeDraft,
    onNotice,
  });

  useEffect(() => {
    const onGlobalKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "m") {
        event.preventDefault();
        toggleRecording();
      } else if (key === "d" && isRunning) {
        event.preventDefault();
        onStop();
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [isRunning, onStop, toggleRecording]);

  return (
    <div className={styles.actions}>
      <HoverTip
        label={transcribing ? locale.speechTranscribingNotice : recording ? locale.stopRecording : locale.recordAudio}
        shortcut={transcribing ? undefined : "Ctrl+M"}
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
        <HoverTip label={locale.pauseRunTooltip}>
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
