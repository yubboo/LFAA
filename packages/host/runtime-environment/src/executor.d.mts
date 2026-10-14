/** 共享执行器的控制层类型；实际进程与文件由 executor.mjs 持有。 */
export interface RuntimeRecord extends Record<string,unknown> {runtimeId:string;major?:number;version?:string;vendor:string;managed:boolean;source:"managed"|"system"|"custom";executablePath:string;available:boolean;detectedAt:string;}
export interface RuntimeStorage {runtimeDirectory:string;downloadCacheDirectory:string;temporaryDirectory:string;previousRuntimeDirectories?:string[];}
export function createRuntimeExecutor(options:{dataDirectory:string;repositoryRoot:string;storage:RuntimeStorage;signal?:AbortSignal;checkDependencies?:(runtime:RuntimeRecord)=>Promise<void>}):{
  list():Promise<RuntimeRecord[]>;
  execute(operation:string,payload:Record<string,unknown>,progress?:(progress:number,message:string)=>void|Promise<void>):Promise<Record<string,unknown>>;
};
