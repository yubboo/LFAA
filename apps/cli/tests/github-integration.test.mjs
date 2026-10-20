/** 功能：回归 GitHub Device Flow、账户隔离、只读 REST 与取消清理。作用：用假远端响应验证 Provider Owner 不泄露令牌。 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitHubIntegrationService } from 'lfaa-github-integration/src/index.ts';

function createCredentials() {
  const records = new Map();
  return {
    records,
    read: ownerId => records.get(ownerId) ?? null,
    write: (ownerId, payload) => records.set(ownerId, { kind: 'grant', payload: structuredClone(payload) }),
    delete: ownerId => records.delete(ownerId)
  };
}

function tokenResponse(extra = {}) {
  return Response.json({ access_token: 'ghu-test-access-token-value', token_type: 'bearer', expires_in: 28800, refresh_token: 'ghr-test-refresh-token-value', refresh_token_expires_in: 15552000, scope: '', ...extra });
}

test('GitHub Device Flow stores an encrypted-record payload, isolates accounts and reads repository issues and PRs', async () => {
  let now = 1_800_000_000_000;
  const credentials = createCredentials();
  const calls = [];
  const tokenPolls = [Response.json({ error: 'authorization_pending' }), tokenResponse()];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    calls.push({ url, method, headers: new Headers(init.headers), body: init.body ? JSON.parse(init.body) : undefined });
    if (url === 'https://github.com/login/device/code') return Response.json({ device_code: 'device-secret-from-github', user_code: 'ABCD-EFGH', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 1 });
    if (url === 'https://github.com/login/oauth/access_token' && method === 'POST') return tokenPolls.shift() ?? tokenResponse();
    if (url === 'https://api.github.com/user') return Response.json({ login: 'lfaa-user', email: 'private@example.test' });
    if (url.startsWith('https://api.github.com/user/repos?')) return Response.json([{ id: 1, full_name: 'acme/demo', description: 'Sample', private: true, html_url: 'https://github.com/acme/demo', default_branch: 'main', updated_at: '2026-10-20T10:00:00Z' }], { headers: { link: '<https://api.github.com/user/repos?page=2>; rel="next"' } });
    if (url === 'https://api.github.com/repos/acme/demo/issues?per_page=100&state=open') return Response.json([
      { number: 7, title: 'Fix issue', state: 'open', user: { login: 'contributor' }, html_url: 'https://github.com/acme/demo/issues/7', updated_at: '2026-10-20T10:00:00Z', labels: [{ name: 'bug' }] },
      { number: 8, title: 'A pull request', state: 'open', pull_request: {}, user: { login: 'contributor' }, html_url: 'https://github.com/acme/demo/pull/8', updated_at: '2026-10-20T10:00:00Z', labels: [] }
    ]);
    if (url === 'https://api.github.com/repos/acme/demo/pulls?per_page=100&state=open') return Response.json([
      { number: 8, title: 'A pull request', state: 'open', user: { login: 'contributor' }, html_url: 'https://github.com/acme/demo/pull/8', updated_at: '2026-10-20T10:00:00Z', labels: [], base: { ref: 'main' }, head: { ref: 'feature' } }
    ]);
    if (url === 'https://api.github.com/applications/client-id/grant' && method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error(`Unexpected GitHub request: ${method} ${url}`);
  };
  const service = createGitHubIntegrationService({ clientId: 'client-id', clientSecret: 'client-secret', credentials, fetchImpl, now: () => now });
  try {
    assert.deepEqual(service.status('account-b'), { configured: true, connected: false, login: null, connectedAt: null, expiresAt: null, remoteRevocationAvailable: true });
    const device = await service.beginAuthorization('account-a');
    assert.equal(device.userCode, 'ABCD-EFGH');
    assert.equal(device.verificationUri, 'https://github.com/login/device');
    assert.equal(JSON.stringify(device).includes('device-secret-from-github'), false, 'device secret never leaves the service');
    assert.deepEqual(await service.pollAuthorization('account-b', device.attemptId), { status: 'expired' }, 'attempt is bound to its account');
    assert.deepEqual(await service.pollAuthorization('account-a', device.attemptId), { status: 'pending', retryAfterSeconds: 1 });
    now += 1000;
    assert.deepEqual(await service.pollAuthorization('account-a', device.attemptId), { status: 'authorized', login: 'lfaa-user' });
    assert.equal(credentials.records.get('account-a').payload.accessToken, 'ghu-test-access-token-value');
    assert.equal(service.status('account-b').connected, false);
    assert.equal(JSON.stringify(service.status('account-a')).includes('ghu-test-access-token-value'), false, 'status does not expose access tokens');

    const repos = await service.listRepositories('account-a', 1);
    assert.equal(repos.repositories[0].fullName, 'acme/demo');
    assert.equal(repos.truncated, true);
    const issues = await service.listIssues('account-a', 'acme/demo');
    assert.deepEqual(issues.map(item => item.number), [7], 'GitHub issues endpoint PR rows are excluded from Issues');
    const pulls = await service.listPullRequests('account-a', 'acme/demo');
    assert.equal(pulls[0].headBranch, 'feature');
    assert.ok(calls.filter(call => call.url.includes('/user/repos') || call.url.includes('/repos/acme/demo/')).every(call => call.method === 'GET'));
    assert.ok(calls.some(call => call.url === 'https://api.github.com/user/repos?per_page=100&sort=updated&page=1'
      && call.headers.get('authorization') === 'Bearer ghu-test-access-token-value'));

    assert.deepEqual(await service.disconnect('account-a'), { remoteRevoked: true });
    assert.equal(credentials.read('account-a'), null);
    assert.deepEqual(calls.at(-1).body, { access_token: 'ghu-test-access-token-value' }, 'remote grant revocation receives the active account token');
    assert.equal(calls.at(-1).headers.get('authorization'), `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
  } finally { service.close(); }
});

test('GitHub cancellation aborts device polling and prevents a late token from being committed', async () => {
  const credentials = createCredentials();
  let releaseToken;
  let tokenRequestStarted;
  const started = new Promise(resolve => { tokenRequestStarted = resolve; });
  const tokenResponseReady = new Promise(resolve => { releaseToken = resolve; });
  const fetchImpl = async input => {
    const url = String(input);
    if (url === 'https://github.com/login/device/code') return Response.json({ device_code: 'device-secret', user_code: 'AAAA-BBBB', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 1 });
    if (url === 'https://github.com/login/oauth/access_token') { tokenRequestStarted(); return tokenResponseReady; }
    if (url === 'https://api.github.com/user') return Response.json({ login: 'late-user' });
    throw new Error(`Unexpected GitHub request: ${url}`);
  };
  const service = createGitHubIntegrationService({ clientId: 'client-id', credentials, fetchImpl });
  try {
    const device = await service.beginAuthorization('account-a');
    const pendingPoll = service.pollAuthorization('account-a', device.attemptId);
    await started;
    assert.equal(service.cancelAuthorization('account-a', device.attemptId), true);
    releaseToken(tokenResponse());
    assert.deepEqual(await pendingPoll, { status: 'cancelled' });
    assert.equal(credentials.read('account-a'), null, 'late authorization cannot write after cancellation');
  } finally { service.close(); }
});

test('GitHub Device Flow slowdown response increases polling interval and missing Client ID is explicit', async () => {
  let now = 1_800_000_000_000;
  let tokenAttempts = 0;
  const credentials = createCredentials();
  const fetchImpl = async input => {
    const url = String(input);
    if (url === 'https://github.com/login/device/code') return Response.json({ device_code: 'device-secret', user_code: 'AAAA-BBBB', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 1 });
    if (url === 'https://github.com/login/oauth/access_token') { tokenAttempts += 1; return Response.json({ error: tokenAttempts === 1 ? 'slow_down' : 'authorization_pending' }); }
    throw new Error(`Unexpected GitHub request: ${url}`);
  };
  const service = createGitHubIntegrationService({ clientId: 'client-id', credentials, fetchImpl, now: () => now });
  const unconfigured = createGitHubIntegrationService({ clientId: '', credentials, fetchImpl, now: () => now });
  try {
    assert.equal(unconfigured.status('account-a').configured, false);
    await assert.rejects(unconfigured.beginAuthorization('account-a'), error => error.code === 'github_app_not_configured');
    const device = await service.beginAuthorization('account-a');
    assert.deepEqual(await service.pollAuthorization('account-a', device.attemptId), { status: 'pending', retryAfterSeconds: 6 });
    now += 6000;
    assert.deepEqual(await service.pollAuthorization('account-a', device.attemptId), { status: 'pending', retryAfterSeconds: 6 });
    assert.equal(tokenAttempts, 2);
  } finally { service.close(); unconfigured.close(); }
});
