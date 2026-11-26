// 设置中心「浏览器」的下载分组：显示生效的下载位置（跟随系统或自定义）、更改目录、恢复默认与下载历史入口。
import { useState } from "react";
import { SettingGroup, SettingRow, SettingSwitch, settingsStyles as baseStyles } from "@lfaa/ui-primitives/client";
import type { BrowserSettingsConfig } from "@lfaa/browser/contract";
import { pickBrowserFolder } from "../api/browser-data-client";
import type { DownloadDirSource } from "../api/browser-client";
import styles from "./Browser-Settings.module.css";

/** 下载分组：目录选择走宿主原生对话框，写入由设置页统一提交。 */
export function BrowserDownloadsGroup({
  isZh,
  downloadDir,
  dirSource,
  askBeforeDownload,
  onApply,
  onOpenHistory,
  onNotify,
}: {
  isZh: boolean;
  downloadDir: string;
  dirSource: DownloadDirSource;
  askBeforeDownload: boolean;
  onApply: (patch: Partial<BrowserSettingsConfig>, doneText?: string) => Promise<void>;
  onOpenHistory: () => void;
  /** 目录选择失败时由设置页统一展示提示。 */
  onNotify: (message: string) => void;
}) {
  const [picking, setPicking] = useState(false);

  const changeDir = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickBrowserFolder({
        title: isZh ? "选择下载位置" : "Choose Downloads Folder",
        ...(downloadDir ? { initialDir: downloadDir } : {}),
      });
      if (picked.error) onNotify(picked.error);
      else if (!picked.cancelled && picked.path) await onApply({ downloadDir: picked.path });
    } finally {
      setPicking(false);
    }
  };

  return (
    <SettingGroup title={isZh ? "下载" : "Downloads"}>
      <SettingRow
        title={isZh ? "下载位置" : "Download location"}
        description={(
          <>
            <span className={styles.pathValue}>{downloadDir || (isZh ? "系统默认下载文件夹" : "System Downloads folder")}</span>
            {dirSource === "system" && <span className={styles.dirTag}>{isZh ? "系统默认" : "System default"}</span>}
          </>
        )}
        control={(
          <>
            {dirSource === "custom" && (
              <button
                type="button"
                className={baseStyles.ghostBtn}
                onClick={() => void onApply({ downloadDir: "" }, isZh ? "已恢复系统默认下载位置" : "Reset to system default")}
              >
                {isZh ? "恢复默认" : "Reset"}
              </button>
            )}
            <button type="button" className={baseStyles.actionBtn} disabled={picking} onClick={() => void changeDir()}>
              {picking ? (isZh ? "打开中…" : "Opening…") : (isZh ? "更改…" : "Change…")}
            </button>
          </>
        )}
      />
      <SettingRow
        title={isZh ? "下载前询问保存位置" : "Ask where to save before downloading"}
        description={isZh ? "对在内置浏览器中发起的下载显示保存对话框" : "Prompt for destination on each download"}
        control={<SettingSwitch checked={askBeforeDownload} label="Ask before download" onChange={(value) => void onApply({ askBeforeDownload: value })} />}
      />
      <SettingRow
        title={isZh ? "下载历史记录" : "Download history"}
        description={isZh ? "查看和管理从内置浏览器下载的文件" : "View and manage downloaded files"}
        control={(
          <button type="button" className={baseStyles.actionBtn} aria-label={isZh ? "管理下载历史记录" : "Manage download history"} onClick={onOpenHistory}>
            {isZh ? "管理" : "Manage"}
          </button>
        )}
      />
    </SettingGroup>
  );
}