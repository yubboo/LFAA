/** Profile / Theme / Update transient overlay state Owner。 */
import { useCallback,useEffect,useState } from "react";
export function useWorkbenchOverlayController(){
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);const [themeMenuOpen,setThemeMenuOpen]=useState(false);const [updateNoticeOpen,setUpdateNoticeOpen]=useState(false);
  useEffect(()=>{if(!updateNoticeOpen)return;const timer=window.setTimeout(()=>setUpdateNoticeOpen(false),2600);return()=>window.clearTimeout(timer);},[updateNoticeOpen]);
  const closeMenus=useCallback(()=>{setProfileMenuOpen(false);setThemeMenuOpen(false);},[]);
  const openProfile=useCallback(()=>{setThemeMenuOpen(false);setProfileMenuOpen(true);},[]);
  const closeProfile=useCallback(()=>setProfileMenuOpen(false),[]);
  const openThemeMenu=useCallback(()=>{setProfileMenuOpen(false);setThemeMenuOpen(true);},[]);
  const closeThemeMenu=useCallback(()=>setThemeMenuOpen(false),[]);
  const requestUpdate=useCallback(()=>setUpdateNoticeOpen(true),[]);
  return {profileMenuOpen,themeMenuOpen,updateNoticeOpen,closeMenus,openProfile,closeProfile,openThemeMenu,closeThemeMenu,requestUpdate,setUpdateNoticeOpen};
}
export type WorkbenchOverlayController=ReturnType<typeof useWorkbenchOverlayController>;
