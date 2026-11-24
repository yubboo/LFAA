// 资料库中心页与右栏检视器共享的客户端状态：选中项与生成素材列表各只有一个所有者，避免两处重复请求和选择漂移。
import { fetchMediaLibrary, mediaLibraryFileUrl, type MediaLibraryItem } from "../media/media-library";

/** 资料库当前选中项；右栏检视器据此显示媒体或资产详情。 */
export type LibrarySelection =
  | { kind: "media"; item: MediaLibraryItem }
  | { kind: "asset"; id: string; title: string }
  | null;

/** 生成素材读取与删除的失败类型，界面据此选择中英文提示。 */
export type LibraryMediaError = "load" | "delete" | null;

/** 生成素材列表快照。 */
export interface LibraryMediaState {
  items: MediaLibraryItem[];
  loading: boolean;
  error: LibraryMediaError;
}

/** 只在选中项真的变化时通知订阅者，避免每次点击都刷新整页。 */
function sameSelection(left: LibrarySelection, right: LibrarySelection): boolean {
  if (left === right) return true;
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === "media") return right.kind === "media" && left.item.path === right.item.path;
  return right.kind === "asset" && left.id === right.id;
}

/** 资料库选中项的唯一存储；切换分类或离开资料库时由视图清空。 */
export class LibrarySelectionStore {
  private readonly listeners = new Set<() => void>();
  private value: LibrarySelection = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): LibrarySelection => this.value;

  set(next: LibrarySelection): void {
    if (sameSelection(this.value, next)) return;
    this.value = next;
    this.emit();
  }

  clear(): void {
    if (!this.value) return;
    this.value = null;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

/** 生成素材列表的唯一存储：资料库图像分类与输入框素材库弹窗共用，删除后两处同步。 */
export class LibraryMediaStore {
  private readonly listeners = new Set<() => void>();
  private state: LibraryMediaState = { items: [], loading: false, error: null };
  private inFlight: Promise<void> | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): LibraryMediaState => this.state;

  /** 读取最近素材；并发调用复用同一次请求，避免重复扫描磁盘。 */
  reload(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.setState({ loading: true, error: null });
    const task = (async () => {
      try {
        this.setState({ items: await fetchMediaLibrary(), loading: false });
      } catch {
        this.setState({ error: "load", loading: false });
      } finally {
        this.inFlight = null;
      }
    })();
    this.inFlight = task;
    return task;
  }

  /** 删除素材文件与生成记录；成功后立即从列表移除，资料库与弹窗同时生效。 */
  async remove(path: string): Promise<boolean> {
    try {
      const res = await fetch(mediaLibraryFileUrl(path), { method: "DELETE" });
      if (!res.ok) {
        this.setState({ error: "delete" });
        return false;
      }
      this.setState({ items: this.state.items.filter((item) => item.path !== path), error: null });
      return true;
    } catch {
      this.setState({ error: "delete" });
      return false;
    }
  }

  private setState(patch: Partial<LibraryMediaState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** 资料库选中项的全局实例。 */
export const librarySelectionStore = new LibrarySelectionStore();

/** 生成素材列表的全局实例。 */
export const libraryMediaStore = new LibraryMediaStore();