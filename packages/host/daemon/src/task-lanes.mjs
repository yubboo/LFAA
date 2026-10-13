/**
 * 功能：隔离节点 Shell 与运维任务的领取槽。
 * 作用：最多同时执行一个 Shell 和一个运维任务，运维队列轮转避免文件任务饿死停服。
 * 关联文件：daemon.mjs、apps/cli/tests/daemon-task-lanes.test.mjs。
 */
export function createDaemonTaskLanes({ activeTaskIds, onError }) {
  const running = new Map();
  let cursor = 0;
  let stopped = false;
  let polling = false;
  const launch = (lane, task, execute) => {
    activeTaskIds.add(task.id);
    const completion = Promise.resolve().then(() => execute(task))
      .catch(onError)
      .finally(() => { running.delete(lane); activeTaskIds.delete(task.id); });
    running.set(lane, completion);
  };
  return {
    // 文件浏览属于交互操作，独立于心跳快速领取，但仍与安装/运维共用唯一维护槽。
    async pollFile({ claim, queue }) {
      if (stopped || polling || running.has("maintenance")) return;
      polling = true;
      try {
        if (stopped || running.has("maintenance")) return;
        const task = await claim(queue.path);
        if (!stopped && task && !running.has("maintenance")) launch("maintenance", task, queue.execute);
      } finally { polling = false; }
    },
    async poll({ claim, maintenance, shell }) {
      if (stopped || polling) return;
      polling = true;
      try {
        if (!running.has("maintenance")) {
          for (let offset = 0; offset < maintenance.length && !stopped; offset++) {
            const index = (cursor + offset) % maintenance.length;
            const queue = maintenance[index];
            const task = await claim(queue.path);
            if (stopped) return;
            if (task) { cursor = (index + 1) % maintenance.length; launch("maintenance", task, queue.execute); break; }
          }
        }
        if (!stopped && !running.has("shell")) {
          const task = await claim(shell.path);
          if (!stopped && task) launch("shell", task, shell.execute);
        }
      } finally { polling = false; }
    },
    stop() { stopped = true; },
    // 停止领取后等待已领任务收尾，防止释放锁后安装任务又启动实例。
    async drain() { await Promise.all([...running.values()]); }
  };
}
