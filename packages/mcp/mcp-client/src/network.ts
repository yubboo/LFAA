/**
 * 功能：校验并固定 MCP HTTP 出站目标。
 * 作用：远程控制端拒绝非公网地址，且连接使用已校验的 DNS 结果，避免重绑定绕过。
 * 关联文件：runtime.ts、util/launch-environment/src/config.ts。
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { RequestOptions } from "node:http";

export interface McpNetworkAddress { address: string; family: 4 | 6 }
export interface ResolvedMcpEndpoint { url: URL; hostname: string; addresses: McpNetworkAddress[] }
type AddressResolver = (hostname: string) => Promise<readonly McpNetworkAddress[]>;

function ipv4Number(address: string): bigint | null {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some(part => !/^(?:0|[1-9]\d{0,2})$/u.test(part) || Number(part) > 255)) return null;
  return parts.reduce((value, part) => (value << 8n) | BigInt(Number(part)), 0n);
}

function ipv6Number(address: string): bigint | null {
  let input = address.toLowerCase();
  if (input.includes("%")) return null;
  if (input.includes(".")) {
    const separator = input.lastIndexOf(":");
    const tail = ipv4Number(input.slice(separator + 1));
    if (separator < 0 || tail === null) return null;
    const high = Number((tail >> 16n) & 0xffffn).toString(16);
    const low = Number(tail & 0xffffn).toString(16);
    input = `${input.slice(0, separator)}:${high}:${low}`;
  }
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 && missing !== 0 || halves.length === 2 && missing < 1) return null;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8 || groups.some(group => !/^[a-f\d]{1,4}$/u.test(group))) return null;
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function inCidr(value: bigint, network: bigint, prefix: number, bits: number): boolean {
  const shift = BigInt(bits - prefix);
  return (value >> shift) === (network >> shift);
}

function inIpv4Cidr(address: string, network: string, prefix: number): boolean {
  const value = ipv4Number(address), base = ipv4Number(network);
  return value !== null && base !== null && inCidr(value, base, prefix, 32);
}

function inIpv6Cidr(address: string, network: string, prefix: number): boolean {
  const value = ipv6Number(address), base = ipv6Number(network);
  return value !== null && base !== null && inCidr(value, base, prefix, 128);
}

/** True only for ordinary globally routable unicast addresses. */
export function isPublicMcpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const denied: Array<[string, number]> = [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["168.63.129.16", 32], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
      ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
    ];
    return !denied.some(([network, prefix]) => inIpv4Cidr(address, network, prefix));
  }
  if (family === 6) {
    // Global unicast is 2000::/3; exclude protocol-assignment, transition and documentation ranges.
    return inIpv6Cidr(address, "2000::", 3)
      && !inIpv6Cidr(address, "2001::", 23)
      && !inIpv6Cidr(address, "2001:db8::", 32)
      && !inIpv6Cidr(address, "2002::", 16)
      && !inIpv6Cidr(address, "3fff::", 20);
  }
  return false;
}

async function resolveAddresses(hostname: string): Promise<readonly McpNetworkAddress[]> {
  const literalFamily = isIP(hostname);
  if (literalFamily) return [{ address: hostname, family: literalFamily as 4 | 6 }];
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map(result => ({ address: result.address, family: result.family as 4 | 6 }));
}

export async function resolveMcpEndpoint(
  url: URL,
  allowPrivateNetwork: boolean,
  resolver: AddressResolver = resolveAddresses
): Promise<ResolvedMcpEndpoint> {
  const hostname = url.hostname.startsWith("[") && url.hostname.endsWith("]") ? url.hostname.slice(1, -1) : url.hostname;
  let addresses: readonly McpNetworkAddress[];
  try { addresses = await resolver(hostname); }
  catch { throw new Error("MCP 地址无法解析或被当前运行环境的网络策略拒绝。"); }
  if (!addresses.length || addresses.some(item => !isIP(item.address) || item.family !== isIP(item.address)
    || (!allowPrivateNetwork && !isPublicMcpAddress(item.address)))) {
    throw new Error("MCP 地址无法解析或被当前运行环境的网络策略拒绝。");
  }
  return { url, hostname, addresses: addresses.map(item => ({ ...item })) };
}

/** HTTP(S) 连接只可使用本次校验过的地址；不再调用系统解析器，避免 DNS 重绑定竞态。 */
export function createPinnedMcpLookup(endpoint: ResolvedMcpEndpoint): NonNullable<RequestOptions["lookup"]> {
  const lookup: NonNullable<RequestOptions["lookup"]> = (hostname, options, callback): void => {
    if (hostname.toLowerCase() !== endpoint.hostname.toLowerCase()) {
      const error = Object.assign(new Error("MCP 请求主机与已校验地址不一致。"), { code: "EACCES" });
      callback(error, "", 0);
      return;
    }
    const family = options.family ?? 0;
    const addresses = endpoint.addresses.filter(item => !family || item.family === family);
    if (!addresses.length) {
      const error = Object.assign(new Error("MCP 已校验地址族不可用。"), { code: "EAI_ADDRFAMILY" });
      callback(error, "", 0);
      return;
    }
    if (options.all) {
      callback(null, addresses.map(item => ({ ...item })));
      return;
    }
    const selected = addresses[0]!;
    callback(null, selected.address, selected.family);
  };
  return lookup;
}
