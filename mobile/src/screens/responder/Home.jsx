import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  MapPin,
  MessageSquare,
  Navigation,
  Truck,
  User,
  Wrench,
  X,
} from 'lucide-react-native';
import {
  setAudioModeAsync,
  useAudioPlaylist,
  useAudioPlaylistStatus,
} from 'expo-audio';
import tw from 'twrnc';

import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  getResponderDispatches,
  updateResponderDispatchStatus,
} from '../../services/responderDispatchService';

const GREEN = '#1F7A4D';

function formatDeadline(value) {
  if (!value) return 'No deadline set';
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(value) {
  if (!value) return 'Just now';
  const str = String(value);
  const date = new Date(str.includes('T') ? str : `${str.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

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
  const [statusFilter, setStatusFilter] = useState('ASSIGNED');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [incomingNotice, setIncomingNotice] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);

  const apiBase = String(api.defaults.baseURL || '').replace(/\/$/, '');

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});

    return () => {
      alarmActiveRef.current = false;
      Vibration.cancel();
    };
  }, [alarmPlayer]);

  const loadDispatches = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError('');

      try {
        const dispatches = await getResponderDispatches(undefined, user?.role);
        const allItems = Array.isArray(dispatches) ? [...dispatches] : [];

        // Emergencies ALWAYS sort above Maintenance tasks, then by newest/oldest timestamp
        allItems.sort((a, b) => {
          const aMaint = a.is_maintenance ? 1 : 0;
          const bMaint = b.is_maintenance ? 1 : 0;
          if (aMaint !== bMaint) return aMaint - bMaint;
          const aTime = new Date(a.dispatched_at || a.assigned_at || a.created_at || 0).getTime();
          const bTime = new Date(b.dispatched_at || b.assigned_at || b.created_at || 0).getTime();
          return bTime - aTime;
        });

        setItems(allItems);

        // ONLY buzz/alarm for EMERGENCY dispatches (never for Maintenance tasks!)
        const newEmergencyIncoming = allItems.find(
          (item) =>
            item.status === 'DISPATCHED' &&
            !item.is_maintenance &&
            !seenIncomingIdsRef.current.has(item.id),
        );
        if (newEmergencyIncoming) {
          seenIncomingIdsRef.current.add(newEmergencyIncoming.id);
          setIncomingNotice(newEmergencyIncoming);
          Vibration.vibrate([0, 500, 200, 500], true);
          alarmActiveRef.current = true;
          if (alarmStatus.isLoaded) {
            void alarmPlayer
              .seekTo(0)
              .then(() => {
                if (alarmActiveRef.current) alarmPlayer.play();
              })
              .catch(() => {});
          } else {
            alarmPlayer.play();
          }
        }
      } catch (err) {
        setError(err.message || 'Unable to load assignments.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, alarmPlayer, alarmStatus.isLoaded],
  );

  useFocusEffect(
    useCallback(() => {
      loadDispatches(false);
    }, [loadDispatches]),
  );

  const counts = useMemo(() => {
    const assigned = items.filter((i) => i.status === 'DISPATCHED').length;
    const inProgress = items.filter((i) =>
      ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS', 'PENDING'].includes(i.status),
    ).length;
    const completed = items.filter((i) => i.status === 'COMPLETED').length;
    return { ASSIGNED: assigned, IN_PROGRESS: inProgress, COMPLETED: completed };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'ASSIGNED') return item.status === 'DISPATCHED';
      if (statusFilter === 'IN_PROGRESS') {
        return ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS', 'PENDING'].includes(item.status);
      }
      if (statusFilter === 'COMPLETED') return item.status === 'COMPLETED';
      return true;
    });
  }, [items, statusFilter]);

  const activeItems = useMemo(
    () =>
      items.filter((i) =>
        ['DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS', 'PENDING'].includes(i.status),
      ),
    [items],
  );
  const currentIncident = activeItems[0] || null;

  function getStatusLabel(status) {
    const labels = {
      DISPATCHED: 'Assigned to you',
      ACCEPTED: 'In Progress',
      EN_ROUTE: 'En Route',
      ON_SCENE: 'On Scene',
      IN_PROGRESS: 'In Progress',
      PENDING: 'Pending Verification',
      COMPLETED: 'Completed',
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
      // Ignore audio player cleanup errors
    }
  }

  async function viewIncomingReport() {
    if (!incomingNotice) return;
    const incident = incomingNotice;
    setIncomingNotice(null);
    void stopAlarm();
    let acceptedIncident = { ...incident, status: 'ACCEPTED' };
    try {
      await updateResponderDispatchStatus(incident.id, 'ACCEPTED');
      setItems((prev) =>
        prev.map((entry) => (entry.id === incident.id ? acceptedIncident : entry)),
      );
    } catch {
      acceptedIncident = incident;
    }
    navigation.navigate('Map', {
      assignment: acceptedIncident,
      locationPermissionHandled: false,
      locationSharingOff: true,
    });
  }

  async function handleAccept(item) {
    setAcceptingId(item.id);
    setError('');
    try {
      await updateResponderDispatchStatus(item.id, 'ACCEPTED');
      const acceptedItem = { ...item, status: 'ACCEPTED' };
      setItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? acceptedItem : entry)),
      );

      if (item.is_maintenance) {
        setStatusFilter('IN_PROGRESS');
      } else {
        navigation.navigate('Map', { assignment: acceptedItem });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingId(null);
    }
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
          <Text style={tw`text-3xl font-extrabold text-slate-900`}>Dashboard</Text>
          <Text style={tw`mt-1 text-sm text-slate-500`}>
            {String(user?.role || 'Responder').toUpperCase()} tasks & dispatches
          </Text>
        </View>

        <View style={tw`mt-5 flex-row gap-3`}>
          <View style={tw`flex-1 rounded-2xl bg-white p-4`}>
            <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
              <AlertTriangle size={18} color={GREEN} />
            </View>
            <Text style={tw`mt-3 text-2xl font-extrabold text-slate-900`}>
              {loading ? '-' : activeItems.length}
            </Text>
            <Text style={tw`mt-1 text-xs font-medium text-slate-500`}>Active assignments</Text>
          </View>

          <View style={tw`flex-1 rounded-2xl bg-white p-4`}>
            <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
              <CheckCircle2 size={18} color={GREEN} />
            </View>
            <Text numberOfLines={1} style={tw`mt-3 text-base font-extrabold text-slate-900`}>
              {currentIncident ? getStatusLabel(currentIncident.status) : 'Available'}
            </Text>
            <Text style={tw`mt-1 text-xs font-medium text-slate-500`}>Current status</Text>
          </View>
        </View>

        {error ? (
          <View style={tw`mt-4 rounded-xl bg-red-50 p-3`}>
            <Text style={tw`text-xs font-semibold text-red-700`}>{error}</Text>
            <TouchableOpacity onPress={() => loadDispatches(true)} style={tw`mt-2`}>
              <Text style={tw`text-xs font-bold text-red-700`}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* FILTER TABS: Assigned | In Progress | Completed */}
        <View style={tw`mt-5 flex-row gap-2`}>
          {[
            { key: 'ASSIGNED', label: 'Assigned' },
            { key: 'IN_PROGRESS', label: 'In Progress' },
            { key: 'COMPLETED', label: 'Completed' },
          ].map((tab) => {
            const active = statusFilter === tab.key;
            const count = counts[tab.key] || 0;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setStatusFilter(tab.key)}
                style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2 ${
                  active ? 'bg-[#1F7A4D]' : 'bg-slate-200'
                }`}
              >
                <Text style={tw`text-xs font-bold ${active ? 'text-white' : 'text-slate-700'}`}>
                  {tab.label}
                </Text>
                <View
                  style={tw`rounded-full px-1.5 py-0.5 ${
                    active ? 'bg-white/20' : 'bg-slate-300'
                  }`}
                >
                  <Text style={tw`text-[10px] font-extrabold ${active ? 'text-white' : 'text-slate-700'}`}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={tw`mt-8 items-center`}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={tw`mt-2 text-xs text-slate-500`}>Loading assignments...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={tw`mt-5 items-center rounded-2xl border border-slate-200 bg-white px-6 py-8`}>
            <View style={tw`h-12 w-12 items-center justify-center rounded-xl bg-green-50`}>
              <ClipboardList size={24} color={GREEN} />
            </View>
            <Text style={tw`mt-3 text-base font-bold text-slate-900`}>
              {statusFilter === 'ASSIGNED'
                ? 'No new assigned tasks'
                : statusFilter === 'IN_PROGRESS'
                  ? 'No tasks in progress'
                  : 'No completed tasks yet'}
            </Text>
            <Text style={tw`mt-1 text-center text-xs leading-5 text-slate-500`}>
              {statusFilter === 'ASSIGNED'
                ? 'Incoming emergency and maintenance dispatches will appear here.'
                : statusFilter === 'IN_PROGRESS'
                  ? 'Accepted emergencies (pinned on top) and maintenance tasks appear here.'
                  : 'Resolved emergencies and verified maintenance tasks appear here.'}
            </Text>
          </View>
        ) : (
          <View style={tw`mt-4 gap-3.5`}>
            {filteredItems.map((item) => {
              const isMaintenance = Boolean(item.is_maintenance);
              const isFresh = item.status === 'DISPATCHED';
              const displayStatus =
                isMaintenance && item.inspection_done && item.status !== 'COMPLETED'
                  ? 'IN PROGRESS'
                  : item.status === 'DISPATCHED'
                    ? 'ASSIGNED'
                    : item.status;

              return (
                <View
                  key={item.id}
                  style={tw`rounded-2xl border ${
                    !isMaintenance ? 'border-red-200 bg-white' : 'border-slate-200 bg-white'
                  } p-4 shadow-sm`}
                >
                  <View style={tw`flex-row items-center justify-between`}>
                    <View
                      style={tw`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${
                        isMaintenance ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      {isMaintenance ? (
                        <Wrench size={14} color={GREEN} />
                      ) : (
                        <AlertTriangle size={14} color="#DC2626" />
                      )}
                      <Text
                        style={tw`text-[11px] font-extrabold uppercase tracking-wide ${
                          isMaintenance ? 'text-[#1F7A4D]' : 'text-red-700'
                        }`}
                      >
                        {isMaintenance
                          ? `Maintenance • ${item.urgency || 'Standard'}`
                          : `Emergency • ${item.incident_category || 'Urgent'}`}
                      </Text>
                    </View>
                    <View
                      style={tw`rounded-full px-2.5 py-0.5 ${
                        item.status === 'PENDING'
                          ? 'bg-amber-100'
                          : isMaintenance
                            ? 'bg-green-50'
                            : 'bg-red-50'
                      }`}
                    >
                      <Text
                        style={tw`text-[10px] font-extrabold uppercase ${
                          item.status === 'PENDING'
                            ? 'text-amber-800'
                            : isMaintenance
                              ? 'text-[#1F7A4D]'
                              : 'text-red-700'
                        }`}
                      >
                        {displayStatus}
                      </Text>
                    </View>
                  </View>

                  <Text style={tw`mt-2.5 text-base font-extrabold text-slate-900`}>
                    {item.incident_title}
                  </Text>

                  <View style={tw`mt-2.5 gap-1.5 rounded-xl bg-slate-50 p-3`}>
                    <View style={tw`flex-row items-center gap-1.5`}>
                      <MapPin size={13} color="#475569" />
                      <Text style={tw`flex-1 text-xs font-semibold text-slate-700`} numberOfLines={1}>
                        {item.incident_location || 'Pinned on map'}
                      </Text>
                    </View>

                    {isMaintenance ? (
                      <View style={tw`flex-row items-center gap-1.5`}>
                        <Calendar size={13} color="#475569" />
                        <Text style={tw`text-xs font-semibold text-slate-700`}>
                          Inspection Deadline: {formatDeadline(item.inspection_deadline)}
                        </Text>
                      </View>
                    ) : (
                      <View style={tw`flex-row items-center gap-1.5`}>
                        <Clock size={13} color="#475569" />
                        <Text style={tw`text-xs font-semibold text-slate-700`}>
                          Dispatched: {formatTimestamp(item.dispatched_at)}
                        </Text>
                      </View>
                    )}

                    {item.reporter_name ? (
                      <View style={tw`flex-row items-center gap-1.5`}>
                        <User size={13} color="#475569" />
                        <Text style={tw`text-xs font-semibold text-slate-700`}>
                          {item.reporter_name}
                          {item.reporter_phone ? ` • ${item.reporter_phone}` : ''}
                        </Text>
                      </View>
                    ) : null}

                    {item.vehicle_name ? (
                      <View style={tw`flex-row items-center gap-1.5`}>
                        <Truck size={13} color="#475569" />
                        <Text style={tw`text-xs font-semibold text-slate-700`}>
                          {item.vehicle_name}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {isFresh ? (
                    <TouchableOpacity
                      onPress={() => handleAccept(item)}
                      disabled={acceptingId === item.id}
                      style={tw`mt-3 items-center rounded-xl ${
                        isMaintenance ? 'bg-[#1F7A4D]' : 'bg-red-600'
                      } py-3`}
                    >
                      <Text style={tw`text-xs font-extrabold text-white`}>
                        {acceptingId === item.id
                          ? 'Accepting...'
                          : isMaintenance
                            ? 'Accept Maintenance Task'
                            : 'Accept Emergency & Open Map'}
                      </Text>
                    </TouchableOpacity>
                  ) : item.status === 'PENDING' ? (
                    <View style={tw`mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-amber-50 py-2.5`}>
                      <Clock size={14} color="#B45309" />
                      <Text style={tw`text-xs font-extrabold text-amber-800`}>
                        Pending Admin Resolution Verification
                      </Text>
                    </View>
                  ) : item.status === 'COMPLETED' ? (
                    <View style={tw`mt-3 flex-row items-center justify-center gap-1.5 rounded-xl bg-green-50 py-2.5`}>
                      <CheckCircle2 size={14} color={GREEN} />
                      <Text style={tw`text-xs font-extrabold text-[#1F7A4D]`}>
                        Completed
                      </Text>
                    </View>
                  ) : isMaintenance ? (
                    <View style={tw`mt-3 flex-row gap-2`}>
                      <Pressable
                        onPress={() => setReviewItem(item)}
                        style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-[#1F7A4D] bg-green-50 py-2.5`}
                      >
                        <Eye size={14} color={GREEN} />
                        <Text style={tw`text-xs font-extrabold text-[#1F7A4D]`}>Review</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => navigation.navigate('Map', { assignment: item })}
                        style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`}
                      >
                        <Navigation size={14} color="#FFFFFF" />
                        <Text style={tw`text-xs font-extrabold text-white`}>
                          {item.inspection_done ? 'Submit Repair' : 'Inspect / Map'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => navigation.navigate('Map', { assignment: item })}
                      style={tw`mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-red-600 py-3`}
                    >
                      <Navigation size={15} color="#FFFFFF" />
                      <Text style={tw`text-xs font-extrabold text-white`}>
                        Open Emergency Navigation
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* QUICK ACCESS */}
        <View style={tw`mt-7`}>
          <Text style={tw`mb-3 text-base font-bold text-slate-900`}>Quick Access</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Map')}
            style={tw`flex-row items-center rounded-xl border border-slate-200 bg-white p-3`}
            activeOpacity={0.8}
          >
            <MapPin size={19} color={GREEN} />
            <Text style={tw`ml-2 text-xs font-bold text-slate-700`}>Open Live Map</Text>
            <View style={tw`flex-1`} />
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MAINTENANCE REVIEW MODAL */}
      <Modal
        visible={Boolean(reviewItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewItem(null)}
      >
        <View style={tw`flex-1 justify-end bg-black/45`}>
          <View style={tw`max-h-[85%] rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
            <View style={tw`flex-row items-start justify-between`}>
              <View style={tw`flex-1 pr-3`}>
                <Text style={tw`text-xs font-extrabold uppercase text-[#1F7A4D]`}>
                  Maintenance Review • {reviewItem?.incident_category}
                </Text>
                <Text style={tw`mt-1 text-lg font-extrabold text-slate-900`}>
                  {reviewItem?.incident_title}
                </Text>
              </View>
              <Pressable
                onPress={() => setReviewItem(null)}
                style={tw`h-8 w-8 items-center justify-center rounded-full bg-slate-100`}
              >
                <X size={16} color="#334155" />
              </Pressable>
            </View>

            <ScrollView style={tw`mt-3`} contentContainerStyle={tw`gap-3 pb-4`}>
              <View style={tw`flex-row gap-2`}>
                <View style={tw`flex-1 rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Urgency Level
                  </Text>
                  <Text style={tw`mt-1 text-xs font-extrabold text-slate-900`}>
                    {reviewItem?.urgency || 'Standard'}
                  </Text>
                </View>
                <View style={tw`flex-1 rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Inspection Deadline
                  </Text>
                  <Text style={tw`mt-1 text-xs font-extrabold text-[#1F7A4D]`}>
                    {formatDeadline(reviewItem?.inspection_deadline)}
                  </Text>
                </View>
              </View>

              <View style={tw`gap-2 rounded-xl bg-slate-50 p-3`}>
                <View style={tw`flex-row items-start gap-2`}>
                  <User size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Reported By
                    </Text>
                    <Text style={tw`text-xs font-semibold text-slate-800`}>
                      {reviewItem?.reporter_name || 'Reporter'}
                      {reviewItem?.reporter_phone ? ` • ${reviewItem.reporter_phone}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={tw`flex-row items-start gap-2`}>
                  <MapPin size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Location
                    </Text>
                    <Text style={tw`text-xs font-semibold text-slate-800`}>
                      {reviewItem?.incident_location || 'Pinned on map'}
                    </Text>
                  </View>
                </View>

                <View style={tw`flex-row items-start gap-2 border-t border-slate-200 pt-2`}>
                  <FileText size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Report Description
                    </Text>
                    <Text style={tw`mt-0.5 text-xs leading-4 text-slate-700`}>
                      {reviewItem?.incident_description || 'No additional description provided.'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={tw`rounded-xl border border-green-200 bg-green-50 p-3`}>
                <View style={tw`flex-row items-center gap-1.5`}>
                  <MessageSquare size={14} color={GREEN} />
                  <Text style={tw`text-[11px] font-extrabold uppercase text-[#1F7A4D]`}>
                    Admin Notes (Synced)
                  </Text>
                </View>
                <Text style={tw`mt-1 text-xs leading-4 text-slate-800`}>
                  {reviewItem?.admin_notes ||
                    'Inspect the reported maintenance site and document arrival photos.'}
                </Text>
              </View>

              <View style={tw`rounded-xl bg-slate-50 p-3`}>
                <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                  Reporter Maintenance Photo(s)
                </Text>
                {reviewItem?.reporter_photo_ids?.length > 0 ? (
                  <ScrollView horizontal style={tw`mt-2`} contentContainerStyle={tw`gap-2`}>
                    {reviewItem.reporter_photo_ids.map((photoId) => (
                      <Image
                        key={photoId}
                        source={{
                          uri: `${apiBase}/reports/${encodeURIComponent(reviewItem.incident_id)}/photos/${encodeURIComponent(photoId)}`,
                        }}
                        style={tw`h-36 w-48 rounded-xl bg-slate-200`}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={tw`mt-1.5 text-xs text-slate-500`}>
                    No initial photo attached by the reporter.
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={tw`mt-2 flex-row gap-2.5`}>
              <Pressable
                onPress={() => setReviewItem(null)}
                style={tw`flex-1 items-center rounded-xl bg-slate-100 py-3`}
              >
                <Text style={tw`text-xs font-bold text-slate-700`}>Close</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const target = reviewItem;
                  setReviewItem(null);
                  navigation.navigate('Map', { assignment: target });
                }}
                style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-3`}
              >
                <Navigation size={15} color="#FFFFFF" />
                <Text style={tw`text-xs font-extrabold text-white`}>View in Maps</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* INCOMING EMERGENCY ALERT MODAL (ONLY FOR EMERGENCIES / BDRRMO DISPATCH) */}
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
              Incoming Emergency Dispatch
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
              accessibilityLabel="View emergency on the map"
              style={tw`mt-6 items-center rounded-xl bg-red-600 py-3.5`}
            >
              <Text style={tw`text-sm font-extrabold text-white`}>
                Accept & Open Emergency Map
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
