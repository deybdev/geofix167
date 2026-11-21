/* global __dirname */
// Run: node tests/responder-dispatch.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

function loadModule(file, imports = {}) {
  const module = { exports: {} };
  const code = babel.transformSync(
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n'),
    {
      configFile: false,
      babelrc: false,
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    },
  ).code;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(name in imports, `Missing mock: ${name}`);
      return imports[name];
    },
  });
  return module.exports;
}

(async () => {
  let getImpl;
  let patchImpl;
  const service = loadModule('src/services/responderDispatchService.js', {
    './api': {
      __esModule: true,
      default: {
        get: (...args) => getImpl(...args),
        patch: (...args) => patchImpl(...args),
        post: async () => ({ data: { ok: true } }),
      },
    },
  });

  // No sample test helper exported
  assert.equal(service.addPoliceTestIncident, undefined, 'sample police helper must not be exported');

  // 1. Successful empty response for police returns [] (no sample data appended)
  getImpl = async () => ({ data: { dispatches: [] } });
  const emptyPolice = await service.getResponderDispatches(undefined, 'police');
  assert.deepEqual(emptyPolice, [], 'police empty response must remain empty');

  // 2. Real API response for police returns ONLY persisted API dispatches
  const persisted = [{ id: 'disp-1', incident_id: 'inc-1', status: 'DISPATCHED', target_role: 'police' }];
  getImpl = async () => ({ data: { dispatches: persisted } });
  const realPolice = await service.getResponderDispatches(undefined, 'police');
  assert.deepEqual(realPolice, persisted, 'police must receive only persisted API dispatches');

  // 3. API failure for police rejects instead of falling back to sample incidents
  getImpl = async () => { throw new Error('Network error'); };
  await assert.rejects(
    () => service.getResponderDispatches(undefined, 'police'),
    /Network error/,
    'police API failure must propagate error for retry UI',
  );

  // 4. Status update always calls the real API (no sample-police bypass)
  let patchCall = null;
  patchImpl = async (url, payload) => {
    patchCall = { url, payload };
    return { data: { ok: true, status: payload.status } };
  };
  const updated = await service.updateResponderDispatchStatus('disp-1', 'ACCEPTED', 'police');
  assert.equal(updated.ok, true);
  assert.equal(patchCall.url, '/responder/dispatches/disp-1/status');
  assert.equal(patchCall.payload.status, 'ACCEPTED');

  // 5. Home screen does not reference sample police data or addPoliceTestIncident
  const homeSource = fs.readFileSync(path.join(__dirname, '..', 'src/screens/responder/Home.jsx'), 'utf8');
  assert.equal(homeSource.includes('addPoliceTestIncident'), false, 'Home must not import/call sample test incidents');
  assert.equal(homeSource.includes('sample-police-'), false, 'Home must not reference sample police IDs');
  assert.ok(homeSource.includes('getResponderDispatches'), 'Home must fetch real dispatches from API');

  console.log('PASS responder dispatch mobile tests: no police sample fallback, empty state preserved, API errors propagate, real status PATCH, Home checks');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
