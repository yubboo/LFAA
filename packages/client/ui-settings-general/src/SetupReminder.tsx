/**
 * 功能：提示用户完成首次配置。
 * 作用：独立检查 AI 与 SteamCMD 配置并管理提醒弹窗状态，避免弹窗交互触发整个工作台重新渲染。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings-general/src/setup-reminder.ts、packages/client/connection/src/api.ts、packages/client/ui-layout/src/workbench.css。
 */
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import { getErrorMessage, hasAdminAccess, loadAiAccounts, loadDataDirectorySettings, loadSteamcmdSettings, saveSettings, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { getSetupReminderLocalDay, isSetupReminderSnoozedToday, setSetupReminderSnoozedToday } from "./setup-reminder.js";

interface SetupReminderProps {
  user: User;
  settings: UserSettings;
  isSettingsPage: boolean;
  onSettingsChange: (settings: UserSettings) => void;
  onOpenSettings: (section: "ai" | "configuration" | "workspace") => void;
}

const SETUP_REMINDER_COPY: Record<"storage" | "steamcmd" | "ai", { title: string; description: string; action: string; icon: WorkbenchIconName; section: "ai" | "configuration" | "workspace" }> = {
  storage: { title: "设置数据存储位置", description: "选择适合你的数据目录，随时可以在配置中心迁移。", action: "去配置存储", icon: "folder", section: "workspace" },
  steamcmd: { title: "配置 SteamCMD", description: "设置安装工具与游戏目录，开始管理 Steam 游戏。", action: "去配置 SteamCMD", icon: "settings", section: "configuration" },
  ai: { title: "配置 AI 模型", description: "添加并启用一个模型服务，即可开始使用小鱼智能体。", action: "去配置模型", icon: "spark", section: "ai" }
};

export function SetupReminder({ user, settings, isSettingsPage, onSettingsChange, onOpenSettings }: SetupReminderProps) {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState<Array<"steamcmd" | "ai" | "storage">>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [currentLocalDay, setCurrentLocalDay] = useState(() => getSetupReminderLocalDay());
  const shownRef = useRef(false);
  const currentReminder = missing[0] ? SETUP_REMINDER_COPY[missing[0]] : null;

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
    if (!settings.general.setupReminderEnabled || isSettingsPage || isSetupReminderSnoozedToday(user.id, currentLocalDay)) {
      setOpen(false);
      return;
    }

    let active = true;
    const steamcmdRequest = hasAdminAccess(user.role) ? loadSteamcmdSettings() : Promise.resolve(null);
    const storageRequest = user.role === "super_admin" ? loadDataDirectorySettings() : Promise.resolve(null);
    void Promise.allSettled([loadAiAccounts(), steamcmdRequest, storageRequest]).then(([accountsResult, steamcmdResult, storageResult]) => {
      if (!active) return;
      const nextMissing: Array<"steamcmd" | "ai" | "storage"> = [];
      if (storageResult.status === "fulfilled" && storageResult.value && !storageResult.value.settings.configured) nextMissing.push("storage");
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
  }, [currentLocalDay, isSettingsPage, settings.general.setupReminderEnabled, user.id, user.role]);

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

  return (
    <Modal
      rootClassName="setup-reminder-modal"
      title={(
        <div className="setup-reminder-intro">
          <span className="setup-reminder-intro__icon" aria-hidden="true"><WorkbenchIcon name={currentReminder?.icon ?? "spark"} size={22} /></span>
          <Typography.Title level={5} className="setup-reminder-intro__title">欢迎使用 LFAA</Typography.Title>
          <Typography.Paragraph className="setup-reminder-intro__description">完成一项配置，就可以继续使用。</Typography.Paragraph>
        </div>
      )}
      open={open}
      onCancel={() => setOpen(false)}
      getContainer={() => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body}
      footer={<Space wrap>
        <Button disabled={saving} onClick={dismissForToday}>今日不再提醒</Button>
        <Button loading={saving} onClick={() => void disableReminder()}>不再提醒</Button>
        <Button disabled={saving} onClick={() => setOpen(false)}>稍后再说</Button>
      </Space>}
      centered
      width={480}
    >
      {saveError ? <Alert type="error" showIcon message={saveError} /> : null}
      {currentReminder ? <div className="setup-reminder-card">
        <Typography.Title level={4} className="setup-reminder-card__title">{currentReminder.title}</Typography.Title>
        <Typography.Paragraph className="setup-reminder-card__description">{currentReminder.description}</Typography.Paragraph>
        <Button type="primary" size="large" className="setup-reminder-card__action" onClick={() => { setOpen(false); shownRef.current = false; onOpenSettings(currentReminder.section); }}>{currentReminder.action}</Button>
      </div> : null}
    </Modal>
  );
}
