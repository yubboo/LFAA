// 渲染「模型管理」多提供商卡片网格：支持识别已配置状态与当前激活标识，点击任意卡片弹出居中配置弹窗。
import { IconCheck, IconPlus } from "@tabler/icons-react";
import type { PublicLlmProfileItem } from "../chat-types";
import {
  findProfileForProvider,
  MODEL_PROVIDER_CATALOG,
  type ModelProviderPreset,
} from "../provider-catalog";
import styles from "./ModelProviderGrid.module.css";

export function ModelProviderGrid({
  isZh,
  profiles,
  activeProfileId,
  onSelectProvider,
}: {
  isZh: boolean;
  profiles: PublicLlmProfileItem[];
  activeProfileId: string;
  onSelectProvider: (provider: ModelProviderPreset, matchedProfile?: PublicLlmProfileItem) => void;
}) {
  return (
    <div className={styles.sectionWrap}>
      <div className={styles.grid} role="list" aria-label={isZh ? "模型提供商列表" : "Model Providers"}>
        {MODEL_PROVIDER_CATALOG.map((provider) => {
          const matched = findProfileForProvider(profiles, provider);
          const isActive = Boolean(matched && matched.id === activeProfileId);
          const isConfigured = Boolean(matched && (matched.hasApiKey || matched.kind === "ollama"));

          return (
            <button
              key={provider.id}
              type="button"
              role="listitem"
              aria-label={isZh ? provider.nameZh : provider.nameEn}
              className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
              onClick={() => onSelectProvider(provider, matched)}
            >
              <span
                className={styles.logoBox}
                style={{ color: provider.accentColor }}
                aria-hidden="true"
              >
                {provider.isAddStyle ? <IconPlus size={16} stroke={2} /> : provider.glyph}
              </span>

              <div className={styles.cardBody}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardTitle}>{isZh ? provider.nameZh : provider.nameEn}</span>
                  {isConfigured && (
                    <span
                      className={styles.configuredDot}
                      title={isZh ? "已配置可用" : "Configured"}
                    />
                  )}
                </div>
                <span className={styles.cardDesc}>
                  {matched ? `${matched.model} · ${isZh ? provider.descZh : provider.descEn}` : (isZh ? provider.descZh : provider.descEn)}
                </span>
              </div>

              {isActive && (
                <span className={styles.activeCheck} aria-label={isZh ? "当前使用" : "Active"}>
                  <IconCheck size={12} stroke={2.4} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
