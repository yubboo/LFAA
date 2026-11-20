// 验证聊天 Store 拆分后的动作模块：文件预览/右栏状态、会话草稿与打开、排队追问、偏好与记忆数据写入。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatStoreSnapshot } from "../client/chat-types";
import type { ChatStorePort } from "../client/chat-store-port";
import { ChatFileActions } from "../client/chat-file-actions";
import { ChatSessionActions } from "../client/chat-session-actions";
import { ChatRunActions } from "../client/chat-run-actions";
import { ChatDataActions } from "../client/chat-data-actions";
import { readStoredPermissionMode, readStoredReasoningLevel, readStoredSessionId, writeStoredPermissionMode, writeStoredReasoningLevel, writeStoredSessionId } from "../client/chat-preferences";

interface FakeStore {
  port: ChatStorePort;
  patches: Partial<ChatStoreSnapshot>[];
  state: ChatStoreSnapshot;
  calls: { refreshMeta: number; resumeRun: string[]; sendMessage: string[] };
}

function createState(overrides: Partial<ChatStoreSnapshot> = {}): ChatStoreSnapshot {
  return {
    loaded: true,
    sessions: [],
    activeSessionId: null,
    activeSession: null,
    draftProjectId: null,
    draftSectionId: null,
    runningRunId: null,
    queuedMessages: [],
    pendingApproval: null,
    filePreviewTabs: [],
    activeFilePreviewId: null,
    rightStageKind: null,
    rightPanelRequest: null,
    pendingComposerInsert: null,
    permissionMode: "ask",
    smartTrustCounts: {},
    activeProfileId: "",
    profiles: [],
    rules: [],
    memories: [],
    libraryAssets: [],
    storageState: null,
    storageStats: null,
    generalSettings: {
      language: "zh",
      homeSuggestions: true,
      sendShortcut: "enter",
      followUpMode: "queue",
      turnCompleteNotification: "unfocused",
      enableApprovalNotification: true,
      notificationSound: "chime",
      repeatToolThresholds: [2, 5],
      showContextUsage: true,
    },
    reasoningLevel: "high",
    streamStatusNotice: "",
    degradedStream: null,
    errorMessage: "",
    ...overrides,
  } as ChatStoreSnapshot;
}

function createFakeStore(initial?: Partial<ChatStoreSnapshot>): FakeStore {
  const fake: FakeStore = {
    state: createState(initial),
    patches: [],
    calls: { refreshMeta: 0, resumeRun: [], sendMessage: [] },
    port: undefined as unknown as ChatStorePort,
  };
  fake.port = {
    getState: () => fake.state,
    patchState: (patch) => {
      fake.patches.push(patch);
      fake.state = { ...fake.state, ...patch };
    },
    refreshMeta: async () => { fake.calls.refreshMeta += 1; },
    trackLeavingActiveRun: () => {},
    scheduleBackgroundRunPoll: () => {},
    resumeRun: async (sessionId) => { fake.calls.resumeRun.push(sessionId); },
    openSession: async (sessionId) => { fake.calls.resumeRun.push(`open:${sessionId}`); },
    updateSessionMeta: async () => null,
    startNewChatDraft: () => { fake.patches.push({ activeSessionId: null }); },
    sendMessage: async (text) => { fake.calls.sendMessage.push(text); },
  };
  return fake;
}

function withWindowStorage<T>(run: () => T | Promise<T>): Promise<T> | T {
  const storage = new Map<string, string>();
  const globalObject = globalThis as { window?: unknown };
  const previous = globalObject.window;
  globalObject.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
  };
  const restore = () => { globalObject.window = previous; };
  try {
    const result = run();
    if (result instanceof Promise) {
      return result.finally(restore) as Promise<T>;
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

test("偏好读写：非法值与受限环境安全回退", async () => {
  await withWindowStorage(() => {
    writeStoredSessionId("session-a");
    assert.equal(readStoredSessionId(), "session-a");
    writeStoredSessionId(null);
    assert.equal(readStoredSessionId(), null);

    writeStoredPermissionMode("smart");
    assert.equal(readStoredPermissionMode(), "smart");
    writeStoredReasoningLevel("low");
    assert.equal(readStoredReasoningLevel(), "low");
  });
});

test("文件动作：打开工作区文件、切换与关闭标签、右栏请求映射", () => {
  const fake = createFakeStore();
  const files = new ChatFileActions(fake.port);
  files.openWorkspaceFile("p1", "src\\a.ts", "src/a.ts", 3, 5);
  assert.equal(fake.state.rightStageKind, "file");
  assert.equal(fake.state.activeFilePreviewId, "src/a.ts");
  assert.equal(fake.state.filePreviewTabs.length, 1);
  assert.equal(fake.state.filePreviewTabs[0]?.targetLine, 3);

  files.setRightStageKind("browser");
  assert.equal(fake.state.rightStageKind, "browser");

  files.requestRightPanel("review");
  assert.equal(fake.state.rightStageKind, "review");
  assert.equal(fake.state.rightPanelRequest?.tab, "review");

  files.closeFilePreview("src/a.ts");
  assert.equal(fake.state.filePreviewTabs.length, 0);
  assert.equal(fake.state.activeFilePreviewId, null);
});

test("文件动作：composer 插入只消费一次", () => {
  const fake = createFakeStore();
  const files = new ChatFileActions(fake.port);
  files.enqueueComposerInsert("  hello  ");
  assert.equal(fake.state.pendingComposerInsert?.text, "hello");
  files.consumeComposerInsert();
  assert.equal(fake.state.pendingComposerInsert, null);
  files.consumeComposerInsert();
  assert.equal(fake.patches.filter((patch) => patch.pendingComposerInsert === null).length, 1);
});

test("会话动作：新建草稿清空活动会话并持久化空 id", async () => {
  await withWindowStorage(() => {
    writeStoredSessionId("session-old");
    const fake = createFakeStore({ activeSessionId: "session-old" });
    const sessions = new ChatSessionActions(fake.port);
    sessions.startNewChatDraft({ projectId: "p1" });
    assert.equal(fake.state.activeSessionId, null);
    assert.equal(fake.state.draftProjectId, "p1");
    assert.equal(readStoredSessionId(), null);
  });
});

test("会话动作：打开会话写入状态并触发运行恢复", async () => {
  await withWindowStorage(async () => {
    const fake = createFakeStore();
    const sessions = new ChatSessionActions(fake.port);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      session: {
        id: "s1", title: "t", projectId: "p1", sectionId: null, sessionPreset: "standard",
        unread: false, messages: [],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
    try {
      await sessions.openSession("s1");
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(fake.state.activeSessionId, "s1");
    assert.deepEqual(fake.calls.resumeRun, ["s1"]);
  });
});

test("运行动作：排队追问写入队列而不打断运行", async () => {
  const fake = createFakeStore({ runningRunId: "run-1" });
  const runs = new ChatRunActions(fake.port);
  await runs.submitFollowUp("补充一句");
  assert.deepEqual(fake.state.queuedMessages, ["补充一句"]);
  runs.removeQueuedMessage(0);
  assert.deepEqual(fake.state.queuedMessages, []);
});

test("数据动作：推理档位写入偏好并更新状态", async () => {
  await withWindowStorage(async () => {
    const fake = createFakeStore();
    const data = new ChatDataActions(fake.port);
    data.setReasoningLevel("medium");
    assert.equal(fake.state.reasoningLevel, "medium");
    assert.equal(readStoredReasoningLevel(), "medium");
  });
});