/** 左侧栏底部个人信息/主题/更新入口。Overlay 不归本模块。 */
import type { ThemePreference } from "@lfaa/ui";
import { WorkbenchIcon } from "#workbench/shared";
import type { ResolvedTheme } from "#workbench/contracts";
import { IconButton } from "#workbench/shared";
import styles from "../styles/ProfileBar.module.css";

export function ProfileBar({ resolvedTheme, themePreference, displayName, subtitle, onOpenProfile, onOpenThemeMenu, onRequestUpdate, variant = "sidebar" }: {
  resolvedTheme: ResolvedTheme;
  themePreference: ThemePreference;
  displayName: string;
  subtitle: string;
  onOpenProfile: () => void;
  onOpenThemeMenu: () => void;
  onRequestUpdate: () => void;
  variant?: "sidebar" | "overlay";
}) {
  const themeLabel = themePreference === "system" ? "跟随系统" : themePreference === "dark" ? "深色" : "浅色";
  const themeIcon = themePreference === "system" ? "monitor" : resolvedTheme === "dark" ? "moon" : "sun";
  return (
    <div className={`${styles.root}${variant === "overlay" ? ` ${styles.overlay}` : ""}`} data-ui="profile-bar">
      <button className={styles.main} type="button" onClick={onOpenProfile} aria-haspopup="dialog">
        <span className={styles.avatar}>{displayName.slice(0, 1).toUpperCase()}</span><span className={styles.text}><strong>{displayName}</strong><small>{subtitle}</small></span>
      </button>
      <div className={styles.actions}>
        <IconButton type="button" onClick={onRequestUpdate} aria-label="检查更新" title="检查更新"><WorkbenchIcon name="refresh" /></IconButton>
        <IconButton type="button" onClick={onOpenThemeMenu} aria-label={`主题：${themeLabel}`} title={`主题：${themeLabel}`}><WorkbenchIcon name={themeIcon} /></IconButton>
      </div>
    </div>
  );
}
