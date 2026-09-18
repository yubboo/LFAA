/**
 * 文件：InkWorkbench.tsx
 * 作用：组合 LFAA Web/Desktop 共用的水墨工作台壳。
 * 负责：页面编排与演示态内容。
 * 不负责：Agent、Config、资源 Registry 的事实状态。
 */
import { ResizableWorkbench } from "@lfaa/ui";
import type { DevResourceItem, InkWorkbenchProps, ResourceKind } from "./workbench.types";
import "./ink-workbench.css";

const recentRuns = ["整理配置系统边界", "本地资源热插拔测试", "桌面端壳层规划", "模型路由研究"];
const resourceLabels: Record<ResourceKind, string> = {
  skills: "Skills",
  experts: "Experts",
  plugins: "Plugins",
  extensions: "Extensions",
  mcp: "MCP",
};

function LeftSidebar() {
  return (
    <div className="ink-side ink-side--left">
      <div className="ink-brand"><span className="ink-brand__mark">鱼</span><div><strong>小鱼</strong><span>LFAA 工作台</span></div></div>
      <button className="ink-primary" type="button"><span>＋</span> 新建任务</button>
      <label className="ink-search"><span>⌕</span><input aria-label="搜索" placeholder="搜索会话、项目、资源" /></label>
      <nav className="ink-nav" aria-label="主导航">
        <button className="is-active" type="button"><span>◫</span> 工作区</button>
        <button type="button"><span>◇</span> 智能体</button>
        <button type="button"><span>⌘</span> 工具与技能</button>
        <button type="button"><span>◎</span> 知识库</button>
      </nav>
      <div className="ink-section-head"><span>最近</span><button type="button">•••</button></div>
      <div className="ink-history">
        {recentRuns.map((item, index) => <button type="button" key={item} className={index === 0 ? "is-current" : ""}>{item}<small>{index === 0 ? "刚刚" : `${index + 1} 小时前`}</small></button>)}
      </div>
      <div className="ink-profile"><span className="ink-avatar">二</span><div><strong>二鱼</strong><small>本地工作区</small></div><button type="button">⌄</button></div>
    </div>
  );
}

function CenterWorkspace() {
  return (
    <section className="ink-center">
      <header className="ink-topbar">
        <div><span className="ink-kicker">LOCAL WORKSPACE</span><h1>墨舟 · 本地工作区</h1></div>
        <div className="ink-top-actions"><span className="ink-status"><i /> Vite 本地开发</span><button type="button">分享</button><button type="button">•••</button></div>
      </header>
      <div className="ink-scroll">
        <div className="ink-hero">
          <div className="ink-mountain" aria-hidden="true" />
          <span className="ink-seal">小鱼</span>
          <p>今日工作区</p>
          <h2>把复杂工作，收进一方留白。</h2>
          <span>三栏工作台已进入 UI 验证阶段。左右栏可以自由拉伸，也可以吸附收起。</span>
        </div>
        <div className="ink-grid">
          <article><span className="ink-card-icon">文</span><div><strong>配置系统</strong><p>当前主业务模块 · 下一步 Config Schema</p></div><em>planned</em></article>
          <article><span className="ink-card-icon">插</span><div><strong>热插拔测试</strong><p>观察 .lfaa 资源变化并实时刷新</p></div><em>dev</em></article>
          <article><span className="ink-card-icon">界</span><div><strong>工作台布局</strong><p>Resize · Snap · Collapse · Responsive</p></div><em>active</em></article>
        </div>
        <div className="ink-thread">
          <div className="ink-message ink-message--user"><span>你</span><div>先把 UI 做出来，我要在 Web 端做本地热插拔测试。</div></div>
          <div className="ink-message ink-message--agent"><span>鱼</span><div><p>工作台壳已经切到三栏结构。左边负责导航和会话，中间保持工作区主视野，右边专门观察 Skills / Plugins / MCP 等项目资源。</p><div className="ink-inline-note"><i /> 拖动两侧分隔条试试；靠近边缘会自动吸附收起。</div></div></div>
        </div>
      </div>
      <div className="ink-composer-wrap">
        <div className="ink-composer"><textarea aria-label="输入任务" placeholder="给小鱼一个任务……" rows={1} /><div><button type="button">＋</button><span>本地 · Ask</span><button className="ink-send" type="button">↑</button></div></div>
        <small>本地开发壳 · UI 状态只保存在浏览器 · Secret 不进入 Web</small>
      </div>
    </section>
  );
}

function groupResources(resources: readonly DevResourceItem[]) {
  return (Object.keys(resourceLabels) as ResourceKind[]).map((kind) => ({
    kind,
    items: resources.filter((resource) => resource.kind === kind),
  }));
}

function RightSidebar({ resources = [], resourceBridgeStatus = "offline" }: InkWorkbenchProps) {
  const groups = groupResources(resources);
  return (
    <div className="ink-side ink-side--right">
      <div className="ink-resource-head"><div><span className="ink-kicker">HOT PLUG</span><h2>资源舱</h2></div><span className={`ink-bridge ink-bridge--${resourceBridgeStatus}`}><i />{resourceBridgeStatus === "connected" ? "已连接" : resourceBridgeStatus === "refreshing" ? "刷新中" : "未连接"}</span></div>
      <div className="ink-resource-summary"><div><strong>{resources.length}</strong><span>已发现资源</span></div><button type="button" disabled title="当前 Web 开发桥接只读">只读监听</button></div>
      <div className="ink-resource-groups">
        {groups.map(({ kind, items }) => (
          <section key={kind}>
            <header><span>{resourceLabels[kind]}</span><b>{items.length}</b></header>
            {items.length === 0 ? <p className="ink-empty">等待资源放入 .lfaa/{kind}</p> : items.map((item) => <div className="ink-resource" key={`${kind}:${item.relativePath}`}><span>{item.entryType === "directory" ? "◇" : "·"}</span><div><strong>{item.name}</strong><small>{item.relativePath}</small></div><i /></div>)}
          </section>
        ))}
      </div>
      <div className="ink-dev-note"><strong>开发桥接</strong><p>Vite 只读取资源名称与相对路径，不读取正文、Token 或 Secret。</p></div>
    </div>
  );
}

export function InkWorkbench(props: InkWorkbenchProps) {
  return <ResizableWorkbench left={<LeftSidebar />} center={<CenterWorkspace />} right={<RightSidebar {...props} />} />;
}
