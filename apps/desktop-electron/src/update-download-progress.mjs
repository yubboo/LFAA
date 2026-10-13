export function createInitialDesktopUpdateDownloadProgress(version) {
  return Object.freeze({
    version,
    phase: "starting",
    transferredBytes: 0,
    totalBytes: null,
    percent: null,
    bytesPerSecond: 0
  });
}

export function normalizeDesktopUpdateDownloadProgress(version, progress) {
  if (!version || !progress || typeof progress !== "object") return null;
  for (const value of [progress.transferred, progress.total, progress.percent, progress.bytesPerSecond]) {
    if (value !== undefined && value !== null && !Number.isFinite(Number(value))) return null;
  }
  const transferredBytes = finiteNonNegative(progress.transferred);
  const totalBytes = finitePositive(progress.total);
  if (transferredBytes === null || Number(progress.total) < 0 || Number(progress.bytesPerSecond) < 0) return null;

  const hasPercent = progress.percent !== undefined && progress.percent !== null;
  const rawPercent = Number(progress.percent);
  const derivedPercent = totalBytes === null ? null : transferredBytes / totalBytes * 100;
  const percent = hasPercent && Number.isFinite(rawPercent)
    ? Math.max(0, Math.min(100, rawPercent))
    : derivedPercent;

  return Object.freeze({
    version,
    phase: "downloading",
    transferredBytes,
    totalBytes,
    percent,
    bytesPerSecond: finiteNonNegative(progress.bytesPerSecond) ?? 0
  });
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
