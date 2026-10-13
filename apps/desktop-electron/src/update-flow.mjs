import { compareStableVersions } from "./update-manifest.mjs";

const TRANSIENT_UPDATE_ERROR_CODES = new Set([
  "ABORT_ERR", "ECONNABORTED", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN", "ENETUNREACH", "ETIMEDOUT",
  "ERR_CONNECTION_RESET", "ERR_CONNECTION_TIMED_OUT", "ERR_INTERNET_DISCONNECTED", "ERR_NAME_NOT_RESOLVED",
  "ERR_NETWORK", "ERR_PROXY_CONNECTION_FAILED", "ERR_TIMED_OUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"
]);

function getErrorCode(error) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if (typeof current.code === "string") return current.code.toUpperCase();
    current = current.cause;
  }
  return "";
}

function getErrorNames(error) {
  const names = [];
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if (typeof current.name === "string" && current.name) names.push(current.name);
    current = current.cause;
  }
  return names;
}

function hasErrorName(error, ...expectedNames) {
  const names = getErrorNames(error);
  return expectedNames.some(name => names.includes(name));
}

function getHttpStatusCode(error) {
  const directStatus = Number(error?.statusCode ?? error?.status);
  if (Number.isInteger(directStatus) && directStatus >= 400 && directStatus <= 599) return directStatus;

  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/\b(?:HttpError|HTTPError)\s*:\s*(\d{3})\b|\bHTTP\s+(\d{3})\b/i);
  const parsedStatus = Number(match?.[1] ?? match?.[2]);
  return Number.isInteger(parsedStatus) && parsedStatus >= 400 && parsedStatus <= 599 ? parsedStatus : null;
}

export function getDesktopUpdateErrorMessage(error, phase) {
  const statusCode = getHttpStatusCode(error);
  const code = getErrorCode(error);
  if (statusCode === 404) return "官方更新文件尚未发布或暂时不可用（HTTP 404），请稍后重试。";
  if (statusCode === 403) return "GitHub 暂时拒绝了更新请求（HTTP 403），请检查发布源是否公开后重试。";
  if (statusCode === 429) return "GitHub 更新请求过于频繁（HTTP 429），请稍后重试。";
  if (statusCode === 408 || statusCode === 425) return "GitHub 更新服务暂时没有及时响应，请稍后重试。";
  if (statusCode !== null && statusCode >= 500) return `GitHub 更新服务暂时不可用（HTTP ${statusCode}），请稍后重试。`;
  if (hasErrorName(error, "AbortError", "TimeoutError") || code.includes("TIMEOUT") || code === "ETIMEDOUT") {
    return phase === "download" ? "下载更新连接超时，请检查网络后重试。" : "连接更新服务超时，已自动重试；请稍后再检查。";
  }
  if (["ECONNRESET", "ECONNREFUSED", "ENETUNREACH", "EAI_AGAIN", "ERR_CONNECTION_RESET", "ERR_INTERNET_DISCONNECTED", "ERR_NAME_NOT_RESOLVED", "ERR_NETWORK", "ERR_PROXY_CONNECTION_FAILED"].includes(code)) {
    return phase === "download" ? "下载更新时网络连接中断，请检查网络后重试。" : "暂时无法连接更新服务，已自动重试；请检查网络后再检查。";
  }
  if (phase === "download") return "下载更新失败，请检查网络后重试。";
  if (error instanceof SyntaxError) return "官方更新清单格式无效，暂时无法检查更新。";
  const message = error instanceof Error ? error.message : "";
  if (/更新清单|release feed/i.test(message)) return "官方更新清单或发布文件无效，暂时无法检查更新。";
  return "更新检查没有完成（未知网络或发布源错误），请稍后重试。";
}

export function getDesktopUpdateErrorDiagnostic(error, phase, step = "") {
  const statusCode = getHttpStatusCode(error);
  const code = getErrorCode(error);
  const message = error instanceof Error ? error.message : "";
  const reason = statusCode !== null ? `HTTP ${statusCode}`
    : hasErrorName(error, "AbortError", "TimeoutError") || code.includes("TIMEOUT") ? "请求超时"
    : TRANSIENT_UPDATE_ERROR_CODES.has(code) ? code
        : /更新清单|release feed/i.test(message) ? "发布清单校验失败"
          : error instanceof SyntaxError ? "清单解析失败"
            : "未知错误";
  const phaseLabel = phase === "download" ? "下载" : "检查";
  return [phaseLabel, step, reason].filter(Boolean).join(" / ");
}

function isTransientCheckFailure(error) {
  const statusCode = getHttpStatusCode(error);
  if (statusCode !== null) return statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500;
  if (TRANSIENT_UPDATE_ERROR_CODES.has(getErrorCode(error))) return true;
  if (hasErrorName(error, "AbortError", "TimeoutError")) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /fetch failed|network error|net::err_(?:address_unreachable|connection_reset|connection_timed_out|internet_disconnected|name_not_resolved|network_changed|proxy_connection_failed|timed_out)/iu.test(message);
}

async function retryTransientCheck(action, waitBeforeRetry) {
  try {
    return await action();
  } catch (error) {
    if (!isTransientCheckFailure(error)) throw error;
    await waitBeforeRetry(650);
    return action();
  }
}

