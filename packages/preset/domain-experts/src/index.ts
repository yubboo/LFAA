/**
 * 功能：可由模型跨界面按需选择的领域专家。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：core/agent、prompt/prompt、agent-loop/runs。
 */
import { EXPERT_CATALOG } from "./catalog.js";
import { WRITING_SPECIALISTS } from "./writing-catalog.js";
import type { Context } from "@deepseek-ai/cordis";
export const name = "lfaaDomainExperts";
export const inject = ["aiExtensions"];
export function apply(ctx: Context): void { registerWritingExperts(ctx); for (const expert of EXPERT_CATALOG) ctx.aiExtensions.register(ctx, { id: expert.id, name: expert.name, description: expert.description, pluginId: "lfaa-domain-experts", kind: "expert", version: "1.0.0", builtIn: true, loadInstructions: async () => { const { EXPERTS } = await import("./domain-instructions.js"); const definition = EXPERTS.find(entry => entry.id === expert.id); if (!definition) throw new Error("专家正文缺失。"); return definition.instructions; } }); }

/** 作品角色只登记摘要；选择 expert.writing.<原 ID> 后才读取方法。 */
export function registerWritingExperts(ctx: Context): void { for (const entry of WRITING_SPECIALISTS) ctx.aiExtensions.register(ctx, { id: "expert.writing." + entry.id, pluginId: "lfaa-domain-experts", kind: "expert", name: entry.name, description: entry.description, version: "1.0.0", builtIn: true, loadInstructions: async () => { const source = await import("./writing-specialists.js"); return source.getWritingSpecialistInstruction(entry.id); } }); }
