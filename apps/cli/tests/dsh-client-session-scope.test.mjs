/** 功能：回归 DSH Renderer 的 LFAA 无会话 Scope 接线。作用：确保根级插件能挂载且不会伪造 DSH Session。 */
import assert from 'node:assert/strict';
import test from 'node:test';

const { installLfaaDshSessionScope } = await import('lfaa-client-modules/src/client/session-scope.js');

test('installs a stable absent-session projection when the DSH Session owner is not present', () => {
  let installed;
  const context = {
    get: () => undefined,
    slots: {
      installScope(scope, adapter) {
        installed = { scope, adapter };
      }
    }
  };

  assert.equal(installLfaaDshSessionScope(context), true);
  assert.equal(installed.scope, 'session');
  assert.equal(installed.adapter.current.getSnapshot().key, undefined);
  assert.deepEqual(installed.adapter.current.getSnapshot().hooks, {});
  assert.deepEqual(installed.adapter.current.getSnapshot().keyedHooks, {});
  assert.deepEqual(installed.adapter.current.getSnapshot().props, {});
  assert.equal(installed.adapter.current.getSnapshot(), installed.adapter.current.getSnapshot());
  assert.equal(installed.adapter.bindingSource(undefined), installed.adapter.current);
  assert.equal(installed.adapter.renderArea, undefined, 'the bridge does not invent SessionProvider behavior');
  assert.throws(
    () => installed.adapter.bindingSource('dsh-session-id'),
    /LFAA 当前没有可映射的 DSH Session/u
  );
});

test('leaves the official DSH uiSession scope owner in control when present', () => {
  let installCount = 0;
  const context = {
    get: (name) => name === 'uiSession' ? {} : undefined,
    slots: {
      installScope() {
        installCount += 1;
      }
    }
  };

  assert.equal(installLfaaDshSessionScope(context), false);
  assert.equal(installCount, 0);
});
