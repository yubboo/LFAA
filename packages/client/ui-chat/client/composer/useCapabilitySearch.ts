// 输入栏「技能 / 插件」内联搜索状态 Hook：独立管理搜索词（不污染原草稿）、键盘上下回车与常用记录。
// 关联：packages/client/ui-chat/client/composer/ChatComposer.tsx；运行环境：浏览器。
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  buildCapabilitySections,
  fetchEnabledSkills,
  fetchInstalledPlugins,
  readFrequentCapabilityIds,
  recordFrequentCapability,
  type CapabilityEntry,
  type CapabilityMode,
  type CapabilityPluginItem,
  type CapabilitySkillItem,
} from "./composer-capabilities";
import type { ComposerAttachment } from "./composer-context";

export function useCapabilitySearch({
  isZh,
  attachments,
  appendAttachments,
  focusTextarea,
  onOpenCanvas,
  onOpenSkills,
  onOpenConnectors,
  onPickProject,
  onPickFile,
  onPickFolder,
  onOpenMedia,
  onTriggerMention,
  onTriggerSlash,
  onOpenBrowser,
}: {
  isZh: boolean;
  attachments: readonly ComposerAttachment[];
  appendAttachments: (items: ComposerAttachment[]) => void;
  focusTextarea: () => void;
  onOpenCanvas?: (() => void) | undefined;
  onOpenSkills?: (() => void) | undefined;
  onOpenConnectors?: (() => void) | undefined;
  onPickProject?: (() => void) | undefined;
  onPickFile?: (() => void) | undefined;
  onPickFolder?: (() => void) | undefined;
  onOpenMedia?: (() => void) | undefined;
  onTriggerMention?: (() => void) | undefined;
  onTriggerSlash?: (() => void) | undefined;
  onOpenBrowser?: (() => void) | undefined;
}) {
  const [mode, setMode] = useState<CapabilityMode | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [skills, setSkills] = useState<CapabilitySkillItem[]>([]);
  const [plugins, setPlugins] = useState<CapabilityPluginItem[]>([]);
  const [frequentIds, setFrequentIds] = useState<string[]>(readFrequentCapabilityIds);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mode) return;
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && cardRef.current?.contains(event.target)) return;
      setMode(null);
      setQuery("");
      setActiveIndex(0);
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [mode]);

  // 预拉取用户已连接的连接器/外部插件与技能，确保点击首帧就有数据。
  useEffect(() => {
    let cancelled = false;
    void fetchEnabledSkills().then((list) => { if (!cancelled) setSkills(list); });
    void fetchInstalledPlugins().then((list) => { if (!cancelled) setPlugins(list); });
    return () => { cancelled = true; };
  }, []);

  const { sections, flatEntries } = useMemo(() => {
    if (!mode) return { sections: [], flatEntries: [] };
    return buildCapabilitySections(mode, {
      skills,
      plugins,
      frequentIds,
      query,
      isZh,
      canPickProject: Boolean(onPickProject),
      canOpenMedia: Boolean(onOpenMedia),
      canOpenBrowser: Boolean(onOpenBrowser),
    });
  }, [frequentIds, isZh, mode, onOpenBrowser, onOpenMedia, onPickProject, plugins, query, skills]);

  useEffect(() => {
    setActiveIndex(0);
  }, [mode, query]);

  function openMode(target: CapabilityMode) {
    setMode(target);
    setQuery("");
    setActiveIndex(0);
    if (target === "skill") void fetchEnabledSkills(true).then(setSkills);
    else void fetchInstalledPlugins(true).then(setPlugins);
    focusTextarea();
  }

  function toggleMode(target: CapabilityMode) {
    if (mode === target) {
      close();
      return;
    }
    openMode(target);
  }

  function close() {
    setMode(null);
    setQuery("");
    setActiveIndex(0);
    focusTextarea();
  }

  function attachModeChip(modeId: "plan" | "goal") {
    if (attachments.some((item) => item.kind === "mode" && item.modeId === modeId)) return;
    appendAttachments([{
      id: `mode-${modeId}`,
      kind: "mode",
      modeId,
      label: modeId === "plan" ? (isZh ? "计划模式" : "Plan mode") : (isZh ? "目标模式" : "Goal mode"),
    }]);
  }

  function attachPluginChip(plugin: CapabilityPluginItem) {
    const label = plugin.title || plugin.name;
    if (attachments.some((item) => item.kind === "plugin" && item.pluginName === plugin.name)) return;
    setFrequentIds(recordFrequentCapability(`plugin:${plugin.name}`));
    appendAttachments([{
      id: `plugin-${plugin.name}`,
      kind: "plugin",
      pluginName: plugin.name,
      label,
    }]);
  }

  function selectEntry(entry: CapabilityEntry) {
    setFrequentIds(recordFrequentCapability(entry.id));
    if (entry.kind === "action") {
      if (entry.actionId === "switch-skill") {
        openMode("skill");
        return;
      }
      if (entry.actionId === "plan") attachModeChip("plan");
      else if (entry.actionId === "goal") attachModeChip("goal");
      else if (entry.actionId === "canvas") onOpenCanvas?.();
      else if (entry.actionId === "manage-skills") onOpenSkills?.();
      else if (entry.actionId === "add-plugin" || entry.actionId === "manage-plugins") onOpenConnectors?.();
      else if (entry.actionId === "pick-project") onPickProject?.();
      else if (entry.actionId === "pick-file") onPickFile?.();
      else if (entry.actionId === "pick-folder") onPickFolder?.();
      else if (entry.actionId === "pick-media") onOpenMedia?.();
      else if (entry.actionId === "open-browser") onOpenBrowser?.();
      else if (entry.actionId === "trigger-mention") {
        setMode(null);
        setQuery("");
        setActiveIndex(0);
        onTriggerMention?.();
        return;
      } else if (entry.actionId === "trigger-slash") {
        setMode(null);
        setQuery("");
        setActiveIndex(0);
        onTriggerSlash?.();
        return;
      }
    } else if (entry.kind === "skill" && entry.skillId) {
      if (!attachments.some((item) => item.kind === "skill" && item.skillId === entry.skillId)) {
        appendAttachments([{
          id: `skill-${entry.skillId}`,
          kind: "skill",
          skillId: entry.skillId,
          label: entry.title,
        }]);
      }
    } else if (entry.kind === "plugin" && entry.pluginName) {
      if (!attachments.some((item) => item.kind === "plugin" && item.pluginName === entry.pluginName)) {
        appendAttachments([{
          id: `plugin-${entry.pluginName}`,
          kind: "plugin",
          pluginName: entry.pluginName,
          label: entry.title,
        }]);
      }
    }
    close();
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" && flatEntries.length > 0) {
      event.preventDefault();
      setActiveIndex((idx) => (idx + 1) % flatEntries.length);
      return;
    }
    if (event.key === "ArrowUp" && flatEntries.length > 0) {
      event.preventDefault();
      setActiveIndex((idx) => (idx - 1 + flatEntries.length) % flatEntries.length);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const picked = flatEntries[activeIndex] ?? flatEntries[0];
      if (picked) selectEntry(picked);
    }
  }

  return {
    cardRef,
    mode,
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    skills,
    plugins,
    sections,
    flatEntries,
    openMode,
    toggleMode,
    close,
    selectEntry,
    attachModeChip,
    attachPluginChip,
    handleSearchKeyDown,
  };
}
