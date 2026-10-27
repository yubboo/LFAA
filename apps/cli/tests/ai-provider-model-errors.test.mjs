/** 功能：回归 DeepSeek 真实模型错误码的用户反馈映射。作用：用隔离模拟响应区分余额不足与参数错误，不发送真实 Provider 请求。 */
import test from "node:test";
import assert from "node:assert/strict";

test("DeepSeek HTTP 402 显示余额不足，不误导用户检查模型参数", async () => {
  const originalFetch = globalThis.fetch;
  let modelRequests = 0;
  let inferenceRequests = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://api.deepseek.com/models" && init.method === "GET") {
      modelRequests += 1;
      return Response.json({ data: [{ id: "deepseek-flash", name: "DeepSeek-V4.1-Flash" }] });
    }
    if (url === "https://api-docs.deepseek.com/zh-cn/updates/") {
      return new Response("<h2>DeepSeek-V4.1-Flash-1017</h2>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url === "https://api.deepseek.com/chat/completions") {
      inferenceRequests += 1;
      return Response.json({ error: { message: "Insufficient Balance" } }, { status: 402 });
    }
    throw new Error(`未登记模拟 Provider 请求：${url}`);
  };
  try {
    const { testAiProviderModel } = await import("lfaa-settings/src/service.js");
    await assert.rejects(
      testAiProviderModel("fixture-user", {
        providerId: "deepseek",
        secret: "synthetic-fixture-key",
        options: {},
        modelId: "deepseek-flash",
        reasoningMode: "default"
      }),
      /DeepSeek API 返回 HTTP 402（余额不足）/u
    );
    assert.equal(modelRequests, 1, "模型目录探测只调用模拟目录一次");
    assert.equal(inferenceRequests, 1, "真实模型测试只调用模拟推理一次");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
