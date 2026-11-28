// 设置中心「CLI 代理」面板：探测本机已安装/可安装的官方 CLI，管理启用状态、附加参数与本地隔离订阅账户。
// 关联：packages/client/ui-chat/client/settings/AgentSettingsView.tsx；运行环境：浏览器。
import { useCallback, useEffect, useState } from "react";
import { IconChevronDown, IconChevronRight, IconCopy, IconExternalLink, IconRefresh, IconTerminal2 } from "@tabler/icons-react";
import { HoverTip, SettingGroup, SettingRow, SettingSegmented, SettingSwitch } from "@lfaa/ui-primitives/client";
import { CliAgentAccountEditor } from "./CliAgentAccountEditor";
import {
  addCliAgentAccount,
  buildCliAgentCommand,
  fetchCliAgentsOverview,
  refreshCliAgentsOverview,
  removeCliAgentAccount,
  updateCliAgentConfig,
  updateCliAgentsGlobal,
  type CliAgentMode,
  type CliAgentSnapshot,
  type CliAgentsOverview,
} from "./cli-agents-client";
import styles from "./CliAgentsPanel.module.css";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CliAgentsPanel({
  isZh,
  onNotify,
}: {
  isZh: boolean;
  onNotify: (message: string) => void;
}) {
  const [overview, setOverview] = useState<CliAgentsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newAccountLabel, setNewAccountLabel] = useState<Record<string, string>>({});
  const [extraArgsDraft, setExtraArgsDraft] = useState<Record<string, string>>({});

  const load = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      const data = forceRefresh ? await refreshCliAgentsOverview() : await fetchCliAgentsOverview();
      setOverview(data);
      const drafts: Record<string, string> = {};
      for (const a of data.agents) drafts[a.id] = a.extraArgs;
      setExtraArgsDraft(drafts);
      if (forceRefresh) {
        onNotify(isZh ? "已刷新本机 CLI 代理检测结果。" : "Refreshed local CLI agent detection.");
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isZh, onNotify]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const handleGlobalMode = async (defaultOpenMode: CliAgentMode) => {
    try {
      setOverview(await updateCliAgentsGlobal({ defaultOpenMode }));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error));
    }
  };

  const handleToggleEnabled = async (agent: CliAgentSnapshot, enabled: boolean) => {
    try {
      setOverview(await updateCliAgentConfig(agent.id, { enabled }));
      onNotify(
        enabled
          ? (isZh ? `已启用 ${agent.name}。` : `Enabled ${agent.name}.`)
          : (isZh ? `已停用 ${agent.name}。` : `Disabled ${agent.name}.`),
      );
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error));
    }
  };

  const handleSelectAccount = async (agentId: string, activeAccountId: string | null) => {
    try {
      setOverview(await updateCliAgentConfig(agentId, { activeAccountId }));
      onNotify(isZh ? "已切换当前账户上下文。" : "Switched active account context.");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error));
    }
  };

  const handleAddAccount = async (agent: CliAgentSnapshot) => {
    const label = (newAccountLabel[agent.id] ?? "").trim();
    if (!label) return;
    try {
      setOverview(await addCliAgentAccount(agent.id, label));
      setNewAccountLabel((prev) => ({ ...prev, [agent.id]: "" }));
      onNotify(isZh ? `已添加隔离账户「${label}」，请复制登录命令在终端完成登录。` : `Added account "${label}". Run the login command in terminal.`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRemoveAccount = async (agentId: string, accountId: string) => {
    try {
      setOverview(await removeCliAgentAccount(agentId, accountId));
      onNotify(isZh ? "已移除受管账户。" : "Removed managed account.");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error));
    }
  };

  const handleSaveExtraArgs = async (agentId: string) => {
    try {
      setOverview(await updateCliAgentConfig(agentId, { extraArgs: extraArgsDraft[agentId] ?? "" }));
      onNotify(isZh ? "已保存附加参数。" : "Saved extra arguments.");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCopyCommand = async (agent: CliAgentSnapshot, action: "login" | "terminal") => {
    try {
      const res = await buildCliAgentCommand(agent.id, action);
      const ok = await copyToClipboard(res.command);
      onNotify(
        ok
          ? (isZh ? `已复制命令：${res.command}` : `Copied command: ${res.command}`)
          : res.command,
      );
    } catch (error) {
      onNotify(error instanceof Error ? error.message : String(error));
    }
  };

  if (loading && !overview) {
    return <p className={styles.emptyText}>{isZh ? "正在检测本机已安装的官方 CLI 代理…" : "Detecting local official CLI agents…"}</p>;
  }

  const agents = overview?.agents ?? [];
  const installed = agents.filter((a) => a.installed);
  const available = agents.filter((a) => !a.installed);

  return (
    <>
      <SettingGroup title={isZh ? "默认方式" : "Defaults"}>
        <SettingRow
          title={isZh ? "智能体打开方式" : "Default open mode"}
          description={isZh ? "支持聊天流式协议的 CLI 可直接在聊天框选用，或在终端运行。" : "Chat-capable CLIs can run inside chat or in terminal."}
          control={(
            <div className={styles.controls}>
              <SettingSegmented
                value={overview?.defaultOpenMode ?? "chat"}
                label={isZh ? "智能体打开方式" : "Default open mode"}
                options={[
                  { value: "chat", label: isZh ? "聊天" : "Chat" },
                  { value: "terminal", label: isZh ? "终端" : "Terminal" },
                ]}
                onChange={(mode) => void handleGlobalMode(mode as CliAgentMode)}
              />
              <button
                type="button"
                className={styles.smallBtn}
                disabled={refreshing}
                onClick={() => void load(true)}
              >
                <IconRefresh size={14} aria-hidden="true" />
                <span>{refreshing ? (isZh ? "检测中…" : "Checking…") : (isZh ? "刷新检测" : "Refresh")}</span>
              </button>
            </div>
          )}
        />
      </SettingGroup>

      <SettingGroup title={isZh ? `已安装 (${installed.length})` : `Installed (${installed.length})`}>
        {installed.length === 0 ? (
          <p className={styles.emptyText}>
            {isZh ? "未在 PATH 中检测到官方 CLI，可在下方复制安装命令后点击「刷新检测」。" : "No official CLIs detected in PATH. Install one below and click Refresh."}
          </p>
        ) : (
          <div className={styles.list}>
            {installed.map((agent) => {
              const expanded = expandedId === agent.id;
              return (
                <div key={agent.id} className={styles.item}>
                  <div className={styles.row}>
                    <div className={styles.main}>
                      <div className={styles.titleLine}>
                        <span className={styles.name}>{agent.name}</span>
                        {agent.supportsChat && (
                          <span className={`${styles.badge} ${styles.badgeAccent}`}>{isZh ? "聊天" : "Chat"}</span>
                        )}
                        <span className={styles.badge}>CLI</span>
                        {agent.systemLoginDetected && (
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>{isZh ? "已检测本机登录" : "System login"}</span>
                        )}
                        {agent.version && <span className={styles.badge}>{agent.version}</span>}
                      </div>
                      <HoverTip label={agent.binaryPath ?? agent.terminalCommand} multiline>
                        <span className={styles.cmdLine}>{agent.binaryPath ?? agent.terminalCommand}</span>
                      </HoverTip>
                    </div>
                    <div className={styles.controls}>
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => void handleCopyCommand(agent, "terminal")}
                      >
                        <IconTerminal2 size={14} aria-hidden="true" />
                        <span>{isZh ? "复制启动命令" : "Copy CLI"}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.smallBtn}
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : agent.id)}
                      >
                        {expanded ? <IconChevronDown size={14} aria-hidden="true" /> : <IconChevronRight size={14} aria-hidden="true" />}
                        <span>{isZh ? "账户与配置" : "Accounts"}</span>
                      </button>
                      <SettingSwitch
                        checked={agent.enabled}
                        label={agent.name}
                        onChange={(checked) => void handleToggleEnabled(agent, checked)}
                      />
                    </div>
                  </div>

                  {expanded && (
                    <CliAgentAccountEditor
                      agent={agent}
                      isZh={isZh}
                      newAccountLabel={newAccountLabel[agent.id] ?? ""}
                      extraArgsDraft={extraArgsDraft[agent.id] ?? ""}
                      onNewAccountLabelChange={(value) => setNewAccountLabel((prev) => ({ ...prev, [agent.id]: value }))}
                      onExtraArgsChange={(value) => setExtraArgsDraft((prev) => ({ ...prev, [agent.id]: value }))}
                      onSelectAccount={(accountId) => void handleSelectAccount(agent.id, accountId)}
                      onAddAccount={() => void handleAddAccount(agent)}
                      onRemoveAccount={(accountId) => void handleRemoveAccount(agent.id, accountId)}
                      onSaveExtraArgs={() => void handleSaveExtraArgs(agent.id)}
                      onCopyLoginCommand={() => void handleCopyCommand(agent, "login")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingGroup>

      <SettingGroup title={isZh ? `可安装 (${available.length})` : `Available (${available.length})`}>
        <div className={styles.list}>
          {available.map((agent) => (
            <div key={agent.id} className={styles.item}>
              <div className={styles.row}>
                <div className={styles.main}>
                  <div className={styles.titleLine}>
                    <span className={styles.name}>{agent.name}</span>
                    {agent.supportsChat && (
                      <span className={`${styles.badge} ${styles.badgeAccent}`}>{isZh ? "支持聊天" : "Chat"}</span>
                    )}
                    <span className={styles.badge}>CLI</span>
                  </div>
                  <span className={styles.cmdLine}>{agent.installHint}</span>
                </div>
                <div className={styles.controls}>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={async () => {
                      const ok = await copyToClipboard(agent.installHint);
                      onNotify(ok ? (isZh ? `已复制安装命令：${agent.installHint}` : `Copied: ${agent.installHint}`) : agent.installHint);
                    }}
                  >
                    <IconCopy size={13} aria-hidden="true" />
                    <span>{isZh ? "复制安装命令" : "Copy install"}</span>
                  </button>
                  <a
                    className={styles.smallBtn}
                    href={agent.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconExternalLink size={13} aria-hidden="true" />
                    <span>{isZh ? "文档" : "Docs"}</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingGroup>
    </>
  );
}
