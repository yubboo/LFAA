// 渲染设置中心「常规」页下半部分分组：编辑器、弹出窗口、通知与趣味实验。
import { useEffect, useState } from "react";
import { IconPencil, IconSparkles, IconX } from "@tabler/icons-react";
import type { GeneralSettingsConfig } from "../general-settings-client";
import { NotificationSettingsGroup } from "./NotificationSettingsGroup";
import { SettingGroupCard, SettingRow, SettingSelect, SettingSwitch } from "./GeneralSettingsControls";
import styles from "./GeneralSettingsView.module.css";

/** 解析“3, 5, 8”形式的阈值文本；只保留 >=2 的整数并去重升序。 */
function parseThresholds(text: string): number[] {
  const values = text
    .split(/[\s,，]+/u)
    .map((part) => Number(part))
    .filter((value) => Number.isInteger(value) && value >= 2);
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

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
  // 阈值输入使用本地草稿，失焦时再归一化提交，避免输入逗号时被格式化打断。
  const [thresholdDraft, setThresholdDraft] = useState(cfg.repeatToolThresholds.join(", "));

  useEffect(() => {
    setThresholdDraft(cfg.repeatToolThresholds.join(", "));
  }, [cfg.repeatToolThresholds]);

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

        {/* 行为预览：与输入框实际排队/插话逻辑保持一致，设置切换即时更新。 */}
        <div className={styles.followUpPreview} aria-live="polite">
          <span className={styles.followUpPreviewLabel}>
            {isZh ? "行为预览" : "Preview"}
          </span>
          <span className={styles.followUpPreviewRow}>
            <span className={styles.followUpPreviewKey}>Enter</span>
            <span>
              {cfg.followUpMode === "queue"
                ? (isZh ? "→ 加入排队，当前运行结束后依次发送" : "→ queues; sends after the run finishes")
                : (isZh ? "→ 立即插话，中止当前运行并继续提问" : "→ steers now, interrupting the run")}
            </span>
          </span>
          <span className={styles.followUpPreviewRow}>
            <span className={styles.followUpPreviewKey}>Ctrl+Enter</span>
            <span>
              {cfg.followUpMode === "queue"
                ? (isZh ? "→ 单条立即插话；有排队时发送全部" : "→ steer one; flushes all queued when any")
                : (isZh ? "→ 改为排队；有排队时发送全部" : "→ queue instead; flushes all queued when any")}
            </span>
          </span>
        </div>
      </SettingGroupCard>

      <SettingGroupCard title={isZh ? "Agent 行为" : "Agent behavior"}>
        <SettingRow
          title={isZh ? "重复工具调用提醒" : "Repeated tool-call reminders"}
          description={
            isZh
              ? "同一工具以完全相同的参数连续调用到这些次数时，提醒模型换方法或结束任务；留空关闭。"
              : "Remind the model when identical tool calls repeat at these counts; leave empty to disable."
          }
          control={(
            <input
              className={styles.thresholdInput}
              value={thresholdDraft}
              placeholder={isZh ? "如 3, 5, 8（留空关闭）" : "e.g. 3, 5, 8 (empty disables)"}
              aria-label={isZh ? "重复工具调用提醒阈值" : "Repeated tool-call reminder thresholds"}
              onChange={(event) => setThresholdDraft(event.target.value)}
              onBlur={() => {
                const next = parseThresholds(thresholdDraft);
                setThresholdDraft(next.join(", "));
                onPatch({ repeatToolThresholds: next });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
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
        <NotificationSettingsGroup isZh={isZh} cfg={cfg} onPatch={onPatch} />
      </SettingGroupCard>

      <SettingGroupCard title={isZh ? "趣味实验" : "Experiments"}>
        <SettingRow
          title={isZh ? "生图水印" : "Image watermark"}
          description={isZh
            ? "默认不出水印（也会抑制模型厂商的「AI 生成」水印）；开启后只在聊天里的生成图上叠加「小鱼 agent 生成」。"
            : "Off by default (provider AI watermark is suppressed). When on, generated images show a small “小鱼 agent” badge."}
          control={(
            <SettingSwitch
              checked={cfg.imageWatermark}
              label={isZh ? "生图水印" : "Image watermark"}
              onChange={(imageWatermark) => onPatch({ imageWatermark })}
            />
          )}
        />
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
