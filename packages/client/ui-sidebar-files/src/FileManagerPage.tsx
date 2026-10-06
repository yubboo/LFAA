/**
 * 功能：呈现各应用共用的 daemon 文件管理工作台。
 * 作用：浏览和搜索受管目录，创建、编辑、上传、下载、重命名与删除文件，并显示节点任务状态。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-sidebar/src/GlobalNavigationRail.tsx、packages/client/ui-sidebar-files/src/FileManagerPage.css、packages/fs/fs/src/queue.ts。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { Alert, Button, Empty, Input, Modal, Select, Space, Spin, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { getErrorMessage, hasAdminAccess, loadFileManagerNodes, loadFileManagerTask, submitFileManagerTask, type FileManagerNode, type FileManagerOperation, type FileManagerTask, type ManagedFileEntry, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import type { ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { GlobalNavigationRail } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./FileManagerPage.css";

interface FileManagerSnapshot {
  nodes: FileManagerNode[];
  nodeId: string;
  currentPath: string;
  entries: ManagedFileEntry[];
  searchText: string;
  searchQuery: string;
  truncated: boolean;
}

const fileManagerSnapshots = createSnapshotCache<FileManagerSnapshot>();

interface FileManagerPageProps {
  user: User;
  settings: UserSettings;
  serverState: ServiceState;
  homeRoute: string;
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLastSeen(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? "时间未知" : timestamp.toLocaleString();
}

function pathWithin(directory: string, name: string): string {
  return [directory, name].filter(Boolean).join("/");
}

function getFileManagerModalContainer(): HTMLElement {
  // 弹窗挂到工作台后可继承设置中心注入的主题、字体、强调色和外观变量。
  return document.querySelector<HTMLElement>(".workbench-shell") ?? document.body;
}

export function FileManagerPage({ user, settings, serverState, homeRoute, onNavigate, onOpenSettings, onLogout }: FileManagerPageProps) {
  const [messageApi, messageContext] = message.useMessage();
  const [modalApi, modalContext] = Modal.useModal();
  const cacheKey = `${user.id}:${user.role}`;
  const cachedSnapshot = useRef(fileManagerSnapshots.get(cacheKey) ?? null).current;
  const [nodes, setNodes] = useState<FileManagerNode[]>(() => cachedSnapshot?.nodes ?? []);
  const [nodeId, setNodeId] = useState(() => cachedSnapshot?.nodeId ?? "");
  const [currentPath, setCurrentPath] = useState(() => cachedSnapshot?.currentPath ?? "");
  const [entries, setEntries] = useState<ManagedFileEntry[]>(() => cachedSnapshot?.entries ?? []);
  const [searchText, setSearchText] = useState(() => cachedSnapshot?.searchText ?? "");
  const [searchQuery, setSearchQuery] = useState(() => cachedSnapshot?.searchQuery ?? "");
  const [nodesLoading, setNodesLoading] = useState(() => cachedSnapshot === null);
  const [nodesRefreshing, setNodesRefreshing] = useState(false);
  const [loading, setLoading] = useState(() => cachedSnapshot === null);
  const [directoryState, setDirectoryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [taskMessage, setTaskMessage] = useState("");
  const [truncated, setTruncated] = useState(() => cachedSnapshot?.truncated ?? false);
  const [createKind, setCreateKind] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [renameEntry, setRenameEntry] = useState<ManagedFileEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editorPath, setEditorPath] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorSavedContent, setEditorSavedContent] = useState("");
  const [editorBusy, setEditorBusy] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const refreshNodesRef = useRef<(() => void) | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const nodeIdRef = useRef(nodeId);
  nodeIdRef.current = nodeId;
  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const directoryReadSequence = useRef(0);

  const selectedNode = nodes.find((node) => node.id === nodeId) ?? null;
  const isOnline = selectedNode?.status === "online";
  const directoryReady = directoryState === "ready";
  const nodeSelectionLocked = busy || createKind !== null || renameEntry !== null || Boolean(editorPath);

  const runTask = useCallback(async (
    operation: FileManagerOperation,
    input: { path: string; query?: string; name?: string; content?: string; dataBase64?: string }
  ): Promise<Record<string, unknown>> => {
    if (!nodeId || !isOnline) throw new Error("所选 daemon 节点当前离线，请先恢复连接或切换到在线节点。");
    setBusy(true);
    setError("");
    setTaskMessage("正在提交文件任务…");
    try {
      const { task: submitted } = await submitFileManagerTask({ nodeId, operation, ...input });
      setTaskMessage(submitted.message);
      let task: FileManagerTask = submitted;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        if (task.status === "succeeded") return task.result ?? {};
        if (task.status === "failed") throw new Error(task.message || "文件任务执行失败。");
        await wait(500);
        const latest = await loadFileManagerTask(task.id);
        task = latest.task;
        setTaskMessage(task.message);
      }
      throw new Error("文件任务等待超时；请刷新目录确认文件状态后再继续操作。");
    } catch (taskError) {
      const detail = getErrorMessage(taskError);
      setError(detail);
      throw new Error(detail);
    } finally {
      setBusy(false);
      setTaskMessage("");
    }
  }, [isOnline, nodeId]);

  const refresh = useCallback(async () => {
    const request = ++directoryReadSequence.current;
    if (!nodeId || !isOnline) {
      // 离线缓存只能用于节点恢复后的快速首屏，不能伪装成当前可操作目录。
      setEntries([]);
      setTruncated(false);
      setLoading(false);
      setDirectoryState("idle");
      return;
    }
    // 目录请求成功前隐藏缓存，避免请求失败时把旧列表或空数组伪装成当前目录。
    setLoading(true);
    setDirectoryState("loading");
    setEntries([]);
    setTruncated(false);
    setError("");
    try {
      const result = searchQuery.trim()
        ? await runTask("search", { path: currentPath, query: searchQuery.trim() })
        : await runTask("list", { path: currentPath });
      if (request !== directoryReadSequence.current) return;
      const nextEntries = Array.isArray(result.entries) ? result.entries as ManagedFileEntry[] : [];
      setEntries(nextEntries);
      const nextTruncated = result.truncated === true;
      setTruncated(nextTruncated);
      setDirectoryState("ready");
      fileManagerSnapshots.set(cacheKey, {
        nodes: nodesRef.current, nodeId, currentPath, searchText: searchTextRef.current, searchQuery, entries: nextEntries, truncated: nextTruncated
      });
    } catch {
      if (request !== directoryReadSequence.current) return;
      setEntries([]);
      setTruncated(false);
      setDirectoryState("error");
    } finally {
      if (request === directoryReadSequence.current) setLoading(false);
    }
  }, [cacheKey, currentPath, isOnline, nodeId, runTask, searchQuery]);

  useEffect(() => {
    if (!hasAdminAccess(user.role)) {
      refreshNodesRef.current = null;
      setNodesLoading(false);
      return;
    }
    let active = true;
    let loaded = false;
    let manualRefreshRevision = 0;
    let completedManualRefreshRevision = 0;
    let requestSequence = 0;
    const refreshNodes = async () => {
      const request = ++requestSequence;
      const manualRevision = manualRefreshRevision;
      const manual = manualRevision > completedManualRefreshRevision;
      if (manual) {
        setNodesRefreshing(true);
        setError("");
      }
      try {
        const { nodes: nextNodes } = await loadFileManagerNodes();
        if (!active || request !== requestSequence) return;
        const currentNodeId = nodeIdRef.current;
        setNodes(nextNodes);
        const nextNodeId = currentNodeId && nextNodes.some((node) => node.id === currentNodeId)
          ? currentNodeId
          : nextNodes.find((node) => node.status === "online")?.id ?? nextNodes[0]?.id ?? "";
        if (nextNodeId !== currentNodeId) {
          setNodeId(nextNodeId);
          setCurrentPath("");
          setSearchText("");
          setSearchQuery("");
          setEntries([]);
          setTruncated(false);
          setDirectoryState("idle");
        }
        const snapshot = fileManagerSnapshots.get(cacheKey);
        if (snapshot) {
          const sameSnapshotNode = snapshot.nodeId === nextNodeId;
          fileManagerSnapshots.set(cacheKey, {
            ...snapshot,
            nodes: nextNodes,
            ...(sameSnapshotNode ? {} : { nodeId: nextNodeId, currentPath: "", entries: [], searchText: "", searchQuery: "", truncated: false })
          });
        }
      } catch (loadError) {
        if (active && request === requestSequence && (!loaded || manual)) setError(getErrorMessage(loadError));
      } finally {
        if (active && request === requestSequence) {
          if (!loaded) {
            loaded = true;
            setNodesLoading(false);
          }
          if (manual && manualRevision === manualRefreshRevision) {
            completedManualRefreshRevision = manualRevision;
            setNodesRefreshing(false);
          }
        }
      }
    };
    if (cachedSnapshot === null) setNodesLoading(true);
    // 节点在线状态来自 daemon 心跳；定时刷新让页面能跟上 daemon 启停。
    const poller = createReadPoller(refreshNodes, 10_000);
    refreshNodesRef.current = () => {
      manualRefreshRevision += 1;
      setNodesRefreshing(true);
      setError("");
      void poller.refresh();
    };
    return () => {
      active = false;
      requestSequence += 1;
      refreshNodesRef.current = null;
      poller.stop();
    };
  }, [cacheKey, cachedSnapshot, user.role]);

  useEffect(() => {
    void refresh();
    return () => { directoryReadSequence.current += 1; };
  }, [refresh]);

  const openEntry = async (entry: ManagedFileEntry) => {
    if (entry.kind === "directory") {
      setSearchQuery("");
      setSearchText("");
      setCurrentPath(entry.path);
      return;
    }
    try {
      const result = await runTask("read", { path: entry.path });
      if (typeof result.content !== "string") throw new Error("Daemon 没有返回可编辑的文本内容。");
      setEditorPath(entry.path);
      setEditorContent(result.content);
      setEditorSavedContent(result.content);
    } catch {
      // 错误由任务提交状态统一显示；二进制文件仍可下载后使用本地程序编辑。
    }
  };

  const navigateUp = () => {
    setSearchQuery("");
    setSearchText("");
    setCurrentPath(currentPath.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/")) : "");
  };

  const openCreateDialog = (kind: "file" | "folder") => {
    setNewName("");
    setCreateKind(kind);
  };

  const createEntry = async () => {
    if (!createKind || !newName.trim()) return;
    const path = pathWithin(currentPath, newName.trim());
    try {
      await runTask(createKind === "file" ? "create-file" : "create-folder", { path });
      setCreateKind(null);
      messageApi.success(createKind === "file" ? "文件已创建。" : "文件夹已创建。");
      await refresh();
    } catch {
      // 错误显示在工具栏下方。
    }
  };

  const beginRename = (entry: ManagedFileEntry) => {
    setRenameEntry(entry);
    setRenameValue(entry.name);
  };

  const renameSelectedEntry = async () => {
    if (!renameEntry || !renameValue.trim()) return;
    try {
      await runTask("rename", { path: renameEntry.path, name: renameValue.trim() });
      setRenameEntry(null);
      messageApi.success("名称已更新。");
      await refresh();
    } catch {
      // 错误显示在工具栏下方。
    }
  };

  const deleteEntry = (entry: ManagedFileEntry) => {
    modalApi.confirm({
      title: entry.kind === "directory" ? "删除文件夹？" : "删除文件？",
      content: entry.kind === "directory" ? `“${entry.name}”及其中所有文件都会被删除。` : `“${entry.name}”将被永久删除。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      getContainer: getFileManagerModalContainer,
      onOk: async () => {
        await runTask("delete", { path: entry.path });
        messageApi.success("已删除。");
        await refresh();
      }
    });
  };

  const downloadEntry = async (entry: ManagedFileEntry) => {
    try {
      const result = await runTask("download", { path: entry.path });
      if (typeof result.dataBase64 !== "string") throw new Error("Daemon 没有返回文件内容。");
      const binary = window.atob(result.dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const url = URL.createObjectURL(new Blob([bytes]));
      const link = document.createElement("a");
      link.href = url;
      link.download = typeof result.name === "string" ? result.name : entry.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // 错误显示在工具栏下方。
    }
  };

  const uploadSelectedFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("单个上传文件不能超过 3 MiB。");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("无法读取上传文件。")), { once: true });
        reader.addEventListener("error", () => reject(new Error("无法读取上传文件。")), { once: true });
        reader.readAsDataURL(file);
      });
      const separator = dataUrl.indexOf(",");
      if (separator < 0) throw new Error("上传文件编码无效。");
      await runTask("upload", { path: currentPath, name: file.name, dataBase64: dataUrl.slice(separator + 1) });
      messageApi.success("文件已上传。");
      await refresh();
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const saveEditor = async () => {
    setEditorBusy(true);
    try {
      await runTask("write", { path: editorPath, content: editorContent });
      setEditorSavedContent(editorContent);
      setEditorPath("");
      messageApi.success("文件已保存。");
      await refresh();
    } catch {
      // 错误显示在工具栏下方。
    } finally {
      setEditorBusy(false);
    }
  };

  const columns: ColumnsType<ManagedFileEntry> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      render: (_value, entry) => <button className="file-manager__name" type="button" onClick={() => entry.kind === "directory" ? void openEntry(entry) : undefined}>
        <WorkbenchIcon name={entry.kind === "directory" ? "folder" : "file"} size={17} />
        <span>{entry.name}</span>
      </button>
    },
    { title: "大小", dataIndex: "size", key: "size", width: 110, render: (size: number, entry) => entry.kind === "directory" ? "—" : formatBytes(size) },
    { title: "修改时间", dataIndex: "modifiedAt", key: "modifiedAt", width: 210, render: (value: string) => new Date(value).toLocaleString() },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_value, entry) => <Space size={4}>
        <Button type="text" size="small" disabled={busy || !isOnline || !directoryReady || entry.kind === "file" && entry.size > 2 * 1024 * 1024} onClick={() => void openEntry(entry)}>{entry.kind === "directory" ? "打开" : "编辑"}</Button>
        {entry.kind === "file" ? <Button type="text" size="small" disabled={busy || !isOnline || !directoryReady} onClick={() => void downloadEntry(entry)}>下载</Button> : null}
        <Button type="text" size="small" disabled={busy || !isOnline || !directoryReady} onClick={() => beginRename(entry)}>重命名</Button>
        <Button type="text" danger size="small" disabled={busy || !isOnline || !directoryReady} onClick={() => deleteEntry(entry)}>删除</Button>
      </Space>
    }
  ];

  const crumbs = currentPath ? currentPath.split("/").map((name, index, segments) => ({ name, path: segments.slice(0, index + 1).join("/") })) : [];

  return (
    <div className="module-workbench-stage file-manager-stage">
      {messageContext}
      {modalContext}
      <GlobalNavigationRail
        username={user.username}
        role={user.role}
        serverState={serverState}
        shortcuts={settings.shortcuts}
        activePage="files"
        homeLabel="返回来源应用/模式首页"
        onHome={() => onNavigate(homeRoute)}
        onApplicationsHome={() => onNavigate("/")}
        onOpenFiles={() => onNavigate("/files")}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />
      <section className="file-manager-page" aria-labelledby="file-manager-title">
        <header className="file-manager__header">
          <div>
            <Typography.Title id="file-manager-title" level={2}>文件管理</Typography.Title>
            <Typography.Text type="secondary">按节点浏览 LFAA 数据目录；文件操作只在节点在线时可用。</Typography.Text>
          </div>
          <Space wrap>
            <span className="file-manager__node-label">节点</span>
            <Select
              aria-label="daemon 节点"
              loading={nodesLoading}
              disabled={nodeSelectionLocked}
              value={nodeId || undefined}
              placeholder="选择 daemon 节点"
              options={nodes.map((node) => ({ value: node.id, label: `${node.displayName}${node.status === "online" ? "" : "（离线）"}`, disabled: node.status !== "online" }))}
              getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
              onChange={(value) => {
                setNodeId(value);
                setCurrentPath("");
                setSearchQuery("");
                setSearchText("");
                setEntries([]);
                setTruncated(false);
                setDirectoryState("idle");
              }}
              style={{ width: 230 }}
            />
            {selectedNode ? <Tag color={selectedNode.status === "online" ? "green" : "default"}>{selectedNode.status === "online" ? "在线" : "离线"}</Tag> : null}
            <Button
              icon={<WorkbenchIcon name="refresh" size={15} />}
              loading={nodesLoading || nodesRefreshing}
              disabled={!hasAdminAccess(user.role) || nodesLoading || nodesRefreshing}
              onClick={() => refreshNodesRef.current?.()}
            >刷新节点状态</Button>
          </Space>
        </header>

        {!hasAdminAccess(user.role) ? <Alert type="warning" showIcon message="文件管理仅对管理员开放。" /> : null}
        {error ? <Alert className="file-manager__alert" type="error" showIcon message={error} closable onClose={() => setError("")} /> : null}
        {busy ? <div className="file-manager__task" role="status"><Spin size="small" /><span>{taskMessage || "正在执行文件操作…"}</span></div> : null}

        <div className="file-manager__toolbar">
          <div className="file-manager__location">
            <Button aria-label="返回上一级" title="返回上一级" disabled={!isOnline || !directoryReady || !currentPath || busy} onClick={navigateUp}><WorkbenchIcon name="chevron" size={15} /></Button>
            <Button aria-label="回到数据根目录" title="回到数据根目录" disabled={!isOnline || !directoryReady || !currentPath || busy} onClick={() => { setCurrentPath(""); setSearchQuery(""); setSearchText(""); }}><WorkbenchIcon name="home" size={15} /></Button>
            <div className="file-manager__breadcrumbs" aria-label="当前目录">
              <button type="button" className={!currentPath ? "is-current" : ""} disabled={!isOnline || !directoryReady || busy} onClick={() => { setCurrentPath(""); setSearchQuery(""); setSearchText(""); }}>LFAA 数据</button>
              {crumbs.map((crumb) => <span key={crumb.path}>
                <span aria-hidden="true">/</span>
                <button type="button" className={crumb.path === currentPath ? "is-current" : ""} disabled={!isOnline || !directoryReady || busy} onClick={() => { setCurrentPath(crumb.path); setSearchQuery(""); setSearchText(""); }}>{crumb.name}</button>
              </span>)}
            </div>
          </div>
          <Space wrap className="file-manager__actions">
            <Input
              allowClear
              disabled={!isOnline || !directoryReady || busy || !hasAdminAccess(user.role)}
              prefix={<WorkbenchIcon name="search" size={15} />}
              placeholder="搜索当前目录及子目录"
              value={searchText}
              onChange={(event) => { setSearchText(event.target.value); if (!event.target.value) setSearchQuery(""); }}
              onPressEnter={() => setSearchQuery(searchText.trim())}
              style={{ width: 230 }}
            />
            <Button aria-label="刷新目录" title="刷新目录" disabled={!isOnline || busy} onClick={() => void refresh()}><WorkbenchIcon name="refresh" size={15} /></Button>
            <Button disabled={!isOnline || !directoryReady || busy || !hasAdminAccess(user.role)} onClick={() => openCreateDialog("folder")}><WorkbenchIcon name="folder" size={15} />新建文件夹</Button>
            <Button disabled={!isOnline || !directoryReady || busy || !hasAdminAccess(user.role)} onClick={() => openCreateDialog("file")}><WorkbenchIcon name="plus" size={15} />新建文件</Button>
            <Button type="primary" disabled={!isOnline || !directoryReady || busy || !hasAdminAccess(user.role)} onClick={() => uploadInputRef.current?.click()}><WorkbenchIcon name="file" size={15} />上传</Button>
            <input ref={uploadInputRef} className="file-manager__upload-input" type="file" onChange={(event) => void uploadSelectedFile(event.target.files?.[0])} />
          </Space>
        </div>

        <div className="file-manager__body">
          {loading || nodesLoading ? <div className="file-manager__loading"><Spin /><span>正在读取目录…</span></div>
            : !hasAdminAccess(user.role) ? <Empty className="file-manager__empty" description="仅管理员可以管理节点文件" />
              : !nodes.length ? <div className="file-manager__offline-state file-manager__offline-state--empty" role="status">
                <Typography.Title level={4}>没有可管理节点</Typography.Title>
                <Typography.Text>当前没有报告文件管理能力的 Daemon。启动或更新目标主机上的 LFAA Daemon，待节点上线后刷新节点状态。</Typography.Text>
              </div>
                : selectedNode && !isOnline ? <section className="file-manager__offline-state" aria-labelledby="file-manager-offline-title" role="status">
                  <Typography.Text className="file-manager__offline-label">节点离线 · 文件操作已暂停</Typography.Text>
                  <Typography.Title id="file-manager-offline-title" level={4}>{selectedNode.displayName} 当前无法连接</Typography.Title>
                  <dl className="file-manager__offline-details">
                    <div><dt>节点状态</dt><dd>离线</dd></div>
                    <div><dt>最近心跳</dt><dd>{formatLastSeen(selectedNode.lastSeenAt)}</dd></div>
                  </dl>
                  <Typography.Text type="secondary">请在目标主机启动 LFAA Daemon，再刷新节点状态；也可以在上方切换到其他在线节点。</Typography.Text>
                </section>
                  : !selectedNode ? <Empty className="file-manager__empty" description="请选择在线 daemon 节点" />
                    : directoryState === "error" ? <div className="file-manager__offline-state" role="status">
                      <Typography.Title level={4}>目录读取失败</Typography.Title>
                      <Typography.Text>请求未成功，无法判断目录内容。请检查上方错误信息后重试。</Typography.Text>
                      <Button disabled={!isOnline || busy} onClick={() => void refresh()}>重试读取目录</Button>
                    </div>
                      : directoryState !== "ready" ? <div className="file-manager__offline-state" role="status"><Typography.Text>目录尚未读取。</Typography.Text></div>
                        : entries.length ? <Table<ManagedFileEntry> rowKey="path" size="small" columns={columns} dataSource={entries} pagination={{ pageSize: 20, showSizeChanger: false }} onRow={(entry) => ({ onDoubleClick: () => void openEntry(entry) })} />
                          : <Empty className="file-manager__empty" description={searchQuery ? "没有匹配的文件" : "此目录为空"} />}
          {truncated ? <Typography.Text className="file-manager__truncated" type="secondary">当前结果最多显示 500 项，请进入子目录进一步筛选。</Typography.Text> : null}
        </div>
        <footer className="file-manager__footer">
          <span>{!isOnline || !directoryReady ? "目录未读取" : searchQuery ? `搜索结果 ${entries.length} 项` : `${entries.length} 个项目`}</span>
          <span>仅管理员可修改；凭据和控制端数据库目录受保护。</span>
        </footer>
      </section>

      <Modal title={createKind === "folder" ? "新建文件夹" : "新建文件"} open={createKind !== null} getContainer={getFileManagerModalContainer} okText="创建" cancelText="取消" onOk={() => void createEntry()} onCancel={() => setCreateKind(null)} confirmLoading={busy} okButtonProps={{ disabled: !isOnline || !newName.trim() }}>
        <Input autoFocus disabled={!isOnline} value={newName} maxLength={255} placeholder={createKind === "folder" ? "文件夹名称" : "文件名，例如 server.properties"} onChange={(event) => setNewName(event.target.value)} onPressEnter={() => void createEntry()} />
      </Modal>
      <Modal title="重命名" open={renameEntry !== null} getContainer={getFileManagerModalContainer} okText="保存" cancelText="取消" onOk={() => void renameSelectedEntry()} onCancel={() => setRenameEntry(null)} confirmLoading={busy} okButtonProps={{ disabled: !isOnline || !renameValue.trim() }}>
        <Input autoFocus disabled={!isOnline} value={renameValue} maxLength={255} onChange={(event) => setRenameValue(event.target.value)} onPressEnter={() => void renameSelectedEntry()} />
      </Modal>
      <Modal
        className="file-manager__editor"
        getContainer={getFileManagerModalContainer}
        title={<span><WorkbenchIcon name="file" size={16} /> {editorPath}</span>}
        open={Boolean(editorPath)}
        width="min(1000px, calc(100vw - 40px))"
        okText="保存"
        cancelText="关闭"
        onOk={() => void saveEditor()}
        onCancel={() => {
          if (editorContent !== editorSavedContent) {
            modalApi.confirm({ title: "放弃未保存的修改？", content: "关闭后，当前编辑内容将丢失。", okText: "放弃修改", okButtonProps: { danger: true }, cancelText: "继续编辑", getContainer: getFileManagerModalContainer, onOk: () => setEditorPath("") });
          } else setEditorPath("");
        }}
        confirmLoading={editorBusy}
        okButtonProps={{ disabled: !hasAdminAccess(user.role) || !isOnline || editorContent === editorSavedContent }}
      >
        <Input.TextArea className="file-manager__editor-input" value={editorContent} onChange={(event) => setEditorContent(event.target.value)} spellCheck={false} />
      </Modal>
    </div>
  );
}
