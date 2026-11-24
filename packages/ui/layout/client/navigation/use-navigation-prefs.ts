// 集中管理左二会话项目菜单栏的展开/收起、排序与活跃分组记忆，刷新页面后完整恢复用户操作。
import { useEffect, useRef, useState } from "react";
import {
  readActiveGroupKeyPref,
  readNavGroupExpandedPref,
  readProjectExpandedPref,
  readProjectSortPref,
  readRecentSortPref,
  readSectionExpandedPref,
  writeActiveGroupKeyPref,
  writeNavGroupExpandedPref,
  writeProjectExpandedPref,
  writeProjectSortPref,
  writeRecentSortPref,
  writeSectionExpandedPref,
  type BuiltinGroupName,
  type ProjectSortMode,
} from "../shell/ui-preferences";

/** 持有并持久化左二分组展开、项目文件夹展开、排序方式与最近点击分组键。 */
export function useNavigationPrefs({
  pinnedCount,
  projectsLoaded,
  onProjectCollapsed,
}: {
  pinnedCount: number;
  projectsLoaded: boolean;
  onProjectCollapsed: (rowId: string) => void;
}) {
  const storedGroupsRef = useRef(readNavGroupExpandedPref());
  const hasExplicitPinnedPrefRef = useRef(typeof storedGroupsRef.current.pinned === "boolean");
  const [expanded, setExpanded] = useState<Record<BuiltinGroupName, boolean>>(() => ({
    pinned: storedGroupsRef.current.pinned ?? false,
    projects: storedGroupsRef.current.projects ?? true,
    recent: storedGroupsRef.current.recent ?? false,
  }));
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>(readSectionExpandedPref);
  const [projectExpanded, setProjectExpanded] = useState<Record<string, boolean>>(readProjectExpandedPref);
  const [sort, setSort] = useState<ProjectSortMode>(readProjectSortPref);
  const [recentSort, setRecentSort] = useState<ProjectSortMode>(readRecentSortPref);
  const [activeGroupKey, setActiveGroupKeyState] = useState<string | null>(readActiveGroupKeyPref);

  const updateBuiltinExpanded = (
    updater: (current: Record<BuiltinGroupName, boolean>) => Record<BuiltinGroupName, boolean>,
  ) => {
    setExpanded((current) => {
      const next = updater(current);
      writeNavGroupExpandedPref(
        hasExplicitPinnedPrefRef.current
          ? next
          : { projects: next.projects, recent: next.recent },
      );
      return next;
    });
  };

  const prevLoadedRef = useRef(projectsLoaded);
  const prevPinnedCountRef = useRef(pinnedCount);
  useEffect(() => {
    const justHydrated = !prevLoadedRef.current && projectsLoaded;
    const pinnedIncreased = pinnedCount > prevPinnedCountRef.current;
    if (justHydrated) {
      if (!hasExplicitPinnedPrefRef.current && pinnedCount > 0) {
        hasExplicitPinnedPrefRef.current = true;
        updateBuiltinExpanded((current) => (current.pinned ? current : { ...current, pinned: true }));
      }
    } else if (projectsLoaded && pinnedIncreased) {
      hasExplicitPinnedPrefRef.current = true;
      updateBuiltinExpanded((current) => (current.pinned ? current : { ...current, pinned: true }));
    }
    prevLoadedRef.current = projectsLoaded;
    prevPinnedCountRef.current = pinnedCount;
  }, [pinnedCount, projectsLoaded]);

  const toggleBuiltin = (group: BuiltinGroupName) => {
    if (group === "pinned") hasExplicitPinnedPrefRef.current = true;
    updateBuiltinExpanded((current) => ({ ...current, [group]: !current[group] }));
  };

  const expandBuiltin = (group: BuiltinGroupName) => {
    if (group === "pinned") hasExplicitPinnedPrefRef.current = true;
    updateBuiltinExpanded((current) => ({ ...current, [group]: true }));
  };

  const toggleCustomSection = (sectionId: string) => {
    setSectionExpanded((current) => {
      const next = { ...current, [sectionId]: !(current[sectionId] ?? true) };
      writeSectionExpandedPref(next);
      return next;
    });
  };

  // 按行 id 记忆展开状态：同一项目在「置顶」与「项目」各有一份副本，刷新后互不干扰。
  const toggleProjectExpanded = (rowId: string) => {
    setProjectExpanded((current) => {
      const nextExpanded = !(current[rowId] ?? true);
      const next = { ...current, [rowId]: nextExpanded };
      writeProjectExpandedPref(next);
      if (!nextExpanded) onProjectCollapsed(rowId);
      return next;
    });
  };

  const expandProject = (rowId: string) => {
    setProjectExpanded((current) => {
      if (current[rowId] === true) return current;
      const next = { ...current, [rowId]: true };
      writeProjectExpandedPref(next);
      return next;
    });
  };

  const changeSort = (nextSort: ProjectSortMode) => {
    setSort(nextSort);
    writeProjectSortPref(nextSort);
  };

  const changeRecentSort = (nextSort: ProjectSortMode) => {
    setRecentSort(nextSort);
    writeRecentSortPref(nextSort);
  };

  const setActiveGroupKey = (groupKey: string | null) => {
    setActiveGroupKeyState(groupKey);
    writeActiveGroupKeyPref(groupKey);
  };

  return {
    expanded,
    sectionExpanded,
    projectExpanded,
    sort,
    recentSort,
    activeGroupKey,
    setActiveGroupKey,
    toggleBuiltin,
    expandBuiltin,
    toggleCustomSection,
    toggleProjectExpanded,
    expandProject,
    changeSort,
    changeRecentSort,
  };
}
