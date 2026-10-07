import { compareStableVersions } from "./update-manifest.mjs";

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
  if (statusCode === 404) return "官方更新文件尚未发布或暂时不可用（HTTP 404），请稍后重试。";
  if (phase === "download") return "下载更新失败，请检查网络后重试。";
  return "检查更新失败，请稍后重试。";
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
  onUpdateAvailable = () => {},
  onError = () => {},
  compareVersions = compareStableVersions
}) {
  let inFlightCheck = null;
  let downloadingVersion = "";
  let downloadedVersion = "";
  let deferredVersion = "";
  let promptingManifest = null;

  function reportError(error, phase, manifest = null) {
    try {
      const safeMessage = getDesktopUpdateErrorMessage(error, phase);
      void Promise.resolve(onError(error, phase, manifest, safeMessage)).catch(() => {});
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
          reportError(error, "check", manifest);
        } finally {
          if (promptingManifest?.version === manifest.version) promptingManifest = null;
        }
      })();
      return result("available", currentVersion, manifest);
    }

    const request = (async () => {
      let manifest = null;
      try {
        manifest = await readManifest();
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

        const release = await checkReleaseFeed();
        if (!release?.isUpdateAvailable || release.updateInfo?.version !== manifest.version) {
          const message = "更新清单与 Release feed 版本不一致，已阻止下载。";
          const error = new Error(message);
          reportError(error, "check", manifest);
          return result("error", currentVersion, manifest, message);
        }

        onUpdateAvailable(manifest);
        const mustInstall = manifest.mandatory
          && compareVersions(currentVersion, manifest.minimumSupportedVersion) < 0;
        if (!preferences?.autoDownloadAndInstall) return promptForDecision(manifest, preferences, mustInstall);
        return startDownload(manifest, preferences);
      } catch (error) {
        reportError(error, "check", manifest);
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
