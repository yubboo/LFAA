const DEFAULT_PROMPT_TIMEOUT_MS = 15 * 60 * 1_000;

function fallbackAction(prompt) {
  if (prompt.kind === "download") return "defer";
  if (prompt.kind === "install") return "later";
  return "dismiss";
}

function isAllowedAction(prompt, action) {
  if (prompt.kind === "download") return action === "accept" || (!prompt.mandatory && (action === "defer" || action === "skip"));
  if (prompt.kind === "install") return action === "install" || (!prompt.mandatory && action === "later");
  return prompt.kind === "notice" && action === "dismiss";
}

export function createDesktopUpdatePromptBroker({
  timeoutMilliseconds = DEFAULT_PROMPT_TIMEOUT_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) {
  let sequence = 0;
  let renderer = null;
  const pending = new Map();

  function settle(requestId, action) {
    const entry = pending.get(requestId);
    if (!entry) return false;
    pending.delete(requestId);
    clearTimeoutFn(entry.timer);
    entry.resolve(action);
    return true;
  }

  function deliver(entry) {
    if (!renderer || entry.deliveredTo === renderer.id) return;
    try {
      renderer.send(entry.prompt);
      entry.deliveredTo = renderer.id;
    } catch {
      settle(entry.prompt.requestId, fallbackAction(entry.prompt));
    }
  }

  return {
    request(prompt) {
      if (pending.size > 0) return Promise.resolve(fallbackAction(prompt));
      const requestId = `update-prompt-${Date.now()}-${++sequence}`;
      const requestPrompt = { ...prompt, requestId };
      return new Promise((resolve) => {
        const entry = {
          prompt: requestPrompt,
          resolve,
          deliveredTo: null,
          timer: setTimeoutFn(() => settle(requestId, fallbackAction(requestPrompt)), timeoutMilliseconds)
        };
        pending.set(requestId, entry);
        deliver(entry);
      });
    },
    setRendererReady(rendererId, send) {
      renderer = { id: rendererId, send };
      for (const entry of pending.values()) deliver(entry);
    },
    setRendererNotReady(rendererId) {
      if (!renderer || renderer.id !== rendererId) return;
      renderer = null;
      for (const entry of pending.values()) entry.deliveredTo = null;
    },
    respond(requestId, action) {
      const entry = pending.get(requestId);
      if (!entry || !isAllowedAction(entry.prompt, action)) return false;
      return settle(requestId, action);
    },
    cancelAll() {
      for (const [requestId, entry] of pending) settle(requestId, fallbackAction(entry.prompt));
    },
    get pendingCount() {
      return pending.size;
    }
  };
}
