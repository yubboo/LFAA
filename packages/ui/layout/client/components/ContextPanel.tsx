// 呈现四栏布局的右侧上下文菜单栏，渲染插件注册的上下文面板。
import type { ReactNode } from "react";
import type { WorkbenchContextPanelContribution } from "../../src/index";
import type { LocaleMessages } from "../locales";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./ContextPanel.module.css";

/** 在右栏挂载当前业务域注册的内容，面板的展开和关闭由外层工作台负责。 */
export function ContextPanel({
  locale,
  panels,
  projectContext,
  compact = false,
  onCloseDrawer,
}: {
  locale: LocaleMessages;
  panels: WorkbenchContextPanelContribution<ReactNode>[];
  projectContext: ReactNode | null;
  compact?: boolean;
  onCloseDrawer?: () => void;
}) {
  const hasContent = Boolean(projectContext) || panels.length > 0;

  return (
    <aside
      className={styles.panel}
      aria-label={locale.contextPanel}
      data-region="context-panel"
    >
      <header className={styles.header}>
        <h2>{locale.contextPanel}</h2>
        {compact && onCloseDrawer && (
          <button
            className={styles.closeButton}
            type="button"
            aria-label={locale.close}
            onClick={onCloseDrawer}
          ><NavigationIcon name="close" /></button>
        )}
      </header>
      <div className={styles.body}>
        {projectContext}
        {panels.map((panel) => (
          <section key={panel.id} className={styles.card}>
            <h3 className={styles.cardTitle}>{panel.title}</h3>
            <div className={styles.cardBody}>{panel.render()}</div>
          </section>
        ))}
        {!hasContent && (
          <div className={styles.empty}>
            <p>{locale.noContextPanels}</p>
            <small>{locale.contextPanelHint}</small>
          </div>
        )}
      </div>
    </aside>
  );
}
