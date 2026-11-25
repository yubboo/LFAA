// 浏览器「站点设置」「联系信息」与「扩展程序管理器」三个二级管理子页。
import { useCallback, useEffect, useState } from "react";
import { IconArrowLeft, IconPlus, IconPuzzle, IconTrash, IconUser } from "@tabler/icons-react";
import {
  SettingGroup,
  SettingRow,
  SettingSelect,
  SettingsPage,
  SettingSwitch,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import type {
  BrowserExtensionItem,
  BrowserPermissionSetting,
  BrowserSitePermissions,
} from "@lfaa/browser/contract";
import {
  deleteBrowserContact,
  fetchBrowserContacts,
  pickBrowserFolder,
  saveBrowserContact,
  type BrowserContactItem,
} from "../api/browser-data-client";
import styles from "./Browser-Settings.module.css";

const PERM_OPTIONS = (isZh: boolean): Array<{ value: BrowserPermissionSetting; label: string }> => [
  { value: "ask", label: isZh ? "访问前询问" : "Ask" },
  { value: "allow", label: isZh ? "允许" : "Allow" },
  { value: "block", label: isZh ? "不允许" : "Block" },
];

export function BrowserSiteSettingsSubpage({
  isZh,
  perms,
  onUpdate,
  onBack,
}: {
  isZh: boolean;
  perms: BrowserSitePermissions;
  onUpdate: (patch: Partial<BrowserSitePermissions>) => void;
  onBack: () => void;
}) {
  const permOpts = PERM_OPTIONS(isZh);
  const allowBlockOpts: Array<{ value: "allow" | "block"; label: string }> = [
    { value: "allow", label: isZh ? "允许" : "Allow" },
    { value: "block", label: isZh ? "不允许" : "Block" },
  ];

  return (
    <SettingsPage
      title={isZh ? "网站设置" : "Site settings"}
      description={isZh ? "控制内置浏览器中的设备权限与网页内容策略。" : "Manage device permissions and content rules for the built-in browser."}
    >
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <IconArrowLeft size={14} aria-hidden="true" />
          <span>{isZh ? "浏览器" : "Browser"}</span>
        </button>
        <span>/</span>
        <span>{isZh ? "站点设置" : "Site settings"}</span>
      </div>

      <SettingGroup title={isZh ? "权限" : "Permissions"}>
        <SettingRow
          title={isZh ? "位置信息" : "Location"}
          description={isZh ? "网站可以请求获取您的位置信息" : "Sites can ask for your location"}
          control={<SettingSelect value={perms.location} label="Location" options={permOpts} onChange={(location) => onUpdate({ location })} />}
        />
        <SettingRow
          title={isZh ? "摄像头" : "Camera"}
          description={isZh ? "网站可以请求使用您的摄像头" : "Sites can ask to use your camera"}
          control={<SettingSelect value={perms.camera} label="Camera" options={permOpts} onChange={(camera) => onUpdate({ camera })} />}
        />
        <SettingRow
          title={isZh ? "麦克风" : "Microphone"}
          description={isZh ? "网站可以请求使用您的麦克风" : "Sites can ask to use your microphone"}
          control={<SettingSelect value={perms.microphone} label="Microphone" options={permOpts} onChange={(microphone) => onUpdate({ microphone })} />}
        />
        <SettingRow
          title={isZh ? "通知" : "Notifications"}
          description={isZh ? "收起不需要的请求（推荐）" : "Sites can ask to send notifications"}
          control={<SettingSelect value={perms.notifications} label="Notifications" options={permOpts} onChange={(notifications) => onUpdate({ notifications })} />}
        />
        <SettingRow
          title={isZh ? "嵌入式内容" : "Embedded content"}
          description={isZh ? "网站可以请求使用其保存的与您相关的信息" : "Sites can ask to use embedded content data"}
          control={<SettingSelect value={perms.embeddedContent} label="Embedded content" options={permOpts} onChange={(embeddedContent) => onUpdate({ embeddedContent })} />}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? "内容" : "Content"}>
        <SettingRow
          title={isZh ? "第三方 Cookie" : "Third-party cookies"}
          description={isZh ? "控制网站是否允许使用第三方 Cookie" : "Control third-party cookie usage"}
          control={(
            <SettingSelect<BrowserSitePermissions["thirdPartyCookies"]>
              value={perms.thirdPartyCookies}
              label="Third-party cookies"
              options={[
                { value: "allow", label: isZh ? "允许第三方 Cookie" : "Allow" },
                { value: "block_incognito", label: isZh ? "在无痕模式下屏蔽" : "Block in incognito" },
                { value: "block", label: isZh ? "屏蔽第三方 Cookie" : "Block all" },
              ]}
              onChange={(thirdPartyCookies) => onUpdate({ thirdPartyCookies })}
            />
          )}
        />
        <SettingRow
          title="JavaScript"
          description={isZh ? "网站可以使用 JavaScript" : "Sites can use JavaScript"}
          control={<SettingSelect value={perms.javascript} label="JavaScript" options={allowBlockOpts} onChange={(javascript) => onUpdate({ javascript })} />}
        />
        <SettingRow
          title={isZh ? "图片" : "Images"}
          description={isZh ? "网站可以显示图片" : "Sites can show images"}
          control={<SettingSelect value={perms.images} label="Images" options={allowBlockOpts} onChange={(images) => onUpdate({ images })} />}
        />
        <SettingRow
          title={isZh ? "弹出式窗口和重定向" : "Pop-ups and redirects"}
          description={isZh ? "不允许网站显示弹出式窗口或使用重定向" : "Block pop-ups and redirects by default"}
          control={<SettingSelect value={perms.popups} label="Pop-ups" options={allowBlockOpts} onChange={(popups) => onUpdate({ popups })} />}
        />
        <SettingRow
          title={isZh ? "自动撤销未使用的网站的权限" : "Auto-revoke unused site permissions"}
          description={isZh ? "为保护您的数据，对于您近期未访问的网站，允许自动移除网站权限" : "Remove permissions for sites you haven't visited recently"}
          control={(
            <SettingSwitch
              checked={perms.autoRevokeUnused}
              label={isZh ? "自动撤销未使用的网站的权限" : "Auto-revoke"}
              onChange={(autoRevokeUnused) => onUpdate({ autoRevokeUnused })}
            />
          )}
        />
      </SettingGroup>
    </SettingsPage>
  );
}

