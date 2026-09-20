import type { UiExtensionContribution, UiExtensionKind } from "./contracts";

export class UiExtensionRegistry {
  #generation = 0;
  #entries = new Map<string, UiExtensionContribution>();
  get generation() { return this.#generation; }
  list(kind?: UiExtensionKind) { return [...this.#entries.values()].filter((item) => kind === undefined || item.kind === kind); }
  register(contribution: UiExtensionContribution) {
    if (!contribution.id.trim() || !contribution.ownerId.trim()) throw new Error("UI extension id/ownerId 不能为空。");
    this.#entries.set(contribution.id, { ...contribution, payload: { ...contribution.payload } });
    this.#generation += 1;
    return () => this.unregister(contribution.id, contribution.ownerId);
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
    for (const [id, item] of this.#entries) if (item.ownerId === ownerId) { this.#entries.delete(id); changed = true; }
    if (changed) this.#generation += 1;
    return changed;
  }
}
