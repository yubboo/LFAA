// 设置中心「连接器」页：目录（卡片）在前，MCP 服务器与命令行工具作为管理页签在后。
import { useState } from "react";
import { SettingSegmented, SettingsPage } from "@lfaa/ui-primitives/client";
import { readStoredJson, writeStoredJson } from "@lfaa/ui-layout/client";
import { connectorLabels } from "../locales";
import { McpServersSection } from "../mcp/Mcp-Servers-Section";
import { CliToolsSection } from "./Cli-Tools-Section";
import { ConnectorsDirectory } from "./Connectors-Directory";
import styles from "./Connectors-Settings.module.css";

const TAB_KEY = "lfaa:settings-connectors-tab";
type ConnectorTab = "directory" | "mcp" | "cli";
const TABS: ConnectorTab[] = ["directory", "mcp", "cli"];

/** 连接器主视图：默认停在目录，并记住上次页签；「自定义连接器」跳到对应管理页并打开新建弹窗。 */
export function ConnectorsSettings({ isZh }: { isZh: boolean }) {
  const labels = connectorLabels(isZh);
  const [tab, updateTab] = useState<ConnectorTab>(() => {
    const stored = readStoredJson<ConnectorTab>(TAB_KEY, "directory");
    return TABS.includes(stored) ? stored : "directory";
  });
  const [autoAdd, setAutoAdd] = useState<{ kind: "mcp" | "cli"; nonce: number } | null>(null);
  const setTab = (value: ConnectorTab) => {
    updateTab(value);
    writeStoredJson(TAB_KEY, value);
  };
  const manage = (kind: "mcp" | "cli") => {
    setTab(kind);
    setAutoAdd({ kind, nonce: Date.now() });
  };
  return (
    <SettingsPage title={labels.title} description={labels.description}>
      <div className={styles.tabs}>
        <SettingSegmented<ConnectorTab>
          value={tab}
          label={labels.title}
          options={[
            { value: "directory", label: labels.directory.title },
            { value: "mcp", label: labels.tabs.mcp },
            { value: "cli", label: labels.tabs.cli },
          ]}
          onChange={setTab}
        />
      </div>
      {tab === "directory" && <ConnectorsDirectory isZh={isZh} onManage={manage} />}
      {tab === "mcp" && (
        <McpServersSection isZh={isZh} {...(autoAdd?.kind === "mcp" ? { autoAdd: autoAdd.nonce } : {})} onAutoAdd={() => setAutoAdd(null)} />
      )}
      {tab === "cli" && (
        <CliToolsSection isZh={isZh} {...(autoAdd?.kind === "cli" ? { autoAdd: autoAdd.nonce } : {})} onAutoAdd={() => setAutoAdd(null)} />
      )}
    </SettingsPage>
  );
}