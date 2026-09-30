/**
 * 功能：提示用户完成首次配置。
 * 作用：独立检查 AI 与 SteamCMD 配置并管理提醒弹窗状态，避免弹窗交互触发整个工作台重新渲染。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings-general/src/setup-reminder.ts、packages/client/connection/src/api.ts、packages/client/ui-layout/src/workbench.css。
 */
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import { getErrorMessage, hasAdminAccess, loadAiAccounts, loadSteamcmdSettings, saveSettings, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { getSetupReminderLocalDay, isSetupReminderSnoozedToday, setSetupReminderSnoozedToday } from "./setup-reminder.js";

interface SetupReminderProps {
  user: User;
  settings: UserSettings;
  isSettingsPage: boolean;
  onSettingsChange: (settings: UserSettings) => void;
  onOpenSettings: (section: "ai" | "configuration") => void;
}

export function SetupReminder({ user, settings, isSettingsPage, onSettingsChange, onOpenSettings }: SetupReminderProps) {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState<Array<"steamcmd" | "ai">>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [currentLocalDay, setCurrentLocalDay] = useState(() => getSetupReminderLocalDay());
  const shownRef = useRef(false);

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
    void Promise.allSettled([loadAiAccounts(), steamcmdRequest]).then(([accountsResult, steamcmdResult]) => {
      if (!active) return;
      const nextMissing: Array<"steamcmd" | "ai"> = [];
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
          <Typography.Title level={5} className="setup-reminder-intro__title">完成首次配置</Typography.Title>
          <Typography.Paragraph className="setup-reminder-intro__description">这些配置完成后，本提醒会自动停止。也可以到“设置中心 → 通知”关闭首次配置提醒。</Typography.Paragraph>
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
      <div className="setup-reminder-list">
        {missing.includes("steamcmd") ? <div className="setup-reminder-list__item"><Typography.Text strong>SteamCMD 安装目录与游戏默认目录</Typography.Text><Button type="primary" size="small" onClick={() => { setOpen(false); onOpenSettings("configuration"); }}>前往配置</Button></div> : null}
        {missing.includes("ai") ? <div className="setup-reminder-list__item"><Typography.Text strong>AI 模型 API</Typography.Text><Button type="primary" size="small" onClick={() => { setOpen(false); onOpenSettings("ai"); }}>前往配置</Button></div> : null}
      </div>
    </Modal>
  );
}