export function BrowserContactsSubpage({ isZh, onBack }: { isZh: boolean; onBack: () => void }) {
  const [items, setItems] = useState<BrowserContactItem[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const load = useCallback(async () => {
    const res = await fetchBrowserContacts().catch(() => ({ items: [] }));
    setItems(res.items);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await saveBrowserContact({ name, email, phone, address });
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    await load();
  };

  return (
    <SettingsPage
      title={isZh ? "联系信息" : "Contact info"}
      description={isZh ? "添加、删除和编辑已保存的地址、电话号码和电子邮件地址。" : "Manage saved addresses, phone numbers, and emails."}
    >
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <IconArrowLeft size={14} aria-hidden="true" />
          <span>{isZh ? "浏览器" : "Browser"}</span>
        </button>
        <span>/</span>
        <span>{isZh ? "联系信息" : "Contact info"}</span>
      </div>

      <div className={styles.inlineForm}>
        <input className={baseStyles.input} placeholder={isZh ? "姓名" : "Name"} value={name} onChange={(e) => setName(e.target.value)} />
        <input className={baseStyles.input} placeholder={isZh ? "电子邮箱" : "Email"} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={baseStyles.input} placeholder={isZh ? "电话号码" : "Phone"} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={baseStyles.input} placeholder={isZh ? "地址" : "Address"} value={address} onChange={(e) => setAddress(e.target.value)} />
        <button type="button" className={baseStyles.actionBtn} disabled={!name.trim()} onClick={() => void handleAdd()}>
          <IconPlus size={14} aria-hidden="true" />
          <span>{isZh ? "添加" : "Add"}</span>
        </button>
      </div>

      {items.length === 0 ? (
        <p className={styles.emptyText}>{isZh ? "暂无已保存的联系信息。" : "No saved contacts yet."}</p>
      ) : (
        <div className={styles.itemList}>
          {items.map((item) => (
            <div key={item.id} className={styles.itemRow}>
              <IconUser size={15} aria-hidden="true" />
              <div className={styles.itemMain}>
                <span className={styles.itemTitle}>{item.name}</span>
                <span className={styles.itemSub}>{[item.email, item.phone, item.address].filter(Boolean).join(" · ") || "-"}</span>
              </div>
              <button type="button" className={styles.iconBtn} aria-label={isZh ? "删除" : "Delete"} onClick={() => void deleteBrowserContact(item.id).then(load)}>
                <IconTrash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsPage>
  );
}

export function BrowserExtensionsSubpage({
  isZh,
  extensions,
  onChange,
  onBack,
}: {
  isZh: boolean;
  extensions: BrowserExtensionItem[];
  onChange: (next: BrowserExtensionItem[]) => void;
  onBack: () => void;
}) {
  const handlePickExtension = async () => {
    const picked = await pickBrowserFolder({ title: isZh ? "选择已解压的浏览器扩展目录" : "Select unpacked extension folder" });
    if (picked.cancelled || !picked.path) return;
    const parts = picked.path.replace(/\\/gu, "/").split("/");
    const name = parts[parts.length - 1] || picked.path;
    onChange([...extensions, { id: `ext-${Date.now()}`, name, path: picked.path, enabled: true }]);
  };

  return (
    <SettingsPage
      title={isZh ? "扩展程序管理器" : "Extensions Manager"}
      description={isZh ? "加载、启用或移除本地解压的浏览器扩展目录（非无头模式下生效）。" : "Load, enable, or remove unpacked browser extensions."}
      actions={(
        <button type="button" className={baseStyles.actionBtn} onClick={() => void handlePickExtension()}>
          <IconPlus size={14} aria-hidden="true" />
          <span>{isZh ? "加载已解压扩展" : "Load unpacked"}</span>
        </button>
      )}
    >
      <div className={styles.breadcrumb}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <IconArrowLeft size={14} aria-hidden="true" />
          <span>{isZh ? "浏览器" : "Browser"}</span>
        </button>
        <span>/</span>
        <span>{isZh ? "扩展程序" : "Extensions"}</span>
      </div>

      {extensions.length === 0 ? (
        <p className={styles.emptyText}>{isZh ? "尚未加载任何浏览器扩展程序。" : "No extensions loaded yet."}</p>
      ) : (
        <div className={styles.itemList}>
          {extensions.map((ext) => (
            <div key={ext.id} className={styles.itemRow}>
              <IconPuzzle size={15} aria-hidden="true" />
              <div className={styles.itemMain}>
                <span className={styles.itemTitle}>{ext.name}</span>
                <span className={styles.itemSub} title={ext.path}>{ext.path}</span>
              </div>
              <SettingSwitch
                checked={ext.enabled}
                label={ext.name}
                onChange={(enabled) => onChange(extensions.map((item) => (item.id === ext.id ? { ...item, enabled } : item)))}
              />
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={isZh ? `移除 ${ext.name}` : `Remove ${ext.name}`}
                onClick={() => onChange(extensions.filter((item) => item.id !== ext.id))}
              >
                <IconTrash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsPage>
  );
}
