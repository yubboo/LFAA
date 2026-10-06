import { load as loadYaml } from "js-yaml";

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RELEASE_FEED_SUFFIX = "/releases/latest/download";

export function compareStableVersions(left, right) {
  const leftParts = parseStableVersion(left);
  const rightParts = parseStableVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
}

export function normalizeReleaseFeedUrl(value) {
  if (typeof value !== "string") throw new Error("更新源地址缺失。");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("更新源地址不是有效 URL。");
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.search || url.hash) {
    throw new Error("更新源必须是无凭据、无查询参数的 HTTPS GitHub Releases 地址。");
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith(RELEASE_FEED_SUFFIX)) throw new Error("更新源必须指向 LFAA 的 latest/download 目录。");
  return `${url.origin}${path}`;
}

export function getLfaaUpdateManifestUrl(feedUrl) {
  const url = new URL(normalizeReleaseFeedUrl(feedUrl));
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/releases\/latest\/download$/);
  if (!match) throw new Error("更新源无法映射到 LFAA GitHub 仓库。");
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/main/update.json`;
}

export function getElectronUpdateFeedUrl(input) {
  let config;
  try {
    config = loadYaml(input);
  } catch {
    throw new Error("Electron app-update.yml 无法解析。");
  }
  if (!config || typeof config !== "object" || Array.isArray(config) || config.provider !== "generic") {
    throw new Error("Electron app-update.yml 必须配置 Generic 更新源。");
  }
  return normalizeReleaseFeedUrl(config.url);
}

export function validateLfaaUpdateManifest(input, expectedFeedUrl) {
  const manifest = typeof input === "string" ? JSON.parse(input) : input;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("更新清单必须是 JSON 对象。");
  if (manifest.schemaVersion !== 1) throw new Error("更新清单 schemaVersion 不受支持。");
  if (typeof manifest.enabled !== "boolean") throw new Error("更新清单 enabled 必须是布尔值。");
  if (manifest.channel !== "stable") throw new Error("当前桌面端只接受 stable 更新渠道。");
  parseStableVersion(manifest.version);
  parseStableVersion(manifest.minimumSupportedVersion);
  if (compareStableVersions(manifest.minimumSupportedVersion, manifest.version) > 0) {
    throw new Error("minimumSupportedVersion 不能高于清单版本。");
  }
  if (manifest.title !== `LFAA ${manifest.version}`) throw new Error("更新清单标题与 LFAA 版本不一致。");
  if (typeof manifest.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.publishedAt)
    || Number.isNaN(Date.parse(`${manifest.publishedAt}T00:00:00Z`))
    || new Date(`${manifest.publishedAt}T00:00:00Z`).toISOString().slice(0, 10) !== manifest.publishedAt) {
    throw new Error("更新清单 publishedAt 必须是有效的 YYYY-MM-DD 日期。");
  }
  if (!Array.isArray(manifest.releaseNotes) || manifest.releaseNotes.length < 1 || manifest.releaseNotes.length > 32
    || manifest.releaseNotes.some(note => typeof note !== "string" || !note.trim())
    || manifest.releaseNotes.reduce((total, note) => total + note.length, 0) > 12_000) {
    throw new Error("更新清单 releaseNotes 必须是 1 至 32 条非空文本，合计不超过 12000 字符。");
  }
  if (typeof manifest.mandatory !== "boolean") throw new Error("更新清单 mandatory 必须是布尔值。");

  const expectedFeed = normalizeReleaseFeedUrl(expectedFeedUrl);
  const manifestFeed = normalizeReleaseFeedUrl(manifest.feedUrl);
  if (manifestFeed !== expectedFeed) throw new Error("更新清单 feedUrl 与 Electron 安装包内的发布源不一致。");

  const feedUrl = new URL(expectedFeed);
  const repoPath = feedUrl.pathname.slice(0, -RELEASE_FEED_SUFFIX.length);
  const expectedReleasePage = `${feedUrl.origin}${repoPath}/releases`;
  if (manifest.releasePage !== expectedReleasePage) throw new Error("更新清单 releasePage 与 LFAA 发布源不一致。");

  return Object.freeze({
    schemaVersion: manifest.schemaVersion,
    enabled: manifest.enabled,
    channel: manifest.channel,
    version: manifest.version,
    title: manifest.title,
    publishedAt: manifest.publishedAt,
    releaseNotes: Object.freeze(manifest.releaseNotes.map(note => note.trim())),
    mandatory: manifest.mandatory,
    minimumSupportedVersion: manifest.minimumSupportedVersion,
    releasePage: expectedReleasePage,
    feedUrl: expectedFeed
  });
}

function parseStableVersion(value) {
  if (typeof value !== "string" || !STABLE_VERSION_PATTERN.test(value)) {
    throw new Error("更新版本必须使用稳定版 SemVer x.y.z 格式。");
  }
  const parts = value.split(".").map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) throw new Error("更新版本超出可识别范围。");
  return parts;
}
