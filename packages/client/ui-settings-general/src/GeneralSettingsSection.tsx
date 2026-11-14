/**
 * 功能：呈现设置中心的通用偏好表单。
 * 作用：只负责通用设置控件与布局，将保存、导航和数据读取交回 SettingsPage 协调层。
 * 关联文件：packages/client/ui-settings/src/SettingsPage.tsx、default-settings.ts、general-settings.css。
 */
import { Button, Input, Select, Typography } from "antd";
import type { UserSettings } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow, SettingsSwitch } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { UI_MOTION_EFFECT_OPTIONS, type UiMotionEffect } from "lfaa-util-values/src/settings-contract.js";
import { DEFAULT_USER_SETTINGS } from "./default-settings.js";
import "./general-settings.css";

interface GeneralSettingsSectionProps {
  settings: UserSettings["general"];
  defaultWorkspaceLocation: { status: "loading" | "ready" | "error"; path: string | null; error: string };
  onUpdate: (patch: Partial<UserSettings["general"]>) => void;
  onSelectPermissions: () => void;
  onRetryDefaultWorkspace: () => void;
  onNavigate: (path: string) => void;
  onOpenLicenses: () => void;
}

function MotionEffectSelector({ ariaLabel, previewKind, value, onChange }: {
  ariaLabel: string;
  previewKind: "card" | "dialog";
  value: UiMotionEffect;
  onChange: (effect: UiMotionEffect) => void;
}) {
  return <div
    className="settings-motion-options"
    role="radiogroup"
    aria-label={ariaLabel}
    onKeyDown={(event) => {
      const selectedIndex = UI_MOTION_EFFECT_OPTIONS.findIndex(({ id }) => id === value);
      const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      const nextIndex = (selectedIndex + delta + UI_MOTION_EFFECT_OPTIONS.length) % UI_MOTION_EFFECT_OPTIONS.length;
      const nextEffect = UI_MOTION_EFFECT_OPTIONS[nextIndex];
      if (!nextEffect) return;
      onChange(nextEffect.id);
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='radio']")[nextIndex]?.focus();
    }}
  >
    {UI_MOTION_EFFECT_OPTIONS.map((effect) => {
      const selected = value === effect.id;
      const description = previewKind === "card" ? effect.cardDescription : effect.dialogDescription;
      return <button
        key={effect.id}
        type="button"
        role="radio"
        className={`settings-motion-option${selected ? " is-selected" : ""}`}
        aria-label={`${effect.label}：${description}`}
        aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        onClick={() => onChange(effect.id)}
      >
        <span className={`settings-motion-option__preview settings-motion-option__preview--${previewKind} settings-motion-option__preview--${effect.id}`} aria-hidden="true">
          {previewKind === "card" ? <><i /><i /><i /></> : <><i /><i /></>}
        </span>
        <strong>{effect.label}</strong>
        <small>{description}</small>
      </button>;
    })}
  </div>;
}

