// 「连接器」页的命令行工具分区：列表、启停、测试、编辑与删除；每个连接器对应一组 cli__ 工具。
import { useEffect, useState } from "react";
import type { CliConnectorConfig, ConnectorSummary, ConnectorTemplate } from "@lfaa/connectors/contract";
import {
  ConfirmDialog, SettingDangerGroup, SettingGroup, SettingRow, SettingSwitch, settingsStyles as base,
} from "@lfaa/ui-primitives/client";
import { connectorsApi, type CliConnectorPayload } from "../api/connectors-client";
import { connectorLabels } from "../locales";
import { CliConnectorDialog } from "./Cli-Connector-Dialog";
import { CliExportDialog } from "./Cli-Export-Dialog";
import { CliImportDialog } from "./Cli-Import-Dialog";
import styles from "./Connectors-Settings.module.css";

type Editor = { mode: "add" } | { mode: "edit"; connector: CliConnectorConfig };

export function CliToolsSection({ isZh, autoAdd, onAutoAdd }: { isZh: boolean; autoAdd?: number; onAutoAdd?: () => void }) {
  const labels = connectorLabels(isZh);
  const cli = labels.cli;
  const [connectors, setConnectors] = useState<ConnectorSummary[]>();
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor>();
  const [remove, setRemove] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState<CliConnectorConfig>();

  useEffect(() => {
    const controller = new AbortController();
    void connectorsApi.list(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setConnectors(data.connectors);
        setTemplates(data.templates);
      })
      .catch(() => { if (!controller.signal.aborted) setError((previous) => previous || labels.failed); });
    return () => controller.abort();
  }, [labels]);

  const tools = connectors?.filter((item) => item.kind === "cli") ?? [];

  const operate = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : labels.failed);
    } finally {
      setBusy(false);
    }
  };

  const refresh = (data: { connectors: ConnectorSummary[] }) => setConnectors(data.connectors);

  const openAdd = () => { setError(""); setEditor({ mode: "add" }); };

  useEffect(() => {
    if (autoAdd === undefined) return;
    openAdd();
    onAutoAdd?.();
  }, [autoAdd]);

  const openEdit = (id: string) => void operate(async () => {
    const { connector } = await connectorsApi.get(id);
    setError("");
    setEditor({ mode: "edit", connector });
  });

  const openExport = (id: string) => void operate(async () => {
    const { connector } = await connectorsApi.get(id);
    setError("");
    setExporting(connector);
  });

  const importConnectors = (payload: unknown) => void operate(async () => {
    const data = await connectorsApi.importConnectors(payload);
    refresh(data);
    setImporting(false);
    setNotice(cli.imported(data.connectors.filter((item) => item.kind === "cli").length));
  });

  const save = (payload: CliConnectorPayload) => void operate(async () => {
    const data = editor?.mode === "edit"
      ? await connectorsApi.update(editor.connector.id, payload)
      : await connectorsApi.create(payload);
    refresh(data);
    setEditor(undefined);
    setNotice(labels.saved);
  });

  const toggle = (id: string, enabled: boolean) => void operate(async () => {
    refresh(await connectorsApi.update(id, { enabled }));
  });

  const test = (id: string) => void operate(async () => {
    const { result } = await connectorsApi.test(id);
    setNotice(result.ok ? labels.tested(result.detail) : labels.testFailed(result.detail));
  });

  return (
    <>
      {(notice || (error && !editor && !remove && !importing && !exporting)) && <div aria-live="polite">
        {notice && <p className={styles.message} role="status">{notice}</p>}
        {error && !editor && !remove && !importing && !exporting && <p className={styles.error} role="alert">{error}</p>}
      </div>}
      <SettingGroup title={labels.cliGroup} actions={
        <div className={styles.actions}>
          <button className={base.actionBtn} type="button" disabled={busy} onClick={() => { setError(""); setImporting(true); }}>{cli.import}</button>
          <button className={base.actionBtn} type="button" disabled={busy} onClick={openAdd}>{cli.add}</button>
        </div>
      }>
        {!tools.length && <p className={styles.message}>{connectors ? cli.empty : labels.loading}</p>}
        {tools.map((tool) => (
          <SettingRow
            key={tool.id}
            title={tool.name}
            description={(
              <span className={styles.status} data-status={tool.status}>
                {tool.detail} · {cli.actionCount(tool.actions.length)} · {cli.status[tool.status as keyof typeof cli.status] ?? tool.status}
              </span>
            )}
            control={(
              <fieldset className={styles.actions} disabled={busy} aria-label={tool.name}>
                <button className={base.actionBtn} type="button" onClick={() => openEdit(tool.id)}>{cli.edit}</button>
                <button className={base.actionBtn} type="button" onClick={() => openExport(tool.id)}>{cli.export}</button>
                <button className={base.actionBtn} type="button" onClick={() => test(tool.id)}>{cli.test}</button>
                <SettingSwitch checked={tool.enabled} label={`${cli.enabled} ${tool.name}`} onChange={(enabled) => toggle(tool.id, enabled)} />
              </fieldset>
            )}
          />
        ))}
      </SettingGroup>
      {tools.length > 0 && <SettingDangerGroup title={cli.danger}>
        {tools.map((tool) => (
          <SettingRow
            key={tool.id}
            title={tool.name}
            control={(
              <button className={base.dangerBtn} type="button" disabled={busy} aria-label={`${cli.remove} ${tool.name}`}
                onClick={() => { setError(""); setRemove(tool.id); }}>
                {cli.remove}
              </button>
            )}
          />
        ))}
      </SettingDangerGroup>}
      {editor && (
        <CliConnectorDialog
          mode={editor.mode}
          {...(editor.mode === "edit" ? { connector: editor.connector } : {})}
          templates={templates}
          labels={labels}
          busy={busy}
          error={error}
          onClose={() => { setError(""); setEditor(undefined); }}
          onSave={save}
        />
      )}
      {importing && (
        <CliImportDialog
          labels={labels}
          busy={busy}
          error={error}
          onClose={() => { setError(""); setImporting(false); }}
          onImport={importConnectors}
        />
      )}
      {exporting && (
        <CliExportDialog connector={exporting} labels={labels} onClose={() => setExporting(undefined)} />
      )}
      {remove && (
        <ConfirmDialog
          open
          title={`${cli.remove} ${remove}`}
          description={cli.removeConfirm}
          cancelLabel={labels.mcp.cancel}
          confirmLabel={cli.remove}
          closeLabel={labels.mcp.close}
          busy={busy}
          error={error}
          onClose={() => { setError(""); setRemove(undefined); }}
          onConfirm={() => void operate(async () => {
            refresh(await connectorsApi.remove(remove));
            setRemove(undefined);
            setNotice(labels.removed);
          })}
        />
      )}
    </>
  );
}