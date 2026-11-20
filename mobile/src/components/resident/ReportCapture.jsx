import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { validateEvidence } from '../../utils/residentReport';

// A live camera only. Photo/Video changes capture mode, never the media source.
export default function ReportCapture({ initialMode = 'picture', signal, onCapture, onCancel }) {
  const camera = useRef(null);
  const canceled = useRef(false);
  const lock = useRef(false);
  const [mode, setMode] = useState(initialMode);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    canceled.current = false;
    const currentCamera = camera;
    return () => { canceled.current = true; currentCamera.current?.stopRecording(); };
  }, []);

  function cancel() {
    canceled.current = true;
    camera.current?.stopRecording();
    onCancel();
  }

  function switchMode(next) {
    if (lock.current || mode === next) return;
    setReady(false); setError(''); setMode(next);
  }

  async function capture() {
    if (lock.current || !ready || !camera.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (mode === 'video') {
        const permission = await Camera.requestMicrophonePermissionsAsync();
        if (canceled.current || signal?.aborted) return;
        if (!permission.granted) {
          setError('Microphone permission is needed to record video with sound. Enable it in Settings, or switch to Photo.');
          return;
        }
      }
      setRecording(mode === 'video');
      const capture = mode === 'video'
        ? await camera.current.recordAsync({ codec: 'avc1', maxFileSize: 25 * 1024 * 1024 - 128 * 1024 })
        : await camera.current.takePictureAsync({ quality: 0.7 });
      if (canceled.current || signal?.aborted) return;
      if (!capture?.uri) throw new Error('No capture');
      const type = mode === 'picture' ? 'image/jpeg'
        : capture.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
      const file = { uri: capture.uri, name: capture.uri.split('/').pop(), type, size: new File(capture.uri).size };
      validateEvidence(file);
      onCapture(file);
    } catch (failure) {
      if (!canceled.current && !signal?.aborted) setError(failure.message?.startsWith('Use JPEG')
        ? failure.message : 'Capture failed. Please try again.');
    } finally {
      lock.current = false;
      if (!canceled.current && !signal?.aborted) { setBusy(false); setRecording(false); }
    }
  }

  return <View style={[tw`flex-1 bg-black`, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      <View style={tw`flex-row items-center justify-between px-4 py-2`}>
        <Text style={tw`font-bold text-white`}>{recording ? 'Recording...' : 'Capture report evidence'}</Text>
        <Control label="Cancel capture" onPress={cancel} />
      </View>
      <CameraView key={mode} ref={camera} mode={mode} facing="back" videoQuality="480p" videoBitrate={2000000}
        style={tw`flex-1`} onCameraReady={() => setReady(true)}
        onMountError={() => { setReady(false); setError('Camera unavailable. Close and try again.'); }} />
      {!!error && <Text accessibilityRole="alert" style={tw`px-4 pt-3 text-white`}>{error}</Text>}
      <View style={tw`flex-row justify-center gap-4 px-4 pt-3`}>
        <Control label="Photo" selected={mode === 'picture'} disabled={busy} onPress={() => switchMode('picture')} />
        <Control label="Video" selected={mode === 'video'} disabled={busy} onPress={() => switchMode('video')} />
      </View>
      <View style={tw`items-center px-4 pt-2`}>
        {recording ? <Control label="Stop recording" onPress={() => camera.current?.stopRecording()} />
          : <Control label={mode === 'picture' ? 'Take Photo' : 'Record Video'} disabled={!ready || busy} onPress={capture} />}
      </View>
    </View>;
}

function Control({ label, onPress, disabled, selected }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, selected }}
    disabled={disabled} onPress={onPress} style={[tw`min-h-11 items-center justify-center rounded-xl border border-white px-4 py-3`, { opacity: disabled ? 0.4 : 1, backgroundColor: selected ? '#1F7A4D' : 'transparent' }]}>
    <Text style={tw`font-bold text-white`}>{label}</Text>
  </Pressable>;
}
