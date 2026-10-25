/** 功能：绘制 Electron Mini 窗口。作用：只呈现账户已保存的伙伴偏好，窗口生命周期由桌面 Host 管理。 */
import { Button, Typography } from "antd";
import type { CSSProperties } from "react";
import type { UserSettings } from "lfaa-client-connection/src/api.js";
import type { User } from "lfaa-client-connection/src/api.js";
import { appearanceTextFontStacks } from "lfaa-client-ui-theme/src/fonts.js";
import "./mini-companion-window.css";

const companionLabels: Record<UserSettings["mini"]["companion"], string> = { moss: "苔影", cloud: "云朵", ember: "微光" };

export function MiniCompanionWindow({ user, settings }: { user: User; settings: UserSettings }) {
  const resolvedTheme = settings.appearance.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : settings.appearance.theme;
  const appearance = settings.appearance.advanced;
  const fonts = appearance.separateModes ? appearance.modeStyles[resolvedTheme].fonts : appearance.fonts;
  const accentColor = appearance.separateModes ? appearance.modeStyles[resolvedTheme].accentColor : settings.appearance.accentColor;
  const surfaceColor = resolvedTheme === "dark" ? "#202020" : "#ffffff";
  const miniStyle: CSSProperties = {
    color: resolvedTheme === "dark" ? "#f7f7f7" : "#171717",
    fontFamily: appearanceTextFontStacks[fonts.interface],
    fontSize: `${appearance.interfaceFontSize}px`,
    backgroundColor: `color-mix(in srgb, ${surfaceColor} ${settings.appearance.overlay}%, transparent)`,
    backdropFilter: `blur(${settings.appearance.blur}px)`,
    WebkitBackdropFilter: `blur(${settings.appearance.blur}px)`
  };
  return <main className={`mini-companion mini-companion--${settings.mini.companion}`} data-theme={resolvedTheme} aria-label="LFAA Mini 虚拟伙伴" style={miniStyle}>
    <header className="mini-companion__drag-region"><Typography.Text strong>LFAA</Typography.Text><span>{companionLabels[settings.mini.companion]}</span><Button aria-label="关闭 Mini 窗口" type="text" onClick={() => void window.lfaaDesktop?.mini.close()}>×</Button></header>
    <section className="mini-companion__body">
      {settings.mini.showCompanion ? <svg className="mini-companion__creature" style={{ color: accentColor }} viewBox="0 0 160 140" role="img" aria-label={`${companionLabels[settings.mini.companion]}虚拟伙伴`}>
        <path className="mini-companion__shape" d="M22 76c0-36 25-59 58-59 35 0 58 23 58 59 0 32-21 50-58 50S22 108 22 76Z" />
        <path className="mini-companion__ear" d="m39 46-9-20 25 10m66 10 9-20-25 10" />
        <ellipse className="mini-companion__eye" cx="59" cy="73" rx="5" ry="7" />
        <ellipse className="mini-companion__eye" cx="101" cy="73" rx="5" ry="7" />
        <path className="mini-companion__smile" d="M68 91c7 8 17 8 24 0" />
        <circle className="mini-companion__cheek" cx="43" cy="88" r="7" />
        <circle className="mini-companion__cheek" cx="117" cy="88" r="7" />
      </svg> : <div className="mini-companion__hidden">伙伴已隐藏</div>}
      <div className="mini-companion__copy"><Typography.Title level={4}>你好，{user.username}</Typography.Title><Typography.Text type="secondary">我在这里陪你工作。</Typography.Text></div>
    </section>
    <footer className="mini-companion__footer"><Typography.Text type="secondary">偏好来自 LFAA 设置中心</Typography.Text><Button onClick={() => void window.lfaaDesktop?.mini.close()}>收起</Button></footer>
  </main>;
}
