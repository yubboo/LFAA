// 浏览器端方舟套餐模型目录：仅在已配置凭据时展示；按用途 → 品牌分组，并标注模型能力。
import { describeArkModelBrand, describeArkModelCapability, getArkPlanCatalog, type ArkPlanKind } from "@lfaa/llm/ark-plan";
import type { ModelCapabilityItem } from "../store/chat-store";
import { arkModelMessages } from "../locales";
import styles from "./Ark-Models.module.css";
import formStyles from "./ModelProviderGrid.module.css";

type CatalogKind = "chat" | "embedding" | "vision" | "speech";

interface CatalogEntry {
  id: string;
  kind: CatalogKind;
  status?: "retiring" | "routed";
  resourceId?: string;
  /** 该模型是否真实来自接口同步；否则只来自官方套餐目录。 */
  synced: boolean;
}

/** 展示套餐模型分类：四类统一用 chip，可点击回填模型 ID；带「目录」标记的条目并非接口返回。 */
export function ArkModels({ plan, model, isZh, onSelect, configured, syncedModels }: {
  plan: ArkPlanKind;
  model: string;
  isZh: boolean;
  onSelect: (id: string) => void;
  /** 档案是否已有凭据：没有凭据时不展示任何模型，避免看起来像“凭空拿到模型”。 */
  configured: boolean;
  /** 通过「获取官方模型」真实同步到的模型；为空表示同步接口未返回。 */
  syncedModels: readonly ModelCapabilityItem[];
}) {
  const labels = arkModelMessages[isZh ? "zh" : "en"];
  if (!configured) {
    return (
      <span className={formStyles.fieldHint}>
        {isZh
          ? "填写 API Key 并点击「获取官方模型」后，这里才会显示该套餐真实可用的模型。"
          : "Enter the API key and click Fetch Official Models to list this plan's real models."}
      </span>
    );
  }

  const { chatModels, otherGroups } = getArkPlanCatalog(plan);
  const syncedIds = new Set(syncedModels.map((item) => item.id));
  const catalog: CatalogEntry[] = [
    ...chatModels.map((item) => ({
      id: item.id, kind: "chat" as const, synced: syncedIds.has(item.id),
      ...(item.status ? { status: item.status } : {}),
    })),
    ...otherGroups.flatMap((group) => group.models.map((item) => ({
      id: item.id, kind: group.kind, synced: syncedIds.has(item.id),
      ...(item.resourceId ? { resourceId: item.resourceId } : {}),
    }))),
  ];
  // 同步接口可能返回目录之外的新模型：按接口给出的用途补进对应分组，避免“同步到了却看不到”。
  for (const item of syncedModels) {
    if (catalog.some((entry) => entry.id === item.id)) continue;
    const kind: CatalogKind = item.modelKind === "image" || item.modelKind === "video"
      ? "vision" : item.modelKind === "audio" ? "speech" : "chat";
    catalog.push({ id: item.id, kind, synced: true });
  }

  const kindMeta: Array<{ key: CatalogKind; label: string }> = [
    { key: "chat", label: labels.chat },
    { key: "embedding", label: labels.embedding },
    { key: "vision", label: labels.vision },
    { key: "speech", label: labels.speech },
  ];
  const syncedCount = catalog.filter((entry) => entry.synced).length;
  // 同一用途内按品牌（豆包 / Kimi / DeepSeek / 智谱AI / 方舟路由）分组，避免整片混排。
  const groupByBrand = (items: CatalogEntry[]) => {
    const groups = new Map<string, { label?: string; items: CatalogEntry[] }>();
    for (const entry of items) {
      const brand = describeArkModelBrand(entry.id, isZh);
      const key = brand ?? "__other";
      const group = groups.get(key) ?? (brand ? { label: brand, items: [] } : { items: [] });
      group.items.push(entry);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([key, group]) => ({ key, ...(group.label ? { label: group.label } : {}), items: group.items }));
  };

  return (
    <div className={styles.catalog}>
      <span className={formStyles.fieldHint}>
        {syncedCount > 0
          ? (isZh
            ? "模型清单来自接口同步与官方套餐目录，实际可用性以调用结果为准。"
            : "Models come from the API sync and the official plan catalog; availability depends on the actual call.")
          : (isZh
            ? "同步接口没有返回模型，以下为官方套餐目录，实际可用性以调用结果为准。"
            : "The API returned no models; the list below comes from the official plan catalog and is for reference only.")}
      </span>
      {kindMeta.map(({ key, label }) => {
        const items = catalog.filter((entry) => entry.kind === key);
        if (items.length === 0) return null;
        return (
          <section key={key} aria-label={label} className={styles.group}>
            <h3>{label}</h3>
            {groupByBrand(items).map((brandGroup) => (
              <div key={brandGroup.key} className={formStyles.brandGroup}>
                {brandGroup.label ? <span className={formStyles.brandLabel}>{brandGroup.label}</span> : null}
                <div className={formStyles.chipsRow}>
                  {brandGroup.items.map((entry) => {
                    const active = model.trim().toLowerCase() === entry.id;
                    // 向量化模型不参与对话/生成，只作为资源展示；其余模型都可设为当前模型。
                    const selectable = key !== "embedding";
                    // 能力说明用强调色，状态（控制台路由/即将下线）用弱化色；两者相同（如 ark-code-latest）时只保留一份。
                    const capability = describeArkModelCapability(entry.id, isZh);
                    const status = entry.status ? labels[entry.status] : "";
                    if (!selectable) {
                      return (
                        <span key={entry.id} className={formStyles.chipBtn} data-static="true" title={entry.resourceId}>
                          <span>{entry.id}</span>
                          {capability && <small className={styles.capText}>{capability}</small>}
                          {status && status !== capability && <small className={styles.statusText}>· {status}</small>}
                        </span>
                      );
                    }
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`${formStyles.chipBtn} ${active ? formStyles.chipBtnActive : ""}`}
                        aria-pressed={active}
                        title={entry.resourceId}
                        onClick={() => onSelect(entry.id)}
                      >
                        <span>{entry.id}</span>
                        {capability && <small className={styles.capText}>{capability}</small>}
                        {status && status !== capability && <small className={styles.statusText}>· {status}</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}