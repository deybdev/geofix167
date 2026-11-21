import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera as CameraIcon, SwitchCamera, Video as VideoIcon, X, Zap, ZapOff } from 'lucide-react-native';
import tw from 'twrnc';
import { validateEvidence } from '../../utils/residentReport';

const PHOTO_FLASH = ['off', 'on', 'auto'];
const FLASH_LABEL = { off: 'Flash off', on: 'Flash on', auto: 'Flash auto' };

const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// A live camera only. Photo/Video changes capture mode, never the media source.
export default function CameraCapture({
  initialMode = 'picture',
  allowVideo = true,
  signal,
  onCapture,
  onCancel,
}) {
  const camera = useRef(null);
  const canceled = useRef(false);
  const lock = useRef(false);
  const timer = useRef(null);
  const [mode, setMode] = useState(initialMode === 'video' && allowVideo ? 'video' : 'picture');
  const [facing, setFacing] = useState('back');
  const [flashIndex, setFlashIndex] = useState(0); // photo: off / on / auto
  const [torch, setTorch] = useState(false); // video: torch on / off
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  const isVideo = mode === 'video';
  const photoFlash = PHOTO_FLASH[flashIndex];
  const flashActive = isVideo ? torch : photoFlash !== 'off';
  const flashLabel = isVideo ? (torch ? 'Torch on' : 'Torch off') : FLASH_LABEL[photoFlash];
  // The front camera has no flash/torch on most devices.
  const flashAvailable = facing === 'back';

  useEffect(() => {
    canceled.current = false;
    const currentCamera = camera;
    return () => {
      canceled.current = true;
      clearInterval(timer.current);
      currentCamera.current?.stopRecording();
    };
  }, []);

  function cancel() {
    canceled.current = true;
    clearInterval(timer.current);
    camera.current?.stopRecording();
    onCancel();
  }

  function switchMode(next) {
    if (lock.current || mode === next) return;
    setReady(false); setError(''); setMode(next);
  }

  function cycleFlash() {
    if (isVideo) setTorch((value) => !value);
    else setFlashIndex((index) => (index + 1) % PHOTO_FLASH.length);
  }

  function flip() {
    if (lock.current || !ready) return;
    // No remount and no setReady(false): the live camera swaps lenses itself,
    // and onCameraReady does not fire again for a facing change.
    setFacing((value) => (value === 'back' ? 'front' : 'back'));
  }

  function stopRecording() {
    camera.current?.stopRecording();
  }

  async function capture() {
    if (lock.current || !ready || !camera.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (isVideo) {
        const permission = await Camera.requestMicrophonePermissionsAsync();
        if (canceled.current || signal?.aborted) return;
        if (!permission.granted) {
          setError('Microphone permission is needed to record video with sound. Enable it in Settings, or switch to Photo.');
          return;
        }
        setSeconds(0);
        timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
      }
      setRecording(isVideo);
      const result = isVideo
        ? await camera.current.recordAsync({ codec: 'avc1', maxFileSize: 25 * 1024 * 1024 - 128 * 1024 })
        : await camera.current.takePictureAsync({ quality: 0.7 });
      if (canceled.current || signal?.aborted) return;
      if (!result?.uri) throw new Error('No capture');
      const type = !isVideo ? 'image/jpeg'
        : result.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
      const file = { uri: result.uri, name: result.uri.split('/').pop(), type, size: new File(result.uri).size };
      validateEvidence(file);
      onCapture(file);
    } catch (failure) {
      if (!canceled.current && !signal?.aborted) setError(failure.message?.startsWith('Use JPEG')
        ? failure.message : 'Capture failed. Please try again.');
    } finally {
      clearInterval(timer.current);
      lock.current = false;
      if (!canceled.current && !signal?.aborted) { setBusy(false); setRecording(false); }
    }
  }

  return (
    <View style={tw`flex-1 bg-black`}>
      <CameraView
        key={mode}
        ref={camera}
        mode={mode}
        facing={facing}
        flash={isVideo || !flashAvailable ? 'off' : photoFlash}
        enableTorch={isVideo && torch && flashAvailable}
        videoQuality="480p"
        videoBitrate={2000000}
        style={tw`flex-1`}
        onCameraReady={() => setReady(true)}
        onMountError={() => { setReady(false); setError('Camera unavailable. Close and try again.'); }}
      />

      {/* Top bar */}
      <View
        pointerEvents="box-none"
        style={[tw`absolute left-0 right-0 flex-row items-center justify-between px-4`, { top: insets.top + 8 }]}
      >
        <RoundButton label="Cancel capture" onPress={cancel} disabled={recording && false}>
          <X size={20} color="#FFFFFF" />
        </RoundButton>

        {recording ? (
          <View style={tw`flex-row items-center rounded-full bg-red-600 px-3.5 py-1.5`}>
            <View style={tw`mr-2 h-2 w-2 rounded-full bg-white`} />
            <Text style={tw`text-xs font-extrabold text-white`}>{formatTime(seconds)}</Text>
          </View>
        ) : (
          <View style={tw`rounded-full bg-black/40 px-3 py-1.5`}>
            <Text style={tw`text-xs font-bold text-white`}>Capture report evidence</Text>
          </View>
        )}

        <View style={tw`flex-row`}>
          {flashAvailable && (
            <View style={tw`mr-2`}>
              <RoundButton label={flashLabel} active={flashActive} onPress={cycleFlash}>
                {flashActive ? (
                  <View style={tw`items-center justify-center`}>
                    <Zap size={20} color="#0F172A" fill="#0F172A" />
                    {!isVideo && photoFlash === 'auto' && (
                      <Text style={tw`absolute -bottom-2 text-[8px] font-extrabold text-slate-900`}>AUTO</Text>
                    )}
                  </View>
                ) : (
                  <ZapOff size={20} color="#FFFFFF" />
                )}
              </RoundButton>
            </View>
          )}
          <RoundButton label="Flip camera" onPress={flip} disabled={busy || recording}>
            <SwitchCamera size={20} color="#FFFFFF" />
          </RoundButton>
        </View>
      </View>

      {/* Bottom controls */}
      <View
        style={[
          tw`absolute bottom-0 left-0 right-0 items-center pt-4`,
          { paddingBottom: insets.bottom + 16, backgroundColor: 'rgba(0,0,0,0.45)' },
        ]}
      >
        {!!error && (
          <Text accessibilityRole="alert" style={tw`mb-3 px-6 text-center text-xs font-semibold text-amber-300`}>
            {error}
          </Text>
        )}

        {allowVideo && (
          <View style={tw`mb-5 flex-row rounded-full bg-white/15 p-1`}>
            {[
              { key: 'picture', label: 'Photo', Icon: CameraIcon },
              { key: 'video', label: 'Video', Icon: VideoIcon },
            ].map(({ key, label, Icon }) => {
              const active = mode === key;
              const disabled = busy || recording;
              return (
                <Pressable
                  key={key}
                  onPress={() => switchMode(key)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active, disabled }}
                  style={[
                    tw`min-h-11 flex-row items-center rounded-full px-5`,
                    active && tw`bg-white`,
                    disabled && !active && tw`opacity-50`,
                  ]}
                >
                  <Icon size={15} color={active ? '#0F172A' : '#FFFFFF'} />
                  <Text style={[tw`ml-1.5 text-xs font-extrabold`, { color: active ? '#0F172A' : '#FFFFFF' }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={recording ? stopRecording : capture}
          disabled={recording ? false : !ready || busy}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : isVideo ? 'Record Video' : 'Take Photo'}
          accessibilityState={{ disabled: recording ? false : !ready || busy }}
          style={({ pressed }) => [
            tw`h-20 w-20 items-center justify-center rounded-full`,
            { borderWidth: 4, borderColor: '#FFFFFF', opacity: pressed || (!ready && !recording) ? 0.6 : 1 },
          ]}
        >
          {recording ? (
            <View style={tw`h-8 w-8 rounded-lg bg-red-500`} />
          ) : (
            <View style={[tw`h-14 w-14 rounded-full`, { backgroundColor: isVideo ? '#EF4444' : '#FFFFFF' }]} />
          )}
        </Pressable>

        <Text style={tw`mt-3 text-[11px] font-medium text-white/70`}>
          {recording ? 'Tap to stop' : isVideo ? 'Tap to record' : 'Tap to take a photo'}
        </Text>
      </View>
    </View>
  );
}

function RoundButton({ label, onPress, disabled, active = false, children }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        tw`h-11 w-11 items-center justify-center rounded-full`,
        { backgroundColor: active ? '#FACC15' : 'rgba(15,23,42,0.55)', opacity: pressed || disabled ? 0.6 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}