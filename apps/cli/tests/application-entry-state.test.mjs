import assert from "node:assert/strict";
import test from "node:test";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { APPLICATION_ENTRY_STATE_KEY, readApplicationEntryIdFromHistory } from "../../../packages/client/ui-renderer/src/application-entry-state.ts";

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
