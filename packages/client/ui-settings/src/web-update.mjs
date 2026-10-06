const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const RELEASE_FEED_SUFFIX = "/releases/latest/download";
const MAX_RELEASE_NOTES = 32;
const MAX_RELEASE_NOTES_LENGTH = 12_000;

export function inspectWebUpdateManifest(input, { currentVersion, expectedFeedUrl, expectedReleasePage }) {
  const currentParts = parseStableVersion(currentVersion, "当前项目版本");
  const expectedFeed = normalizeReleaseFeedUrl(expectedFeedUrl);
  const expectedPage = normalizeReleasePage(expectedReleasePage);
  if (releasePageForFeed(expectedFeed) !== expectedPage) throw new Error("构建时的 LFAA 发布页与更新源不匹配。");

  let manifest = input;
  if (typeof input === "string") {
    try {
      manifest = JSON.parse(input);
    } catch {
      throw new Error("官方更新清单不是有效 JSON。");
    }
  }
  if (!isRecord(manifest)) throw new Error("官方更新清单必须是 JSON 对象。");
  if (manifest.schemaVersion !== 1) throw new Error("官方更新清单 schemaVersion 不受支持。");
  if (typeof manifest.enabled !== "boolean") throw new Error("官方更新清单 enabled 字段无效。");
  if (manifest.channel !== "stable") throw new Error("官方更新清单不是 stable 稳定渠道。");

  const latestParts = parseStableVersion(manifest.version, "清单版本");
  const minimumParts = parseStableVersion(manifest.minimumSupportedVersion, "最低支持版本");
  if (compareVersionParts(minimumParts, latestParts) > 0) throw new Error("最低支持版本不能高于清单版本。");
  if (manifest.title !== `LFAA ${manifest.version}`) throw new Error("更新清单标题与 LFAA 版本不一致。");
  if (!isValidDate(manifest.publishedAt)) throw new Error("更新清单发布日期无效。");
  if (!Array.isArray(manifest.releaseNotes) || manifest.releaseNotes.length < 1
    || manifest.releaseNotes.length > MAX_RELEASE_NOTES
    || manifest.releaseNotes.some((note) => typeof note !== "string" || !note.trim())
    || manifest.releaseNotes.reduce((total, note) => total + note.length, 0) > MAX_RELEASE_NOTES_LENGTH) {
    throw new Error("更新清单更新说明格式无效。");
  }
  if (typeof manifest.mandatory !== "boolean") throw new Error("更新清单 mandatory 字段无效。");
  if (normalizeReleaseFeedUrl(manifest.feedUrl) !== expectedFeed) throw new Error("更新清单发布源与 LFAA 官方源不一致。");
  if (normalizeReleasePage(manifest.releasePage) !== expectedPage) throw new Error("更新清单发布页与 LFAA 官方仓库不一致。");

  const latestVersion = manifest.version;
  const status = !manifest.enabled ? "disabled"
    : compareVersionParts(latestParts, currentParts) > 0 ? "available" : "up-to-date";
  return Object.freeze({
    status,
    currentVersion,
    latestVersion,
    publishedAt: manifest.publishedAt,
    releaseNotes: Object.freeze(manifest.releaseNotes.map((note) => note.trim())),
    mandatory: manifest.mandatory,
    minimumSupportedVersion: manifest.minimumSupportedVersion,
    releasePage: expectedPage
  });
}

function parseStableVersion(value, label) {
  if (typeof value !== "string" || !STABLE_VERSION_PATTERN.test(value)) {
    throw new Error(`${label}必须使用稳定版 x.y.z 格式。`);
  }
  const parts = value.split(".").map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) throw new Error(`${label}超出可识别范围。`);
  return parts;
}

function compareVersionParts(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function normalizeReleaseFeedUrl(value) {
  const url = parseGithubUrl(value, "更新源");
  const path = url.pathname.replace(/\/+$/u, "");
  if (!path.endsWith(RELEASE_FEED_SUFFIX)) throw new Error("更新源不是 LFAA GitHub Releases latest/download 地址。");
  return `${url.origin}${path}`;
}

function normalizeReleasePage(value) {
  const url = parseGithubUrl(value, "发布页");
  const path = url.pathname.replace(/\/+$/u, "");
  if (!/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases$/u.test(path)) {
    throw new Error("发布页不是有效的 LFAA GitHub Releases 地址。");
  }
  return `${url.origin}${path}`;
}

function parseGithubUrl(value, label) {
  if (typeof value !== "string") throw new Error(`${label}地址无效。`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}地址无效。`);
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label}必须是无凭据的 HTTPS GitHub 地址。`);
  }
  return url;
}

function releasePageForFeed(feedUrl) {
  const url = new URL(feedUrl);
  const repositoryPath = url.pathname.slice(0, -RELEASE_FEED_SUFFIX.length);
  return `${url.origin}${repositoryPath}/releases`;
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
