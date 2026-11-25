// 回归测试：验证同项目多会话可并行登记且彼此能生成准确的实时感知提示。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PeerSessionRegistry } from "./peer-sessions";

describe("PeerSessionRegistry parallel multi-session awareness", () => {
  it("allows multiple sessions in the same scope and describes active peers without blocking", () => {
    const registry = new PeerSessionRegistry();
    registry.register("project:lfaa", "sess-a", "性能优化会话");
    registry.register("project:lfaa", "sess-b", "文档编写会话");

    assert.equal(registry.list().length, 2);

    const hintForB = registry.describePeers("sess-b", "project:lfaa", new Map());
    assert.match(hintForB, /性能优化会话/u);
    assert.doesNotMatch(hintForB, /文档编写会话/u);

    const hintForOtherProject = registry.describePeers("sess-c", "project:other", new Map());
    assert.equal(hintForOtherProject, "");

    registry.release("sess-a");
    assert.equal(registry.describePeers("sess-b", "project:lfaa", new Map()), "");
  });
});
