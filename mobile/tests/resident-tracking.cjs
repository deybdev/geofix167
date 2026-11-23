/* global __dirname */
/* Run: node tests/resident-tracking.cjs. HTTP, hooks and native views are mocked. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const babel = require('@babel/core');
const timers = new Set();
let active;
const equalDeps = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
const hooks = {
  useState(initial) {
    const owner = active,
      i = owner.index++;
    if (!(i in owner.slots)) owner.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [owner.slots[i], value => {
      owner.slots[i] = typeof value === 'function' ? value(owner.slots[i]) : value;
    }];
  },
  useRef(current) {
    const owner = active,
      i = owner.index++;
    return owner.slots[i] ??= {
      current
    };
  },
  useCallback(fn, deps) {
    const owner = active,
      i = owner.index++;
    if (!equalDeps(owner.slots[i]?.deps, deps)) owner.slots[i] = {
      fn,
      deps
    };
    return owner.slots[i].fn;
  },
  useEffect(fn, deps) {
    const owner = active,
      i = owner.index++;
    if (!equalDeps(owner.slots[i]?.deps, deps)) {
      owner.slots[i]?.cleanup?.();
      owner.slots[i] = {
        deps
      };
      owner.effects.push(() => owner.slots[i].cleanup = fn());
    }
  }
};
function runner(Component, props = {}) {
  const instance = {
    slots: [],
    effects: [],
    index: 0,
    render() {
      active = instance;
      instance.index = 0;
      instance.effects = [];
      const tree = Component(props);
      instance.effects.forEach(fn => fn());
      return tree;
    },
    unmount() {
      instance.slots.forEach(slot => slot?.cleanup?.());
    }
  };
  return instance;
}
const jsx = (type, props, ...children) => ({
  type,
  props: {
    ...props,
    children
  }
});
function load(file, imports = {}) {
  const module = {
    exports: {}
  };
  const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    configFile: false,
    babelrc: false,
    plugins: [[require.resolve('@babel/plugin-transform-react-jsx'), {
      pragma: 'jsx',
      pragmaFrag: 'Fragment'
    }], require.resolve('@babel/plugin-transform-modules-commonjs')]
  }).code;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: name => {
      if (!(name in imports)) throw new Error('Missing mock ' + name);
      return imports[name];
    },
    URL,
    AbortController,
    Date,
    FormData: FakeFormData,
    console: {
      warn() {}
    },
    setTimeout,
    setInterval: fn => { timers.add(fn); return fn; },
    clearInterval: fn => timers.delete(fn),
    clearTimeout,
    __DEV__: true,
    fetch: async () => { throw new Error("No external routing in tests"); },
    jsx,
    Fragment: 'Fragment'
  });
  return module.exports;
}
class FakeFormData {
  constructor() {
    this.parts = [];
  }
  append(...args) {
    this.parts.push(args);
  }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const nodes = t => !t || typeof t !== 'object' ? [] : Array.isArray(t) ? t.flatMap(nodes) : [t, ...nodes(t.props?.children), ...nodes(t.props?.refreshControl)];
const find = (tree, fn) => {
  const node = nodes(tree).find(fn);
  assert.ok(node, 'Expected element');
  return node;
};
const text = tree => JSON.stringify(tree);
hooks.useMemo = (fn, deps) => hooks.useCallback(fn, deps)();
const native = Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'TextInput', 'KeyboardAvoidingView'].map(name => [name, name]));
native.useWindowDimensions = () => ({ height: 900 });
native.Platform = { OS: 'android' };
native.Keyboard = { dismiss() {} };
const base = { public_id: 'incident-A', status_id: 6, status_label: 'Assigned', latitude: 14.73, longitude: 121.01, dispatched_units: [
  { id: 'unit-A', name: 'BFP Fire Unit', role: 'fire', status: 'ACCEPTED', location: { lat: 14.731, lng: 121.011, updated_at: '2026-11-23 10:00:00' } },
] };
let report = base, failure, pending, requestCount = 0, lastSignal, messageResolve;
const tracking = load('src/services/residentTracking.js', { './residentService': { async getReportDetails(id, { signal }) {
  requestCount++; lastSignal = signal;
  if (pending) return pending;
  if (failure) throw failure;
  return { data: { report: { ...report, public_id: id } } };
} } });
const Track = load('src/screens/resident/Track.jsx', {
  react: hooks, 'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  'lucide-react-native': {}, twrnc: () => ({}),
  '../../components/map/MapViewer': { __esModule: true, default: 'MapViewer' },
  '../../services/residentTracking': tracking,
  '../../services/responderMessageService': {
    getIncidentMessages: () => new Promise(resolve => { messageResolve = resolve; }),
    sendIncidentMessage: async () => ({ id: 'sent-id' }),
  },
}).default;
const open = id => { const element = Track({ route: { params: { reportId: id } } }); return { element, instance: runner(element.type, element.props) }; };
const poll = async () => { for (const fn of [...timers]) fn(); await tick(); };
const progress = tree => {
  find(tree, n => n.props?.accessibilityLabel === 'Expand details').props.onPress();
};
(async () => {
  for (const id of [undefined, '', 'demo']) {
    const { instance } = open(id); instance.render(); await tick();
    const tree = instance.render();
    assert.match(text(tree), /Tracking unavailable/);
    assert.doesNotMatch(text(tree), /Ramon|sim-1|almost there/);
    assert.equal(find(tree, n => n.type === 'MapViewer').props.trackers.length, 0);
    instance.unmount();
  }
  assert.equal(requestCount, 0, 'Missing IDs never fetch or simulate, including __DEV__');
  const ignored = tracking.trackingState({ ...base, status_id: 1, dispatched_units: [{ ...base.dispatched_units[0], status: 'CANCELLED' }] });
  assert.equal(ignored.responder, null);
  assert.equal(ignored.report.status, 'received');
  failure = new Error('Initial outage');
  const failed = open('initial-outage').instance; failed.render(); await tick();
  assert.match(text(failed.render()), /Tracking unavailable/);
  failure = null; await poll();
  assert.match(text(failed.render()), /Responder assigned/);
  failed.unmount();
  let { instance: screen, element } = open(base.public_id);
  screen.render(); await tick(); let tree = screen.render();
  assert.match(text(tree), /Responder assigned/);
  assert.doesNotMatch(text(tree), /Responder on the way/);
  assert.equal(find(tree, n => n.type === 'MapViewer').props.trackers[0].id, 'unit-A');
  progress(tree); tree = screen.render();
  find(tree, n => n.props?.onLayout).props.onLayout({ nativeEvent: { layout: { width: 360 } } }); tree = screen.render();
  assert.equal(find(tree, n => n.type?.name === 'ProgressList').props.currentIndex, 2);
  assert.equal(find(tree, n => n.type?.name === 'Stat' && n.props.label === 'ETA').props.value, '\u2014');
  for (const [status, statusId, label, index] of [['EN_ROUTE', 7, 'Responder on the way', 3], ['ON_SCENE', 8, 'Responder arrived', 4]]) {
    report = { ...base, status_id: statusId, dispatched_units: [{ ...base.dispatched_units[0], status }] };
    await poll(); tree = screen.render();
    assert.match(text(tree), new RegExp(label));
    assert.equal(find(tree, n => n.type?.name === 'ProgressList').props.currentIndex, index);
  }
  failure = new Error('Offline'); await poll(); tree = screen.render();
  assert.match(text(tree), /Responder arrived/);
  assert.match(text(tree), /Tracking updates are unavailable/);
  failure = null; await poll(); assert.doesNotMatch(text(screen.render()), /Tracking updates are unavailable/);
  report = { ...base, status_id: 8, dispatched_units: [
    { ...base.dispatched_units[0], status: 'COMPLETED' },
    { id: 'declined', status: 'DECLINED', location: base.dispatched_units[0].location },
    { id: 'cancelled', status: 'CANCELLED', location: base.dispatched_units[0].location },
    { id: 'active', name: 'Police unit', role: 'police', status: 'ON_SCENE' },
  ] };
  await poll(); tree = screen.render();
  assert.match(text(tree), /Police unit/);
  assert.doesNotMatch(text(tree), /Emergency resolved|BFP Fire Unit/);
  assert.equal(tracking.trackingState(report).responder.id, 'active');
  report = { ...report, status_id: 9 }; await poll();
  assert.match(text(screen.render()), /Awaiting closure review/);
  assert.doesNotMatch(text(screen.render()), /Emergency resolved/);
  report = { ...report, status_id: 10 }; await poll();
  assert.match(text(screen.render()), /Emergency resolved/);

  // A new report gets a separate keyed session before any effects or requests.
  let resolveOld; pending = new Promise(resolve => { resolveOld = resolve; });
  await poll(); const requestsWhilePending = requestCount; await poll(); assert.equal(requestCount, requestsWhilePending); const oldSignal = lastSignal; const oldMessage = messageResolve;
  screen.unmount(); assert.equal(oldSignal.aborted, true);
  pending = null; report = { ...base, dispatched_units: [] };
  const next = open('incident-B'); assert.notEqual(element.props.key, next.element.props.key);
  screen = next.instance; tree = screen.render();
  assert.doesNotMatch(text(tree), /BFP Fire Unit|Police unit|Responder arrived/);
  await tick();
  resolveOld({ data: { report: base } }); oldMessage?.([{ id: 'old-message', body: 'Previous incident secret' }]);
  await tick(); tree = screen.render();
  assert.doesNotMatch(text(tree), /Previous incident secret|BFP Fire Unit|unit-A/);
  for (const status of [401, 403, 404]) {
    screen.unmount(); failure = Object.assign(new Error('Unavailable'), { status });
    screen = open('private-report').instance; screen.render(); await tick();
    assert.match(text(screen.render()), /Tracking unavailable/);
    assert.equal(find(screen.render(), n => n.type === 'MapViewer').props.trackers.length, 0);
  }
  screen.unmount(); failure = null;
  assert.equal(timers.size, 0);
  console.log('PASS dev-mode missing ID, assigned with GPS and matching heading/steps/ETA, en route, arrival, transient failure/recovery, multi-unit completion, closure review, access errors, keyed report switch and late report/message cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });
