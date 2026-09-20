/**
 * 文件：ai-settings-client.ts
 * 作用：Web 浏览器宿主访问本地 AI 配置 Bridge 的 Client Adapter。
 * 负责：同源 HTTP 请求、错误映射、ChatGPT 官方登录弹窗编排、把 Host API 适配为 AgentAiSettingsHost。
 * 不负责：Provider URL、Secret 持久化、Codex Token、业务规则、UI。
 * 状态归属：仅在一次 connectSubscription 调用栈内持有 loginId / popup 引用，无持久状态。
 * 对外接口：webAiSettingsHost。
 * 关联文件：@lfaa/settings-controller、@lfaa/config-system。
 * 修改注意事项：Secret/LoginId 只允许存在于内存与同源请求；禁止 console/localStorage/sessionStorage/URL；ChatGPT Token 永远不进入本层。
 */
import type {
  AiAccountDraft,
  AiAccountProbeResult,
  AiAccountSnapshot,
  AiManagedLoginStart,
  AiManagedLoginStatus,
  AiModelSettingValue,
} from "@lfaa/config-system";

const BASE = "/__lfaa/dev/ai";
/** 登录通知轮询间隔；统一变量方便未来调节，不把交互手感数字散落在流程里。 */
const MANAGED_LOGIN_POLL_MS = 800;
/** 单次浏览器登录最多等待 5 分钟，超时主动取消 App Server 登录会话。 */
const MANAGED_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const LOGIN_POPUP_NAME = "lfaa_chatgpt_login";
const LOGIN_POPUP_FEATURES = "popup,width=560,height=760";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json() as { ok: boolean; error?: string } & T;
  if (!response.ok || !payload.ok) throw new Error(payload.error || `AI Host 请求失败：${response.status}`);
  return payload;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isAllowedLoginUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    return url.hostname === "chatgpt.com"
      || url.hostname.endsWith(".chatgpt.com")
      || url.hostname === "openai.com"
      || url.hostname.endsWith(".openai.com");
  } catch {
    return false;
  }
}

async function cancelManagedLogin(loginId: string): Promise<void> {
  await request(`/managed-login/${encodeURIComponent(loginId)}`, { method: "DELETE" }).catch(() => undefined);
}

export const webAiSettingsHost = {
  async snapshot() {
    const payload = await request<AiAccountSnapshot>("/accounts");
    return {
      accounts: payload.accounts,
      activeModel: payload.activeModel,
      secretPersistence: payload.secretPersistence,
      hostCapabilities: payload.hostCapabilities,
    };
  },
  async probe(draft: AiAccountDraft, secret: string) {
    const payload = await request<{ probe: AiAccountProbeResult }>("/probe", { method: "POST", body: JSON.stringify({ draft, secret }) });
    return payload.probe;
  },
  async save(draft: AiAccountDraft, secret: string) {
    const payload = await request<{ probe: AiAccountProbeResult; snapshot: AiAccountSnapshot }>("/accounts", { method: "POST", body: JSON.stringify({ draft, secret }) });
    return { probe: payload.probe, snapshot: payload.snapshot };
  },
  async connectSubscription(draft: AiAccountDraft) {
    // 必须在首次 await 前创建窗口，否则浏览器会把异步 window.open 识别成非用户手势而拦截。
    const popup = window.open("about:blank", LOGIN_POPUP_NAME, LOGIN_POPUP_FEATURES);
    if (!popup) throw new Error("浏览器阻止了 ChatGPT 登录弹窗。请允许本站弹窗后重试。");
    try { popup.opener = null; } catch { /* 某些浏览器不允许重写 opener，不影响固定官方域名校验。 */ }

    let loginId: string | null = null;
    let loginCompleted = false;
    try {
      const started = await request<{ login: AiManagedLoginStart }>("/managed-login/start", {
        method: "POST",
        body: JSON.stringify({ draft }),
      });
      loginId = started.login.loginId;
      if (!isAllowedLoginUrl(started.login.authUrl)) {
        throw new Error("Codex App Server 返回的登录地址不在 OpenAI / ChatGPT 官方域名内，已停止打开。");
      }
      if (popup.closed) throw new Error("ChatGPT 登录窗口已关闭，登录已取消。");
      popup.location.replace(started.login.authUrl);

      const deadline = Date.now() + MANAGED_LOGIN_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (popup.closed) throw new Error("ChatGPT 登录窗口已关闭，登录已取消。");
        const payload = await request<{ status: AiManagedLoginStatus }>(`/managed-login/${encodeURIComponent(loginId)}`);
        if (payload.status.state === "succeeded") {
          loginCompleted = true;
          popup.close();
          const result = await request<{ probe: AiAccountProbeResult; snapshot: AiAccountSnapshot }>("/subscription/accounts", {
            method: "POST",
            body: JSON.stringify({ draft }),
          });
          return { probe: result.probe, snapshot: result.snapshot };
        }
        if (payload.status.state === "failed") throw new Error(payload.status.error);
        await sleep(MANAGED_LOGIN_POLL_MS);
      }
      throw new Error("ChatGPT 登录等待超时，请重新发起登录。");
    } catch (error) {
      if (loginId && !loginCompleted) await cancelManagedLogin(loginId);
      throw error;
    } finally {
      if (!popup.closed) popup.close();
    }
  },
  async reprobe(accountId: string) {
    const payload = await request<{ probe: AiAccountProbeResult; snapshot: AiAccountSnapshot }>(`/accounts/${encodeURIComponent(accountId)}/probe`, { method: "POST", body: "{}" });
    return { probe: payload.probe, snapshot: payload.snapshot };
  },
  async deleteAccount(accountId: string) {
    const payload = await request<{ snapshot: AiAccountSnapshot }>(`/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
    return payload.snapshot;
  },
  async selectModel(accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiModelSettingValue>>) {
    const payload = await request<{ snapshot: AiAccountSnapshot }>(`/accounts/${encodeURIComponent(accountId)}/model`, { method: "POST", body: JSON.stringify({ modelId, modelSettings }) });
    return payload.snapshot;
  },
  async setActiveModel(accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiModelSettingValue>>) {
    const payload = await request<{ snapshot: AiAccountSnapshot }>(`/accounts/${encodeURIComponent(accountId)}/active-model`, { method: "POST", body: JSON.stringify({ modelId, modelSettings }) });
    return payload.snapshot;
  },
  async activateModel(accountId: string) {
    const payload = await request<{ snapshot: AiAccountSnapshot }>(`/accounts/${encodeURIComponent(accountId)}/active`, { method: "POST", body: "{}" });
    return payload.snapshot;
  },
};
