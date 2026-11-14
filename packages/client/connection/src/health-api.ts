/** 当前服务健康与持久化可用性只读投影。 */
import { request } from "./http-client.js";
export interface ServerHealth {
  status: "ok" | "error";
  service: string;
  persistence: "ready" | "unavailable";
  timestamp: string;
}
export function loadHealth(): Promise<ServerHealth> {
  return request<ServerHealth>("/health");
}

