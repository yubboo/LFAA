// 通知设置分组：桌面通知权限、轮次完成/权限/问题提醒、会话状态徽标、事件提示音与自定义音频。
import { useEffect, useRef, useState } from "react";
import { IconBell, IconPlayerPlay, IconTrash, IconUpload, IconVolume } from "@tabler/icons-react";
import type { GeneralSettingsConfig } from "../general-settings-client";
import { notificationPermission, requestNotificationPermission, showDesktopNotification } from "../notifications";
import {
  MAX_CUSTOM_SOUND_BYTES,
  deleteCustomNotificationSound,
  listCustomNotificationSounds,
  uploadCustomNotificationSound,
  type CustomNotificationSound,
} from "../notification-sound-api";
import { BUILTIN_NOTIFICATION_SOUNDS, playNotificationSound } from "../notification-sounds";
import { SettingRow, SettingSelect, SettingSwitch } from "./GeneralSettingsControls";
import styles from "./GeneralSettingsView.module.css";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** 展示并申请桌面通知权限；未授权时仍保留应用内徽标与提示音。 */
function NotificationPermissionControl({ isZh }: { isZh: boolean }) {
  const [permission, setPermission] = useState(() => notificationPermission());
  if (permission === "unsupported") {
    return <span className={styles.pathText}>{isZh ? "当前环境不支持系统通知" : "Not supported"}</span>;
  }
  if (permission === "granted") {
    return <span className={styles.pathText}>{isZh ? "已允许" : "Allowed"}</span>;
  }
  return (
    <button
      type="button"
      className={styles.actionBtn}
      onClick={() => {
        void requestNotificationPermission().then(setPermission);
      }}
    >
      <IconBell size={14} aria-hidden="true" />
      {permission === "denied"
        ? (isZh ? "已被拒绝" : "Denied")
        : (isZh ? "请求权限" : "Allow")}
    </button>
  );
}

