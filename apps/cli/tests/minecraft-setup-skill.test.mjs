/** 功能：验证内置 Minecraft Skill 的真实发现、按需正文与撤销。作用：只创建隔离 Cordis 注册表，不下载或启动服务端。关联文件：skill/minecraft/setup-skill、assets、skill/skill。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import SkillRegistry from 'lfaa-skill';
import { registerMinecraftSetupSkill } from 'lfaa-skill-minecraft/src/setup-skill.js';

test('Minecraft 开服 Skill 来自随包资源，加载正文后可撤销', async () => {
  const ctx = new Context();
  const registryFiber = await ctx.plugin(SkillRegistry);
  const providerFiber = await ctx.plugin({name:'fixture-minecraft-skill',inject:['skills'],apply:registerMinecraftSetupSkill});
  try {
    const skill = (await ctx.skills.list()).find(skill=>skill.name==='minecraft-server-setup');
    assert.equal(skill.provider,'lfaa-minecraft');
    const loaded = await ctx.skills.get(skill.name);
    assert.match(loaded.content,/minecraft_provision_server/u);
    assert.match(loaded.content,/未知.*不重放/u);
    assert.doesNotMatch(loaded.content,/H:\\mc|26\.3|覆盖全版本|先问后做/u);
    await providerFiber.dispose();
    assert.equal((await ctx.skills.list()).some(skill=>skill.name==='minecraft-server-setup'),false);
  } finally { await providerFiber.dispose(); await registryFiber.dispose(); }
});
