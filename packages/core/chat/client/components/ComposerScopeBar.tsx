// 渲染聊天输入框上方的工作位置（此计算机/云端）与项目选择挂载条及搜索弹出浮层。
import { useEffect, useMemo, useRef, useState } from "react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCloud,
  IconDeviceLaptop,
  IconFolder,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { ChatLocaleMessages } from "../locales";
import styles from "./ComposerScopeBar.module.css";

type OpenMenuKind = "location" | "project" | null;

// 按关键字过滤本地项目名称或目录路径，供项目选择浮层实时检索与单元测试复用。
export function filterComposerProjects(
  projects: WorkbenchProjectItem[],
  query: string,
): WorkbenchProjectItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return projects;
  return projects.filter((project) => {
    const nameMatch = project.name.toLowerCase().includes(normalized);
    const pathMatch = Boolean(project.rootPath && project.rootPath.toLowerCase().includes(normalized));
    return nameMatch || pathMatch;
  });
}

/** 控制新消息的工作位置与项目绑定，选择结果由上层同步到聊天会话。 */
export function ComposerScopeBar({
  locale,
  projects,
  selectedProjectId,
  canCreateProject,
  openProjectSignal = 0,
  showShelf = true,
  projectDisabled = false,
  onSelectProject,
  onCreateProject,
}: {
  locale: ChatLocaleMessages;
  projects: WorkbenchProjectItem[];
  selectedProjectId: string | null;
  canCreateProject: boolean;
  openProjectSignal?: number;
  showShelf?: boolean;
  projectDisabled?: boolean;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<OpenMenuKind>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [cloudHintVisible, setCloudHintVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const projectSearchRef = useRef<HTMLInputElement>(null);

  const selectedProject = useMemo(
    () => (selectedProjectId ? projects.find((item) => item.id === selectedProjectId) ?? null : null),
    [projects, selectedProjectId],
  );

  const filteredProjects = useMemo(
    () => filterComposerProjects(projects, projectQuery),
    [projects, projectQuery],
  );

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  useEffect(() => {
    if (openProjectSignal > 0) {
      setOpenMenu("project");
    }
  }, [openProjectSignal]);

  useEffect(() => {
    if (openMenu === "project") {
      setProjectQuery("");
      window.requestAnimationFrame(() => projectSearchRef.current?.focus());
    } else if (openMenu === "location") {
      setLocationQuery("");
      setCloudHintVisible(false);
    }
  }, [openMenu]);

  const normalizedLocQuery = locationQuery.trim().toLowerCase();
  const showLocalOption = !normalizedLocQuery || locale.localComputer.toLowerCase().includes(normalizedLocQuery);
  const showCloudOption = !normalizedLocQuery
    || locale.cloudLocation.toLowerCase().includes(normalizedLocQuery)
    || locale.cloudDefaultEnv.toLowerCase().includes(normalizedLocQuery);

  if (!showShelf && (openMenu !== "project" || projectDisabled)) return null;

  return (
    <div ref={rootRef} className={styles.wrapper}>
    <div className={showShelf ? styles.shelf : undefined}>
        {showShelf && <div className={styles.anchor}>
          <HoverTip label={locale.workLocation} disabled={openMenu === "location"}>
            <button
              type="button"
              className={`${styles.triggerBase} ${openMenu === "location" ? styles.triggerOpen : ""}`}
              aria-haspopup="dialog"
              aria-expanded={openMenu === "location"}
              aria-label={locale.workLocation}
              onClick={() => setOpenMenu((curr) => (curr === "location" ? null : "location"))}
            >
              <IconDeviceLaptop size={15} aria-hidden="true" />
              <span className={styles.triggerLabel}>{locale.localComputer}</span>
            </button>
          </HoverTip>

          {openMenu === "location" && (
            <div className={styles.popover} role="dialog" aria-label={locale.workLocation}>
              <div className={styles.searchRow}>
                <IconSearch size={14} aria-hidden="true" />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder={locale.workLocation}
                  aria-label={locale.workLocation}
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                />
              </div>
              <div className={styles.list}>
                {showLocalOption && (
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemActive}`}
                    onClick={() => {
                      setCloudHintVisible(false);
                      setOpenMenu(null);
                    }}
                  >
                    <span className={styles.menuItemMain}>
                      <IconDeviceLaptop size={15} aria-hidden="true" />
                      <span className={styles.menuItemText}>{locale.localComputer}</span>
                    </span>
                    <IconCheck size={14} className={styles.menuCheck} aria-hidden="true" />
                  </button>
                )}
                {showCloudOption && (
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => setCloudHintVisible((prev) => !prev)}
                  >
                    <span className={styles.menuItemMain}>
                      <IconCloud size={15} aria-hidden="true" />
                      <span className={styles.menuItemText}>
                        {locale.cloudLocation}
                        <span className={styles.menuSubtle}>{locale.cloudDefaultEnv}</span>
                      </span>
                    </span>
                    <IconChevronRight size={14} className={styles.menuChevron} aria-hidden="true" />
                  </button>
                )}
                {!showLocalOption && !showCloudOption && (
                  <p className={styles.emptyHint}>{locale.noMatchingProjects}</p>
                )}
                {cloudHintVisible && (
                  <p className={styles.cloudNotice} role="status">
                    {locale.cloudLocationUnavailable}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>}

        <div className={showShelf ? styles.anchor : undefined}>
          {showShelf && <HoverTip
            label={projectDisabled
              ? (locale.isZh ? "运行或保存结束后可更改项目" : "Change the project when the run or save finishes")
              : (selectedProject?.rootPath || (locale.isZh ? "更改此聊天的项目" : "Change project for this chat"))}
            disabled={openMenu === "project"}
          >
            <button
              type="button"
              disabled={projectDisabled}
              className={`${styles.triggerBase} ${selectedProject ? "" : styles.projectEmpty} ${openMenu === "project" ? styles.triggerOpen : ""}`}
              aria-haspopup="dialog"
              aria-expanded={openMenu === "project"}
              aria-label={locale.bindProject}
              onClick={() => setOpenMenu((curr) => (curr === "project" ? null : "project"))}
            >
              <IconFolder size={14} aria-hidden="true" />
              <span className={styles.triggerLabel}>
                {selectedProject ? selectedProject.name : locale.selectProject}
              </span>
            </button>
          </HoverTip>}

          {openMenu === "project" && !projectDisabled && (
            <div className={styles.popover} role="dialog" aria-label={locale.bindProject}>
              <div className={styles.searchRow}>
                <IconSearch size={14} aria-hidden="true" />
                <input
                  ref={projectSearchRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder={locale.searchProjects}
                  aria-label={locale.searchProjects}
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                />
              </div>

              <div className={styles.list}>
                {filteredProjects.length === 0 ? (
                  <p className={styles.emptyHint}>
                    {projects.length === 0 ? locale.noProjectsYet : locale.noMatchingProjects}
                  </p>
                ) : (
                  filteredProjects.map((project) => {
                    const isSelected = project.id === selectedProject?.id;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        className={`${styles.menuItem} ${isSelected ? styles.menuItemActive : ""}`}
                        title={project.rootPath || project.name}
                        onClick={() => {
                          onSelectProject(project.id);
                          setOpenMenu(null);
                        }}
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
                  setOpenMenu(null);
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
                disabled={!selectedProject}
                onClick={() => {
                  onSelectProject(null);
                  setOpenMenu(null);
                }}
              >
                <span className={styles.menuItemMain}>
                  <IconX size={15} aria-hidden="true" />
                  <span className={styles.menuItemText}>{locale.workOutsideProject}</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
