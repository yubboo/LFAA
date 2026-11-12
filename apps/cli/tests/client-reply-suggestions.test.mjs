/** 功能：锁定聊天回复建议在消费后立即消失、历史重载后仍隐藏并防止快速重复提交。 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  hideSubmittedReplySuggestions,
  consumeReplySuggestion,
  ReplySuggestionSubmissionGate
} from "../../../packages/client/ui-chat/src/reply-suggestions.ts";

const firstSuggestion = "304 响应可以携带哪些头字段？";
const secondSuggestion = "浏览器什么时候会发送完整请求？";

function createMessages() {
  return [
    { id: "assistant-1", role: "assistant", status: "complete", content: "HTTP 缓存回答。", promptSuggestions: [firstSuggestion, secondSuggestion] },
    { id: "user-1", role: "user", status: "complete", content: "304 响应可以携带哪些头字段？" },
    { id: "assistant-2", role: "assistant", status: "complete", content: "304 响应头回答。", promptSuggestions: ["ETag 与 Last-Modified 有什么区别？"] }
  ];
}

test("消费一条建议后立即隐藏它，重载历史时按后续同文用户消息继续隐藏", () => {
  const messages = createMessages().filter(message => message.id === "assistant-1");

  assert.deepEqual(messages[0].promptSuggestions, [firstSuggestion, secondSuggestion]);

  const immediatelyConsumed = consumeReplySuggestion(messages, "assistant-1", secondSuggestion);
  assert.deepEqual(immediatelyConsumed[0].promptSuggestions, [firstSuggestion]);

  const reloadedMessages = hideSubmittedReplySuggestions(createMessages());
  assert.deepEqual(reloadedMessages.find(message => message.id === "assistant-1").promptSuggestions, [secondSuggestion]);
  assert.deepEqual(reloadedMessages.find(message => message.id === "assistant-2").promptSuggestions, ["ETag 与 Last-Modified 有什么区别？"]);
});

test("请求仍在途时快速重复点击只提交一次，完成后已消费建议仍不可再次提交", async () => {
  const gate = new ReplySuggestionSubmissionGate();
  let messages = createMessages().filter(message => message.id === "assistant-1");
  let sendCount = 0;
  let releaseSend;
  const sendPending = new Promise(resolve => { releaseSend = resolve; });
  const submit = suggestion => {
    sendCount += 1;
    assert.equal(suggestion, secondSuggestion);
    return sendPending;
  };
  const input = {
    suggestion: secondSuggestion,
    canSubmit: () => messages.find(message => message.id === "assistant-1")?.promptSuggestions?.includes(secondSuggestion) ?? false,
    consume: () => { messages = consumeReplySuggestion(messages, "assistant-1", secondSuggestion); },
    send: submit
  };

  assert.equal(gate.submit(input), true);
  assert.equal(gate.submit(input), false);
  assert.equal(sendCount, 1);
  assert.deepEqual(messages[0].promptSuggestions, [firstSuggestion]);

  releaseSend();
  await sendPending;
  await new Promise(resolve => setImmediate(resolve));

  messages = hideSubmittedReplySuggestions([
    ...messages,
    { id: "user-1", role: "user", status: "complete", content: secondSuggestion }
  ]);
  assert.equal(gate.submit(input), false);
  assert.equal(sendCount, 1);
});