export function GeneralSettingsSection({ settings, defaultWorkspaceLocation, onUpdate, onSelectPermissions, onRetryDefaultWorkspace, onNavigate, onOpenLicenses }: GeneralSettingsSectionProps) {
  return (
    <section className="settings-content">
      <header className="settings-content__heading"><div><Typography.Title level={2}>常规</Typography.Title></div></header>
      <SettingGroup title="访问边界">
        <SettingRow title="小鱼智能体 项目权限模式" description="完全权限下，模型可自主执行当前应用的全部项目操控，不再逐项审批；实际操作由项目 Runtime 与对应 Host/Daemon 执行。" status="账户级设置">
          <Button onClick={onSelectPermissions}>管理权限</Button>
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="常规">
        <SettingRow title="项目外聊天文件夹" description="项目外新聊天默认归入此工作区；会话记录仍保存在 LFAA 的 .lfaa 数据目录中。">
          <div className="settings-folder-value" title={defaultWorkspaceLocation.path ?? (defaultWorkspaceLocation.error || "默认工作区尚未初始化")}>
            <span>{defaultWorkspaceLocation.status === "loading" ? "正在读取…" : defaultWorkspaceLocation.status === "error" ? "读取失败" : defaultWorkspaceLocation.path ?? "默认工作区尚未初始化"}</span>
            <Button disabled={defaultWorkspaceLocation.status === "loading"} onClick={() => defaultWorkspaceLocation.status === "error" ? onRetryDefaultWorkspace() : onNavigate("/work")}>
              {defaultWorkspaceLocation.status === "error" ? "重试" : "管理工作区"}
            </Button>
          </div>
        </SettingRow>
        <SettingRow title="默认文件打开位置" description="选择文件操作使用系统默认应用，或在执行时再询问。">
          <Select value={settings.fileOpenLocation} options={[{ value: "system", label: "系统默认应用" }, { value: "ask", label: "每次询问" }]} onChange={(value) => onUpdate({ fileOpenLocation: value })} />
        </SettingRow>
        <SettingRow title="智能体环境" description="选择 Agent Runtime 执行任务时使用的主机环境；节点能力接入后生效。">
          <Select value={settings.agentEnvironment} options={[{ value: "system", label: "自动检测" }, { value: "windows-native", label: "Windows 原生" }, { value: "wsl", label: "WSL" }, { value: "linux", label: "Linux" }]} onChange={(value) => onUpdate({ agentEnvironment: value })} />
        </SettingRow>
        <SettingRow title="集成终端 Shell" description="新建终端与未单独指定 Shell 的命令使用此选择；切换后，已打开的终端需新建会话才会生效。">
          <Select value={settings.integratedShell} options={[{ value: "system", label: "系统默认" }, { value: "powershell", label: "Windows PowerShell" }, { value: "cmd", label: "命令提示符" }, { value: "bash", label: "Bash" }, { value: "zsh", label: "Zsh" }]} onChange={(value) => onUpdate({ integratedShell: value })} />
        </SettingRow>
        <SettingRow title="语言" description="当前界面提供简体中文；其他语言需前端翻译资源接入后生效。">
          <Select value={settings.language} options={[{ value: "system", label: "自动检测" }, { value: "zh-CN", label: "简体中文" }, { value: "en-US", label: "English" }]} onChange={(value) => onUpdate({ language: value })} />
        </SettingRow>
        <SettingRow title="默认使用完整视图" description="保存新工作区优先使用完整布局的偏好；当前应用工作区已使用完整视图。">
          <SettingsSwitch label="默认使用完整视图" checked={settings.defaultFullView} onChange={() => onUpdate({ defaultFullView: !settings.defaultFullView })} />
        </SettingRow>
        <SettingRow title="底部面板" description="在应用工作区标题栏显示底部终端面板入口。">
          <SettingsSwitch label="底部面板入口" checked={settings.showBottomPanelControl} onChange={() => onUpdate({ showBottomPanelControl: !settings.showBottomPanelControl })} />
        </SettingRow>
        <SettingRow title="默认终端位置" description="选择节点任务输出面板的位置，可显示在底部或右侧；交互式终端的 Shell 由上方设置控制。">
          <Select value={settings.terminalPosition} options={[{ value: "bottom", label: "底部面板" }, { value: "right", label: "右侧面板" }]} onChange={(value) => onUpdate({ terminalPosition: value })} />
        </SettingRow>
        <SettingRow title="开源许可证" description="查看 LFAA 前端直接依赖的许可证声明。">
          <Button onClick={onOpenLicenses}>打开许可证</Button>
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="工作台导航布局">
        <SettingRow title="应用导航栏布局" description="选择应用侧栏、工作区和工具栏的预设排列；可继续拖动分隔线调整宽度。">
          <div className="settings-layout-options" role="group" aria-label="应用导航栏布局">
            {([
              ["left-two-column", "左右布局", "左侧应用导航与主工作区"],
              ["three-column", "三列布局", "左侧导航、主工作区与右侧工具"],
              ["right-tools", "工作区 + 工具", "主工作区与右侧工具"],
              ["focus", "专注模式", "仅显示工作区"]
            ] as const).map(([layout, title, description]) => (
              <button key={layout} type="button" className={`settings-layout-option${settings.navigationLayout === layout ? " is-selected" : ""}`} aria-pressed={settings.navigationLayout === layout} onClick={() => onUpdate({ navigationLayout: layout })}>
                <span className={`settings-layout-option__preview settings-layout-option__preview--${layout}`} aria-hidden="true"><i /><i /><i /></span>
                <strong>{title}</strong><small>{description}</small>
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="界面动效">
        <SettingRow title="卡片动效" description="统一控制已接入共享动效的卡片。普通卡片加入共享标记即可使用；减少动态效果偏好优先生效。">
          <MotionEffectSelector
            ariaLabel="卡片动画效果"
            previewKind="card"
            value={settings.cardMotionEffect ?? DEFAULT_USER_SETTINGS.general.cardMotionEffect}
            onChange={(cardMotionEffect) => onUpdate({ cardMotionEffect })}
          />
        </SettingRow>
        <SettingRow title="弹窗动效" description="统一控制应用对话框、确认弹窗和确认气泡；减少动态效果偏好优先。">
          <MotionEffectSelector
            ariaLabel="弹窗动画效果"
            previewKind="dialog"
            value={settings.dialogMotionEffect ?? DEFAULT_USER_SETTINGS.general.dialogMotionEffect}
            onChange={(dialogMotionEffect) => onUpdate({ dialogMotionEffect })}
          />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="编辑器">
        <SettingRow title="纯文本编辑器" description="在写作编辑器接入后，按纯文本方式编辑内容。">
          <SettingsSwitch label="纯文本编辑器" checked={settings.plainTextEditor} onChange={() => onUpdate({ plainTextEditor: !settings.plainTextEditor })} />
        </SettingRow>
        <SettingRow title="发送快捷键" description="设置 小鱼智能体 输入框按 Enter 时发送，或插入新行。">
          <Select value={settings.sendShortcut} options={[{ value: "enter", label: "Enter 发送" }, { value: "ctrl-enter", label: "Ctrl + Enter 发送" }]} onChange={(value) => onUpdate({ sendShortcut: value })} />
        </SettingRow>
        <SettingRow title="跟进处理方式" description="小鱼智能体 正在运行时，选择后续消息排队或引导当前任务。">
          <Select value={settings.followupBehavior} options={[{ value: "queue", label: "加入队列" }, { value: "steer", label: "引导当前运行" }]} onChange={(value) => onUpdate({ followupBehavior: value })} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="弹出窗口">
        <SettingRow title="弹出窗口快捷键" description="为桌面弹出窗口保存全局快捷键；不设置则保持关闭。">
          <Input value={settings.popupShortcut} placeholder="关闭" maxLength={48} onChange={(event) => onUpdate({ popupShortcut: event.target.value })} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="趣味实验">
        <SettingRow title="彩纸礼炮" description="任务完成时显示彩纸效果；需要任务完成事件和桌面动效接入。">
          <SettingsSwitch label="彩纸礼炮" checked={settings.confettiEnabled} onChange={() => onUpdate({ confettiEnabled: !settings.confettiEnabled })} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="LFAA 工作台">
        <SettingRow title="默认首页" description="登录后直接进入小鱼智能体对话；专业应用可从左侧应用菜单打开。">
          <Typography.Text>小鱼智能体</Typography.Text>
        </SettingRow>
        <SettingRow title="服务连接状态" description="控制工作台顶栏和左侧导航中的控制端连接状态显示。">
          <SettingsSwitch label="服务连接状态" checked={settings.showServiceStatus} onChange={() => onUpdate({ showServiceStatus: !settings.showServiceStatus })} />
        </SettingRow>
      </SettingGroup>
    </section>
  );
}
