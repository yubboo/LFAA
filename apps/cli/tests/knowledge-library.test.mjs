/** 功能：回归 Markdown 资料库的迁移、账户/App 隔离、长度限制、本地来源约束和 AI 按需工具。关联文件：packages/knowledge/knowledge-library、packages/boot/knowledge-library、packages/api/knowledge-controller。 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { executeProjectFile } from "../../../packages/host/project-files/src/project-files.mjs";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("资料库迁移、账户/App 隔离、检索质量基线、显式保存和本地来源权限合同", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "lfaa-knowledge-library-"));
  const homeDirectory = join(temporaryRoot, "home");
  const dataDirectory = join(temporaryRoot, "data");
  mkdirSync(homeDirectory, { recursive: true });
  mkdirSync(dataDirectory, { recursive: true });
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      import { createServer } from 'node:http';
      import { once } from 'node:events';
      import { join } from 'node:path';
      import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
      const reservation = createServer();
      reservation.listen(0, '127.0.0.1');
      await once(reservation, 'listening');
      process.env.SERVER_PORT = String(reservation.address().port);
      await new Promise(resolve => reservation.close(resolve));
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { database } = await import('lfaa-storage-sqlite/src/database.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      assert.equal(Number(database.prepare('PRAGMA user_version').get().user_version), 69);
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('knowledge-owner',8201,'knowledge-owner','salt','hash','member',0),('knowledge-other',8202,'knowledge-other','salt','hash','member',0)").run();
      database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES ('knowledge-node','资料测试节点','win32','x64','test','offline','2026-10-04T00:00:00Z')").run();
      configuration.begin();
      configuration.save('user_settings', { user_id: 'knowledge-owner', category: 'general', value_json: '{}' });
      configuration.commit();
      retireLegacyFileTables();
      assert.equal(configuration.get('user_settings', row => row.user_id === 'knowledge-owner')?.value_json, '{}');
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM configuration_records WHERE table_name = 'user_settings'").get().count, 0);
      const knowledge = await import('lfaa-knowledge-library/src/index.js');
      const { resolveUserDataPaths } = await import('lfaa-home-paths/src/data-layout.mjs');
      const item = knowledge.createKnowledgeLibraryItem('knowledge-owner', { applicationId: 'workspace', kind: 'knowledge', title: 'MCP 权限约束', description: '只在当前 App 使用', contentMarkdown: '# MCP 权限\\n必须遵循当前 App 和现有权限模式。', sourceKind: 'manual' });
      const itemDirectory=resolveUserDataPaths(process.env.LFAA_DATA_DIR,'knowledge-owner').knowledge;
      const itemPath=join(itemDirectory,'workspace',readdirSync(join(itemDirectory,'workspace')).find(name=>name.endsWith('.md')));
      assert.equal(readFileSync(itemPath,'utf8'),item.contentMarkdown);
      assert.equal(database.prepare('SELECT content_markdown FROM knowledge_library_items WHERE id=?').get(item.id).content_markdown,' ');
      const shared = knowledge.createKnowledgeLibraryItem('knowledge-owner', { applicationId: 'all', kind: 'prompt', title: '共享提示', contentMarkdown: '用户明确要求跨 App 共享。', sourceKind: 'conversation' });
      const privateItem = knowledge.createKnowledgeLibraryItem('knowledge-owner', { applicationId: 'writing', kind: 'skill', title: '写作方法', contentMarkdown: '按作品资料约束语气。', sourceKind: 'manual' });
      assert.equal(knowledge.getKnowledgeLibraryItem('knowledge-owner', item.id, 'minecraft'), null);
      assert.equal(knowledge.getKnowledgeLibraryItem('knowledge-other', item.id, 'workspace'), null);
      assert.equal(knowledge.getKnowledgeLibraryItem('knowledge-owner', shared.id, 'minecraft').id, shared.id);
      assert.equal(knowledge.getKnowledgeLibraryItem('knowledge-owner', privateItem.id, 'workspace'), null);
      const summary = knowledge.listKnowledgeLibraryItems('knowledge-owner', 'workspace')[0];
      assert.equal('contentMarkdown' in summary, false);
      assert.equal((await knowledge.searchKnowledgeLibrary('knowledge-owner', 'workspace', 'MCP 权限'))[0].id, item.id);
      assert.deepEqual(await knowledge.searchKnowledgeLibrary('knowledge-owner', 'minecraft', 'MCP 权限'), []);
      assert.deepEqual(await knowledge.searchKnowledgeLibrary('knowledge-other', 'workspace', 'MCP 权限'), []);
      assert.throws(() => knowledge.createKnowledgeLibraryItem('knowledge-owner', { applicationId: 'workspace', kind: 'knowledge', title: '超限', contentMarkdown: '中'.repeat(22000), sourceKind: 'manual' }), /64 KiB/u);
      const updated = knowledge.updateKnowledgeLibraryItem('knowledge-owner', item.id, 'workspace', { title: item.title, description: item.description, contentMarkdown: '# 已更新\\n只读当前账户资料。', expectedContentSha256: item.contentSha256 });
      assert.notEqual(updated.contentSha256, item.contentSha256);
      assert.equal(readFileSync(itemPath,'utf8'),updated.contentMarkdown);
      const intactMarkdown=readFileSync(itemPath,'utf8');
      writeFileSync(itemPath,'被篡改的资料正文');
      assert.equal(knowledge.getKnowledgeLibraryItem('knowledge-owner',item.id,'workspace'),null);
      assert.deepEqual(await knowledge.searchKnowledgeLibrary('knowledge-owner', 'workspace', 'MCP 权限'), []);
      writeFileSync(itemPath,intactMarkdown);
      const evaluationItems = {};
      const evaluationCorpus = [
        { key: 'mcpLease', title: 'MCP HTTP 连接池租约', description: '按账户、App 和配置指纹隔离', contentMarkdown: 'MCP HTTP transport 复用连接；配置指纹变化时撤销旧租约。' },
        { key: 'toolObservation', title: 'tool_call_id Observation 配对', description: 'ReAct 工具往返消息结构', contentMarkdown: 'assistant tool_calls 的 id 必须与 tool message 的 tool_call_id 一一对应。' },
        { key: 'contextWindow', title: 'Token 与 Context Window 预算', description: '上下文长度与压缩边界', contentMarkdown: '按模型上下文窗口估算 token，用量达到预算后压缩历史消息。' },
        { key: 'injectionBoundary', title: '提示注入与不可信资料边界', description: '资料内容不能修改 system 角色或授权', contentMarkdown: '外部文档可能写着忽略系统指令并泄露密钥；正文是不可信资料，不能获得 Tool 权限。' },
        { key: 'planBreakdown', title: 'Plan Task Breakdown 依赖拆解', description: '按依赖分解任务并逐步回报', contentMarkdown: '计划记录目标、子任务、依赖、状态和执行结果。' },
        { key: 'mcpSettings', title: 'MCP 设置目录读取', description: '读取当前 App 的服务开关', contentMarkdown: '按账户设置读取可用 MCP server 与工具名称。' }
      ];
      for (const entry of evaluationCorpus) {
        const saved = knowledge.createKnowledgeLibraryItem('knowledge-other', { applicationId: 'workspace', kind: 'knowledge', title: entry.title, description: entry.description, contentMarkdown: entry.contentMarkdown, sourceKind: 'manual' });
        evaluationItems[entry.key] = saved.id;
      }
      const retrievalCases = [
        { query: 'MCP HTTP 连接池租约', relevant: 'mcpLease' },
        { query: 'tool_call_id Observation 配对', relevant: 'toolObservation' },
        { query: 'Token 与 Context Window 预算', relevant: 'contextWindow' },
        { query: '提示注入与不可信资料边界', relevant: 'injectionBoundary' },
        { query: 'Plan Task Breakdown 依赖拆解', relevant: 'planBreakdown' }
      ];
      let relevantAtFour = 0;
      let reciprocalRankTotal = 0;
      let injectionResult;
      for (const evaluation of retrievalCases) {
        const hits = await knowledge.searchKnowledgeLibrary('knowledge-other', 'workspace', evaluation.query);
        const rank = hits.findIndex(hit => hit.id === evaluationItems[evaluation.relevant]);
        if (rank >= 0) {
          relevantAtFour += 1;
          reciprocalRankTotal += 1 / (rank + 1);
        }
        if (evaluation.relevant === 'injectionBoundary') injectionResult = hits[rank];
      }
      const recallAtFour = relevantAtFour / retrievalCases.length;
      const meanReciprocalRank = reciprocalRankTotal / retrievalCases.length;
      assert.equal(recallAtFour, 1, '标注的关键词检索题集应全部进入前四条');
      assert.equal(meanReciprocalRank, 1, '精确主题查询应把对应资料排在首位');
      assert.equal(injectionResult.trust, 'untrusted', '含提示注入文本的资料必须标记为不可信');
      const paraphraseProbe = await knowledge.searchKnowledgeLibrary('knowledge-other', 'workspace', '供应商变更后，之前的会话应该怎样处理？');
      assert.deepEqual(paraphraseProbe, [], '词面检索不会凭空推断缺少共同词项的语义改写');
      assert.throws(() => knowledge.updateKnowledgeLibraryItem('knowledge-owner', item.id, 'workspace', { title: item.title, description: item.description, contentMarkdown: '过期覆盖', expectedContentSha256: item.contentSha256 }), /其他操作更新/u);
      assert.equal(knowledge.normalizeKnowledgeProjectPath('docs/knowledge'), 'docs/knowledge');
      for (const path of ['../secret', '.git', 'docs/node_modules', 'C:\\\\secret', '/absolute']) assert.throws(() => knowledge.normalizeKnowledgeProjectPath(path));
      const { createWorkspaceProject } = await import('lfaa-workspace-workspace/src/index.js');
      const project = createWorkspaceProject({ userId: 'knowledge-owner', appId: 'workspace', nodeId: 'knowledge-node', path: process.cwd(), platform: 'win32', title: '知识项目' });
      const source = knowledge.createKnowledgeLibraryProjectSource('knowledge-owner', { applicationId: 'workspace', projectId: project.id, projectApplicationId: 'workspace', relativePath: 'docs', title: '项目文档' });
      assert.equal(knowledge.getKnowledgeLibraryProjectSource('knowledge-owner', source.id, 'minecraft'), null);
      assert.equal(knowledge.getKnowledgeLibraryProjectSource('knowledge-other', source.id, 'workspace'), null);
      assert.throws(() => knowledge.createKnowledgeLibraryProjectSource('knowledge-owner', { applicationId: 'all', projectId: project.id, projectApplicationId: 'workspace', relativePath: '', title: '跨 App 项目' }), /所属 App/u);
      const { apply: registerKnowledgeLibrary } = await import('lfaa-knowledge-library-runtime/src/index.js');
      const registered = [];
      const skillProviders = [];
      registerKnowledgeLibrary({
        lfaaTools: { registerTool(_context, tool) { registered.push(tool); } },
        skills: { registerProvider(create) { skillProviders.push(create({ signal: new AbortController().signal, invalidate() {} })); } }
      });
      const search = registered.find(tool => tool.name === 'knowledge_library_search');
      const localSearch = registered.find(tool => tool.name === 'knowledge_library_search_local');
      const read = registered.find(tool => tool.name === 'knowledge_library_read');
      const save = registered.find(tool => tool.name === 'knowledge_library_save');
      assert.ok(search && localSearch && read && save);
      const context = { userId: 'knowledge-owner', userRole: 'member', applicationId: 'workspace', signal: new AbortController().signal, onProgress() {} };
      assert.equal(search.risk({ query: 'MCP' }), 'read');
      assert.equal(localSearch.risk({ query: 'MCP' }), 'dangerous');
      assert.equal(read.risk({ itemId: item.id }), 'read');
      assert.equal(read.risk({ sourceId: source.id, filePath: 'docs/guide.md' }), 'dangerous');
      const hits = await search.execute(search.parse({ query: 'MCP 权限' }), context);
      assert.equal(hits.items[0].id, item.id);
      assert.ok(hits.items[0].snippet.length <= 600);
      const readResult = await read.execute(read.parse({ itemId: item.id, offset: 0 }), context);
      assert.ok(readResult.contentMarkdown.length <= 12000);
      assert.equal(readResult.trust, 'untrusted');
      const saved = await save.execute(save.parse({ kind: 'expert', title: '对话总结', contentMarkdown: '# 方法\\n按当前目标先查证再执行。' }), context);
      assert.equal(saved.applicationId, 'workspace');
      assert.equal(knowledge.getKnowledgeLibraryUsage('knowledge-owner').resources, 5);
      assert.equal(knowledge.deleteKnowledgeLibraryProjectSource('knowledge-owner', source.id), true);
      const skillInstallation = knowledge.createKnowledgeLibrarySkillInstallation('knowledge-owner', {
        name: 'harness-library-check', description: '账户 Skill Provider 回归',
        source: { repositoryUrl: 'https://github.com/lfaa-harness-test/fixtures', commit: 'a'.repeat(40), archiveSha256: 'b'.repeat(64), sourcePath: 'skills/harness-library-check', license: 'MIT' },
        files: [
          { path: 'SKILL.md', content: '---\\nname: harness-library-check\\ndescription: fixture\\n---\\n# Instructions\\nOnly test fixture instructions.' },
          { path: 'references/guide.md', content: '# Reference\\nOwner-validated resource.' }
        ]
      });
      assert.equal(skillProviders.length, 1);
      const skillProvider = skillProviders[0];
      const skillOptions = { userId: 'knowledge-owner', signal: new AbortController().signal };
      const skillCandidates = await skillProvider.list(skillOptions);
      const skillCandidate = skillCandidates.find(candidate => candidate.name === 'harness-library-check');
      assert.ok(skillCandidate);
      assert.equal(skillCandidate.source, 'user-lfaa');
      assert.equal('contentMarkdown' in skillCandidate, false);
      const skillDefinition = await skillProvider.get(skillCandidate, skillOptions);
      assert.equal(skillDefinition.content, '# Instructions\\nOnly test fixture instructions.');
      assert.equal(await skillProvider.get(skillCandidate, { ...skillOptions, userId: 'knowledge-other' }), undefined);
      const skillResource = await skillProvider.readResource(skillCandidate, 'references/guide.md', skillOptions);
      assert.equal(skillResource.content, '# Reference\\nOwner-validated resource.');
      assert.equal(await skillProvider.readResource(skillCandidate, 'references/guide.md', { ...skillOptions, userId: 'knowledge-other' }), undefined);
      const { boot } = await import('lfaa-app-boot/src/index.js');
      const app = await boot(['web']);
      try {
        const runtimeSkillOptions = { userId: 'knowledge-owner', allowHostFilesystem: false, customSkillDirs: [], signal: new AbortController().signal };
        const runtimeSkillSummaries = await app.skills.list(runtimeSkillOptions);
        assert.ok(runtimeSkillSummaries.some(skill => skill.name === 'harness-library-check' && skill.provider === 'lfaa-knowledge-library-skills'));
        const runtimeSkill = await app.skills.get('harness-library-check', runtimeSkillOptions);
        assert.equal(runtimeSkill.content, '# Instructions\\nOnly test fixture instructions.');
        const runtimeResource = await app.skills.readResource('harness-library-check', 'references/guide.md', runtimeSkillOptions);
        assert.equal(runtimeResource.content, '# Reference\\nOwner-validated resource.');
        const otherRuntimeSkills = await app.skills.list({ ...runtimeSkillOptions, userId: 'knowledge-other' });
        assert.equal(otherRuntimeSkills.some(skill => skill.name === 'harness-library-check'), false);
        const toolNames = include => app.lfaaTools.listAiBusinessTools('workspace', 'member', null, 'ask', include).map(tool => tool.name);
        assert.equal(toolNames(false).some(name => name.startsWith('knowledge_library_')), false);
        assert.ok(['knowledge_library_search', 'knowledge_library_search_local', 'knowledge_library_read', 'knowledge_library_save'].every(name => toolNames(true).includes(name)));
        const auth = await import('lfaa-identity-auth/src/service.js');
        const jwt = (await import('jsonwebtoken')).default;
        const { config } = await import('lfaa-launch-environment/src/config.js');
        const ownerSession = auth.createSession('knowledge-owner');
        const otherSession = auth.createSession('knowledge-other');
        const cookie = sessionId => 'lfaa_session=' + jwt.sign({ sid: sessionId }, config.jwtSecret, { expiresIn: '1h', audience: 'lfaa-web', issuer: 'lfaa-server' });
        const base = 'http://127.0.0.1:' + process.env.SERVER_PORT + '/api/knowledge';
        assert.equal((await fetch(base + '/items')).status, 401);
        const ownerHeaders = { cookie: cookie(ownerSession.sessionId), 'content-type': 'application/json' };
        const create = await fetch(base + '/items', { method: 'POST', headers: ownerHeaders, body: JSON.stringify({ applicationId: 'workspace', kind: 'knowledge', title: 'API 资料', contentMarkdown: '# API\\n账户与 App 隔离', sourceKind: 'manual' }) });
        assert.equal(create.status, 201);
        const apiItem = (await create.json()).item;
        assert.equal((await fetch(base + '/items?applicationId=workspace', { headers: ownerHeaders })).status, 200);
        const wrongAppRead = await fetch(base + '/items/' + apiItem.id + '?applicationId=minecraft', { headers: ownerHeaders });
        assert.equal(wrongAppRead.status, 404);
        const otherHeaders = { cookie: cookie(otherSession.sessionId) };
        assert.equal((await fetch(base + '/items/' + apiItem.id + '?applicationId=workspace', { headers: otherHeaders })).status, 404);
        const oversize = await fetch(base + '/items', { method: 'POST', headers: ownerHeaders, body: JSON.stringify({ applicationId: 'workspace', kind: 'knowledge', title: 'API 超限', contentMarkdown: '中'.repeat(22000), sourceKind: 'upload' }) });
        assert.equal(oversize.status, 400);
        assert.equal((await fetch(base + '/items/' + apiItem.id, { method: 'DELETE', headers: ownerHeaders })).status, 204);
        assert.equal(knowledge.deleteKnowledgeLibrarySkillInstallation('knowledge-owner', skillInstallation.id), true);
      } finally { await app.fiber.dispose(); }
      configuration.close();
      sessionRecords.close();
    `], { cwd: cli, env: { ...process.env, NODE_ENV: "test", JWT_SECRET: "", SERVER_HOST: "127.0.0.1", LFAA_HOME: homeDirectory, LFAA_DATA_DIR: dataDirectory, USERPROFILE: homeDirectory, HOME: homeDirectory }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 25000 });
  } finally {
    const resolved = resolve(temporaryRoot);
    assert.equal(dirname(resolved), resolve(tmpdir()));
    assert.equal(resolved.split(/[\\/]/u).at(-1)?.startsWith("lfaa-knowledge-library-"), true);
    rmSync(resolved, { recursive: true, force: true });
  }
});

test("Daemon 的本地资料搜索只返回 Markdown 文件", async () => {
  const root = mkdtempSync(join(tmpdir(), "lfaa-knowledge-files-"));
  try {
    mkdirSync(join(root, "docs"));
    mkdirSync(join(root, ".GIT"));
    mkdirSync(join(root, "wide"));
    writeFileSync(join(root, "docs", "guide.md"), "知识库权限模式\nMCP 连接范围");
    writeFileSync(join(root, "docs", "notes.txt"), "知识库权限模式");
    writeFileSync(join(root, ".GIT", "guide.md"), "知识库权限模式");
    for (let index = 0; index < 257; index += 1) writeFileSync(join(root, "wide", `${index}.md`), "没有匹配项");
    const result = await executeProjectFile({ rootDirectory: root, path: "docs", operation: "search_markdown", query: "知识库权限模式" });
    assert.equal(result.matches.length, 1, JSON.stringify(result));
    assert.match(result.matches[0].path, /guide\.md$/u);
    const caseInsensitiveExclusion = await executeProjectFile({ rootDirectory: root, path: ".", operation: "search_markdown", query: "知识库权限模式" });
    assert.equal(caseInsensitiveExclusion.matches.length, 1);
    const boundedDirectory = await executeProjectFile({ rootDirectory: root, path: "wide", operation: "search_markdown", query: "缺失查询" });
    assert.equal(boundedDirectory.scanned, 256);
    assert.equal(boundedDirectory.truncated, true);
    assert.equal(result.matches[0].line, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
