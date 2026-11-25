// 设置中心「浏览器」主页面：涵盖总控开关、常规与链接打开方式、自动填充与密码、扩展程序、下载、浏览器权限、驱动与开发者完整 CDP 设置。
import { useEffect, useRef, useState } from "react";
import { IconAlertTriangle, IconBrowserCheck } from "@tabler/icons-react";
import {
  SettingFormField,
  SettingGroup,
  SettingRow,
  SettingSegmented,
  SettingSelect,
  SettingsPage,
  SettingSwitch,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import type { BrowserPasswordSettings, BrowserSettingsConfig, BrowserSitePermissions } from "@lfaa/browser/contract";
import { fetchBrowserConfig, saveBrowserConfig } from "../api/browser-client";
import { clearBrowserData, pickBrowserFolder } from "../api/browser-data-client";
import { BrowserDownloadsSubpage, BrowserHistorySubpage } from "./Browser-History-Downloads";
import { BrowserPasswordsSubpage } from "./Browser-Passwords-Subpage";
import { BrowserContactsSubpage, BrowserExtensionsSubpage, BrowserSiteSettingsSubpage } from "./Browser-Site-Ext-Subpages";
import { BrowserOperationRulesSubpage, BrowserSiteRulesTable } from "./Browser-Site-Rules";
import styles from "./Browser-Settings.module.css";

type BrowserSubpage = "main" | "history" | "downloads" | "passwords" | "contacts" | "site-settings" | "extensions" | "operation-rules";

const FALLBACK_SITE_PERMS: BrowserSitePermissions = {
  location: "ask", camera: "ask", microphone: "ask", notifications: "ask",
  embeddedContent: "ask", thirdPartyCookies: "allow", javascript: "allow",
  images: "allow", popups: "block", autoRevokeUnused: true,
};

const FALLBACK_PWD_SETTINGS: BrowserPasswordSettings = {
  offerToSave: true, autoCreatePasskey: true, autoSignIn: true,
};

const INITIAL_CONFIG: BrowserSettingsConfig = {
  enabled: true,
  preferredChannel: "auto",
  customExecutablePath: "",
  headless: true,
  autoApproveLocalhost: true,
  webLinkOpenMode: "external",
  localUrlOpenMode: "builtin",
  showFullUrl: false,
  annotationScreenshotMode: "always",
  downloadDir: "",
  askBeforeDownload: false,
  historyAccessPolicy: "ask",
  enableWebsiteTools: true,
  defaultBrowsePolicy: "ask",
  defaultDownloadPolicy: "ask",
  siteRules: [],
  enableFullCdp: false,
  sitePermissions: FALLBACK_SITE_PERMS,
  passwordSettings: FALLBACK_PWD_SETTINGS,
  extensions: [],
};

/** 内置浏览器配置主视图与 6 个二级管理子页入口。 */
export function BrowserSettingsView({ isZh }: { isZh: boolean }) {
  const [cfg, setCfg] = useState<BrowserSettingsConfig>(INITIAL_CONFIG);
  const [subpage, setSubpage] = useState<BrowserSubpage>("main");
  const [notice, setNotice] = useState("");
  const [pickingDir, setPickingDir] = useState(false);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    void fetchBrowserConfig().then((res) => {
      cfgRef.current = { ...INITIAL_CONFIG, ...res.config };
      setCfg(cfgRef.current);
    }).catch(() => {});
  }, []);

  const apply = async (patch: Partial<BrowserSettingsConfig>, doneText = isZh ? "已保存" : "Saved") => {
    const previous = cfgRef.current;
    const next = { ...previous, ...patch };
    cfgRef.current = next;
    setCfg(next);
    setNotice("");
    try {
      const res = await saveBrowserConfig(next);
      cfgRef.current = { ...INITIAL_CONFIG, ...res.config };
      setCfg(cfgRef.current);
      setNotice(doneText);
    } catch (err) {
      cfgRef.current = previous;
      setCfg(previous);
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  if (subpage === "history") return <BrowserHistorySubpage isZh={isZh} onBack={() => setSubpage("main")} />;
  if (subpage === "downloads") return <BrowserDownloadsSubpage isZh={isZh} onBack={() => setSubpage("main")} />;
  if (subpage === "contacts") return <BrowserContactsSubpage isZh={isZh} onBack={() => setSubpage("main")} />;
  if (subpage === "passwords") {
    return (
      <BrowserPasswordsSubpage
        isZh={isZh}
        settings={cfg.passwordSettings ?? FALLBACK_PWD_SETTINGS}
        onUpdateSettings={(patch) => void apply({ passwordSettings: { ...(cfg.passwordSettings ?? FALLBACK_PWD_SETTINGS), ...patch } })}
        onBack={() => setSubpage("main")}
      />
    );
  }
  if (subpage === "site-settings") {
    return (
      <BrowserSiteSettingsSubpage
        isZh={isZh}
        perms={cfg.sitePermissions ?? FALLBACK_SITE_PERMS}
        onUpdate={(patch) => void apply({ sitePermissions: { ...(cfg.sitePermissions ?? FALLBACK_SITE_PERMS), ...patch } })}
        onBack={() => setSubpage("main")}
      />
    );
  }
  if (subpage === "extensions") {
    return (
      <BrowserExtensionsSubpage
        isZh={isZh}
        extensions={cfg.extensions ?? []}
        onChange={(extensions) => void apply({ extensions })}
        onBack={() => setSubpage("main")}
      />
    );
  }
  if (subpage === "operation-rules") {
    return (
      <BrowserOperationRulesSubpage
        isZh={isZh}
        rules={cfg.siteRules ?? []}
        onChangeRules={(siteRules) => void apply({ siteRules })}
        onBack={() => setSubpage("main")}
      />
    );
  }

  const handleChangeDownloadDir = async () => {
    if (pickingDir) return;
    setPickingDir(true);
    setNotice("");
    try {
      const picked = await pickBrowserFolder({
        title: isZh ? "选择下载位置" : "Choose Downloads Folder",
        ...(cfg.downloadDir ? { initialDir: cfg.downloadDir } : {}),
      });
      if (picked.error) setNotice(picked.error);
      else if (!picked.cancelled && picked.path) await apply({ downloadDir: picked.path });
    } finally {
      setPickingDir(false);
    }
  };

  const handleClearData = async () => {
    if (typeof window !== "undefined" && !window.confirm(isZh ? "确定清除内置浏览器的浏览历史与下载记录？" : "Clear browsing and download history?")) return;
    await clearBrowserData();
    setNotice(isZh ? "已清除浏览数据。" : "Browsing data cleared.");
  };

  return (
    <SettingsPage
      title={isZh ? "浏览器" : "Browser"}
      description={isZh ? "配置内置浏览器、链接打开方式、下载位置以及浏览器子智能体访问权限。" : "Manage built-in browser preferences and website access permissions."}
    >
      <div className={styles.heroControlRow}>
        <div className={styles.heroLeft}>
          <span className={styles.heroIconWrap} aria-hidden="true">
            <IconBrowserCheck size={24} stroke={1.6} />
          </span>
          <div className={styles.heroText}>
            <span className={styles.heroTitle}>{isZh ? "浏览器" : "Browser"}</span>
            <span className={styles.heroDesc}>
              {isZh ? "让小鱼智能体控制内置浏览器" : "Let LFAA agents control the built-in browser"}
            </span>
          </div>
        </div>
        <SettingSwitch
          checked={cfg.enabled !== false}
          label={isZh ? "允许智能体控制内置浏览器" : "Enable browser"}
          onChange={(enabled) => void apply({ enabled })}
        />
      </div>

      <SettingGroup title={isZh ? "常规" : "General"}>
        <SettingRow
          title={isZh ? "网页 URL 和链接打开位置" : "Web URL open location"}
          description={isZh ? "选择点击普通网页链接时默认打开的位置" : "Where external web links open by default"}
          control={(
            <SettingSegmented
              value={cfg.webLinkOpenMode ?? "external"}
              label={isZh ? "网页链接打开位置" : "Web link open mode"}
              options={[
                { value: "external", label: isZh ? "外部浏览器" : "External" },
                { value: "builtin", label: isZh ? "内置浏览器" : "Built-in" },
              ]}
              onChange={(webLinkOpenMode) => void apply({ webLinkOpenMode })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "本地 URL 打开位置" : "Local URL open location"}
          description={isZh ? "本地开发站点（localhost / 127.0.0.1）默认打开位置" : "Default open location for local dev URLs"}
          control={(
            <SettingSegmented
              value={cfg.localUrlOpenMode ?? "builtin"}
              label={isZh ? "本地 URL 打开位置" : "Local URL open mode"}
              options={[
                { value: "builtin", label: isZh ? "内置浏览器" : "Built-in" },
                { value: "external", label: isZh ? "外部浏览器" : "External" },
              ]}
              onChange={(localUrlOpenMode) => void apply({ localUrlOpenMode })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "显示完整网址" : "Show full URL"}
          description={isZh ? "在地址栏中显示协议、查询参数和片段" : "Display protocol, query parameters, and hash in address bar"}
          control={<SettingSwitch checked={cfg.showFullUrl === true} label="Show full URL" onChange={(showFullUrl) => void apply({ showFullUrl })} />}
        />
        <SettingRow
          title={isZh ? "浏览数据" : "Browsing data"}
          description={isZh ? "清除应用内置浏览器中的浏览历史与下载记录" : "Clear built-in browser history and download records"}
          control={<button type="button" className={baseStyles.actionBtn} onClick={() => void handleClearData()}>{isZh ? "清除浏览数据" : "Clear data"}</button>}
        />
        <SettingRow
          title={isZh ? "浏览历史" : "Browsing history"}
          description={isZh ? "查看和管理你在内置浏览器中访问过的页面" : "View and manage pages visited in the built-in browser"}
          control={<button type="button" className={baseStyles.actionBtn} onClick={() => setSubpage("history")}>{isZh ? "管理" : "Manage"}</button>}
        />
        <SettingRow
          title={isZh ? "批注截图" : "Annotation screenshots"}
          description={isZh ? "截图可帮助智能体更好地理解页面上下文，但会增加上下文用量" : "Include screenshots with page annotations"}
          control={(
            <SettingSelect<NonNullable<BrowserSettingsConfig["annotationScreenshotMode"]>>
              value={cfg.annotationScreenshotMode ?? "always"}
              label={isZh ? "批注截图" : "Annotation screenshots"}
              options={[
                { value: "always", label: isZh ? "始终包含" : "Always include" },
                { value: "selection_only", label: isZh ? "仅限拖拽选中区域" : "Selection only" },
              ]}
              onChange={(annotationScreenshotMode) => void apply({ annotationScreenshotMode })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? "自动填充和密码" : "Autofill & Passwords"}>
        <SettingRow
          title={isZh ? "密码管理器" : "Password Manager"}
          description={isZh ? "添加、删除、导入导出本地加密保存的密码" : "Add, remove, and edit saved credentials"}
          control={<button type="button" className={baseStyles.actionBtn} onClick={() => setSubpage("passwords")}>{isZh ? "管理" : "Manage"}</button>}
        />
        <SettingRow
          title={isZh ? "联系信息" : "Contact info"}
          description={isZh ? "添加、删除和编辑已保存的地址、电话号码和电子邮件地址" : "Manage saved addresses, phone numbers, and emails"}
          control={<button type="button" className={baseStyles.actionBtn} onClick={() => setSubpage("contacts")}>{isZh ? "管理" : "Manage"}</button>}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? "扩展程序" : "Extensions"}>
        <SettingRow
          title={isZh ? "扩展程序管理器" : "Extensions Manager"}
          description={isZh ? "安装、移除和配置本地解压的浏览器扩展程序" : "Install, remove, and configure browser extensions"}
          control={<button type="button" className={baseStyles.actionBtn} onClick={() => setSubpage("extensions")}>{isZh ? "管理" : "Manage"}</button>}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? "下载" : "Downloads"}>
        <SettingRow
          title={isZh ? "下载位置" : "Download location"}
          description={<span className={styles.pathValue}>{cfg.downloadDir || (isZh ? "系统默认下载文件夹" : "System Downloads folder")}</span>}
          control={(
            <button type="button" className={baseStyles.actionBtn} disabled={pickingDir} onClick={() => void handleChangeDownloadDir()}>
              {pickingDir ? (isZh ? "打开中…" : "Opening…") : (isZh ? "更改…" : "Change…")}
            </button>
          )}
        />
        <SettingRow
          title={isZh ? "下载前询问保存位置" : "Ask where to save before downloading"}
          description={isZh ? "对在内置浏览器中发起的下载显示保存对话框" : "Prompt for destination on each download"}
          control={<SettingSwitch checked={cfg.askBeforeDownload === true} label="Ask before download" onChange={(askBeforeDownload) => void apply({ askBeforeDownload })} />}
        />
        <SettingRow
          title={isZh ? "下载历史记录" : "Download history"}
          description={isZh ? "查看和管理从内置浏览器下载的文件" : "View and manage downloaded files"}
          control={<button type="button" className={baseStyles.actionBtn} onClick={() => setSubpage("downloads")}>{isZh ? "管理" : "Manage"}</button>}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? "浏览器权限" : "Browser Permissions"}>
        <SettingRow
          title={isZh ? "网站设置" : "Site settings"}
          description={isZh ? "管理内置浏览器中的摄像头、麦克风、位置与内容权限" : "Manage camera, microphone, location, and content permissions"}
          control={<button type="button" className={baseStyles.actionBtn} onClick={() => setSubpage("site-settings")}>{isZh ? "管理" : "Manage"}</button>}
        />
        <SettingRow
          title={isZh ? "历史记录访问" : "History access"}
          description={isZh ? "选择智能体是否可访问你的内置浏览器历史记录" : "Choose whether agents can read browsing history"}
          control={(
            <SettingSelect<NonNullable<BrowserSettingsConfig["historyAccessPolicy"]>>
              value={cfg.historyAccessPolicy ?? "ask"}
              label={isZh ? "历史记录访问" : "History access"}
              options={[
                { value: "ask", label: isZh ? "始终询问" : "Always ask" },
                { value: "allow", label: isZh ? "始终允许" : "Always allow" },
                { value: "deny", label: isZh ? "禁用" : "Disabled" },
              ]}
              onChange={(historyAccessPolicy) => void apply({ historyAccessPolicy })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "默认使用网站工具" : "Use website tools by default"}
          description={isZh ? "允许智能体发现并调用网站提供的工具（包括 WebMCP），除非为某站点设置了其他权限" : "Allow agents to discover website-provided tools (including WebMCP)"}
          control={<SettingSwitch checked={cfg.enableWebsiteTools !== false} label="Website tools" onChange={(enableWebsiteTools) => void apply({ enableWebsiteTools })} />}
        />
        <BrowserSiteRulesTable
          isZh={isZh}
          defaultBrowse={cfg.defaultBrowsePolicy ?? "ask"}
          defaultDownload={cfg.defaultDownloadPolicy ?? "ask"}
          rules={cfg.siteRules ?? []}
          onChangeDefaults={(patch) => void apply(patch)}
          onChangeRules={(siteRules) => void apply({ siteRules })}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? "浏览器子智能体" : "Browser Subagent"}>
        <SettingRow
          title={isZh ? "浏览器操作控制规则" : "Browser operation control rules"}
          description={isZh ? "配置浏览器子智能体允许和拒绝访问的 URL 与下载规则。它在内置浏览器中运行，无需单独安装浏览器。" : "Configure allowed and blocked URLs and download rules for the browser subagent."}
          control={<button type="button" className={baseStyles.actionBtn} onClick={() => setSubpage("operation-rules")}>{isZh ? "编辑" : "Edit"}</button>}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? "驱动与开发者模式" : "Driver & Developer Mode"}>
        <SettingRow
          title={isZh ? "浏览器驱动" : "Browser channel"}
          description={isZh ? "自动探测时优先使用本机 Edge" : "Auto-detect prefers local Edge"}
          control={(
            <SettingSelect<BrowserSettingsConfig["preferredChannel"]>
              value={cfg.preferredChannel}
              label={isZh ? "浏览器驱动" : "Browser channel"}
              options={[
                { value: "auto", label: isZh ? "自动探测" : "Auto" },
                { value: "msedge", label: "Microsoft Edge" },
                { value: "chrome", label: "Google Chrome" },
              ]}
              onChange={(preferredChannel) => void apply({ preferredChannel })}
            />
          )}
        />
        <SettingRow
          title={isZh ? "无头模式运行" : "Headless mode"}
          description={isZh ? "关闭后在桌面弹出可见浏览器窗口，便于人工登录" : "Turn off to show a visible desktop browser window"}
          control={<SettingSwitch checked={cfg.headless} label="Headless mode" onChange={(headless) => void apply({ headless })} />}
        />
        <SettingRow
          title={isZh ? "允许调试本地页面" : "Allow localhost debugging"}
          description={isZh ? "允许免审批调试 127.0.0.1 / localhost 开发页面" : "Auto-approve localhost debugging"}
          control={<SettingSwitch checked={cfg.autoApproveLocalhost} label="Localhost debugging" onChange={(autoApproveLocalhost) => void apply({ autoApproveLocalhost })} />}
        />
        <SettingFormField
          label={isZh ? "自定义浏览器路径" : "Custom executable path"}
          hint={isZh ? "留空则按所选驱动自动探测；填写后优先使用该可执行文件。" : "Leave empty to auto-detect."}
        >
          <input
            type="text"
            className={baseStyles.input}
            value={cfg.customExecutablePath}
            placeholder="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
            onChange={(e) => setCfg({ ...cfg, customExecutablePath: e.target.value })}
            onBlur={() => void apply({ customExecutablePath: cfg.customExecutablePath })}
          />
        </SettingFormField>
        <SettingRow
          title={isZh ? "启用完整 CDP 访问权限" : "Enable full CDP access"}
          description={(
            <>
              <span className={styles.riskHint}><IconAlertTriangle size={13} aria-hidden="true" />{isZh ? "风险升高" : "Elevated risk"}</span>
              <div>{isZh ? "允许智能体使用完整的 Chrome DevTools Protocol (CDP) 检查并控制底层浏览器内部功能。" : "Allow full Chrome DevTools Protocol access in browser sessions."}</div>
            </>
          )}
          control={<SettingSwitch checked={cfg.enableFullCdp === true} label="Enable full CDP" onChange={(enableFullCdp) => void apply({ enableFullCdp })} />}
        />
      </SettingGroup>

      {notice && <p className={baseStyles.notice} role="status">{notice}</p>}
    </SettingsPage>
  );
}
