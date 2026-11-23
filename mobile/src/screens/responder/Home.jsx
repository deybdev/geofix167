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
  Clock,
  Eye,
  FileText,
  MapPin,
  MessageSquare,
  Navigation,
  Power,
  Radio,
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
import { formatTimestamp, formatTitleCase, getStatusStyle } from '../../utils/dispatchStatus';

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

export default function ResponderHome() {
  const { user, onDuty, toggleDuty, dutyBusy } = useAuth();
  const isPolice = ['police', 'fire'].includes(String(user?.role || '').toLowerCase());
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
  const [acceptingId, setAcceptingId] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [zoomPhotoUri, setZoomPhotoUri] = useState(null);

  const apiBase = String(api.defaults.baseURL || '').replace(/\/$/, '');

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

  const loadDispatches = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError('');

      try {
        const dispatches = await getResponderDispatches(undefined, user?.role);
        const allItems = Array.isArray(dispatches) ? [...dispatches] : [];

        allItems.sort((a, b) => {
          const aMaint = a.is_maintenance ? 1 : 0;
          const bMaint = b.is_maintenance ? 1 : 0;
          if (aMaint !== bMaint) return aMaint - bMaint;
          const aTime = new Date(a.dispatched_at || a.assigned_at || a.created_at || 0).getTime();
          const bTime = new Date(b.dispatched_at || b.assigned_at || b.created_at || 0).getTime();
          return bTime - aTime;
        });

        setItems(allItems);

        const hasOngoing = allItems.some((item) =>
          ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS', 'PENDING'].includes(item.status),
        );

        const newEmergencyIncoming =
          onDuty && !hasOngoing
            ? allItems.find(
              (item) =>
                item.status === 'DISPATCHED' &&
                !item.is_maintenance &&
                !seenIncomingIdsRef.current.has(item.id),
            )
            : null;
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
              .catch(() => { });
          } else {
            alarmPlayer.play();
          }
        }
      } catch (err) {
        setError(err.message || 'Unable to load assigned reports.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, onDuty, alarmPlayer, alarmStatus.isLoaded],
  );

  useFocusEffect(
    useCallback(() => {
      loadDispatches(false);
      const timer = setInterval(() => {
        loadDispatches(false);
      }, 6000);
      return () => clearInterval(timer);
    }, [loadDispatches]),
  );

  useEffect(() => {
    if (!onDuty) {
      alarmActiveRef.current = false;
      Vibration.cancel();
      try {
        if (alarmStatus.playing) alarmPlayer.pause();
      } catch {
        // Ignore audio pause errors
      }
    }
  }, [onDuty, alarmPlayer, alarmStatus.playing]);

  const ongoingItems = useMemo(
    () =>
      items.filter((i) =>
        ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS', 'PENDING'].includes(i.status),
      ),
    [items],
  );

  const hasOngoingTask = ongoingItems.length > 0;

  // Show ongoing task(s) first; if none is ongoing, show newly assigned (DISPATCHED) task(s)
  const visibleItems = useMemo(() => {
    const active = items.filter((i) =>
      ['DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS', 'PENDING'].includes(
        i.status,
      ),
    );
    return active.sort((a, b) => {
      const aOngoing = a.status !== 'DISPATCHED' ? 0 : 1;
      const bOngoing = b.status !== 'DISPATCHED' ? 0 : 1;
      return aOngoing - bOngoing;
    });
  }, [items]);

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
    navigation.navigate('Navigation', {
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

      if (!item.is_maintenance) {
        navigation.navigate('Navigation', { assignment: acceptedItem });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingId(null);
    }
  }

  if (onDuty === null) return <Text style={tw`p-4`}>Duty status unconfirmed.</Text>;
  if (!onDuty) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-slate-50 px-8`}>
        <View style={tw`h-16 w-16 items-center justify-center rounded-full bg-slate-200`}>
          <Power size={28} color="#64748B" />
        </View>
        <Text style={tw`mt-4 w-full text-center text-lg font-bold text-slate-900`}>
          You are Off Duty
        </Text>
        <Text style={tw`mt-1.5 w-full text-center text-xs leading-5 text-slate-500`}>
          Switch to On Duty to receive and accept new emergency reports assigned to your unit.
        </Text>
        <Pressable
          disabled={dutyBusy}
          onPress={() => void toggleDuty(true)}
          style={({ pressed }) => [
            tw`mt-6 flex-row items-center gap-2 rounded-full bg-[#1F7A4D] px-6 py-3.5 shadow-sm`,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Power size={16} color="#FFFFFF" />
          <Text style={tw`px-1 text-xs font-bold text-white`}>Go On Duty</Text>
        </Pressable>
      </View>
    );
  }


  return (
    <>
      <View style={tw`flex-1 bg-slate-50`}>
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={tw`flex-grow px-4 pb-6 pt-3`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadDispatches(true)}
              colors={[GREEN]}
              tintColor={GREEN}
            />
          }
        >
          {error ? (
            <View style={tw`mb-3 rounded-xl bg-red-50 p-3`}>
              <Text style={tw`text-xs font-semibold text-red-700`}>{error}</Text>
              <TouchableOpacity onPress={() => loadDispatches(true)} style={tw`mt-1.5`}>
                <Text style={tw`text-xs font-bold text-red-700`}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {loading ? (
            <View style={tw`flex-1 items-center justify-center py-16`}>
              <ActivityIndicator size="small" color={GREEN} />
              <Text style={tw`mt-2 text-xs text-slate-500`}>Checking assigned reports...</Text>
            </View>
          ) : visibleItems.length === 0 ? (
            <View style={tw`flex-1 items-center justify-center px-6 py-16`}>
              <View style={tw`h-16 w-16 items-center justify-center rounded-full bg-green-50`}>
                <Radio size={28} color={GREEN} />
              </View>
              <Text style={tw`mt-4 w-full text-center text-base font-bold text-slate-900`}>
                Waiting for new assignment
              </Text>
              <Text style={tw`mt-1.5 w-full text-center text-xs leading-5 text-slate-500`}>
                {isPolice
                  ? 'You are On Duty and available. When an emergency report is assigned to you, it will appear here automatically.'
                  : 'You are On Duty and available. New dispatches assigned to you will appear here automatically.'}
              </Text>
            </View>
          ) : (
            <View style={tw`gap-3.5`}>
              {visibleItems.map((item) => {
                const isMaintenance = Boolean(item.is_maintenance);
                const isFresh = item.status === 'DISPATCHED';
                const blockedByOngoing = isFresh && hasOngoingTask;
                const statusStyle = getStatusStyle(item);

                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      navigation.navigate('IncidentDetails', {
                        assignment: item,
                        blockedByOngoing,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`View full report details for ${item.incident_title}`}
                    style={({ pressed }) => [
                      tw`rounded-2xl border ${isFresh && !isMaintenance ? 'border-red-200' : 'border-slate-200'
                        } bg-white p-4 shadow-sm`,
                      { opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    {/* Header badges */}
                    <View style={tw`flex-row flex-wrap items-center justify-between gap-1.5`}>
                      <View
                        style={tw`flex-shrink flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${isMaintenance ? 'bg-green-50' : 'bg-red-50'
                          }`}
                      >
                        {isMaintenance ? (
                          <Wrench size={13} color={GREEN} />
                        ) : (
                          <AlertTriangle size={13} color="#DC2626" />
                        )}
                        <Text
                          numberOfLines={1}
                          style={tw`flex-shrink pr-0.5 text-[11px] font-bold ${isMaintenance ? 'text-[#1F7A4D]' : 'text-red-700'
                            }`}
                        >
                          {(isMaintenance
                            ? `Maintenance • ${item.urgency || 'Standard'}`
                            : `Emergency • ${item.incident_category || 'Urgent'}`
                          ).toUpperCase()}
                        </Text>
                      </View>

                      <View
                        style={tw`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${statusStyle.bg}`}
                      >
                        <View
                          style={[
                            tw`h-1.5 w-1.5 rounded-full`,
                            { backgroundColor: statusStyle.dot },
                          ]}
                        />
                        <Text numberOfLines={1} style={tw`pr-0.5 text-[10px] font-bold ${statusStyle.text}`}>
                          {statusStyle.label}
                        </Text>
                      </View>
                    </View>

                    {/* Title */}
                    <Text style={tw`mt-2.5 text-base font-extrabold text-slate-900`}>
                      {formatTitleCase(item.incident_title)}
                    </Text>

                    {/* Route / Location Details Box */}
                    <View style={tw`mt-2.5 gap-1.5 rounded-xl bg-slate-50 p-3`}>
                      <View style={tw`flex-row items-center gap-1.5`}>
                        <MapPin size={13} color="#1F7A4D" />
                        <Text style={tw`flex-1 text-xs font-bold text-slate-800`} numberOfLines={2}>
                          {item.incident_location || 'Pinned on map'}
                        </Text>
                      </View>

                      {isMaintenance ? (
                        <View style={tw`flex-row items-center gap-1.5`}>
                          <Calendar size={13} color="#64748B" />
                          <Text style={tw`text-xs font-medium text-slate-600`}>
                            Deadline: {formatDeadline(item.inspection_deadline)}
                          </Text>
                        </View>
                      ) : (
                        <View style={tw`flex-row items-center gap-1.5`}>
                          <Clock size={13} color="#64748B" />
                          <Text style={tw`text-xs font-medium text-slate-600`}>
                            Assigned {formatTimestamp(item.dispatched_at || item.created_at)}
                          </Text>
                        </View>
                      )}

                      {item.reporter_name ? (
                        <View style={tw`flex-row items-center gap-1.5`}>
                          <User size={13} color="#64748B" />
                          <Text style={tw`text-xs font-medium text-slate-600`}>
                            {item.reporter_name}
                            {item.reporter_phone ? ` • ${item.reporter_phone}` : ''}
                          </Text>
                        </View>
                      ) : null}

                      {item.vehicle_name ? (
                        <View style={tw`flex-row items-center gap-1.5`}>
                          <Truck size={13} color="#64748B" />
                          <Text style={tw`text-xs font-medium text-slate-600`}>
                            {item.vehicle_name}
                          </Text>
                        </View>
                      ) : null}

                      <View style={tw`mt-1 flex-row items-center justify-between border-t border-slate-200/80 pt-2`}>
                        <View style={tw`flex-row items-center gap-1.5`}>
                          <Eye size={13} color={GREEN} />
                          <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>
                            Tap to view full report & reporter photos
                          </Text>
                        </View>
                        {item.reporter_photo_ids?.length > 0 ? (
                          <View style={tw`rounded-full bg-green-100 px-2 py-0.5`}>
                            <Text style={tw`text-[10px] font-extrabold text-[#1F7A4D]`}>
                              {item.reporter_photo_ids.length}{' '}
                              {item.reporter_photo_ids.length === 1 ? 'photo' : 'photos'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Action Button */}
                    {isFresh ? (
                      <TouchableOpacity
                        onPress={() => handleAccept(item)}
                        disabled={acceptingId === item.id || blockedByOngoing}
                        activeOpacity={0.85}
                        style={tw`mt-3 items-center rounded-xl ${blockedByOngoing
                          ? 'bg-slate-200'
                          : isMaintenance
                            ? 'bg-[#1F7A4D]'
                            : 'bg-red-600'
                          } py-3.5`}
                      >
                        <Text
                          style={tw`text-xs font-extrabold ${blockedByOngoing ? 'text-slate-500' : 'text-white'
                            }`}
                        >
                          {acceptingId === item.id
                            ? 'Accepting...'
                            : blockedByOngoing
                              ? 'Finish ongoing task first'
                              : isMaintenance
                                ? 'Accept Maintenance Task'
                                : 'Accept Assignment & Navigate'}
                        </Text>
                      </TouchableOpacity>
                    ) : item.status === 'PENDING' ? (
                      <View style={tw`mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-amber-50 py-2.5`}>
                        <Clock size={14} color="#B45309" />
                        <Text style={tw`text-xs font-extrabold text-amber-800`}>
                          Pending Admin Verification
                        </Text>
                      </View>
                    ) : isMaintenance ? (
                      <View style={tw`mt-3 flex-row gap-2`}>
                        <Pressable
                          onPress={() =>
                            navigation.navigate('IncidentDetails', {
                              assignment: item,
                              blockedByOngoing,
                            })
                          }
                          style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-[#1F7A4D] bg-green-50 py-2.5`}
                        >
                          <Eye size={14} color={GREEN} />
                          <Text style={tw`text-xs font-extrabold text-[#1F7A4D]`}>Review</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => navigation.navigate('Navigation', { assignment: item })}
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
                        onPress={() => navigation.navigate('Navigation', { assignment: item })}
                        style={({ pressed }) => [
                          tw`mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3.5`,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Navigation size={15} color="#FFFFFF" />
                        <Text style={tw`text-xs font-extrabold text-white`}>
                          Continue Emergency Navigation
                        </Text>
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {/* REPORT DETAILS MODAL (EMERGENCIES & MAINTENANCE + REPORTER PHOTOS) */}
      <Modal
        visible={Boolean(reviewItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewItem(null)}
      >
        <View style={tw`flex-1 justify-end bg-black/45`}>
          <View style={tw`max-h-[88%] rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
            <View style={tw`flex-row items-start justify-between`}>
              <View style={tw`flex-1 pr-3`}>
                <View style={tw`flex-row flex-wrap items-center gap-2`}>
                  <View
                    style={tw`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${reviewItem?.is_maintenance ? 'bg-green-50' : 'bg-red-50'
                      }`}
                  >
                    {reviewItem?.is_maintenance ? (
                      <Wrench size={12} color={GREEN} />
                    ) : (
                      <AlertTriangle size={12} color="#DC2626" />
                    )}
                    <Text
                      style={tw`text-[10px] font-extrabold uppercase ${reviewItem?.is_maintenance ? 'text-[#1F7A4D]' : 'text-red-700'
                        }`}
                    >
                      {reviewItem?.is_maintenance
                        ? `Maintenance • ${reviewItem?.incident_category || 'Repair'}`
                        : `Emergency Report • ${reviewItem?.incident_category || 'Urgent'}`}
                    </Text>
                  </View>
                  {reviewItem ? (
                    <View
                      style={tw`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${getStatusStyle(reviewItem).bg
                        }`}
                    >
                      <View
                        style={[
                          tw`h-1.5 w-1.5 rounded-full`,
                          { backgroundColor: getStatusStyle(reviewItem).dot },
                        ]}
                      />
                      <Text
                        style={tw`text-[10px] font-extrabold ${getStatusStyle(reviewItem).text}`}
                      >
                        {getStatusStyle(reviewItem).label}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={tw`mt-2 text-lg font-extrabold text-slate-900`}>
                  {reviewItem?.incident_title || 'Incident Report Details'}
                </Text>
              </View>
              <Pressable
                onPress={() => setReviewItem(null)}
                style={tw`h-8 w-8 items-center justify-center rounded-full bg-slate-100`}
              >
                <X size={16} color="#334155" />
              </Pressable>
            </View>

            <ScrollView style={tw`mt-3.5`} contentContainerStyle={tw`gap-3 pb-4`}>
              {/* Captured Reporter Photos (featured at top so police see evidence immediately) */}
              <View style={tw`rounded-2xl border border-slate-200 bg-slate-50 p-3.5`}>
                <View style={tw`flex-row items-center justify-between`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-500`}>
                    Captured by Reporter
                  </Text>
                  {reviewItem?.reporter_photo_ids?.length > 0 ? (
                    <Text style={tw`text-[10px] font-semibold text-[#1F7A4D]`}>
                      Tap photo to enlarge ({reviewItem.reporter_photo_ids.length})
                    </Text>
                  ) : null}
                </View>
                {reviewItem?.reporter_photo_ids?.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={tw`mt-2.5`}
                    contentContainerStyle={tw`gap-2.5`}
                  >
                    {reviewItem.reporter_photo_ids.map((photoId) => {
                      const uri = `${apiBase}/reports/${encodeURIComponent(reviewItem.incident_id)}/photos/${encodeURIComponent(photoId)}`;
                      return (
                        <Pressable
                          key={photoId}
                          onPress={() => setZoomPhotoUri(uri)}
                          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                        >
                          <Image
                            source={{ uri }}
                            style={tw`h-44 w-60 rounded-xl bg-slate-200`}
                            resizeMode="cover"
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={tw`mt-1.5 text-xs text-slate-500`}>
                    No photo attached by the reporter for this incident.
                  </Text>
                )}
              </View>

              <View style={tw`flex-row gap-2`}>
                <View style={tw`flex-1 rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Urgency Level
                  </Text>
                  <Text
                    style={tw`mt-1 text-xs font-extrabold ${reviewItem?.is_maintenance ? 'text-slate-900' : 'text-red-600'
                      }`}
                  >
                    {reviewItem?.urgency || (reviewItem?.is_maintenance ? 'Standard' : 'High')}
                  </Text>
                </View>
                <View style={tw`flex-1 rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    {reviewItem?.is_maintenance ? 'Inspection Deadline' : 'Dispatched At'}
                  </Text>
                  <Text style={tw`mt-1 text-xs font-extrabold text-[#1F7A4D]`}>
                    {reviewItem?.is_maintenance
                      ? formatDeadline(reviewItem?.inspection_deadline)
                      : formatTimestamp(reviewItem?.dispatched_at || reviewItem?.created_at)}
                  </Text>
                </View>
              </View>

              <View style={tw`gap-2.5 rounded-xl bg-slate-50 p-3.5`}>
                <View style={tw`flex-row items-start gap-2`}>
                  <User size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Reported By
                    </Text>
                    <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                      {reviewItem?.reporter_name || 'Resident Reporter'}
                      {reviewItem?.reporter_phone ? ` • ${reviewItem.reporter_phone}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={tw`flex-row items-start gap-2`}>
                  <MapPin size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Incident Location
                    </Text>
                    <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                      {reviewItem?.incident_location || 'Pinned on map'}
                    </Text>
                    {reviewItem?.incident_latitude != null &&
                      reviewItem?.incident_longitude != null ? (
                      <Text style={tw`mt-0.5 text-[11px] text-slate-500`}>
                        Coordinates: {Number(reviewItem.incident_latitude).toFixed(5)},{' '}
                        {Number(reviewItem.incident_longitude).toFixed(5)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {reviewItem?.vehicle_name ? (
                  <View style={tw`flex-row items-start gap-2`}>
                    <Truck size={14} color="#475569" style={tw`mt-0.5`} />
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                        Assigned Unit / Vehicle
                      </Text>
                      <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                        {reviewItem.vehicle_name}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={tw`flex-row items-start gap-2 border-t border-slate-200 pt-2.5`}>
                  <FileText size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Report Description
                    </Text>
                    <Text style={tw`mt-0.5 text-xs leading-5 text-slate-700`}>
                      {reviewItem?.incident_description || 'No additional description provided.'}
                    </Text>
                  </View>
                </View>
              </View>

              {reviewItem?.tactical_note || reviewItem?.admin_notes || reviewItem?.is_maintenance ? (
                <View style={tw`rounded-xl border border-green-200 bg-green-50 p-3.5`}>
                  <View style={tw`flex-row items-center gap-1.5`}>
                    <MessageSquare size={14} color={GREEN} />
                    <Text style={tw`text-[11px] font-extrabold uppercase text-[#1F7A4D]`}>
                      {reviewItem?.is_maintenance ? 'Admin Notes' : 'BDRRMO Tactical Note'}
                    </Text>
                  </View>
                  <Text style={tw`mt-1 text-xs leading-4 text-slate-800`}>
                    {String(
                      reviewItem?.tactical_note ||
                      reviewItem?.admin_notes ||
                      'Inspect the reported maintenance site and document arrival photos.',
                    ).replace('[BDRRMO NOTE] ', '')}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={tw`mt-2 flex-row gap-2.5`}>
              <Pressable
                onPress={() => setReviewItem(null)}
                style={tw` items-center justify-center rounded-xl bg-slate-100 px-5 py-3.5`}
              >
                <Text style={tw`text-xs font-bold text-slate-700`}>Close</Text>
              </Pressable>

              {reviewItem?.status === 'DISPATCHED' ? (
                <Pressable
                  onPress={() => {
                    const target = reviewItem;
                    setReviewItem(null);
                    void handleAccept(target);
                  }}
                  disabled={hasOngoingTask}
                  style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${hasOngoingTask
                    ? 'bg-slate-200'
                    : reviewItem?.is_maintenance
                      ? 'bg-[#1F7A4D]'
                      : 'bg-red-600'
                    } py-3.5`}
                >
                  <Navigation size={15} color={hasOngoingTask ? '#64748B' : '#FFFFFF'} />
                  <Text
                    style={tw`text-xs font-extrabold ${hasOngoingTask ? 'text-slate-500' : 'text-white'
                      }`}
                  >
                    {hasOngoingTask ? 'Finish ongoing task first' : 'Accept & Navigate'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    const target = reviewItem;
                    setReviewItem(null);
                    navigation.navigate('Navigation', { assignment: target });
                  }}
                  style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-3.5`}
                >
                  <Navigation size={15} color="#FFFFFF" />
                  <Text style={tw`text-xs font-extrabold text-white`}>
                    Open Emergency Navigation
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* FULL-SCREEN PHOTO ZOOM MODAL */}
      <Modal
        visible={Boolean(zoomPhotoUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomPhotoUri(null)}
      >
        <View style={tw`flex-1 justify-center bg-black/90 px-4`}>
          <Pressable
            onPress={() => setZoomPhotoUri(null)}
            style={tw`absolute right-5 top-12 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/20`}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
          {zoomPhotoUri ? (
            <Image
              source={{ uri: zoomPhotoUri }}
              style={tw`h-[75%] w-full`}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      {/* INCOMING EMERGENCY ALERT MODAL */}
      <Modal
        visible={Boolean(incomingNotice)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={viewIncomingReport}
      >
        <View style={tw`flex-1 items-center justify-center bg-black/50 px-6`}>
          <View style={tw`w-full rounded-3xl bg-white p-6`}>
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`h-12 w-12 items-center justify-center rounded-full bg-red-100`}>
                <BellRing size={24} color="#DC2626" />
              </View>
              <View style={tw`rounded-full bg-red-50 px-3 py-1`}>
                <Text style={tw`text-[11px] font-extrabold uppercase text-red-700`}>
                  {incomingNotice?.incident_category || 'Emergency'} •{' '}
                  {incomingNotice?.urgency || 'Urgent'}
                </Text>
              </View>
            </View>

            <Text style={tw`mt-4 text-lg font-extrabold text-slate-900`}>
              Incoming Emergency Dispatch
            </Text>

            <Pressable
              onPress={() => {
                const incident = incomingNotice;
                setIncomingNotice(null);
                void stopAlarm();
                navigation.navigate('IncidentDetails', {
                  assignment: incident,
                  blockedByOngoing: hasOngoingTask,
                });
              }}
              style={tw`mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5`}
            >
              <Text style={tw`text-sm font-extrabold text-slate-900`}>
                {formatTitleCase(incomingNotice?.incident_title)}
              </Text>
              <Text style={tw`mt-1 text-xs font-medium text-slate-600`}>
                {incomingNotice?.incident_location || 'Pinned on map'}
              </Text>
              {incomingNotice?.incident_description ? (
                <Text numberOfLines={2} style={tw`mt-1.5 text-xs text-slate-500`}>
                  {incomingNotice.incident_description}
                </Text>
              ) : null}
              {incomingNotice?.reporter_photo_ids?.length > 0 ? (
                <Image
                  source={{
                    uri: `${apiBase}/reports/${encodeURIComponent(incomingNotice.incident_id)}/photos/${encodeURIComponent(incomingNotice.reporter_photo_ids[0])}`,
                  }}
                  style={tw`mt-2.5 h-32 w-full rounded-xl bg-slate-200`}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={tw`mt-2 text-[11px] font-bold text-[#1F7A4D]`}>
                Tap to inspect full report & reporter photos →
              </Text>
            </Pressable>

            <View style={tw`mt-4 flex-row gap-2.5`}>
              <TouchableOpacity
                onPress={() => {
                  const incident = incomingNotice;
                  setIncomingNotice(null);
                  void stopAlarm();
                  navigation.navigate('IncidentDetails', {
                    assignment: incident,
                    blockedByOngoing: hasOngoingTask,
                  });
                }}
                activeOpacity={0.85}
                style={tw`flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 py-3.5`}
              >
                <Text style={tw`text-xs font-extrabold text-slate-800`}>View Full Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={viewIncomingReport}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Accept and open emergency on the map"
                style={tw`flex-1 items-center justify-center rounded-xl bg-red-600 py-3.5`}
              >
                <Text style={tw`text-xs font-extrabold text-white`}>Accept & Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
