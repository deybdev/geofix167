import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MapPin,
  Navigation,
  Phone,
  Wrench,
  X,
} from 'lucide-react-native';
import tw from 'twrnc';

import {
  getResponderDispatches,
  updateResponderDispatchStatus,
} from '../../services/responderDispatchService';

const ACTIVE_STATUSES = ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'];

function isReview(item) {
  return item.status === 'PENDING' || (item.is_maintenance && item.repair_done);
}

function formatTime(value) {
  if (!value) return 'Time unavailable';
  const raw = String(value);
  const date = new Date(Number(value) || (raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`));
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusText(item) {
  if (isReview(item)) return 'Awaiting review';
  return String(item.status || 'DISPATCHED').replaceAll('_', ' ');
}

function StatusPill({ item }) {
  const review = isReview(item);
  const incoming = item.status === 'DISPATCHED';
  const colors = review
    ? 'bg-violet-50 text-violet-800'
    : incoming
      ? 'bg-amber-50 text-amber-800'
      : item.status === 'ON_SCENE'
        ? 'bg-emerald-50 text-emerald-800'
        : 'bg-sky-50 text-sky-800';
  return (
    <View style={tw`rounded-full px-2.5 py-1.5 ${colors}`}>
      <Text style={tw`text-[10px] font-extrabold uppercase tracking-wide`}>{statusText(item)}</Text>
    </View>
  );
}

function TaskCard({ item, busy, onDetails, onAccept, onDecline, onStart, onArrive, onMap }) {
  const maintenance = Boolean(item.is_maintenance);
  const review = isReview(item);
  const incoming = item.status === 'DISPATCHED';

  return (
    <View style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
      <View style={tw`flex-row items-start justify-between gap-3`}>
        <View style={tw`flex-1 flex-row items-center gap-2.5`}>
          <View style={tw`h-10 w-10 items-center justify-center rounded-xl ${maintenance ? 'bg-emerald-50' : 'bg-red-50'}`}>
            {maintenance ? <Wrench size={18} color="#18794E" /> : <AlertTriangle size={18} color="#B42318" />}
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-[11px] font-extrabold uppercase tracking-wide ${maintenance ? 'text-emerald-800' : 'text-red-700'}`}>
              {maintenance ? 'Maintenance task' : 'Incident response'}
            </Text>
            <Text style={tw`mt-0.5 text-sm font-medium text-slate-600`} numberOfLines={1}>
              {item.incident_category || 'Community report'} · {item.urgency || 'Standard'}
            </Text>
          </View>
        </View>
        <StatusPill item={item} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${item.incident_title || 'task'}`}
        onPress={() => onDetails(item)}
        style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
      >
        <Text style={tw`mt-4 text-lg font-bold leading-6 text-slate-950`}>
          {item.incident_title || 'Assigned task'}
        </Text>
        <View style={tw`mt-2 flex-row items-start gap-2`}>
          <MapPin size={15} color="#64748B" style={tw`mt-0.5`} />
          <Text numberOfLines={2} style={tw`flex-1 text-sm leading-5 text-slate-600`}>
            {item.incident_location || 'Location pinned on the map'}
          </Text>
        </View>
        <View style={tw`mt-2 flex-row items-center gap-2`}>
          <Clock3 size={14} color="#64748B" />
          <Text style={tw`text-sm text-slate-500`}>{formatTime(item.dispatched_at)}</Text>
        </View>
      </Pressable>

      {review ? (
        <View style={tw`mt-4 flex-row items-center gap-2 rounded-xl bg-violet-50 p-3`}>
          <Clock3 size={16} color="#6D28D9" />
          <Text style={tw`flex-1 text-sm leading-5 text-violet-900`}>
            {item.status === 'PENDING'
              ? 'BDRRMO is reviewing this report.'
              : 'Repair proof is waiting for administrator verification.'}
          </Text>
        </View>
      ) : incoming ? (
        <View style={tw`mt-4 flex-row gap-2`}>
          <Pressable
            onPress={() => onAccept(item)}
            disabled={busy}
            style={({ pressed }) => [tw`min-h-12 flex-1 items-center justify-center rounded-xl bg-[#17633F] px-3`, { opacity: pressed || busy ? 0.65 : 1 }]}
          >
            <Text style={tw`text-sm font-bold text-white`}>{busy ? 'Saving…' : 'Accept task'}</Text>
          </Pressable>
          <Pressable
            onPress={() => onDecline(item)}
            disabled={busy}
            style={({ pressed }) => [tw`min-h-12 items-center justify-center rounded-xl border border-slate-300 px-4`, { opacity: pressed || busy ? 0.65 : 1 }]}
          >
            <Text style={tw`text-sm font-semibold text-slate-700`}>Decline</Text>
          </Pressable>
        </View>
      ) : item.status === 'ACCEPTED' && !maintenance ? (
        <Pressable
          onPress={() => onStart(item)}
          disabled={busy}
          style={({ pressed }) => [tw`mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#17633F] px-3`, { opacity: pressed || busy ? 0.65 : 1 }]}
        >
          <Navigation size={16} color="#fff" />
          <Text style={tw`text-sm font-bold text-white`}>{busy ? 'Updating…' : 'Start response'}</Text>
        </Pressable>
      ) : item.status === 'EN_ROUTE' && !maintenance ? (
        <Pressable
          onPress={() => onArrive(item)}
          disabled={busy}
          style={({ pressed }) => [tw`mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#17633F] px-3`, { opacity: pressed || busy ? 0.65 : 1 }]}
        >
          <CheckCircle2 size={16} color="#fff" />
          <Text style={tw`text-sm font-bold text-white`}>{busy ? 'Updating…' : 'Mark on scene'}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => onMap(item)}
          disabled={busy}
          style={({ pressed }) => [tw`mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#17633F] px-3`, { opacity: pressed || busy ? 0.65 : 1 }]}
        >
          <MapPin size={16} color="#fff" />
          <Text style={tw`text-sm font-bold text-white`}>
            {maintenance ? 'Open work site' : 'Open field map'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function DetailSheet({ item, onClose, onMap }) {
  if (!item) return null;
  const maintenance = Boolean(item.is_maintenance);
  const callReporter = async () => {
    const number = String(item.reporter_phone || '').replace(/[^\d+*#]/g, '');
    if (!number) return Alert.alert('No callback number', 'This report does not include a reporter phone number.');
    try {
      await Linking.openURL(`tel:${number}`);
    } catch {
      Alert.alert('Unable to call', 'Please try again from the report details.');
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 justify-end bg-black/45`}>
        <View style={tw`max-h-[86%] rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
          <View style={tw`flex-row items-start justify-between gap-3`}>
            <View style={tw`flex-1`}>
              <Text style={tw`text-xs font-extrabold uppercase tracking-wide text-[#17633F]`}>
                {maintenance ? 'Maintenance assignment' : 'Incident assignment'}
              </Text>
              <Text style={tw`mt-1 text-xl font-bold leading-7 text-slate-950`}>{item.incident_title || 'Assigned task'}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close task details" style={tw`h-10 w-10 items-center justify-center rounded-full bg-slate-100`}>
              <X size={18} color="#334155" />
            </Pressable>
          </View>

          <ScrollView style={tw`mt-5`} contentContainerStyle={tw`gap-4 pb-3`}>
            <View style={tw`rounded-2xl bg-slate-50 p-4`}>
              <View style={tw`flex-row items-start gap-2`}>
                <MapPin size={16} color="#17633F" style={tw`mt-0.5`} />
                <View style={tw`flex-1`}>
                  <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Location</Text>
                  <Text style={tw`mt-1 text-sm leading-5 text-slate-800`}>{item.incident_location || 'Pinned on the map'}</Text>
                </View>
              </View>
              <View style={tw`mt-4 flex-row items-start gap-2`}>
                <Clock3 size={16} color="#17633F" style={tw`mt-0.5`} />
                <View style={tw`flex-1`}>
                  <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Assigned</Text>
                  <Text style={tw`mt-1 text-sm text-slate-800`}>{formatTime(item.dispatched_at)}</Text>
                </View>
              </View>
              {maintenance && item.inspection_deadline ? (
                <View style={tw`mt-4 flex-row items-start gap-2`}>
                  <CalendarClock size={16} color="#17633F" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Inspection deadline</Text>
                    <Text style={tw`mt-1 text-sm text-slate-800`}>{formatTime(item.inspection_deadline)}</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View>
              <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Report details</Text>
              <Text style={tw`mt-2 text-sm leading-6 text-slate-700`}>
                {item.incident_description || 'No additional report details were provided.'}
              </Text>
            </View>

            {item.admin_notes ? (
              <View style={tw`rounded-2xl border border-amber-200 bg-amber-50 p-4`}>
                <Text style={tw`text-xs font-bold uppercase tracking-wide text-amber-900`}>Dispatcher notes</Text>
                <Text style={tw`mt-2 text-sm leading-5 text-amber-950`}>{item.admin_notes}</Text>
              </View>
            ) : null}

            <View style={tw`rounded-2xl border border-slate-200 p-4`}>
              <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Reporter</Text>
              <Text style={tw`mt-2 text-sm font-semibold text-slate-900`}>{item.reporter_name || 'Resident'}</Text>
              <Text style={tw`mt-1 text-sm text-slate-600`}>{item.reporter_phone || 'No callback number provided'}</Text>
              {item.reporter_phone ? (
                <Pressable onPress={() => void callReporter()} style={({ pressed }) => [tw`mt-3 min-h-11 flex-row items-center justify-center gap-2 rounded-xl bg-slate-100 px-3`, { opacity: pressed ? 0.7 : 1 }]}>
                  <Phone size={15} color="#17633F" />
                  <Text style={tw`text-sm font-bold text-[#17633F]`}>Call reporter</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>

          <Pressable
            onPress={() => { onClose(); onMap(item); }}
            disabled={isReview(item)}
            style={({ pressed }) => [tw`mt-3 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#17633F] px-4`, { opacity: pressed || isReview(item) ? 0.55 : 1 }]}
          >
            <Navigation size={16} color="#fff" />
            <Text style={tw`text-sm font-bold text-white`}>{isReview(item) ? 'Waiting for review' : 'Open field map'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function TanodTasks() {
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setItems(await getResponderDispatches());
    } catch (loadError) {
      setError(loadError.message || 'Unable to load tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === 'INCOMING') return item.status === 'DISPATCHED';
    if (filter === 'ACTIVE') return ACTIVE_STATUSES.includes(item.status);
    if (filter === 'REVIEW') return isReview(item);
    return !['COMPLETED', 'DECLINED'].includes(item.status) || isReview(item);
  }), [filter, items]);

  const counts = useMemo(() => ({
    incoming: items.filter((item) => item.status === 'DISPATCHED').length,
    active: items.filter((item) => ACTIVE_STATUSES.includes(item.status)).length,
    review: items.filter(isReview).length,
  }), [items]);

  const update = async (item, status, shouldOpenMap = false) => {
    setBusyId(item.id);
    setError('');
    try {
      await updateResponderDispatchStatus(item.id, status);
      const updated = { ...item, status };
      setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
      if (shouldOpenMap) navigation.navigate('MapNavigation', { assignment: updated });
    } catch (updateError) {
      setError(updateError.message || 'Unable to update this task.');
    } finally {
      setBusyId(null);
    }
  };

  const decline = (item) => Alert.alert(
    'Decline this task?',
    'BDRRMO will be notified that you are unavailable for this assignment.',
    [
      { text: 'Keep task', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => void update(item, 'DECLINED') },
    ],
  );

  const openMap = (item) => navigation.navigate('MapNavigation', { assignment: item });
  const tabs = [
    ['ACTIVE', `Active ${counts.active}`],
    ['INCOMING', `Incoming ${counts.incoming}`],
    ['REVIEW', `Review ${counts.review}`],
    ['ALL', 'All'],
  ];

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      <ScrollView
        contentContainerStyle={tw`px-4 pb-8 pt-6`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={['#17633F']} tintColor="#17633F" />}
      >
        <Text style={tw`text-[28px] font-extrabold leading-9 text-slate-950`}>Tasks</Text>
        <Text style={tw`mt-2 text-base leading-6 text-slate-600`}>Assigned reports, field activity, and items waiting for review.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-5`} contentContainerStyle={tw`gap-2`}>
          {tabs.map(([key, label]) => {
            const selectedTab = filter === key;
            return (
              <Pressable key={key} onPress={() => setFilter(key)} style={({ pressed }) => [tw`min-h-10 rounded-full px-4 py-2 ${selectedTab ? 'bg-[#17633F]' : 'border border-slate-200 bg-white'}`, { opacity: pressed ? 0.7 : 1 }]}>
                <Text style={tw`text-sm font-bold ${selectedTab ? 'text-white' : 'text-slate-700'}`}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={tw`mt-5 flex-row items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4`}>
            <Text style={tw`flex-1 text-sm leading-5 text-red-700`}>{error}</Text>
            <Pressable onPress={() => load(true)} style={tw`rounded-lg bg-red-700 px-3 py-2`}>
              <Text style={tw`text-xs font-bold text-white`}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={tw`mt-12 items-center`}>
            <ActivityIndicator color="#17633F" />
            <Text style={tw`mt-3 text-sm text-slate-500`}>Loading tasks...</Text>
          </View>
        ) : visibleItems.length ? (
          <View style={tw`mt-5 gap-4`}>
            {visibleItems.map((item) => (
              <TaskCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onDetails={setSelected}
                onAccept={(entry) => void update(entry, 'ACCEPTED')}
                onDecline={decline}
                onStart={(entry) => void update(entry, 'EN_ROUTE', true)}
                onArrive={(entry) => void update(entry, 'ON_SCENE', true)}
                onMap={openMap}
              />
            ))}
          </View>
        ) : (
          <View style={tw`mt-8 items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10`}>
            <View style={tw`h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50`}>
              <ClipboardList size={26} color="#17633F" />
            </View>
            <Text style={tw`mt-4 text-base font-bold text-slate-900`}>No tasks in this view</Text>
            <Text style={tw`mt-2 text-center text-sm leading-5 text-slate-500`}>
              Pull down to refresh when BDRRMO assigns a new report.
            </Text>
          </View>
        )}
      </ScrollView>

      <DetailSheet item={selected} onClose={() => setSelected(null)} onMap={openMap} />
    </View>
  );
}
