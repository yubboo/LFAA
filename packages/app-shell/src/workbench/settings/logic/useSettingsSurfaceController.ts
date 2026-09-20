/** Settings 页面显隐与 active section 的唯一 Owner。 */
import { useCallback,useState } from "react";
import type { SettingsSectionId } from "../contracts/settings.types";
export function useSettingsSurfaceController(){
  const [surface,setSurface]=useState<"workbench"|"settings">("workbench");
  const [settingsSection,setSettingsSection]=useState<SettingsSectionId>("general");
  const openSettings=useCallback((section:SettingsSectionId="general")=>{setSettingsSection(section);setSurface("settings");},[]);
  const closeSettings=useCallback(()=>setSurface("workbench"),[]);
  return {surface,settingsSection,setSettingsSection,openSettings,closeSettings};
}
export type SettingsSurfaceController=ReturnType<typeof useSettingsSurfaceController>;
