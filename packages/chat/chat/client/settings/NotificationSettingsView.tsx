// 设置中心「通知」页：装配桌面通知权限、轮次完成/权限/问题提醒、会话状态徽标与提示音。
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../store/chat-store";
import type { GeneralSettingsConfig } from "./general-settings-client";
import type { ChatLocaleMessages } from "../locales";
import { NotificationSettingsGroup } from "./NotificationSettingsGroup";
import { SettingGroupCard } from "@lfaa/ui-primitives/client";
import { settingsStyles as styles } from "@lfaa/ui-primitives/client";

/** 通知设置页；所有开关写入 Host 的通用设置，通知触发逻辑在聊天 Store 中读取同一份配置。 */
export function NotificationSettingsView({
  locale,
  store,
}: {
  locale: ChatLocaleMessages;
  store: ChatClientStore;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const cfg = state.generalSettings;
  const isZh = locale.isZh;
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void store.refreshGeneralSettings().catch(() => {});
  }, [store]);

  const patchSetting = useCallback(
    async (patch: Partial<GeneralSettingsConfig>) => {
      setNotice("");
      try {
        await store.updateGeneralSettings(patch);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : String(err));
      }
    },
    [store],
  );

  return (
    <section className={styles.root} aria-label={isZh ? "通知" : "Notifications"}>
      <h1 className={styles.pageTitle}>{isZh ? "通知" : "Notifications"}</h1>
      <p className={styles.rowDesc}>
        {isZh ? "选择接收哪些通知，以及如何接收。" : "Choose which notifications you get and how you get them."}
      </p>

      {notice && <StatusBanner tone="info" message={notice} onDismiss={() => setNotice("")} />}

      <SettingGroupCard title={isZh ? "桌面通知" : "Desktop notifications"}>
        <NotificationSettingsGroup isZh={isZh} cfg={cfg} onPatch={patchSetting} />
      </SettingGroupCard>
    </section>
  );
}