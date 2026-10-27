/**
 * 功能：呈现当前 Agent Git 项目中真实登记的可下载产物。
 * 作用：读取账户认证 API，下载前核验文件仍可用，再交给浏览器流式保存。
 * 不负责：发现项目目录、构建文件或推断未登记输出。
 */
import { useCallback, useEffect, useState } from "react";
import { agentDeliverableDownloadUrl, checkAgentDeliverableDownload, getErrorMessage, loadAgentDeliverables, type AgentDeliverable } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./agent-asset-library.css";

export interface AgentAssetLibraryProps {
  repositoryId: string | null;
  repositoryTitle?: string;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AgentAssetLibrary({ repositoryId, repositoryTitle = "当前项目" }: AgentAssetLibraryProps) {
  const [items, setItems] = useState<AgentDeliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!repositoryId) {
      setItems([]);
      setLoading(false);
      setLoadError("");
      return () => controller.abort();
    }
    setLoading(true);
    setLoadError("");
    loadAgentDeliverables(repositoryId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setItems(result.deliverables);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setLoadError(getErrorMessage(error));
      setItems([]);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [repositoryId]);

  const download = useCallback(async (item: AgentDeliverable) => {
    setDownloadingId(item.id);
    setDownloadError("");
    try {
      await checkAgentDeliverableDownload(item.id);
      const anchor = document.createElement("a");
      anchor.href = agentDeliverableDownloadUrl(item.id);
      anchor.download = item.fileName;
      anchor.rel = "noreferrer";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setDownloadError(`${item.fileName}：${getErrorMessage(error)}`);
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return <section className="lfaa-asset-library" aria-label="资产库" aria-busy={loading}>
    <header className="lfaa-asset-library__header">
      <div><span className="lfaa-asset-library__eyebrow">AGENT 交付物</span><h2>资产库</h2><p title={repositoryTitle}>{repositoryTitle}</p></div>
      <span className="lfaa-asset-library__count">{loading ? "读取中…" : `${items.length} 项`}</span>
    </header>
    {loadError ? <p className="lfaa-asset-library__error" role="alert">读取失败：{loadError}</p> : null}
    {downloadError ? <p className="lfaa-asset-library__error" role="alert">下载失败：{downloadError}</p> : null}
    {!repositoryId && !loading ? <div className="lfaa-asset-library__empty"><WorkbenchIcon name="archive" size={24} /><strong>先在项目中开始工作</strong><p>资产会归入当前 Agent Git 项目，源码仍由 Git 管理。</p></div> : null}
    {repositoryId && loading && items.length === 0 ? <p className="lfaa-asset-library__status" role="status">正在读取项目资产…</p> : null}
    {repositoryId && !loading && !loadError && items.length === 0 ? <div className="lfaa-asset-library__empty"><WorkbenchIcon name="archive" size={24} /><strong>这里会保存小鱼发布的最终产物</strong><p>例如插件构建成功后的 JAR。让小鱼完成构建并发布后，就能从这里下载。</p></div> : null}
    {items.length > 0 ? <ul className="lfaa-asset-library__list">
      {items.map(item => <li className="lfaa-asset-library__item" key={item.id}>
        <span className="lfaa-asset-library__file-icon"><WorkbenchIcon name="file" size={18} /></span>
        <div className="lfaa-asset-library__details">
          <strong title={item.title}>{item.title}</strong>
          <code title={item.path}>{item.path}</code>
          <small>{formatBytes(item.sizeBytes)} · 发布于 {formatTime(item.publishedAt)}</small>
        </div>
        <button type="button" className="lfaa-asset-library__download" disabled={downloadingId === item.id} onClick={() => void download(item)} aria-label={`下载 ${item.fileName}`}>
          <WorkbenchIcon name="archive" size={15} /><span>{downloadingId === item.id ? "检查中…" : "下载"}</span>
        </button>
      </li>)}
    </ul> : null}
  </section>;
}
