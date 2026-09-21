/** Shell Profile / Theme / Update Overlay 视图。状态由 useWorkbenchOverlayController 提供。 */
import { ThemeModeMenu,type ThemePreference } from "@lfaa/ui";
import { UserMenu } from "./UserMenu";
import { ProfileBar } from "#workbench/left";
import type { LayoutMode,ResolvedTheme } from "#workbench/contracts";
import type { WorkbenchOverlayController } from "../logic/useWorkbenchOverlayController";
import styles from "../styles/WorkbenchOverlays.module.css";
export function WorkbenchOverlays({controller,layoutMode,resolvedTheme,themePreference,displayName,subtitle,onThemePreferenceChange,onOpenSettings,onOpenAppHub,onLogout}:{controller:WorkbenchOverlayController;layoutMode:LayoutMode;resolvedTheme:ResolvedTheme;themePreference:ThemePreference;displayName:string;subtitle:string;onThemePreferenceChange:(value:ThemePreference)=>void;onOpenSettings:()=>void;onOpenAppHub?:()=>void;onLogout?:()=>void}){
  return <>
    {controller.profileMenuOpen?<div className={styles.profileLayer} data-theme={resolvedTheme} data-layout-mode={layoutMode}><button className={`${styles.backdrop} ${styles.profileBackdrop}`} type="button" aria-label="关闭个人中心" onClick={controller.closeProfile}/><div className={styles.profileShell}><UserMenu displayName={displayName} subtitle={subtitle} onOpenSettings={()=>{controller.closeProfile();onOpenSettings();}} {...(onOpenAppHub?{onOpenAppHub:()=>{controller.closeProfile();onOpenAppHub();}}:{})} {...(onLogout?{onLogout:()=>{controller.closeProfile();onLogout();}}:{})} onRequestUpdate={()=>{controller.closeProfile();controller.requestUpdate();}}/><ProfileBar variant="overlay" resolvedTheme={resolvedTheme} themePreference={themePreference} displayName={displayName} subtitle={subtitle} onOpenProfile={controller.closeProfile} onOpenThemeMenu={()=>{controller.closeProfile();controller.openThemeMenu();}} onRequestUpdate={()=>{controller.closeProfile();controller.requestUpdate();}}/></div></div>:null}
    {controller.themeMenuOpen?<div className={styles.themeLayer} data-layout-mode={layoutMode}><button className={`${styles.backdrop} ${styles.themeBackdrop}`} type="button" aria-label="关闭主题菜单" onClick={controller.closeThemeMenu}/><div className={styles.themeAnchor}><ThemeModeMenu value={themePreference} onChange={(value)=>{onThemePreferenceChange(value);controller.closeThemeMenu();}}/></div></div>:null}
    {controller.updateNoticeOpen?<div className={styles.updateToast} role="status">当前 Web 开发宿主未接入自动更新；正式更新仍由 Update Adapter / LFAA-Update 管理。</div>:null}
  </>;
}