export function createDesktopUpdateFlow({
  isSupported,
  getCurrentVersion,
  readManifest,
  checkReleaseFeed,
  promptForUpdate,
  beginDownload,
  getPreferences = async () => ({ autoDownloadAndInstall: false, ignoredVersion: "" }),
  ignoreVersion = async () => {},
  isDownloadCancelled = () => false,
  onDownloadCancelled = () => {},
  onUpdateAvailable = () => {},
  onError = () => {},
  waitBeforeRetry = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  compareVersions = compareStableVersions
}) {
  let inFlightCheck = null;
  let downloadingVersion = "";
  let downloadedVersion = "";
  let deferredVersion = "";
  let promptingManifest = null;

  function reportError(error, phase, manifest = null, step = "") {
    try {
      const safeMessage = getDesktopUpdateErrorMessage(error, phase);
      const diagnostic = getDesktopUpdateErrorDiagnostic(error, phase, step);
      void Promise.resolve(onError(error, phase, manifest, safeMessage, diagnostic)).catch(() => {});
    } catch {
      // Diagnostic handlers must not replace the real updater result.
    }
  }

  function result(status, currentVersion, manifest = null, message = undefined) {
    return {
      status,
      currentVersion,
      ...(manifest ? { latestVersion: manifest.version, releaseNotes: manifest.releaseNotes } : {}),
      ...(message ? { message } : {})
    };
  }

  async function check({ manual = false } = {}) {
    const currentVersion = getCurrentVersion();
    if (!isSupported()) return result("unsupported", currentVersion);
    if (downloadedVersion) return { status: "downloaded", currentVersion, latestVersion: downloadedVersion };
    if (downloadingVersion) return { status: "downloading", currentVersion, latestVersion: downloadingVersion };
    if (promptingManifest) return result("available", currentVersion, promptingManifest);
    if (inFlightCheck) return inFlightCheck;

    function startDownload(manifest, preferences) {
      downloadingVersion = manifest.version;
      try {
        Promise.resolve(beginDownload(manifest, { automaticInstall: preferences?.autoDownloadAndInstall === true })).catch(error => {
          if (downloadingVersion === manifest.version) downloadingVersion = "";
          if (isDownloadCancelled(error)) {
            try { onDownloadCancelled(manifest); } catch { /* Cancellation cleanup must not hide the user decision. */ }
            return;
          }
          reportError(error, "download", manifest);
        });
      } catch (error) {
        downloadingVersion = "";
        reportError(error, "download", manifest);
        return result("error", currentVersion, manifest, getDesktopUpdateErrorMessage(error, "download"));
      }
      deferredVersion = "";
      return result("downloading", currentVersion, manifest);
    }

    function promptForDecision(manifest, preferences, mustInstall) {
      promptingManifest = manifest;
      void (async () => {
        try {
          const decision = await promptForUpdate(manifest, { mustInstall, manual });
          if (decision === "skip" && !mustInstall) {
            await ignoreVersion(manifest.version);
            deferredVersion = "";
            onUpdateAvailable(null);
            return;
          }
          if (decision !== "accept") {
            deferredVersion = manifest.version;
            return;
          }
          startDownload(manifest, preferences);
        } catch (error) {
          reportError(error, "check", manifest, "更新提示");
        } finally {
          if (promptingManifest?.version === manifest.version) promptingManifest = null;
        }
      })();
      return result("available", currentVersion, manifest);
    }

    const request = (async () => {
      let manifest = null;
      let checkStep = "官方版本清单";
      try {
        manifest = await retryTransientCheck(readManifest, waitBeforeRetry);
        if (!manifest.enabled) {
          onUpdateAvailable(null);
          return result("disabled", currentVersion, manifest);
        }
        if (compareVersions(manifest.version, currentVersion) <= 0) {
          onUpdateAvailable(null);
          return result("up-to-date", currentVersion, manifest);
        }
        const preferences = await getPreferences();
        if (preferences?.ignoredVersion === manifest.version) {
          onUpdateAvailable(null);
          return result("ignored", currentVersion, manifest);
        }
        if (deferredVersion === manifest.version) {
          return result("deferred", currentVersion, manifest);
        }

        checkStep = "GitHub Release 文件";
        const release = await retryTransientCheck(checkReleaseFeed, waitBeforeRetry);
        if (!release?.isUpdateAvailable || release.updateInfo?.version !== manifest.version) {
          const message = "更新清单与 Release feed 版本不一致，已阻止下载。";
          const error = new Error(message);
          reportError(error, "check", manifest, checkStep);
          return result("error", currentVersion, manifest, message);
        }

        onUpdateAvailable(manifest);
        const mustInstall = manifest.mandatory
          && compareVersions(currentVersion, manifest.minimumSupportedVersion) < 0;
        if (!preferences?.autoDownloadAndInstall) return promptForDecision(manifest, preferences, mustInstall);
        return startDownload(manifest, preferences);
      } catch (error) {
        reportError(error, "check", manifest, checkStep);
        return result("error", currentVersion, manifest, getDesktopUpdateErrorMessage(error, "check"));
      }
    })();

    inFlightCheck = request;
    try {
      return await request;
    } finally {
      if (inFlightCheck === request) inFlightCheck = null;
    }
  }

  function markDownloaded(version) {
    if (!version || version !== downloadingVersion) return false;
    downloadedVersion = version;
    downloadingVersion = "";
    return true;
  }

  function markDownloadFailed(version) {
    if (!version || version !== downloadingVersion) return false;
    downloadingVersion = "";
    return true;
  }

  return Object.freeze({ check, markDownloaded, markDownloadFailed });
}
