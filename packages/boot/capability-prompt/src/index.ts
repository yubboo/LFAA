/**
 * 功能：将 GitHub Markdown 提示词接入账户设置与 AI Work 按需加载。
 * 作用：固定提交和文本摘要后登记到单一 App，并由设置 Owner 回读验证。
 * 关联文件：capability-installs、plugin-manager/github-source.ts、settings/service.ts、core/tools/business-tools.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { createHash } from "node:crypto";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { CapabilityInstallAdapter, CapabilityInstallRegistry } from "lfaa-capability-installs/src/index.js";
import { installUserCapabilityPrompt, getUserSettings, removeUserCapabilityPrompt, setUserCapabilityPromptEnabled, type UserCapabilityPrompt } from "lfaa-settings/src/service.js";
import { downloadGithubSnapshot, searchGithubRepositories } from "lfaa-plugin-manager/src/github-source.js";
import type { PluginArchiveFile } from "lfaa-plugin-manager/src/zip-archive.js";

const maximumPromptBytes = 24 * 1024;
const maximumPromptPath = 512;
const excludedPromptNames = new Set(["readme.md", "skill.md", "license.md", "licence.md", "contributing.md", "changelog.md", "code_of_conduct.md", "security.md"]);

interface PromptDetails {
  id: string;
  name: string;
  description: string;
  applicationId: ApplicationId;
  sourceRepository: string;
  sourcePath: string;
  license: string | null;
  commit: string;
  archiveSha256: string;
  contentSha256: string;
  contentBytes: number;
  untrustedPreview: string;
}

export interface PromptAdapterDependencies {
  searchRepositories?: typeof searchGithubRepositories;
  downloadSnapshot?: typeof downloadGithubSnapshot;
  getSettings?: typeof getUserSettings;
  installPrompt?: typeof installUserCapabilityPrompt;
  setPromptEnabled?: typeof setUserCapabilityPromptEnabled;
  removePrompt?: typeof removeUserCapabilityPrompt;
}

export function createPromptAdapter(dependencies: PromptAdapterDependencies = {}): CapabilityInstallAdapter {
  const search = dependencies.searchRepositories ?? searchGithubRepositories;
  const download = dependencies.downloadSnapshot ?? downloadGithubSnapshot;
  const readSettings = dependencies.getSettings ?? getUserSettings;
  const installPrompt = dependencies.installPrompt ?? installUserCapabilityPrompt;
  const setPromptEnabled = dependencies.setPromptEnabled ?? setUserCapabilityPromptEnabled;
  const removePrompt = dependencies.removePrompt ?? removeUserCapabilityPrompt;
  return {
    kind: "prompt",
    applicationIds: [...APPLICATION_IDS],
    targetSchema: {
      type: "object",
      properties: { sourcePath: { type: "string", minLength: 1, maxLength: maximumPromptPath } },
      additionalProperties: false
    },
    targetDescription: "提示词来源是 GitHub 仓库中的单个 Markdown 文件；多候选时先从检查结果选择 sourcePath 并重新检查。安装范围仅为当前目标 App。",
    validateTarget(target) {
      const input = target === undefined ? {} : asRecord(target, "Prompt target");
      if (Object.keys(input).some(key => key !== "sourcePath")) throw new Error("提示词 target 只允许仓库内相对 Markdown 文件路径 sourcePath。");
      return input.sourcePath === undefined ? {} : { sourcePath: normalizePromptPath(input.sourcePath) };
    },
    revalidateTarget(target) {
      if (Object.keys(target).some(key => key !== "sourcePath")) throw new Error("提示词检查目标字段无效。");
      return target.sourcePath === undefined ? {} : { sourcePath: normalizePromptPath(target.sourcePath) };
    },
    targetSummary(target) { return typeof target.sourcePath === "string" ? `当前 App · ${target.sourcePath}` : "当前 App · 待选提示词文件"; },
    async search(query) {
      const candidates = await search(query);
      return { candidates: candidates.map(item => ({ ...item, sourceType: "github", requiresInspection: true, warning: item.license ? "候选尚未检查；只读取所选 Markdown，不执行仓库代码。" : "仓库未声明许可证；安装前应由你确认来源许可。" })) };
    },
    async inspect(source, ref, applicationId, target) {
      const snapshot = await download(source, ref);
      const candidates = findPromptFiles(snapshot.files);
      const requestedPath = typeof target.sourcePath === "string" ? target.sourcePath : undefined;
      if (requestedPath === undefined && candidates.length > 1) throw new Error(`仓库包含多个 Markdown 提示词候选；请从下列文件选择一个并在 target.sourcePath 中指定后重新检查：${candidates.join("、")}`);
      const sourcePath = requestedPath ?? candidates[0];
      const file = sourcePath ? candidates.includes(sourcePath) ? snapshot.files.find(item => item.path === sourcePath) : undefined : undefined;
      if (!file) throw new Error(requestedPath ? `检查快照中未找到受支持的提示词文件：${requestedPath}` : "固定仓库快照中未发现可安装的 Markdown 提示词。");
      const parsed = parsePromptFile(file);
      const id = makePromptId(snapshot.repository.url, sourcePath, applicationId);
      const details: PromptDetails = {
        id,
        name: parsed.name,
        description: parsed.description,
        applicationId,
        sourceRepository: snapshot.repository.url,
        sourcePath,
        license: snapshot.repository.license,
        commit: snapshot.commit,
        archiveSha256: snapshot.archiveSha256,
        contentSha256: sha256(parsed.content),
        contentBytes: Buffer.byteLength(parsed.content, "utf8"),
        untrustedPreview: parsed.content.slice(0, 1200)
      };
      return {
        resolvedRef: snapshot.commit,
        resolvedTarget: { sourcePath },
        summary: `${parsed.name} · ${applicationId} · 许可证 ${snapshot.repository.license ?? "未声明"}`,
        details: { prompt: details }
      };
    },
    async install(source, resolvedRef, applicationId, userId, target, details) {
      const plan = parsePromptDetails(details, resolvedRef, applicationId);
      if (target.sourcePath !== plan.sourcePath) throw new Error("提示词文件与检查凭证的目标路径不一致；没有登记。");
      const snapshot = await download(source, resolvedRef);
      if (snapshot.commit !== resolvedRef || snapshot.archiveSha256 !== plan.archiveSha256) throw new Error("固定提交的源码归档摘要与检查结果不同；没有登记提示词。");
      const file = snapshot.files.find(item => item.path === plan.sourcePath);
      if (!file) throw new Error("固定版本中已不存在检查时选定的提示词文件；没有登记。");
      const parsed = parsePromptFile(file);
      if (parsed.name !== plan.name || parsed.description !== plan.description || sha256(parsed.content) !== plan.contentSha256 || Buffer.byteLength(parsed.content, "utf8") !== plan.contentBytes) {
        throw new Error("固定版本中的提示词内容与检查摘要不同；没有登记。");
      }
      const entry: UserCapabilityPrompt = {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        applicationId,
        sourceRepository: plan.sourceRepository,
        sourcePath: plan.sourcePath,
        license: plan.license,
        commit: resolvedRef,
        archiveSha256: plan.archiveSha256,
        contentSha256: plan.contentSha256,
        content: parsed.content,
        enabled: true,
        createdAt: new Date().toISOString()
      };
      const stored = installPrompt(userId, entry);
      return { id: stored.id, name: stored.name, applicationId, source: { repository: stored.sourceRepository, path: stored.sourcePath, commit: stored.commit, archiveSha256: stored.archiveSha256, contentSha256: stored.contentSha256, license: stored.license } };
    },
    async verifyInstalled(installation, _source, resolvedRef, applicationId, _target, details, context) {
      const plan = parsePromptDetails(details, resolvedRef, applicationId);
      const currentSettings = readSettings(context.userId);
      const prompt = currentSettings.plugins.prompts?.find(item => item.id === plan.id && item.applicationId === applicationId);
      if (!isRecord(installation) || installation.id !== plan.id || !prompt || prompt.commit !== resolvedRef || prompt.contentSha256 !== plan.contentSha256) {
        return { status: "unknown", verified: false, summary: "设置 Owner 未能回读相同账户、App 与内容摘要的提示词记录。" };
      }
      if (!prompt.enabled || !currentSettings.plugins.enabled) {
        return { status: "installed", verified: true, summary: "提示词已登记到目标 App，但逐条状态或 AI 扩展总开关未启用。" };
      }
      return { status: "ready", verified: true, summary: `设置 Owner 已在 ${applicationId} App 核对提示词 ${prompt.name}；Agent 可按需加载。`, details: { id: prompt.id, contentSha256: prompt.contentSha256, enabled: true } };
    },
    async list(applicationId, _target, context) {
      return (readSettings(context.userId).plugins.prompts ?? []).filter(item => item.applicationId === applicationId).map(({ content: _content, ...item }) => item);
    },
    async setEnabled(id, enabled, applicationId, _target, context) {
      const prompt = setPromptEnabled(context.userId, id, applicationId, enabled);
      return { id: prompt.id, applicationId, enabled: prompt.enabled };
    },
    async remove(id, applicationId, _target, context) {
      const prompt = removePrompt(context.userId, id, applicationId);
      return { id: prompt.id, applicationId, removed: true };
    }
  };
}

function findPromptFiles(files: PluginArchiveFile[]): string[] {
  return files.filter(file => {
    const leaf = file.path.split("/").at(-1)?.toLocaleLowerCase("en-US") ?? "";
    if (excludedPromptNames.has(leaf)) return false;
    return leaf.endsWith(".prompt.md") || leaf.endsWith(".md");
  }).map(file => file.path).sort((a, b) => a.localeCompare(b)).slice(0, 256);
}

function parsePromptFile(file: PluginArchiveFile): { name: string; description: string; content: string } {
  if (!file.path.toLocaleLowerCase("en-US").endsWith(".md") || file.contents.length > maximumPromptBytes || file.contents.includes(0)) throw new Error("提示词只支持不超过 24 KiB 的 UTF-8 Markdown 文本。");
  let markdown: string;
  try { markdown = new TextDecoder("utf-8", { fatal: true }).decode(file.contents); }
  catch { throw new Error("提示词不是有效 UTF-8 文本；没有创建安装凭证。"); }
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  const metadata = frontmatter?.[1] ?? "";
  const name = metadata.match(/^name:\s*["']?([^"'\r\n#]+?)["']?\s*$/mu)?.[1]?.trim()
    ?? file.path.split("/").at(-1)!.replace(/\.prompt\.md$|\.md$/iu, "").replace(/[-_]+/gu, " ").slice(0, 120);
  const description = metadata.match(/^description:\s*["']?([^"'\r\n#]+?)["']?\s*$/mu)?.[1]?.trim() ?? "";
  const content = (frontmatter ? markdown.slice(frontmatter[0].length) : markdown).trim();
  if (!name || name.length > 120 || description.length > 500 || !content || Buffer.byteLength(content, "utf8") > maximumPromptBytes) throw new Error("Markdown 必须包含可用提示词正文；名称、说明和正文均受长度限制。");
  return { name: safeText(name, 120), description: safeText(description, 500), content };
}

function parsePromptDetails(value: unknown, resolvedRef: string, applicationId: ApplicationId): PromptDetails {
  if (!isRecord(value) || !isRecord(value.prompt)) throw new Error("提示词检查详情无效；没有登记。");
  const prompt = value.prompt as unknown as PromptDetails;
  if (prompt.applicationId !== applicationId || prompt.commit !== resolvedRef || !/^[a-f0-9]{40}$/iu.test(resolvedRef)
    || typeof prompt.id !== "string" || !/^prompt-[a-f0-9]{20}$/u.test(prompt.id)
    || typeof prompt.name !== "string" || typeof prompt.description !== "string"
    || typeof prompt.sourceRepository !== "string" || typeof prompt.sourcePath !== "string"
    || !(typeof prompt.license === "string" || prompt.license === null)
    || typeof prompt.archiveSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(prompt.archiveSha256)
    || typeof prompt.contentSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(prompt.contentSha256)
    || typeof prompt.contentBytes !== "number" || prompt.contentBytes < 1 || prompt.contentBytes > maximumPromptBytes) {
    throw new Error("提示词来源、App 或内容摘要与固定检查凭证不匹配；没有登记。");
  }
  return prompt;
}

function normalizePromptPath(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximumPromptPath || value.startsWith("/") || value.includes("\\")) throw new Error("sourcePath 必须是仓库内的相对 Markdown 文件路径。");
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) throw new Error("sourcePath 含有无效或越界路径段。");
  return parts.join("/");
}

function makePromptId(repository: string, sourcePath: string, applicationId: ApplicationId): string {
  return `prompt-${createHash("sha256").update(`${repository}\0${sourcePath}\0${applicationId}`).digest("hex").slice(0, 20)}`;
}

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function safeText(value: string, limit: number): string { return value.replace(/[\r\n\0]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function asRecord(value: unknown, name: string): Record<string, unknown> { if (!isRecord(value)) throw new Error(`${name} 必须是 JSON 对象。`); return value; }

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaCapabilityInstalls: CapabilityInstallRegistry }
}

export const name = "lfaaCapabilityPrompt";
export const inject = ["lfaaCapabilityInstalls"];
export function apply(ctx: Context): void {
  ctx.lfaaCapabilityInstalls.register(ctx, createPromptAdapter());
}
