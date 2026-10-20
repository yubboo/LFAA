/**
 * 功能：在设置中心呈现 LFAA 项目内开发手册。
 * 作用：把工作台区域图、开发专题与实现/验收说明做成可浏览页面，不新增设置或远端读取。
 * 关联文件：developer-handbook-content.ts、SettingsPage.tsx、SettingsPage.css。
 */
import { useState } from "react";
import { Button } from "antd";
import { developerHandbookSections } from "./developer-handbook-content.js";
import "./DeveloperHandbook.css";

interface DeveloperHandbookProps {
  onBack: () => void;
}

export function DeveloperHandbook({ onBack }: DeveloperHandbookProps) {
  const [activeId, setActiveId] = useState("overview");
  const activeSection = developerHandbookSections.find((section) => section.id === activeId) ?? developerHandbookSections[0]!;
  const overview = developerHandbookSections[0]!;

  return (
    <section className="developer-handbook" aria-labelledby="developer-handbook-title">
      <header className="developer-handbook__header">
        <div className="developer-handbook__heading">
          <Button type="text" className="developer-handbook__back" onClick={onBack}>← 返回关于与更新</Button>
          <span className="developer-handbook__eyebrow">LFAA · 项目内开发资料</span>
          <h1 id="developer-handbook-title">开发手册</h1>
          <p>按实际界面区域阅读入口、Owner、数据与配置关系、实现方式和验收记录。正文同时以结构化源码供 AI 检索。</p>
        </div>
        <div className="developer-handbook__header-mark" aria-hidden="true">
          <span>UI</span>
          <span>OWNER</span>
          <span>EVIDENCE</span>
        </div>
      </header>

      <section className="developer-handbook__map-card" aria-labelledby="developer-handbook-map-title">
        <div className="developer-handbook__section-heading">
          <div>
            <span className="developer-handbook__eyebrow">界面地图</span>
            <h2 id="developer-handbook-map-title">工作台从左到右</h2>
          </div>
          <p>选择一块区域，直接查看它解决的问题和对应源码。</p>
        </div>
        <div className="developer-handbook__map" role="group" aria-label="LFAA 工作台区域地图">
          {["global-navigation", "secondary-navigation", "center-workspace", "right-dock"].map((id, index) => {
            const labels = ["左一", "左二", "中间", "右侧"];
            const descriptions = ["全局导航轨", "当前工作区导航", "主要工作区", "上下文 Dock"];
            return <button
              key={id}
              type="button"
              className={`developer-handbook__map-lane developer-handbook__map-lane--${index + 1}${activeId === id ? " is-active" : ""}`}
              aria-pressed={activeId === id}
              onClick={() => setActiveId(id)}
            >
              <span className="developer-handbook__map-number">0{index + 1}</span>
              <strong>{labels[index]}</strong>
              <span>{descriptions[index]}</span>
            </button>;
          })}
        </div>
        <div className="developer-handbook__map-caption">
          <span>页面内容由 Workbench 装配</span>
          <span>栏宽与收起行为由 DockKit 管理</span>
          <button type="button" onClick={() => setActiveId("settings-center")}>设置中心专题 →</button>
        </div>
      </section>

      <div className="developer-handbook__body">
        <nav className="developer-handbook__toc" aria-label="开发手册目录">
          <span className="developer-handbook__toc-label">阅读专题</span>
          {developerHandbookSections.map((section) => <button
            key={section.id}
            type="button"
            className={`developer-handbook__toc-item${activeId === section.id ? " is-active" : ""}`}
            aria-current={activeId === section.id ? "page" : undefined}
            onClick={() => setActiveId(section.id)}
          >
            <span>{section.shortTitle}</span>
            <span aria-hidden="true">↗</span>
          </button>)}
          <div className="developer-handbook__toc-note">
            <strong>给 AI 的入口</strong>
            <p>本页专题原文位于 ui-settings 的结构化内容文件；功能现状和历史证据以源码、架构文档和任务合同为准。</p>
          </div>
        </nav>

        <article className="developer-handbook__article" aria-live="polite">
          <header className="developer-handbook__article-heading">
            <span className="developer-handbook__eyebrow">{activeSection.eyebrow}</span>
            <h2>{activeSection.title}</h2>
            <p>{activeSection.summary}</p>
          </header>

          {activeId === overview.id ? <section className="developer-handbook__overview-grid" aria-label="工作台区域职责">
            {overview.implementation.map((point, index) => <button
              key={point.label}
              type="button"
              className="developer-handbook__overview-card"
              onClick={() => setActiveId(["global-navigation", "secondary-navigation", "center-workspace", "right-dock"][index]!)}
            >
              <span>0{index + 1}</span>
              <strong>{point.label}</strong>
              <span>{point.detail}</span>
            </button>)}
          </section> : null}

          <section className="developer-handbook__problem" aria-labelledby="developer-handbook-problem-title">
            <span className="developer-handbook__card-index">01 / 问题</span>
            <h3 id="developer-handbook-problem-title">它要解决什么</h3>
            <p>{activeSection.problem}</p>
          </section>

          <section className="developer-handbook__owner" aria-labelledby="developer-handbook-owner-title">
            <span className="developer-handbook__card-index">02 / 责任边界</span>
            <h3 id="developer-handbook-owner-title">组件与 Owner</h3>
            <p>{activeSection.owner}</p>
          </section>

          <section className="developer-handbook__implementation" aria-labelledby="developer-handbook-implementation-title">
            <div className="developer-handbook__section-heading">
              <div>
                <span className="developer-handbook__card-index">03 / 实现路径</span>
                <h3 id="developer-handbook-implementation-title">怎么开发出来</h3>
              </div>
              <span className="developer-handbook__step-count">{activeSection.implementation.length} 个关键点</span>
            </div>
            <div className="developer-handbook__implementation-list">
              {activeSection.implementation.map((point, index) => <div className="developer-handbook__implementation-item" key={point.label}>
                <span className="developer-handbook__implementation-number">{String(index + 1).padStart(2, "0")}</span>
                <div><h4>{point.label}</h4><p>{point.detail}</p></div>
              </div>)}
            </div>
          </section>

          {activeSection.id === "development-process" ? <section className="developer-handbook__prompt-example" aria-labelledby="developer-handbook-prompt-title">
            <div>
              <span className="developer-handbook__card-index">08 / 修改提示词</span>
              <h3 id="developer-handbook-prompt-title">可以直接复制和修改这段话</h3>
              <p>先填写你遇到的问题和想要的结果。包名、Owner 或技术细节不知道时可以留空，让 AI 从当前项目核实。</p>
            </div>
            <pre><code>{activeSection.promptExample}</code></pre>
          </section> : null}

          <div className="developer-handbook__detail-grid">
            <section className="developer-handbook__detail-card">
              <span className="developer-handbook__card-index">04 / 配置与数据</span>
              <h3>设置、权限和数据</h3>
              <p>{activeSection.settingsAndData}</p>
            </section>
            <section className="developer-handbook__detail-card">
              <span className="developer-handbook__card-index">05 / 响应式行为</span>
              <h3>窄栏与短屏</h3>
              <p>{activeSection.responsive}</p>
            </section>
          </div>

          <section className="developer-handbook__records" aria-labelledby="developer-handbook-records-title">
            <div className="developer-handbook__section-heading">
              <div>
                <span className="developer-handbook__card-index">06 / 历史与证据</span>
                <h3 id="developer-handbook-records-title">相关开发记录</h3>
              </div>
            </div>
            <ul>{activeSection.records.map((record) => <li key={record}>{record}</li>)}</ul>
            <div className="developer-handbook__verification"><strong>验收时要看</strong><span>{activeSection.verification}</span></div>
          </section>

          <section className="developer-handbook__files" aria-label="相关源码入口">
            <span className="developer-handbook__card-index">07 / 源码入口</span>
            <div className="developer-handbook__file-list">{activeSection.files.map((file) => <code key={file}>{file}</code>)}</div>
          </section>
        </article>
      </div>
    </section>
  );
}
