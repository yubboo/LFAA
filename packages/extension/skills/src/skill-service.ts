// @lfaa/skills Host 侧技能管理逻辑：发现内置/项目技能、管理个人技能文件、Git 安装与插件技能注册，提供原子保存与二创。
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { PluginSkillDefinition, SaveSkillInput, SkillDetail, SkillSummary } from "../contract/index";
import { assertSafePersonalSkillId, buildSkillMarkdown, DEFAULT_DISABLED_BUILTIN_IDS, parseSkillMarkdown, slugifySkillId } from "./skill-format";

export { parseSkillMarkdown };

const execFileAsync = promisify(execFile);

interface StoredSkillMeta {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  revision: number;
  originSkillId?: string;
  updatedAt: number;
}

interface StoredSkillStateFile {
  skills: Record<string, StoredSkillMeta>;
  disabledExternalIds: string[];
  enabledExternalIds: string[];
}

function defaultPersonalSkillsDir(): string {
  return join(homedir(), ".lfaa", "skills");
}

function defaultBuiltinSkillsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const local = resolve(here, "builtin-skills");
  if (existsSync(local)) return local;
  const fallback = resolve(here, "../src/builtin-skills");
  return existsSync(fallback) ? fallback : local;
}

/** 技能存储与运行时查询核心实现，支持个人目录、项目目录与插件动态注册。 */
export class SkillManager {
  private readonly personalDir: string;
  private readonly builtinDir: string;
  private readonly stateFilePath: string;
  private readonly pluginSkills = new Map<string, { pluginId: string; skill: PluginSkillDefinition }>();

  constructor(personalDir = defaultPersonalSkillsDir(), builtinDir = defaultBuiltinSkillsDir()) {
    this.personalDir = resolve(personalDir);
    this.builtinDir = resolve(builtinDir);
    this.stateFilePath = join(this.personalDir, ".skills-state.json");
  }

