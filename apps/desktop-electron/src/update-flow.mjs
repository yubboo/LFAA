import { compareStableVersions } from "./update-manifest.mjs";

export function createDesktopUpdateFlow({
  isSupported,
  getCurrentVersion,
  readManifest,
  checkReleaseFeed,
  promptForUpdate,
  beginDownload,
  onError = () => {},
  compareVersions = compareStableVersions
}) {
  let inFlightCheck = null;
  let downloadingVersion = "";
  let downloadedVersion = "";
  let deferredVersion = "";

  function reportError(error, phase, manifest = null) {
    try {
      void Promise.resolve(onError(error, phase, manifest)).catch(() => {});
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
    if (inFlightCheck) return inFlightCheck;

    const request = (async () => {
      let manifest = null;
      try {
        manifest = await readManifest();
        if (!manifest.enabled) return result("disabled", currentVersion, manifest);
        if (compareVersions(manifest.version, currentVersion) <= 0) {
          return result("up-to-date", currentVersion, manifest);
        }
        if (!manual && deferredVersion === manifest.version) {
          return result("deferred", currentVersion, manifest);
        }

        const release = await checkReleaseFeed();
        if (!release?.isUpdateAvailable || release.updateInfo?.version !== manifest.version) {
          throw new Error(`更新清单版本 ${manifest.version} 与 Release feed 当前可用版本不一致，未开始下载。`);
        }

        const mustInstall = manifest.mandatory
          && compareVersions(currentVersion, manifest.minimumSupportedVersion) < 0;
        const decision = await promptForUpdate(manifest, { mustInstall, manual });
        if (decision !== "accept") {
          deferredVersion = manifest.version;
          return result("deferred", currentVersion, manifest);
        }

        downloadingVersion = manifest.version;
        try {
          Promise.resolve(beginDownload(manifest)).catch(error => {
            if (downloadingVersion === manifest.version) downloadingVersion = "";
            reportError(error, "download", manifest);
          });
        } catch (error) {
          downloadingVersion = "";
          reportError(error, "download", manifest);
          return result("error", currentVersion, manifest, error instanceof Error ? error.message : String(error));
        }
        deferredVersion = "";
        return result("downloading", currentVersion, manifest);
      } catch (error) {
        reportError(error, "check", manifest);
        return result("error", currentVersion, manifest, error instanceof Error ? error.message : String(error));
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
