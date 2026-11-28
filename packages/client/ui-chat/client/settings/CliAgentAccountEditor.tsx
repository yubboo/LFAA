// 单个官方 CLI 代理的本地隔离账户与附加参数编辑区（从 CliAgentsPanel 拆出以保持小文件职责边界）。
// 关联：packages/client/ui-chat/client/settings/CliAgentsPanel.tsx；运行环境：浏览器。
import { IconCheck, IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import type { CliAgentSnapshot } from "./cli-agents-client";
import styles from "./CliAgentsPanel.module.css";

export function CliAgentAccountEditor({
  agent,
  isZh,
  newAccountLabel,
  extraArgsDraft,
  onNewAccountLabelChange,
  onExtraArgsChange,
  onSelectAccount,
  onAddAccount,
  onRemoveAccount,
  onSaveExtraArgs,
  onCopyLoginCommand,
}: {
  agent: CliAgentSnapshot;
  isZh: boolean;
  newAccountLabel: string;
  extraArgsDraft: string;
  onNewAccountLabelChange: (value: string) => void;
  onExtraArgsChange: (value: string) => void;
  onSelectAccount: (accountId: string | null) => void;
  onAddAccount: () => void;
  onRemoveAccount: (accountId: string) => void;
  onSaveExtraArgs: () => void;
  onCopyLoginCommand: () => void;
}) {
  return (
    <div className={styles.detail}>
      {agent.supportsAccounts && (
        <div className={styles.subSection}>
          <div className={styles.subHeader}>
            <span className={styles.subTitle}>
              {isZh
                ? `本地订阅账户（通过 ${agent.accountEnvVar} 隔离，认证仅保留在此设备）`
                : `Local accounts (isolated via ${agent.accountEnvVar} on this device)`}
            </span>
            <button type="button" className={styles.smallBtn} onClick={onCopyLoginCommand}>
              <IconCopy size={13} aria-hidden="true" />
              <span>{isZh ? "复制当前账户登录命令" : "Copy login cmd"}</span>
            </button>
          </div>

          <div className={styles.accountList}>
            <div className={`${styles.accountRow} ${!agent.activeAccountId ? styles.accountRowActive : ""}`}>
              <div className={styles.accountMeta}>
                <span className={styles.accountLabel}>
                  {isZh ? "系统默认" : "System default"}
                  {!agent.activeAccountId && <span className={`${styles.badge} ${styles.badgeAccent}`}>{isZh ? "当前" : "Active"}</span>}
                </span>
                <span className={styles.accountPath}>
                  {isZh ? `直接使用本机默认 ${agent.name} 登录上下文` : `Use default ${agent.name} login on this machine`}
                </span>
              </div>
              {agent.activeAccountId && (
                <button type="button" className={styles.smallBtn} onClick={() => onSelectAccount(null)}>
                  <IconCheck size={13} aria-hidden="true" />
                  <span>{isZh ? "使用" : "Use"}</span>
                </button>
              )}
            </div>

            {agent.accounts.map((acc) => {
              const isActive = agent.activeAccountId === acc.id;
              return (
                <div key={acc.id} className={`${styles.accountRow} ${isActive ? styles.accountRowActive : ""}`}>
                  <div className={styles.accountMeta}>
                    <span className={styles.accountLabel}>
                      {acc.label}
                      {isActive && <span className={`${styles.badge} ${styles.badgeAccent}`}>{isZh ? "当前" : "Active"}</span>}
                    </span>
                    <span className={styles.accountPath}>{acc.homeDir}</span>
                  </div>
                  <div className={styles.controls}>
                    {!isActive && (
                      <button type="button" className={styles.smallBtn} onClick={() => onSelectAccount(acc.id)}>
                        <IconCheck size={13} aria-hidden="true" />
                        <span>{isZh ? "切换" : "Switch"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.smallBtn} ${styles.dangerBtn}`}
                      onClick={() => onRemoveAccount(acc.id)}
                    >
                      <IconTrash size={13} aria-hidden="true" />
                      <span>{isZh ? "删除" : "Delete"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.inlineForm}>
            <input
              type="text"
              className={styles.input}
              placeholder={isZh ? "输入账户备注（如：个人号 / 工作号）" : "Account label (e.g. Personal / Work)"}
              value={newAccountLabel}
              onChange={(e) => onNewAccountLabelChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddAccount();
              }}
            />
            <button
              type="button"
              className={styles.smallBtn}
              disabled={!newAccountLabel.trim()}
              onClick={onAddAccount}
            >
              <IconPlus size={14} aria-hidden="true" />
              <span>{isZh ? "添加账户" : "Add account"}</span>
            </button>
          </div>
        </div>
      )}

      <div className={styles.subSection}>
        <span className={styles.subTitle}>{isZh ? "附加启动参数（可选）" : "Extra CLI arguments (optional)"}</span>
        <div className={styles.inlineForm}>
          <input
            type="text"
            className={styles.input}
            placeholder={isZh ? "例如：--model o3" : "e.g. --model o3"}
            value={extraArgsDraft}
            onChange={(e) => onExtraArgsChange(e.target.value)}
          />
          <button type="button" className={styles.smallBtn} onClick={onSaveExtraArgs}>
            <span>{isZh ? "保存" : "Save"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
