/**
 * 通用 Typert Remote Client：沿现有同源认证请求调用已登记 Host 方法并回传解析结果。
 */
import { request } from "./http-client.js";
import type { TypertRemoteCallOptions, TypertRemoteClientContract } from "lfaa-typert-protocol/src/index.js";



function isTypertIdentifier(value: string): boolean {
  return value.length <= 128 && /^[a-z0-9][a-z0-9._-]*$/u.test(value);
}


/** 使用现有同源 API 会话调用已登记的类型化 Remote；响应仍由 Host 方法的运行时解析器校验。 */
export async function invokeTypertRemote<Contract extends TypertRemoteClientContract, Endpoint extends keyof Contract & string>(
  endpoint: Endpoint,
  input: Contract[Endpoint]["input"],
  options: TypertRemoteCallOptions = {}
): Promise<Contract[Endpoint]["output"]> {
  const separator = endpoint.indexOf("/");
  const namespace = endpoint.slice(0, separator);
  const method = endpoint.slice(separator + 1);
  if (separator <= 0 || endpoint.indexOf("/", separator + 1) >= 0 || !isTypertIdentifier(namespace) || !isTypertIdentifier(method)) {
    throw new TypeError("Remote 命名空间或方法名无效。");
  }
  const signalOption = options.signal ? { signal: options.signal } : {};
  const response = await request<{ result: Contract[Endpoint]["output"] }>(`/typert/${encodeURIComponent(namespace)}/${encodeURIComponent(method)}`, {
    method: "POST",
    body: JSON.stringify({ input }),
    ...signalOption
  });
  return response.result;
}