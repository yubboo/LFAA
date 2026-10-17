/** 功能：定义 LFAA 插件管理页消费的 DSH 插件管理扩展槽合同。作用：保持槽名、视图和 owner 与 DSH 一致，同时仅投影 LFAA 能核实的插件事实。关联文件：PluginManagerPage.tsx、packages/client/modules/src/client/slots.ts。 */
import type { ManagedPluginRecord } from "lfaa-client-connection/src/api.js";

export interface PluginTabInstall {
  spec: string;
  registry?: string;
  title: string;
  version: string;
}

export interface PluginTabOwner {
  install: (target: PluginTabInstall) => void;
  openPackage: (packageName: string) => void;
}

export interface PluginAddActionsOwner {
  onDismiss: () => void;
}

export interface PluginConfigOwner {
  view: "summary" | "page";
  /** DSH Host ConfigForm 由 DSH 配置 Owner 持有；LFAA 不会伪造或写入它。 */
  form?: unknown;
}

export interface PluginRowRef {
  rowId: string;
  moduleName: string;
  enabled: boolean;
}

export interface PluginPackageRef {
  name: string;
  version?: string;
  installed: boolean;
  availability: "installation" | "profile" | "missing";
  official: boolean;
  enabled: boolean;
  rows: readonly PluginRowRef[];
}

export type PluginsSubject =
  | { kind: "bundle"; pkg: PluginPackageRef }
  | { kind: "row"; pkg: PluginPackageRef; row: PluginRowRef }
  | { kind: "item"; id: string };

export interface PluginDetailOwner {
  subject: PluginsSubject;
}

export interface PluginActivationOwner {
  packageName: string;
  onDismiss: () => void;
  onOpenDetails: () => void;
}

/** Make only facts present in the authenticated LFAA Profile record available to detail contributors. */
export function toPluginPackageRef(plugin: ManagedPluginRecord): PluginPackageRef {
  return {
    name: plugin.name,
    version: plugin.version,
    installed: true,
    availability: "profile",
    official: false,
    enabled: plugin.state === "enabled",
    // LFAA records do not currently contain a DSH bundle patch row inventory.
    rows: []
  };
}

export function rowConfigPrefix(packageName: string): string {
  return `${packageName}#`;
}
