/**
 * 功能：呈现当前 Agent Git 项目中真实登记的可下载产物。
 * 作用：读取账户认证 API，下载前核验文件仍可用，再交给浏览器流式保存。
 * 不负责：发现项目目录、构建文件或推断未登记输出。
 */
import { useCallback, useEffect, useState } from "react";
import { agentDeliverableDownloadUrl, checkAgentDeliverableDownload, getErrorMessage, loadAgentDeliverables, type AgentDeliverable } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { assetGroupLabels, getAssetGroup, isFeaturedMinecraftJar } from "./asset-classification.js";
import "./agent-asset-library.css";

export interface AgentAssetLibraryProps {
  repositoryId: string | null;
  repositoryTitle?: string;
  repositoryLoading?: boolean;
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

export function AgentAssetLibrary({ repositoryId, repositoryTitle = "当前项目", repositoryLoading = false }: AgentAssetLibraryProps) {
  const [items, setItems] = useState<AgentDeliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const groups = ["minecraft-plugin", "minecraft-mod", "models", "textures", "resources", "other"] as const;
  const groupedItems = groups.map(group => ({ group, items: items.filter(item => getAssetGroup(item) === group) })).filter(group => group.items.length > 0);
  const featuredJar = items.find(isFeaturedMinecraftJar) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    if (!repositoryId) {
      setItems([]);
      setLoading(false);
      setLoadError("");
      return () => controller.abort();
    }
    setItems([]);
    setLoading(true);
    setLoadError("");
    setDownloadError("");
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

  const renderItem = (item: AgentDeliverable) => <li className="lfaa-asset-library__item" key={item.id}>
    <span className="lfaa-asset-library__file-icon"><WorkbenchIcon name="file" size={18} /></span>
    <div className="lfaa-asset-library__details">
      <strong title={item.title}>{item.title}</strong>
      <code title={item.path}>{item.path}</code>
      <small>{formatBytes(item.sizeBytes)} · 发布于 {formatTime(item.publishedAt)}</small>
      <small>来源会话：{item.sessionTitle || "历史会话"}</small>
    </div>
    <button type="button" className="lfaa-asset-library__download" disabled={downloadingId === item.id} onClick={() => void download(item)} aria-label={`下载 ${item.fileName}`}>
      <WorkbenchIcon name="archive" size={15} /><span>{downloadingId === item.id ? "检查中…" : "下载"}</span>
    </button>
  </li>;

  return <section className="lfaa-asset-library" aria-label="资产库" aria-busy={loading || repositoryLoading}>
    <header className="lfaa-asset-library__header">
      <div><span className="lfaa-asset-library__eyebrow">当前项目资产</span><h2>资产</h2><p title={repositoryId ? repositoryTitle : undefined}>{repositoryId ? repositoryTitle : repositoryLoading ? "正在读取当前对话项目…" : "尚未关联 Agent Git 项目"}</p></div>
      <span className="lfaa-asset-library__count">{loading || repositoryLoading ? "读取中…" : `${items.length} 个文件`}</span>
    </header>
    {loadError ? <p className="lfaa-asset-library__error" role="alert">读取失败：{loadError}</p> : null}
    {downloadError ? <p className="lfaa-asset-library__error" role="alert">下载失败：{downloadError}</p> : null}
    {!repositoryId && repositoryLoading ? <p className="lfaa-asset-library__status" role="status">正在读取当前对话的项目关联…</p> : null}
    {!repositoryId && !repositoryLoading && !loading ? <div className="lfaa-asset-library__empty"><WorkbenchIcon name="archive" size={24} /><strong>当前会话尚未关联 Git 项目</strong><p>资产按项目整理。小鱼开始在项目中写入后，会自动关联 Git；插件或模组构建验证通过后，可下载的 JAR 会收在这里。</p></div> : null}
    {repositoryId && loading && items.length === 0 ? <p className="lfaa-asset-library__status" role="status">正在读取项目资产…</p> : null}
    {repositoryId && !loading && !loadError && items.length === 0 ? <div className="lfaa-asset-library__empty"><WorkbenchIcon name="archive" size={24} /><strong>这个项目还没有已发布资产</strong><p>插件或模组构建验证通过后，小鱼会把可运行 JAR 发布到这里。</p></div> : null}
    {featuredJar ? <section className="lfaa-asset-library__featured" aria-label="可下载 Minecraft JAR">
      <span className="lfaa-asset-library__featured-icon"><WorkbenchIcon name="file" size={20} /></span>
      <div className="lfaa-asset-library__featured-copy">
        <span className="lfaa-asset-library__published">已发布 · 可下载</span>
        <strong>{featuredJar.artifactKind === "minecraft-plugin" ? "下载插件 JAR" : "下载模组 JAR"}</strong>
        <small>{featuredJar.fileName} · {formatBytes(featuredJar.sizeBytes)}</small>
        <small>{featuredJar.artifactKind === "minecraft-plugin" ? "放进服务端 plugins 文件夹" : "放进匹配加载器的 mods 文件夹"}</small>
      </div>
      <button type="button" className="lfaa-asset-library__download lfaa-asset-library__download--featured" disabled={downloadingId === featuredJar.id} onClick={() => void download(featuredJar)} aria-label={`下载 ${featuredJar.fileName}`}>
        <WorkbenchIcon name="archive" size={16} /><span>{downloadingId === featuredJar.id ? "检查中…" : "下载 JAR"}</span>
      </button>
    </section> : null}
    {groupedItems.length > 0 ? <div className="lfaa-asset-library__groups" aria-label="按类型整理的资产">
      {groupedItems.map(({ group, items: groupItems }) => <details className="lfaa-asset-library__group" key={group}>
        <summary><span>{assetGroupLabels[group]}</span><span>{groupItems.length}</span></summary>
        <ul className="lfaa-asset-library__list">{groupItems.map(renderItem)}</ul>
      </details>)}
    </div> : null}
    {items.length > 0 ? <details className="lfaa-asset-library__all-files">
      <summary><span>全部文件</span><span>{items.length} 项 · 展开</span></summary>
      <ul className="lfaa-asset-library__list">{items.map(renderItem)}</ul>
    </details> : null}
  </section>;
}
