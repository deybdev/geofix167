import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { Camera } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { getReportAttachments, uploadReportAttachment } from '../../services/residentService';
import { MAX_ATTACHMENTS, uploadEvidenceQueue, validateEvidence } from '../../utils/residentReport';
import CameraCapture from '../shared/CameraCapture';

export function ReportAction({ label, onPress, disabled = false }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[tw`mt-3 min-h-11 items-center justify-center rounded-xl border border-green-700 px-4 py-3`, { opacity: disabled ? 0.45 : 1 }]}>
    <Text style={tw`text-center font-bold text-green-800`}>{label}</Text>
  </Pressable>;
}

function VideoPreview({ source }) {
  const player = useVideoPlayer(source);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return <View>
    <VideoView player={player} nativeControls contentFit="contain" style={{ height: 280, width: '100%' }} />
    {status === 'error' && <Text style={tw`p-3 text-white`}>Video could not play. Close this preview and retry media to renew its link. Some formats may not play on every phone.</Text>}
  </View>;
}

function MediaPreview({ media, onClose, onRetake, onDiscard, onSave }) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  return <View style={[tw`flex-1 bg-slate-950 px-4`, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close media preview" onPress={onClose} style={tw`self-end p-4`}><Text style={tw`font-bold text-white`}>Close</Text></Pressable>
      <View style={tw`flex-1 justify-center`}>
        {media.video ? <VideoPreview source={media.source} /> : <Image source={media.source} resizeMode="contain" style={tw`h-full w-full`} onError={() => setFailed(true)} />}
      </View>
      {failed && <Text style={tw`p-3 text-white`}>Photo could not load. Close and retry media to renew its link.</Text>}
      <Text style={tw`py-3 text-center text-white`}>{media.name}</Text>
      {onSave && <View style={tw`rounded-xl bg-white p-3`}>
        <Text style={tw`text-center text-slate-600`}>New capture — not saved</Text>
        <ReportAction label="Retake" onPress={onRetake} />
        <ReportAction label="Discard" onPress={onDiscard} />
        <ReportAction label="Save to Report" onPress={onSave} />
      </View>}
    </View>;
}

function MediaTile({ media, onPress }) {
  const [failed, setFailed] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${media.name}`} onPress={onPress} style={tw`rounded-xl bg-slate-100 p-2`}>
    {media.video || failed ? <View style={tw`h-28 items-center justify-center`}><Text style={tw`font-bold text-green-800`}>{media.video ? 'Play video' : 'Photo unavailable'}</Text></View>
      : <Image source={media.source} onError={() => setFailed(true)} style={tw`h-28 w-full rounded-lg`} resizeMode="cover" />}
    <Text numberOfLines={2} style={tw`mt-2 text-xs text-slate-700`}>{media.name}</Text>
  </Pressable>;
}

export default function ReportMedia({ reportId, attachments, mediaError, canUpload, disabled, onReload, onBusy, onResult }) {
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState(null);
  const [preview, setPreview] = useState(null);
  const [capture, setCapture] = useState(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const unconfirmed = pending.filter(item => !attachments.some(saved => saved.upload_id === item.id));
  const remaining = Math.max(0, MAX_ATTACHMENTS - attachments.length - unconfirmed.length);

  async function openCamera(item = null) {
    if (lock.current || disabled || mediaError || (!item && !remaining)) return;
    lock.current = true;
    setBusy(true); onBusy(true); setNotice('');
    let opened = false;
    try {
      const permission = await Camera.requestCameraPermissionsAsync();
      if (!alive.current) return;
      if (!permission.granted) {
        setPreview(null);
        setNotice('Camera permission denied. Enable camera access in Settings to capture evidence.');
        return;
      }
      setCapture({ item, controller: new AbortController(), initialMode: item?.file.type.startsWith('video/') ? 'video' : 'picture' });
      setPreview(null);
      opened = true;
    } catch {
      setPreview(null);
      setNotice('Could not open the camera. Please try again.');
    } finally {
      if (!opened) {
        lock.current = false;
        if (alive.current) { setBusy(false); onBusy(false); }
      }
    }
  }

  function closeCamera() {
    capture?.controller.abort();
    setCapture(null); lock.current = false; setBusy(false); onBusy(false);
  }

  function acceptCapture(file) {
    validateEvidence(file);
    const item = { id: Crypto.randomUUID(), file };
    setPending(previous => capture.item
      ? previous.map(old => old.id === capture.item.id ? item : old)
      : [...previous, item]);
    closeCamera();
    setPreview({ pendingId: item.id, source: { uri: file.uri }, name: file.name, video: file.type.startsWith('video/') });
  }

  function discard(item) {
    setPreview(null);
    setPending(items => items.filter(other => other.id !== item.id));
  }

  async function upload(items = pending) {
    if (lock.current || disabled || !items.length) return;
    setPreview(null);
    lock.current = true; setBusy(true); onBusy(true); setNotice('');
    try {
      const result = await uploadEvidenceQueue({ reportId, items,
        list: getReportAttachments, upload: uploadReportAttachment,
        onSaved: id => { if (alive.current) setPending(items => items.filter(item => item.id !== id)); },
        onProgress: id => { if (alive.current) setProgress(id); },
      });
      if (!alive.current) return;
      onResult(result.attachments, result.listError);
      setPending(items => items.map(item => ({ ...item, error: result.errors.find(error => error.id === item.id)?.message })));
      setNotice(result.errors.length ? 'Some files were not saved. Retry uploads to send only outstanding files.' : 'Uploads saved.');
    } catch {
      if (alive.current) setNotice('Could not verify saved media. Retry media, then retry uploads. Your pending files are retained.');
    } finally {
      lock.current = false;
      if (alive.current) { setBusy(false); setProgress(null); onBusy(false); }
    }
  }

  return <View style={tw`mt-5 rounded-2xl bg-white p-4`}>
    <Text style={tw`text-lg font-bold text-slate-900`}>Photos and videos</Text>
    <Text style={tw`mt-1 text-xs text-slate-600`}>{mediaError ? 'Saved count unavailable' : `${attachments.length} saved · ${unconfirmed.length} pending · ${remaining} slots remaining`}</Text>
    {!!mediaError && <Text accessibilityRole="alert" style={tw`mt-3 text-amber-800`}>{mediaError}</Text>}
    {!mediaError && !attachments.length && <Text style={tw`mt-3 text-slate-600`}>No saved photos or videos yet.</Text>}
    {attachments.map(item => {
      const media = { source: item.source || { uri: item.url }, name: item.original_filename || 'Report media', video: item.media_type === 'VIDEO' };
      return <View key={`${item.id}-${item.url}`} style={tw`mt-3`}><MediaTile media={media} onPress={() => setPreview(media)} /></View>;
    })}
    <ReportAction label="Retry / refresh media" onPress={() => { setPreview(null); onReload(); }} disabled={disabled || busy} />
    {canUpload && <>
      <Text style={tw`mt-4 text-xs text-slate-600`}>Five files total. JPEG, PNG, WebP photos up to 10 MiB; MP4, WebM, MOV videos up to 25 MiB.</Text>
      <ReportAction label="Take Photo / Record Video" disabled={disabled || busy || !!mediaError || remaining === 0} onPress={() => openCamera()} />
    </>}
    {!!pending.length && <Text style={tw`mt-4 font-bold text-slate-800`}>Pending — not saved</Text>}
    {pending.map(item => {
      const media = { pendingId: item.id, source: { uri: item.file.uri }, name: item.file.name, video: item.file.type.startsWith('video/') };
      return <View key={item.id} style={tw`mt-3 rounded-xl border border-amber-200 p-2`}>
        <MediaTile media={media} onPress={() => setPreview(media)} />
        {progress === item.id && <Text style={tw`mt-2 text-green-800`}>Uploading...</Text>}
        {!!item.error && <Text style={tw`mt-2 text-red-700`}>{item.error}</Text>}
        <ReportAction label={`Retake ${item.file.name}`} disabled={disabled || busy || !!mediaError} onPress={() => openCamera(item)} />
        <ReportAction label={`Discard ${item.file.name}`} disabled={busy} onPress={() => discard(item)} />
      </View>;
    })}
    {canUpload && !!pending.length && <ReportAction label={busy ? 'Saving...' : 'Save to Report'} onPress={() => upload()} disabled={disabled || busy} />}
    {busy && <ActivityIndicator style={tw`mt-3`} color="#1F7A4D" />}
    {!!notice && <Text accessibilityLiveRegion="polite" style={tw`mt-3 text-slate-700`}>{notice}</Text>}
    {/* One modal avoids overlapping native presentations during capture/retake. */}
    {(capture || preview) && <Modal visible animationType="slide" onRequestClose={capture ? closeCamera : () => setPreview(null)}>
    {capture ? <CameraCapture initialMode={capture.initialMode} signal={capture.controller.signal} onCapture={acceptCapture} onCancel={closeCamera} />
      : <MediaPreview media={preview} onClose={() => setPreview(null)}
      {...(preview.pendingId && pending.some(item => item.id === preview.pendingId) ? {
        onRetake: () => openCamera(pending.find(item => item.id === preview.pendingId)),
        onDiscard: () => discard(pending.find(item => item.id === preview.pendingId)),
        onSave: () => upload(pending.filter(item => item.id === preview.pendingId)),
      } : {})} />}
    </Modal>}
  </View>;
}
