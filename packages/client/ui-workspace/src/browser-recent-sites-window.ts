import type { BrowserRecentSite } from "lfaa-client-connection/src/api.js";

export const BROWSER_RECENT_SITES_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface VisibleBrowserRecentSites {
  sites: BrowserRecentSite[];
  nextExpiryAt: number | null;
}

export function resolveVisibleBrowserRecentSites(sites: BrowserRecentSite[], now: number): VisibleBrowserRecentSites {
  const visibleSites: BrowserRecentSite[] = [];
  let nextExpiryAt: number | null = null;

  for (const site of sites) {
    const visitedAt = Date.parse(site.visitedAt);
    const age = now - visitedAt;
    if (!Number.isFinite(visitedAt) || age < 0 || age >= BROWSER_RECENT_SITES_WINDOW_MS) continue;

    visibleSites.push(site);
    const expiryAt = visitedAt + BROWSER_RECENT_SITES_WINDOW_MS;
    if (nextExpiryAt === null || expiryAt < nextExpiryAt) nextExpiryAt = expiryAt;
  }

  return { sites: visibleSites, nextExpiryAt };
}
