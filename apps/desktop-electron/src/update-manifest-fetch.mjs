import { getLfaaUpdateManifestUrl, validateLfaaUpdateManifest } from "./update-manifest.mjs";

export async function fetchLfaaUpdateManifest(fetchImpl, feedUrl, { timeoutMs = 8_000 } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("更新清单请求器不可用。");
  const manifestUrl = getLfaaUpdateManifestUrl(feedUrl);
  const response = await fetchImpl(manifestUrl, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response?.ok) throw new Error(`更新清单请求失败，HTTP ${Number(response?.status) || 0}。`);

  let finalUrl;
  try {
    finalUrl = new URL(response.url);
  } catch {
    throw new Error("更新清单响应 URL 无效。");
  }
  const expectedUrl = new URL(manifestUrl);
  if (finalUrl.protocol !== "https:" || finalUrl.origin !== expectedUrl.origin || finalUrl.pathname !== expectedUrl.pathname) {
    throw new Error("更新清单发生了非预期的主机或路径跳转。");
  }
  return validateLfaaUpdateManifest(await response.text(), feedUrl);
}
