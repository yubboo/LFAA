/** 完整 Profile 的隔离子进程场景；只由长期测试调用，不装配到产品。 */
import assert from "node:assert/strict"; import {createServer} from "node:http"; import {once} from "node:events"; import {randomUUID} from "node:crypto"; import {join} from "node:path";
const reservation=createServer();reservation.listen(0,"127.0.0.1");await once(reservation,"listening");process.env.SERVER_PORT=String(reservation.address().port);process.env.SERVER_HOST="127.0.0.1";await new Promise(resolve=>reservation.close(resolve));
const sessions=await import("lfaa-session/src/sessions.js");const {database}=await import("lfaa-storage-sqlite/src/database.js");
  const { boot } = await import("lfaa-app-boot/src/index.js");
  const ctx = await boot(["web"]);
  const base = `http://127.0.0.1:${process.env.SERVER_PORT}/api`;
  try {
    assert.equal((await fetch(`${base}/ai/skills`)).status, 401);
    const setup = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "123456" }) });
    assert.equal(setup.status, 200);
    const result = await setup.json(), userId = result.user.id;
    const headers = { "Content-Type": "application/json", Cookie: setup.headers.get("set-cookie").split(";")[0] };
    const directory = await fetch(`${base}/ai/skills`, { headers }); assert.equal(directory.status, 200);
    const { skills } = await directory.json();
    assert.ok(skills.some(skill => skill.id === "skill.registry/minecraft-server-setup"));
    assert.ok(skills.every(skill => !skill.content && !skill.instructions && !skill.path && !skill.resourceBase));
    const nodeId = randomUUID();
    database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES (?,'isolated','win32','x64','fixture','offline',?)").run(nodeId, new Date().toISOString());
    const { createWorkspaceProject } = await import("lfaa-workspace-workspace/src/index.js");
    const project = createWorkspaceProject({ userId, appId: "minecraft", nodeId, path: join(process.env.LFAA_DATA_DIR, "project"), platform: "win32" });
    const projects = await (await fetch(`${base}/workspace/projects`, { headers })).json();
    assert.ok(projects.projects.some(item => item.id === project.id));
    const turn = sessions.createAiTurn(userId, "workspace", null, "共享项目");
    sessions.finishAiAssistantMessage(userId, turn.session.id, turn.assistantMessage.id, "没有执行节点任务", "complete");
    const attached = await fetch(`${base}/workspace/sessions/${turn.session.id}/project`, { method: "PATCH", headers, body: JSON.stringify({ appId: "workspace", projectId: project.id }) });
    assert.equal(attached.status, 200); assert.equal((await attached.json()).session.projectId, project.id);
    assert.equal(sessions.getAiSessionWorkspaceContext(userId, turn.session.id).path, project.path);
    const associations = { applicationIds: ["minecraft"], capabilityIds: [skills.find(item => item.id === "skill.registry/minecraft-server-setup").id] };
    const saved = await fetch(`${base}/ai/sessions/${turn.session.id}/associations`, { method: "PATCH", headers, body: JSON.stringify(associations) });
    assert.equal(saved.status, 200); assert.deepEqual((await saved.json()).session.associations, associations);
    assert.equal((await fetch(`${base}/ai/sessions/${turn.session.id}/associations`, { method: "PATCH", headers, body: JSON.stringify({ ...associations, permissionMode: "full_access" }) })).status, 400);
  } finally { await ctx.fiber.dispose(); }
process.exit(0);
