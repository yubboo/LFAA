/**
 * 桌面 Host 桥接类型与本机目录选择适配。
 */
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { NativeBrowserDownload, NativeBrowserDownloadSettings, NativeBrowserExtension, NativeBrowserInspection, NativeBrowserState } from "./browser-api.js";
import type { UserSettings } from "lfaa-util-values/src/settings-contract.js";



export interface DesktopUpdateRuntimeInfo {
  supported: boolean;
  currentVersion: string;
}


export interface DesktopUpdatePreferences {
  autoDownloadAndInstall: boolean;
}


export interface DesktopUpdateDownloadProgress {
  version: string;
  phase: "starting" | "downloading" | "cancelling";
  transferredBytes: number;
  totalBytes: number | null;
  percent: number | null;
  bytesPerSecond: number;
}


export interface DesktopAvailableUpdate {
  version: string;
  publishedAt: string;
  releaseNotes: string[];
}


export type DesktopUpdatePromptAction = "accept" | "defer" | "skip" | "install" | "later" | "dismiss";


export type DesktopUpdatePrompt =
  | {
      requestId: string;
      kind: "download" | "install";
      version: string;
      publishedAt: string;
      releaseNotes: string[];
      mandatory: boolean;
    }
  | {
      requestId: string;
      kind: "notice";
      title: string;
      message: string;
      detail?: string;
    };


export interface DesktopUpdateCheckResult {
  status: "unsupported" | "disabled" | "up-to-date" | "available" | "deferred" | "ignored" | "downloading" | "downloaded" | "error";
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string[];
  message?: string;
}


declare global {
  interface Window {
    lfaaDesktop?: {
      nativeBrowser: {
        getState: () => Promise<NativeBrowserState>;
        capturePreview: (id: string) => Promise<{ dataBase64: string; width: number; height: number } | null>;
        ensureTab: () => Promise<NativeBrowserState>;
        createTab: (url?: string) => Promise<NativeBrowserState>;
        selectTab: (id: string) => Promise<NativeBrowserState>;
        closeTab: (id: string) => Promise<NativeBrowserState>;
        navigate: (id: string, url: string) => Promise<NativeBrowserState>;
        back: (id: string) => Promise<NativeBrowserState>;
        forward: (id: string) => Promise<NativeBrowserState>;
        reload: (id: string) => Promise<NativeBrowserState>;
        stop: (id: string) => Promise<NativeBrowserState>;
        copyAddress: (id: string) => Promise<string>;
        find: (id: string, text: string, forward: boolean) => Promise<{ matches: number; activeMatch: number } | NativeBrowserState>;
        inspect: (id: string) => Promise<NativeBrowserInspection>;
        clearData: () => Promise<{ cleared: boolean }>;
        setPreferences: (preferences: UserSettings["browserUse"]) => Promise<{ applied: boolean }>;
        getDownloadSettings: () => Promise<NativeBrowserDownloadSettings>;
        chooseDownloadDirectory: () => Promise<NativeBrowserDownloadSettings>;
        useSystemDownloadDirectory: () => Promise<NativeBrowserDownloadSettings>;
        getDownloadHistory: () => Promise<NativeBrowserDownload[]>;
        removeDownloadHistory: (id: string) => Promise<{ deleted: boolean }>;
        clearDownloadHistory: () => Promise<{ cleared: boolean }>;
        getBrowserExtensions: () => Promise<NativeBrowserExtension[]>;
        chooseBrowserExtension: () => Promise<NativeBrowserExtension[]>;
        setBrowserExtensionEnabled: (id: string, enabled: boolean) => Promise<NativeBrowserExtension[]>;
        removeBrowserExtension: (id: string) => Promise<{ removed: boolean; extensions: NativeBrowserExtension[] }>;
        configureBrowserExtension: (id: string) => Promise<NativeBrowserState>;
        setZoom: (id: string, zoom: number) => Promise<NativeBrowserState>;
        print: (id: string) => Promise<void>;
        setBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
        setVisible: (visible: boolean) => Promise<void>;
        onState: (listener: (state: NativeBrowserState) => void) => () => void;
        onShortcut: (listener: (shortcut: "find" | "address") => void) => () => void;
      };
      mini: {
        open: (settings: UserSettings["mini"]) => Promise<{ opened: true }>;
        close: () => Promise<{ closed: true }>;
      };
      selectDataDirectory: () => Promise<string | null>;
      selectWorkspaceDirectory: () => Promise<string | null>;
      getUpdateRuntimeInfo: () => Promise<DesktopUpdateRuntimeInfo>;
      getUpdatePreferences: () => Promise<DesktopUpdatePreferences>;
      setAutoUpdateAndInstall: (enabled: boolean) => Promise<DesktopUpdatePreferences>;
      getUpdateAvailability: () => Promise<DesktopAvailableUpdate | null>;
      getUpdateDownloadProgress: () => Promise<DesktopUpdateDownloadProgress | null>;
      cancelUpdateDownload: () => Promise<boolean>;
      checkForUpdates: () => Promise<DesktopUpdateCheckResult>;
      onUpdateAvailable: (listener: (update: DesktopAvailableUpdate | null) => void) => () => void;
      onUpdateDownloadProgress: (listener: (progress: DesktopUpdateDownloadProgress | null) => void) => () => void;
      onUpdatePrompt: (listener: (prompt: DesktopUpdatePrompt) => void) => () => void;
      updatePromptUiReady: () => Promise<boolean>;
      updatePromptUiNotReady: () => Promise<boolean>;
      respondToUpdatePrompt: (requestId: string, action: DesktopUpdatePromptAction) => Promise<boolean>;
    };
  }
}



export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && (Boolean(window.lfaaDesktop) || isTauri());
}


export async function selectDesktopDataDirectory(): Promise<string | null> {
  if (window.lfaaDesktop) return window.lfaaDesktop.selectDataDirectory();
  if (!isTauri()) return null;
  const selectedDirectory = await open({ multiple: false, directory: true });
  return typeof selectedDirectory === "string" ? selectedDirectory : null;
}


export async function selectDesktopWorkspaceDirectory(): Promise<string | null> {
  if (window.lfaaDesktop) return window.lfaaDesktop.selectWorkspaceDirectory();
  if (!isTauri()) return null;
  const selectedDirectory = await open({ title: "选择项目工作区文件夹", multiple: false, directory: true });
  return typeof selectedDirectory === "string" ? selectedDirectory : null;
}