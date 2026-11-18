// 渲染设置中心「常规」页下半部分分组：编辑器、弹出窗口、通知与趣味实验。
import { useEffect, useState } from "react";
import { IconPencil, IconSparkles, IconX } from "@tabler/icons-react";
import type { GeneralSettingsConfig } from "../general-settings-client";
import { SettingGroupCard, SettingRow, SettingSelect, SettingSwitch } from "./GeneralSettingsControls";
import styles from "./GeneralSettingsView.module.css";

/** 装配编辑器、弹出窗口和通知的次级设置，不单独维护持久化状态。 */
export function GeneralSettingsSecondary({
  isZh,
  cfg,
  onPatch,
  onTriggerConfetti,
}: {
  isZh: boolean;
  cfg: GeneralSettingsConfig;
  onPatch: (patch: Partial<GeneralSettingsConfig>) => void;
  onTriggerConfetti: () => void;
}) {
  const [recordingShortcut, setRecordingShortcut] = useState(false);

  useEffect(() => {
    if (!recordingShortcut) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.key === "Escape") {
        setRecordingShortcut(false);
        return;
      }
      if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return;
      const parts: string[] = [];
      if (event.ctrlKey) parts.push("Ctrl");
      if (event.altKey) parts.push("Alt");
      if (event.shiftKey) parts.push("Shift");
      if (event.metaKey) parts.push("Win");
      parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
      setRecordingShortcut(false);
      onPatch({ popoutShortcut: parts.join("+") });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onPatch, recordingShortcut]);

  return (
    <>
      <SettingGroupCard title={isZh ? "编辑器" : "Editor"}>
        <SettingRow
          title={isZh ? "纯文本编辑器" : "Plain text editor"}
          description={isZh ? "编写消息时，将代码、Markdown 和链接保留为纯文本" : "Keep code, Markdown, and links as plain text while composing"}
          control={(
            <SettingSwitch
              checked={cfg.plainTextEditor}
              label={isZh ? "纯文本编辑器" : "Plain text editor"}
              onChange={(plainTextEditor) => onPatch({ plainTextEditor })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "显示上下文窗口使用情况" : "Show context window usage"}
          description={isZh ? "在输入栏与右侧能力面板显示估算上下文占用" : "Display estimated context window occupancy"}
          control={(
            <SettingSwitch
              checked={cfg.showContextUsage}
              label={isZh ? "显示上下文窗口使用情况" : "Show context window usage"}
              onChange={(showContextUsage) => onPatch({ showContextUsage })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "发送快捷键" : "Send shortcut"}
          description={isZh ? "选择按 Enter 时是发送提示词还是换行" : "Choose whether Enter sends or inserts a newline"}
          control={(
            <SettingSelect
              value={cfg.sendShortcut}
              label={isZh ? "发送快捷键" : "Send shortcut"}
              options={[
                { value: "enter", label: isZh ? "按 Enter 键" : "Press Enter" },
                { value: "ctrl_enter", label: isZh ? "按 Ctrl+Enter 键" : "Press Ctrl+Enter" },
              ]}
              onChange={(sendShortcut) => onPatch({ sendShortcut })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "后续消息处理方式" : "Follow-up message behavior"}
          description={
            isZh
              ? "在 LFAA 运行时将后续消息加入队列，或引导当前运行。按 Ctrl+Enter 可对单条消息执行相反操作"
              : "Queue messages while running or steer the current run. Hold Ctrl+Enter for the opposite."
          }
          control={(
            <div className={styles.segmented} role="group" aria-label={isZh ? "后续消息处理方式" : "Follow-up behavior"}>
              <button
                type="button"
                className={`${styles.segBtn} ${cfg.followUpMode === "queue" ? styles.segBtnActive : ""}`}
                onClick={() => onPatch({ followUpMode: "queue" })}
              >
                {isZh ? "排队" : "Queue"}
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${cfg.followUpMode === "steer" ? styles.segBtnActive : ""}`}
                onClick={() => onPatch({ followUpMode: "steer" })}
              >
                {isZh ? "引导" : "Steer"}
              </button>
            </div>
          )}
        />
      </SettingGroupCard>

      <SettingGroupCard title={isZh ? "弹出窗口" : "Popout window"}>
        <SettingRow
          title={isZh ? "弹出窗口快捷键" : "Popout shortcut"}
          description={isZh ? "为弹出窗口设置全局快捷键。不设置则保持关闭。" : "Set a shortcut for the popout window, or leave unset."}
          control={(
            <>
              <span className={styles.pathText}>
                {recordingShortcut
                  ? (isZh ? "请按键..." : "Press key...")
                  : (cfg.popoutShortcut || (isZh ? "关闭" : "Off"))}
              </span>
              <button
                type="button"
                className={styles.actionBtn}
                aria-label={isZh ? "编辑弹出窗口快捷键" : "Edit popout shortcut"}
                onClick={() => setRecordingShortcut((v) => !v)}
              >
                <IconPencil size={14} aria-hidden="true" />
              </button>
              {cfg.popoutShortcut && (
                <button
                  type="button"
                  className={styles.actionBtn}
                  aria-label={isZh ? "清除快捷键" : "Clear shortcut"}
                  onClick={() => onPatch({ popoutShortcut: "" })}
                >
                  <IconX size={14} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        />
        <SettingRow
          title={isZh ? "默认使用独立聊天" : "Default to standalone chat"}
          description={isZh ? "在任何项目外开始新聊天" : "Start new chats outside any project by default"}
          control={(
            <SettingSwitch
              checked={cfg.defaultStandaloneChat}
              label={isZh ? "默认使用独立聊天" : "Default to standalone chat"}
              onChange={(defaultStandaloneChat) => onPatch({ defaultStandaloneChat })}
            />
          )}
        />
      </SettingGroupCard>

      <SettingGroupCard title={isZh ? "通知" : "Notifications"}>
        <SettingRow
          title={isZh ? "轮次完成通知" : "Turn completion alerts"}
          description={isZh ? "设置 LFAA 完成后何时提醒你" : "Choose when to alert after a turn finishes"}
          control={(
            <SettingSelect
              value={cfg.turnCompleteNotification}
              label={isZh ? "轮次完成通知" : "Turn completion alerts"}
              options={[
                { value: "unfocused", label: isZh ? "仅在未聚焦时" : "When unfocused" },
                { value: "always", label: isZh ? "始终通知" : "Always" },
                { value: "off", label: isZh ? "关闭" : "Off" },
              ]}
              onChange={(turnCompleteNotification) => onPatch({ turnCompleteNotification })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "启用权限通知" : "Permission notifications"}
          description={isZh ? "当对话串需要你批准时显示提醒" : "Notify when an action needs your approval"}
          control={(
            <SettingSwitch
              checked={cfg.enableApprovalNotification}
              label={isZh ? "启用权限通知" : "Permission notifications"}
              onChange={(enableApprovalNotification) => onPatch({ enableApprovalNotification })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "启用问题通知" : "Question notifications"}
          description={isZh ? "当对话串中有人提问时显示提醒" : "Notify when a thread asks a question"}
          control={(
            <SettingSwitch
              checked={cfg.enableQuestionNotification}
              label={isZh ? "启用问题通知" : "Question notifications"}
              onChange={(enableQuestionNotification) => onPatch({ enableQuestionNotification })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "启用 Dot 通知" : "Dot notifications"}
          description={isZh ? "当智能体向你发送消息或需要你提供意见时显示提醒" : "Notify when the assistant requests input"}
          control={(
            <SettingSwitch
              checked={cfg.enableDotNotification}
              label={isZh ? "启用 Dot 通知" : "Dot notifications"}
              onChange={(enableDotNotification) => onPatch({ enableDotNotification })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "通知提示音" : "Notification sound"}
          description={isZh ? "任务完成、请求权限和提问时的提示音" : "Sound played for completion and approval prompts"}
          control={(
            <SettingSelect
              value={cfg.notificationSound}
              label={isZh ? "通知提示音" : "Notification sound"}
              options={[
                { value: "default", label: isZh ? "默认" : "Default" },
                { value: "chime", label: isZh ? "清脆提示音" : "Chime" },
                { value: "mute", label: isZh ? "静音" : "Muted" },
              ]}
              onChange={(notificationSound) => onPatch({ notificationSound })}
            />
          )}
        />
      </SettingGroupCard>

      <SettingGroupCard title={isZh ? "趣味实验" : "Experiments"}>
        <SettingRow
          title={isZh ? "彩纸礼炮" : "Confetti celebration"}
          description={isZh ? "按你的要求，在应用内展示彩纸礼炮特效！" : "Display an in-app celebration effect on request!"}
          control={(
            <>
              {cfg.confettiEffect && (
                <button
                  type="button"
                  className={styles.actionBtn}
                  aria-label={isZh ? "触发彩纸礼炮" : "Trigger confetti"}
                  onClick={onTriggerConfetti}
                >
                  <IconSparkles size={14} aria-hidden="true" />
                </button>
              )}
              <SettingSwitch
                checked={cfg.confettiEffect}
                label={isZh ? "彩纸礼炮" : "Confetti celebration"}
                onChange={(confettiEffect) => onPatch({ confettiEffect })}
              />
            </>
          )}
        />
      </SettingGroupCard>
    </>
  );
}
