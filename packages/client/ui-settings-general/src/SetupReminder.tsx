/**
 * 功能：提示用户完成首次配置。
 * 作用：独立检查 AI 与 SteamCMD 配置并管理提醒弹窗状态，避免弹窗交互触发整个工作台重新渲染。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings-general/src/setup-reminder.ts、packages/client/connection/src/api.ts、packages/client/ui-layout/src/workbench.css。
 */
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import { getErrorMessage, hasAdminAccess, loadAiAccounts, loadProjectStorageLocations, loadSteamcmdSettings, saveProjectContentDirectory, saveSettings, type ProjectStorageLocations, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { getSetupReminderLocalDay, isCredentialReminderSnoozedToday, isSetupReminderSnoozedToday, setCredentialReminderSnoozedToday, setSetupReminderSnoozedToday } from "./setup-reminder.js";

interface SetupReminderProps {
  user: User;
  settings: UserSettings;
  isSettingsPage: boolean;
  suspended: boolean;
  onSettingsChange: (settings: UserSettings) => void;
  onOpenSettings: (section: "ai" | "configuration" | "workspace") => void;
  priorityPrompt?: SetupReminderPrompt | null;
}

interface SetupReminderPrompt {
  introTitle?: string;
  introDescription?: string;
  title: string;
  description: string;
  action: string;
  icon?: WorkbenchIconName;
  onAction: () => void;
  onDismiss: () => void;
  onSnoozedTodayChange: (snoozed: boolean) => void;
}

const SETUP_REMINDER_COPY: Record<"storage" | "steamcmd" | "ai", { title: string; description: string; action: string; icon: WorkbenchIconName; section: "ai" | "configuration" | "workspace" }> = {
  storage: { title: "选择内容数据存储位置", description: "此选择只决定游戏、小说和漫剧内容写入哪个 data 目录。默认位置在 LFAA 用户目录下；系统推荐会使用当前项目或安装目录下的 data。账户、模型配置、会话和插件位置不受影响。", action: "去配置存储", icon: "folder", section: "workspace" },
  steamcmd: { title: "配置 SteamCMD", description: "设置安装工具与游戏目录，开始管理 Steam 游戏。", action: "去配置 SteamCMD", icon: "settings", section: "configuration" },
  ai: { title: "配置 AI 模型", description: "添加并启用一个模型服务，即可开始使用小鱼智能体。", action: "去配置模型", icon: "spark", section: "ai" }
};

export function SetupReminder({ user, settings, isSettingsPage, suspended, onSettingsChange, onOpenSettings, priorityPrompt = null }: SetupReminderProps) {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState<Array<"steamcmd" | "ai" | "storage">>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storageLocations, setStorageLocations] = useState<ProjectStorageLocations | null>(null);
  const [currentLocalDay, setCurrentLocalDay] = useState(() => getSetupReminderLocalDay());
  const shownRef = useRef(false);
  const currentReminder = missing[0] ? SETUP_REMINDER_COPY[missing[0]] : null;
  const activePriorityPrompt = priorityPrompt
    && settings.general.notificationPopupsEnabled
    && settings.general.defaultAdminCredentialReminderEnabled
    && !isCredentialReminderSnoozedToday(user.id, currentLocalDay)
    ? priorityPrompt
    : null;
  const introTitle = activePriorityPrompt?.introTitle ?? "欢迎使用 LFAA";
  const introDescription = activePriorityPrompt ? activePriorityPrompt.introDescription : "完成一项配置，就可以继续使用。";
  const promptTitle = activePriorityPrompt?.title ?? currentReminder?.title;
  const promptDescription = activePriorityPrompt?.description ?? currentReminder?.description;
  const promptAction = activePriorityPrompt?.action ?? currentReminder?.action;

  useEffect(() => {
    // 提醒组件保持挂载时跨过本地午夜，允许新的一天重新检查。
    const timer = window.setInterval(() => {
      const today = getSetupReminderLocalDay();
      setCurrentLocalDay((current) => current === today ? current : today);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    shownRef.current = false;
  }, [currentLocalDay, user.id]);

  useEffect(() => {
    if (priorityPrompt) priorityPrompt.onSnoozedTodayChange(isCredentialReminderSnoozedToday(user.id, currentLocalDay));
  }, [currentLocalDay, priorityPrompt, user.id]);

  useEffect(() => {
    if (!settings.general.notificationPopupsEnabled) {
      shownRef.current = false;
      setOpen(false);
      return;
    }
    if (suspended) {
      shownRef.current = false;
      setOpen(false);
      return;
    }
    if (!settings.general.setupReminderEnabled || isSettingsPage || isSetupReminderSnoozedToday(user.id, currentLocalDay)) {
      setOpen(false);
      return;
    }

    let active = true;
    const steamcmdRequest = hasAdminAccess(user.role) ? loadSteamcmdSettings() : Promise.resolve(null);
    const storageRequest = hasAdminAccess(user.role) ? loadProjectStorageLocations() : Promise.resolve(null);
    void Promise.allSettled([loadAiAccounts(), steamcmdRequest, storageRequest]).then(([accountsResult, steamcmdResult, storageResult]) => {
      if (!active) return;
      const nextMissing: Array<"steamcmd" | "ai" | "storage"> = [];
      if (storageResult.status === "fulfilled" && storageResult.value) {
        setStorageLocations(storageResult.value.settings);
        if (!storageResult.value.configured) nextMissing.push("storage");
      }
      if (accountsResult.status === "fulfilled" && accountsResult.value.accounts.length === 0) nextMissing.push("ai");
      if (steamcmdResult.status === "fulfilled" && steamcmdResult.value) {
        const { configurationDefaultsConfigured, storageDefaultsConfigured, nodes } = steamcmdResult.value;
        const hasConfiguredDefaults = configurationDefaultsConfigured && storageDefaultsConfigured;
        const hasConfiguredNode = nodes.some((node) =>
          (configurationDefaultsConfigured || node.configurationConfigured)
          && (storageDefaultsConfigured || node.storageConfigured)
        );
        if (!hasConfiguredDefaults && !hasConfiguredNode) nextMissing.push("steamcmd");
      }
      if (nextMissing.length === 0) {
        setOpen(false);
      } else if (!shownRef.current) {
        shownRef.current = true;
        setMissing(nextMissing);
        setOpen(true);
      }
    });

    return () => { active = false; };
  }, [currentLocalDay, isSettingsPage, settings.general.notificationPopupsEnabled, settings.general.setupReminderEnabled, suspended, user.id, user.role]);

  const dismissForToday = () => {
    // 浏览器不允许本地存储时，当前组件状态仍避免再次弹出。
    setSetupReminderSnoozedToday(user.id, currentLocalDay);
    shownRef.current = true;
    setOpen(false);
  };

  const disableReminder = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const { settings: savedSettings } = await saveSettings("general", { ...settings.general, setupReminderEnabled: false });
      onSettingsChange(savedSettings);
      shownRef.current = true;
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
    priorityPrompt.onSnoozedTodayChange(true);
  };

  const disableCredentialReminder = async () => {
    if (!priorityPrompt) return;
    setSaving(true);
    setSaveError("");
    try {
      const { settings: savedSettings } = await saveSettings("general", { ...settings.general, defaultAdminCredentialReminderEnabled: false });
      onSettingsChange(savedSettings);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const chooseContentLocation = async (useRecommended: boolean) => {
    if (!currentReminder || missing[0] !== "storage") return;
    setSaving(true);
    setSaveError("");
    try {
      const { settings: locations } = await loadProjectStorageLocations();
      const directory = useRecommended ? locations.recommendedContentDirectory : locations.defaultContentDirectory;
      const result = await saveProjectContentDirectory(directory);
      if (!result.configured) throw new Error("内容存储位置尚未保存，请重试。");
      setStorageLocations(result.settings);
      shownRef.current = true;
      setMissing(current => current.filter(item => item !== "storage"));
      setOpen(false);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      rootClassName={activePriorityPrompt ? "setup-reminder-modal setup-reminder-modal--priority" : "setup-reminder-modal"}
      title={(
        <div className="setup-reminder-intro">
          <span className="setup-reminder-intro__icon" aria-hidden="true"><WorkbenchIcon name={activePriorityPrompt?.icon ?? currentReminder?.icon ?? "spark"} size={22} /></span>
          <Typography.Title level={5} className="setup-reminder-intro__title">{introTitle}</Typography.Title>
          {introDescription ? <Typography.Paragraph className="setup-reminder-intro__description">{introDescription}</Typography.Paragraph> : null}
        </div>
      )}
      open={settings.general.notificationPopupsEnabled && (Boolean(activePriorityPrompt) || open)}
      onCancel={() => setOpen(false)}
      closable={!activePriorityPrompt}
      maskClosable={!activePriorityPrompt}
      keyboard={!activePriorityPrompt}
      getContainer={() => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body}
      footer={activePriorityPrompt
        ? <Space wrap>
          <Button disabled={saving} onClick={dismissCredentialReminderForToday}>今日不再提醒</Button>
          <Button disabled={saving} onClick={activePriorityPrompt.onDismiss}>稍后再说</Button>
        </Space>
        : missing[0] === "storage"
          ? <Space wrap><Button disabled={saving} onClick={() => setOpen(false)}>稍后再说</Button></Space>
        : <Space wrap>
          <Button disabled={saving} onClick={dismissForToday}>今日不再提醒</Button>
          <Button loading={saving} onClick={() => void disableReminder()}>不再提醒</Button>
          <Button disabled={saving} onClick={() => setOpen(false)}>稍后再说</Button>
        </Space>}
      centered
      width={activePriorityPrompt ? 640 : 480}
    >
      {saveError ? <Alert type="error" showIcon message={saveError} /> : null}
      {promptTitle && promptDescription && promptAction ? <div className="setup-reminder-card">
        <Typography.Title level={4} className="setup-reminder-card__title">{promptTitle}</Typography.Title>
        <Typography.Paragraph className="setup-reminder-card__description">{promptDescription}</Typography.Paragraph>
        {missing[0] === "storage" && !activePriorityPrompt && storageLocations ? <div className="setup-reminder-card__locations">
          <div><Typography.Text strong>不更改</Typography.Text><Typography.Text code>{storageLocations.defaultContentDirectory}</Typography.Text></div>
          <div><Typography.Text strong>系统推荐</Typography.Text><Typography.Text code>{storageLocations.recommendedContentDirectory}</Typography.Text></div>
        </div> : null}
        {missing[0] === "storage" && !activePriorityPrompt ? <Space wrap className="setup-reminder-card__action">
          <Button disabled={saving} onClick={() => void chooseContentLocation(false)}>不更改</Button>
          <Button type="primary" loading={saving} onClick={() => void chooseContentLocation(true)}>更改为系统推荐</Button>
          <Button disabled={saving} onClick={() => { setOpen(false); onOpenSettings("workspace"); }}>自定义位置</Button>
        </Space> : activePriorityPrompt ? <>
          <Space wrap className="setup-reminder-card__actions">
            <Button type="primary" size="large" onClick={() => {
              setOpen(false);
              activePriorityPrompt.onAction();
            }}>更改</Button>
            <Button loading={saving} disabled={saving} onClick={() => void disableCredentialReminder()}>不更改</Button>
          </Space>
          <Typography.Text className="setup-reminder-card__choice-note" type="secondary">不更改会保留当前登录凭据，并关闭后续提醒；更改会打开安全设置，不会自动修改。</Typography.Text>
        </> : <Button type="primary" size="large" className="setup-reminder-card__action" onClick={() => {
          setOpen(false);
          shownRef.current = false;
          if (currentReminder) onOpenSettings(currentReminder.section);
        }}>{promptAction}</Button>}
      </div> : null}
    </Modal>
  );
}
