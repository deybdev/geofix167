/* global __dirname */
// Run: node tests/resident-submission.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const timers = new Map();
function load(file, imports = {}, instrument = s => s) {
  const module = { exports: {} };
  const code = babel.transformSync(instrument(fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n')), {
    configFile: false, babelrc: false,
    plugins: [[require.resolve('@babel/plugin-transform-react-jsx'), { pragma: 'jsx', pragmaFrag: 'Fragment' }], require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    assert.ok(name in imports, `Missing mock: ${name}`); return imports[name];
  }, jsx: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment', console,
  setTimeout: fn => { const id = {}; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
  return module.exports;
}
const utils = load('src/utils/residentReport.js');
const submission = load('src/utils/residentSubmission.js', { './residentReport': utils });
let uuid = 0;
const crypto = { randomUUID: () => `stable-${++uuid}` };
const prepared = submission.prepareReportPhoto({ uri: 'file:///fallback.png' }, {
  ...crypto, fileInfo: () => ({ size: 123 }),
});
assert.equal(prepared.file.type, 'image/png');
assert.equal(prepared.file.size, 123);
assert.throws(() => submission.prepareReportPhoto({ uri: 'file:///bad.heic' }, { ...crypto, fileInfo: () => ({ size: 123 }) }));

const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
async function scenario({ count, emergency = false, fail = false, lostResponse = false, listFails = false, creationLost = false, guestMode = false }) {
  const slots = []; let index = 0;
  const hooks = {
    useRef: current => slots[index++] ??= { current },
    useState: initial => {
      const i = index++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    }, useEffect(fn, deps) {
      const i = index++;
      if (!slots[i] || deps.some((dep, j) => dep !== slots[i].deps[j])) {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      }
    },
  };
  let creates = 0, attempts = [], saved = [], navigations = [], alerts = [], failNow = fail, listNow = listFails;
  const assets = Array.from({ length: count }, (_, i) => ({ uri: `file:///photo-${i}.jpg`, mimeType: 'image/jpeg', fileName: `photo-${i}.jpg`, fileSize: 123 }));
  let captureIndex = 0, cancel = false, permission = true, captureError = false, cameraCalls = 0, permissionCalls = 0, creationRequests = 0;
  const creationKeys = [];
  const screen = load('src/screens/resident/Report.jsx', {
    react: hooks,
    '@react-navigation/native': { useNavigation: () => ({ replace: (...args) => navigations.push(args) }) },
    'react-native': { Animated: { Value: class { setValue() {} }, timing: () => ({ start() {} }) }, BackHandler: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'android' }, Alert: { alert: (...args) => alerts.push(args) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'expo-image-picker': { requestCameraPermissionsAsync: async () => { permissionCalls++; return { granted: permission }; }, launchCameraAsync: async () => {
      cameraCalls++; if (captureError) throw new Error('Camera unavailable');
      return cancel ? { canceled: true } : { assets: [assets[captureIndex++]] };
    } },
    'expo-crypto': crypto, 'expo-file-system': { File: class { size = 123; } },
    'expo-location': {}, 'lucide-react-native': {}, twrnc: () => ({}),
    '../../components/map/MapViewer': {}, '../../../assets/map/barangay-167.json': {},
    '../../components/shared/SuccessBanner': 'SuccessBanner',
    '../../utils/residentSubmission': submission,
    '../../services/residentService': {
      buildResidentReportPayload: value => value,
      submitReport: async payload => {
        if (emergency) { assert.equal(payload.category, 'Fire Incident'); assert.equal(payload.urgency, undefined); }
        creationRequests++; creationKeys.push(payload.idempotency_key);
        if (creationRequests === 1) { creates++; if (creationLost) throw new Error('Response lost'); }
        else assert.equal(payload.idempotency_key, creationKeys[0]);
        return { data: { report: { public_id: 'returned-id', reference_number: 'GF-123' } } };
      },
      getReportAttachments: async id => {
        assert.equal(id, 'returned-id');
        if (listNow) throw new Error('Offline');
        return { data: { attachments: saved } };
      },
      uploadReportAttachment: async (id, file, uploadId) => {
        assert.equal(id, 'returned-id'); assert.ok(file.size); assert.equal(file.type, 'image/jpeg');
        attempts.push(uploadId);
        if (failNow && file.uri === assets[count - 1].uri) {
          if (lostResponse) { saved.push({ upload_id: uploadId }); listNow = true; }
          throw new Error('Connection lost');
        }
        assert.ok(!saved.some(item => item.upload_id === uploadId), 'No duplicate attachment');
        saved.push({ upload_id: uploadId });
      },
    },
  }, source => source.replace('  return (\n    <KeyboardAvoidingView', '  return { pickPhoto, send, selectType, handleMapSelect, goTo, step, photos, pendingNotice, photoNotice, successNotice, submitError, ui: (\n    <KeyboardAvoidingView').replace(/\);\s*}\s*$/, ') };\n}')).default;
  const render = () => { index = 0; return screen({ guestMode }); };
  let view = render();
  view.selectType(emergency ? 'emergency' : 'infrastructure');
  view = render();
  if (emergency) { nodes(view.ui).find(n => n.props?.item?.id === 'fire').props.onPress(); view = render(); }
  const first = nodes(view.ui).find(n => n.props?.label === 'Take Photo');
  assert.ok(first);
  assert.equal(nodes(view.ui).some(n => n.props?.label === 'Gallery'), guestMode);
  await first.props.onPress();
  assert.equal(cameraCalls, 1); assert.equal(permissionCalls, 1);
  view = render();
  const additional = nodes(view.ui).find(n => n.props?.accessibilityLabel === 'Add another photo');
  assert.ok(additional);
  if (guestMode) {
    additional.props.onPress(); assert.equal(alerts.at(-1)[0], 'Photo evidence'); return;
  }
  cancel = true; await additional.props.onPress(); view = render();
  assert.equal(cameraCalls, 2); assert.equal(permissionCalls, 2);
  assert.equal(view.photos.length, 1); assert.equal(view.photoNotice, ''); assert.equal(alerts.length, 0);
  cancel = false;
  permission = false; await view.pickPhoto('camera'); view = render();
  assert.match(view.photoNotice, /camera access/); assert.doesNotMatch(view.photoNotice, /gallery/i);
  permission = true; captureError = true; await view.pickPhoto('camera'); view = render();
  assert.equal(view.photoNotice, 'Camera unavailable'); assert.equal(view.photos.length, 1);
  captureError = false;
  while (captureIndex < count) { await view.pickPhoto('camera'); view = render(); }
  if (count === 5) {
    const callsBefore = cameraCalls;
    await view.pickPhoto('camera'); view = render();
    assert.equal(cameraCalls, callsBefore); assert.equal(view.photos.length, 5);
    assert.match(view.photoNotice, /up to 5/);
  }
  view.handleMapSelect({ lat: 14.7, lng: 121 });
  view.goTo(emergency ? 4 : 3);
  view = render();
  await Promise.all([view.send(), view.send()]);
  assert.equal(creates, 1, 'Repeated taps create once');
  if (creationLost) {
    view = render(); assert.match(view.submitError, /could not confirm/); assert.equal(view.photos.length, count);
    assert.ok(nodes(view.ui).some(n => n.props?.accessibilityRole === 'alert'));
    await view.send(); assert.equal(creates, 1); assert.equal(creationRequests, 2);
    assert.equal(new Set(creationKeys).size, 1);
  }
  if (fail || listFails) {
    view = render(); assert.match(view.pendingNotice, /Report submitted. Some photos still need to upload/);
    assert.ok(nodes(view.ui).some(n => n.props?.accessibilityRole === 'alert'));
    assert.ok(JSON.stringify(view.ui).includes('Retry photos'));
    assert.match(view.pendingNotice, new RegExp(`photo-${count - 1}.jpg`));
    assert.equal(navigations.length, 0);
    const oldStep = view.step; view.goTo(0); assert.equal(render().step, oldStep);
    failNow = false; listNow = false;
    await view.send();
    assert.equal(creates, 1, 'Retry reuses report');
  }
  assert.equal(saved.length, count);
  if (fail && !lostResponse) {
    assert.equal(attempts.length, count + 1);
    assert.equal(attempts[count], attempts[count - 1], 'Retry keeps stable upload ID');
  } else assert.equal(attempts.length, count);
  if (emergency) {
    assert.equal(navigations[0][0], 'Track');
    assert.equal(navigations[0][1].reportId, 'returned-id');
    assert.equal(navigations[0][1].location.lat, 14.7);
    await view.send(); assert.equal(creates, 1);
  } else {
    view = render();
    assert.equal(view.successNotice, 'Report submitted · GF-123');
    assert.equal(view.photos.length, 0); assert.equal(view.step, 0);
    assert.ok(nodes(view.ui).some(n => n.type === 'SuccessBanner' && n.props.message === view.successNotice));
    for (const [id, dismiss] of timers) { timers.delete(id); dismiss(); }
    assert.equal(render().successNotice, '', 'Snackbar automatically dismisses after reset');
  }
  assert.equal(alerts.length, 0, 'Resident feedback never opens an app-owned alert');
}
(async () => {
  await scenario({ count: 1 });
  await scenario({ count: 3 });
  await scenario({ count: 5 });
  await scenario({ count: 2, emergency: true });
  await scenario({ count: 3, fail: true });
  await scenario({ count: 2, emergency: true, fail: true });
  await scenario({ count: 2, fail: true, lostResponse: true });
  await scenario({ count: 1, listFails: true });
  await scenario({ count: 2, creationLost: true });
  await scenario({ count: 1, guestMode: true });
  console.log('Resident submission: 10 screen scenarios, direct camera/cancel, five-photo limit, feedback timers, idempotent creation and metadata checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
