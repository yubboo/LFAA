// 连接器目录：搜索、类型 / 分类筛选、卡片网格、连接任务进度与详情弹窗。
import { useEffect, useState } from "react";
import type { CatalogItem, CatalogJob } from "@lfaa/connectors/contract";
import { settingsStyles as base } from "@lfaa/ui-primitives/client";
import { connectorsApi } from "../api/connectors-client";
import { connectorLabels } from "../locales";
import { ConnectorCard } from "./Connector-Card";
import { ConnectorConnectDialog } from "./Connector-Connect-Dialog";
import { ConnectorDetailDialog } from "./Connector-Detail-Dialog";
import dirm from "./Connectors-Directory.module.css";
import styles from "./Connectors-Settings.module.css";

type KindFilter = "all" | "mcp" | "cli";
type CategoryFilter = "all" | "popular" | "dev" | "office" | "data" | "system";
const KINDS: KindFilter[] = ["all", "mcp", "cli"];
const CATEGORIES: CategoryFilter[] = ["popular", "dev", "office", "data", "system"];

export function ConnectorsDirectory({ isZh, onManage }: { isZh: boolean; onManage: (kind: "mcp" | "cli") => void }) {
  const labels = connectorLabels(isZh);
  const dir = labels.directory;
  const [items, setItems] = useState<CatalogItem[]>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [detail, setDetail] = useState<CatalogItem>();
  const [connecting, setConnecting] = useState<CatalogItem>();
  const [job, setJob] = useState<CatalogJob>();
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { catalog } = await connectorsApi.catalog();
      setItems(catalog);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : labels.failed);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // 连接任务进行中：轮询状态，完成后刷新目录并给出结果提示。
  const jobId = job?.state === "running" ? job.id : undefined;
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    const timer = setInterval(() => {
      void connectorsApi.job(jobId).then(({ job: next }) => {
        if (stopped) return;
        setJob(next);
        if (next.state === "running") return;
        setBusy(false);
        if (next.state === "error") setError(next.message);
        else setNotice(next.message);
        void load();
      }).catch(() => {
        if (stopped) return;
        setBusy(false);
        setError(dir.installFailed("任务状态读取失败"));
      });
    }, 900);
    return () => { stopped = true; clearInterval(timer); };
  }, [jobId]);

  const connect = (item: CatalogItem, inputs: Record<string, string>) => {
    setBusy(true);
    setError("");
    setNotice("");
    void connectorsApi.connectCatalog(item.id, inputs).then(({ job: started }) => {
      setJob(started);
      setConnecting(undefined);
      setNotice(started.message);
    }).catch((failure: unknown) => {
      setBusy(false);
      setError(dir.installFailed(failure instanceof Error ? failure.message : "未知错误"));
    });
  };

  const openConnect = (item: CatalogItem) => {
    if (item.inputs?.length) setConnecting(item);
    else connect(item, {});
  };

  const uninstall = (item: CatalogItem) => {
    setBusy(true);
    void connectorsApi.disconnectCatalog(item.id).then(() => {
      setDetail(undefined);
      setNotice(dir.uninstalled(item.name));
      return load();
    }).catch((failure: unknown) => {
      setError(failure instanceof Error ? failure.message : labels.failed);
    }).finally(() => setBusy(false));
  };

  const tryExample = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => setNotice(dir.copied), () => setNotice(dir.copied));
  };

  const visible = (items ?? []).filter((item) => {
    if (kind !== "all" && item.kind !== kind) return false;
    if (category === "popular" && !item.popular) return false;
    if (category !== "all" && category !== "popular" && item.category !== category) return false;
    const key = query.trim().toLowerCase();
    return !key || item.name.toLowerCase().includes(key) || item.description.toLowerCase().includes(key) || item.id.includes(key);
  });

  return (
    <>
      <div className={dirm.directoryBar}>
        <input className={`${base.input} ${dirm.search}`} type="search" value={query} placeholder={dir.search} aria-label={dir.search} onChange={(event) => setQuery(event.target.value)} />
        <details className={dirm.customMenu}>
          <summary className={base.actionBtn}>{dir.custom}</summary>
          <div className={dirm.customList}>
            <button type="button" onClick={() => onManage("mcp")}>{dir.customMcp}</button>
            <button type="button" onClick={() => onManage("cli")}>{dir.customCli}</button>
          </div>
        </details>
      </div>
      <div className={dirm.chips} role="group" aria-label={dir.title}>
        {KINDS.map((value) => (
          <button key={value} type="button" className={dirm.chip} data-active={kind === value ? "true" : undefined} onClick={() => setKind(value)}>
            {value === "all" ? dir.all : value === "mcp" ? dir.mcpKind : dir.cliKind}
          </button>
        ))}
        <span className={dirm.chipDivider} aria-hidden="true" />
        {category !== "all" && (
          <button type="button" className={dirm.chip} onClick={() => setCategory("all")}>{dir.all}</button>
        )}
        {CATEGORIES.map((value) => (
          <button key={value} type="button" className={dirm.chip} data-active={category === value ? "true" : undefined} onClick={() => setCategory(category === value ? "all" : value)}>
            {dir[value]}
          </button>
        ))}
      </div>
      {(notice || error) && <div aria-live="polite">
        {notice && <p className={styles.message} role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>}
      {items === undefined && !error && <p className={styles.message}>{labels.loading}</p>}
      {items !== undefined && visible.length === 0 && <p className={styles.message}>{dir.empty}</p>}
      <div className={dirm.cardGrid}>
        {visible.map((item) => (
          <ConnectorCard key={item.id} item={item} labels={labels} busy={busy && !item.connected} onOpen={setDetail} onConnect={openConnect} />
        ))}
      </div>
      {detail && (
        <ConnectorDetailDialog
          item={detail}
          labels={labels}
          busy={busy}
          onClose={() => setDetail(undefined)}
          onConnect={(item) => { setDetail(undefined); openConnect(item); }}
          onUninstall={uninstall}
          onTry={tryExample}
          onSettings={(item) => { setDetail(undefined); onManage(item.kind); }}
        />
      )}
      {connecting && (
        <ConnectorConnectDialog item={connecting} labels={labels} busy={busy} error={error} onClose={() => setConnecting(undefined)} onSubmit={(inputs) => connect(connecting, inputs)} />
      )}
    </>
  );
}