/** 功能：经过来源、重定向、大小和摘要验证的下载器。作用：Java 与服务端核心共用，支持总时限与调用方取消。 */
import {createHash} from 'node:crypto';import {mkdir,open,rm} from 'node:fs/promises';import {dirname} from 'node:path';import {Transform} from 'node:stream';import {pipeline} from 'node:stream/promises';
const artifactHosts = new Set(["fill-data.papermc.io", "download.fastmirror.net", "mohistmc-build.cn-sy1.rains3.com", "maven.minecraftforge.net", "maven.neoforged.net", "cdn.azul.com", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"]);
export function isRetryableDownloadError(error) {
  for(let current=error,depth=0;current&&depth<5;current=current.cause,depth++) {
    if(current.name==="TypeError"||["ECONNRESET","ETIMEDOUT","EAI_AGAIN","ECONNREFUSED","UND_ERR_SOCKET"].includes(current.code))return true;
  }
  return false;
}
export function validateCoreArtifactDownload(artifact) {
  const url = new URL(artifact?.url);
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" || !artifactHosts.has(url.hostname)) throw new Error("核心工件来源未通过 HTTPS 白名单校验。");
  if (!["sha1", "sha256"].includes(artifact.algorithm) || !new RegExp(`^[a-f0-9]{${artifact.algorithm === "sha1" ? 40 : 64}}$`, "iu").test(artifact.digest)) throw new Error("核心工件缺少有效摘要。");
  return url;
}
/** 每次跳转重新校验 HTTPS 来源；摘要与体积均确认后才将下载文件提升为可执行工件。 */
export async function downloadCoreArtifact(artifact, destination, timeoutSeconds, progress, callerSignal, resourceFetch = globalThis.fetch) {
  validateCoreArtifactDownload(artifact);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 30 || timeoutSeconds > 7200) throw new Error("缺少有效的下载时限配置。");
  const signal = callerSignal ? AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutSeconds * 1000)]) : AbortSignal.timeout(timeoutSeconds * 1000);
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await downloadCoreArtifactAttempt(artifact, destination, signal, timeoutSeconds, progress, attempt, resourceFetch); }
    catch (error) {
      // 只重试同一摘要的只读工件下载，复用总时限；安装/配置/进程任务绝不在此重放。
      const cause = error.cause ?? error;
      if(callerSignal?.aborted) throw callerSignal.reason;
      if (signal.aborted) throw new Error(`工件下载超过已配置的 ${timeoutSeconds} 秒时限，未完成文件已清理。`, { cause: error });
      if (attempt === 1 && cause.name === "TypeError") throw new Error(`工件下载连接中断（${new URL(artifact.url).hostname}），请检查网络后恢复任务。`, { cause: error });
      if (attempt === 1 || !isRetryableDownloadError(error)) throw error;
    }
  }
}
async function downloadCoreArtifactAttempt(artifact, destination, signal, timeoutSeconds, progress, attempt, resourceFetch) {
  let url = validateCoreArtifactDownload(artifact);
  let response;
  for (let i = 0; i < 6; i++) {
    response = await resourceFetch(url, { redirect: "manual", signal, ...(attempt === 1 ? { headers: { Connection: "close" } } : {}) });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || i === 5) throw new Error("核心下载跳转无效或过多。");
    url = validateCoreArtifactDownload({ ...artifact, url: new URL(location, url).href });
  }
  if (!response?.ok || !response.body) {await response?.body?.cancel();throw new Error(`核心下载失败（${response?.status ?? "未知"}）。`);}
  const maximum = 1024 * 1024 * 1024, total = Number(response.headers.get("content-length") ?? 0);
  if (total > maximum) { await response.body.cancel(); throw new Error("核心工件超过 1 GiB 安全上限。"); }
  const hash = createHash(artifact.algorithm);
  let bytes = 0, last = 0, reporting = Promise.resolve();
  const verifier = new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    if (bytes > maximum) return done(new Error("核心工件超过 1 GiB 安全上限。"));
    hash.update(chunk);
    if (Date.now() - last > 1500) { last = Date.now(); const current = bytes; reporting = reporting.then(() => progress?.(current, total)); reporting.catch(() => {}); }
    done(null, chunk);
  } });
  await mkdir(dirname(destination), { recursive: true });
  // 先独占创建，失败时不删除其他任务或用户已经存在的文件。
  const file = await open(destination, "wx");
  try {
    await pipeline(response.body, verifier, file.createWriteStream(), {signal});
    await reporting;
    if (bytes === 0 || total > 0 && bytes !== total || hash.digest("hex") !== artifact.digest.toLowerCase()) throw new Error("核心工件的体积或摘要与来源不符，已拒绝使用。");
  } catch (error) {
    await file.close().catch(() => {}); await rm(destination, { force: true });
    if (signal.aborted) throw new Error(`工件下载超过已配置的 ${timeoutSeconds} 秒时限（${url.hostname}），未完成文件已清理。`, { cause: error });
    if (error?.message === "terminated" || error?.name === "TypeError") throw new Error(`工件下载连接中断（${url.hostname}），未完成文件已清理；请检查网络后恢复任务。`, { cause: error });
    throw error;
  }
  return bytes;
}
