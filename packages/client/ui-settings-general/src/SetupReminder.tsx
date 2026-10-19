/**
 * 功能：提示用户完成首次配置。
 * 作用：独立检查 AI 与业务内容存储配置并管理提醒弹窗状态，避免弹窗交互触发整个工作台重新渲染。
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

type SetupReminderId = SetupReminderCategory | "credential";

const REMIND_LATER_DELAY_MS = 5 * 60 * 1000;

const SETUP_REMINDER_COPY: Record<"storage" | "ai", { title: string; description: string; action: string; choiceNote: string; section: "ai" | "workspace"; category: SetupReminderCategory }> = {
  storage: { title: "选择内容数据存储位置", description: "此选择只决定游戏、小说和漫剧内容写入哪个 data 目录。默认位置在 LFAA 用户目录下；系统推荐会使用当前项目或安装目录下的 data。账户、模型配置、会话和插件位置不受影响。", action: "去配置存储", choiceNote: "不更改会保留默认目录并关闭后续业务内容存储提醒；点击“去配置存储”后，可在“项目与存储”选择系统推荐或自定义位置。", section: "workspace", category: "content-storage" },
  ai: { title: "尚未配置大模型", description: "请前往设置中心完成配置。", action: "去配置模型", choiceNote: "不更改会关闭后续 AI Provider 提醒；去配置模型会打开设置页面。", section: "ai", category: "ai-provider" }
};

export function SetupReminder({ user, settings, isSettingsPage, suspended, onSettingsChange, onOpenSettings, onModalActivityChange, priorityPrompt = null }: SetupReminderProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [missing, setMissing] = useState<Array<"ai" | "storage">>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storageLocations, setStorageLocations] = useState<ProjectStorageLocations | null>(null);
  const [currentLocalDay, setCurrentLocalDay] = useState(() => getSetupReminderLocalDay());
  const [remindLaterUntil, setRemindLaterUntil] = useState<Partial<Record<SetupReminderId, number>>>({});
  const shownRef = useRef(false);

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
      shownRef.current = false;
    }, Math.max(0, nextReminderAt - now));
    return () => window.clearTimeout(timer);
  }, [remindLaterUntil]);

  useEffect(() => {
    shownRef.current = false;
  }, [currentLocalDay, user.id]);

  useEffect(() => {
    if (!settings.general.notificationPopupsEnabled) {
      shownRef.current = false;
      setChecking(false);
      setOpen(false);
      return;
    }
    if (suspended) {
      shownRef.current = false;
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
    const storageRequest = shouldCheckStorage ? loadProjectStorageLocations() : Promise.resolve(null);
    const shouldCheckAi = settings.general.aiProviderReminderEnabled
      && !isSetupReminderSnoozedToday(user.id, currentLocalDay, "ai-provider")
      && !isReminderSnoozedForLater("ai-provider");
    const accountsRequest = shouldCheckAi ? loadAiAccounts() : Promise.resolve(null);
    if (!shouldCheckStorage && !shouldCheckAi) {
      setChecking(false);
      setOpen(false);
      setMissing([]);
      return;
    }
    void Promise.allSettled([accountsRequest, storageRequest]).then(([accountsResult, storageResult]) => {
      if (!active) return;
      setChecking(false);
      const nextMissing: Array<"ai" | "storage"> = [];
      if (shouldCheckStorage && storageResult.status === "fulfilled" && storageResult.value) {
        setStorageLocations(storageResult.value.settings);
        if (!storageResult.value.configured) nextMissing.push("storage");
      }
      if (shouldCheckAi && accountsResult.status === "fulfilled" && !accountsResult.value?.accounts.some(account => account.active)) nextMissing.push("ai");
      if (nextMissing.length === 0) {
        setOpen(false);
      } else if (!shownRef.current) {
        shownRef.current = true;
        setMissing(nextMissing);
        setOpen(true);
      }
    });

    return () => { active = false; setChecking(false); };
  }, [activePriorityPrompt, currentLocalDay, isSettingsPage, remindLaterUntil, settings.general.aiProviderReminderEnabled, settings.general.notificationPopupsEnabled, settings.general.setupReminderEnabled, suspended, user.id, user.role]);

  function remindLater(reminder: SetupReminderId): void {
    shownRef.current = true;
    setRemindLaterUntil((current) => ({ ...current, [reminder]: Date.now() + REMIND_LATER_DELAY_MS }));
    setOpen(false);
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
    shownRef.current = true;
    setOpen(false);
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
      shownRef.current = false;
      setOpen(false);
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
    shownRef.current = false;
    setOpen(false);
  };

  const disableCredentialReminder = async () => {
    if (!priorityPrompt) return;
    setSaving(true);
    setSaveError("");
    try {
      const { settings: savedSettings } = await saveSettings("general", { ...settings.general, defaultAdminCredentialReminderEnabled: false });
      onSettingsChange(savedSettings);
      shownRef.current = false;
      setOpen(false);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openReminderSettings = (section: "ai" | "workspace") => {
    setOpen(false);
    shownRef.current = false;
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
            <Button type="primary" disabled={saving} onClick={() => openReminderSettings("workspace")}>去配置存储</Button>
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
