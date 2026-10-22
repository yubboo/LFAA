/**
 * 功能：适配浏览器的真实语音识别与播报能力。
 * 作用：检测宿主能力，识别结果交给输入框，取消时停止麦克风与播报；不模拟识别结果。
 * 关联文件：AiWorkChat.tsx、settings/service.ts 的语音开关与常规语言设置。
 */
interface RecognitionResult extends ArrayLike<{ transcript: string }> { isFinal?: boolean; }
interface RecognitionEvent { results: ArrayLike<RecognitionResult>; resultIndex?: number; }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
function recognitionConstructor(): (new () => Recognition) | undefined {
  const browser = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
export function supportsVoiceInput(): boolean { return Boolean(recognitionConstructor()) && window.isSecureContext; }
export function supportsVoiceOutput(): boolean { return "speechSynthesis" in window; }
export function voiceLanguage(language: string): string { return language === "system" ? navigator.language : language; }
interface VoiceInputOptions { interimResults?: boolean; completeOnEnd?: boolean; onActivity?: (activity: number) => void; }
export function startVoiceInput(language: string, onText: (text: string) => void, onError: (message: string) => void, onEnd: () => void, options: VoiceInputOptions = {}): () => void {
  const Constructor = recognitionConstructor();
  if (!Constructor || !window.isSecureContext) throw new Error("当前宿主不支持语音识别，请使用支持该能力的浏览器与安全连接。");
  const recognition = new Constructor();
  let accumulatedFinalText = "";
  recognition.lang = voiceLanguage(language); recognition.continuous = false; recognition.interimResults = options.interimResults ?? false;
  recognition.onresult = event => {
    const results = Array.from(event.results);
    if (!options.interimResults) {
      const text = results.map(result => result[0]?.transcript ?? "").join("").trim();
      if (text) onText(text);
      return;
    }
    const activityStart = Math.max(0, Math.min(event.resultIndex ?? 0, results.length - 1));
    const activityText = results.slice(activityStart).map(result => result[0]?.transcript ?? "").join("").trim();
    if (activityText) options.onActivity?.(Math.min(1, 0.52 + Math.min(activityText.length, 20) * 0.024));
    accumulatedFinalText = results.filter(result => result.isFinal !== false).map(result => result[0]?.transcript ?? "").join("").trim();
    if (accumulatedFinalText && !options.completeOnEnd) onText(accumulatedFinalText);
  };
  recognition.onerror = event => onError(`语音识别失败：${event.error}`);
  recognition.onend = () => { if (options.completeOnEnd && accumulatedFinalText) onText(accumulatedFinalText); onEnd(); };
  recognition.start();
  return () => { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); };
}
export function stopVoicePlayback(): void { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }
export function readResponseAloud(text: string, language: string, callbacks: { onEnd?: () => void; onError?: (message: string) => void } = {}): void {
  if (!("speechSynthesis" in window)) throw new Error("当前宿主不支持语音播报。");
  stopVoicePlayback();
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = voiceLanguage(language);
  utterance.onend = () => callbacks.onEnd?.();
  utterance.onerror = event => callbacks.onError?.(`语音播报失败：${event.error}`);
  window.speechSynthesis.speak(utterance);
}
