/** 功能：运行环境的认证 API 与共享展示合同。作用：手动页面与 AI 使用同一 RuntimeManager，目标设备不由浏览器操作系统推断。 */
import { request } from "./api.js";
export interface RuntimeEnvironment {
  runtimeId: string; type: "java" | "steamcmd" | "visual-cpp" | "directx"; major?: number; version?: string; vendor: string;
  executablePath?: string; managed: boolean; source: "managed" | "system" | "custom";
  available: boolean; detectedAt?: string;
}
export interface RuntimeOverview {
  packages:Array<{id:string;type:"visual-cpp"|"directx";name:string;architecture:string}>;
  devices: Array<{ id: string; displayName: string; platform: string; architecture: string; status: "online" | "offline"; runtimes: RuntimeEnvironment[];storage?:RuntimeStorage;servers?:Array<{id:string;name:string;requiredJavaMajor:number|null;state:string}> }>;
}
export interface RuntimeStorage {runtimeDirectory:string;downloadCacheDirectory:string;temporaryDirectory:string;}
export function saveRuntimeStorage(targetId:string,input:RuntimeStorage):Promise<RuntimeStorage> {return request(`/runtime-environments/storage/${encodeURIComponent(targetId)}`,{method:"PUT",body:JSON.stringify(input)});}
export function listRuntimeTasks(signal?:AbortSignal):Promise<{tasks:RuntimeTask[]}> {return request("/runtime-environments/tasks",{signal});}
export function cancelMinecraftTask(id:string):Promise<unknown> {return request(`/minecraft/tasks/${encodeURIComponent(id)}/cancel`,{method:"POST"});}
export interface RuntimeTask {
  id: string; targetId: string; operation: string; status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  message: string; cancelRequested: boolean; result?: unknown;
}
export function loadRuntimeOverview(signal?: AbortSignal): Promise<RuntimeOverview> { return request("/runtime-environments", { signal }); }
export function runRuntimeOperation(input: Record<string, unknown>): Promise<RuntimeTask> { return request("/runtime-environments/tasks", { method: "POST", body: JSON.stringify(input) }); }
export function loadRuntimeTask(id: string, signal?: AbortSignal): Promise<RuntimeTask> { return request(`/runtime-environments/tasks/${encodeURIComponent(id)}`, { signal }); }
export function cancelRuntimeTask(id: string): Promise<RuntimeTask> { return request(`/runtime-environments/tasks/${encodeURIComponent(id)}/cancel`, { method: "POST" }); }
export function loadMinecraftRuntimeRequirement(input:{core:string;version:string;build:string;nodeId:string},signal?:AbortSignal):Promise<{javaMajor:number;source:string;launchKind:string;installed:boolean;runtimes:RuntimeEnvironment[]}> {return request("/minecraft/runtime-requirement",{method:"POST",body:JSON.stringify(input),signal});}
