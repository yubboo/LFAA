// 快捷键状态：动作注册表 + 用户键位覆盖，从 workbench-service 抽出，控制服务文件体量。
import {
  readShortcutBindings,
  resolveShortcutBindings,
  writeShortcutBindings,
  type ShortcutBindingMap,
} from "./shortcuts";
import type { WorkbenchShortcutContribution, WorkbenchShortcutState } from "../contract";

/** 已注册动作与当前生效键位的持有者。 */
export class ShortcutState {
  private readonly actions = new Map<string, WorkbenchShortcutContribution>();
  private bindingsValue: ShortcutBindingMap = readShortcutBindings();

  get map(): Map<string, WorkbenchShortcutContribution> {
    return this.actions;
  }

  get bindings(): ShortcutBindingMap {
    return this.bindingsValue;
  }

  /** 合并默认键位与用户覆盖后的动作清单，供快照与设置页使用。 */
  list(): WorkbenchShortcutState[] {
    return resolveShortcutBindings([...this.actions.values()], this.bindingsValue);
  }

  setKeys(id: string, keys: string | null): void {
    this.bindingsValue = { ...this.bindingsValue, [id]: keys };
    writeShortcutBindings(this.bindingsValue);
  }

  resetKeys(id: string): void {
    const next = { ...this.bindingsValue };
    delete next[id];
    this.bindingsValue = next;
    writeShortcutBindings(next);
  }
}