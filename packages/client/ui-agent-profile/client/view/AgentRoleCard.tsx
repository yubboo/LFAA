// Agents 页单个角色卡片与居中编辑弹窗外壳：与本机 CLI 卡片共享统一卡片密度。
// 关联：packages/client/ui-agent-profile/client/view/Agents-View.tsx；运行环境：浏览器。
import type { ReactNode } from "react";
import { IconRobot, IconSettings } from "@tabler/icons-react";
import { ModalDialog } from "@lfaa/ui-primitives/client";
import type { AgentsMessages } from "../locales";
import type { AgentItem } from "../agents/agents-types";
import styles from "./Agents-View.module.css";

/** 渲染单个内置或自定义 Agent 角色卡片。 */
export function AgentRoleCard({
  agent,
  isZh,
  t,
  bindingText,
  onOpen,
  onToggleEnabled,
}: {
  agent: AgentItem;
  isZh: boolean;
  t: AgentsMessages;
  bindingText: string;
  onOpen: () => void;
  onToggleEnabled: () => void;
}) {
  return (
    <article className={`${styles.card} ${agent.enabled ? styles.cardReady : ""}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitleGroup}>
          <span className={styles.avatar}><IconRobot size={17} aria-hidden="true" /></span>
          <div className={styles.cardTitleText}>
            <div className={styles.cardNameRow}>
              <span className={styles.cardName}>{agent.name}</span>
              {agent.source === "builtin"
                ? <em className={styles.badgeSuccess}>{t.builtin}</em>
                : <em className={styles.badge}>{isZh ? "角色" : "Role"}</em>}
            </div>
            <span className={styles.cardSub}>{bindingText}</span>
          </div>
        </div>
        <button
          type="button"
          className={`${styles.switch} ${agent.enabled ? styles.switchOn : ""}`}
          role="switch"
          aria-checked={agent.enabled}
          aria-label={agent.enabled ? t.disable : t.enable}
          title={agent.enabled ? t.disable : t.enable}
          onClick={onToggleEnabled}
        >
          <span className={styles.switchDot} />
        </button>
      </div>

      <p className={styles.cardDesc}>
        {agent.instructions?.trim()
          || (isZh ? "支持单聊与多 Agent 协作，可配置独立人设、只读权限与模型或本机 CLI 引擎。" : "Supports single and multi-agent chat with custom instructions, tool policy, and model or CLI runtime.")}
      </p>

      <div className={styles.cardFooter}>
        <button
          type="button"
          className={styles.cardActionBtn}
          aria-label={`${isZh ? "设置" : "Configure"} ${agent.name}`}
          onClick={onOpen}
        >
          <IconSettings size={13} aria-hidden="true" />
          <span>{isZh ? "设置" : "Settings"}</span>
        </button>
      </div>
    </article>
  );
}

/** 居中模态弹窗外壳：复用 @lfaa/ui-primitives 的 ModalDialog（Portal 到 body，全屏遮罩含左一/左二栏 + 统一进出场动画）。 */
export function AgentEditorModal({
  open,
  title,
  isZh,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  isZh: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalDialog
      open={open}
      title={title}
      size="md"
      animation="scale"
      closeLabel={isZh ? "关闭弹窗" : "Close dialog"}
      onClose={onClose}
    >
      {children}
    </ModalDialog>
  );
}
