/** 功能：独立登记 Minecraft bundled Skill。作用：沿用原 Provider，按模型目标加载，不由 Minecraft App 服务挂载。关联文件：setup-skill.ts、assets、Skill 注册表。 */
import { registerMinecraftSetupSkill } from "./setup-skill.js";
export const name = "lfaaMinecraftSkill";
export const inject = ["skills"];
export const apply = registerMinecraftSetupSkill;
export { registerMinecraftSetupSkill };
