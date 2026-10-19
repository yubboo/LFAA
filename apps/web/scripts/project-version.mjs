const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const RELEASE_FEED_SUFFIX = "/releases/latest/download";

export function createProjectBuildMetadata({ projectPackage, webPackage, electronPackage, releaseManifest }) {
  const currentVersion = readStableVersion(projectPackage?.version, "apps/cli/package.json");
  for (const [manifest, label] of [
    [webPackage, "apps/web/package.json"],
    [electronPackage, "apps/desktop-electron/package.json"]
  ]) {
    if (readStableVersion(manifest?.version, label) !== currentVersion) {
      throw new Error(`项目版本不一致：${label} 必须与 apps/cli/package.json 同为 ${currentVersion}。`);
    }
  }

  const repositoryUrl = projectPackage?.repository?.url;
  if (typeof repositoryUrl !== "string") throw new Error("apps/cli/package.json 缺少 LFAA 仓库地址。");
  let parsedRepositoryUrl;
  try {
    parsedRepositoryUrl = new URL(repositoryUrl.startsWith("git+") ? repositoryUrl.slice(4) : repositoryUrl);
  } catch {
    throw new Error("apps/cli/package.json 中的 LFAA 仓库地址无效。");
  }
  const repositoryParts = parsedRepositoryUrl.pathname.split("/").filter(Boolean);
  if (parsedRepositoryUrl.protocol !== "https:" || parsedRepositoryUrl.hostname !== "github.com"
    || parsedRepositoryUrl.username || parsedRepositoryUrl.password || parsedRepositoryUrl.search || parsedRepositoryUrl.hash
    || repositoryParts.length !== 2 || !/^[A-Za-z0-9_.-]+$/u.test(repositoryParts[0])
    || !/^[A-Za-z0-9_.-]+(?:\.git)?$/u.test(repositoryParts[1])) {
    throw new Error("LFAA 仓库地址必须是 GitHub 上的 HTTPS owner/repository 地址。");
  }

  const [owner, repositoryWithSuffix] = repositoryParts;
  const repository = repositoryWithSuffix.replace(/\.git$/u, "");
  if (!repository) throw new Error("LFAA 仓库名称缺失。");
  const releasePage = `https://github.com/${owner}/${repository}/releases`;
  const feedUrl = `https://github.com/${owner}/${repository}${RELEASE_FEED_SUFFIX}/`;
  const announcement = readReleaseAnnouncement(releaseManifest, currentVersion);

  return Object.freeze({
    currentVersion,
    publishedAt: announcement.publishedAt,
    releaseNotes: announcement.releaseNotes,
    updateManifestUrl: `https://raw.githubusercontent.com/${owner}/${repository}/main/update.json`,
    feedUrl,
    releasePage
  });
}

function readReleaseAnnouncement(manifest, currentVersion) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)
    || manifest.version !== currentVersion || manifest.title !== `LFAA ${currentVersion}`) {
    throw new Error("update.json 必须提供与当前产品版本一致的公告内容。");
  }
  const publishedAt = manifest.publishedAt;
  if (typeof publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(publishedAt)
    || Number.isNaN(Date.parse(`${publishedAt}T00:00:00Z`))
    || new Date(`${publishedAt}T00:00:00Z`).toISOString().slice(0, 10) !== publishedAt) {
    throw new Error("update.json 公告发布日期无效。");
  }
  const releaseNotes = manifest.releaseNotes;
  if (!Array.isArray(releaseNotes) || releaseNotes.length < 1 || releaseNotes.length > 32
    || releaseNotes.some(note => typeof note !== "string" || !note.trim())
    || releaseNotes.reduce((total, note) => total + note.length, 0) > 12_000) {
    throw new Error("update.json 公告内容必须是 1 至 32 条非空文本，合计不超过 12000 字符。");
  }
  return Object.freeze({ publishedAt, releaseNotes: Object.freeze(releaseNotes.map(note => note.trim())) });
}

function readStableVersion(value, label) {
  if (typeof value !== "string" || !STABLE_VERSION_PATTERN.test(value)
    || value.split(".").some((part) => !Number.isSafeInteger(Number(part)))) {
    throw new Error(`${label} 必须声明稳定版 x.y.z 项目版本。`);
  }
  return value;
}
