/**
 * 功能：提示用户完成首次登录所需配置。
 * 作用：串联账户凭据、AI 和业务内容目录提醒，并管理共享弹窗状态，避免弹窗交互触发整个工作台重新渲染。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings-general/src/setup-reminder.ts、packages/client/connection/src/api.ts、packages/client/ui-layout/src/workbench.css。
 */
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import { getErrorMessage, hasAdminAccess, loadAiAccounts, loadProjectStorageLocations, saveSettings, type ProjectStorageLocations, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { getSetupReminderLocalDay, isCredentialReminderSnoozedToday, isSetupReminderSnoozedToday, setCredentialReminderSnoozedToday, setSetupReminderSnoozedToday, type SetupReminderCategory } from "./setup-reminder.js";

interface SetupReminderProps {
  user: User;
  settings: UserSettings;
  isSettingsPage: boolean;
  suspended: boolean;
  onSettingsChange: (settings: UserSettings) => void;
  onOpenSettings: (section: "ai" | "workspace") => void;
  onModalActivityChange?: (active: boolean) => void;
  priorityPrompt?: SetupReminderPrompt | null;
}

interface SetupReminderPrompt {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}

type SetupReminderItem = "ai" | "storage";
type SetupReminderId = SetupReminderCategory | "credential";

const REMIND_LATER_DELAY_MS = 5 * 60 * 1000;

const SETUP_REMINDER_COPY: Record<SetupReminderItem, { title: string; description: string; action: string; choiceNote: string; section: "ai" | "workspace"; category: SetupReminderCategory }> = {
  storage: { title: "选择业务内容数据目录", description: "此目录用于保存游戏、小说和漫剧的业务内容数据。可在“项目与存储”统一查看或调整默认位置；账户、模型配置、会话和插件位置不受影响。", action: "去配置存储", choiceNote: "不更改会保留当前默认目录并关闭后续业务内容存储提醒；点击“去配置存储”后，可在“项目与存储”选择系统推荐或自定义位置。", section: "workspace", category: "content-storage" },
  ai: { title: "尚未配置大模型", description: "请前往设置中心完成配置。", action: "去配置模型", choiceNote: "不更改会关闭后续 AI Provider 提醒；去配置模型会打开设置页面。", section: "ai", category: "ai-provider" }
};

export function SetupReminder({ user, settings, isSettingsPage, suspended, onSettingsChange, onOpenSettings, onModalActivityChange, priorityPrompt = null }: SetupReminderProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [missing, setMissing] = useState<SetupReminderItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storageLocations, setStorageLocations] = useState<ProjectStorageLocations | null>(null);
  const [currentLocalDay, setCurrentLocalDay] = useState(() => getSetupReminderLocalDay());
  const [remindLaterUntil, setRemindLaterUntil] = useState<Partial<Record<SetupReminderId, number>>>({});
  const [reminderRetryRevision, setReminderRetryRevision] = useState(0);
  const statusRequestsRef = useRef(new Map<string, Promise<unknown>>());

  function loadStatusOnce<T>(key: string, load: () => Promise<T>): Promise<T> {
    const pending = statusRequestsRef.current.get(key);
    if (pending) return pending as Promise<T>;
    const request = Promise.resolve().then(load);
    statusRequestsRef.current.set(key, request);
    const clear = () => {
      if (statusRequestsRef.current.get(key) === request) statusRequestsRef.current.delete(key);
    };
    void request.then(clear, clear);
    return request;
  }

  function isReminderSnoozedForLater(reminder: SetupReminderId): boolean {
    return (remindLaterUntil[reminder] ?? 0) > Date.now();
  }

  const currentReminder = missing[0] ? SETUP_REMINDER_COPY[missing[0]] : null;
  const activePriorityPrompt = priorityPrompt
    && settings.general.notificationPopupsEnabled
    && !isSettingsPage
    && settings.general.defaultAdminCredentialReminderEnabled
    && !isCredentialReminderSnoozedToday(user.id, currentLocalDay)
    && !isReminderSnoozedForLater("credential")
    ? priorityPrompt
    : null;
  const promptTitle = activePriorityPrompt?.title ?? currentReminder?.title;
  const promptDescription = activePriorityPrompt?.description ?? currentReminder?.description;
  const promptAction = activePriorityPrompt?.action ?? currentReminder?.action;
  const modalActive = !isSettingsPage && (checking || settings.general.notificationPopupsEnabled && (Boolean(activePriorityPrompt) || !suspended && open));

  useEffect(() => {
    onModalActivityChange?.(modalActive);
    return () => onModalActivityChange?.(false);
  }, [modalActive, onModalActivityChange]);

  useEffect(() => {
    // 提醒组件保持挂载时跨过本地午夜，允许新的一天重新检查。
    const timer = window.setInterval(() => {
      const today = getSetupReminderLocalDay();
      setCurrentLocalDay((current) => current === today ? current : today);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const now = Date.now();
    const nextReminderAt = Object.values(remindLaterUntil)
      .filter((until): until is number => typeof until === "number" && until > now)
      .reduce((earliest, until) => Math.min(earliest, until), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(nextReminderAt)) return;

    const timer = window.setTimeout(() => {
      const currentTime = Date.now();
      setRemindLaterUntil((current) => Object.fromEntries(
        Object.entries(current).filter(([, until]) => typeof until === "number" && until > currentTime)
      ) as Partial<Record<SetupReminderId, number>>);
      setReminderRetryRevision((revision) => revision + 1);
    }, Math.max(0, nextReminderAt - now));
    return () => window.clearTimeout(timer);
  }, [remindLaterUntil]);

  useEffect(() => {
    if (!settings.general.notificationPopupsEnabled) {
      setChecking(false);
      setOpen(false);
      return;
    }
    if (suspended) {
      setChecking(false);
      setOpen(false);
      return;
    }
    if (isSettingsPage || activePriorityPrompt) {
      setChecking(false);
      setOpen(false);
      return;
    }

    let active = true;
    setChecking(true);
    const shouldCheckStorage = hasAdminAccess(user.role)
      && settings.general.setupReminderEnabled
      && !isSetupReminderSnoozedToday(user.id, currentLocalDay, "content-storage")
      && !isReminderSnoozedForLater("content-storage");
    const shouldCheckAi = settings.general.aiProviderReminderEnabled
      && !isSetupReminderSnoozedToday(user.id, currentLocalDay, "ai-provider")
      && !isReminderSnoozedForLater("ai-provider");
    const storageRequest = shouldCheckStorage ? loadStatusOnce("content-storage", loadProjectStorageLocations) : Promise.resolve(null);
    const accountsRequest = shouldCheckAi ? loadStatusOnce("ai-provider", loadAiAccounts) : Promise.resolve(null);
    if (!shouldCheckStorage && !shouldCheckAi) {
      setChecking(false);
      setOpen(false);
      setMissing([]);
      return;
    }
    void Promise.allSettled([accountsRequest, storageRequest]).then(([accountsResult, storageResult]) => {
      if (!active) return;
      setChecking(false);
      const nextMissing: SetupReminderItem[] = [];
      if (shouldCheckAi && accountsResult.status === "fulfilled" && !accountsResult.value?.accounts.some(account => account.active)) nextMissing.push("ai");
      if (shouldCheckStorage && storageResult.status === "fulfilled" && storageResult.value) {
        setStorageLocations(storageResult.value.settings);
        if (!storageResult.value.configured) nextMissing.push("storage");
      }
      if (nextMissing.length === 0) {
        setOpen(false);
      } else {
        setMissing(nextMissing);
        setOpen(true);
      }
    });

    return () => { active = false; setChecking(false); };
  }, [activePriorityPrompt, currentLocalDay, isSettingsPage, reminderRetryRevision, settings.general.aiProviderReminderEnabled, settings.general.notificationPopupsEnabled, settings.general.setupReminderEnabled, suspended, user.id, user.role]);

  function advanceVisibleQueue(category: SetupReminderCategory): void {
    const nextMissing = missing.filter((id) => SETUP_REMINDER_COPY[id].category !== category);
    setMissing(nextMissing);
    setOpen(nextMissing.length > 0);
  }

  function remindLater(reminder: SetupReminderId): void {
    setRemindLaterUntil((current) => ({ ...current, [reminder]: Date.now() + REMIND_LATER_DELAY_MS }));
    if (reminder === "credential") setOpen(false);
    else advanceVisibleQueue(reminder);
    setSaveError("");
  }

  function remindCurrentLater(): void {
    if (activePriorityPrompt) remindLater("credential");
    else if (currentReminder) remindLater(currentReminder.category);
    else setOpen(false);
  }

  const dismissForToday = () => {
    // 浏览器不允许本地存储时，当前组件状态仍避免再次弹出。
    if (!currentReminder || !setSetupReminderSnoozedToday(user.id, currentLocalDay, currentReminder.category)) {
      setSaveError("浏览器无法保存当日提醒状态，请检查本地存储权限后重试。");
      return;
    }
    setSaveError("");
    advanceVisibleQueue(currentReminder.category);
  };

  const saveReminderDisabled = async (category: SetupReminderCategory) => {
    const settingPatch = category === "ai-provider"
      ? { aiProviderReminderEnabled: false }
      : { setupReminderEnabled: false };
    const { settings: savedSettings } = await saveSettings("general", { ...settings.general, ...settingPatch });
    onSettingsChange(savedSettings);
  };

  const disableReminder = async () => {
    if (!currentReminder) return;
    setSaving(true);
    setSaveError("");
    try {
      await saveReminderDisabled(currentReminder.category);
      advanceVisibleQueue(currentReminder.category);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const dismissCredentialReminderForToday = () => {
    if (!priorityPrompt) return;
    if (!setCredentialReminderSnoozedToday(user.id, currentLocalDay)) {
      setSaveError("浏览器无法保存当日提醒状态，请检查本地存储权限后重试。");
      return;
    }
    setSaveError("");
    setOpen(false);
    setReminderRetryRevision((revision) => revision + 1);
  };

  const disableCredentialReminder = async () => {
    if (!priorityPrompt) return;
    setSaving(true);
    setSaveError("");
    try {
      const { settings: savedSettings } = await saveSettings("general", { ...settings.general, defaultAdminCredentialReminderEnabled: false });
      onSettingsChange(savedSettings);
      setOpen(false);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openReminderSettings = (section: "ai" | "workspace") => {
    setOpen(false);
    onOpenSettings(section);
  };

  return (
    <Modal
      rootClassName="setup-reminder-modal"
      title={promptTitle}
      open={settings.general.notificationPopupsEnabled && !isSettingsPage && (Boolean(activePriorityPrompt) || !suspended && open)}
      onCancel={remindCurrentLater}
      closable={!activePriorityPrompt}
      maskClosable={!activePriorityPrompt}
      keyboard={!activePriorityPrompt}
      getContainer={() => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body}
      footer={activePriorityPrompt
        ? <Space wrap>
          <Button disabled={saving} onClick={dismissCredentialReminderForToday}>今日不再提醒</Button>
          <Button disabled={saving} onClick={() => remindLater("credential")}>稍后再说</Button>
        </Space>
        : <Space wrap>
          <Button disabled={saving} onClick={dismissForToday}>今日不再提醒</Button>
          <Button disabled={saving} onClick={remindCurrentLater}>稍后再说</Button>
        </Space>}
      centered
      width={480}
    >
      {saveError ? <Alert type="error" showIcon message={saveError} /> : null}
      {promptDescription && promptAction ? <div className="setup-reminder-card">
        <Typography.Paragraph className="setup-reminder-card__description">{promptDescription}</Typography.Paragraph>
        {missing[0] === "storage" && !activePriorityPrompt && storageLocations ? <div className="setup-reminder-card__locations">
          <div><Typography.Text strong>不更改</Typography.Text><Typography.Text code>{storageLocations.defaultContentDirectory}</Typography.Text></div>
          <div><Typography.Text strong>系统推荐</Typography.Text><Typography.Text code>{storageLocations.recommendedContentDirectory}</Typography.Text></div>
        </div> : null}
        {missing[0] === "storage" && !activePriorityPrompt ? <>
          <Space wrap className="setup-reminder-card__actions">
            <Button loading={saving} disabled={saving} onClick={() => void disableReminder()}>不更改</Button>
            <Button type="primary" disabled={saving} onClick={() => openReminderSettings("workspace")}>{promptAction}</Button>
          </Space>
          <Typography.Text className="setup-reminder-card__choice-note" type="secondary">{currentReminder?.choiceNote}</Typography.Text>
        </> : activePriorityPrompt ? <>
          <Space wrap className="setup-reminder-card__actions">
            <Button loading={saving} disabled={saving} onClick={() => void disableCredentialReminder()}>不更改</Button>
            <Button type="primary" disabled={saving} onClick={() => {
              setOpen(false);
              activePriorityPrompt.onAction();
            }}>更改</Button>
          </Space>
          <Typography.Text className="setup-reminder-card__choice-note" type="secondary">不更改会保留当前登录凭据，并关闭后续提醒；更改会打开安全设置，不会自动修改。</Typography.Text>
        </> : missing[0] === "ai" ? null : <Button type="primary" className="setup-reminder-card__action" onClick={() => {
          if (currentReminder) openReminderSettings(currentReminder.section);
        }}>{promptAction}</Button>}
        {missing[0] === "ai" && !activePriorityPrompt ? <>
          <Space wrap className="setup-reminder-card__actions">
            <Button loading={saving} disabled={saving} onClick={() => void disableReminder()}>不更改</Button>
            <Button type="primary" disabled={saving} onClick={() => openReminderSettings("ai")}>{promptAction}</Button>
          </Space>
          <Typography.Text className="setup-reminder-card__choice-note" type="secondary">{currentReminder?.choiceNote}</Typography.Text>
        </> : null}
      </div> : null}
    </Modal>
  );
}
