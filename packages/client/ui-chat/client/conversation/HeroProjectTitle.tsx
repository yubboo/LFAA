// 新会话中心标题：把当前项目名渲染成可点击变量，点击后在标题下方展开项目选择器。
import { useEffect, useRef, useState } from "react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { ChatLocaleMessages } from "../locales";
import { ComposerProjectMenu } from "../composer/ComposerProjectMenu";
import heroStyles from "./ChatWorkspace.hero.module.css";

/** 标题里的项目变量与项目选择所需数据；未绑定项目时为 null。 */
export interface HeroProjectPicker {
  name: string;
  projects: WorkbenchProjectItem[];
  selectedProjectId: string;
  canCreateProject: boolean;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
}

/** 把当前项目与回调整理成标题选择器数据；没有项目时返回 null。 */
export function buildHeroProject(
  project: WorkbenchProjectItem | null,
  projects: WorkbenchProjectItem[],
  canCreateProject: boolean,
  onSelectProject: (projectId: string | null) => void,
  onCreateProject: () => void,
): HeroProjectPicker | null {
  if (!project) return null;
  return {
    name: project.name,
    projects,
    selectedProjectId: project.id,
    canCreateProject,
    onSelectProject,
    onCreateProject,
  };
}

/** 渲染「你想让我们在 [项目] 中构建什么？」标题，并让项目名本身成为选择器入口。 */
export function HeroProjectTitle({
  locale,
  isWorkMode,
  project,
}: {
  locale: ChatLocaleMessages;
  isWorkMode: boolean;
  project?: HeroProjectPicker | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const template = project
    ? (isWorkMode ? locale.heroHeadlineWorkProject : locale.heroHeadlineChatProject)
    : (isWorkMode ? locale.heroHeadlineWork : locale.heroHeadlineChat);
  const [before = "", after = ""] = project ? template.split("{name}") : [template];

  // 浮层打开时点空白或按 Esc 关闭；Esc 把焦点还给标题里的项目按钮。
  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchorRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <h1 className={heroStyles.heroTitle}>
      {project ? (
        <>
          {before}
          <span className={heroStyles.projectAnchor} ref={anchorRef}>
            <button
              ref={triggerRef}
              type="button"
              className={heroStyles.projectName}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={`${locale.bindProject} · ${project.name}`}
              onClick={() => setOpen((current) => !current)}
            >
              {project.name}
            </button>
            {open && (
              <ComposerProjectMenu
                className={heroStyles.projectPopover}
                locale={locale}
                projects={project.projects}
                selectedProjectId={project.selectedProjectId}
                canCreateProject={project.canCreateProject}
                onSelectProject={project.onSelectProject}
                onCreateProject={project.onCreateProject}
                onClose={closeMenu}
              />
            )}
          </span>
          {after}
        </>
      ) : template}
    </h1>
  );
}