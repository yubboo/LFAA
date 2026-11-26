// 渲染聊天输入框上方的工作位置（此计算机/云端）与项目选择挂载条及搜索弹出浮层。
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import {
  IconCheck,
  IconChevronRight,
  IconCloud,
  IconDeviceLaptop,
  IconFolder,
  IconGitBranch,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { ChatLocaleMessages } from "../locales";
import { ComposerProjectMenu } from "./ComposerProjectMenu";
import styles from "./ComposerScopeBar.module.css";

export { filterComposerProjects } from "./composer-project-filter";

type OpenMenuKind = "location" | "project" | null;

/** 控制新消息的工作位置与项目绑定，选择结果由上层同步到聊天会话。 */
export function ComposerScopeBar({
  locale,
  projects,
  selectedProjectId,
  canCreateProject,
  openProjectSignal = 0,
  projectMenuOpen,
  onProjectMenuOpenChange,
  showShelf = true,
  projectDisabled = false,
  worktree = null,
  trailing,
  onSelectProject,
  onCreateProject,
  onClearWorktree,
}: {
  locale: ChatLocaleMessages;
  projects: WorkbenchProjectItem[];
  selectedProjectId: string | null;
  canCreateProject: boolean;
  openProjectSignal?: number;
  /** 由上层受控时的项目选择器开关态；与独立项目胶囊共享同一浮层并避免切换弹跳。 */
  projectMenuOpen?: boolean;
  onProjectMenuOpenChange?: (open: boolean) => void;
  showShelf?: boolean;
  projectDisabled?: boolean;
  /** 已绑定的工作树摘要；只做展示，解绑由上层提交 worktreeId: null。 */
  worktree?: { branch: string; path: string } | null;
  /** 紧跟在项目后面的轻量控件（如会话模式），与工作位置/项目共用一条挂载行。 */
  trailing?: ReactNode;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
  onClearWorktree?: () => void;
}) {
  const [internalMenu, setInternalMenu] = useState<OpenMenuKind>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [cloudHintVisible, setCloudHintVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isControlledProject = typeof projectMenuOpen === "boolean";
  const openMenu: OpenMenuKind = isControlledProject
    ? (projectMenuOpen ? "project" : (internalMenu === "location" ? "location" : null))
    : internalMenu;

  const setOpenMenu = (next: OpenMenuKind | ((curr: OpenMenuKind) => OpenMenuKind)) => {
    const resolved = typeof next === "function" ? next(openMenu) : next;
    if (isControlledProject) {
      onProjectMenuOpenChange?.(resolved === "project");
      setInternalMenu(resolved === "location" ? "location" : null);
    } else {
      setInternalMenu(resolved);
    }
  };

  const selectedProject = useMemo(
    () => (selectedProjectId ? projects.find((item) => item.id === selectedProjectId) ?? null : null),
    [projects, selectedProjectId],
  );

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-project-picker-trigger]")) {
        return;
      }
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        if (isControlledProject) {
          onProjectMenuOpenChange?.(false);
          setInternalMenu(null);
        } else {
          setInternalMenu(null);
        }
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isControlledProject) {
          onProjectMenuOpenChange?.(false);
          setInternalMenu(null);
        } else {
          setInternalMenu(null);
        }
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isControlledProject, onProjectMenuOpenChange, openMenu]);

  useEffect(() => {
    if (openProjectSignal > 0 && !isControlledProject) {
      setInternalMenu("project");
    }
  }, [isControlledProject, openProjectSignal]);

  useEffect(() => {
    if (openMenu === "location") {
      setLocationQuery("");
      setCloudHintVisible(false);
    }
  }, [openMenu]);

  const normalizedLocQuery = locationQuery.trim().toLowerCase();
  const showLocalOption = !normalizedLocQuery || locale.localComputer.toLowerCase().includes(normalizedLocQuery);
  const showCloudOption = !normalizedLocQuery
    || locale.cloudLocation.toLowerCase().includes(normalizedLocQuery)
    || locale.cloudDefaultEnv.toLowerCase().includes(normalizedLocQuery);

  if (!showShelf && (openMenu !== "project" || projectDisabled) && !worktree) return null;

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
            <ComposerProjectMenu
              locale={locale}
              projects={projects}
              selectedProjectId={selectedProjectId}
              canCreateProject={canCreateProject}
              onSelectProject={onSelectProject}
              onCreateProject={onCreateProject}
              onClose={() => setOpenMenu(null)}
            />
          )}
        </div>

        {trailing}

        {worktree && (
          <div className={styles.worktreeChip} title={worktree.path}>
            <IconGitBranch size={14} aria-hidden="true" />
            <span className={styles.worktreeBranch}>{worktree.branch}</span>
            {onClearWorktree && (
              <button
                type="button"
                className={styles.worktreeClear}
                aria-label={locale.unbindWorktree}
                title={locale.unbindWorktree}
                onClick={onClearWorktree}
              >
                <IconX size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        </div>
    </div>
  );
}
