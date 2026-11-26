// 「连接器」页的 MCP 分组：管理连接、项目范围、审批和工具列表（原独立 MCP 页，现并入连接器分区）。
import { useEffect, useRef, useState } from "react";
import type { McpServerSummary, McpTrust } from "@lfaa/mcp/contract";
import {
  ConfirmDialog, SettingDangerGroup, SettingGroup, SettingRow, SettingSegmented, SettingSelect,
  SettingSwitch, settingsStyles as base,
} from "@lfaa/ui-primitives/client";
import { mcpApi } from "../api/mcp-client";
import { connectorLabels } from "../locales";
import { McpDialog, type McpEditor } from "./Mcp-Dialog";
import styles from "./Mcp-Settings.module.css";

const transports = { stdio: "Stdio", http: "Streamable HTTP", sse: "SSE" };

export function McpServersSection({ isZh, autoAdd, onAutoAdd }: { isZh: boolean; autoAdd?: number; onAutoAdd?: () => void }) {
  const shared = connectorLabels(isZh);
  const labels = shared.mcp;
  const [servers, setServers] = useState<McpServerSummary[]>();
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [editor, setEditor] = useState<McpEditor>();
  const [remove, setRemove] = useState<string>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const active = servers?.some((server) => server.enabled) ?? false;

  useEffect(() => {
    const controller = new AbortController();
    void mcpApi.projects(controller.signal).then((data) => setProjects(data.projects)).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await mcpApi.list(controller.signal);
        if (!controller.signal.aborted && !pending.current) setServers(data.servers);
      } catch {
        if (!controller.signal.aborted && !pending.current) setError((previous) => previous || shared.failed);
      }
      if (active && !controller.signal.aborted) timer = setTimeout(() => void refresh(), 1_500);
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [active, busy, labels]);

  const operate = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : shared.failed);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const update = (id: string, patch: unknown) => void operate(async () => {
    setServers((await mcpApi.update(id, patch)).servers);
  });

  const edit = (next: McpEditor) => { setError(""); setEditor(next); };
  const openAdd = () => edit({ kind: "add" });

  useEffect(() => {
    if (autoAdd === undefined) return;
    openAdd();
    onAutoAdd?.();
  }, [autoAdd]);
  const trust = [{ value: "ask", label: labels.ask }, { value: "trusted", label: labels.trusted }] as const;
  const projectOptions = [{ value: "", label: labels.global }, ...projects.map(({ id, name }) => ({ value: id, label: name }))];

  return (
    <>
      {(notice || (error && !editor && !remove)) && <div aria-live="polite">
        {notice && <p className={styles.message} role="status">{notice}</p>}
        {error && !editor && !remove && <p className={styles.error} role="alert">{error}</p>}
      </div>}
      <SettingGroup title={labels.connections} actions={
        <div className={styles.actions}>
          <button className={base.actionBtn} type="button" disabled={busy} onClick={() => edit({ kind: "import" })}>{labels.import}</button>
          <button className={`${base.actionBtn} ${styles.emphasized}`} type="button" disabled={busy} onClick={() => edit({ kind: "add" })}>{labels.add}</button>
        </div>
      }>
        {!servers?.length && <p className={styles.message}>{servers ? labels.empty : error ? "" : shared.loading}</p>}
        {servers?.map((server) => (
          <SettingRow
            key={server.id}
            title={server.id}
            description={<span className={styles.status} data-status={server.status}>{transports[server.transport]} · {labels.status[server.status]} · {labels.count(server.tools.length)}</span>}
            control={
              <fieldset className={styles.actions} disabled={busy} aria-label={server.id}>
                <button className={base.actionBtn} type="button" onClick={() => edit({ kind: "edit", server })}>{labels.edit}</button>
                <button className={base.actionBtn} type="button" onClick={() => void operate(async () => {
                  setNotice(labels.tested((await mcpApi.test(server.id)).count));
                })}>{labels.test}</button>
                {server.enabled && <button className={base.actionBtn} type="button" onClick={() => void operate(async () => {
                  setServers((await mcpApi.reconnect(server.id)).servers);
                })}>{labels.reconnect}</button>}
                <SettingSwitch checked={server.enabled} label={`${labels.enabled} ${server.id}`} onChange={(enabled) => update(server.id, { enabled })} />
              </fieldset>
            }
          />
        ))}
      </SettingGroup>
      {servers?.map((server) => (
        <SettingGroup title={server.id} key={server.id}>
          <SettingRow title={labels.project} control={
            <SettingSelect
              label={`${server.id} · ${labels.project}`}
              value={server.projectId ?? ""}
              options={server.projectId && !projects.some(({ id }) => id === server.projectId)
                ? [...projectOptions, { value: server.projectId, label: labels.missingProject }]
                : projectOptions}
              onChange={(projectId) => update(server.id, { projectId: projectId || null })}
            />
          } />
          <SettingRow title={labels.trust} description={labels.safety} control={
            <fieldset className={styles.actions} disabled={busy}>
              <SettingSegmented<McpTrust> value={server.trust} label={`${server.id} · ${labels.trust}`} options={trust}
                onChange={(policy) => update(server.id, { trust: policy })} />
            </fieldset>
          } />
          {server.tools.length > 0 && <details className={styles.tools}>
            <summary>{labels.tools} ({server.tools.length})</summary>
            {server.tools.map((tool) => (
              <SettingRow key={tool.name} title={tool.title} description={tool.name !== tool.title ? tool.name : undefined} control={
                <fieldset className={styles.actions} disabled={busy}>
                  <select className={base.input} aria-label={`${labels.toolTrust} · ${tool.name}`} value={tool.trust}
                    onChange={(event) => update(server.id, { toolTrust: { [tool.name]: event.target.value } })}>
                    <option value="inherit">{labels.inherit}</option>
                    <option value="ask">{labels.ask}</option>
                    <option value="trusted">{labels.trusted}</option>
                  </select>
                </fieldset>
              } />
            ))}
          </details>}
        </SettingGroup>
      ))}
      {Boolean(servers?.length) && <SettingDangerGroup title={labels.danger}>
        {servers?.map((server) => <SettingRow key={server.id} title={server.id} control={
          <button className={base.dangerBtn} type="button" disabled={busy} aria-label={`${labels.remove} ${server.id}`}
            onClick={() => { setError(""); setRemove(server.id); }}>{labels.remove}</button>
        } />)}
      </SettingDangerGroup>}
      {editor && <McpDialog editor={editor} labels={labels} busy={busy} error={error}
        onClose={() => { setError(""); setEditor(undefined); }}
        onSave={(payload) => void operate(async () => {
          const result = await (editor.kind === "edit" ? mcpApi.update(editor.server.id, payload)
            : editor.kind === "import" ? mcpApi.import(payload) : mcpApi.create(payload));
          setServers(result.servers);
          setEditor(undefined);
          setNotice(editor.kind === "import" ? labels.imported : shared.saved);
        })} />}
      {remove && <ConfirmDialog open title={`${labels.remove} ${remove}`} description={labels.removeConfirm}
        cancelLabel={labels.cancel} confirmLabel={labels.remove} closeLabel={labels.close}
        busy={busy} error={error} onClose={() => { setError(""); setRemove(undefined); }}
        onConfirm={() => void operate(async () => {
          setServers((await mcpApi.remove(remove)).servers);
          setRemove(undefined);
        })} />}
    </>
  );
}