/* global __dirname */
/* Run: node tests/resident-announcements.cjs. HTTP, hooks and native views are mocked. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const babel = require('@babel/core');
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
const native = Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable', 'Image', 'ActivityIndicator', 'RefreshControl'].map(name => [name, name]));
const first = { id: 'real-id', title: 'Unique published title', details: 'Long published details. '.repeat(20), category: 'General', published_at: '2026-11-23T00:00:00Z' };
let payload = { data: { announcements: [first] } }, failure, pending, calls = [], reportCalls = 0, mapCalls = 0, focus, navigations = [];
const api = { async get(url, options) {
  calls.push({ url, options });
  if (pending) return pending;
  if (failure) throw failure;
  return payload;
} };
const service = load('src/services/residentService.js', { './api': { __esModule: true, default: api }, './secureStorage': { secureStorage: {} } });
const Home = load('src/screens/resident/Home.jsx', {
  react: hooks, 'react-native': native, 'lucide-react-native': {}, twrnc: () => ({}),
  '@react-navigation/native': {
    useNavigation: () => ({ navigate: (...args) => navigations.push(args) }),
    useFocusEffect: cb => { focus = cb; hooks.useEffect(cb, [cb]); },
  },
  '../../components/map/MapViewer': { __esModule: true, default: 'MapViewer' },
  '../../services/residentService': {
    getAnnouncements: service.getAnnouncements,
    getReports: async () => { reportCalls++; return { data: { reports: [{ public_id: 'report-1' }] } }; },
    summarizeReports: () => ({ total: 1 }),
    getPublicMapFeed: async () => { mapCalls++; return [{ id: 'map-pin' }]; },
  },
}).default;
const cards = tree => nodes(tree).filter(n => n.type?.name === 'AnnouncementCard');
const retry = tree => find(tree, n => n.props?.accessibilityLabel === 'Retry announcements').props;
const refresh = r => find(r.render(), n => n.type === 'RefreshControl').props.onRefresh();
(async () => {
  const controller = new AbortController();
  assert.equal(await service.getAnnouncements({ signal: controller.signal }), payload);
  assert.equal(calls[0].url, '/announcements');
  assert.equal(calls[0].options.signal, controller.signal);
  for (const data of [null, {}, { announcements: null }, { announcements: {} }]) {
    payload = { data };
    await assert.rejects(service.getAnnouncements(), /Invalid announcements response/);
  }
  payload = { data: { announcements: [first] } };
  const r = runner(Home); r.render(); await tick();
  let tree = r.render();
  assert.equal(cards(tree)[0].props.key, first.id);
  const card = runner(cards(tree)[0].type, cards(tree)[0].props);
  let c = card.render();
  assert.match(text(c), /Unique published title/);
  assert.match(text(c), /General/);
  assert.match(text(c), /Nov 23, 2026/);
  const body = () => find(card.render(), n => n.type === 'Text' && n.props.children.includes(first.details));
  assert.equal(body().props.numberOfLines, 3);
  find(c, n => n.type === 'Pressable').props.onPress();
  assert.equal(body().props.numberOfLines, undefined);
  assert.match(text(card.render()), /Show less/);
  find(card.render(), n => n.type === 'Pressable').props.onPress();
  assert.equal(body().props.numberOfLines, 3);
  const short = runner(cards(tree)[0].type, { ann: { ...first, details: 'Short' } }).render();
  assert.equal(nodes(short).some(n => n.type === 'Pressable'), false);

  const second = { ...first, id: 'new-id', title: 'Newly published' };
  payload = { data: { announcements: [second, first] } };
  await refresh(r);
  assert.deepEqual(cards(r.render()).map(n => n.props.key), [second.id, first.id]);
  failure = new Error('Offline');
  await refresh(r); tree = r.render();
  assert.equal(cards(tree).length, 2);
  assert.match(text(tree), /Could not load announcements/);
  assert.doesNotMatch(text(tree), /No announcements at this time/);
  find(tree, n => n.props?.accessibilityLabel === 'Open full map').props.onPress();
  assert.equal(navigations[0][0], 'Map');
  assert.equal(find(tree, n => n.type?.name === 'ReportCard').props.report.public_id, 'report-1');
  const counts = [reportCalls, mapCalls];
  failure = null; payload = { data: { announcements: [second] } };
  await retry(tree).onPress();
  assert.deepEqual([reportCalls, mapCalls], counts);
  assert.deepEqual(cards(r.render()).map(n => n.props.key), [second.id]);
  assert.doesNotMatch(text(r.render()), /Could not load announcements/);
  payload = { data: { announcements: [] } };
  await refresh(r);
  assert.match(text(r.render()), /No announcements at this time/);

  let resolveOld;
  pending = new Promise(resolve => { resolveOld = resolve; });
  const oldRefresh = refresh(r);
  const oldSignal = calls.at(-1).options.signal;
  pending = null; payload = { data: { announcements: [second] } };
  await refresh(r);
  assert.equal(oldSignal.aborted, true);
  resolveOld({ data: { announcements: [first] } }); await oldRefresh;
  assert.deepEqual(cards(r.render()).map(n => n.props.key), [second.id]);
  r.unmount();
  failure = new Error('Initial failure');
  const fresh = runner(Home); fresh.render(); await tick();
  assert.match(text(fresh.render()), /Could not load announcements/);
  assert.doesNotMatch(text(fresh.render()), /No announcements at this time/);
  failure = null;
  const blur = focus(); await tick();
  assert.equal(cards(fresh.render()).length, 1);
  pending = new Promise(resolve => { resolveOld = resolve; });
  const leaving = refresh(fresh); const leavingSignal = calls.at(-1).options.signal;
  blur(); assert.equal(leavingSignal.aborted, true);
  resolveOld({ data: { announcements: [] } }); await leaving;
  assert.equal(cards(fresh.render()).length, 1);
  console.log('PASS: API path/shape/order, real IDs/details, expand/collapse, publish/unpublish refresh, empty/error/retry, independent reports/map, focus and stale-request cancellation. Mocked HTTP/native views; no physical device assertions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
