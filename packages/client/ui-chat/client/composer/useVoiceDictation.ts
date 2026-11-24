// 管理聊天输入栏的语音听写状态与双引擎切换（优先浏览器在线识别，network 失败自动无缝切换本机离线 WAV 转写）。
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatSpeechErrorMessage,
  SPEECH_PREFER_LOCAL_STORAGE_KEY,
  startLocalMicrophoneWavRecorder,
  uint8ArrayToBase64,
  type LocalWavRecorder,
} from "./local-speech";
import type { ChatLocaleMessages } from "../locales";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// 将基础草稿与实时语音识别片段合并，避免多段语音拼接丢失空格或覆盖既有内容。
export function mergeDictationTranscript(baseDraft: string, transcript: string): string {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) return baseDraft;
  const cleanBase = baseDraft.trimEnd();
  if (!cleanBase) return cleanTranscript;
  return `${cleanBase} ${cleanTranscript}`;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function readPreferLocalSpeech(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(SPEECH_PREFER_LOCAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function savePreferLocalSpeech(): void {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SPEECH_PREFER_LOCAL_STORAGE_KEY, "1");
    }
  } catch {
    // 忽略受限存储环境写入异常。
  }
}

/** 协调浏览器与本地转录、录音状态和草稿合并，并在卸载时清理录音。 */
export function useVoiceDictation({
  locale,
  draft,
  onChangeDraft,
  onNotice,
}: {
  locale: ChatLocaleMessages;
  draft: string;
  onChangeDraft: (nextDraft: string) => void;
  onNotice: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const localRecorderRef = useRef<LocalWavRecorder | null>(null);
  const preferLocalHostRef = useRef<boolean>(readPreferLocalSpeech());
  const localStartCancelledRef = useRef(false);
  const startingLocalRef = useRef(false);
  const hadSpeechResultRef = useRef(false);
  const baseDraftRef = useRef(draft);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const stopWebSpeechOnly = useCallback(() => {
    const inst = recognitionRef.current;
    recognitionRef.current = null;
    if (inst) {
      inst.onresult = null;
      inst.onerror = null;
      inst.onend = null;
      try {
        inst.stop();
      } catch {
        // 忽略已结束实例的停止异常。
      }
    }
  }, []);

  const abortAllRecorders = useCallback(() => {
    localStartCancelledRef.current = true;
    stopWebSpeechOnly();
    const localRec = localRecorderRef.current;
    localRecorderRef.current = null;
    if (localRec) {
      localRec.abort();
    }
    setRecording(false);
  }, [stopWebSpeechOnly]);

  const startLocalHostRecording = useCallback(
    async (afterNetworkFallback: boolean) => {
      if (startingLocalRef.current || localRecorderRef.current) return;
      startingLocalRef.current = true;
      try {
        const recorder = await startLocalMicrophoneWavRecorder();
        if (localStartCancelledRef.current) {
          recorder.abort();
          return;
        }
        localRecorderRef.current = recorder;
        setRecording(true);
        onNotice(locale.speechLocalRecordingNotice);
      } catch (error) {
        setRecording(false);
        onNotice(formatSpeechErrorMessage(locale, error, afterNetworkFallback));
      } finally {
        startingLocalRef.current = false;
      }
    },
    [locale, onNotice],
  );

  const stopAndTranscribeLocalRecording = useCallback(async () => {
    const recorder = localRecorderRef.current;
    localRecorderRef.current = null;
    setRecording(false);
    if (!recorder) return;

    setTranscribing(true);
    onNotice(locale.speechTranscribingNotice);
    try {
      const wavBytes = await recorder.stopAndBuildWav();
      if (wavBytes.length <= 44) {
        onNotice(locale.speechNoResultNotice);
        return;
      }

      const response = await fetch("/api/chat/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: uint8ArrayToBase64(wavBytes),
          lang: locale.isZh ? "zh-CN" : "en-US",
        }),
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) {
        onNotice(formatSpeechErrorMessage(locale, data.error ?? `HTTP ${response.status}`, false));
        return;
      }
      const recognizedText = typeof data.text === "string" ? data.text.trim() : "";
      if (!recognizedText) {
        onNotice(locale.speechNoResultNotice);
        return;
      }
      onChangeDraft(mergeDictationTranscript(baseDraftRef.current, recognizedText));
      onNotice("");
    } catch (error) {
      onNotice(formatSpeechErrorMessage(locale, error, false));
    } finally {
      setTranscribing(false);
    }
  }, [locale, onChangeDraft, onNotice]);

  const toggleRecording = useCallback(() => {
    if (transcribing) return;

    if (recording) {
      localStartCancelledRef.current = true;
      if (localRecorderRef.current) {
        void stopAndTranscribeLocalRecording();
        return;
      }
      stopWebSpeechOnly();
      setRecording(false);
      return;
    }

    localStartCancelledRef.current = false;
    onNotice("");
    baseDraftRef.current = draftRef.current;
    hadSpeechResultRef.current = false;

    const Ctor = getSpeechRecognitionCtor();
    if (preferLocalHostRef.current || !Ctor) {
      void startLocalHostRecording(false);
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = locale.isZh ? "zh-CN" : "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let collected = "";
        for (let i = 0; i < event.results.length; i += 1) {
          const seg = event.results[i]?.[0]?.transcript ?? "";
          collected += seg;
        }
        if (collected.trim()) {
          hadSpeechResultRef.current = true;
        }
        onChangeDraft(mergeDictationTranscript(baseDraftRef.current, collected));
      };
      recognition.onerror = (err) => {
        stopWebSpeechOnly();
        const code = err?.error ?? "";
        // 国内或离线环境下 Chromium SpeechRecognition 请求 Google 语音接口会立即返回 network，自动无感切换到本机离线录音识别。
        if ((code === "network" || code === "service-not-allowed") && !hadSpeechResultRef.current) {
          preferLocalHostRef.current = true;
          savePreferLocalSpeech();
          void startLocalHostRecording(true);
          return;
        }
        setRecording(false);
        const message = formatSpeechErrorMessage(locale, code, false);
        if (message) onNotice(message);
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
          setRecording(false);
        }
      };
      recognitionRef.current = recognition;
      setRecording(true);
      recognition.start();
    } catch {
      stopWebSpeechOnly();
      preferLocalHostRef.current = true;
      savePreferLocalSpeech();
      void startLocalHostRecording(true);
    }
  }, [
    locale,
    onChangeDraft,
    onNotice,
    recording,
    startLocalHostRecording,
    stopAndTranscribeLocalRecording,
    stopWebSpeechOnly,
    transcribing,
  ]);

  useEffect(() => () => abortAllRecorders(), [abortAllRecorders]);

  return { recording, transcribing, toggleRecording };
}
