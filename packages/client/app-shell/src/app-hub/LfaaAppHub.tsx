/**
 * 文件：packages/client/app-shell/src/app-hub/LfaaAppHub.tsx
 * 作用：登录后的 LFAA 应用展台，展示“门”而不是直接进入某个 Chat/Work 页面。
 * 负责：应用分类、App Pack 入口卡片、当前用户摘要、进入可用应用与退出登录。
 * 不负责：App Pack Runtime、Capability Scope、项目/Session、插件 Registry 解析、Agent 执行。
 * 状态归属：无长期状态；入口清单由上层 Composition 注入，未来改由 App Pack Registry 生成。
 * 对外接口：LfaaAppHub、AppHubEntry。
 * 关联文件：packages/client/web/src/App.tsx、@lfaa/plugin-runtime、AgentWorkbench.tsx。
 * 修改注意事项：未接入真实 App Pack 的入口必须标记 unavailable，禁止用通用 Workbench 冒充已实现业务能力。
 */
import type { LfaaAuthenticatedUser } from "@lfaa/identity";
import styles from "./AppHub.module.css";

export interface AppHubEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly glyph: string;
  readonly available: boolean;
  readonly badge?: string;
}

export function LfaaAppHub({ identity, entries, onEnter, onLogout }: { identity: LfaaAuthenticatedUser; entries: readonly AppHubEntry[]; onEnter: (entry: AppHubEntry) => void; onLogout: () => void }) {
  const categories = [...new Set(entries.map((item) => item.category))];
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.brand}><span>L</span><strong>LFAA</strong></div><div className={styles.user}><span className={styles.avatar}>{identity.user.displayName.slice(0,1).toUpperCase()}</span><span><strong>{identity.user.displayName}</strong><small>{identity.roles.map((role)=>role.name).join(" · ")}</small></span><button type="button" onClick={onLogout}>退出</button></div></header>
    <section className={styles.hero}><p>YOUR AI WORKSPACE</p><h1>{identity.user.displayName}，我能帮你做什么？</h1><span>选择一个工作区入口。每个应用拥有独立的业务边界，而 Chat、Work、Manual 与无限画布由 LFAA 核心统一提供。</span></section>
    <div className={styles.sections}>{categories.map((category)=><section key={category} className={styles.section}><div className={styles.sectionHeader}><h2>{category}</h2><span>{entries.filter((item)=>item.category===category).length} 个入口</span></div><div className={styles.grid}>{entries.filter((item)=>item.category===category).map((entry)=><button key={entry.id} type="button" className={styles.card} data-disabled={!entry.available} disabled={!entry.available} onClick={()=>onEnter(entry)}><span className={styles.glyph}>{entry.glyph}</span><span className={styles.cardBody}><span className={styles.cardTitle}><strong>{entry.title}</strong>{entry.badge?<small>{entry.badge}</small>:null}</span><span>{entry.description}</span></span><span className={styles.arrow}>{entry.available?"↗":"·"}</span></button>)}</div></section>)}</div>
    <footer className={styles.footer}><span>Instance secured by local Identity Gate</span><span>Chat · Work · Manual · Canvas share one LFAA Core</span></footer>
  </main>;
}
