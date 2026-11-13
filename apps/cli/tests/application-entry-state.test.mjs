import assert from "node:assert/strict";
import test from "node:test";
import { APPLICATION_IDS, WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { APPLICATION_ENTRY_STATE_KEY, WORK_CONTEXT_APPLICATION_STATE_KEY, readApplicationEntryIdFromHistory, readWorkContextApplicationIdFromHistory } from "../../../packages/client/ui-renderer/src/application-entry-state.ts";

test("application history entry accepts every registered app including AI video", () => {
  for (const applicationId of APPLICATION_IDS) {
    assert.equal(readApplicationEntryIdFromHistory({ [APPLICATION_ENTRY_STATE_KEY]: applicationId }), applicationId);
  }
});

test("application history entry rejects missing, malformed, and unknown app IDs", () => {
  for (const state of [null, [], {}, { [APPLICATION_ENTRY_STATE_KEY]: "unknown" }, { [APPLICATION_ENTRY_STATE_KEY]: 3 }]) {
    assert.equal(readApplicationEntryIdFromHistory(state), null);
  }
});

test("通用 Work 历史入口只接受领域 App 上下文，不把 workspace 当成领域 App", () => {
  for (const applicationId of WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS) {
    assert.equal(readWorkContextApplicationIdFromHistory({ [WORK_CONTEXT_APPLICATION_STATE_KEY]: applicationId }), applicationId);
  }
  for (const state of [null, [], {}, { [WORK_CONTEXT_APPLICATION_STATE_KEY]: "workspace" }, { [WORK_CONTEXT_APPLICATION_STATE_KEY]: "unknown" }, { [WORK_CONTEXT_APPLICATION_STATE_KEY]: 3 }]) {
    assert.equal(readWorkContextApplicationIdFromHistory(state), null);
  }
});
