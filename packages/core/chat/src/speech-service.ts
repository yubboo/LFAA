// 为 Host 侧提供零外网依赖的本机离线 WAV 语音转文字能力（Windows System.Speech SAPI）。
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_WAV_BYTES = 15 * 1024 * 1024;
const POWERSHELL_TIMEOUT_MS = 35_000;

export interface SpeechTranscribeResult {
  text: string;
  engine: string;
}

// 校验最小 44 字节 RIFF/WAVE PCM 文件头与大小上限，防止损坏数据或过大载荷进入系统识别器。
export function assertValidWavBuffer(wavBuffer: Buffer): void {
  if (!Buffer.isBuffer(wavBuffer) || wavBuffer.length < 44) {
    throw new Error("无效的 WAV 音频数据（文件过短）。");
  }
  if (wavBuffer.length > MAX_WAV_BYTES) {
    throw new Error("录音音频超过 15 MB 上限，请分段语音输入。");
  }
  const riff = wavBuffer.subarray(0, 4).toString("ascii");
  const wave = wavBuffer.subarray(8, 12).toString("ascii");
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("音频格式不受支持，仅支持 RIFF/WAVE PCM 录音。");
  }
}

const WIN_TRANSCRIBE_PS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$wavPath = $env:LFAA_WAV_PATH
$lang = $env:LFAA_SPEECH_LANG
if ([string]::IsNullOrWhiteSpace($lang)) { $lang = 'zh-CN' }

Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Speech.Recognition;
using System.Threading;

public static class LfaaOfflineSpeech {
  public static string Transcribe(string wavPath, string cultureName) {
    var installed = SpeechRecognitionEngine.InstalledRecognizers();
    if (installed.Count == 0) {
      throw new InvalidOperationException("LFAA_NO_RECOGNIZER");
    }
    RecognizerInfo chosen = null;
    string langPrefix = cultureName.Split('-')[0];
    foreach (var info in installed) {
      if (string.Equals(info.Culture.Name, cultureName, StringComparison.OrdinalIgnoreCase)) {
        chosen = info;
        break;
      }
    }
    if (chosen == null) {
      foreach (var info in installed) {
        if (info.Culture.TwoLetterISOLanguageName.Equals(langPrefix, StringComparison.OrdinalIgnoreCase)) {
          chosen = info;
          break;
        }
      }
    }
    if (chosen == null) {
      chosen = installed[0];
    }

    using (var rec = new SpeechRecognitionEngine(chosen)) {
      rec.LoadGrammar(new DictationGrammar());
      var parts = new List<string>();
      var done = new ManualResetEventSlim(false);
      Exception asyncErr = null;
      rec.SpeechRecognized += (s, e) => {
        if (e.Result != null && !string.IsNullOrWhiteSpace(e.Result.Text)) {
          parts.Add(e.Result.Text.Trim());
        }
      };
      rec.RecognizeCompleted += (s, e) => {
        if (e != null && e.Error != null) {
          asyncErr = e.Error;
        }
        done.Set();
      };
      rec.SetInputToWaveFile(wavPath);
      rec.RecognizeAsync(RecognizeMode.Multiple);
      done.Wait(30000);
      rec.SetInputToNull();
      if (asyncErr != null) {
        throw asyncErr;
      }
      return string.Join(" ", parts);
    }
  }
}
"@

$text = [LfaaOfflineSpeech]::Transcribe($wavPath, $lang)
Write-Output $text
`;

function encodePowerShellUtf16(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function normalizeCultureTag(lang?: string): string {
  if (!lang || !lang.trim()) return "zh-CN";
  const clean = lang.trim();
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/.test(clean)) return "zh-CN";
  return clean;
}

// 调用本机操作系统离线语音识别引擎对 WAV 录音进行转写。
export async function transcribeWavAudio(
  wavBuffer: Buffer,
  lang?: string,
): Promise<SpeechTranscribeResult> {
  assertValidWavBuffer(wavBuffer);

  if (process.platform !== "win32") {
    throw new Error("当前系统平台尚未配置本地离线语音识别引擎。");
  }

  const cultureTag = normalizeCultureTag(lang);
  const tempPath = path.join(os.tmpdir(), `lfaa-speech-${randomUUID()}.wav`);
  await fs.writeFile(tempPath, wavBuffer);

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodePowerShellUtf16(WIN_TRANSCRIBE_PS_SCRIPT)],
      {
        env: {
          ...process.env,
          LFAA_WAV_PATH: tempPath,
          LFAA_SPEECH_LANG: cultureTag,
        },
        timeout: POWERSHELL_TIMEOUT_MS,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
      },
    );
    return {
      text: stdout.trim(),
      engine: "windows-sapi",
    };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    if (rawMsg.includes("LFAA_NO_RECOGNIZER")) {
      throw new Error("本机 Windows 未安装可用的离线语音识别语言包，请在系统「时间和语言 → 语音」中安装。");
    }
    throw new Error(`本地语音识别执行失败：${rawMsg}`);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}
