// 渲染设置中心「常规」主页面：权限卡片、常规/编辑器/通知子分组装配与开源许可证弹窗。
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { IconX } from "@tabler/icons-react";
import { StatusBanner } from "@lfaa/ui-primitives/client";
import type { ChatClientStore } from "../chat-store";
import type { OpenSourcePackageInfo } from "../chat-types";
import type { GeneralSettingsConfig } from "../general-settings-client";
import type { ChatLocaleMessages } from "../locales";
import { SettingGroupCard, SettingRow, SettingSwitch } from "./GeneralSettingsControls";
import { GeneralSettingsGeneralGroup } from "./GeneralSettingsGeneralGroup";
import { GeneralSettingsSecondary } from "./GeneralSettingsSecondary";
import styles from "./GeneralSettingsView.module.css";

export function GeneralSettingsView({
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
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [licenses, setLicenses] = useState<OpenSourcePackageInfo[]>([]);
  const [confettiActive, setConfettiActive] = useState(false);

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

  const pickAndSaveFolder = async (field: "outsideProjectFolder" | "defaultProjectsFolder", labelZh: string, labelEn: string) => {
    setNotice("");
    try {
      const picked = await store.pickStorageFolder();
      if (picked.error) {
        setNotice(picked.error);
        return;
      }
      if (!picked.cancelled && picked.path) {
        await patchSetting({ [field]: picked.path });
        setNotice(isZh ? `已更新${labelZh}：${picked.path}` : `Updated ${labelEn}: ${picked.path}`);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenLicenses = async () => {
    setLicensesOpen(true);
    try {
      const list = await store.getOpenSourceLicenses();
      setLicenses(list);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const fullAccessEnabled = state.permissionMode === "full";

  return (
    <section className={styles.root} aria-label={isZh ? "常规" : "General"}>
      <h1 className={styles.pageTitle}>{isZh ? "常规" : "General"}</h1>

      {notice && (
        <StatusBanner
          tone="info"
          message={notice}
          onDismiss={() => setNotice("")}
        />
      )}

      <SettingGroupCard title={isZh ? "权限" : "Permissions"}>
        <SettingRow
          title={isZh ? "默认权限" : "Default Permissions"}
          description={
            isZh
              ? "默认情况下，LFAA 可以读取和编辑其工作空间中的文件。需要时，它会请求批准再执行额外访问权限。"
              : "By default, LFAA reads and edits inside the workspace and requests approval for extra access."
          }
          control={(
            <SettingSwitch
              checked={!fullAccessEnabled}
              label={isZh ? "默认权限" : "Default Permissions"}
              onChange={(checked) => store.setPermissionMode(checked ? "ask" : "full")}
            />
          )}
        />
        <SettingRow
          title={isZh ? "完整访问权限" : "Full Access"}
          description={(
            <>
              {isZh
                ? "当 LFAA 以完整访问权限运行时，它无需你的批准即可编辑你电脑上的任何文件，并运行可访问网络的命令。这会显著增加数据丢失、泄露或意外行为的风险。"
                : "Running with Full Access lets LFAA edit any file and run commands without confirmation, increasing data-loss risks. "}
              <button
                type="button"
                className={styles.inlineLinkBtn}
                onClick={() => setNotice(locale.permissionLearnMoreText)}
              >
                {locale.learnMore}
              </button>
            </>
          )}
          control={(
            <SettingSwitch
              checked={fullAccessEnabled}
              label={isZh ? "完整访问权限" : "Full Access"}
              onChange={(checked) => store.setPermissionMode(checked ? "full" : "ask")}
            />
          )}
        />
      </SettingGroupCard>

      <GeneralSettingsGeneralGroup
        isZh={isZh}
        cfg={cfg}
        onPatch={(patch) => void patchSetting(patch)}
        onPickOutsideFolder={() => void pickAndSaveFolder("outsideProjectFolder", "项目外聊天目录", "out-of-project folder")}
        onPickDefaultProjectsFolder={() => void pickAndSaveFolder("defaultProjectsFolder", "默认新建项目目录", "default project folder")}
        onOpenLicenses={() => void handleOpenLicenses()}
        onShowNotice={setNotice}
      />

      <GeneralSettingsSecondary
        isZh={isZh}
        cfg={cfg}
        onPatch={(patch) => void patchSetting(patch)}
        onTriggerConfetti={() => {
          setConfettiActive(true);
          window.setTimeout(() => setConfettiActive(false), 1200);
        }}
      />

      {confettiActive && (
        <div className={styles.confettiBurst} role="status">
          <span className={styles.notice}>{isZh ? "已触发应用内庆祝特效" : "Celebration effect triggered"}</span>
        </div>
      )}

      {licensesOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={isZh ? "开源许可证" : "Open-source licenses"}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2 className={styles.groupTitle}>{isZh ? "开源依赖与许可证声明" : "Bundled Open-Source Dependencies"}</h2>
              <button
                type="button"
                className={styles.actionBtn}
                aria-label={isZh ? "关闭" : "Close"}
                onClick={() => setLicensesOpen(false)}
              >
                <IconX size={14} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.modalList}>
              {licenses.map((pkg) => (
                <div key={pkg.name} className={styles.licenseRow}>
                  <span>{pkg.name}</span>
                  <span>{pkg.version}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