/** 事件提示音选择器：内置音、自定义音、静音与试听。 */
function SoundPicker({
  isZh,
  value,
  fallback,
  customSounds,
  onChange,
}: {
  isZh: boolean;
  value: string | undefined;
  fallback: string | undefined;
  customSounds: CustomNotificationSound[];
  onChange: (soundId: string) => void;
}) {
  const selected = value ?? fallback ?? "default";
  const known = [
    ...BUILTIN_NOTIFICATION_SOUNDS.map((item) => ({ value: item.id, label: isZh ? item.zh : item.en })),
    ...customSounds.map((item) => ({ value: `custom:${item.id}`, label: item.name })),
    { value: "mute", label: isZh ? "静音" : "Muted" },
  ];
  const options = known.some((item) => item.value === selected)
    ? known
    : [{ value: selected, label: isZh ? "自定义提示音（缺失）" : "Custom sound (missing)" }, ...known];
  return (
    <div className={styles.rowControl}>
      <SettingSelect
        value={selected}
        label={isZh ? "提示音" : "Notification sound"}
        options={options}
        onChange={onChange}
      />
      <button
        type="button"
        className={styles.actionBtn}
        aria-label={isZh ? "试听" : "Preview"}
        title={isZh ? "试听" : "Preview"}
        disabled={selected === "mute"}
        onClick={() => void playNotificationSound(selected)}
      >
        <IconVolume size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/** 渲染通知相关行；设置持久化与提示文案由外层页面统一处理。 */
export function NotificationSettingsGroup({
  isZh,
  cfg,
  onPatch,
}: {
  isZh: boolean;
  cfg: GeneralSettingsConfig;
  onPatch: (patch: Partial<GeneralSettingsConfig>) => void;
}) {
  const [customSounds, setCustomSounds] = useState<CustomNotificationSound[]>([]);
  const [soundError, setSoundError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const completionSound = cfg.completionSound ?? cfg.notificationSound;
  const questionSound = cfg.questionSound ?? cfg.notificationSound;
  const approvalSound = cfg.approvalSound ?? cfg.notificationSound;

  useEffect(() => {
    let cancelled = false;
    void listCustomNotificationSounds()
      .then((sounds) => { if (!cancelled) setCustomSounds(sounds); })
      .catch(() => { if (!cancelled) setCustomSounds([]); });
    return () => { cancelled = true; };
  }, []);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setSoundError("");
    setUploading(true);
    try {
      const sound = await uploadCustomNotificationSound(file);
      setCustomSounds((current) => [sound, ...current.filter((item) => item.id !== sound.id)]);
    } catch (error) {
      setSoundError(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const remove = async (sound: CustomNotificationSound) => {
    setSoundError("");
    try {
      await deleteCustomNotificationSound(sound.id);
      setCustomSounds((current) => current.filter((item) => item.id !== sound.id));
      // 被删除的声音若仍被事件引用，回退到内置默认音，避免后续提醒静默失败。
      const patches: Partial<GeneralSettingsConfig> = {};
      if (completionSound === `custom:${sound.id}`) patches.completionSound = "default";
      if (questionSound === `custom:${sound.id}`) patches.questionSound = "default";
      if (approvalSound === `custom:${sound.id}`) patches.approvalSound = "default";
      if (Object.keys(patches).length > 0) onPatch(patches);
    } catch (error) {
      setSoundError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <SettingRow
        title={isZh ? "桌面通知权限" : "Desktop notification permission"}
        description={isZh
          ? "系统通知需要授权；未授权时仍会在左二栏显示状态徽标并播放提示音"
          : "System notifications need permission; badges and sounds still work without it"}
        control={<NotificationPermissionControl isZh={isZh} />}
      />
      <SettingRow
        title={isZh ? "发送测试通知" : "Send a test notification"}
        description={isZh ? "验证桌面通知权限与当前完成提示音是否正常" : "Verify notification permission and the completion sound"}
        control={(
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              void requestNotificationPermission().then(() => {
                void playNotificationSound(completionSound);
                showDesktopNotification({
                  title: "LFAA 测试通知",
                  body: isZh ? "如果你看到这条通知，说明桌面通知已经接通。" : "If you see this, desktop notifications are connected.",
                  tag: "lfaa-test-notification",
                });
              });
            }}
          >
            <IconBell size={14} aria-hidden="true" />
            {isZh ? "测试" : "Test"}
          </button>
        )}
      />
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
        description={isZh ? "当对话串需要你批准时提醒你" : "Notify when an action needs your approval"}
        control={(
          <SettingSwitch
            checked={cfg.enableApprovalNotification}
            label={isZh ? "启用权限通知" : "Permission notifications"}
            onChange={(enableApprovalNotification) => {
              if (enableApprovalNotification) void requestNotificationPermission();
              onPatch({ enableApprovalNotification });
            }}
          />
        )}
      />
      <SettingRow
        title={isZh ? "启用问题通知" : "Question notifications"}
        description={isZh ? "当对话串需要你回答问题时提醒你" : "Notify when a thread asks you a question"}
        control={(
          <SettingSwitch
            checked={cfg.enableQuestionNotification}
            label={isZh ? "启用问题通知" : "Question notifications"}
            onChange={(enableQuestionNotification) => {
              if (enableQuestionNotification) void requestNotificationPermission();
              onPatch({ enableQuestionNotification });
            }}
          />
        )}
      />
      <SettingRow
        title={isZh ? "启用会话状态提醒" : "Session status badges"}
        description={isZh ? "在左二会话列表显示待确认 / 待回答的会话" : "Show waiting approvals and questions in the chat list"}
        control={(
          <SettingSwitch
            checked={cfg.enableDotNotification}
            label={isZh ? "启用会话状态提醒" : "Session status badges"}
            onChange={(enableDotNotification) => onPatch({ enableDotNotification })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "轮次完成提示音" : "Completion sound"}
        description={isZh ? "一轮回复结束后的提示音" : "Played when a turn completes"}
        control={(
          <SoundPicker
            isZh={isZh}
            value={cfg.completionSound}
            fallback={cfg.notificationSound}
            customSounds={customSounds}
            onChange={(soundId) => onPatch({ completionSound: soundId })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "澄清 / 待回答提示音" : "Question sound"}
        description={isZh ? "Agent 需要你回答澄清问题时使用" : "Played when the agent asks a clarifying question"}
        control={(
          <SoundPicker
            isZh={isZh}
            value={cfg.questionSound}
            fallback={cfg.notificationSound}
            customSounds={customSounds}
            onChange={(soundId) => onPatch({ questionSound: soundId })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "待确认 / 关键决策提示音" : "Approval / decision sound"}
        description={isZh ? "需要批准工具调用或关键决策时使用" : "Played when approval or a key decision is required"}
        control={(
          <SoundPicker
            isZh={isZh}
            value={cfg.approvalSound}
            fallback={cfg.notificationSound}
            customSounds={customSounds}
            onChange={(soundId) => onPatch({ approvalSound: soundId })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "自定义提示音" : "Custom sounds"}
        description={isZh
          ? `上传 WAV、MP3、OGG、M4A、WebM 或 FLAC，最大 ${formatBytes(MAX_CUSTOM_SOUND_BYTES)}`
          : `Upload WAV, MP3, OGG, M4A, WebM or FLAC up to ${formatBytes(MAX_CUSTOM_SOUND_BYTES)}`}
        control={(
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => void upload(event.target.files?.[0])}
            />
            <button
              type="button"
              className={styles.actionBtn}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload size={14} aria-hidden="true" />
              {uploading ? (isZh ? "上传中…" : "Uploading…") : (isZh ? "上传音频" : "Upload audio")}
            </button>
          </>
        )}
      />
      {soundError && <p className={styles.rowDesc}>{soundError}</p>}
      {customSounds.length === 0 ? (
        <p className={styles.rowDesc}>{isZh ? "还没有自定义提示音。" : "No custom sounds yet."}</p>
      ) : (
        customSounds.map((sound) => (
          <SettingRow
            key={sound.id}
            title={sound.name}
            description={`${formatBytes(sound.size)} · ${sound.mime}`}
            control={(
              <div className={styles.rowControl}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  aria-label={isZh ? "试听自定义提示音" : "Preview custom sound"}
                  title={isZh ? "试听" : "Preview"}
                  onClick={() => void playNotificationSound(`custom:${sound.id}`)}
                >
                  <IconPlayerPlay size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  aria-label={isZh ? "删除自定义提示音" : "Delete custom sound"}
                  title={isZh ? "删除" : "Delete"}
                  onClick={() => void remove(sound)}
                >
                  <IconTrash size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          />
        ))
      )}
    </>
  );
}