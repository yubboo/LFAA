// 项目选择浮层：输入栏项目挂载条与引导区标题里的项目变量共用同一份搜索、项目列表与新建/解绑入口。
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconFolder, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { ChatLocaleMessages } from "../locales";
import { filterComposerProjects } from "./composer-project-filter";
import styles from "./ComposerScopeBar.module.css";

/** 可嵌入不同锚点的项目选择器；外层定位由调用方决定。 */
export function ComposerProjectMenu({
  locale,
  projects,
  selectedProjectId,
  canCreateProject,
  className,
  onSelectProject,
  onCreateProject,
  onClose,
}: {
  locale: ChatLocaleMessages;
  projects: WorkbenchProjectItem[];
  selectedProjectId: string | null;
  canCreateProject: boolean;
  /** 额外定位类：输入栏默认向上展开，标题里的项目变量改为向下展开。 */
  className?: string | undefined;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredProjects = useMemo(() => filterComposerProjects(projects, query), [projects, query]);

  // 浮层挂载即聚焦搜索框；下一帧执行，避免弹层先滚动到输入框。
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const choose = (projectId: string | null) => {
    onSelectProject(projectId);
    onClose();
  };

  return (
    <div className={`${styles.popover} ${className ?? ""}`} role="dialog" aria-label={locale.bindProject}>
      <div className={styles.searchRow}>
        <IconSearch size={14} aria-hidden="true" />
        <input
          ref={searchRef}
          type="text"
          className={styles.searchInput}
          placeholder={locale.searchProjects}
          aria-label={locale.searchProjects}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className={styles.list}>
        {filteredProjects.length === 0 ? (
          <p className={styles.emptyHint}>
            {projects.length === 0 ? locale.noProjectsYet : locale.noMatchingProjects}
          </p>
        ) : (
          filteredProjects.map((project) => {
            const isSelected = project.id === selectedProjectId;
            return (
              <button
                key={project.id}
                type="button"
                className={`${styles.menuItem} ${isSelected ? styles.menuItemActive : ""}`}
                title={project.rootPath || project.name}
                onClick={() => choose(project.id)}
              >
                <span className={styles.menuItemMain}>
                  <IconFolder size={15} aria-hidden="true" />
                  <span className={styles.menuItemText}>{project.name}</span>
                </span>
                {isSelected && <IconCheck size={14} className={styles.menuCheck} aria-hidden="true" />}
              </button>
            );
          })
        )}
      </div>

      <div className={styles.divider} />

      <button
        type="button"
        className={styles.menuItem}
        disabled={!canCreateProject}
        onClick={() => {
          onClose();
          onCreateProject();
        }}
      >
        <span className={styles.menuItemMain}>
          <IconPlus size={15} aria-hidden="true" />
          <span className={styles.menuItemText}>{locale.createNewProject}</span>
        </span>
      </button>

      <button
        type="button"
        className={styles.menuItem}
        disabled={!selectedProjectId}
        onClick={() => choose(null)}
      >
        <span className={styles.menuItemMain}>
          <IconX size={15} aria-hidden="true" />
          <span className={styles.menuItemText}>{locale.workOutsideProject}</span>
        </span>
      </button>
    </div>
  );
}