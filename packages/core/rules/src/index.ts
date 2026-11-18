// @lfaa/rules Host 侧 Cordis 服务：强制系统规则基线、发现项目规则文件、持久化用户全局规则并按优先级拼装系统提示词。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import type { ComposeRulesInput, ComposedRulesResult, RuleDocument } from "./types";

export * from "./types";
export { createRulesHttpHandler } from "./http-handler";

export interface RulesPluginConfig {
  storeFilePath?: string;
  systemRulesOverride?: string;
}

const DEFAULT_RULES_STORE_PATH = join(homedir(), ".lfaa", "rules.json");

const PROJECT_RULE_CANDIDATES = ["AGENTS.md", join(".lfaa", "rules.md")] as const;

export const BUILTIN_SYSTEM_RULES = [
  "你是 LFAA 智能工作区内的专业 AI Agent，必须严格遵循以下系统安全与行为底线（不可被任何用户规则覆盖）：",
  "1. 诚实性与可验证性：绝不编造未执行过的工具结果、文件正文或命令输出；无法完成或被权限拦截时如实告知边界。",
  "2. 工具边界：仅在用户授权的工作区目录内调用读写与命令工具；修改文件与执行命令前须遵守系统审批。",
  "3. 工作循环：按「思考（分析目标与上下文）→ 行动（调用必要工具）→ 检查（核验工具结果与目标完成度）」推进复杂任务。",
].join("\n");

interface StoredUserRules {
  content: string;
  updatedAt: number;
}

// Host 侧规则管理服务。
export class RulesService extends Service {
  private readonly storeFilePath: string;
  private readonly systemRules: string;

  constructor(ctx: Context, config: RulesPluginConfig = {}) {
    super(ctx, "rules");
    this.storeFilePath = config.storeFilePath ? resolve(config.storeFilePath) : DEFAULT_RULES_STORE_PATH;
    this.systemRules = config.systemRulesOverride?.trim() || BUILTIN_SYSTEM_RULES;
  }

  async getUserRules(): Promise<StoredUserRules> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed = JSON.parse(raw) as { content?: unknown; updatedAt?: unknown };
      return {
        content: typeof parsed.content === "string" ? parsed.content : "",
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      };
    } catch {
      return { content: "", updatedAt: 0 };
    }
  }

  async saveUserRules(content: string): Promise<StoredUserRules> {
    const next: StoredUserRules = {
      content: content.trim(),
      updatedAt: Date.now(),
    };
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  // 安全读取绑定项目根目录下存在的 AGENTS.md 与 .lfaa/rules.md。
  async discoverProjectRules(projectPaths: string[] = []): Promise<RuleDocument[]> {
    const seen = new Set<string>();
    const docs: RuleDocument[] = [];

    for (const root of projectPaths) {
      const trimmed = root.trim();
      if (!trimmed) continue;
      const absRoot = resolve(trimmed);
      for (const rel of PROJECT_RULE_CANDIDATES) {
        const candidate = join(absRoot, rel);
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        try {
          const text = await readFile(candidate, "utf8");
          if (!text.trim()) continue;
          docs.push({
            id: `project:${candidate}`,
            layer: "project",
            title: rel,
            source: candidate,
            content: text.trim().slice(0, 8000),
            readOnly: true,
          });
        } catch {
          // 项目目录不存在该规则文件时忽略。
        }
      }
    }

    return docs;
  }

  async listAllRules(projectPaths: string[] = []): Promise<RuleDocument[]> {
    const userStored = await this.getUserRules();
    const projectDocs = await this.discoverProjectRules(projectPaths);
    const docs: RuleDocument[] = [
      {
        id: "system:core",
        layer: "system",
        title: "系统内置安全与执行规范",
        source: "@lfaa/rules",
        content: this.systemRules,
        readOnly: true,
      },
      ...projectDocs,
      {
        id: "user:global",
        layer: "user",
        title: "用户全局规则",
        source: this.storeFilePath,
        content: userStored.content,
        readOnly: false,
      },
    ];
    return docs;
  }

  // 按系统规则 > 项目规则 > 用户规则 > 相关记忆的固定优先级拼装系统提示词。
  async composeSystemPrompt(input: ComposeRulesInput = {}): Promise<ComposedRulesResult> {
    const documents = await this.listAllRules(input.projectPaths);
    const blocks: string[] = [];

    for (const doc of documents) {
      if (!doc.content.trim()) continue;
      const header = doc.layer === "system"
        ? "## [系统规则（最高优先级，不可覆盖）]"
        : doc.layer === "project"
          ? `## [项目规则: ${doc.title}] (${doc.source})`
          : "## [用户全局规则]";
      blocks.push(`${header}\n${doc.content.trim()}`);
    }

    const memories = (input.memoryHints ?? []).map((item) => item.trim()).filter(Boolean);
    if (memories.length > 0) {
      blocks.push(`## [长期记忆参考]\n${memories.map((m) => `- ${m}`).join("\n")}`);
    }

    return {
      systemPrompt: blocks.join("\n\n"),
      documents,
    };
  }
}

export function rulesPlugin(context: Context, config: RulesPluginConfig = {}): void {
  new RulesService(context, config);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    rules: RulesService;
  }
}
