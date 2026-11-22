// 渲染由 @lfaa/workspace 插件贡献到四栏右侧菜单栏的上下文详情与项目目录移除操作。
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { WorkspaceLocaleMessages } from "../locales";
import styles from "./ProjectContextPanel.module.css";

/** 展示工作区级项目和存储信息，供右侧上下文槽挂载。 */
export function WorkspaceContextContent({
  locale,
  projectCount,
}: {
  locale: WorkspaceLocaleMessages;
  projectCount: number;
}) {
  return (
    <div className={styles.stack}>
      <p className={styles.summary}>{locale.workspaceContextBody}</p>
      <dl className={styles.meta}>
        <div>
          <dt>{locale.projectCountLabel}</dt>
          <dd>{projectCount}</dd>
        </div>
        <div>
          <dt>{locale.storageLabel}</dt>
          <dd>{locale.storageValue}</dd>
        </div>
        <div>
          <dt>{locale.pluginSourceLabel}</dt>
          <dd>{locale.pluginSourceValue}</dd>
        </div>
      </dl>
    </div>
  );
}

/** 在右栏展示已选项目的目录上下文与项目操作。 */
export function ProjectContextCard({
  locale,
  project,
  onRemove,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  onRemove: (projectId: string) => void;
}) {
  return (
    <section className={styles.card} aria-label={locale.projectContextTitle}>
      <h3 className={styles.title}>{locale.projectContextTitle}</h3>
      <dl className={styles.meta}>
        <div>
          <dt>{locale.projectName}</dt>
          <dd>{project.name}</dd>
        </div>
        <div>
          <dt>{locale.projectScopeLabel}</dt>
          <dd className={styles.brief}>
            {project.description?.trim() || locale.projectScopeEmpty}
          </dd>
        </div>
        {(project.rootPaths?.length ? project.rootPaths : project.rootPath ? [project.rootPath] : []).map((folderPath) => (
          <div key={folderPath}>
            <dt>{locale.rootPathLabel}</dt>
            <dd className={styles.mono}>{folderPath}</dd>
          </div>
        ))}
        <div>
          <dt>{locale.createdAtLabel}</dt>
          <dd>{new Date(project.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>{locale.storageLabel}</dt>
          <dd>{locale.storageValue}</dd>
        </div>
      </dl>
      <div className={styles.footerAction}>
        <button type="button" className={styles.removeBtn} onClick={() => onRemove(project.id)}>
          {locale.removeProject}
        </button>
        <small className={styles.hint}>{locale.removeProjectHint}</small>
      </div>
    </section>
  );
}
