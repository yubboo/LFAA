// 底部面板状态：展开标志 + 贡献表，从 workbench-service 抽出来，避免服务文件继续膨胀。
import type { ReactNode } from "react";
import { BOTTOM_PANEL_STORAGE_KEY } from "./ui-preferences";
import { readBooleanPref, writeBooleanPref } from "./ui-preferences";
import type { WorkbenchBottomPanelContribution } from "../../contract";

/** 一个 Host 生命周期内的底部面板状态。 */
export class BottomPanelState {
  private openValue = readBooleanPref(BOTTOM_PANEL_STORAGE_KEY, false);
  private readonly panels = new Map<string, WorkbenchBottomPanelContribution<ReactNode>>();

  get open(): boolean {
    return this.openValue;
  }

  get list(): WorkbenchBottomPanelContribution<ReactNode>[] {
    return [...this.panels.values()];
  }

  register(contribution: WorkbenchBottomPanelContribution<ReactNode>): void {
    this.panels.set(contribution.id, contribution);
  }

  unregister(id: string): void {
    this.panels.delete(id);
  }

  setOpen(open: boolean, persist: boolean): void {
    this.openValue = open;
    if (persist) writeBooleanPref(BOTTOM_PANEL_STORAGE_KEY, open);
  }
}