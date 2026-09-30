/**
 * 功能：适配浏览器的真实语音识别与播报能力。
 * 作用：检测宿主能力，识别结果交给输入框，取消时停止麦克风与播报；不模拟识别结果。
 * 关联文件：AiWorkChat.tsx、settings/service.ts 的语音开关与常规语言设置。
 */
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
function recognitionConstructor(): (new () => Recognition) | undefined {
  const browser = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
export function supportsVoiceInput(): boolean { return Boolean(recognitionConstructor()) && window.isSecureContext; }
export function voiceLanguage(language: string): string { return language === "system" ? navigator.language : language; }
export function startVoiceInput(language: string, onText: (text: string) => void, onError: (message: string) => void, onEnd: () => void): () => void {
  const Constructor = recognitionConstructor();
  if (!Constructor || !window.isSecureContext) throw new Error("当前宿主不支持语音识别，请使用支持该能力的浏览器与安全连接。");
  const recognition = new Constructor();
  recognition.lang = voiceLanguage(language); recognition.continuous = false; recognition.interimResults = false;
  recognition.onresult = event => { const text = Array.from(event.results).map(result => result[0]?.transcript ?? "").join("").trim(); if (text) onText(text); };
  recognition.onerror = event => onError(`语音识别失败：${event.error}`);
  recognition.onend = onEnd;
  recognition.start();
  return () => { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); };
}
export function stopVoicePlayback(): void { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }
export function readResponseAloud(text: string, language: string): void {
  if (!("speechSynthesis" in window)) throw new Error("当前宿主不支持语音播报。");
  stopVoicePlayback();
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = voiceLanguage(language);
  window.speechSynthesis.speak(utterance);
}
