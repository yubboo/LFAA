import type { UiEffectDefinition, UiEffectRegistration } from "./contracts";

export class UiEffectRegistry {
  #generation = 0;
  #entries = new Map<string, UiEffectRegistration>();

  get generation() { return this.#generation; }

  list(): readonly UiEffectRegistration[] { return [...this.#entries.values()]; }

  resolve(id: string): UiEffectDefinition | undefined { return this.#entries.get(id)?.definition; }

  register(ownerId: string, definition: UiEffectDefinition) {
    if (!ownerId.trim()) throw new Error("UI effect ownerId 不能为空。");
    if (!definition.id.trim()) throw new Error("UI effect id 不能为空。");
    this.#entries.set(definition.id, { ownerId, definition: { ...definition } });
    this.#generation += 1;
    return () => this.unregister(definition.id, ownerId);
  }

  unregister(id: string, ownerId?: string) {
    const current = this.#entries.get(id);
    if (!current || (ownerId !== undefined && current.ownerId !== ownerId)) return false;
    this.#entries.delete(id);
    this.#generation += 1;
    return true;
  }

  unregisterOwner(ownerId: string) {
    let changed = false;
    for (const [id, entry] of this.#entries) {
      if (entry.ownerId !== ownerId) continue;
      this.#entries.delete(id);
      changed = true;
    }
    if (changed) this.#generation += 1;
    return changed;
  }
}
