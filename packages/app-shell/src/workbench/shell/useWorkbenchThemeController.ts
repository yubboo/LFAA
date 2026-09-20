/** Theme preference / system dark 的唯一 Workbench Owner。 */
import { useEffect,useState } from "react";
import type { ThemePreference } from "@lfaa/ui";
import type { ResolvedTheme } from "../contracts";
const THEME_KEY="lfaa.workbench.theme.v1";
function initialThemePreference():ThemePreference { if(typeof window==="undefined")return "system"; const stored=window.localStorage.getItem(THEME_KEY); return stored==="system"||stored==="light"||stored==="dark"?stored:"system"; }
function initialSystemDark():boolean { return typeof window!=="undefined"&&window.matchMedia("(prefers-color-scheme: dark)").matches; }
export function useWorkbenchThemeController(){
  const [themePreference,setThemePreference]=useState<ThemePreference>(initialThemePreference);
  const [systemDark,setSystemDark]=useState(initialSystemDark);
  const resolvedTheme:ResolvedTheme=themePreference==="system"?(systemDark?"dark":"light"):themePreference;
  useEffect(()=>{window.localStorage.setItem(THEME_KEY,themePreference);},[themePreference]);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const onChange=(event:MediaQueryListEvent)=>setSystemDark(event.matches);setSystemDark(media.matches);media.addEventListener("change",onChange);return()=>media.removeEventListener("change",onChange);},[]);
  return {themePreference,setThemePreference,resolvedTheme};
}
export type WorkbenchThemeController=ReturnType<typeof useWorkbenchThemeController>;
