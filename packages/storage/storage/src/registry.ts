/** 功能：管理具名后端注册。作用：允许多个可插拔存储介质并存，并精确撤销单个插件的贡献。 */
import type { StorageBackend } from "./backend.js";
import { StorageError } from "./error.js";

export class BackendRegistry {
  private readonly backends = new Map<string, StorageBackend>();

  register(name: string, backend: StorageBackend): () => void {
    if (!name.trim()) throw new TypeError("存储后端名称不能为空。");
    if (this.backends.has(name)) throw new StorageError("duplicate-backend", `存储后端“${name}”已注册。`);
    this.backends.set(name, backend);
    return () => { if (this.backends.get(name) === backend) this.backends.delete(name); };
  }

  get(name: string): StorageBackend {
    const backend = this.backends.get(name);
    if (!backend) throw new StorageError("backend-not-found", `存储后端“${name}”尚未装配。`);
    return backend;
  }

  names(): string[] { return [...this.backends.keys()]; }
}
