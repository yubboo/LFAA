import os from "node:os";
import { spawn } from "node:child_process";

const sampleIntervalMs = 10_000;
const sampleTimeoutMs = 30_000;
const providerRestartDelayMs = 30_000;
const maximumOutputLineLength = 4096;

const powershellScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
while ($true) {
  $diskTotalBytes = $null
  $diskFreeBytes = $null
  try {
    $volumes = @(Get-Volume -ErrorAction Stop | Where-Object { $_.DriveType -eq 'Fixed' -and $_.Size -gt 0 -and $null -ne $_.SizeRemaining })
    if ($volumes.Count -gt 0) {
      $diskTotalBytes = [double](($volumes | Measure-Object -Property Size -Sum).Sum)
      $diskFreeBytes = [double](($volumes | Measure-Object -Property SizeRemaining -Sum).Sum)
    }
  } catch {}

  $networkInterfaceIndex = $null
  $receivedBytes = $null
  $sentBytes = $null
  try {
    $route = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop | ForEach-Object {
      $candidate = $_
      $interface = Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $candidate.InterfaceIndex -ErrorAction Stop | Select-Object -First 1
      [pscustomobject]@{ InterfaceIndex = $candidate.InterfaceIndex; InterfaceAlias = $candidate.InterfaceAlias; Metric = [long]$candidate.RouteMetric + [long]$interface.InterfaceMetric }
    } | Sort-Object -Property Metric | Select-Object -First 1
    if ($null -ne $route -and $route.InterfaceAlias) {
      $statistics = Get-NetAdapterStatistics -Name $route.InterfaceAlias -ErrorAction Stop
      $networkInterfaceIndex = [int]$route.InterfaceIndex
      $receivedBytes = [string]$statistics.ReceivedBytes
      $sentBytes = [string]$statistics.SentBytes
    }
  } catch {}

  $sample = [ordered]@{
    sampledAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    diskTotalBytes = $diskTotalBytes
    diskFreeBytes = $diskFreeBytes
    networkInterfaceIndex = $networkInterfaceIndex
    receivedBytes = $receivedBytes
    sentBytes = $sentBytes
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $sample -Compress))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds ${sampleIntervalMs}
}
`;

const powershellPath = process.env.SystemRoot
  ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  : "powershell.exe";
const encodedCommand = Buffer.from(powershellScript, "utf16le").toString("base64");

function cpuCounters() {
  const cores = os.cpus();
  if (!cores.length) return null;
  let idle = 0;
  let total = 0;
  for (const core of cores) {
    idle += core.times.idle;
    total += core.times.user + core.times.nice + core.times.sys + core.times.irq + core.times.idle;
  }
  return Number.isFinite(idle) && Number.isFinite(total) && total > 0 ? { idle, total, count: cores.length } : null;
}

function percent(used, total) {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0 || used < 0 || used > total) return null;
  return Math.round((used / total) * 10_000) / 100;
}

function safeBytes(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function parseCounter(value) {
  if (typeof value !== "string" || !/^\d{1,24}$/u.test(value)) return null;
  try { return BigInt(value); } catch { return null; }
}

function buildSample(raw, previousRaw, previousCpu, sampledAt) {
  const currentCpu = cpuCounters();
  let cpuUsagePercent = null;
  if (currentCpu && previousCpu && currentCpu.count === previousCpu.count) {
    const totalDelta = currentCpu.total - previousCpu.total;
    const idleDelta = currentCpu.idle - previousCpu.idle;
    if (totalDelta > 0 && idleDelta >= 0 && idleDelta <= totalDelta) {
      cpuUsagePercent = Math.round(((totalDelta - idleDelta) / totalDelta) * 10_000) / 100;
    }
  }

  const memoryTotalBytes = safeBytes(os.totalmem());
  const memoryFreeBytes = safeBytes(os.freemem());
  const memoryUsedBytes = memoryTotalBytes !== null && memoryFreeBytes !== null && memoryFreeBytes <= memoryTotalBytes
    ? memoryTotalBytes - memoryFreeBytes
    : null;

  const diskTotalBytes = safeBytes(raw.diskTotalBytes);
  const diskFreeBytes = safeBytes(raw.diskFreeBytes);
  const diskUsedBytes = diskTotalBytes !== null && diskFreeBytes !== null && diskFreeBytes <= diskTotalBytes
    ? diskTotalBytes - diskFreeBytes
    : null;

  const receivedCounter = raw.receivedCounter;
  const sentCounter = raw.sentCounter;
  const sameNetworkInterface = previousRaw
    && Number.isSafeInteger(raw.networkInterfaceIndex)
    && raw.networkInterfaceIndex === previousRaw.networkInterfaceIndex;
  const intervalSeconds = previousRaw ? (sampledAt - previousRaw.sampledAt) / 1000 : 0;
  const networkRate = (current, previous) => {
    if (!sameNetworkInterface || current === null || current === undefined || previous === null || previous === undefined
      || intervalSeconds <= 0 || intervalSeconds > 300 || current < previous) return null;
    const rate = Number(current - previous) / intervalSeconds;
    return Number.isFinite(rate) && rate >= 0 ? Math.round(rate * 100) / 100 : null;
  };

  return {
    sampledAt: new Date(sampledAt).toISOString(),
    cpuUsagePercent,
    memoryUsedBytes,
    memoryTotalBytes,
    memoryUsagePercent: memoryUsedBytes !== null && memoryTotalBytes !== null ? percent(memoryUsedBytes, memoryTotalBytes) : null,
    diskUsedBytes,
    diskTotalBytes,
    diskUsagePercent: diskUsedBytes !== null && diskTotalBytes !== null ? percent(diskUsedBytes, diskTotalBytes) : null,
    networkReceiveBytesPerSecond: networkRate(receivedCounter, previousRaw?.receivedCounter),
    networkSendBytesPerSecond: networkRate(sentCounter, previousRaw?.sentCounter)
  };
}

/**
 * 功能：采集 Daemon 所在 Windows 节点的整机资源快照。
 * 作用：以单个长期运行、只读的 PowerShell 提供器取得固定卷和默认网卡计数；CPU/内存由 Node 系统 API 读取。
 * 关联文件：packages/host/daemon/src/daemon.mjs、packages/host/daemon/src/local-daemon.ts。
 */
export function createSystemResourceTelemetrySampler() {
  let provider = null;
  let restartTimer = null;
  let watchdogTimer = null;
  let stopped = false;
  let latest = null;
  let previousCpu = null;
  let previousRaw = null;
  let lastSampleReceivedAt = 0;
  let outputBuffer = "";

  const scheduleRestart = () => {
    if (stopped || restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      startProvider();
    }, providerRestartDelayMs);
    restartTimer.unref?.();
  };

  const acceptLine = (line) => {
    if (line.length > maximumOutputLineLength) return;
    let raw;
    try { raw = JSON.parse(line); } catch { return; }
    if (!raw || typeof raw !== "object" || !Number.isSafeInteger(raw.sampledAt) || raw.sampledAt <= 0) return;

    const sampledAt = raw.sampledAt;
    const receivedCounter = parseCounter(raw.receivedBytes);
    const sentCounter = parseCounter(raw.sentBytes);
    const rawSample = {
      sampledAt,
      networkInterfaceIndex: raw.networkInterfaceIndex,
      receivedCounter,
      sentCounter,
      diskTotalBytes: raw.diskTotalBytes,
      diskFreeBytes: raw.diskFreeBytes
    };
    latest = buildSample(rawSample, previousRaw, previousCpu, sampledAt);
    previousRaw = rawSample;
    previousCpu = cpuCounters();
    lastSampleReceivedAt = Date.now();
  };

  const startProvider = () => {
    if (stopped || provider) return;
    outputBuffer = "";
    previousRaw = null;
    previousCpu = cpuCounters();
    lastSampleReceivedAt = Date.now();
    let child;
    try {
      child = spawn(powershellPath, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"]
      });
    } catch {
      scheduleRestart();
      return;
    }
    provider = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      outputBuffer += chunk;
      let newlineIndex = outputBuffer.indexOf("\n");
      while (newlineIndex >= 0) {
        acceptLine(outputBuffer.slice(0, newlineIndex).trim());
        outputBuffer = outputBuffer.slice(newlineIndex + 1);
        newlineIndex = outputBuffer.indexOf("\n");
      }
      if (outputBuffer.length > maximumOutputLineLength) outputBuffer = "";
    });
    const childWatchdog = setInterval(() => {
      if (provider !== child || Date.now() - lastSampleReceivedAt <= sampleTimeoutMs) return;
      provider = null;
      if (watchdogTimer === childWatchdog) watchdogTimer = null;
      clearInterval(childWatchdog);
      child.kill();
      scheduleRestart();
    }, sampleIntervalMs);
    watchdogTimer = childWatchdog;
    childWatchdog.unref?.();
    child.once("error", () => {
      if (provider !== child) return;
      provider = null;
      clearInterval(childWatchdog);
      if (watchdogTimer === childWatchdog) watchdogTimer = null;
      scheduleRestart();
    });
    child.once("exit", () => {
      if (provider !== child) return;
      provider = null;
      clearInterval(childWatchdog);
      if (watchdogTimer === childWatchdog) watchdogTimer = null;
      scheduleRestart();
    });
  };

  return {
    start() {
      stopped = false;
      if (!provider) startProvider();
    },
    stop() {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      restartTimer = null;
      if (watchdogTimer) clearInterval(watchdogTimer);
      watchdogTimer = null;
      const child = provider;
      provider = null;
      if (child && child.exitCode === null) child.kill();
      latest = null;
      previousCpu = null;
      previousRaw = null;
      lastSampleReceivedAt = 0;
      outputBuffer = "";
    },
    isAvailable() {
      return Boolean(provider?.pid && provider.exitCode === null && !provider.killed);
    },
    getLatest() {
      return latest;
    }
  };
}
