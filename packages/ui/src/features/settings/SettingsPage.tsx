/**
 * 文件：SettingsPage.tsx
 * 作用：LFAA 可复用独立设置中心。
 * 负责：设置左侧导航、搜索、右侧分类内容与 AI 设置嵌入。
 * 不负责：工作台三栏布局、Config/Secret 真值、厂商网络请求。
 * 状态归属：仅拥有导航搜索输入；当前分类与业务 ViewModel 由外部受控。
 * 对外接口：SettingsPage。
 * 关联文件：settings.types.ts、settings.css、ai/AiSettingsPanel.tsx。
 */
import { useMemo, useState } from "react";
import { AiSettingsPanel } from "./ai/AiSettingsPanel";
import type { SettingsPageProps, SettingsSectionId } from "./settings.types";
import "./settings.css";

const navigation: readonly { id: SettingsSectionId; label: string; group: "个人" | "配置" | "开发"; glyph: string }[] = [
  { id: "general", label: "常规", group: "个人", glyph: "○" },
  { id: "appearance", label: "外观", group: "个人", glyph: "◐" },
  { id: "ai", label: "AI 服务", group: "配置", glyph: "✦" },
  { id: "permissions", label: "权限", group: "配置", glyph: "◇" },
  { id: "workspace", label: "项目与存储", group: "配置", glyph: "□" },
  { id: "developer", label: "开发者", group: "开发", glyph: "⌘" },
];

function GeneralPanel() {
  return <section className="lfaa-settings-content"><header><h1>常规</h1><p>管理 LFAA 的基础工作区体验。</p></header><div className="lfaa-settings-card"><div><strong>设置显示方式</strong><small>设置中心使用独立界面，不占用工作台中间区域。</small></div><span>独立页面</span></div><div className="lfaa-settings-card"><div><strong>界面语言</strong><small>当前开发参考语言。</small></div><span>简体中文</span></div></section>;
}

function AppearancePanel({ value, onChange }: { value: SettingsPageProps["themePreference"]; onChange: SettingsPageProps["onThemePreferenceChange"] }) {
  const items = [
    ["system", "跟随系统", "Windows / macOS / Linux 外观变化时自动切换"],
    ["light", "浅色", "始终使用浅色界面"],
    ["dark", "深色", "始终使用深色界面"],
  ] as const;
  return <section className="lfaa-settings-content"><header><h1>外观</h1><p>选择工作台与设置中心的主题模式。</p></header><div className="lfaa-theme-options">{items.map(([id,label,description])=><button type="button" key={id} className={value===id?"is-active":""} onClick={()=>onChange(id)}><span><strong>{label}</strong><small>{description}</small></span><i aria-hidden="true" /></button>)}</div></section>;
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return <section className="lfaa-settings-content"><header><h1>{title}</h1><p>{description}</p></header><div className="lfaa-settings-empty"><strong>尚未进入本阶段实现</strong><p>此区域保留在正确的设置分类中，后续业务模块接入时无需重做导航结构。</p></div></section>;
}

export function SettingsPage(props: SettingsPageProps) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = normalized ? navigation.filter((item) => item.label.toLocaleLowerCase().includes(normalized)) : navigation;
    return (["个人", "配置", "开发"] as const).map((group) => ({ group, items: filtered.filter((item) => item.group === group) })).filter((entry) => entry.items.length > 0);
  }, [query]);

  let content;
  if (props.activeSection === "appearance") content = <AppearancePanel value={props.themePreference} onChange={props.onThemePreferenceChange} />;
  else if (props.activeSection === "ai") content = <section className="lfaa-settings-content lfaa-settings-content--ai"><header><h1>AI 服务</h1><p>管理 Provider、认证方式和模型配置入口。</p></header><AiSettingsPanel providers={props.aiProviders} selectedProviderId={props.selectedAiProviderId} onSelectProvider={props.onSelectAiProvider} /></section>;
  else if (props.activeSection === "permissions") content = <PlaceholderPanel title="权限" description="配置默认权限策略与后续 Ask / Auto / Full 行为。" />;
  else if (props.activeSection === "workspace") content = <PlaceholderPanel title="项目与存储" description="管理项目目录、配置存储与本地数据位置。" />;
  else if (props.activeSection === "developer") content = <PlaceholderPanel title="开发者" description="集中放置开发模式、诊断与高级工具设置。" />;
  else content = <GeneralPanel />;

  return (
    <main className="lfaa-settings-page" aria-label="设置中心">
      <aside className="lfaa-settings-sidebar">
        <button className="lfaa-settings-back" type="button" onClick={props.onClose}>← <span>返回应用</span></button>
        <label className="lfaa-settings-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="搜索设置…" aria-label="搜索设置" /></label>
        <nav aria-label="设置分类">{groups.map(({group,items})=><section key={group}><h2>{group}</h2>{items.map((item)=><button type="button" key={item.id} className={props.activeSection===item.id?"is-active":""} onClick={()=>props.onSectionChange(item.id)}><span aria-hidden="true">{item.glyph}</span><strong>{item.label}</strong></button>)}</section>)}</nav>
      </aside>
      <div className="lfaa-settings-main">{content}</div>
    </main>
  );
}
