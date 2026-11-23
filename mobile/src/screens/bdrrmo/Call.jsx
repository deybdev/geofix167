import { useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Shield,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import tw from 'twrnc';

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'R';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function CallScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const isVideoParam = route.params?.mode === 'video';
  const recipientName = route.params?.recipientName || 'Resident Reporter';
  const subtitle = route.params?.subtitle || 'Emergency Incident Report';

  const [isVideo, setIsVideo] = useState(isVideoParam);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(isVideoParam);
  const [frontCamera, setFrontCamera] = useState(true);
  const [callPhase, setCallPhase] = useState('Connecting...');

  useEffect(() => {
    const ringTimer = setTimeout(() => {
      setCallPhase('Ringing...');
    }, 1800);

    return () => clearTimeout(ringTimer);
  }, []);

  const handleEndCall = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Messages');
  };

  return (
    <View style={tw`flex-1 justify-between ${isVideo ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Top Bar */}
      <View style={tw`z-20 flex-row items-center justify-between px-4 pt-3`}>
        <Pressable
          onPress={handleEndCall}
          accessibilityRole="button"
          accessibilityLabel="Back to chat"
          hitSlop={8}
          style={({ pressed }) => [
            tw`h-10 w-10 items-center justify-center rounded-full ${
              isVideo ? 'bg-white/15' : 'bg-white border border-slate-200'
            }`,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ChevronLeft size={22} color={isVideo ? '#FFFFFF' : '#0F172A'} />
        </Pressable>

        <View
          style={tw`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
            isVideo ? 'bg-white/15' : 'border border-green-200 bg-green-50'
          }`}
        >
          <Shield size={12} color={isVideo ? '#4ADE80' : '#1F7A4D'} />
          <Text
            style={tw`px-0.5 text-[11px] font-bold ${
              isVideo ? 'text-white' : 'text-[#1F7A4D]'
            }`}
          >
            {isVideo ? 'Messenger Video' : 'Messenger Audio'}
          </Text>
        </View>

        {isVideo ? (
          <Pressable
            onPress={() => setFrontCamera((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
            hitSlop={8}
            style={({ pressed }) => [
              tw`h-10 w-10 items-center justify-center rounded-full bg-white/15`,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <RefreshCw size={18} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={tw`h-10 w-10`} />
        )}
      </View>

      {/* Self-view PiP preview when video is on */}
      {isVideo ? (
        <View
          style={tw`absolute right-4 top-16 z-20 h-38 w-26 items-center justify-between overflow-hidden rounded-2xl border border-white/25 bg-slate-800 p-2.5 shadow-lg`}
        >
          <View style={tw`self-end rounded-full bg-green-500/20 px-2 py-0.5`}>
            <Text style={tw`text-[9px] font-bold text-green-300`}>
              {frontCamera ? 'Front' : 'Rear'}
            </Text>
          </View>
          <View style={tw`h-11 w-11 items-center justify-center rounded-full bg-white/10`}>
            <Video size={18} color="#E2E8F0" />
          </View>
          <Text style={tw`w-full text-center text-[10px] font-semibold text-slate-300`}>
            You
          </Text>
        </View>
      ) : null}

      {/* Center Caller Info & Avatar */}
      <View style={tw`items-center px-6`}>
        <View style={tw`items-center justify-center`}>
          <View
            style={tw`absolute h-36 w-36 rounded-full ${
              isVideo ? 'bg-green-400/15' : 'bg-green-200/50'
            }`}
          />
          <View
            style={tw`h-28 w-28 items-center justify-center rounded-full border-4 ${
              isVideo
                ? 'border-white/20 bg-slate-800'
                : 'border-white bg-green-100 shadow-sm'
            }`}
          >
            <Text
              style={tw`text-3xl font-bold ${
                isVideo ? 'text-green-300' : 'text-[#1F7A4D]'
              }`}
            >
              {getInitials(recipientName)}
            </Text>
          </View>
        </View>

        <Text
          numberOfLines={1}
          style={tw`mt-5 w-full text-center text-2xl font-bold ${
            isVideo ? 'text-white' : 'text-slate-900'
          }`}
        >
          {recipientName}
        </Text>

        <Text
          style={tw`mt-1.5 w-full text-center text-sm font-semibold ${
            isVideo ? 'text-green-300' : 'text-[#1F7A4D]'
          }`}
        >
          {callPhase}
        </Text>

        <Text
          numberOfLines={2}
          style={tw`mt-2 w-full text-center text-xs leading-4 ${
            isVideo ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {subtitle}
        </Text>
      </View>

      {/* Bottom Messenger Call Control Dock */}
      <View style={tw`px-5 pb-6`}>
        <View
          style={tw`flex-row items-center justify-around rounded-3xl px-4 py-4 ${
            isVideo
              ? 'bg-slate-800/90 border border-white/10'
              : 'bg-white border border-slate-200 shadow-lg'
          }`}
        >
          {/* Toggle Video */}
          <Pressable
            onPress={() => setIsVideo((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isVideo ? 'Turn off camera' : 'Turn on camera'}
            style={({ pressed }) => [
              tw`items-center`,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View
              style={tw`h-13 w-13 items-center justify-center rounded-full ${
                isVideo
                  ? 'bg-white'
                  : 'bg-slate-100'
              }`}
            >
              {isVideo ? (
                <Video size={22} color="#0F172A" />
              ) : (
                <VideoOff size={22} color="#475569" />
              )}
            </View>
            <Text
              style={tw`mt-1.5 px-1 text-[11px] font-semibold ${
                isVideo ? 'text-slate-200' : 'text-slate-600'
              }`}
            >
              {isVideo ? 'Video On' : 'Video Off'}
            </Text>
          </Pressable>

          {/* Toggle Mute */}
          <Pressable
            onPress={() => setIsMuted((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            style={({ pressed }) => [
              tw`items-center`,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View
              style={tw`h-13 w-13 items-center justify-center rounded-full ${
                isMuted
                  ? isVideo
                    ? 'bg-white'
                    : 'bg-slate-900'
                  : isVideo
                    ? 'bg-white/15'
                    : 'bg-slate-100'
              }`}
            >
              {isMuted ? (
                <MicOff size={22} color={isVideo ? '#0F172A' : '#FFFFFF'} />
              ) : (
                <Mic size={22} color={isVideo ? '#FFFFFF' : '#475569'} />
              )}
            </View>
            <Text
              style={tw`mt-1.5 px-1 text-[11px] font-semibold ${
                isVideo ? 'text-slate-200' : 'text-slate-600'
              }`}
            >
              {isMuted ? 'Muted' : 'Mute'}
            </Text>
          </Pressable>

          {/* Toggle Speaker */}
          <Pressable
            onPress={() => setIsSpeaker((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={isSpeaker ? 'Turn off speaker' : 'Turn on speaker'}
            style={({ pressed }) => [
              tw`items-center`,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View
              style={tw`h-13 w-13 items-center justify-center rounded-full ${
                isSpeaker
                  ? isVideo
                    ? 'bg-white'
                    : 'bg-green-100'
                  : isVideo
                    ? 'bg-white/15'
                    : 'bg-slate-100'
              }`}
            >
              {isSpeaker ? (
                <Volume2 size={22} color={isVideo ? '#0F172A' : '#1F7A4D'} />
              ) : (
                <VolumeX size={22} color={isVideo ? '#FFFFFF' : '#475569'} />
              )}
            </View>
            <Text
              style={tw`mt-1.5 px-1 text-[11px] font-semibold ${
                isVideo ? 'text-slate-200' : 'text-slate-600'
              }`}
            >
              Speaker
            </Text>
          </Pressable>

          {/* End Call */}
          <Pressable
            onPress={handleEndCall}
            accessibilityRole="button"
            accessibilityLabel="End call"
            style={({ pressed }) => [
              tw`items-center`,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={tw`h-13 w-13 items-center justify-center rounded-full bg-red-600`}>
              <PhoneOff size={22} color="#FFFFFF" />
            </View>
            <Text
              style={tw`mt-1.5 px-1 text-[11px] font-semibold ${
                isVideo ? 'text-red-300' : 'text-red-600'
              }`}
            >
              End
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
