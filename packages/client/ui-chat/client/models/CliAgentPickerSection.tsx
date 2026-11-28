// 聊天模型选择器的「CLI 代理」订阅 Hook 与选项分区：联动设置中心开关，支持一键在 API 模型与本机 CLI 间切换。
// 关联：packages/client/ui-chat/client/models/ModelReasoningPicker.tsx；运行环境：浏览器。
import { useEffect, useState } from "react";
import { IconCheck, IconTerminal2 } from "@tabler/icons-react";
import {
  fetchCliAgentsOverview,
  subscribeCliAgentsChanged,
  type CliAgentSnapshot,
} from "../settings/cli-agents-client";
import styles from "./ModelReasoningPicker.module.css";

/** 返回当前已启用、本机已安装且支持聊天直连的 CLI 代理列表。 */
export function useEnabledChatCliAgents(): CliAgentSnapshot[] {
  const [agents, setAgents] = useState<CliAgentSnapshot[]>([]);

  useEffect(() => {
    let alive = true;
    const apply = (list: CliAgentSnapshot[]) => {
      if (!alive) return;
      setAgents(list.filter((item) => item.installed && item.enabled && item.supportsChat));
    };
    void fetchCliAgentsOverview()
      .then((overview) => apply(overview.agents))
      .catch(() => undefined);
    const unsub = subscribeCliAgentsChanged((overview) => {
      if (overview) {
        apply(overview.agents);
      } else {
        void fetchCliAgentsOverview()
          .then((fresh) => apply(fresh.agents))
          .catch(() => undefined);
      }
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return agents;
}

/** 渲染模型弹窗内的「CLI 代理」可选列表，显示当前激活账户摘要。 */
export function CliAgentPickerSection({
  isZh,
  agents,
  activeProfileId,
  onSelect,
}: {
  isZh: boolean;
  agents: CliAgentSnapshot[];
  activeProfileId: string;
  onSelect: (profileId: string) => void;
}) {
  if (agents.length === 0) return null;
  return (
    <div className={styles.modelSection} role="group" aria-label={isZh ? "CLI 代理" : "CLI Agents"}>
      <div className={styles.modelSectionLabel}>{isZh ? "CLI 代理（本地订阅）" : "CLI Agents (Local)"}</div>
      {agents.map((agent) => {
        const profileId = `cli:${agent.id}`;
        const selected = activeProfileId === profileId;
        const activeAccount = agent.activeAccountId
          ? agent.accounts.find((a) => a.id === agent.activeAccountId)?.label
          : null;
        const subtitle = activeAccount ?? (isZh ? "系统默认登录" : "System default");
        return (
          <button
            key={profileId}
            type="button"
            className={`${styles.modelItem} ${selected ? styles.modelItemActive : ""}`}
            onClick={() => onSelect(profileId)}
          >
            <div className={styles.modelMeta}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <IconTerminal2 size={14} aria-hidden="true" />
                <span>{agent.name}</span>
              </span>
              <span className={styles.modelCap}>{subtitle}</span>
            </div>
            {selected && <IconCheck size={15} stroke={2} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
