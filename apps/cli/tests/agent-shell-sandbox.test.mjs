/**
 * 功能：验证通用 Agent Shell 的 Windows AppContainer 执行边界。
 * 作用：在临时目录中实测写入策略、工作区外拒绝、无网络、取消、Host 回执和运行 ACL 清理。
 * 关联文件：native/system/src/agent_sandbox.rs、packages/sandbox/sandbox-windows-acl。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const testHomeParent = resolve(repositoryRoot, 'dist', '.tmp');
mkdirSync(testHomeParent, { recursive: true });
const isolatedHome = mkdtempSync(join(testHomeParent, 'lfaa-agent-shell-sandbox-home-'));
const originalLfaaHome = process.env.LFAA_HOME;
const originalLfaaDataDir = process.env.LFAA_DATA_DIR;
process.env.LFAA_HOME = isolatedHome;
process.env.LFAA_DATA_DIR = join(isolatedHome, 'data');
const { WindowsAclSandboxProvider } = await import('lfaa-sandbox-windows-acl/src/index.js');
const { PwshSandboxShellExecutor } = await import('lfaa-pwsh-sandbox/src/index.js');
const { resolvePwsh } = await import('lfaa-pwsh-local/src/resolve.js');
const { createSandboxExecutionPolicy } = await import('lfaa-sandbox-policy/src/index.js');

test.after(() => {
  if (dirname(isolatedHome) !== testHomeParent) throw new Error('拒绝清理 Agent 沙箱隔离 Home 以外的目录。');
  rmSync(isolatedHome, { recursive: true, force: true });
  if (originalLfaaHome === undefined) delete process.env.LFAA_HOME;
  else process.env.LFAA_HOME = originalLfaaHome;
  if (originalLfaaDataDir === undefined) delete process.env.LFAA_DATA_DIR;
  else process.env.LFAA_DATA_DIR = originalLfaaDataDir;
});

const sandboxHostTest = { skip: process.platform !== 'win32', timeout: 120_000 };

test('Windows Agent AppContainer limits files and networking and reports real exit status', sandboxHostTest, async () => {
  const binary = resolve(repositoryRoot, 'dist/apps/daemon/target/x86_64-pc-windows-msvc/release/lfaa-sandbox-host.exe');
  assert.ok(existsSync(binary), '先构建根 dist 下的 Windows Sandbox Host');
  const powershell = resolve(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  assert.ok(existsSync(powershell), 'Windows PowerShell 5.1 必须存在');
  await recoverStaleRuns(binary, powershell);

  const testRoot = mkdtempSync(join(tmpdir(), 'lfaa-agent-shell-sandbox-'));
  const workspace = mkdtempSync(join(dirname(repositoryRoot), 'lfaa-agent-shell-sandbox-workspace-'));
  const workspaceVolumeSddl = readSddl(parse(workspace).root);
  const stateRoot = join(testRoot, 'state');
  const protectedRoot = join(testRoot, 'protected');
  mkdirSync(workspace, { recursive: true });
  mkdirSync(stateRoot, { recursive: true });
  mkdirSync(protectedRoot, { recursive: true });
  const outsideMarker = join(protectedRoot, 'secret.txt');
  const insideMarker = join(workspace, 'agent-output.txt');
  const environmentMarker = join(workspace, 'agent-environment.txt');
  writeFileSync(outsideMarker, 'private-marker', 'utf8');

  let loopbackConnected = false;
  const listener = createServer(socket => {
    loopbackConnected = true;
    socket.end('unexpected');
  });
  try {
    await new Promise((resolveListen, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', resolveListen);
    });
    const port = listener.address().port;
    const runtimeRoot = dirname(powershell);
    const nodeRuntimeRoot = dirname(process.execPath);
    const workspaceSddl = readSddl(workspace);
    const workspaceParent = dirname(workspace);
    const workspaceParentSddl = readSddl(workspaceParent);
    const relativeProjectSource = join(workspace, 'src', 'index.js');
    mkdirSync(dirname(relativeProjectSource), { recursive: true });
    writeFileSync(relativeProjectSource, 'const agentSandboxRelativePath = true;\n', 'utf8');
    const relativeProjectSourceSddl = readSddl(relativeProjectSource);
    const pwshExecutable = resolvePwsh().exe;
    const pwshRuntimeRoot = dirname(pwshExecutable);
    const pwshRuntimeRootSddl = readSddl(pwshRuntimeRoot);
    const pwshExecutableSddl = readSddl(pwshExecutable);
    const nodeRuntimeRootSddl = readSddl(nodeRuntimeRoot);
    const nodeExecutableSddl = readSddl(process.execPath);
    const shell = new PwshSandboxShellExecutor({ lfaaSandbox: new WindowsAclSandboxProvider() });
    const sandboxPolicy = createSandboxExecutionPolicy({
      mode: 'workspace-write', platform: 'win32', target: { kind: 'local' },
      workspaceRoot: workspace, workingDirectory: workspace
    });
    const parentAclProbe = `node -e 'try { require("node:fs").readdirSync(${JSON.stringify(workspaceParent)}); process.exit(31); } catch (error) { if (["EACCES", "EPERM"].includes(error.code)) process.exit(0); process.exit(32); }'`;
    const shellCwdProbe = [
      "[Console]::WriteLine(([Environment]::CurrentDirectory) + '|' + (Get-Location).Path)",
      "node -p 'process.cwd()'",
      "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
      "node --check src/index.js",
      "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
      parentAclProbe,
      "exit $LASTEXITCODE"
    ].join('; ');
    const relativePathProbe = await shell.execute(shell.resolve({
      command: shellCwdProbe,
      workdir: workspace,
      timeoutMs: 60_000,
      sandboxPolicy
    }));
    const relativePathProbeResult = await relativePathProbe.result();
    assert.equal(relativePathProbeResult.exitCode, 0, `${relativePathProbeResult.stdout.text}${relativePathProbeResult.stderr.text}`);
    assert.equal(relativePathProbeResult.sandbox?.hostVerified, true);
    assert.deepEqual(
      relativePathProbeResult.stdout.text.replaceAll('\r', '').trim().split('\n'),
      [`${workspace}|${workspace}`, workspace],
      'PowerShell、.NET 与 Node 必须共享策略工作目录'
    );
    assertWorkspaceAclRestored(workspace, workspaceSddl);
    assert.equal(readSddl(workspaceParent), workspaceParentSddl, '工作区父路径的临时遍历 ACL 必须在 Shell 结束后精确还原');
    assert.equal(readSddl(parse(workspace).root), workspaceVolumeSddl, '工作区卷根 ACL 不应被修改');
    assert.equal(readSddl(relativeProjectSource), relativeProjectSourceSddl, '工作区子文件的继承 ACL 必须在 Shell 结束后精确还原');
    assert.equal(readSddl(pwshRuntimeRoot), pwshRuntimeRootSddl, 'PowerShell 运行时目录的继承 ACL 必须精确还原');
    assert.equal(readSddl(pwshExecutable), pwshExecutableSddl, 'PowerShell 可执行文件的继承 ACL 必须精确还原');
    assert.equal(readSddl(nodeRuntimeRoot), nodeRuntimeRootSddl, 'Node.js 运行时目录的继承 ACL 必须精确还原');
    assert.equal(readSddl(process.execPath), nodeExecutableSddl, 'Node.js 可执行文件的继承 ACL 必须精确还原');
    assert.deepEqual(readdirSync(resolve(process.env.LFAA_HOME, 'sandbox', 'runs')), [], 'Shell Owner 完成后应清理本次运行状态');
    const crashRun = await startAgentHost(binary, {
      mode: 'workspace-write', workspace, workingDirectory: workspace, stateRoot,
      runtimeRoot, executable: powershell,
      command: `Start-Sleep -Seconds 30; [IO.File]::WriteAllText('${quotePowerShell(join(workspace, 'crash-child-late.txt'))}','too-late')`
    });
    const crashedAppDataRoot = join(process.env.LOCALAPPDATA, 'Packages', `LFAA.Agent.${crashRun.token}`, 'AC');
    assert.equal(existsSync(crashedAppDataRoot), true, '运行中应创建本次 AppContainer 用户数据根');
    crashRun.child.kill();
    await waitForClose(crashRun.child, 10_000);
    assert.equal(existsSync(crashedAppDataRoot), true, 'Host 崩溃后应保留日志覆盖的 Profile 数据供恢复');
    const recovery = await startAgentHost(binary, {
      mode: 'read-only', workspace, workingDirectory: workspace, stateRoot,
      runtimeRoot, executable: powershell, command: 'exit 0'
    });
    const recoveryResult = await finishHost(recovery.child, recovery.stderr, 20_000, recovery.stdout);
    assert.equal(recoveryResult.code, 0, recoveryResult.stderr);
    assert.deepEqual(readdirSync(stateRoot), [], '下一次启动必须回收崩溃遗留 ACL 日志和取消标记');
    assertRunDataClean(crashRun.token, workspace);
    assertWorkspaceAclRestored(workspace, workspaceSddl);
    const run = await startAgentHost(binary, {
    mode: 'workspace-write',
    workspace,
    workingDirectory: workspace,
    stateRoot,
    runtimeRoot,
    executable: powershell,
    command: [
      "$ErrorActionPreference='Stop'",
      `$inside='${quotePowerShell(insideMarker)}'`,
      `$outside='${quotePowerShell(outsideMarker)}'`,
      `$environment='${quotePowerShell(environmentMarker)}'`,
      "[IO.File]::WriteAllText($inside,'workspace-write')",
      '[IO.File]::WriteAllText($environment, "$env:TEMP|$env:USERPROFILE|$env:APPDATA|$env:LOCALAPPDATA|$env:PATHEXT")',
      "if ($env:PATHEXT -notmatch '(?i)(^|;)\\.EXE(;|$)' -or $env:PATHEXT -notmatch '(?i)(^|;)\\.CMD(;|$)') { exit 35 }",
      "if (-not (Get-Command powershell -ErrorAction SilentlyContinue)) { exit 36 }",
      "if ([IO.File]::ReadAllText($inside) -ne 'workspace-write') { exit 31 }",
      "try { [void][IO.File]::ReadAllText($outside); exit 32 } catch { }",
      "try { [IO.File]::WriteAllText($outside,'changed'); exit 33 } catch { }",
      `$client=New-Object Net.Sockets.TcpClient; try { $pending=$client.BeginConnect('127.0.0.1',${port},$null,$null); if ($pending.AsyncWaitHandle.WaitOne(1500)) { try { $client.EndConnect($pending); exit 34 } catch { } } } finally { $client.Dispose() }`,
      'exit 0'
    ].join('; ')
    });
    const result = await finishHost(run.child, run.stderr, 20_000, run.stdout);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stderr, new RegExp(`LFAA_AGENT_SANDBOX_RESULT:${run.token}:workspace-write:0`));
    assert.equal(readFileSync(insideMarker, 'utf8'), 'workspace-write', '工作区内写入应成功');
    const appDataRoot = join(process.env.LOCALAPPDATA, 'Packages', `LFAA.Agent.${run.token}`, 'AC');
    const [temp, userProfile, appData, localAppData, pathExt] = readFileSync(environmentMarker, 'utf8').split('|');
    assert.deepEqual(
      [temp, userProfile, appData, localAppData].map(value => value.toLowerCase()),
      [join(appDataRoot, 'Temp'), appDataRoot, join(appDataRoot, 'Roaming'), appDataRoot].map(value => value.toLowerCase()),
      'TEMP、用户配置目录必须位于本次 AppContainer 本地数据根'
    );
    assert.deepEqual(pathExt.toLowerCase().split(';').slice(0, 4), ['.com', '.exe', '.bat', '.cmd']);
    assertRunDataClean(run.token, workspace);
    assert.equal(readFileSync(outsideMarker, 'utf8'), 'private-marker', '工作区外标记应不可读取或改写');
    assert.equal(loopbackConnected, false, '无网络能力的 AppContainer 不应连接本机回环服务');
    assert.deepEqual(readdirSync(stateRoot), [], '正常结束后应清理运行日志与取消文件');
    const runtimeProbeMarker = join(workspace, 'agent-runtime-probe.txt');
    const runtimeVolumeSddl = readSddl(parse(nodeRuntimeRoot).root);
    const runtimeProbe = await startAgentHost(binary, {
      mode: 'workspace-write', workspace, workingDirectory: workspace, stateRoot,
      runtimeRoot, runtimeRoots: [nodeRuntimeRoot], executable: powershell,
      command: [
        "$ErrorActionPreference='Stop'",
        "$nodeVersion = node -p 'process.version'",
        "if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v[0-9]+\\.') { exit 51 }",
        "$npmVersion = npm.cmd --version",
        "if ($LASTEXITCODE -ne 0 -or $npmVersion -notmatch '^[0-9]+\\.') { exit 52 }",
        `[IO.File]::WriteAllText('${quotePowerShell(runtimeProbeMarker)}', \"$nodeVersion|$npmVersion\")`,
        'exit 0'
      ].join('; ')
    });
    const runtimeProbeResult = await finishHost(runtimeProbe.child, runtimeProbe.stderr, 20_000, runtimeProbe.stdout);
    assert.equal(runtimeProbeResult.code, 0, runtimeProbeResult.stderr);
    assert.match(readFileSync(runtimeProbeMarker, 'utf8'), /^v[0-9]+\.[0-9]+\.[0-9]+\|[0-9]+\.[0-9]+\.[0-9]+$/);
    assert.equal(readSddl(parse(nodeRuntimeRoot).root), runtimeVolumeSddl, '外部 Node.js 卷根 DACL 必须在运行后精确还原');
    assert.equal(readSddl(nodeRuntimeRoot), nodeRuntimeRootSddl, '外部 Node.js 运行时目录 DACL 必须在运行后精确还原');
    assert.equal(readSddl(process.execPath), nodeExecutableSddl, '外部 Node.js 可执行文件 DACL 必须在运行后精确还原');
    assertRunDataClean(runtimeProbe.token, workspace);
    assert.deepEqual(readdirSync(stateRoot), [], 'Node/npm 本地启动后应清理卷根 ACL、运行日志与取消文件');
    assert.equal(loopbackConnected, false, '只授予运行时路径遍历权限后仍不得连接本机回环服务');
    const readOnly = await startAgentHost(binary, {
    mode: 'read-only', workspace, workingDirectory: workspace, stateRoot, runtimeRoot,
    executable: powershell,
    command: `$ErrorActionPreference='Stop'; if ((Get-Content -LiteralPath '${quotePowerShell(insideMarker)}' -Raw) -ne 'workspace-write') { exit 41 }; try { Set-Content -LiteralPath '${quotePowerShell(insideMarker)}' -Value 'changed' -NoNewline; exit 42 } catch { exit 0 }`
    });
    const readOnlyResult = await finishHost(readOnly.child, readOnly.stderr, 20_000, readOnly.stdout);
  assert.equal(readOnlyResult.code, 0, readOnlyResult.stderr);
  assert.match(readOnlyResult.stderr, new RegExp(`LFAA_AGENT_SANDBOX_RESULT:${readOnly.token}:read-only:0`));
  assert.equal(readFileSync(insideMarker, 'utf8'), 'workspace-write', '只读模式必须阻止工作区写入');
  assertRunDataClean(readOnly.token, workspace);
  assert.deepEqual(readdirSync(stateRoot), [], '只读运行也应清理运行 ACL 和日志');

  const cancelledMarker = join(workspace, 'cancelled-child.txt');
    const cancelRun = await startAgentHost(binary, {
    mode: 'workspace-write', workspace, workingDirectory: workspace, stateRoot, runtimeRoot,
    executable: powershell,
    command: `Start-Sleep -Seconds 30; [IO.File]::WriteAllText('${quotePowerShell(cancelledMarker)}','too-late')`
    });
    try {
    writeFileSync(cancelRun.cancelFile, 'cancel', { flag: 'wx' });
    const cancelledResult = await finishHost(cancelRun.child, cancelRun.stderr, 12_000, cancelRun.stdout);
    assert.equal(cancelledResult.code, 0, cancelledResult.stderr);
    assert.match(cancelledResult.stderr, new RegExp(`LFAA_AGENT_SANDBOX_RESULT:${cancelRun.token}:workspace-write:1`));
    assert.equal(existsSync(cancelledMarker), false, '取消必须终止完整进程树，不能运行命令尾部');
    assertRunDataClean(cancelRun.token, workspace);
    assert.deepEqual(readdirSync(stateRoot), [], '确认进程树退出后必须回收 ACL、日志与取消文件');
    } finally {
      if (cancelRun.child.exitCode === null) cancelRun.child.kill();
    }
  } finally {
    if (listener.listening) listener.close();
    try {
      await recoverRunAtRoot(binary, powershell, workspace, stateRoot);
    } catch (error) {
      process.stderr.write(`Agent 沙箱临时目录保留以便恢复 ACL：${error.message}\n`);
    }
    if (readdirSync(stateRoot).length === 0) {
      rmSync(testRoot, { recursive: true, force: true });
      if (dirname(workspace) !== dirname(repositoryRoot) || !workspace.includes('lfaa-agent-shell-sandbox-workspace-')) {
        throw new Error('拒绝清理 Agent 沙箱外部工作区根以外的目录。');
      }
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

async function startAgentHost(binary, { mode, workspace, workingDirectory, stateRoot, runtimeRoot, runtimeRoots = [], executable, command }) {
  const token = randomUUID();
  const cancelFile = join(stateRoot, `cancel-${token}.request`);
  const runtimeArgs = [runtimeRoot, ...runtimeRoots].flatMap(root => ['--runtime-root', root]);
  const child = spawn(binary, [
    '--agent-run', '--workspace-root', workspace,
    '--working-directory', workingDirectory, '--state-root', stateRoot,
    '--cancel-file', cancelFile, '--mode', mode, '--run-token', token,
    ...runtimeArgs, '--', executable, '-NoLogo', '-NoProfile', '-NonInteractive',
    '-ExecutionPolicy', 'Bypass', '-Command', command
  ], { cwd: dirname(executable), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const stdout = { text: '' };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout.text += chunk; });
  const stderr = readLines(child.stderr);
  try {
    await stderr.waitFor(line => line.includes(`LFAA_AGENT_SANDBOX_READY:${token}`), 15_000);
  } catch (error) {
    if (child.exitCode === null) child.kill();
    throw new Error(`${error.message}; stdout=${stdout.text}; stderr=${stderr.text()}; exit=${child.exitCode}`);
  }
  return { child, stderr, stdout, token, cancelFile };
}

function quotePowerShell(value) {
  return value.replaceAll("'", "''");
}

async function recoverStaleRuns(binary, powershell) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  for (const parent of [tmpdir(), join(repositoryRoot, 'dist', '.tmp')]) {
    if (!existsSync(parent)) continue;
    for (const directory of readdirSync(parent, { withFileTypes: true })) {
      if (!directory.isDirectory() || !directory.name.startsWith('lfaa-agent-shell-sandbox-')) continue;
      const root = join(parent, directory.name);
      if (dirname(root) !== parent) throw new Error('拒绝回收 Agent 沙箱测试根以外的目录。');
      const workspace = join(root, 'workspace');
      const stateRoot = join(root, 'state');
      if (!existsSync(workspace) || !existsSync(stateRoot)) continue;
      const journals = readdirSync(stateRoot).filter(name => /^agent-[0-9a-f-]{36}\.journal$/iu.test(name));
      if (journals.length > 0) {
        let recoveryRoot;
        let recoveryWorkspace = workspace;
        if (parse(workspace).root.toLowerCase() !== parse(powershell).root.toLowerCase()) {
          recoveryRoot = mkdtempSync(join(tmpdir(), 'lfaa-agent-shell-recovery-'));
          recoveryWorkspace = join(recoveryRoot, 'workspace');
          mkdirSync(recoveryWorkspace, { recursive: true });
        }
        try {
          await recoverRunAtRoot(binary, powershell, recoveryWorkspace, stateRoot);
        } finally {
          if (recoveryRoot && readdirSync(stateRoot).length === 0) rmSync(recoveryRoot, { recursive: true, force: true });
        }
      }
      if (readdirSync(stateRoot).length === 0) rmSync(root, { recursive: true, force: true });
    }
  }
}

function assertRunDataClean(token, workspace) {
  const appDataRoot = join(process.env.LOCALAPPDATA, 'Packages', `LFAA.Agent.${token}`, 'AC');
  assert.equal(existsSync(appDataRoot), false, 'AppContainer 用户数据必须在运行结束后回收');
  assert.equal(existsSync(join(workspace, '.lfaa-tmp')), false, 'Agent 不得在工作区留下临时用户目录');
}

async function recoverRunAtRoot(binary, powershell, workspace, stateRoot) {
  if (!existsSync(stateRoot) || readdirSync(stateRoot).length === 0) return;
  const recovery = await startAgentHost(binary, {
    mode: 'read-only', workspace, workingDirectory: workspace, stateRoot,
    runtimeRoot: dirname(powershell), executable: powershell, command: 'exit 0'
  });
  const result = await finishHost(recovery.child, recovery.stderr, 20_000, recovery.stdout);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(readdirSync(stateRoot), [], '重启后应回收中断运行的 ACL 日志与取消标记');
}

function readLines(stream) {
  const reader = createInterface({ input: stream });
  const lines = [];
  const waiters = [];
  reader.on('line', line => {
    lines.push(line);
    const index = waiters.findIndex(waiter => waiter.predicate(line));
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(line);
    }
  });
  reader.on('close', () => {
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`Sandbox Host 提前关闭。${lines.join(' | ')}`));
    }
  });
  return {
    text: () => lines.join('\n'),
    waitFor(predicate, timeoutMs) {
      const match = lines.find(predicate);
      if (match !== undefined) return Promise.resolve(match);
      return new Promise((resolveLine, reject) => {
        const waiter = { predicate, resolve: resolveLine, reject, timer: undefined };
        waiter.timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`等待 Sandbox Host 握手超时。${lines.join(' | ')}`));
        }, timeoutMs);
        waiters.push(waiter);
      });
    }
  };
}

function readSddl(path) {
  const icacls = resolve(process.env.SystemRoot ?? 'C:\\Windows', 'System32/icacls.exe');
  return execFileSync(icacls, [path], { encoding: 'utf8', windowsHide: true, timeout: 10_000 }).trim();
}

function assertWorkspaceAclRestored(path, beforeText) {
  const before = parseAclEntries(beforeText, path);
  const afterText = readSddl(path);
  const after = parseAclEntries(afterText, path);
  const remaining = new Map();
  for (const entry of after) {
    const key = aclEntryKey(entry);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  for (const entry of before) {
    const key = aclEntryKey(entry);
    const count = remaining.get(key) ?? 0;
    assert.ok(count > 0, `工作区 ACL 丢失了运行前的 ACE：${key}\n${afterText}`);
    remaining.set(key, count - 1);
  }

  const added = [];
  for (const entry of after) {
    const key = aclEntryKey(entry);
    const count = remaining.get(key) ?? 0;
    if (count === 0) continue;
    added.push(entry);
    remaining.set(key, count - 1);
  }
  const unexpected = added.filter(entry => !(
    entry.flags.length === 1
    && entry.flags[0] === 'I'
    && before.some(original => (
      original.principal === entry.principal
      && original.flags.length === 0
      && original.rights === entry.rights
    ))
  ));
  assert.deepEqual(
    unexpected,
    [],
    `工作区 ACL 只允许 Windows 自动继承与既有显式 ACE 权限完全相同的继承项；实际新增：${JSON.stringify(added)}\n${afterText}`
  );
}

function parseAclEntries(text, path) {
  const entries = [];
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    const value = trimmed.startsWith(`${path} `) ? trimmed.slice(path.length + 1) : trimmed;
    const separator = value.lastIndexOf(':');
    if (separator <= 0) continue;
    const principal = value.slice(0, separator);
    const aclText = value.slice(separator + 1);
    const groups = [...aclText.matchAll(/\(([^()]*)\)/gu)].map(match => match[1]);
    if (groups.length === 0 || aclText.replace(/\([^()]*\)/gu, '').trim() !== '') continue;
    entries.push({ principal, flags: groups.slice(0, -1), rights: groups.at(-1) });
  }
  return entries;
}

function aclEntryKey(entry) {
  return JSON.stringify([entry.principal, entry.flags, entry.rights]);
}

function waitForClose(child, timeoutMs) {
  return new Promise((resolveClose, reject) => {
    const timer = setTimeout(() => reject(new Error('被终止的 Sandbox Host 未能及时退出。')), timeoutMs);
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolveClose({ code, signal });
    });
  });
}

function finishHost(child, stderr, timeoutMs, stdout) {
  return new Promise((resolveResult, reject) => {
    let timedOut = false;
    let killTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      killTimer = setTimeout(() => reject(new Error(`Sandbox Host 超时后未退出。stdout=${stdout.text}; stderr=${stderr.text()}`)), 10_000);
    }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); clearTimeout(killTimer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (timedOut) reject(new Error(`Sandbox Host 执行超时并已终止。stdout=${stdout.text}; stderr=${stderr.text()}`));
      else resolveResult({ code, stdout: stdout.text, stderr: stderr.text() });
    });
  });
}
