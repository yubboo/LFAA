// @lfaa/skills 浏览器端 HTTP 请求封装，与 Host /api/skills 接口通信。
import type { SaveSkillInput, SkillDetail, SkillSummary } from "@lfaa/skills/contract";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export async function fetchSkillsList(includeDisabled = true): Promise<SkillSummary[]> {
  const res = await fetch(`/api/skills?includeDisabled=${includeDisabled ? "true" : "false"}`);
  const data = await parseJson<{ skills: SkillSummary[] }>(res);
  return data.skills;
}

export async function fetchSkillDetail(id: string): Promise<SkillDetail> {
  const res = await fetch(`/api/skills/${encodeURIComponent(id)}`);
  const data = await parseJson<{ skill: SkillDetail }>(res);
  return data.skill;
}

export async function saveSkillRequest(input: SaveSkillInput): Promise<SkillDetail> {
  const res = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ skill: SkillDetail }>(res);
  return data.skill;
}

export async function forkSkillRequest(id: string): Promise<SkillDetail> {
  const res = await fetch(`/api/skills/${encodeURIComponent(id)}/fork`, { method: "POST" });
  const data = await parseJson<{ skill: SkillDetail }>(res);
  return data.skill;
}

export async function toggleSkillRequest(id: string, enabled: boolean): Promise<SkillSummary> {
  const res = await fetch(`/api/skills/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const data = await parseJson<{ skill: SkillSummary }>(res);
  return data.skill;
}

export async function deleteSkillRequest(id: string): Promise<void> {
  const res = await fetch(`/api/skills/${encodeURIComponent(id)}`, { method: "DELETE" });
  await parseJson<{ ok: boolean }>(res);
}
