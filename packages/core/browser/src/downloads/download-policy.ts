// 下载域名匹配与策略裁决。运行在 Host，独立于已有的浏览规则匹配。
import type { BrowserPolicyDecision, BrowserSettingsConfig, BrowserSiteRule } from "../types";

function parseUrl(raw?: string): URL | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

function webUrl(raw?: string): URL | undefined {
  const parsed = parseUrl(raw);
  return parsed?.protocol === "http:" || parsed?.protocol === "https:" ? parsed : undefined;
}

function matchRule(host: string, rules: readonly BrowserSiteRule[]) {
  return rules.find(({ pattern }) => {
    const trimmed = pattern.trim();
    const wildcard = trimmed.startsWith("*.");
    const candidate = wildcard ? trimmed.slice(2) : trimmed;
    const domain = webUrl(/^https?:\/\//iu.test(candidate) ? candidate : `https://${candidate}`)?.hostname;
    return domain && (host === domain || (wildcard && host.endsWith(`.${domain}`)));
  });
}

/** 只用可确认的 HTTP(S) 主机授权，历史来源保留公开路径，避免记录查询参数或 URL 凭据。 */
export function resolveDownloadPolicy(config: BrowserSettingsConfig, rawUrl: string, sourceUrl?: string) {
  const resource = webUrl(rawUrl);
  const derivedOrigin = parseUrl(rawUrl)?.origin;
  const source = webUrl(sourceUrl) ?? webUrl(derivedOrigin);
  const target = resource ?? source;
  const rules = config.siteRules ?? [];
  const blockedSource = source && matchRule(source.hostname, rules)?.download === "block";
  const fallback = config.defaultDownloadPolicy ?? "ask";
  const decision: BrowserPolicyDecision = blockedSource
    ? "block"
    : target
      ? matchRule(target.hostname, rules)?.download ?? fallback
      : fallback === "block" ? "block" : "ask";
  const url = target ? target.origin + target.pathname : "";
  return { decision, url };
}
