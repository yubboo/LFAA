/**
 * 功能：登记与解析当前部署的 Agent 人格核心（小鱼核心）正文。
 * 作用：正文归内容 Owner（preset/persona），本包只按稳定顺序组合；未登记时不注入任何人格正文。
 * 关联文件：index.ts、packages/preset/persona/src/index.ts、llm/llm/src/completion.ts。
 */
import type { Context } from "@deepseek-ai/cordis";

/** 一个人格核心：身份、真实领域地图与领域工作约定。 */
export interface LfaaPersonaCore {
  /** 模型可见名称，例如小鱼；不改变会话、权限或业务归属。 */
  displayName: string;
  /** 正文版本；正文变化时递增，便于回归与会话证据比对。 */
  version: string;
  /** 身份与真实领域地图；排在核心指引之后、权限模式之前。 */
  prefix: string;
  /** 领域工作约定；排在 Agent 指引之后、运行上下文之前。 */
  suffix?: string;
}

interface PersonaRegistration {
  resolve: () => LfaaPersonaCore | null;
}

let registration: PersonaRegistration | null = null;

/** 人格正文是模型输入，空名称/版本/身份会静默削弱身份约束，因此在读取时失败关闭。 */
function validate(core: LfaaPersonaCore): LfaaPersonaCore {
  if (typeof core.displayName !== "string" || core.displayName.trim().length === 0) throw new Error("Agent 人格核心缺少模型可见名称。");
  if (typeof core.version !== "string" || core.version.trim().length === 0) throw new Error("Agent 人格核心缺少正文版本。");
  if (typeof core.prefix !== "string" || core.prefix.trim().length === 0) throw new Error("Agent 人格核心缺少身份正文。");
  if (core.suffix !== undefined && typeof core.suffix !== "string") throw new Error("Agent 人格核心的领域约定必须是文本。");
  return core;
}

/**
 * 登记唯一人格核心。同一进程内第二次登记直接失败，不静默覆盖；
 * 所属插件卸载后回退为“不注入”，提示词恢复原有核心指引。
 */
export function registerLfaaPersonaCore(owner: Context, resolve: () => LfaaPersonaCore | null): void {
  const entry: PersonaRegistration = { resolve };
  owner.effect(() => {
    if (registration !== null && registration !== entry) throw new Error("Agent 人格核心已由其他插件登记，拒绝静默覆盖。");
    registration = entry;
    return () => {
      if (registration === entry) registration = null;
    };
  }, "lfaa-persona-core");
}

/** 读取当前人格核心；未装配时为 null，调用方保持无领域正文的原有组合结果。 */
export function getLfaaPersonaCore(): LfaaPersonaCore | null {
  const core = registration?.resolve() ?? null;
  return core === null ? null : validate(core);
}
