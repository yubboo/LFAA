// 渲染设置中心「常规」页中的核心「常规」设置分组（项目外聊天目录、Shell、语言、历史、推理强度、开源许可证与插件等）。
import { useState } from "react";
import { IconAppWindow, IconCode, IconFolderFilled, IconTerminal2 } from "@tabler/icons-react";
import { middleTruncatePath, type GeneralSettingsConfig, type ReasoningLevelOption } from "./general-settings-client";
import { SettingGroupCard, SettingRow, SettingSelect, SettingSwitch } from "@lfaa/ui-primitives/client";
import { settingsStyles as styles } from "@lfaa/ui-primitives/client";

const REASONING_OPTIONS: ReadonlyArray<{ value: ReasoningLevelOption; zh: string; en: string }> = [
  { value: "minimal", zh: "极简", en: "Minimal" },
  { value: "low", zh: "低", en: "Low" },
  { value: "medium", zh: "中", en: "Medium" },
  { value: "high", zh: "高", en: "High" },
  { value: "max", zh: "极高", en: "Max" },
];

/** 渲染常规设置主体，通过统一更新入口提交目录、语言和推理偏好。 */
export function GeneralSettingsGeneralGroup({
  isZh,
  cfg,
  onPatch,
  onPickOutsideFolder,
  onPickDefaultProjectsFolder,
  onOpenLicenses,
  onShowNotice,
}: {
  isZh: boolean;
  cfg: GeneralSettingsConfig;
  onPatch: (patch: Partial<GeneralSettingsConfig>) => void;
  onPickOutsideFolder: () => void;
  onPickDefaultProjectsFolder: () => void;
  onOpenLicenses: () => void;
  onShowNotice: (msg: string) => void;
}) {
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const toggleReasoningLevel = (level: ReasoningLevelOption) => {
    const exists = cfg.reasoningLevels.includes(level);
    if (exists && cfg.reasoningLevels.length <= 1) return;
    const next = exists
      ? cfg.reasoningLevels.filter((x) => x !== level)
      : [...cfg.reasoningLevels, level];
    onPatch({ reasoningLevels: next });
  };

  const outsidePath = cfg.outsideProjectFolder || (isZh ? "正在检测 .lfaa 目录..." : "Detecting .lfaa folder...");
  const projectsBasePath = cfg.defaultProjectsFolder || (isZh ? "正在检测文档/lfaa 目录..." : "Detecting Documents/lfaa...");

  return (
    <SettingGroupCard title={isZh ? "常规" : "General"}>
      <SettingRow
        title={isZh ? "项目外聊天文件夹" : "Out-of-project chat folder"}
        description={
          isZh
            ? "未关联项目直接发起「新聊天」时的默认存储位置（默认 ~/.lfaa；项目内与项目外对话历史统一存于 ~/.lfaa\\sessions）。"
            : "Default location for chats outside any project (~/.lfaa; all chat histories stay in ~/.lfaa/sessions)."
        }
        control={(
          <>
            <span className={styles.pathText} title={outsidePath}>
              {middleTruncatePath(outsidePath, 30)}
            </span>
            <button type="button" className={styles.actionBtn} onClick={onPickOutsideFolder}>
              {isZh ? "更改" : "Change"}
            </button>
          </>
        )}
      />
      <SettingRow
        title={isZh ? "默认新建项目目录" : "Default new-project folder"}
        description={
          isZh
            ? "通过名称创建项目且不添加源文件夹时，将自动在此目录下新建同名项目文件夹（仅存项目本身，不存会话）。"
            : "When creating a named project without picking a folder, a subfolder is created here (projects only, no chat history)."
        }
        control={(
          <>
            <span className={styles.pathText} title={projectsBasePath}>
              {middleTruncatePath(projectsBasePath, 30)}
            </span>
            <button type="button" className={styles.actionBtn} onClick={onPickDefaultProjectsFolder}>
              {isZh ? "更改" : "Change"}
            </button>
          </>
        )}
      />
      <SettingRow
        title={isZh ? "默认文件打开位置" : "Default file opener"}
        description={isZh ? "默认打开文件和文件夹的位置" : "Where files and folders open by default"}
        control={(
          <SettingSelect
            value={cfg.defaultFileOpener}
            label={isZh ? "默认文件打开位置" : "Default file opener"}
            options={[
              {
                value: "antigravity",
                label: "Antigravity",
                icon: <IconCode size={15} style={{ color: "#60a5fa" }} aria-hidden="true" />,
              },
              {
                value: "system",
                label: isZh ? "默认应用" : "Default app",
                icon: <IconAppWindow size={15} style={{ color: "#fbbf24" }} aria-hidden="true" />,
              },
              {
                value: "explorer",
                label: "File Explorer",
                icon: <IconFolderFilled size={15} style={{ color: "#f59e0b" }} aria-hidden="true" />,
              },
              {
                value: "vscode",
                label: "VS Code",
                icon: <IconCode size={15} style={{ color: "#38bdf8" }} aria-hidden="true" />,
              },
              {
                value: "cursor",
                label: "Cursor",
                icon: <IconTerminal2 size={15} style={{ color: "#a78bfa" }} aria-hidden="true" />,
              },
            ]}
            onChange={(defaultFileOpener) => onPatch({ defaultFileOpener })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "智能体环境" : "Agent environment"}
        description={isZh ? "选择智能体在 Windows 上的运行位置" : "Choose where Agent commands execute on Windows"}
        control={(
          <SettingSelect
            value={cfg.agentEnvironment}
            label={isZh ? "智能体环境" : "Agent environment"}
            options={[
              {
                value: "windows_native",
                label: isZh ? "Windows 原生" : "Windows Native",
                description: isZh ? "直接在 Windows 中运行智能体" : "Run Agent directly in Windows",
              },
              {
                value: "wsl",
                label: isZh ? "适用于 Linux 的 Windows 子系统" : "Windows Subsystem for Linux",
                description: isZh ? "在 WSL 中运行智能体" : "Run Agent inside WSL",
              },
              {
                value: "auto",
                label: isZh ? "自动检测" : "Auto-detect",
                description: isZh ? "根据工作区路径自动选择" : "Select automatically by workspace path",
              },
            ]}
            onChange={(agentEnvironment) => onPatch({ agentEnvironment })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "集成终端 Shell" : "Integrated terminal shell"}
        description={isZh ? "选择要在集成终端中打开的 Shell。" : "Choose which shell opens in the integrated terminal."}
        control={(
          <SettingSelect
            value={cfg.integratedShell}
            label={isZh ? "集成终端 Shell" : "Integrated terminal shell"}
            options={[
              { value: "powershell", label: "PowerShell" },
              { value: "cmd", label: "Command Prompt" },
              { value: "git_bash", label: "Git Bash" },
              { value: "wsl", label: "WSL" },
            ]}
            onChange={(integratedShell) => onPatch({ integratedShell })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "语言" : "Language"}
        description={isZh ? "应用界面语言" : "Application display language"}
        control={(
          <SettingSelect
            value={cfg.language}
            label={isZh ? "语言" : "Language"}
            searchPlaceholder={isZh ? "搜索语言" : "Search language"}
            options={[
              { value: "system", label: isZh ? "自动检测" : "Auto-detect" },
              { value: "zh", label: "简体中文" },
              { value: "zh-TW", label: "繁體中文（台灣）" },
              { value: "zh-HK", label: "繁體中文（香港）" },
              { value: "en", label: "English" },
              { value: "ja", label: "日本語" },
              { value: "ko", label: "한국어" },
              { value: "fr", label: "Français" },
              { value: "de", label: "Deutsch" },
              { value: "es", label: "Español" },
              { value: "pt", label: "Português" },
              { value: "ru", label: "Русский" },
            ]}
            onChange={(language) => onPatch({ language })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "关闭窗口前确认" : "Confirm before closing"}
        description={isZh ? "使用关闭标签页的快捷键导致窗口关闭时，显示警告" : "Warn when closing shortcut would close the window"}
        control={(
          <SettingSelect
            value={cfg.confirmBeforeClose}
            label={isZh ? "关闭窗口前确认" : "Confirm before closing"}
            options={[
              { value: "shortcut_only", label: isZh ? "仅在使用“关闭”快捷键时" : "Shortcut only" },
              { value: "always", label: isZh ? "始终确认" : "Always" },
              { value: "never", label: isZh ? "从不确认" : "Never" },
            ]}
            onChange={(confirmBeforeClose) => onPatch({ confirmBeforeClose })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "默认使用完整视图" : "Default to full view"}
        description={isZh ? "在新聊天中以完整视图打开内容标签页" : "Open content tabs in full view in new chats"}
        control={(
          <SettingSwitch
            checked={cfg.defaultFullView}
            label={isZh ? "默认使用完整视图" : "Default to full view"}
            onChange={(defaultFullView) => onPatch({ defaultFullView })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "登录时启动" : "Launch at login"}
        description={
          isZh
            ? (cfg.launchAtLogin ? "已记录偏好（桌面端生效；当前为 Web 模式）" : "关闭")
            : (cfg.launchAtLogin ? "Saved preference (Desktop mode; Web running)" : "Off")
        }
        control={(
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              onPatch({ launchAtLogin: !cfg.launchAtLogin });
              onShowNotice(
                isZh
                  ? "当前以本地 Web 模式运行，系统登录自启仅在桌面端有效；已保存偏好状态。"
                  : "Running in local Web mode; OS login startup applies to the desktop wrapper.",
              );
            }}
          >
            {isZh ? "打开“启动应用”" : "Open Startup Apps"}
          </button>
        )}
      />
      <SettingRow
        title={isZh ? "自动归档不活跃的聊天" : "Auto-archive inactive chats"}
        description={isZh ? "将一段时间未活动的本地聊天归档" : "Archive inactive local chats after a period"}
        control={(
          <SettingSelect
            value={cfg.autoArchiveInactive}
            label={isZh ? "自动归档不活跃的聊天" : "Auto-archive inactive chats"}
            options={[
              { value: "never", label: isZh ? "永不" : "Never" },
              { value: "7d", label: isZh ? "7 天后" : "After 7 days" },
              { value: "30d", label: isZh ? "30 天后" : "After 30 days" },
              { value: "90d", label: isZh ? "90 天后" : "After 90 days" },
            ]}
            onChange={(autoArchiveInactive) => onPatch({ autoArchiveInactive })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "压缩本地保存的聊天历史记录" : "Compress local chat history"}
        description={isZh ? "压缩较早的本地聊天历史记录，以节省磁盘空间。" : "Compress older local history to save disk space."}
        control={(
          <SettingSwitch
            checked={cfg.compressLocalHistory}
            label={isZh ? "压缩本地保存的聊天历史记录" : "Compress local chat history"}
            onChange={(compressLocalHistory) => onPatch({ compressLocalHistory })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "速度" : "Speed"}
        description={isZh ? "选择 LFAA 在聊天、子智能体和压缩中的运行速度" : "Choose LFAA response pacing across chats and compaction"}
        control={(
          <SettingSelect
            value={cfg.responseSpeed}
            label={isZh ? "速度" : "Speed"}
            options={[
              { value: "standard", label: isZh ? "标准" : "Standard" },
              { value: "fast", label: isZh ? "快速" : "Fast" },
              { value: "thorough", label: isZh ? "深度思考" : "Thorough" },
            ]}
            onChange={(responseSpeed) => onPatch({ responseSpeed })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "可用推理强度" : "Available reasoning levels"}
        description={isZh ? "选择在模型控件中显示哪些推理强度级别。可用性因模型而异" : "Choose which reasoning levels appear in model controls."}
        control={(
          <>
            <button
              type="button"
              className={styles.actionBtn}
              aria-expanded={reasoningOpen}
              onClick={() => setReasoningOpen((v) => !v)}
            >
              {isZh ? `已选择 ${cfg.reasoningLevels.length} 个` : `${cfg.reasoningLevels.length} selected`}
            </button>
            {reasoningOpen && (
              <div className={styles.popoverMenu} role="menu">
                {REASONING_OPTIONS.map((opt) => (
                  <label key={opt.value} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={cfg.reasoningLevels.includes(opt.value)}
                      onChange={() => toggleReasoningLevel(opt.value)}
                    />
                    <span>{isZh ? opt.zh : opt.en}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      />
      <SettingRow
        title={isZh ? "首页建议" : "Home suggestions"}
        description={isZh ? "通过搜索项目文件和已连接的应用，建议下一步操作" : "Show starter suggestions on empty home chats"}
        control={(
          <SettingSwitch
            checked={cfg.homeSuggestions}
            label={isZh ? "首页建议" : "Home suggestions"}
            onChange={(homeSuggestions) => onPatch({ homeSuggestions })}
          />
        )}
      />
      <SettingRow
        title={isZh ? "打开源许可证" : "Open-source licenses"}
        description={isZh ? "捆绑依赖项的第三方声明" : "Third-party notices for bundled dependencies"}
        control={(
          <button type="button" className={styles.actionBtn} onClick={onOpenLicenses}>
            {isZh ? "查看" : "View"}
          </button>
        )}
      />
      <SettingRow
        title={isZh ? "插件" : "Plugins"}
        description={isZh ? "允许 LFAA 使用已安装的插件" : "Allow LFAA to use installed Cordis plugins"}
        control={(
          <SettingSwitch
            checked={cfg.enablePlugins}
            label={isZh ? "插件" : "Plugins"}
            onChange={(enablePlugins) => onPatch({ enablePlugins })}
          />
        )}
      />
    </SettingGroupCard>
  );
}
