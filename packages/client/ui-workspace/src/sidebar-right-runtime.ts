/**
 * 功能：为当前 LFAA Workbench 暴露 DSH 兼容的右侧栏扩展服务。
 * 作用：让上游插件登记 tab 并由现有 Workbench 生命周期渲染对应 DSH Slot。
 * 关联文件：ApplicationWorkspace.tsx、client/index.ts、packages/client/modules/src/client/index.ts。
 */
import { useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import type { dshThemeCompatibility } from "lfaa-client-ui-theme/src/dsh-theme-bridge.js";

export interface SidebarRightGuideIconProps { size: number; className?: string }
export interface SidebarRightGuideItem { id: string; order: number; title: string | (() => string); description?: string | (() => string); icon?: ComponentType<SidebarRightGuideIconProps> }
export interface SidebarRightTab { id: string; kind: string; keepMounted?: boolean; title: string | (() => string); guide?: SidebarRightGuideItem[] }
export interface SidebarRightSnapshot { tabs: SidebarRightTab[]; activeId: string | null }
export interface DshShortcutCommand {
  id: string;
  label: () => string;
  aliases?: readonly string[];
  defaults?: Record<string, { code: string; modifiers: readonly string[] }>;
  regions: readonly ("page" | "editable" | "terminal")[];
  modals?: readonly string[];
  resolve(context: { source: "keyboard"; region: "page" | "editable" | "terminal"; modal: null; target: Element | null }):
    { status: "handled"; run(): void } | { status: "blocked"; reason: string } | { status: "pass" };
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    sidebarRightTabs: SidebarRightRuntime["tabsApi"];
    sidebarRight: SidebarRightRuntime["control"];
    shortcuts: { register(command: DshShortcutCommand): () => void };
    theme: typeof dshThemeCompatibility;
  }
  interface Events { "theme/change"(snapshot: { preference: "system" | "light" | "dark" }): void }
}

export class SidebarRightRuntime {
  private readonly tabs = new Map<string, SidebarRightTab>();
  private readonly listeners = new Set<() => void>();
  private activeId: string | null = null;
  private currentSnapshot: SidebarRightSnapshot = { tabs: [], activeId: null };
  private readExpanded: (() => boolean) | undefined;
  private toggleExpanded: (() => void) | undefined;
  private readonly shortcutCommands = new Map<string, DshShortcutCommand>();
  readonly tabsApi = { register: (tab: SidebarRightTab) => this.register(tab) };
  readonly shortcutsApi = { register: (command: DshShortcutCommand) => this.registerShortcut(command) };
  readonly control = {
    openTab: (kind: string) => this.openTab(kind),
    active: () => this.active(),
    toggleExpanded: () => this.toggleExpanded?.(),
    isExpanded: () => this.readExpanded?.() ?? false,
  };

  snapshot = (): SidebarRightSnapshot => this.currentSnapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  bindExpansion(read: () => boolean, toggle: () => void): () => void {
    this.readExpanded = read;
    this.toggleExpanded = toggle;
    return () => {
      if (this.readExpanded === read) this.readExpanded = undefined;
      if (this.toggleExpanded === toggle) this.toggleExpanded = undefined;
    };
  }

  runShortcut(event: KeyboardEvent, region: DshShortcutCommand["regions"][number]): boolean {
    for (const command of this.shortcutCommands.values()) {
      if (!command.regions.includes(region)) continue;
      const target = typeof Element !== "undefined" && event.target instanceof Element ? event.target : null;
      const result = command.resolve({ source: "keyboard", region, modal: null, target });
      if (result.status !== "handled") continue;
      result.run();
      return true;
    }
    return false;
  }

  select(id: string | null): void {
    if (id !== null && !this.tabs.has(id)) throw new Error(`右侧栏 tab 尚未登记：${id}`);
    this.activeId = id;
    this.publish();
  }

  private register(tab: SidebarRightTab): () => void {
    if (!tab.id || !tab.kind || this.tabs.has(tab.id)) throw new Error(`右侧栏 tab 无效或重复：${tab.id}`);
    const copy = { ...tab, guide: tab.guide ? [...tab.guide] : [] };
    this.tabs.set(tab.id, copy);
    this.publish();
    return () => {
      if (this.tabs.get(tab.id) !== copy) return;
      this.tabs.delete(tab.id);
      if (this.activeId === tab.id) this.activeId = null;
      this.publish();
    };
  }

  private registerShortcut(command: DshShortcutCommand): () => void {
    if (!command.id || typeof command.resolve !== "function" || this.shortcutCommands.has(command.id)) {
      throw new Error(`快捷键命令无效或重复：${command.id}`);
    }
    this.shortcutCommands.set(command.id, command);
    return () => {
      if (this.shortcutCommands.get(command.id) === command) this.shortcutCommands.delete(command.id);
    };
  }

  private openTab(kind: string): void {
    const tab = [...this.tabs.values()].find((item) => item.kind === kind);
    if (!tab) throw new Error(`右侧栏没有登记类型为 ${kind} 的 tab。`);
    if (!this.readExpanded || !this.toggleExpanded) throw new Error("当前页面没有挂载 Workbench 右侧栏。");
    this.activeId = tab.id;
    if (!this.readExpanded()) this.toggleExpanded();
    this.publish();
  }

  private active(): SidebarRightTab | null {
    return this.activeId ? this.tabs.get(this.activeId) ?? null : null;
  }

  private publish(): void {
    this.currentSnapshot = { tabs: [...this.tabs.values()], activeId: this.activeId };
    for (const listener of [...this.listeners]) listener();
  }
}

export const sidebarRightRuntime = new SidebarRightRuntime();

export function useSidebarRightSnapshot(): SidebarRightSnapshot {
  return useSyncExternalStore(sidebarRightRuntime.subscribe, sidebarRightRuntime.snapshot, sidebarRightRuntime.snapshot);
}
