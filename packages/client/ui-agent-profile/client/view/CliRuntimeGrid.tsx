// Agents 页「本机官方 CLI」卡片集合：与角色卡片共享同一网格密度与视觉语言。
// 关联：packages/client/ui-agent-profile/client/view/Agents-View.tsx；运行环境：浏览器。
import { useState } from "react";
import { IconCopy, IconExternalLink, IconSettings, IconTerminal2 } from "@tabler/icons-react";
import type { CliRuntimeItem } from "../agents/agents-types";
import styles from "./CliRuntimeGrid.module.css";

export function CliRuntimeGrid({
  isZh,
  runtimes,
  onOpenSettings,
  onToggleEnabled,
}: {
  isZh: boolean;
  runtimes: CliRuntimeItem[];
  onOpenSettings: () => void;
  onToggleEnabled: (item: CliRuntimeItem) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCommand = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // 剪贴板不可用时静默忽略
    }
  };

  return (
    <>
      {runtimes.map((item) => (
        <article key={item.id} className={`${styles.card} ${item.installed ? styles.cardInstalled : ""}`}>
          <div className={styles.cardTop}>
            <div className={styles.cardTitleGroup}>
              <span className={styles.iconBox}><IconTerminal2 size={17} aria-hidden="true" /></span>
              <div className={styles.cardTitleText}>
                <div className={styles.cardNameRow}>
                  <span className={styles.cardName}>{item.name}</span>
                  {item.installed ? (
                    <span className={`${styles.pill} ${styles.pillSuccess}`}>{isZh ? "已安装" : "Installed"}</span>
                  ) : (
                    <span className={styles.pill}>{isZh ? "未安装" : "Not installed"}</span>
                  )}
                  {item.supportsChat && <span className={`${styles.pill} ${styles.pillAccent}`}>{isZh ? "聊天" : "Chat"}</span>}
                </div>
                <span className={styles.cardSub}>
                  {item.installed && item.version
                    ? item.version
                    : (isZh ? "官方 CLI 代理" : "Official CLI Agent")}
                </span>
              </div>
            </div>

            {item.installed ? (
              <button
                type="button"
                className={`${styles.switch} ${item.enabled ? styles.switchOn : ""}`}
                role="switch"
                aria-checked={item.enabled}
                aria-label={item.enabled ? (isZh ? "停用" : "Disable") : (isZh ? "启用" : "Enable")}
                onClick={() => onToggleEnabled(item)}
              >
                <span className={styles.switchDot} />
              </button>
            ) : null}
          </div>

          <p className={styles.cardDesc}>
            {item.installed && item.systemLoginDetected
              ? (isZh ? "已检测到本机系统登录，可直接在聊天与多 Agent 协作中选用。" : "System login detected; ready for chat and multi-agent collaboration.")
              : (isZh ? item.descriptionZh : item.descriptionEn)}
          </p>

          <div className={styles.cardFooter}>
            {item.installed ? (
              <>
                <button type="button" className={styles.btn} onClick={onOpenSettings}>
                  <IconSettings size={13} aria-hidden="true" />
                  <span>{isZh ? "设置" : "Settings"}</span>
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => void copyCommand(item.id, item.loginCommand)}
                >
                  <IconCopy size={12} aria-hidden="true" />
                  <span>{copiedId === item.id ? (isZh ? "已复制" : "Copied") : (isZh ? "登录命令" : "Login cmd")}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => void copyCommand(item.id, item.installHint)}
                >
                  <IconCopy size={12} aria-hidden="true" />
                  <span>{copiedId === item.id ? (isZh ? "已复制" : "Copied") : (isZh ? "复制安装命令" : "Install cmd")}</span>
                </button>
                <a className={styles.btn} href={item.docsUrl} target="_blank" rel="noreferrer">
                  <IconExternalLink size={12} aria-hidden="true" />
                  <span>{isZh ? "文档" : "Docs"}</span>
                </a>
              </>
            )}
          </div>
        </article>
      ))}
    </>
  );
}
