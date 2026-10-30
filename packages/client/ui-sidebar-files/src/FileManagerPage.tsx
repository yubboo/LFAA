/**
 * 功能：呈现本机、应用及游戏服务器共用的统一文件工作台。
 * 作用：浏览和搜索受管目录，创建、编辑、上传、下载、重命名与删除文件，并显示真实操作结果。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-sidebar/src/GlobalNavigationRail.tsx、packages/client/ui-sidebar-files/src/FileManagerPage.css、packages/fs/fs/src/queue.ts。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type Key, type ReactNode } from "react";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { Alert, Button, Dropdown, Empty, Input, Modal, Popover, Select, Space, Spin, Table, Tag, Tree, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DataNode, EventDataNode } from "antd/es/tree";
import { getErrorMessage, loadSystemFileAudit, loadFileResourceLocations, operateSystemFiles, downloadSystemFile, downloadFileTransfer, maximumNodeFileTransferBytes, startSystemFileDownload, uploadSystemFile, type ApplicationId, type FileManagerAuditEntry, type FileManagerOperation, type ManagedFileEntry, type FileResourceLocation, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH, GLOBAL_NAVIGATION_RAIL_WIDTH, GlobalNavigationRail, type ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { WorkbenchHeader } from "lfaa-client-ui-primitives/src/WorkbenchHeader.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import { readWorkbenchLeadingInsetWidth, useWorkbenchMetrics } from "lfaa-client-ui-dockkit/src/use-workbench-metrics.js";
import type { WorkbenchCollapseState } from "lfaa-client-ui-dockkit/src/workbench-layout.types.js";
import { usePointerResize } from "lfaa-client-ui-dockkit/src/ui-resize/use-pointer-resize.js";
import { createTarArchive } from "./archive.js";
import { buildFileManagerBreadcrumbs, getFileManagerBreadcrumbTitle } from "./file-manager-breadcrumbs.js";
import { consumeFileManagerLocation, readFileManagerLocation, readFileManagerReturnPath } from "lfaa-client-connection/src/file-manager-location.js";
import "./FileManagerPage.css";

interface FileManagerSnapshot {
  operations?: FileManagerOperation[];
  currentPath: string;
  entries: ManagedFileEntry[];
  searchText: string;
  searchQuery: string;
  truncated: boolean;
}

const fileManagerSnapshots = createSnapshotCache<FileManagerSnapshot>();

const resourceEnglishNames: Record<string, string> = {
  data: "Data",
  "game-instances": "Game Instances",
  "game-storage": "Game Storage",
  "game-servers": "Node Resources",
  knowledge: "My Library",
  backups: "Backups",
  environments: "Runtime Environments",
  lib: "Tools",
  logs: "Logs",
  cache: "Cache",
  tmp: "Temporary Files",
  "local-drives": "Local Drives"
};

interface FileManagerPageProps {
  user: User;
  settings: UserSettings;
  serverState: ServiceState;
  applications: ApplicationNavigationItem[];
  navigationApplications?: ApplicationNavigationItem[];
  onOpenApplication: (app: ApplicationId, mode: "normal") => Promise<void>;
  onOpenApplications?: () => void;
  onOpenRecentSessions: () => void;
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCompactRootPath(label: string): string {
  const separator = label.lastIndexOf(" · ");
  const nodeName = separator >= 0 ? label.slice(0, separator) : "";
  const path = separator >= 0 ? label.slice(separator + 3) : label;
  const segments = path.split(/[\\/]/u).filter(Boolean);
  const suffix = segments.slice(-3).join("\\");
  const compactPath = segments.length > 3 ? `…\\${suffix}` : path;
  return [nodeName, compactPath].filter(Boolean).join(" · ");
}

function formatCompactEntryMeta(entry: ManagedFileEntry): string {
  const kind = entry.kind === "directory"
    ? "文件夹"
    : entry.fileType && entry.fileType !== "file" ? entry.fileType.toUpperCase() : "文件";
  const detail = entry.kind === "file"
    ? formatBytes(entry.size)
    : entry.modifiedAt && Number.isFinite(Date.parse(entry.modifiedAt)) ? new Date(entry.modifiedAt).toLocaleDateString() : "";
  return [kind, detail].filter(Boolean).join(" · ");
}

function pathWithin(directory: string, name: string): string {
  return [directory, name].filter(Boolean).join("/");
}

function directorySnapshotKey(path: string, query: string, owner: string): string {
  return JSON.stringify([owner, path, query.trim()]);
}

const maximumBatchItems = 50;
const maximumBatchTransferBytes = 20 * 1024 * 1024;
const maximumExpandedDirectoryNodes = 200;

function initialFileManagerMetrics(): WorkbenchLayoutMetrics {
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1440 - GLOBAL_NAVIGATION_RAIL_WIDTH, 900, true);
  const railWidth = window.innerWidth <= 420 ? GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH : GLOBAL_NAVIGATION_RAIL_WIDTH;
  return resolveWorkbenchLayoutMetrics(window.innerWidth - railWidth, window.innerHeight, true);
}
type FileColumnKey = "name" | "fileType" | "size" | "modifiedAt" | "actions";
interface FileColumnWidths extends Record<FileColumnKey, number> {}
interface FileColumnResizeEdge { left: FileColumnKey; right: FileColumnKey }
const initialFileColumnWidths: FileColumnWidths = { name: 360, fileType: 120, size: 120, modifiedAt: 200, actions: 160 };
const minimumFileColumnWidths: FileColumnWidths = { name: 160, fileType: 82, size: 88, modifiedAt: 146, actions: 120 };
const maximumFileColumnWidths: FileColumnWidths = { name: 1200, fileType: 280, size: 280, modifiedAt: 380, actions: 240 };
const compactFileTableBreakpoint = 960;
const fileColumnResizeEdges: Record<"name" | "fileType" | "size" | "modifiedAt", FileColumnResizeEdge> = {
  name: { left: "name", right: "fileType" },
  fileType: { left: "fileType", right: "size" },
  size: { left: "size", right: "modifiedAt" },
  modifiedAt: { left: "modifiedAt", right: "actions" }
};
const editableFileTypes = new Set(["txt", "md", "markdown", "json", "jsonc", "yaml", "yml", "toml", "properties", "cfg", "conf", "ini", "xml", "csv", "html", "css", "js", "mjs", "ts", "tsx", "jsx", "log"]);
function renderMarkdownInline(line: string): ReactNode[] {
  const tokens = line.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/gu);
  return tokens.map((token, index) => {
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index}>{token.slice(1, -1)}</code>;
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("*") && token.endsWith("*")) return <em key={index}>{token.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/u.exec(token);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return token;
  });
}

function renderMarkdown(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = content.split(/\r?\n/u);
  let paragraph: string[] = [];
  let code: string[] | null = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={`p-${blocks.length}`}>{paragraph.map((line, index) => <span key={index}>{index ? <br /> : null}{renderMarkdownInline(line)}</span>)}</p>);
    paragraph = [];
  };
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      flushParagraph();
      if (code) { blocks.push(<pre key={`code-${blocks.length}`}><code>{code.join("\n")}</code></pre>); code = null; }
      else code = [];
      continue;
    }
    if (code) { code.push(line); continue; }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    const item = /^\s*[-*+]\s+(.+)$/u.exec(line);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4;
      const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4";
      blocks.push(<Heading key={`h-${blocks.length}`}>{renderMarkdownInline(heading[2])}</Heading>);
    } else if (item) {
      flushParagraph();
      blocks.push(<ul key={`ul-${blocks.length}`}><li>{renderMarkdownInline(item[1])}</li></ul>);
    } else if (!line.trim()) flushParagraph();
    else paragraph.push(line);
  }
  flushParagraph();
  if (code) blocks.push(<pre key={`code-${blocks.length}`}><code>{code.join("\n")}</code></pre>);
  return blocks;
}

function getFileManagerModalContainer(): HTMLElement {
  // 弹窗挂到工作台后可继承设置中心注入的主题、字体、强调色和外观变量。
  return document.querySelector<HTMLElement>(".workbench-shell") ?? document.body;
}

export function FileManagerPage({ user, settings, serverState, applications, navigationApplications = applications, onOpenApplication, onOpenApplications, onOpenRecentSessions, onNavigate, onOpenSettings, onLogout }: FileManagerPageProps) {
  const layoutMeasureRef = useRef<HTMLDivElement | null>(null);
  const metrics = useWorkbenchMetrics(layoutMeasureRef, initialFileManagerMetrics, true, readWorkbenchLeadingInsetWidth);
  const [layoutMeasured, setLayoutMeasured] = useState(false);
  useLayoutEffect(() => { setLayoutMeasured(true); }, []);
  const [messageApi, messageContext] = message.useMessage();
  const [modalApi, modalContext] = Modal.useModal();
  const fileAccess = user.role === "super_admin" && settings.permissions.mode === "full_access";
  const fileAccessRef = useRef(fileAccess);
  fileAccessRef.current = fileAccess;
  const cacheKey = `resources-v3:${user.id}:${user.role}:${settings.permissions.mode}`;
  const accountContextRef = useRef(cacheKey);
  accountContextRef.current = cacheKey;
  const previousContextRef = useRef(cacheKey);
  const assertFileContext = () => {
    if (!fileAccessRef.current || accountContextRef.current !== cacheKey) throw new Error("文件账户或权限已变更，请重新核对设置。");
  };
  const requestedLocation = useRef(readFileManagerLocation(user.id)).current;
  const [fileEntryContext] = useState(() => ({ userId: user.id, returnPath: readFileManagerReturnPath(user.id) }));
  const fileEntryReturnPath = fileEntryContext.userId === user.id ? fileEntryContext.returnPath : null;
  const cachedSnapshot = useRef(requestedLocation === null ? fileManagerSnapshots.get(cacheKey) ?? null : null).current;
  const [currentPath, setCurrentPath] = useState(() => requestedLocation ?? cachedSnapshot?.currentPath ?? "");
  useEffect(() => { consumeFileManagerLocation(); }, []);
  const [dataRootLabel, setDataRootLabel] = useState("");
  const [locations, setLocations] = useState<FileResourceLocation[]>([]);
  const [locationError, setLocationError] = useState("");
  useEffect(() => {
    setLocations([]); setLocationError("");
    if (!fileAccess) return;
    const controller = new AbortController();
    void loadFileResourceLocations(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setLocations(result.locations);
    }).catch(error => { if (!controller.signal.aborted) setLocationError(getErrorMessage(error)); });
    return () => controller.abort();
  }, [cacheKey, fileAccess]);
  const [entries, setEntries] = useState<ManagedFileEntry[]>(() => cachedSnapshot?.entries ?? []);
  const [searchText, setSearchText] = useState(() => cachedSnapshot?.searchText ?? "");
  const [searchQuery, setSearchQuery] = useState(() => cachedSnapshot?.searchQuery ?? "");
  const [visibleSnapshotKey, setVisibleSnapshotKey] = useState(() => cachedSnapshot
    ? directorySnapshotKey(cachedSnapshot.currentPath, cachedSnapshot.searchQuery, cacheKey)
    : "");
  const [loading, setLoading] = useState(() => cachedSnapshot === null);
  const [directoryState, setDirectoryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [taskMessage, setTaskMessage] = useState("");
  const [truncated, setTruncated] = useState(() => cachedSnapshot?.truncated ?? false);
  const [availableOperations, setAvailableOperations] = useState<FileManagerOperation[] | undefined>(() => cachedSnapshot?.operations);
  const [createKind, setCreateKind] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [renameEntry, setRenameEntry] = useState<ManagedFileEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editorPath, setEditorPath] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorSavedContent, setEditorSavedContent] = useState("");
  const [editorSha256, setEditorSha256] = useState("");
  const [editorBusy, setEditorBusy] = useState(false);
  const [directorySizes, setDirectorySizes] = useState<Record<string, { totalSize: number; skippedEntries: number }>>({});
  const [calculatingDirectoryPath, setCalculatingDirectoryPath] = useState("");
  const [preview, setPreview] = useState<{ name: string; kind: "text" | "image" | "pdf"; content?: string; mimeType?: string; dataBase64?: string; blob?: Blob } | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [minimumSize, setMinimumSize] = useState("");
  const [maximumSize, setMaximumSize] = useState("");
  const [modifiedAfter, setModifiedAfter] = useState("");
  const [modifiedBefore, setModifiedBefore] = useState("");
  const [leftCollapsed, setLeftCollapsed] = useState<boolean | undefined>(undefined);
  const [rightCollapsed, setRightCollapsed] = useState<boolean | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [treeData, setTreeData] = useState<DataNode[]>([{ title: "文件", key: "", isLeaf: false, children: [] }]);
  const [loadedTreeKeys, setLoadedTreeKeys] = useState<Key[]>([]);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveDestination, setMoveDestination] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashEntries, setTrashEntries] = useState<ManagedFileEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<FileManagerAuditEntry[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [columnWidths, setColumnWidths] = useState<FileColumnWidths>(initialFileColumnWidths);
  const [compactFileTable, setCompactFileTable] = useState(false);
  const columnWidthsRef = useRef(columnWidths);
  const columnResizeStartRef = useRef<FileColumnWidths | null>(null);
  const columnsManuallyResizedRef = useRef(false);
  const fileManagerBodyRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const body = layoutMeasured ? fileManagerBodyRef.current : null;
    if (!body) return;
    const updateTableMode = () => {
      const next = body.clientWidth <= compactFileTableBreakpoint;
      setCompactFileTable(current => current === next ? current : next);
    };
    updateTableMode();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateTableMode);
    observer.observe(body);
    return () => observer.disconnect();
  }, [layoutMeasured]);

  const applyInitialCollapseState = useCallback((state: WorkbenchCollapseState) => {
    const initialLeftCollapsed = !state.restored && metrics.mode === "mobile" ? true : state.leftCollapsed;
    const initialRightCollapsed = !state.restored && metrics.mode !== "desktop" ? true : state.rightCollapsed;
    setLeftCollapsed(initialLeftCollapsed);
    setRightCollapsed(metrics.mode === "mobile" && initialLeftCollapsed === false ? true : initialRightCollapsed);
  }, [metrics.mode]);

  useEffect(() => {
    if (metrics.mode === "mobile" && leftCollapsed === false && rightCollapsed === false) setRightCollapsed(true);
  }, [leftCollapsed, metrics.mode, rightCollapsed]);

  const updateResourcePaneCollapsed = useCallback((collapsed: boolean) => {
    setLeftCollapsed(collapsed);
    if (!collapsed && metrics.mode === "mobile") setRightCollapsed(true);
  }, [metrics.mode]);

  const updateDirectoryPaneCollapsed = useCallback((collapsed: boolean) => {
    setRightCollapsed(collapsed);
    if (!collapsed && metrics.mode === "mobile") setLeftCollapsed(true);
  }, [metrics.mode]);

  const commitColumnWidths = useCallback((next: FileColumnWidths) => {
    columnWidthsRef.current = next;
    setColumnWidths(next);
  }, []);

  const resizeAdjacentColumns = useCallback((edge: FileColumnResizeEdge, delta: number, start = columnWidthsRef.current) => {
    const lowerBound = Math.max(
      minimumFileColumnWidths[edge.left] - start[edge.left],
      start[edge.right] - maximumFileColumnWidths[edge.right],
    );
    const upperBound = Math.min(
      maximumFileColumnWidths[edge.left] - start[edge.left],
      start[edge.right] - minimumFileColumnWidths[edge.right],
    );
    const appliedDelta = Math.min(upperBound, Math.max(lowerBound, delta));
    commitColumnWidths({
      ...start,
      [edge.left]: start[edge.left] + appliedDelta,
      [edge.right]: start[edge.right] - appliedDelta,
    });
  }, [commitColumnWidths]);

  const columnResize = usePointerResize<FileColumnResizeEdge>({
    onResizeStart: () => {
      columnResizeStartRef.current = { ...columnWidthsRef.current };
    },
    onResize: (edge, delta) => resizeAdjacentColumns(edge, delta, columnResizeStartRef.current ?? columnWidthsRef.current),
    onResizeEnd: (_edge, cancelled) => {
      const start = columnResizeStartRef.current;
      if (cancelled && start) commitColumnWidths(start);
      else columnsManuallyResizedRef.current = true;
      columnResizeStartRef.current = null;
    },
  });

  useEffect(() => {
    const body = fileManagerBodyRef.current;
    if (!body || typeof ResizeObserver === "undefined") return;

    const fitNameColumn = () => {
      if (columnsManuallyResizedRef.current) return;
      const style = window.getComputedStyle(body);
      const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const availableWidth = body.clientWidth - horizontalPadding - 42;
      const reservedWidth = initialFileColumnWidths.fileType + initialFileColumnWidths.size + initialFileColumnWidths.modifiedAt + initialFileColumnWidths.actions;
      const nameWidth = Math.max(minimumFileColumnWidths.name, Math.min(maximumFileColumnWidths.name, Math.floor(availableWidth - reservedWidth)));
      if (columnWidthsRef.current.name === nameWidth) return;
      commitColumnWidths({ ...columnWidthsRef.current, name: nameWidth });
    };

    const observer = new ResizeObserver(fitNameColumn);
    observer.observe(body);
    fitNameColumn();
    return () => observer.disconnect();
  }, [commitColumnWidths]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const searchTextRef = useRef(searchText);
  searchTextRef.current = searchText;
  const directoryReadSequence = useRef(0);
  const directoryReadController = useRef<AbortController | null>(null);
  const directorySizeInFlight = useRef(new Set<string>());
  const draggedPathRef = useRef("");
  const instanceDirectory = currentPath.startsWith(".lfaa-library/game-instances/") && currentPath.split("/").length >= 3;
  const gameStorageDirectory = currentPath.startsWith(".lfaa-library/game-storage/") && currentPath.split("/").length >= 4;
  const supportsDirectorySize = !currentPath.startsWith(".lfaa-library") || currentPath.startsWith(".lfaa-library/game-servers/") || instanceDirectory || gameStorageDirectory;
  const isOnline = fileAccess;
  const directoryReady = directoryState === "ready";
  const hasCurrentDirectorySnapshot = visibleSnapshotKey === directorySnapshotKey(currentPath, searchQuery, cacheKey);
  const showCurrentDirectorySnapshot = hasCurrentDirectorySnapshot && isOnline;
  const directoryUsable = directoryReady || showCurrentDirectorySnapshot;
  const concreteDirectory = currentPath !== "local-drives" && (!currentPath.startsWith(".lfaa-library") || currentPath.startsWith(".lfaa-library/game-servers/") && currentPath.split("/").length >= 3 || instanceDirectory || gameStorageDirectory);
  const activeLocation = locations.filter(location => currentPath === location.path || location.path && currentPath.startsWith(location.path + "/")).sort((left, right) => right.path.length - left.path.length)[0];
  const selectLocation = (path: string) => { setCurrentPath(path); setSearchQuery(""); setSearchText(""); setDataRootLabel(""); };
  const canOperate = (operation: FileManagerOperation, entry?: ManagedFileEntry) => entry?.operations ? entry.operations.includes(operation) : availableOperations ? availableOperations.includes(operation) : concreteDirectory;

  const runTask = useCallback(async (
    operation: FileManagerOperation,
    input: { path: string; query?: string; name?: string; destinationPath?: string; content?: string; sha256?: string; expectedSha256?: string }, signal?: AbortSignal
  ): Promise<Record<string, unknown>> => {
    if (!isOnline) throw new Error("当前账户无权操作 data 文件。");
    const locksWorkspace = operation !== "list" && operation !== "search";
    if (locksWorkspace) setBusy(true);
    setError("");
    if (locksWorkspace) setTaskMessage("正在处理文件操作…");
    try {
      if (!fileAccessRef.current || accountContextRef.current !== cacheKey) throw new Error("文件账户或权限已变更，请重新核对设置。");
      const { result } = await operateSystemFiles({ operation, ...input }, signal);
      if (!fileAccessRef.current || accountContextRef.current !== cacheKey) throw new Error("文件账户或权限已变更，请重新核对设置。");
      return result;
    } catch (taskError) {
      if (signal?.aborted || accountContextRef.current !== cacheKey) throw taskError;
      const detail = getErrorMessage(taskError);
      setError(detail);
      throw new Error(detail);
    } finally {
      if (locksWorkspace && accountContextRef.current === cacheKey) {
        setBusy(false);
        setTaskMessage("");
      }
    }
  }, [cacheKey, isOnline]);

  const refresh = useCallback(async () => {
    const request = ++directoryReadSequence.current;
    directoryReadController.current?.abort();
    const controller = new AbortController();
    directoryReadController.current = controller;
    setDirectorySizes({});
    if (!isOnline) {
      // 离线缓存只能用于节点恢复后的快速首屏，不能伪装成当前可操作目录。
      setEntries([]);
      setTruncated(false);
      setLoading(false);
      setDirectoryState("idle");
      setVisibleSnapshotKey("");
      return;
    }
    // 同节点同目录可保留最近快照作首屏预览；交互仍等待本次节点读取成功。
    setLoading(true);
    setDirectoryState("loading");
    setError("");
    try {
      const result = searchQuery.trim()
        ? await runTask("search", { path: currentPath, query: searchQuery.trim() }, controller.signal)
        : await runTask("list", { path: currentPath }, controller.signal);
      if (request !== directoryReadSequence.current) return;
      setDataRootLabel(typeof result.rootDirectory === "string" ? result.rootDirectory : "");
      const nextEntries = Array.isArray(result.entries) ? result.entries as ManagedFileEntry[] : [];
      setEntries(nextEntries);
      const operations = Array.isArray(result.operations) ? result.operations as FileManagerOperation[] : undefined;
      setAvailableOperations(operations);
      const nextTruncated = result.truncated === true;
      setTruncated(nextTruncated);
      setDirectoryState("ready");
      setVisibleSnapshotKey(directorySnapshotKey(currentPath, searchQuery, cacheKey));
      fileManagerSnapshots.set(cacheKey, {
        currentPath, searchText: searchTextRef.current, searchQuery, entries: nextEntries, truncated: nextTruncated, operations
      });
    } catch {
      if (request !== directoryReadSequence.current) return;
      setEntries([]);
      setTruncated(false);
      setDirectoryState("error");
      setVisibleSnapshotKey("");
    } finally {
      if (request === directoryReadSequence.current) setLoading(false);
    }
  }, [cacheKey, currentPath, isOnline, runTask, searchQuery]);

  useEffect(() => {
    void refresh();
    return () => { directoryReadSequence.current += 1; directoryReadController.current?.abort(); };
  }, [refresh]);

  useEffect(() => {
    setTreeData([{ title: "文件", key: "", isLeaf: false, children: [] }]);
    setLoadedTreeKeys([]);
    setSelectedPaths([]);
  }, [cacheKey]);

  useEffect(() => { setSelectedPaths([]); }, [currentPath, searchQuery]);
  useEffect(() => {
    if (!fileAccess) { setPreview(null); setEditorPath(""); setTrashOpen(false); setAuditOpen(false); setCreateKind(null); setRenameEntry(null); }
  }, [fileAccess]);
  useEffect(() => {
    if (previousContextRef.current !== cacheKey) {
      previousContextRef.current = cacheKey;
      setCurrentPath(""); setSearchQuery(""); setSearchText(""); setDataRootLabel(""); setBusy(false); setTaskMessage(""); setError("");
    }
    setPreview(null); setEditorPath(""); setTrashOpen(false); setTrashEntries([]); setAuditOpen(false); setAuditEntries([]);
    setSelectedPaths([]); setCreateKind(null); setRenameEntry(null);
    setTreeData([{ title: "文件", key: "", isLeaf: false, children: [] }]); setLoadedTreeKeys([]);
  }, [cacheKey]);

  useEffect(() => {
    if ((!preview?.dataBase64 && !preview?.blob) || (preview.kind !== "image" && preview.kind !== "pdf")) {
      setPreviewUrl("");
      return;
    }
    let url = "";
    try {
      if (preview.blob) url = URL.createObjectURL(preview.blob);
      else {
        const binary = window.atob(preview.dataBase64!);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        url = URL.createObjectURL(new Blob([bytes], { type: preview.mimeType ?? "application/octet-stream" }));
      }
      setPreviewUrl(url);
    } catch {
      setPreviewUrl("");
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [preview]);

  const openEntry = async (entry: ManagedFileEntry) => {
    if (busy || !directoryUsable) return;
    if (entry.kind === "directory") {
      setSearchQuery("");
      setSearchText("");
      setCurrentPath(entry.path);
      return;
    }
    if (!directoryReady) return;
    if (!canOperate("preview", entry)) {
      if (canOperate("download", entry)) await downloadEntry(entry);
      return;
    }
    try {
      const result = await runTask("preview", { path: entry.path });
      const kind = result.previewKind;
      if (kind !== "text" && kind !== "image" && kind !== "pdf") throw new Error("文件服务未返回受支持的预览内容。");
      const transferId = typeof result.transferId === "string" ? result.transferId : "";
      const receivedBlob = transferId ? await downloadFileTransfer(transferId) : undefined;
      const blob = receivedBlob ? new Blob([receivedBlob], { type: typeof result.mimeType === "string" ? result.mimeType : "application/octet-stream" }) : undefined;
      if ((kind === "image" || kind === "pdf") && !blob && typeof result.dataBase64 !== "string") throw new Error("文件服务没有返回预览字节传输。");
      if (!fileAccessRef.current || accountContextRef.current !== cacheKey) return;
      setPreview({ name: entry.name, kind, content: typeof result.content === "string" ? result.content : undefined, mimeType: typeof result.mimeType === "string" ? result.mimeType : undefined, dataBase64: typeof result.dataBase64 === "string" ? result.dataBase64 : undefined, blob });
    } catch {
      // 错误由任务提交状态统一显示；预览失败不触发编辑或下载。
    }
  };

  const editEntry = async (entry: ManagedFileEntry) => {
    if (busy || !directoryReady || entry.kind !== "file" || entry.size > 2 * 1024 * 1024) return;
    try {
      const result = await runTask("read", { path: entry.path });
      if (typeof result.content !== "string") throw new Error("文件服务没有返回可编辑的文本内容。");
      if (typeof result.sha256 !== "string") throw new Error("文件服务未返回文件版本摘要，已停止编辑以保护并发修改。");
      setEditorPath(entry.path);
      setEditorContent(result.content);
      setEditorSavedContent(result.content);
      setEditorSha256(result.sha256);
    } catch {
      // 错误显示在工具栏任务状态中。
    }
  };

  const loadTreeChildren = async (treeNode: EventDataNode<DataNode>) => {
    if (loadedTreeKeys.length >= maximumExpandedDirectoryNodes) throw new Error("目录树最多展开 200 个目录；请在表格中直接进入更深目录。 ");
    const treeReadSequence = directoryReadSequence.current;
    const parentPath = String(treeNode.key);
    const result = await runTask("list", { path: parentPath });
    if (directoryReadSequence.current !== treeReadSequence) return;
    const folders = (Array.isArray(result.entries) ? result.entries as ManagedFileEntry[] : []).filter(entry => entry.kind === "directory");
    const updateChildren = (nodes: DataNode[]): DataNode[] => nodes.map(node => String(node.key) === parentPath
      ? { ...node, isLeaf: folders.length === 0, children: folders.map(folder => ({ title: folder.name, key: folder.path, isLeaf: false, children: [] })) }
      : { ...node, ...(node.children ? { children: updateChildren(node.children) } : {}) });
    setTreeData(current => updateChildren(current));
    setLoadedTreeKeys(current => current.includes(treeNode.key) ? current : [...current, treeNode.key]);
  };

  const startMove = (entriesToMove: ManagedFileEntry[]) => {
    if (!entriesToMove.length) return;
    setSelectedPaths(entriesToMove.map(entry => entry.path));
    setMoveDestination(currentPath);
    setMoveDialogOpen(true);
  };

  const moveSelectedEntries = async () => {
    const selected = entries.filter(entry => selectedPaths.includes(entry.path));
    if (!selected.length) return;
    let moved = 0;
    const failures: string[] = [];
    for (const entry of selected) {
      try { await runTask("move", { path: entry.path, destinationPath: moveDestination.trim() }); moved += 1; }
      catch { failures.push(entry.name); }
    }
    setMoveDialogOpen(false);
    setSelectedPaths([]);
    if (failures.length) messageApi.warning(`已移动 ${moved} 项；${failures.length} 项未移动：${failures.slice(0, 3).join("、")}`);
    else messageApi.success(`已移动 ${moved} 项。`);
    await refresh();
  };

  const deleteSelectedEntries = () => {
    const selected = entries.filter(entry => selectedPaths.includes(entry.path));
    if (!selected.length) return;
    modalApi.confirm({
      title: `将 ${selected.length} 项移入回收站？`,
      content: "需要时可以在回收站恢复；仅彻底删除才会释放磁盘空间。",
      okText: "移入回收站", cancelText: "取消", getContainer: getFileManagerModalContainer,
      onOk: async () => {
        let moved = 0;
        const failures: string[] = [];
        for (const entry of selected) {
          try { await runTask("delete", { path: entry.path }); moved += 1; }
          catch { failures.push(entry.name); }
        }
        setSelectedPaths([]);
        if (failures.length) messageApi.warning(`已移入回收站 ${moved} 项；${failures.length} 项失败：${failures.slice(0, 3).join("、")}`);
        else messageApi.success(`已将 ${moved} 项移入回收站。`);
        await refresh();
      }
    });
  };

  const downloadSelectedEntries = async () => {
    const selected = entries.filter(entry => selectedPaths.includes(entry.path));
    if (!selected.length) return;
    if (selected.some(entry => entry.kind !== "file")) { messageApi.warning("批量下载目前请选择文件；文件夹请先打开后选择其中的文件。"); return; }
    try {
      const files: Array<{ path: string; bytes: Uint8Array }> = [];
      let totalBytes = 0;
      for (const entry of selected) {
        assertFileContext();
        const result = !entry.path.startsWith(".lfaa-library/") || entry.downloadStrategy === "stream" ? null : await runTask("download", { path: entry.path });
        totalBytes += entry.size;
        if (totalBytes > maximumBatchTransferBytes) throw new Error("批量下载总量不能超过 20 MiB；请分批选择。");
        const blob = result
          ? typeof result.transferId === "string" ? await downloadFileTransfer(result.transferId) : (() => { throw new Error("文件服务没有返回原始文件传输。"); })()
          : await downloadSystemFile(entry.path);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        assertFileContext();
        files.push({ path: entry.path, bytes });
      }
      const url = URL.createObjectURL(createTarArchive(files));
      const link = document.createElement("a");
      link.href = url;
      link.download = "lfaa-files.tar";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      messageApi.success(`已打包下载 ${files.length} 个文件。`);
    } catch (downloadError) { if (accountContextRef.current === cacheKey) setError(getErrorMessage(downloadError)); }
  };

  const loadTrash = async () => {
    try {
      const trashRoot = currentPath.startsWith(".lfaa-library/game-servers/") || instanceDirectory
        ? currentPath.split("/").slice(0, 3).join("/")
        : gameStorageDirectory ? currentPath.split("/").slice(0, 4).join("/")
        : currentPath.startsWith("local-drives/") || currentPath.startsWith(".lfaa-resources/") ? currentPath.split("/").slice(0, 2).join("/") : "";
      const result = await runTask("trash-list", { path: trashRoot });
      setTrashEntries(Array.isArray(result.entries) ? result.entries as ManagedFileEntry[] : []);
      setTrashOpen(true);
    } catch { /* 任务错误显示在工具栏。 */ }
  };

  const restoreTrashEntry = async (entry: ManagedFileEntry) => {
    if (!entry.trashId) return;
    try {
      await runTask("trash-restore", { path: "", name: entry.trashId });
      messageApi.success(`已恢复“${entry.name}”。`);
      setTrashEntries(current => current.filter(item => item.trashId !== entry.trashId));
      await refresh();
    } catch { /* 目录冲突等真实错误已显示。 */ }
  };

  const purgeTrashEntry = (entry: ManagedFileEntry) => {
    if (!entry.trashId) return;
    modalApi.confirm({ title: "彻底删除？", content: `“${entry.name}”删除后无法恢复。`, okText: "彻底删除", okButtonProps: { danger: true }, cancelText: "取消", getContainer: getFileManagerModalContainer, onOk: async () => {
      await runTask("trash-purge", { path: "", name: entry.trashId });
      setTrashEntries(current => current.filter(item => item.trashId !== entry.trashId));
      messageApi.success("已彻底删除。 ");
    } });
  };

  const loadAudit = async () => {
    try { assertFileContext(); const result = await loadSystemFileAudit(auditQuery); assertFileContext(); setAuditEntries(result.entries); setAuditOpen(true); }
    catch (auditError) { if (accountContextRef.current === cacheKey) setError(getErrorMessage(auditError)); }
  };

  const navigateUp = () => {
    if (activeLocation?.path === currentPath) { selectLocation(""); return; }
    if (gameStorageDirectory && currentPath.split("/").length === 4) { selectLocation(".lfaa-library/game-storage"); return; }
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
      content: "此项目会移入回收站，可以之后恢复。",
      okText: "移入回收站",
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
      assertFileContext();
      if (entry.downloadStrategy === "stream") {
        startSystemFileDownload(entry.path);
        return;
      }
      const result = !entry.path.startsWith(".lfaa-library/") ? null : await runTask("download", { path: entry.path });
      const blob = result
        ? typeof result.transferId === "string" ? await downloadFileTransfer(result.transferId) : (() => { throw new Error("文件服务没有返回原始文件传输。"); })()
        : await downloadSystemFile(entry.path);
      assertFileContext();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result && typeof result.name === "string" ? result.name : entry.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      if (accountContextRef.current === cacheKey) setError(getErrorMessage(downloadError));
    }
  };

  const uploadSelectedFiles = async (files: File[]) => {
    if (!files.length) return;
    try {
      if (files.length > maximumBatchItems) throw new Error(`单次最多导入 ${maximumBatchItems} 个文件。`);
      const batchSize = files.reduce((total, file) => total + file.size, 0);
      if (batchSize > maximumBatchTransferBytes) throw new Error("单次导入总量不能超过 20 MiB，请分批选择。");
      let uploaded = 0;
      let duplicates = 0;
      for (const file of files) {
        assertFileContext();
        if (file.size > maximumNodeFileTransferBytes) throw new Error(`“${file.name}”超过 3 MiB 单文件上传上限。`);
        const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        assertFileContext();
        const result = (await uploadSystemFile(currentPath, file, sha256)).result;
        assertFileContext();
        uploaded += 1;
        if (result.duplicate === true) duplicates += 1;
      }
      messageApi.success(`已处理 ${uploaded} 个文件，其中 ${duplicates} 个与同名文件内容一致并保留原件。`);
      await refresh();
    } catch (uploadError) {
      if (accountContextRef.current === cacheKey) setError(getErrorMessage(uploadError));
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const saveEditor = async () => {
    setEditorBusy(true);
    try {
      const result = await runTask("write", { path: editorPath, content: editorContent, expectedSha256: editorSha256 });
      setEditorSavedContent(editorContent);
      if (typeof result.sha256 === "string") setEditorSha256(result.sha256);
      setEditorPath("");
      messageApi.success("文件已保存。");
      await refresh();
    } catch {
      // 错误显示在工具栏下方。
    } finally {
      setEditorBusy(false);
    }
  };

  const calculateDirectorySize = async (entry: ManagedFileEntry) => {
    if (busy || !directoryReady || entry.kind !== "directory" || !supportsDirectorySize || directorySizeInFlight.current.has(entry.path)) return;
    const treeReadSequence = directoryReadSequence.current;
    directorySizeInFlight.current.add(entry.path);
    setCalculatingDirectoryPath(entry.path);
    try {
      const result = await runTask("directory-size", { path: entry.path });
      const totalSize = Number(result.totalSize);
      const skippedEntries = Number(result.skippedEntries) || 0;
      if (!Number.isSafeInteger(totalSize) || totalSize < 0 || !Number.isSafeInteger(skippedEntries) || skippedEntries < 0) {
        throw new Error("文件服务返回的目录大小无效。");
      }
      if (directoryReadSequence.current !== treeReadSequence) return;
      setDirectorySizes(current => ({ ...current, [entry.path]: { totalSize, skippedEntries } }));
      setEntries(current => current.map(item => item.path === entry.path ? { ...item, size: totalSize } : item));
      if (skippedEntries) messageApi.info(`目录大小已计算；为保持安全，跳过了 ${skippedEntries} 个链接或特殊文件。`);
    } catch {
      // 错误由文件任务状态在工作台工具栏中显示。
    } finally {
      directorySizeInFlight.current.delete(entry.path);
      setCalculatingDirectoryPath(current => current === entry.path ? "" : current);
    }
  };

  const visibleEntries = entries.filter(entry => {
    const typeMatches = typeFilter === "all" || typeFilter === "folder" && entry.kind === "directory"
      || typeFilter === "file" && entry.kind === "file" || typeFilter === entry.fileType;
    const sizeMatches = (!minimumSize || entry.size >= Math.max(0, Number(minimumSize)))
      && (!maximumSize || entry.size <= Math.max(0, Number(maximumSize)));
    const modified = new Date(entry.modifiedAt).getTime();
    const after = modifiedAfter ? new Date(`${modifiedAfter}T00:00:00`).getTime() : null;
    const before = modifiedBefore ? new Date(`${modifiedBefore}T23:59:59.999`).getTime() : null;
    const dateMatches = (after === null || modified >= after) && (before === null || modified <= before);
    return typeMatches && sizeMatches && dateMatches;
  });
  const activeFilterCount = [typeFilter !== "all", Boolean(minimumSize), Boolean(maximumSize), Boolean(modifiedAfter), Boolean(modifiedBefore)].filter(Boolean).length;

  const moveOnDrop = async (entry: ManagedFileEntry) => {
    const sourcePath = draggedPathRef.current;
    draggedPathRef.current = "";
    if (!sourcePath || entry.kind !== "directory" || sourcePath === entry.path) return;
    try {
      await runTask("move", { path: sourcePath, destinationPath: entry.path });
      messageApi.success("已移动到目标文件夹。");
      await refresh();
    } catch { /* 目标目录或运行实例保护错误已显示。 */ }
  };

  const onColumnResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>, edge: FileColumnResizeEdge) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    columnsManuallyResizedRef.current = true;
    const step = event.shiftKey ? 24 : 8;
    resizeAdjacentColumns(edge, event.key === "ArrowRight" ? step : -step);
  };

  const renderColumnHeading = (label: string, key: keyof typeof fileColumnResizeEdges) => {
    const edge = fileColumnResizeEdges[key];
    return <div className="file-manager__column-heading">
      <span>{label}</span>
      <div
        className="file-manager__column-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={`调整${edge.left === "name" ? "名称" : edge.left === "fileType" ? "类型" : edge.left === "size" ? "大小" : "修改时间"}列宽`}
        aria-valuemin={minimumFileColumnWidths[edge.left]}
        aria-valuemax={maximumFileColumnWidths[edge.left]}
        aria-valuenow={columnWidths[edge.left]}
        tabIndex={0}
        title="拖动调整列宽；也可聚焦后按左右方向键"
        onPointerDown={event => columnResize.onPointerDown(event, edge)}
        onPointerMove={columnResize.onPointerMove}
        onPointerUp={columnResize.onPointerUp}
        onPointerCancel={columnResize.onPointerCancel}
        onLostPointerCapture={columnResize.onLostPointerCapture}
        onKeyDown={event => onColumnResizeKeyDown(event, edge)}
        onClick={event => event.stopPropagation()}
      />
    </div>;
  };

  const columns: ColumnsType<ManagedFileEntry> = [
    {
      title: renderColumnHeading("名称", "name"),
      dataIndex: "name",
      key: "name",
      width: columnWidths.name,
      sorter: (left, right) => left.name.localeCompare(right.name, "zh-CN", { sensitivity: "base" }),
      render: (_value, entry) => {
        const entryUsable = directoryReady || showCurrentDirectorySnapshot && entry.kind === "directory";
        return <button className="file-manager__name" type="button" draggable={entryUsable && !busy && canOperate("move", entry)} disabled={busy || !isOnline || !entryUsable} onDragStart={event => { draggedPathRef.current = entry.path; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", entry.path); }} onClick={() => void openEntry(entry)}>
          <WorkbenchIcon name={entry.kind === "directory" ? "folder" : "file"} size={17} />
          <span className="file-manager__entry-label">
            <span title={entry.name}>{entry.name}</span>
            {entry.description ? <small className="file-manager__entry-description">{entry.description}</small> : null}
            <small className="file-manager__entry-meta">{formatCompactEntryMeta(entry)}</small>
          </span>
        </button>;
      }
    },
    { title: renderColumnHeading("类型", "fileType"), dataIndex: "fileType", key: "fileType", width: columnWidths.fileType, align: "left", onHeaderCell: () => ({ className: "file-manager__left-cell" }), onCell: () => ({ className: "file-manager__left-cell" }), sorter: (left, right) => (left.fileType ?? "").localeCompare(right.fileType ?? ""), render: (value: string, entry) => entry.kind === "directory" ? <Tag className="file-manager__type-tag" bordered={false}>文件夹</Tag> : <Tag className="file-manager__type-tag" bordered={false}>{value === "file" || !value ? "文件" : value}</Tag> },
    { title: renderColumnHeading("大小", "size"), dataIndex: "size", key: "size", width: columnWidths.size, align: "left", onHeaderCell: () => ({ className: "file-manager__left-cell" }), onCell: () => ({ className: "file-manager__left-cell" }), sorter: (left, right) => left.size - right.size, render: (size: number, entry) => {
      if (entry.kind === "file") return formatBytes(size);
      if (entry.operations && !entry.operations.includes("directory-size")) return <Typography.Text type="secondary">不适用</Typography.Text>;
      const calculated = directorySizes[entry.path];
      if (calculated) return <Typography.Text title={calculated.skippedEntries ? `已跳过 ${calculated.skippedEntries} 个链接或特殊文件` : "目录大小已计算"}>{formatBytes(calculated.totalSize)}</Typography.Text>;
      return <Button className="file-manager__size-action" type="link" size="small" loading={calculatingDirectoryPath === entry.path} disabled={!directoryReady || busy || !supportsDirectorySize} title={supportsDirectorySize ? "按需计算文件夹内的文件总大小" : "先进入磁盘或服务器目录，再计算目录大小"} aria-label={`计算文件夹“${entry.name}”的大小`} onClick={() => void calculateDirectorySize(entry)}>{supportsDirectorySize ? "计算" : "需更新"}</Button>;
    } },
    { title: renderColumnHeading("修改时间", "modifiedAt"), dataIndex: "modifiedAt", key: "modifiedAt", width: columnWidths.modifiedAt, align: "left", sorter: (left, right) => left.modifiedAt.localeCompare(right.modifiedAt), render: (value: string) => value ? value ? new Date(value).toLocaleString() : "" : "" },
    {
      title: "操作",
      key: "actions",
      width: columnWidths.actions,
      align: "left",
      onHeaderCell: () => ({ className: "file-manager__left-cell" }),
      onCell: () => ({ className: "file-manager__left-cell" }),
      render: (_value, entry) => {
        const entryUsable = directoryReady || showCurrentDirectorySnapshot && entry.kind === "directory";
        const menuItems = [
          ...(entry.kind === "file" && editableFileTypes.has(entry.fileType ?? "") ? [{ key: "edit", label: "编辑", disabled: busy || !directoryReady || !canOperate("write", entry) || entry.size > 2 * 1024 * 1024 }] : []),
          ...(entry.kind === "file" ? [{ key: "download", label: "下载", disabled: busy || !directoryReady || !canOperate("download", entry) || entry.size > maximumNodeFileTransferBytes && entry.downloadStrategy !== "stream" }] : []),
          { key: "move", label: "移动", disabled: busy || !directoryReady || !canOperate("move", entry) },
          { key: "rename", label: "重命名", disabled: busy || !directoryReady || !canOperate("rename", entry) },
          { key: "delete", label: "移入回收站", danger: true, disabled: busy || !directoryReady || !canOperate("delete", entry) }
        ];
        return <Space className="file-manager__row-actions" size={8}>
          <Button type="text" size="small" disabled={busy || !isOnline || !entryUsable || entry.kind === "file" && !canOperate("preview", entry) && !canOperate("download", entry)} onClick={() => void openEntry(entry)}>{entry.kind === "directory" ? "打开" : canOperate("preview", entry) ? "预览" : "下载"}</Button>
          <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items: menuItems, onClick: ({ key }) => {
            if (key === "edit") void editEntry(entry);
            else if (key === "download") void downloadEntry(entry);
            else if (key === "move") startMove([entry]);
            else if (key === "rename") beginRename(entry);
            else if (key === "delete") deleteEntry(entry);
          } }}>
            <Button type="text" size="small" aria-label={`更多操作：${entry.name}`}>更多</Button>
          </Dropdown>
        </Space>;
      }
    }
  ];

  const visibleColumns: ColumnsType<ManagedFileEntry> = compactFileTable
    ? columns.filter(column => column.key === "name" || column.key === "actions").map(column => ({
      ...column,
      ...(column.key === "name" ? { width: undefined } : { width: 104 })
    }))
    : columns;

  const crumbs = buildFileManagerBreadcrumbs(currentPath, locations, dataRootLabel);

  return (
    <div className="module-workbench-stage file-manager-stage" ref={layoutMeasureRef}>
      {messageContext}
      {modalContext}
      {layoutMeasured ? <ResizableWorkbench
        className="file-manager-workbench"
        leading={<GlobalNavigationRail
          username={user.username}
          role={user.role}
          serverState={serverState}
          shortcuts={settings.shortcuts}
          activePage="files"
          applications={applications}
          navigationApplications={navigationApplications}
          showServiceStatus={settings.general.showServiceStatus}
          onToggleApplications={onOpenApplications ?? (() => onNavigate("/work"))}
          onOpenRecentSessions={onOpenRecentSessions}
          onNavigate={onNavigate}
          onOpenApplication={onOpenApplication}
          onOpenFiles={() => onNavigate("/files")}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />}
        left={<aside id="file-manager-resource-navigation" className="file-manager__resource-pane" aria-label="资源导航">
          <div className="file-manager__pane-heading">
            <Typography.Text className="file-manager__pane-title">资源导航</Typography.Text>
            <Button type="text" className="file-manager__pane-close" aria-label="收起资源导航" title="收起资源导航" aria-expanded="true" aria-controls="file-manager-resource-navigation" onClick={() => setLeftCollapsed(true)}>
              <WorkbenchIcon name="close" size={15} />
            </Button>
          </div>
          <nav className="file-manager__resource-list" aria-label="资源类别">
            {locations.map(location => <button type="button" key={location.id} title={location.description} aria-current={activeLocation?.id === location.id ? "page" : undefined} disabled={!isOnline || busy} onClick={() => selectLocation(location.path)}><WorkbenchIcon name="folder" size={16} /><span>{location.name}<small lang="en">{resourceEnglishNames[location.id] ?? location.id}</small></span></button>)}
          </nav>
        </aside>}
        center={
      <section className="file-manager-page" aria-labelledby="file-manager-title">
        <WorkbenchHeader className="file-manager__workbench-header" layoutMode={metrics.mode} moduleMode="normal">
          <div className="lfaa-workbench-header__leading" data-workbench-header-slot="leading">
            <Button type="text" className="lfaa-workbench-header__toggle" aria-label={leftCollapsed ? "展开资源导航" : "收起资源导航"} title={leftCollapsed ? "展开资源导航" : "收起资源导航"} aria-expanded={leftCollapsed !== true} aria-controls="file-manager-resource-navigation" onClick={() => updateResourcePaneCollapsed(!Boolean(leftCollapsed))}>
              <WorkbenchIcon name="panelLeft" size={16} />
            </Button>
            <div className="lfaa-workbench-header__title" title="文件管理"><WorkbenchIcon name="folder" size={16} /><strong>文件管理</strong></div>
          </div>
          <div className="lfaa-workbench-header__actions" data-workbench-header-slot="actions">
            {settings.general.showServiceStatus ? <ServiceStatus state={serverState} compact /> : null}
            <Button type="text" className="lfaa-workbench-header__pane-toggle" aria-label={rightCollapsed ? "展开目录树" : "收起目录树"} title={rightCollapsed ? "展开目录树" : "收起目录树"} aria-expanded={rightCollapsed !== true} aria-controls="file-manager-directory-tree" disabled={!isOnline} onClick={() => updateDirectoryPaneCollapsed(!Boolean(rightCollapsed))}>
              <WorkbenchIcon name="panelRight" size={16} />
            </Button>
          </div>
        </WorkbenchHeader>
        <header className="file-manager__header">
          <div className="file-manager__heading">
            <Typography.Title id="file-manager-title" level={2}>文件与资源</Typography.Title>
          </div>
          <div className="file-manager__header-side">
            {dataRootLabel ? <Typography.Text className="file-manager__root-path" type="secondary" title={dataRootLabel} aria-label={`当前存储位置：${dataRootLabel}`}>
              <span className="file-manager__root-path-full">当前存储位置：{dataRootLabel}</span>
              <span className="file-manager__root-path-compact">{formatCompactRootPath(dataRootLabel)}</span>
            </Typography.Text> : null}
            <div className="file-manager__header-controls">
              <Space wrap className="file-manager__header-actions">
                {fileEntryReturnPath ? <Button type="primary" disabled={busy} onClick={() => onNavigate(fileEntryReturnPath)}>返回实例</Button> : null}
                <Button disabled={!isOnline || busy || !directoryReady || !canOperate("trash-list")} onClick={() => void loadTrash()}>回收站</Button>
                <Button aria-label="操作记录" title="操作记录" disabled={!fileAccess} onClick={() => void loadAudit()}>
                  <span className="file-manager__audit-full">操作记录</span>
                  <span className="file-manager__audit-compact" aria-hidden="true">记录</span>
                </Button>
              </Space>
            </div>
          </div>
        </header>

        {!fileAccess ? <Alert type="warning" showIcon message="文件管理需要同时满足：超级管理员身份、设置中心的完全访问模式。" /> : null}
        {error ? <Alert className="file-manager__alert" type="error" showIcon message={error} closable onClose={() => setError("")} /> : null}
        {locationError ? <Alert className="file-manager__alert" type="warning" showIcon message={`资源导航读取失败：${locationError}`} /> : null}
        {busy ? <div className="file-manager__task" role="status"><Spin size="small" /><span>{taskMessage || "正在执行文件操作…"}</span></div> : null}

        <div className="file-manager__toolbar">
          <div className="file-manager__navigation-row">
            <div className="file-manager__location">
              <Button aria-label="返回上一级" title="返回上一级" disabled={!isOnline || !currentPath || busy} onClick={navigateUp}><WorkbenchIcon name="chevron" size={15} /></Button>
              <Button aria-label="回到文件总览" title="回到文件总览" disabled={!isOnline || !currentPath || busy} onClick={() => { setCurrentPath(""); setSearchQuery(""); setSearchText(""); }}><WorkbenchIcon name="home" size={15} /></Button>
              <div className={`file-manager__breadcrumbs${crumbs.length ? " file-manager__breadcrumbs--nested" : ""}`} aria-label={`当前目录：${getFileManagerBreadcrumbTitle(dataRootLabel, currentPath)}`} title={getFileManagerBreadcrumbTitle(dataRootLabel, currentPath)}>
                <button type="button" className={!currentPath ? "is-current" : ""} disabled={!isOnline || busy} onClick={() => { setCurrentPath(""); setSearchQuery(""); setSearchText(""); }}>LFAA 数据</button>
                {crumbs.map((crumb) => <span key={crumb.path}>
                  <span aria-hidden="true">/</span>
                  <button type="button" className={crumb.path === currentPath ? "is-current" : ""} disabled={!isOnline || busy} onClick={() => { setCurrentPath(crumb.path); setSearchQuery(""); setSearchText(""); }}>{crumb.name}</button>
                </span>)}
              </div>
            </div>
          </div>
          <div className="file-manager__actions">
            <Input
              allowClear
              disabled={!isOnline || !directoryUsable || busy || !fileAccess}
              prefix={<WorkbenchIcon name="search" size={15} />}
              placeholder={compactFileTable ? "搜索文件" : "搜索当前目录及子目录"}
              value={searchText}
              onChange={(event) => { setSearchText(event.target.value); if (!event.target.value) setSearchQuery(""); }}
              onPressEnter={() => setSearchQuery(searchText.trim())}
              style={{ width: 280 }}
            />
            <Popover trigger="click" placement="bottomLeft" open={filtersOpen} onOpenChange={setFiltersOpen} content={<div className="file-manager__filter-panel">
              <label><span>文件类型</span><Select aria-label="文件类型筛选" value={typeFilter} onChange={setTypeFilter} disabled={!directoryUsable || busy} options={[
                { value: "all", label: "全部类型" }, { value: "folder", label: "文件夹" }, { value: "file", label: "文件" },
                ...Array.from(new Set(entries.filter(entry => entry.kind === "file").map(entry => entry.fileType).filter((value): value is string => Boolean(value) && value !== "file" && value !== "folder"))).sort().map(value => ({ value, label: `.${value}` }))
              ]} /></label>
              <label><span>文件大小（字节）</span><div className="file-manager__filter-range"><Input aria-label="最小大小（字节）" type="number" min={0} placeholder="最小" value={minimumSize} onChange={event => setMinimumSize(event.target.value)} disabled={!directoryUsable || busy} /><span>至</span><Input aria-label="最大大小（字节）" type="number" min={0} placeholder="最大" value={maximumSize} onChange={event => setMaximumSize(event.target.value)} disabled={!directoryUsable || busy} /></div></label>
              <label><span>修改日期</span><div className="file-manager__filter-range"><Input aria-label="修改时间起始日期" type="date" value={modifiedAfter} onChange={event => setModifiedAfter(event.target.value)} disabled={!directoryUsable || busy} /><span>至</span><Input aria-label="修改时间截止日期" type="date" value={modifiedBefore} onChange={event => setModifiedBefore(event.target.value)} disabled={!directoryUsable || busy} /></div></label>
              <div className="file-manager__filter-footer"><span>{activeFilterCount ? `已启用 ${activeFilterCount} 项筛选` : "未设置筛选条件"}</span><Button size="small" type="link" disabled={!activeFilterCount} onClick={() => { setTypeFilter("all"); setMinimumSize(""); setMaximumSize(""); setModifiedAfter(""); setModifiedBefore(""); }}>清除筛选</Button></div>
            </div>}>
              <Button aria-expanded={filtersOpen} aria-label={activeFilterCount ? `筛选，已启用 ${activeFilterCount} 项` : "筛选文件"}>筛选{activeFilterCount ? ` · ${activeFilterCount}` : ""}</Button>
            </Popover>
            <Button aria-label="刷新目录" title="刷新目录" loading={loading} disabled={!isOnline || busy || loading} onClick={() => void refresh()}><WorkbenchIcon name="refresh" size={15} /></Button>
            <Dropdown trigger={["click"]} menu={{ items: [
              { key: "folder", label: "新建文件夹", disabled: !canOperate("create-folder") },
              { key: "file", label: "新建文件", disabled: !canOperate("create-file") }
            ], onClick: ({ key }) => openCreateDialog(key === "folder" ? "folder" : "file") }}>
              <Button disabled={!isOnline || !directoryReady || busy || !canOperate("create-file") && !canOperate("create-folder")}><WorkbenchIcon name="plus" size={15} />新建</Button>
            </Dropdown>
            <Button type="primary" aria-label="上传 / 导入" disabled={!isOnline || !directoryReady || busy || !canOperate("upload")} onClick={() => uploadInputRef.current?.click()}><WorkbenchIcon name="file" size={15} /><span className="file-manager__upload-full">上传 / 导入</span><span className="file-manager__upload-compact" aria-hidden="true">上传</span></Button>
            <input ref={uploadInputRef} className="file-manager__upload-input" type="file" multiple onChange={(event) => void uploadSelectedFiles(Array.from(event.target.files ?? []))} />
          </div>
        </div>

        {selectedPaths.length ? <div className="file-manager__selection" role="toolbar" aria-label="批量操作">
          <span>已选 {selectedPaths.length} 项</span>
          <Button size="small" disabled={busy} onClick={() => void downloadSelectedEntries()}>批量下载</Button>
          <Button size="small" disabled={busy || !directoryReady || entries.some(entry => selectedPaths.includes(entry.path) && !canOperate("move", entry))} onClick={() => startMove(entries.filter(entry => selectedPaths.includes(entry.path)))}>批量移动</Button>
          <Button size="small" danger disabled={busy || !directoryReady || entries.some(entry => selectedPaths.includes(entry.path) && !canOperate("delete", entry))} onClick={deleteSelectedEntries}>批量移入回收站</Button>
          <Button size="small" type="text" onClick={() => setSelectedPaths([])}>清除选择</Button>
        </div> : null}

        <div className={`file-manager__body${compactFileTable ? " file-manager__body--compact" : ""}`} ref={fileManagerBodyRef}>
          {activeLocation?.id === "plugins" ? <div className="file-manager__resource-context"><Button size="small" onClick={onOpenSettings}>管理扩展插件</Button></div> : null}
          {loading && !showCurrentDirectorySnapshot ? <div className="file-manager__loading" role="status"><Spin /><span>正在读取目录…</span></div>
            : !fileAccess ? <Empty className="file-manager__empty" description="仅超级管理员在完全访问模式下可使用文件管理"><Button onClick={onOpenSettings}>前往设置中心</Button></Empty>
                      : directoryState === "error" ? <div className="file-manager__offline-state" role="status">
                      <Typography.Title level={4}>目录读取失败</Typography.Title>
                      <Typography.Text>请求未成功，无法判断目录内容。请检查上方错误信息后重试。</Typography.Text>
                      <Button disabled={!isOnline || busy} onClick={() => void refresh()}>重试读取目录</Button>
                    </div>
                      : directoryState !== "ready" && !showCurrentDirectorySnapshot ? <div className="file-manager__offline-state" role="status"><Typography.Text>目录尚未读取。</Typography.Text></div>
                      : visibleEntries.length ? <Table<ManagedFileEntry> rowKey="path" size="small" tableLayout="fixed" scroll={compactFileTable ? undefined : { x: true }} columns={visibleColumns} dataSource={visibleEntries} rowSelection={{ columnWidth: 42, selectedRowKeys: selectedPaths, onChange: keys => {
                          if (keys.length > maximumBatchItems) { messageApi.warning(`批量操作最多选择 ${maximumBatchItems} 项。`); setSelectedPaths(keys.slice(0, maximumBatchItems).map(String)); }
                          else setSelectedPaths(keys.map(String));
                        } }} pagination={{ pageSize: 20, showSizeChanger: false }} onRow={(entry) => ({ onDoubleClick: () => void openEntry(entry), onDragOver: event => { if (entry.kind === "directory") event.preventDefault(); }, onDrop: event => { event.preventDefault(); void moveOnDrop(entry); } })} />
                          : <Empty className="file-manager__empty" description={searchQuery ? "没有匹配的文件" : currentPath === ".lfaa-library/game-instances" ? "没有已登记的游戏实例" : currentPath === ".lfaa-library/game-storage" ? "没有报告文件能力的游戏节点" : "此目录为空"} />}
          {truncated ? <Typography.Text className="file-manager__truncated" type="secondary">当前结果最多显示 500 项，请进入子目录进一步筛选。</Typography.Text> : null}
        </div>
        <footer className="file-manager__footer">
          <span>{!isOnline || !directoryUsable ? "目录未读取" : searchQuery ? `搜索结果 ${visibleEntries.length} 项` : `${visibleEntries.length} 个项目`}{loading && showCurrentDirectorySnapshot ? " · 正在同步" : ""}</span>
          <span>统一文件服务 · 敏感文件禁止在线预览</span>
        </footer>
      </section>}
        right={<aside id="file-manager-directory-tree" className="file-manager__directory-pane" aria-label="当前目录树">
          <div className="file-manager__directory-heading">
            <Typography.Text className="file-manager__tree-title">目录树</Typography.Text>
            <Button type="text" className="file-manager__pane-close" aria-label="收起目录树" title="收起目录树" aria-expanded="true" aria-controls="file-manager-directory-tree" onClick={() => setRightCollapsed(true)}>
              <WorkbenchIcon name="close" size={15} />
            </Button>
          </div>
          <div className="file-manager__tree-scroll">
            <Tree key={cacheKey} blockNode treeData={treeData} loadData={loadTreeChildren} loadedKeys={loadedTreeKeys} onLoad={(keys) => setLoadedTreeKeys(keys)} selectedKeys={[currentPath]} onSelect={(keys) => {
              if (!keys.length || busy) return;
              setCurrentPath(String(keys[0])); setSearchQuery(""); setSearchText("");
            }} />
          </div>
        </aside>}
        leadingRegionClassName="file-manager__leading-region"
        leftRegionClassName="file-manager__resource-region"
        centerRegionClassName="file-manager__center-region"
        rightRegionClassName="file-manager__directory-region"
        storageKey={`lfaa.file-manager.workbench.v1:${user.id}`}
        leftLimits={metrics.left}
        rightLimits={metrics.right}
        bottomLimits={metrics.bottom}
        containerWidth={metrics.containerWidth}
        minCenterWidth={metrics.minCenterWidth}
        snapCaptureRatio={metrics.snapCaptureRatio}
        snapHysteresis={metrics.snapHysteresis}
        initialLeftCollapsed={metrics.mode === "mobile"}
        initialRightCollapsed={metrics.mode !== "desktop"}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        onLeftCollapsedChange={updateResourcePaneCollapsed}
        onRightCollapsedChange={updateDirectoryPaneCollapsed}
        onInitialCollapseState={applyInitialCollapseState}
        layoutMode={metrics.mode}
        responsiveRightDock
        responsiveLeftDock
      /> : null}

      <Modal title={createKind === "folder" ? "新建文件夹" : "新建文件"} open={createKind !== null} getContainer={getFileManagerModalContainer} okText="创建" cancelText="取消" onOk={() => void createEntry()} onCancel={() => setCreateKind(null)} confirmLoading={busy} okButtonProps={{ disabled: !isOnline || !newName.trim() }}>
        <Input autoFocus disabled={!isOnline} value={newName} maxLength={255} placeholder={createKind === "folder" ? "文件夹名称" : "文件名，例如 server.properties"} onChange={(event) => setNewName(event.target.value)} onPressEnter={() => void createEntry()} />
      </Modal>
      <Modal title="重命名" open={renameEntry !== null} getContainer={getFileManagerModalContainer} okText="保存" cancelText="取消" onOk={() => void renameSelectedEntry()} onCancel={() => setRenameEntry(null)} confirmLoading={busy} okButtonProps={{ disabled: !isOnline || !renameValue.trim() }}>
        <Input autoFocus disabled={!isOnline} value={renameValue} maxLength={255} onChange={(event) => setRenameValue(event.target.value)} onPressEnter={() => void renameSelectedEntry()} />
      </Modal>
      <Modal title={`预览 · ${preview?.name ?? ""}`} open={preview !== null} getContainer={getFileManagerModalContainer} footer={<Button onClick={() => setPreview(null)}>关闭</Button>} width="min(1080px, calc(100vw - 40px))" onCancel={() => setPreview(null)}>
        {preview?.kind === "image" && previewUrl ? <div className="file-manager__image-preview"><img src={previewUrl} alt={preview.name} /></div> : null}
        {preview?.kind === "pdf" && previewUrl ? <iframe className="file-manager__pdf-preview" src={previewUrl} title={`PDF 预览：${preview.name}`} /> : null}
        {preview?.kind === "text" ? <article className={`file-manager__text-preview${/\.(?:md|markdown)$/iu.test(preview.name) ? " is-markdown" : ""}`}>
          {/\.(?:md|markdown)$/iu.test(preview.name) ? renderMarkdown(preview.content ?? "") : <pre>{preview.content ?? ""}</pre>}
        </article> : null}
      </Modal>
      <Modal title="移动到目录" open={moveDialogOpen} getContainer={getFileManagerModalContainer} okText="移动" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: busy || !isOnline }} onOk={() => void moveSelectedEntries()} onCancel={() => setMoveDialogOpen(false)}>
        <Typography.Paragraph type="secondary">选择同一磁盘或机器内的目标目录。可从目录树复制当前路径。</Typography.Paragraph>
        <Input autoFocus value={moveDestination} maxLength={1024} placeholder="例如 games/minecraft" onChange={event => setMoveDestination(event.target.value)} onPressEnter={() => void moveSelectedEntries()} />
      </Modal>
      <Modal title="回收站" open={trashOpen} getContainer={getFileManagerModalContainer} footer={<Button onClick={() => setTrashOpen(false)}>关闭</Button>} width="min(900px, calc(100vw - 40px))" onCancel={() => setTrashOpen(false)}>
        {trashEntries.length ? <Table<ManagedFileEntry> rowKey="trashId" size="small" pagination={{ pageSize: 8 }} dataSource={trashEntries} columns={[
          { title: "名称", dataIndex: "name", key: "name", ellipsis: true },
          { title: "原位置", dataIndex: "path", key: "path", ellipsis: true },
          { title: "删除时间", dataIndex: "modifiedAt", key: "modifiedAt", width: 190, render: (value: string) => new Date(value).toLocaleString() },
          { title: "操作", key: "actions", width: 150, render: (_value, entry) => <Space size={4}><Button size="small" type="link" onClick={() => void restoreTrashEntry(entry)}>恢复</Button><Button size="small" type="link" danger onClick={() => purgeTrashEntry(entry)}>彻底删除</Button></Space> }
        ]} /> : <Empty description="回收站为空" />}
      </Modal>
      <Modal title="文件操作记录" open={auditOpen} getContainer={getFileManagerModalContainer} footer={<Button onClick={() => setAuditOpen(false)}>关闭</Button>} width="min(1040px, calc(100vw - 40px))" onCancel={() => setAuditOpen(false)}>
        <Input.Search allowClear value={auditQuery} placeholder="搜索文件名、路径、操作或用户" enterButton="搜索" onChange={event => setAuditQuery(event.target.value)} onSearch={() => void loadAudit()} />
        <Table<FileManagerAuditEntry> rowKey="id" size="small" pagination={{ pageSize: 10 }} dataSource={auditEntries} columns={[
          { title: "操作人", dataIndex: "username", key: "username", width: 120 },
          { title: "操作", dataIndex: "operation", key: "operation", width: 125 },
          { title: "路径", dataIndex: "path", key: "path", ellipsis: true, render: (value: string, entry) => entry.targetPath ? `${value} → ${entry.targetPath}` : value || entry.fileName || "数据根" },
          { title: "结果", dataIndex: "succeeded", key: "succeeded", width: 80, render: (value: boolean) => <Tag color={value ? "green" : "red"}>{value ? "成功" : "失败"}</Tag> },
          { title: "时间", dataIndex: "finishedAt", key: "finishedAt", width: 190, render: (value: string) => new Date(value).toLocaleString() }
        ]} />
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
        okButtonProps={{ disabled: !fileAccess || !isOnline || editorContent === editorSavedContent }}
      >
        {/\.(?:md|markdown)$/iu.test(editorPath)
          ? <div className="file-manager__markdown-editor">
            <Input.TextArea className="file-manager__editor-input" aria-label="Markdown 源文编辑" value={editorContent} onChange={(event) => setEditorContent(event.target.value)} spellCheck={false} />
            <article className="file-manager__markdown-live-preview" aria-label="Markdown 实时预览">{renderMarkdown(editorContent)}</article>
          </div>
          : <Input.TextArea className="file-manager__editor-input" aria-label="文本内容编辑" value={editorContent} onChange={(event) => setEditorContent(event.target.value)} spellCheck={false} />}
      </Modal>
    </div>
  );
}
