/* global __dirname */
/* Run: node tests/resident-report-details.cjs
 * React hooks, native components, device APIs and HTTP are mocked; real component handlers,
 * service serialization, upload recovery and the installed stack router execute.
 */
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
const action = (tree, label) => find(tree, n => n.props?.label === label).props;
const text = tree => JSON.stringify(tree);
let alertOptions;
const native = Object.fromEntries(['ActivityIndicator', 'Image', 'Modal', 'Pressable', 'Text', 'View', 'ScrollView', 'TextInput', 'RefreshControl'].map(name => [name, name]));
native.Alert = {
  alert: (title, message, options) => {
    alertOptions = options;
  }
};
const util = load('src/utils/residentReport.js');
let apiCalls = [],
  saved = [];
const api = {
  defaults: {
    baseURL: 'http://localhost:8787/api'
  },
  async request(config) {
    apiCalls.push(config);
    return {
      data: {
        attachments: saved
      }
    };
  }
};
const service = load('src/services/residentService.js', {
  './api': api,
  './secureStorage': {
    secureStorage: {
      getAccessToken: async () => 'test-token'
    }
  }
});
let checks = 0;
function pass(label) {
  checks++;
  console.log('PASS', label);
}
(async () => {
  assert.equal(util.canEditReport({
    status_id: 1
  }), true);
  assert.equal(util.canEditReport({
    status_id: 13
  }), false);
  assert.equal(util.canEditReport({
    status_id: 1,
    is_terminal: true
  }), false);
  assert.equal(util.canUploadReport({
    status_id: 13,
    reported_by_user_id: 'resident'
  }, {
    id: 'resident'
  }), true);
  assert.equal(util.canUploadReport({
    reported_by_user_id: 'other'
  }, {
    id: 'resident'
  }), false);
  assert.equal(JSON.stringify(util.editPayload(' hello ', ' street ')), JSON.stringify({
    description_sanitized: 'hello',
    location_description: 'street'
  }));
  assert.throws(() => util.editPayload('x'.repeat(10001), ''));
  assert.throws(() => util.editPayload('', 'x'.repeat(4001)));
  pass('edit eligibility, separate upload ownership, editable fields and limits');
  for (const type of util.MEDIA_TYPES) {
    const size = (type.startsWith('video/') ? 25 : 10) * 1024 * 1024;
    util.validateEvidence({
      type,
      size
    });
    assert.throws(() => util.validateEvidence({
      type,
      size: size + 1
    }));
  }
  assert.throws(() => util.validateEvidence({
    type: 'image/heic',
    size: 100
  }));
  assert.throws(() => util.validateEvidence({
    type: 'image/jpeg',
    size: 0
  }));
  pass('all six accepted formats, exact photo/video byte boundaries, invalid and empty files');
  const a = {
      id: 'uuid-a',
      file: {
        uri: 'file:///a.jpg',
        name: 'a.jpg',
        type: 'image/jpeg',
        size: 100
      }
    },
    b = {
      id: 'uuid-b',
      file: {
        uri: 'file:///b.jpg',
        name: 'b.jpg',
        type: 'image/jpeg',
        size: 100
      }
    };
  let stored = [],
    uploads = [],
    fail = true;
  const list = async () => ({
    data: {
      attachments: stored
    }
  });
  const upload = async (id, file, key) => {
    uploads.push(key);
    if (key === b.id && fail) throw new Error('Offline');
    stored.push({
      id: key,
      upload_id: key
    });
    if (key === a.id) throw new Error('Response lost');
  };
  const first = await util.uploadEvidenceQueue({
    reportId: 'r',
    items: [a, b],
    list,
    upload
  });
  assert.equal(first.errors.length, 1);
  assert.equal(first.errors[0].id, b.id);
  fail = false;
  const second = await util.uploadEvidenceQueue({
    reportId: 'r',
    items: [a, b],
    list,
    upload
  });
  assert.equal(second.errors.length, 0);
  assert.deepEqual(uploads, ['uuid-a', 'uuid-b', 'uuid-b']);
  assert.equal((await list()).data.attachments.length, 2);
  pass('lost response reconciled, partial failure retries outstanding file only, saved items persist on reopen');
  stored = [];
  let calls = 0;
  const uncertain = await util.uploadEvidenceQueue({
    reportId: 'r',
    items: [a],
    list: async () => {
      if (++calls > 1) throw new Error('offline');
      return {
        data: {
          attachments: []
        }
      };
    },
    upload: async () => {}
  });
  assert.ok(uncertain.listError);
  pass('post-upload list failure remains an error, not an empty success');
  saved = [{
    id: 'signed',
    url: '/api/media/signed?signature=fake',
    media_type: 'PHOTO'
  }, {
    id: 'protected',
    url: '/api/reports/r/photos/p',
    media_type: 'PHOTO'
  }, {
    id: 'external',
    url: 'https://example.com/media.jpg',
    media_type: 'PHOTO'
  }];
  const media = (await service.getReportAttachments('report/one')).data.attachments;
  assert.equal(apiCalls.at(-1).url, '/reports/report%2Fone/attachments');
  assert.equal(media[0].source.uri, 'http://localhost:8787/api/media/signed?signature=fake');
  assert.equal(media[0].source.headers, undefined);
  assert.equal(media[1].source.headers.Authorization, 'Bearer test-token');
  assert.equal(media[2].source.headers, undefined);
  await service.uploadReportAttachment('report/one', a.file, a.id);
  const config = apiCalls.at(-1);
  assert.equal(config.method, 'POST');
  assert.equal(config.data.parts[0].length, 2);
  assert.equal(config.data.parts[0][1].uri, a.file.uri);
  assert.equal(config.data.parts[1][1], a.id);
  assert.equal(config.headers['Content-Type'], 'multipart/form-data');
  pass('encoded IDs, native multipart file/UUID, signed URL resolution and credential isolation');
  const originalRequest = api.request;
  api.request = async config => {
    if (config.url.endsWith('/attachments')) throw {
      response: {
        status: 503,
        data: {
          error: 'Media unavailable'
        }
      }
    };
    return {
      data: {
        report: {
          incident_id: 'summary-only',
          description_original: 'Readable summary',
          incident_status_id: 1
        }
      }
    };
  };
  const partial = await service.getReportDetails('summary-only');
  assert.equal(partial.data.report.description, 'Readable summary');
  assert.equal(partial.data.report.attachments_error, 'Media unavailable');
  api.request = originalRequest;
  pass('attachment endpoint failure preserves readable summary and an explicit media error');
  const report = (id, status = 1) => ({
    public_id: id,
    reference_number: 'GF-test-' + id,
    title: 'Title ' + id,
    description: 'Description ' + id,
    address: 'Long address ' + id,
    status_id: status,
    status_label: status === 1 ? 'Submitted' : 'Dispatched',
    reported_by_user_id: 'resident',
    attachments: [],
    status_events: [{
      id: 'event',
      label: 'Submitted',
      created_at: '2026-11-19T00:00:00Z'
    }]
  });
  let records = {
      'crime-full-id': report('crime-full-id'),
      'fire-full-id': report('fire-full-id', 13)
    },
    detailsCalls = [],
    patchCalls = [],
    rejectSave = false;
  const screenService = {
    async getReportDetails(id) {
      detailsCalls.push(id);
      return {
        data: {
          report: {
            ...records[id]
          }
        }
      };
    },
    async getReportAttachments() {
      return {
        data: {
          attachments: []
        }
      };
    },
    async updateReportDetails(id, body) {
      patchCalls.push({
        id,
        body
      });
      if (rejectSave) {
        records[id].status_id = 13;
        throw Object.assign(new Error('Changed status'), {
          status: 409
        });
      }
      records[id] = {
        ...records[id],
        description: body.description_sanitized,
        address: body.location_description
      };
      return {
        data: {
          report: records[id]
        }
      };
    }
  };
  const page = load('src/screens/resident/ReportDetails.jsx', {
    'react': hooks,
    'react-native': native,
    '@react-navigation/native': {
      usePreventRemove() {}
    },
    'twrnc': () => ({}),
    '../../context/AuthContext': {
      useAuth: () => ({
        user: {
          id: 'resident'
        }
      })
    },
    '../../services/residentService': screenService,
    '../../components/resident/ReportMedia': {
      __esModule: true,
      default: 'ReportMedia',
      ReportAction: 'Action'
    },
    '../../utils/residentReport': util
  }).default;
  let origin = page({
    route: {
      params: {
        publicId: 'crime-full-id'
      }
    }
  });
  let r = runner(origin.type, origin.props);
  assert.match(text(r.render()), /Loading report/);
  await tick();
  let tree = r.render();
  assert.match(text(tree), /GF-test-crime-full-id/);
  action(tree, 'Edit Details').onPress();
  tree = r.render();
  find(tree, n => n.props?.accessibilityLabel === 'Description').props.onChangeText('draft cancelled');
  action(tree, 'Cancel').onPress();
  assert.equal(patchCalls.length, 0);
  tree = r.render();
  action(tree, 'Edit Details').onPress();
  tree = r.render();
  assert.equal(find(tree, n => n.props?.accessibilityLabel === 'Description').props.value, 'Description crime-full-id');
  find(tree, n => n.props?.accessibilityLabel === 'Description').props.onChangeText('Saved mobile edit');
  tree = r.render();
  const saving = action(tree, 'Save Changes').onPress();
  action(tree, 'Save Changes').onPress();
  await saving;
  await tick();
  tree = r.render();
  assert.equal(patchCalls.length, 1);
  assert.match(text(tree), /Saved mobile edit/);
  pass('actual edit prefill, cancel, save serialization, duplicate-tap guard and refreshed summary');
  action(tree, 'Edit Details').onPress();
  tree = r.render();
  rejectSave = true;
  await action(tree, 'Save Changes').onPress();
  tree = r.render();
  assert.match(text(tree), /status or access changed/);
  assert.equal(action(tree, 'Save Changes').disabled, true);
  pass('409 refreshes eligibility and retains draft');
  r.unmount();
  origin = page({
    route: {
      params: {
        publicId: 'fire-full-id'
      }
    }
  });
  r = runner(origin.type, origin.props);
  assert.doesNotMatch(text(r.render()), /crime-full-id/);
  await tick();
  tree = r.render();
  assert.match(text(tree), /GF-test-fire-full-id/);
  assert.equal(nodes(tree).some(n => n.props?.label === 'Edit Details'), false);
  assert.equal(find(tree, n => n.type === 'ReportMedia').props.canUpload, true);
  await find(tree, n => n.type === 'RefreshControl').props.onRefresh();
  await tick();
  assert.ok(detailsCalls.filter(id => id === 'fire-full-id').length >= 2);
  pass('two full publicIds, report isolation, dispatched read-only edit with upload still available, pull refresh');
  const routerModule = await import('@react-navigation/routers');
  const nav = fs.readFileSync(path.join(__dirname, '../src/navigation/ResidentNavigator.js'), 'utf8');
  const names = [...nav.matchAll(/name="([^"]+)"/g)].map(m => m[1]);
  const options = {
    routeNames: names,
    routeParamList: {},
    routeGetIdList: {}
  };
  const router = routerModule.StackRouter({
    initialRouteName: 'Resident'
  });
  const go = routerModule.CommonActions;
  for (const originName of ['Resident', 'MyReports']) {
    let s = router.getInitialState(options);
    if (originName === 'MyReports') s = router.getStateForAction(s, go.navigate(originName, {
      status: 'in_progress'
    }), options);
    const original = s.routes[s.index];
    for (const destination of ['Notifications', 'ReportDetails']) {
      s = router.getStateForAction(s, go.navigate(destination, {
        publicId: 'full-public-id'
      }), options);
      s = router.getStateForAction(s, go.goBack(), options);
      assert.deepEqual(s.routes[s.index], original);
    }
  }
  pass('installed navigator: detail and notification Back preserve origin/filter');
  let permission = true,
    microphone = true,
    permissionCalls = 0,
    uuid = 0,
    uploadCount = 0,
    capturedSize = 1024;
  const cameraApi = {
    requestCameraPermissionsAsync: async () => {
      permissionCalls++;
      return {
        granted: permission
      };
    },
    requestMicrophonePermissionsAsync: async () => ({
      granted: microphone
    })
  };
  const captureModule = load('src/components/shared/CameraCapture.jsx', {
    'react': hooks,
    'react-native': native,
    'expo-camera': {
      Camera: cameraApi,
      CameraView: 'CameraView'
    },
    'lucide-react-native': {
      Camera: 'Camera',
      SwitchCamera: 'SwitchCamera',
      Video: 'Video',
      X: 'X',
      Zap: 'Zap',
      ZapOff: 'ZapOff'
    },
    'expo-file-system': {
      File: class {
        get size() {
          return capturedSize;
        }
      }
    },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({
        top: 0,
        bottom: 0
      })
    },
    'twrnc': () => ({}),
    '../../utils/residentReport': util
  });
  const photoOnlyCamera = runner(captureModule.default, {
    allowVideo: false,
    initialMode: 'video'
  }).render();
  assert.ok(nodes(photoOnlyCamera).some(node => node.props?.label === 'Take Photo'));
  assert.equal(nodes(photoOnlyCamera).some(node => node.props?.label === 'Video'), false);
  let storedCaptures = [],
    uploadedReports = [];
  const mediaModule = load('src/components/resident/ReportMedia.jsx', {
    'react': hooks,
    'react-native': native,
    'expo-camera': {
      Camera: cameraApi
    },
    'expo-crypto': {
      randomUUID: () => 'pending-' + ++uuid
    },
    '../shared/CameraCapture': {
      __esModule: true,
      default: captureModule.default
    },
    'expo-video': {
      VideoView: 'VideoView',
      useVideoPlayer: () => ({
        status: 'readyToPlay'
      })
    },
    'expo': {
      useEvent: () => ({
        status: 'readyToPlay'
      })
    },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({
        top: 0,
        bottom: 0
      })
    },
    'twrnc': () => ({}),
    '../../utils/residentReport': util,
    '../../services/residentService': {
      getReportAttachments: async () => ({
        data: {
          attachments: storedCaptures
        }
      }),
      uploadReportAttachment: async (id, file, uploadId) => {
        uploadCount++;
        uploadedReports.push(id);
        storedCaptures.push({
          id: uploadId,
          upload_id: uploadId,
          original_filename: file.name,
          media_type: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO',
          url: 'http://localhost/saved'
        });
      }
    }
  });
  const props = {
    reportId: 'selected-full-report-id',
    attachments: [],
    mediaError: null,
    canUpload: true,
    disabled: false,
    onReload() {},
    onBusy() {},
    onResult(attachments) {
      props.attachments = attachments;
    }
  };
  let m = runner(mediaModule.default, props);
  const cameraNode = () => find(m.render(), n => n.type === captureModule.default);
  const newFile = (name = 'capture.jpg', type = 'image/jpeg') => ({
    uri: 'file:///' + name,
    name,
    type,
    size: 1024
  });
  tree = m.render();
  assert.match(text(tree), /No saved photos/);
  permission = false;
  await action(tree, 'Take Photo / Record Video').onPress();
  assert.match(text(m.render()), /Camera permission denied/);
  assert.equal(nodes(m.render()).some(n => n.type === captureModule.default), false);
  permission = true;
  const opening = action(m.render(), 'Take Photo / Record Video').onPress();
  action(m.render(), 'Take Photo / Record Video').onPress();
  await opening;
  assert.equal(permissionCalls, 2);
  assert.equal(alertOptions, undefined);
  const cameraSignal = cameraNode().props.signal;
  assert.equal(nodes(m.render()).filter(n => n.type === 'Modal').length, 1);
  find(m.render(), n => n.type === 'Modal').props.onRequestClose();
  assert.equal(cameraSignal.aborted, true);
  assert.equal(nodes(m.render()).some(n => n.props?.pendingId), false);
  await action(m.render(), 'Take Photo / Record Video').onPress();
  cameraNode().props.onCapture(newFile());
  tree = m.render();
  assert.equal(uploadCount, 0);
  let preview = find(tree, n => n.props?.onSave);
  assert.equal(preview.props.media.source.uri, 'file:///capture.jpg');
  await preview.props.onRetake();
  cameraNode().props.onCancel();
  assert.match(text(m.render()), /capture.jpg/);
  await action(m.render(), 'Retake capture.jpg').onPress();
  cameraNode().props.onCapture(newFile('retaken.jpg'));
  tree = m.render();
  assert.doesNotMatch(text(tree), /capture.jpg/);
  assert.match(text(tree), /retaken.jpg/);
  preview = find(tree, n => n.props?.onSave);
  const savingCapture = preview.props.onSave();
  preview.props.onSave();
  await savingCapture;
  assert.equal(uploadCount, 1);
  assert.deepEqual(uploadedReports, ['selected-full-report-id']);
  tree = m.render();
  assert.equal(nodes(tree).some(n => n.props?.onSave), false);
  assert.match(text(tree), /retaken.jpg/);
  await action(tree, 'Take Photo / Record Video').onPress();
  cameraNode().props.onCapture(newFile('video.mp4', 'video/mp4'));
  preview = find(m.render(), n => n.props?.onSave);
  const modalTree = runner(preview.type, preview.props).render();
  const video = find(modalTree, n => typeof n.type === 'function' && n.type.name === 'VideoPreview');
  assert.equal(find(runner(video.type, video.props).render(), n => n.type === 'VideoView').props.nativeControls, true);
  action(modalTree, 'Discard').onPress();
  assert.doesNotMatch(text(m.render()), /video.mp4/);
  assert.equal(uploadCount, 1);
  props.attachments = Array.from({
    length: 5
  }, (_, i) => ({
    id: i,
    url: 'http://localhost/photo',
    original_filename: 'saved',
    media_type: 'PHOTO'
  }));
  assert.equal(action(m.render(), 'Take Photo / Record Video').disabled, true);
  props.mediaError = 'Media failed';
  assert.match(text(m.render()), /Saved count unavailable/);
  assert.doesNotMatch(text(m.render()), /No saved photos/);
  pass('direct camera only, permission/cancel, canceled and completed retake, preview/discard, explicit Save to Report, duplicate-save protection and saved viewing');
  let photoCalls = 0,
    recordCalls = 0,
    stopCalls = 0,
    finished = [],
    cancelCalls = 0,
    resolveVideo;
  const device = {
    takePictureAsync: async () => {
      photoCalls++;
      return {
        uri: 'file:///new.jpg'
      };
    },
    recordAsync: options => {
      recordCalls++;
      assert.equal(options.codec, 'avc1');
      assert.ok(options.maxFileSize <= 25 * 1024 * 1024);
      return new Promise(resolve => {
        resolveVideo = resolve;
      });
    },
    stopRecording: () => {
      stopCalls++;
      resolveVideo?.({
        uri: 'file:///new.mp4'
      });
    }
  };
  const captureProps = {
    onCapture: file => finished.push(file),
    onCancel: () => cancelCalls++
  };
  let c = runner(captureModule.default, captureProps);
  function readyCamera() {
    let t = c.render();
    const view = find(t, n => n.type === 'CameraView');
    view.props.ref.current = device;
    view.props.onCameraReady();
    return c.render();
  }
  tree = readyCamera();
  const taking = action(tree, 'Take Photo').onPress();
  action(tree, 'Take Photo').onPress();
  await taking;
  assert.equal(photoCalls, 1);
  assert.equal(finished[0].type, 'image/jpeg');
  assert.equal(finished[0].uri, 'file:///new.jpg');
  c.unmount();
  c = runner(captureModule.default, captureProps);
  tree = readyCamera();
  action(tree, 'Video').onPress();
  tree = readyCamera();
  microphone = false;
  await action(tree, 'Record Video').onPress();
  assert.match(text(c.render()), /Microphone permission/);
  assert.equal(recordCalls, 0);
  microphone = true;
  tree = c.render();
  const recording = action(tree, 'Record Video').onPress();
  await tick();
  tree = c.render();
  assert.equal(find(tree, n => n.type === 'CameraView').props.mode, 'video');
  action(tree, 'Stop recording').onPress();
  await recording;
  assert.equal(recordCalls, 1);
  assert.equal(finished[1].type, 'video/mp4');
  assert.ok(stopCalls > 0);
  c.unmount();
  c = runner(captureModule.default, captureProps);
  tree = readyCamera();
  action(tree, 'Video').onPress();
  tree = readyCamera();
  const canceledRecording = action(tree, 'Record Video').onPress();
  await tick();
  action(c.render(), 'Cancel capture').onPress();
  await canceledRecording;
  assert.equal(finished.length, 2);
  assert.equal(cancelCalls, 1);
  c.unmount();
  capturedSize = 10 * 1024 * 1024 + 1;
  c = runner(captureModule.default, captureProps);
  tree = readyCamera();
  await action(tree, 'Take Photo').onPress();
  assert.match(text(c.render()), /up to 10 MiB/);
  assert.equal(finished.length, 2);
  c.unmount();
  pass('real camera handlers: photo/video modes, readiness, microphone denial, stop, cancel ignores late result, size validation');
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../src/components/resident/ReportMedia.jsx'), 'utf8'), /ImagePicker|launchImageLibrary|requestMediaLibrary|Choose from Gallery|Choose a source/);
  pass('Report Details capture has no gallery, library, picker or source chooser path');
  let resolveOld;
  const originalGet = screenService.getReportDetails;
  screenService.getReportDetails = () => new Promise(resolve => {
    resolveOld = resolve;
  });
  origin = page({
    route: {
      params: {
        publicId: 'old-report'
      }
    }
  });
  const oldRunner = runner(origin.type, origin.props);
  oldRunner.render();
  oldRunner.unmount();
  screenService.getReportDetails = originalGet;
  origin = page({
    route: {
      params: {
        publicId: 'fire-full-id'
      }
    }
  });
  const newRunner = runner(origin.type, origin.props);
  newRunner.render();
  await tick();
  resolveOld({
    data: {
      report: report('old-report')
    }
  });
  await tick();
  assert.doesNotMatch(text(newRunner.render()), /old-report/);
  pass('late response from unmounted report cannot appear under a newly opened report');
  let listCalls = [],
    navigations = [],
    focus;
  const List = load('src/screens/resident/MyReports.jsx', {
    'react': hooks,
    'react-native': native,
    'lucide-react-native': {},
    'twrnc': () => ({}),
    '@react-navigation/native': {
      useNavigation: () => ({
        navigate: (...args) => navigations.push(args)
      }),
      useRoute: () => ({
        params: {
          status: 'submitted'
        }
      }),
      useFocusEffect: cb => {
        focus = cb;
        hooks.useEffect(cb, [cb]);
      }
    },
    '../../services/residentService': {
      getReports: async options => {
        listCalls.push(options);
        return {
          data: {
            reports: [records['crime-full-id'], records['fire-full-id']]
          }
        };
      }
    }
  }).default;
  const listRunner = runner(List);
  listRunner.render();
  await tick();
  tree = listRunner.render();
  for (const id of ['crime-full-id', 'fire-full-id']) find(tree, n => n.props?.accessibilityLabel === 'View report ' + id).props.onPress();
  assert.equal(navigations[0][1].publicId, 'crime-full-id');
  assert.equal(navigations[1][1].publicId, 'fire-full-id');
  records['crime-full-id'].description = 'Updated on return';
  const blur = focus();
  await tick();
  tree = listRunner.render();
  assert.match(text(tree), /Updated on return/);
  assert.ok(listCalls.every(call => call.status === 'submitted'));
  blur();
  pass('whole card handlers carry full IDs; list refocus reloads saved edits and keeps selected filter');
  console.log(`${checks} focused groups passed. No live API or physical-device assertions.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
