// 设置中心「浏览器」页：驱动通道、自定义可执行文件路径、无头模式与本地调试免审；改动即时保存。
import { useEffect, useRef, useState } from "react";
import {
  SettingFormField,
  SettingGroup,
  SettingRow,
  SettingSelect,
  SettingsPage,
  SettingSwitch,
  settingsStyles as baseStyles,
} from "@lfaa/ui-primitives/client";
import { fetchBrowserConfig, saveBrowserConfig, type BrowserSettingsConfig } from "../api/browser-client";

/** 内置浏览器配置页：所有改动直接写回 Host，不设额外保存按钮。 */
export function BrowserSettingsView({ isZh }: { isZh: boolean }) {
  const [cfg, setCfg] = useState<BrowserSettingsConfig>({
    preferredChannel: "auto",
    customExecutablePath: "",
    headless: true,
    autoApproveLocalhost: true,
  });
  const [notice, setNotice] = useState("");
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    void fetchBrowserConfig().then((res) => setCfg(res.config)).catch(() => {});
  }, []);

  // 统一写入口：先乐观更新再落盘，失败时按请求前快照回滚并提示，避免快速连点引发闭包陈旧。
  const apply = async (patch: Partial<BrowserSettingsConfig>, doneText: string) => {
    const previous = cfgRef.current;
    const next = { ...previous, ...patch };
    cfgRef.current = next;
    setCfg(next);
    setNotice("");
    try {
      const res = await saveBrowserConfig(next);
      cfgRef.current = res.config;
      setCfg(res.config);
      setNotice(doneText);
    } catch (err) {
      cfgRef.current = previous;
      setCfg(previous);
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const savedText = isZh ? "已保存" : "Saved";

  return (
    <SettingsPage
      title={isZh ? "浏览器" : "Browser"}
      description={isZh
        ? "内置浏览器驱动、可执行文件路径与运行方式；改动即时生效。"
        : "Driver, executable path, and runtime mode for the built-in browser. Changes apply immediately."}
    >
      <SettingGroup title={isZh ? "驱动" : "Driver"}>
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
              onChange={(preferredChannel) => void apply({ preferredChannel }, savedText)}
            />
          )}
        />
        <SettingFormField
          label={isZh ? "自定义浏览器路径" : "Custom executable path"}
          hint={isZh
            ? "留空则按所选驱动自动探测；填写后优先使用该可执行文件。"
            : "Leave empty to auto-detect; when set, this executable is used first."}
        >
          <input
            type="text"
            className={baseStyles.input}
            value={cfg.customExecutablePath}
            placeholder="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
            onChange={(e) => setCfg({ ...cfg, customExecutablePath: e.target.value })}
            onBlur={() => void apply({ customExecutablePath: cfg.customExecutablePath }, savedText)}
          />
        </SettingFormField>
      </SettingGroup>

      <SettingGroup title={isZh ? "运行方式" : "Runtime"}>
        <SettingRow
          title={isZh ? "无头模式运行" : "Headless mode"}
          description={isZh
            ? "关闭后在桌面弹出可见浏览器窗口，便于人工登录"
            : "Turn off to open a visible browser window for manual sign-in"}
          control={(
            <SettingSwitch
              checked={cfg.headless}
              label={isZh ? "无头模式运行" : "Headless mode"}
              onChange={(headless) => void apply({ headless }, savedText)}
            />
          )}
        />
        <SettingRow
          title={isZh ? "允许调试本地页面" : "Allow localhost debugging"}
          description={isZh
            ? "允许在对话中通过「浏览器」面板直接调试 127.0.0.1 / localhost 页面"
            : "Allow the Browser panel to attach to 127.0.0.1 / localhost pages"}
          control={(
            <SettingSwitch
              checked={cfg.autoApproveLocalhost}
              label={isZh ? "允许调试本地页面" : "Allow localhost debugging"}
              onChange={(autoApproveLocalhost) => void apply({ autoApproveLocalhost }, savedText)}
            />
          )}
        />
      </SettingGroup>

      {notice && <p className={baseStyles.notice} role="status">{notice}</p>}
    </SettingsPage>
  );
}