// 设置中心「浏览器」视图：配置驱动通道（Edge/Chrome）、自定义路径、无头模式与本地调试免审开关。
import { useEffect, useState } from "react";
import { fetchBrowserConfig, saveBrowserConfig, type BrowserSettingsConfig } from "../api/browser-client";
import styles from "./BrowserSettings.module.css";

export function BrowserSettingsView({ isZh }: { isZh: boolean }) {
  const [cfg, setCfg] = useState<BrowserSettingsConfig>({
    preferredChannel: "auto",
    customExecutablePath: "",
    headless: true,
    autoApproveLocalhost: true,
  });
  const [savedNotice, setSavedNotice] = useState("");

  useEffect(() => {
    void fetchBrowserConfig().then((res) => setCfg(res.config)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSavedNotice("");
    const res = await saveBrowserConfig(cfg);
    setCfg(res.config);
    setSavedNotice(isZh ? "已保存浏览器设置" : "Saved browser settings");
  };

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>{isZh ? "内置浏览器设置" : "Built-in Browser Settings"}</h2>
      <div className={styles.card}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{isZh ? "浏览器驱动" : "Browser Channel"}</span>
          <select
            className={styles.control}
            value={cfg.preferredChannel}
            onChange={(e) => setCfg({ ...cfg, preferredChannel: e.target.value as BrowserSettingsConfig["preferredChannel"] })}
          >
            <option value="auto">{isZh ? "自动探测（优先本机 Edge）" : "Auto (Prefer local Edge)"}</option>
            <option value="msedge">Microsoft Edge</option>
            <option value="chrome">Google Chrome</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{isZh ? "自定义浏览器路径（留空则自动探测）" : "Custom Executable Path (Optional)"}</span>
          <input
            className={styles.control}
            value={cfg.customExecutablePath}
            placeholder="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
            onChange={(e) => setCfg({ ...cfg, customExecutablePath: e.target.value })}
          />
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={cfg.headless}
            onChange={(e) => setCfg({ ...cfg, headless: e.target.checked })}
          />
          <span>{isZh ? "无头模式运行（关闭则在桌面弹出可见浏览器窗口，便于人工登录）" : "Headless mode"}</span>
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={cfg.autoApproveLocalhost}
            onChange={(e) => setCfg({ ...cfg, autoApproveLocalhost: e.target.checked })}
          />
          <span>{isZh ? "允许在对话中通过「浏览器」面板直接调试本地 127.0.0.1 / localhost 页面" : "Allow localhost browser debugging"}</span>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={() => void handleSave()}>
            {isZh ? "保存配置" : "Save"}
          </button>
          {savedNotice && <span className={styles.savedNotice}>{savedNotice}</span>}
        </div>
      </div>
    </div>
  );
}