  private async readState(): Promise<StoredSkillStateFile> {
    if (!existsSync(this.stateFilePath)) {
      return { skills: {}, disabledExternalIds: [], enabledExternalIds: [] };
    }
    try {
      const raw = await readFile(this.stateFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredSkillStateFile>;
      return {
        skills: parsed.skills && typeof parsed.skills === "object" ? parsed.skills : {},
        disabledExternalIds: Array.isArray(parsed.disabledExternalIds) ? parsed.disabledExternalIds : [],
        enabledExternalIds: Array.isArray(parsed.enabledExternalIds) ? parsed.enabledExternalIds : [],
      };
    } catch {
      return { skills: {}, disabledExternalIds: [], enabledExternalIds: [] };
    }
  }

  private async writeState(state: StoredSkillStateFile): Promise<void> {
    await mkdir(this.personalDir, { recursive: true });
    const tmp = `${this.stateFilePath}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
    await rename(tmp, this.stateFilePath);
  }

  /** 插件启用时注册其提供的技能，返回幂等注销函数。 */
  registerPluginSkills(pluginId: string, skills: PluginSkillDefinition[]): () => void {
    const keys: string[] = [];
    for (const skill of skills) {
      const id = `plugin:${pluginId}:${skill.id}`;
      this.pluginSkills.set(id, { pluginId, skill });
      keys.push(id);
    }
    return () => {
      for (const id of keys) {
        const entry = this.pluginSkills.get(id);
        if (entry && entry.pluginId === pluginId) {
          this.pluginSkills.delete(id);
        }
      }
    };
  }

  private async scanPersonalSkills(state: StoredSkillStateFile): Promise<SkillDetail[]> {
    if (!existsSync(this.personalDir)) return [];
    const entries = await readdir(this.personalDir, { withFileTypes: true }).catch(() => []);
    const list: SkillDetail[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const skillFile = join(this.personalDir, entry.name, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      const raw = await readFile(skillFile, "utf8").catch(() => "");
      if (!raw) continue;
      const parsed = parseSkillMarkdown(raw, entry.name);
      const meta = state.skills[entry.name];
      list.push({
        id: entry.name,
        name: meta?.name || parsed.name,
        description: meta?.description || parsed.description,
        source: "personal",
        ...(meta?.originSkillId ? { originSkillId: meta.originSkillId } : {}),
        enabled: meta?.enabled ?? true,
        editable: true,
        revision: meta?.revision ?? 1,
        updatedAt: meta?.updatedAt ?? Date.now(),
        content: raw,
        filePath: skillFile,
      });
    }
    return list;
  }

  private async scanBuiltinSkills(state: StoredSkillStateFile): Promise<SkillDetail[]> {
    if (!existsSync(this.builtinDir)) return [];
    const disabledSet = new Set(state.disabledExternalIds);
    const enabledSet = new Set(state.enabledExternalIds);
    const entries = await readdir(this.builtinDir, { withFileTypes: true }).catch(() => []);
    const list: SkillDetail[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const skillFile = join(this.builtinDir, entry.name, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      const raw = await readFile(skillFile, "utf8").catch(() => "");
      if (!raw) continue;
      const id = `builtin:${entry.name}`;
      const parsed = parseSkillMarkdown(raw, entry.name);
      const enabled = disabledSet.has(id)
        ? false
        : enabledSet.has(id)
          ? true
          : !DEFAULT_DISABLED_BUILTIN_IDS.has(id);
      list.push({
        id,
        name: parsed.name,
        description: parsed.description,
        source: "builtin",
        enabled,
        editable: false,
        revision: 1,
        updatedAt: 0,
        content: raw,
        filePath: skillFile,
      });
    }
    return list;
  }

  private async scanProjectSkills(projectRoots: string[], state: StoredSkillStateFile): Promise<SkillDetail[]> {
    const disabledSet = new Set(state.disabledExternalIds);
    const list: SkillDetail[] = [];
    const seenIds = new Set<string>();
    for (const root of projectRoots) {
      // 严禁读取 .agent/skills/（该目录仅供外部编程工具使用），小鱼 Agent 仅扫描 .lfaa/skills/。
      const skillsDir = join(resolve(root), ".lfaa", "skills");
      if (!existsSync(skillsDir)) continue;
      const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillFile = join(skillsDir, entry.name, "SKILL.md");
        if (!existsSync(skillFile)) continue;
        const raw = await readFile(skillFile, "utf8").catch(() => "");
        if (!raw) continue;
        const id = `project:${basename(resolve(root))}:${entry.name}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const parsed = parseSkillMarkdown(raw, entry.name);
        list.push({
          id,
          name: parsed.name,
          description: parsed.description,
          source: "project",
          scopeRoot: resolve(root),
          enabled: !disabledSet.has(id),
          editable: false,
          revision: 1,
          updatedAt: 0,
          content: raw,
          filePath: skillFile,
        });
      }
    }
    return list;
  }

  private listPluginSkillDetails(state: StoredSkillStateFile): SkillDetail[] {
    const disabledSet = new Set(state.disabledExternalIds);
    const list: SkillDetail[] = [];
    for (const [id, entry] of this.pluginSkills.entries()) {
      list.push({
        id,
        name: entry.skill.name,
        description: entry.skill.description,
        source: "plugin",
        pluginId: entry.pluginId,
        enabled: !disabledSet.has(id),
        editable: false,
        revision: 1,
        updatedAt: 0,
        content: entry.skill.content,
      });
    }
    return list;
  }

  async listSkills(options?: { projectRoots?: string[]; includeDisabled?: boolean }): Promise<SkillSummary[]> {
    const state = await this.readState();
    const all = [
      ...(await this.scanPersonalSkills(state)),
      ...(await this.scanBuiltinSkills(state)),
      ...(await this.scanProjectSkills(options?.projectRoots ?? [], state)),
      ...this.listPluginSkillDetails(state),
    ];
    const filtered = options?.includeDisabled === false ? all.filter((s) => s.enabled) : all;
    return filtered.map(({ content: _content, filePath: _filePath, ...summary }) => summary);
  }

  async getSkillDetail(id: string, projectRoots: string[] = []): Promise<SkillDetail | null> {
    const state = await this.readState();
    const all = [
      ...(await this.scanPersonalSkills(state)),
      ...(await this.scanBuiltinSkills(state)),
      ...(await this.scanProjectSkills(projectRoots, state)),
      ...this.listPluginSkillDetails(state),
    ];
    return all.find((item) => item.id === id) ?? null;
  }

  async createOrUpdateSkill(input: SaveSkillInput): Promise<SkillDetail> {
    const name = input.name.trim();
    const content = input.content.trim();
    if (!name) throw new Error("技能名称不能为空。");
    if (!content) throw new Error("技能正文内容不能为空。");

    const state = await this.readState();
    const id = input.id?.trim() || slugifySkillId(name);
    if (id.startsWith("builtin:") || id.startsWith("project:") || id.startsWith("plugin:")) {
      throw new Error("内置或外部来源技能不可直接覆盖，请先「复制为我的版本」后再编辑。");
    }
    const targetDir = assertSafePersonalSkillId(id, this.personalDir);

    const existing = state.skills[id];
    if (existing && typeof input.expectedRevision === "number" && existing.revision !== input.expectedRevision) {
      throw new Error(`技能版本冲突（当前版本 v${existing.revision}，请求版本 v${input.expectedRevision}），请刷新后重试。`);
    }

    const parsed = parseSkillMarkdown(content, name);
    const description = (input.description ?? parsed.description).trim();
    const finalContent = buildSkillMarkdown(name, description, content);

    await mkdir(targetDir, { recursive: true });
    const skillFile = join(targetDir, "SKILL.md");
    const tmpFile = `${skillFile}.${randomUUID()}.tmp`;
    await writeFile(tmpFile, finalContent, "utf8");
    await rename(tmpFile, skillFile);

    const nextRevision = (existing?.revision ?? 0) + 1;
    const now = Date.now();
    state.skills[id] = {
      id,
      name,
      description,
      ...(existing?.originSkillId ? { originSkillId: existing.originSkillId } : {}),
      enabled: existing?.enabled ?? true,
      revision: nextRevision,
      updatedAt: now,
    };
    await this.writeState(state);

    return {
      id,
      name,
      description,
      source: "personal",
      ...(existing?.originSkillId ? { originSkillId: existing.originSkillId } : {}),
      enabled: state.skills[id]!.enabled,
      editable: true,
      revision: nextRevision,
      updatedAt: now,
      content: finalContent,
      filePath: skillFile,
    };
  }

  async forkSkill(sourceId: string, projectRoots: string[] = []): Promise<SkillDetail> {
    const source = await this.getSkillDetail(sourceId, projectRoots);
    if (!source) {
      throw new Error(`找不到要复制的技能：${sourceId}`);
    }
    const state = await this.readState();
    const baseSlug = slugifySkillId(source.name);
    let newId = `${baseSlug}-copy`;
    if (state.skills[newId] || existsSync(join(this.personalDir, newId))) {
      newId = `${baseSlug}-${randomUUID().slice(0, 6)}`;
    }
    const copyName = `${source.name}（我的版本）`;
    const created = await this.createOrUpdateSkill({
      id: newId,
      name: copyName,
      description: source.description,
      content: source.content,
    });
    const nextState = await this.readState();
    if (nextState.skills[newId]) {
      nextState.skills[newId]!.originSkillId = source.id;
      await this.writeState(nextState);
    }
    return { ...created, originSkillId: source.id };
  }

  async setSkillEnabled(id: string, enabled: boolean, projectRoots: string[] = []): Promise<SkillSummary> {
    const state = await this.readState();
    const isExternal = id.startsWith("builtin:") || id.startsWith("project:") || id.startsWith("plugin:");
    if (state.skills[id]) {
      state.skills[id]!.enabled = enabled;
      state.skills[id]!.updatedAt = Date.now();
      await this.writeState(state);
    } else if (!isExternal) {
      const targetDir = assertSafePersonalSkillId(id, this.personalDir);
      const skillFile = join(targetDir, "SKILL.md");
      if (!existsSync(skillFile)) {
        throw new Error(`找不到技能：${id}`);
      }
      const raw = await readFile(skillFile, "utf8").catch(() => "");
      const parsed = parseSkillMarkdown(raw, id);
      state.skills[id] = {
        id,
        name: parsed.name,
        description: parsed.description,
        enabled,
        revision: 1,
        updatedAt: Date.now(),
      };
      await this.writeState(state);
    } else {
      const nextDisabled = new Set(state.disabledExternalIds);
      const nextEnabled = new Set(state.enabledExternalIds);
      if (enabled) {
        nextDisabled.delete(id);
        if (DEFAULT_DISABLED_BUILTIN_IDS.has(id)) nextEnabled.add(id);
      } else {
        nextDisabled.add(id);
        nextEnabled.delete(id);
      }
      state.disabledExternalIds = [...nextDisabled];
      state.enabledExternalIds = [...nextEnabled];
      await this.writeState(state);
    }
    const detail = await this.getSkillDetail(id, projectRoots);
    if (!detail) {
      throw new Error(`找不到技能：${id}`);
    }
    const { content: _content, filePath: _filePath, ...summary } = detail;
    return summary;
  }

  async deleteSkill(id: string): Promise<boolean> {
    if (id.startsWith("builtin:") || id.startsWith("project:") || id.startsWith("plugin:")) {
      throw new Error("内置或外部来源技能不可删除，仅支持停用或二创复制。");
    }
    const targetDir = assertSafePersonalSkillId(id, this.personalDir);
    const state = await this.readState();
    const existed = Boolean(state.skills[id]) || existsSync(targetDir);
    if (!existed) return false;
    delete state.skills[id];
    await this.writeState(state);
    await rm(targetDir, { recursive: true, force: true });
    return true;
  }

  /** 从 Git 仓库安装 SKILL.md 技能到用户级目录（~/.lfaa/skills/）。 */
  async installFromGitRepo(rawUrl: string): Promise<SkillDetail[]> {
    const repoUrl = rawUrl.trim();
    if (!/^(https?:\/\/|git@)/iu.test(repoUrl)) {
      throw new Error("仅支持 http(s) 或 git@ 开头的 Git 仓库地址。");
    }
    const tempDir = await mkdtemp(join(tmpdir(), "lfaa-skill-git-"));
    try {
      await execFileAsync("git", ["clone", "--depth", "1", repoUrl, tempDir], {
        timeout: 60000,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      });
      const foundDirs: string[] = [];
      const walk = async (dir: string, depth: number): Promise<void> => {
        if (depth > 3) return;
        const skillMd = join(dir, "SKILL.md");
        if (existsSync(skillMd)) {
          foundDirs.push(dir);
          return;
        }
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name === ".git" || entry.name === "node_modules") continue;
          await walk(join(dir, entry.name), depth + 1);
        }
      };
      await walk(tempDir, 0);
      if (foundDirs.length === 0) {
        throw new Error(`仓库 ${repoUrl} 中未找到任何 SKILL.md 文件。`);
      }

      const installed: SkillDetail[] = [];
      const state = await this.readState();
      const repoFallback = basename(repoUrl.replace(/\.git$/iu, "")) || "git-skill";
      for (const dir of foundDirs) {
        const raw = await readFile(join(dir, "SKILL.md"), "utf8");
        const parsed = parseSkillMarkdown(raw, dir === tempDir ? repoFallback : basename(dir));
        const id = slugifySkillId(parsed.name || basename(dir));
        const destDir = join(this.personalDir, id);
        await mkdir(destDir, { recursive: true });
        if (dir === tempDir) {
          await writeFile(join(destDir, "SKILL.md"), raw, "utf8");
          for (const sub of ["references", "scripts", "examples", "resources"]) {
            if (existsSync(join(dir, sub))) {
              await cp(join(dir, sub), join(destDir, sub), { recursive: true, force: true });
            }
          }
        } else {
          await cp(dir, destDir, { recursive: true, force: true });
        }
        const prevRev = state.skills[id]?.revision ?? 0;
        const now = Date.now();
        state.skills[id] = {
          id,
          name: parsed.name,
          description: parsed.description,
          originSkillId: repoUrl,
          enabled: true,
          revision: prevRev + 1,
          updatedAt: now,
        };
        installed.push({
          id,
          name: parsed.name,
          description: parsed.description,
          source: "personal",
          originSkillId: repoUrl,
          enabled: true,
          editable: true,
          revision: prevRev + 1,
          updatedAt: now,
          content: raw,
          filePath: join(destDir, "SKILL.md"),
        });
      }
      await this.writeState(state);
      return installed;
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /** 为 Agent 单轮运行解析并校验选中的技能，停用或缺失时拒绝执行。 */
  async resolveSkillsForRun(skillIds: string[], projectRoots: string[] = []): Promise<SkillDetail[]> {
    const resolved: SkillDetail[] = [];
    for (const id of [...new Set(skillIds.map((s) => s.trim()).filter(Boolean))]) {
      const detail = await this.getSkillDetail(id, projectRoots);
      if (!detail) {
        throw new Error(`选中的技能「${id}」不存在或所属插件已卸载。`);
      }
      if (!detail.enabled) {
        throw new Error(`技能「${detail.name}」当前已停用，请启用后再使用或移除该技能。`);
      }
      resolved.push(detail);
    }
    return resolved;
  }
}
