// 浏览器「密码管理器」子页：支持密码列表（搜索/添加/查看/删除）与设置页（保存提示、通行密钥、自动登录、CSV 导入导出与清空）。
import { useCallback, useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconEye, IconEyeOff, IconKey, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import {
  SettingGroup,
  SettingRow,
  SettingSegmented,
  SettingsPage,
  SettingSwitch,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import type { BrowserPasswordSettings } from "@lfaa/browser/contract";
import {
  clearBrowserPasswords,
  deleteBrowserPassword,
  fetchBrowserPasswords,
  importBrowserPasswordsCsv,
  saveBrowserPassword,
  type BrowserPasswordItem,
} from "../api/browser-data-client";
import styles from "./Browser-Settings.module.css";

export function BrowserPasswordsSubpage({
  isZh,
  settings,
  onUpdateSettings,
  onBack,
}: {
  isZh: boolean;
  settings: BrowserPasswordSettings;
  onUpdateSettings: (patch: Partial<BrowserPasswordSettings>) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"list" | "settings">("list");
  const [items, setItems] = useState<BrowserPasswordItem[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [origin, setOrigin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q?: string) => {
    const res = await fetchBrowserPasswords(q).catch(() => ({ items: [] }));
    setItems(res.items);
  }, []);

  useEffect(() => { void load(query); }, [load, query]);

  const handleAdd = async () => {
    if (!origin.trim() || !username.trim()) return;
    await saveBrowserPassword({ origin, username, password });
    setOrigin("");
    setUsername("");
    setPassword("");
    setAdding(false);
    await load(query);
  };

  const handleImportCsv = async (file: File) => {
    const text = await file.text();
    const res = await importBrowserPasswordsCsv(text);
    setNotice(isZh ? `已导入 ${res.imported} 条密码记录。` : `Imported ${res.imported} credentials.`);
    await load(query);
  };

  return (
    <SettingsPage
      title={isZh ? "管理密码" : "Password Manager"}
      description={isZh ? "本地 AES-256-GCM 加密保存的内置浏览器凭据。" : "Locally encrypted credentials for the built-in browser."}
    >
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <IconArrowLeft size={14} aria-hidden="true" />
          <span>{isZh ? "浏览器" : "Browser"}</span>
        </button>
        <span>/</span>
        <span>{isZh ? "密码管理器" : "Passwords"}</span>
      </div>

      <SettingSegmented
        value={tab}
        label={isZh ? "密码管理器分页" : "Password Manager Tabs"}
        options={[
          { value: "list", label: isZh ? "密码" : "Passwords" },
          { value: "settings", label: isZh ? "设置" : "Settings" },
        ]}
        onChange={setTab}
      />

      {notice && <p className={baseStyles.notice} role="status">{notice}</p>}

      {tab === "list" ? (
        <>
          <div className={styles.searchBar}>
            <div className={styles.searchInputWrap}>
              <IconSearch size={14} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="search"
                className={styles.searchInput}
                value={query}
                placeholder={isZh ? "搜索密码" : "Search passwords"}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="button" className={baseStyles.actionBtn} onClick={() => setAdding((v) => !v)}>
              <IconPlus size={14} aria-hidden="true" />
              <span>{isZh ? "添加" : "Add"}</span>
            </button>
          </div>

          {adding && (
            <div className={styles.inlineForm}>
              <input className={baseStyles.input} placeholder={isZh ? "网站地址（如 http://127.0.0.1:3000）" : "Origin URL"} value={origin} onChange={(e) => setOrigin(e.target.value)} />
              <input className={baseStyles.input} placeholder={isZh ? "用户名 / 邮箱" : "Username"} value={username} onChange={(e) => setUsername(e.target.value)} />
              <input className={baseStyles.input} type="password" placeholder={isZh ? "密码" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className={baseStyles.actionBtn} disabled={!origin.trim() || !username.trim()} onClick={() => void handleAdd()}>
                {isZh ? "保存" : "Save"}
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <p className={styles.emptyText}>{isZh ? "暂无已保存密码。" : "No saved passwords yet."}</p>
          ) : (
            <div className={styles.itemList}>
              {items.map((item) => {
                const shown = Boolean(revealedIds[item.id]);
                return (
                  <div key={item.id} className={styles.itemRow}>
                    <IconKey size={15} aria-hidden="true" />
                    <div className={styles.itemMain}>
                      <span className={styles.itemTitle}>{item.origin}</span>
                      <span className={styles.itemSub}>
                        {item.username} · {shown ? item.password : "••••••••"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={shown ? (isZh ? "隐藏密码" : "Hide") : (isZh ? "显示密码" : "Show")}
                      onClick={() => setRevealedIds((prev) => ({ ...prev, [item.id]: !shown }))}
                    >
                      {shown ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={isZh ? "删除密码" : "Delete"}
                      onClick={() => void deleteBrowserPassword(item.id).then(() => load(query))}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <SettingGroup title={isZh ? "密码与通行密钥设置" : "Password & Passkey Settings"}>
          <SettingRow
            title={isZh ? "提示保存密码和通行密钥" : "Offer to save passwords and passkeys"}
            control={(
              <SettingSwitch
                checked={settings.offerToSave}
                label={isZh ? "提示保存密码和通行密钥" : "Offer to save"}
                onChange={(offerToSave) => onUpdateSettings({ offerToSave })}
              />
            )}
          />
          <SettingRow
            title={isZh ? "自动创建通行密钥，登录更迅速" : "Automatically create passkeys"}
            description={isZh ? "允许网站和应用将现有账号升级为使用通行密钥" : "Allow websites to upgrade existing accounts to passkeys"}
            control={(
              <SettingSwitch
                checked={settings.autoCreatePasskey}
                label={isZh ? "自动创建通行密钥" : "Auto passkey"}
                onChange={(autoCreatePasskey) => onUpdateSettings({ autoCreatePasskey })}
              />
            )}
          />
          <SettingRow
            title={isZh ? "自动登录" : "Auto Sign-in"}
            description={isZh ? "密码管理工具会记住您的登录信息，并在情况允许时自动登录" : "Automatically sign in using stored credentials"}
            control={(
              <SettingSwitch
                checked={settings.autoSignIn}
                label={isZh ? "自动登录" : "Auto Sign-in"}
                onChange={(autoSignIn) => onUpdateSettings({ autoSignIn })}
              />
            )}
          />
          <SettingRow
            title={isZh ? "导入密码" : "Import passwords"}
            description={isZh ? "如需将密码导入此设备上的密码管理工具，请选择一个 CSV 文件。" : "Import credentials from a CSV file."}
            control={(
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImportCsv(file);
                    e.target.value = "";
                  }}
                />
                <button type="button" className={baseStyles.actionBtn} onClick={() => fileInputRef.current?.click()}>
                  {isZh ? "选择文件" : "Select file"}
                </button>
              </>
            )}
          />
          <SettingRow
            title={isZh ? "导出密码" : "Export passwords"}
            description={isZh ? "下载的文件使用完毕后请及时删除，以防他人看到您的密码。" : "Download credentials as CSV; delete after use."}
            control={(
              <a className={baseStyles.actionBtn} href="/api/browser/passwords/export" download="lfaa-passwords.csv">
                {isZh ? "下载文件" : "Download file"}
              </a>
            )}
          />
          <SettingRow
            title={isZh ? "删除所有密码管理工具数据" : "Delete all password data"}
            description={isZh ? "您的密码、通行密钥和其他数据将从密码管理工具中永久删除。" : "Permanently delete all saved credentials."}
            control={(
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => {
                  if (typeof window !== "undefined" && !window.confirm(isZh ? "确定永久删除所有已保存密码？" : "Delete all saved passwords?")) return;
                  void clearBrowserPasswords().then(() => {
                    setNotice(isZh ? "已清空全部密码数据。" : "All password data deleted.");
                    return load(query);
                  });
                }}
              >
                {isZh ? "删除数据" : "Delete data"}
              </button>
            )}
          />
        </SettingGroup>
      )}
    </SettingsPage>
  );
}
