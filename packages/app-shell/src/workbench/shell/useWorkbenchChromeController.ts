/**
 * Workbench 几何/Chrome 唯一 Owner：layout metrics、Dock 开合、左栏共享宽度与 Hover Preview。
 * Resize/Snap 算法仍归 @lfaa/ui；这里只保存受控事实与持久化。
 */
import { useCallback,useEffect,useRef,useState,type RefObject } from "react";
import { resolveWorkbenchLayoutMetrics,type WorkbenchLayoutMetrics } from "@lfaa/ui";
import type { LayoutMode } from "../contracts";
const CHROME_KEY="lfaa.workbench.chrome.v2";
const LEFT_PANE_WIDTH_KEY="lfaa.shell.left-pane-width.v1";
const LEGACY_WORKBENCH_LAYOUT_KEY="lfaa.workbench.layout.v5";
export interface ChromeState { leftCollapsed:boolean; rightCollapsed:boolean; terminalOpen:boolean; }
function initialLayoutMetrics():WorkbenchLayoutMetrics { return typeof window==="undefined"?resolveWorkbenchLayoutMetrics(1440,900):resolveWorkbenchLayoutMetrics(window.innerWidth,window.innerHeight); }
function useLayoutMetrics(containerRef:RefObject<HTMLDivElement|null>):WorkbenchLayoutMetrics {
  const [metrics,setMetrics]=useState<WorkbenchLayoutMetrics>(initialLayoutMetrics);
  useEffect(()=>{const element=containerRef.current;if(!element)return;let frame:number|null=null;const update=()=>{if(frame!==null)window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(()=>{frame=null;const rect=element.getBoundingClientRect();const next=resolveWorkbenchLayoutMetrics(rect.width,rect.height);setMetrics((current)=>{const same=current.mode===next.mode&&current.containerWidth===next.containerWidth&&current.containerHeight===next.containerHeight&&current.left.min===next.left.min&&current.left.initial===next.left.initial&&current.right.min===next.right.min&&current.right.initial===next.right.initial&&current.bottom.min===next.bottom.min&&current.bottom.initial===next.bottom.initial&&current.minCenterWidth===next.minCenterWidth&&current.snapHysteresis===next.snapHysteresis;return same?current:next;});});};update();const observer=new ResizeObserver(update);observer.observe(element);return()=>{if(frame!==null)window.cancelAnimationFrame(frame);observer.disconnect();};},[containerRef]);
  return metrics;
}
function initialLeftPaneWidth(limits:WorkbenchLayoutMetrics["left"]):number { const clamp=(value:number)=>Math.min(limits.max,Math.max(limits.min,value)); if(typeof window==="undefined")return limits.initial; const shared=Number(window.localStorage.getItem(LEFT_PANE_WIDTH_KEY));if(Number.isFinite(shared)&&shared>0)return clamp(shared);try{const raw=window.localStorage.getItem(LEGACY_WORKBENCH_LAYOUT_KEY);if(raw){const legacy=JSON.parse(raw) as {leftWidth?:unknown};const width=Number(legacy.leftWidth);if(Number.isFinite(width)&&width>0)return clamp(width);}}catch{}return limits.initial; }
function initialChrome(mode:LayoutMode):ChromeState { if(typeof window==="undefined")return mode==="mobile"?{leftCollapsed:true,rightCollapsed:true,terminalOpen:false}:mode==="compact"?{leftCollapsed:false,rightCollapsed:true,terminalOpen:true}:{leftCollapsed:false,rightCollapsed:false,terminalOpen:true};try{const raw=window.localStorage.getItem(CHROME_KEY);if(!raw)throw new Error("empty");const parsed=JSON.parse(raw) as Partial<ChromeState>;const restored={leftCollapsed:Boolean(parsed.leftCollapsed),rightCollapsed:Boolean(parsed.rightCollapsed),terminalOpen:parsed.terminalOpen===undefined?true:Boolean(parsed.terminalOpen)};if(mode==="mobile")return{...restored,leftCollapsed:true,rightCollapsed:true,terminalOpen:false};if(mode==="compact")return{...restored,rightCollapsed:true};return restored;}catch{return mode==="mobile"?{leftCollapsed:true,rightCollapsed:true,terminalOpen:false}:mode==="compact"?{leftCollapsed:false,rightCollapsed:true,terminalOpen:true}:{leftCollapsed:false,rightCollapsed:false,terminalOpen:true};} }
export function useWorkbenchChromeController(){
  const stageRef=useRef<HTMLDivElement|null>(null);const layout=useLayoutMetrics(stageRef);const layoutMode=layout.mode;
  const [chrome,setChrome]=useState<ChromeState>(()=>initialChrome(layoutMode));
  const [leftPaneWidth,setLeftPaneWidth]=useState(()=>initialLeftPaneWidth(layout.left));
  const [leftPreviewOpen,setLeftPreviewOpen]=useState(false);const previewCloseTimerRef=useRef<number|null>(null);const appliedLayoutModeRef=useRef<LayoutMode|null>(layoutMode);
  const clearPreviewTimer=useCallback(()=>{if(previewCloseTimerRef.current!==null){window.clearTimeout(previewCloseTimerRef.current);previewCloseTimerRef.current=null;}},[]);
  const openLeftPreview=useCallback(()=>{if(!chrome.leftCollapsed||layoutMode==="mobile")return;clearPreviewTimer();setLeftPreviewOpen(true);},[chrome.leftCollapsed,clearPreviewTimer,layoutMode]);
  const closeLeftPreview=useCallback((delay=120)=>{clearPreviewTimer();if(!chrome.leftCollapsed){setLeftPreviewOpen(false);return;}previewCloseTimerRef.current=window.setTimeout(()=>{setLeftPreviewOpen(false);previewCloseTimerRef.current=null;},delay);},[chrome.leftCollapsed,clearPreviewTimer]);
  useEffect(()=>{if(appliedLayoutModeRef.current===layoutMode)return;appliedLayoutModeRef.current=layoutMode;clearPreviewTimer();setLeftPreviewOpen(false);if(layoutMode==="compact")setChrome((value)=>({...value,rightCollapsed:true}));else if(layoutMode==="mobile")setChrome((value)=>({...value,leftCollapsed:true,rightCollapsed:true,terminalOpen:false}));},[clearPreviewTimer,layoutMode]);
  useEffect(()=>{window.localStorage.setItem(LEFT_PANE_WIDTH_KEY,String(leftPaneWidth));},[leftPaneWidth]);
  useEffect(()=>{window.localStorage.setItem(CHROME_KEY,JSON.stringify(chrome));},[chrome]);
  useEffect(()=>{if(!chrome.leftCollapsed&&leftPreviewOpen)setLeftPreviewOpen(false);},[chrome.leftCollapsed,leftPreviewOpen]);
  useEffect(()=>()=>clearPreviewTimer(),[clearPreviewTimer]);
  const toggleLeft=useCallback(()=>{clearPreviewTimer();setLeftPreviewOpen(false);setChrome((value)=>({...value,leftCollapsed:!value.leftCollapsed}));},[clearPreviewTimer]);
  const toggleRight=useCallback(()=>setChrome((value)=>({...value,rightCollapsed:!value.rightCollapsed})),[]);
  const toggleTerminal=useCallback(()=>setChrome((value)=>({...value,terminalOpen:!value.terminalOpen})),[]);
  const closeTerminal=useCallback(()=>setChrome((value)=>({...value,terminalOpen:false})),[]);
  const setLeftCollapsed=useCallback((leftCollapsed:boolean)=>{clearPreviewTimer();setLeftPreviewOpen(false);setChrome((value)=>value.leftCollapsed===leftCollapsed?value:{...value,leftCollapsed});},[clearPreviewTimer]);
  const setRightCollapsed=useCallback((rightCollapsed:boolean)=>setChrome((value)=>value.rightCollapsed===rightCollapsed?value:{...value,rightCollapsed}),[]);
  const setTerminalOpen=useCallback((terminalOpen:boolean)=>setChrome((value)=>value.terminalOpen===terminalOpen?value:{...value,terminalOpen}),[]);
  return {stageRef,layout,layoutMode,chrome,leftPaneWidth,setLeftPaneWidth,leftPreviewOpen,openLeftPreview,closeLeftPreview,clearPreviewTimer,toggleLeft,toggleRight,toggleTerminal,closeTerminal,setLeftCollapsed,setRightCollapsed,setTerminalOpen};
}
export type WorkbenchChromeController=ReturnType<typeof useWorkbenchChromeController>;
