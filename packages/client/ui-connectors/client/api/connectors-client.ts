// 浏览器端连接器请求封装：列表、目录、CLI 增删改、探测与测试；宿主令牌由 Web 入口统一注入。
import type {
  CatalogItem,
  CatalogJob,
  CliConnectorConfig,
  ConnectorProbeResult,
  ConnectorSummary,
  ConnectorTemplate,
  ConnectorTestResult,
} from "@lfaa/connectors/contract";

const base = "/api/connectors";

export interface ConnectorListResponse {
  connectors: ConnectorSummary[];
  templates: ConnectorTemplate[];
  catalog: CatalogItem[];
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(failure?.error ?? `HTTP ${response.status}`);
  }
  return await response.json() as T;
}

const json = (method: string, payload?: unknown): RequestInit => (payload === undefined
  ? { method }
  : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

/** CLI 连接器的可提交负载：id 单独传，其余字段与配置一致。 */
export type CliConnectorPayload = Omit<CliConnectorConfig, "id"> & { id?: string };

export const connectorsApi = {
  list: (signal?: AbortSignal) => request<ConnectorListResponse>(base, signal ? { signal } : {}),
  get: (id: string) => request<{ connector: CliConnectorConfig }>(base + "/" + encodeURIComponent(id)),
  create: (payload: CliConnectorPayload) => request<ConnectorListResponse>(base, json("POST", payload)),
  update: (id: string, payload: Partial<CliConnectorPayload>) => request<ConnectorListResponse>(base + "/" + encodeURIComponent(id), json("PATCH", payload)),
  remove: (id: string) => request<ConnectorListResponse>(base + "/" + encodeURIComponent(id), json("DELETE")),
  importConnectors: (payload: unknown) => request<ConnectorListResponse>(base + "/import", json("POST", payload)),
  test: (id: string) => request<{ result: ConnectorTestResult }>(base + "/" + encodeURIComponent(id) + "/test", json("POST")),
  probe: (executable: string, args?: string[]) => request<{ result: ConnectorProbeResult }>(base + "/probe", json("POST", { executable, ...(args ? { args } : {}) })),
  catalog: (signal?: AbortSignal) => request<{ catalog: CatalogItem[] }>(base + "/catalog", signal ? { signal } : {}),
  connectCatalog: (id: string, inputs: Record<string, string>) =>
    request<{ job: CatalogJob }>(base + "/catalog/" + encodeURIComponent(id) + "/connect", json("POST", { inputs })),
  disconnectCatalog: (id: string) => request<ConnectorListResponse>(base + "/catalog/" + encodeURIComponent(id), json("DELETE")),
  job: (id: string) => request<{ job: CatalogJob }>(base + "/jobs/" + encodeURIComponent(id)),
};

/** 选择工作目录复用工作区原生选择器；桌面端桥接与 Web 端共用同一接口。 */
export async function pickWorkingDirectory(initialDir?: string): Promise<{ cancelled: boolean; path?: string; error?: string }> {
  const desktopDialog = typeof window !== "undefined"
    ? (window as unknown as { __LFAA_DESKTOP_DIALOG__?: { pickFolder: (opts?: { title?: string; defaultPath?: string }) => Promise<{ cancelled: boolean; path?: string; error?: string }> } }).__LFAA_DESKTOP_DIALOG__
    : undefined;
  if (desktopDialog) {
    return desktopDialog.pickFolder({
      title: "选择工作目录",
      ...(initialDir ? { defaultPath: initialDir } : {}),
    });
  }
  return request<{ cancelled: boolean; path?: string; error?: string }>("/api/workspace/pick-folder", json("POST", {
    title: "选择工作目录",
    ...(initialDir ? { initialDir } : {}),
  }));
}