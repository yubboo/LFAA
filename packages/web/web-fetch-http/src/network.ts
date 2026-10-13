/**
 * 文件：network.ts
 * 功能：手写公网地址判定与 DNS 解析，拒绝把内网/环回/链路本地地址作为抓取目标。
 * 作用：在发起请求前一次性解析主机名，若任一解析结果不是公网单播地址则整体拒绝，
 *      避免模型通过 URL 触达本机或内网服务（SSRF）。
 * 不负责：实际 HTTP 请求、重定向、字节上限（在 provider.ts）。
 * 关联文件：policy.ts（URL 校验）、provider.ts。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-web-fetch-http。
 * 简化说明：DSH 原版依赖 ipaddr.js 做 NAT64/IPv4-mapped 精确判定，本环境 pnpm store 无该依赖，
 *      这里手写覆盖 IPv4 私网/环回/链路本地与 IPv6 ULA/环回/链路本地/IPv4-mapped 嵌入判定；
 *      NAT64 前缀发现未移植（视为待集成项）。
 */
import { lookup as systemLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { WebError } from "lfaa-web/src/types.js";

/** 判定一个 IPv4 文本地址是否为公网单播。 */
function isPublicIPv4(input: string): boolean {
  const parts = input.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return false; // 0.0.0.0/8
  if (a === 127) return false; // 环回
  if (a === 10) return false; // 私网
  if (a === 172 && b >= 16 && b <= 31) return false; // 私网 172.16/12
  if (a === 192 && b === 168) return false; // 私网
  if (a === 169 && b === 254) return false; // 链路本地
  if (a === 100 && b >= 64 && b <= 127) return false; // CGN 共享地址段
  if (a >= 224) return false; // 组播/保留/广播
  return true;
}

/** 去掉 IPv6 字面量外层方括号。 */
function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

/** 判定 IPv6 是否为公网单播；IPv4-mapped 按嵌入的 IPv4 判定。 */
function isPublicIPv6(input: string): boolean {
  const lower = input.toLowerCase();
  if (lower === "::1" || lower === "::") return false; // 环回/未指定
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false; // ULA fc00::/7
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return false; // 链路本地 fe80::/10
  if (lower.startsWith("ff")) return false; // 组播
  // IPv4-mapped：::ffff:a.b.c.d
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(lower);
  if (mapped) return isPublicIPv4(mapped[1] as string);
  return true;
}

/**
 * 判定一个文本 IP 是否为公网单播地址。
 * 输入可能带 IPv6 方括号；非 IP 文本返回 false。
 */
export function isPublicIpAddress(input: string): boolean {
  const unbracketed = stripIpv6Brackets(input);
  const family = isIP(unbracketed);
  if (family === 4) return isPublicIPv4(unbracketed);
  if (family === 6) return isPublicIPv6(unbracketed);
  return false;
}

/**
 * 解析主机名并校验完整答案集：任一地址非公网即整体拒绝。
 * IP 字面量目标直接校验，不再走 DNS。
 */
export async function resolvePublicAddresses(hostname: string, signal: AbortSignal): Promise<readonly LookupAddress[]> {
  const unbracketed = stripIpv6Brackets(hostname);
  const literalFamily = isIP(unbracketed);
  const resolved = literalFamily === 0
    ? await raceWithSignal(systemLookup(unbracketed, { all: true, order: "verbatim" }), signal)
    : [{ address: unbracketed, family: literalFamily as 4 | 6 }];

  if (resolved.length === 0) {
    throw new WebError(`主机名 "${hostname}" 未解析到任何地址`, "WEB_PROVIDER_ERROR");
  }
  for (const entry of resolved) {
    if (!isPublicIpAddress(entry.address)) {
      throw new WebError(`URL 主机名 "${hostname}" 解析到非公网地址，已拒绝`, "WEB_BLOCKED_URL");
    }
  }
  return resolved;
}

/** 主机名本身就是一个会被拒绝的非公网 IP 字面量时返回 true。 */
export function isNonPublicIpLiteral(hostname: string): boolean {
  const unbracketed = stripIpv6Brackets(hostname);
  return isIP(unbracketed) !== 0 && !isPublicIpAddress(unbracketed);
}

/** 把不可取消的系统 DNS 查询与调用方取消信号竞速，避免取消后仍长时间挂起。 */
function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new WebError("抓取在主机名解析阶段被取消", "WEB_ABORTED", { cause: signal.reason }));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new WebError("抓取在主机名解析阶段被取消", "WEB_ABORTED", { cause: signal.reason }));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => { signal.removeEventListener("abort", onAbort); });
  });
}
