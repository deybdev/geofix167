import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Vibration,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  ChevronRight,
  BellRing,
} from 'lucide-react-native';
import {
  setAudioModeAsync,
  useAudioPlaylist,
  useAudioPlaylistStatus,
} from 'expo-audio';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';

const GREEN = '#1F7A4D';

// Include DISPATCHED because it is already assigned, even if the officer
// has not started travelling or updated the response progress yet.
const ACTIVE_STATUSES = [
  'DISPATCHED',
  'ACCEPTED',
  'EN_ROUTE',
  'ON_SCENE',
  'IN_PROGRESS',
];

export default function ResponderHome() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const alarmPlayer = useAudioPlaylist({
    sources: [require('../../../assets/incident-audio.mp3')],
    loop: 'all',
  });
  const alarmStatus = useAudioPlaylistStatus(alarmPlayer);
  const alarmActiveRef = useRef(false);
  const seenIncomingIdsRef = useRef(new Set());

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [incomingNotice, setIncomingNotice] = useState(null);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => { });

    return () => {
      alarmActiveRef.current = false;
      Vibration.cancel();
    };
  }, [alarmPlayer]);

  const loadDispatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    setError('');

    try {
      const dispatches = await getResponderDispatches(undefined, user?.role);

      const activeDispatches = (Array.isArray(dispatches) ? dispatches : [])
        .filter((item) => ACTIVE_STATUSES.includes(item.status));

      // The backend should enforce one active assignment per responder.
      // This ordering is only a defensive UI fallback if old/duplicate
      // assignments exist: show the oldest active assignment first.
      activeDispatches.sort((a, b) => {
        const aTime = new Date(
          a.assigned_at || a.created_at || a.createdAt || 0
        ).getTime();
        const bTime = new Date(
          b.assigned_at || b.created_at || b.createdAt || 0
        ).getTime();

        return aTime - bTime;
      });

      setItems(activeDispatches);

      const newIncoming = activeDispatches.find(
        (item) => item.status === 'DISPATCHED' && !seenIncomingIdsRef.current.has(item.id),
      );
      if (newIncoming) {
        seenIncomingIdsRef.current.add(newIncoming.id);
        setIncomingNotice(newIncoming);
        Vibration.vibrate([0, 500, 200, 500], true);
        alarmActiveRef.current = true;
        if (alarmStatus.isLoaded) {
          void alarmPlayer.seekTo(0)
            .then(() => {
              if (alarmActiveRef.current) alarmPlayer.play();
            })
            .catch(() => { });
        } else {
          alarmPlayer.play();
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to load active assignments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadDispatches(false);
    }, [loadDispatches])
  );

  // Use the oldest active assignment for the dashboard status summary.
  const currentIncident = items[0] || null;

  function getStatusLabel(status) {
    const labels = {
      DISPATCHED: 'Assigned to you',
      ACCEPTED: 'Assigned to you',
      EN_ROUTE: 'En Route',
      ON_SCENE: 'On Scene',
      IN_PROGRESS: 'In Progress',
    };

    return labels[status] || status || 'Assigned';
  }

  async function stopAlarm() {
    alarmActiveRef.current = false;
    Vibration.cancel();
    try {
      if (alarmStatus.playing) alarmPlayer.pause();
      if (alarmStatus.isLoaded) await alarmPlayer.seekTo(0);
    } catch {
      // The audio player can be released while navigating; ignore stale cleanup calls.
    }
  }

  function viewIncomingReport() {
    if (!incomingNotice) return;
    const incident = incomingNotice;
    setIncomingNotice(null);
    void stopAlarm();
    navigation.navigate('Map', {
      assignment: incident,
      locationPermissionHandled: false,
      locationSharingOff: true,
    });
  }

  return (
    <>
      <ScrollView
        style={tw`flex-1 bg-slate-50 px-5 pt-6`}
        contentContainerStyle={tw`pb-10`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDispatches(true)}
            colors={[GREEN]}
            tintColor={GREEN}
          />
        }
      >
        <View>
          <Text style={tw`text-3xl font-extrabold text-slate-900`}>
            Dashboard
          </Text>
          <Text style={tw`mt-1 text-sm text-slate-500`}>
            {String(user?.role || 'Responder').toUpperCase()} overview
          </Text>
        </View>

        <View style={tw`mt-5 flex-row gap-3`}>
          <View style={tw`flex-1 rounded-2xl bg-white p-4`}>
            <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
              <AlertTriangle size={18} color={GREEN} />
            </View>
            <Text style={tw`mt-3 text-2xl font-extrabold text-slate-900`}>
              {loading ? '-' : items.length}
            </Text>
            <Text style={tw`mt-1 text-xs font-medium text-slate-500`}>
              Active assignments
            </Text>
          </View>

          <View style={tw`flex-1 rounded-2xl bg-white p-4`}>
            <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
              <CheckCircle2 size={18} color={GREEN} />
            </View>
            <Text
              numberOfLines={1}
              style={tw`mt-3 text-base font-extrabold text-slate-900`}
            >
              {currentIncident ? getStatusLabel(currentIncident.status) : 'Available'}
            </Text>
            <Text style={tw`mt-1 text-xs font-medium text-slate-500`}>
              Current status
            </Text>
          </View>
        </View>

        {/* ERROR */}
        {error ? (
          <View style={tw`mt-4 rounded-xl bg-red-50 p-3`}>
            <Text style={tw`text-xs font-semibold text-red-700`}>
              {error}
            </Text>

            <TouchableOpacity
              onPress={() => loadDispatches(true)}
              style={tw`mt-2`}
            >
              <Text style={tw`text-xs font-bold text-red-700`}>
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* QUICK ACCESS */}
        <View style={tw`mt-7`}>
          <Text style={tw`mb-3 text-base font-bold text-slate-900`}>
            Quick Access
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('Map')}
            style={tw`flex-row items-center rounded-xl border border-slate-200 bg-white p-3`}
            activeOpacity={0.8}
          >
            <MapPin size={19} color={GREEN} />
            <Text style={tw`ml-2 text-xs font-bold text-slate-700`}>
              Open Live Map
            </Text>
            <View style={tw`flex-1`} />
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal
        visible={Boolean(incomingNotice)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={viewIncomingReport}
      >
        <View style={tw`flex-1 items-center justify-center bg-black/50 px-6`}>
          <View style={tw`w-full rounded-3xl bg-white p-6`}>
            <View style={tw`h-12 w-12 items-center justify-center rounded-full bg-red-100`}>
              <BellRing size={24} color="#DC2626" />
            </View>
            <Text style={tw`mt-4 text-lg font-extrabold text-slate-900`}>
              Incoming Emergency Report
            </Text>
            <Text style={tw`mt-2 text-sm font-bold text-slate-800`}>
              {incomingNotice?.incident_title}
            </Text>
            <Text style={tw`mt-1 text-sm text-slate-500`}>
              {incomingNotice?.incident_location}
            </Text>
            <TouchableOpacity
              onPress={viewIncomingReport}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="View reports on the map"
              style={tw`mt-6 items-center rounded-xl bg-[#1F7A4D] py-3.5`}
            >
              <Text style={tw`text-sm font-extrabold text-white`}>
                View Reports
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
