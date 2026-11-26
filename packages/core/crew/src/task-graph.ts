// 任务图的纯函数校验与拓扑排序：id 唯一、依赖存在、无环，排序保持声明顺序的稳定。
import type { CrewTaskSpec, TaskGraphCheck } from "./types";

/** 校验任务图：空列表、重复 id、自依赖、缺失依赖与环都返回可读原因。 */
export function checkTaskGraph(tasks: readonly CrewTaskSpec[]): TaskGraphCheck {
  const issues: string[] = [];
  if (tasks.length === 0) issues.push("任务列表为空。");
  if (tasks.length > 6) issues.push(`任务数量 ${tasks.length} 超过上限 6。`);

  const ids = new Set<string>();
  for (const task of tasks) {
    if (!task.id.trim()) {
      issues.push("存在空任务 id。");
      continue;
    }
    if (ids.has(task.id)) issues.push(`任务 id 重复：${task.id}`);
    ids.add(task.id);
    if (!task.description.trim()) issues.push(`任务 ${task.id} 缺少 description。`);
    if (!task.expectedOutput.trim()) issues.push(`任务 ${task.id} 缺少 expectedOutput。`);
  }

  for (const task of tasks) {
    for (const dependency of task.dependsOn ?? []) {
      if (dependency === task.id) issues.push(`任务 ${task.id} 依赖自身。`);
      else if (!ids.has(dependency)) issues.push(`任务 ${task.id} 依赖不存在的任务 ${dependency}。`);
    }
  }

  if (issues.length === 0 && findCycle(tasks)) issues.push("任务依赖存在环。");
  return { ok: issues.length === 0, issues };
}

/** 找出一个环用于报错；没有环返回 null。 */
function findCycle(tasks: readonly CrewTaskSpec[]): string[] | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      return [...stack.slice(start), id];
    }
    if (visited.has(id)) return null;
    visiting.add(id);
    stack.push(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * 按依赖拓扑排序；同一层内保持声明顺序，保证同样的任务列表每次执行顺序一致。
 * 调用前必须先通过 checkTaskGraph，否则抛错。
 */
export function orderTasks(tasks: readonly CrewTaskSpec[]): CrewTaskSpec[] {
  const check = checkTaskGraph(tasks);
  if (!check.ok) throw new Error(`任务图不合法：${check.issues.join("；")}`);

  const index = new Map(tasks.map((task, position) => [task.id, position]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const task of tasks) {
    indegree.set(task.id, task.dependsOn?.length ?? 0);
    for (const dependency of task.dependsOn ?? []) {
      dependents.set(dependency, [...(dependents.get(dependency) ?? []), task.id]);
    }
  }

  const ready = tasks.filter((task) => (indegree.get(task.id) ?? 0) === 0).map((task) => task.id);
  const ordered: CrewTaskSpec[] = [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  while (ready.length > 0) {
    ready.sort((left, right) => (index.get(left) ?? 0) - (index.get(right) ?? 0));
    const id = ready.shift();
    if (!id) break;
    const task = byId.get(id);
    if (task) ordered.push(task);
    for (const dependent of dependents.get(id) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
  }
  return ordered;
}

/** 找出某个任务的全部直接依赖，供上下文组装时取 accepted 输出。 */
export function dependencyIds(task: CrewTaskSpec): string[] {
  return [...new Set(task.dependsOn ?? [])];
}