import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import {
  getResponderDispatches,
  updateResponderDispatchStatus,
} from '../../services/responderDispatchService';

const ACTIVE_STATUSES = ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'];

function isAwaitingReview(assignment) {
  return assignment.status === 'PENDING'
    || (assignment.is_maintenance && assignment.repair_done);
}

function formatAssignedTime(value) {
  if (!value) return 'Recently assigned';
  const raw = String(value);
  const date = new Date(Number(value) || (raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`));
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusLabel(status) {
  return String(status || 'DISPATCHED').replaceAll('_', ' ');
}

function MetricCard({ label, value, icon: Icon, color }) {
  return (
    <View style={tw`min-h-20 flex-1 rounded-2xl border border-slate-200 bg-white p-3`}>
      <View style={tw`flex-row items-center justify-between`}>
        <Text numberOfLines={2} style={tw`flex-1 pr-1 text-xs font-semibold leading-4 text-slate-600`}>{label}</Text>
        <View style={tw`h-7 w-7 items-center justify-center rounded-lg bg-slate-50`}>
          <Icon size={15} color={color} />
        </View>
      </View>
      <Text style={tw`mt-1.5 text-2xl font-extrabold text-slate-900`}>{value}</Text>
    </View>
  );
}

function AssignmentCard({ assignment, busy, actionsDisabled, onAccept, onDecline, onStart, onArrive, onOpenMap }) {
  const isMaintenance = Boolean(assignment.is_maintenance);
  const isIncoming = assignment.status === 'DISPATCHED';
  const awaitingReview = isAwaitingReview(assignment);

  return (
    <View style={tw`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`}>
      <View style={tw`flex-row items-start justify-between gap-3`}>
        <View style={tw`flex-1 flex-row items-center gap-2`}>
          <View style={tw`h-9 w-9 items-center justify-center rounded-xl ${isMaintenance ? 'bg-green-50' : 'bg-red-50'}`}>
            {isMaintenance
              ? <Wrench size={17} color="#1F7A4D" />
              : <AlertTriangle size={17} color="#B42318" />}
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-[11px] font-extrabold uppercase tracking-wide ${isMaintenance ? 'text-[#1F7A4D]' : 'text-red-700'}`}>
              {isMaintenance ? 'Maintenance task' : 'Incident response'}
            </Text>
            <Text style={tw`mt-0.5 text-sm font-medium text-slate-600`} numberOfLines={1}>
              {assignment.incident_category || 'Community report'} · {assignment.urgency || 'Standard'}
            </Text>
          </View>
        </View>
        <View style={tw`rounded-full px-2.5 py-1 ${awaitingReview ? 'bg-amber-50' : isIncoming ? 'bg-blue-50' : 'bg-green-50'}`}>
          <Text style={tw`text-[11px] font-extrabold uppercase tracking-wide ${awaitingReview ? 'text-amber-800' : isIncoming ? 'text-blue-800' : 'text-green-800'}`}>
            {awaitingReview ? 'Awaiting review' : statusLabel(assignment.status)}
          </Text>
        </View>
      </View>

      <Text style={tw`mt-4 text-lg font-bold leading-6 text-slate-950`}>
        {assignment.incident_title || 'Assigned report'}
      </Text>
      {assignment.incident_description ? (
        <Text style={tw`mt-1.5 text-sm leading-5 text-slate-600`} numberOfLines={4}>
          {assignment.incident_description}
        </Text>
      ) : null}

      <View style={tw`mt-4 gap-3 rounded-2xl bg-slate-50 p-3.5`}>
        <View style={tw`flex-row items-start gap-2`}>
          <MapPin size={14} color="#475569" style={tw`mt-0.5`} />
          <Text style={tw`flex-1 text-sm font-medium leading-5 text-slate-700`}>
            {assignment.incident_location || 'Location pinned on map'}
          </Text>
        </View>
        <View style={tw`flex-row items-center gap-2`}>
          <Clock3 size={14} color="#64748B" />
          <Text style={tw`text-sm text-slate-600`}>{formatAssignedTime(assignment.dispatched_at)}</Text>
        </View>
        {assignment.reporter_name || assignment.reporter_phone ? (
          <View style={tw`flex-row items-center justify-between gap-2`}>
            <Text style={tw`flex-1 text-sm text-slate-600`} numberOfLines={1}>
              Reported by <Text style={tw`font-semibold text-slate-800`}>{assignment.reporter_name || 'Resident'}</Text>
            </Text>
            {assignment.reporter_phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Call ${assignment.reporter_name}`}
                onPress={async () => {
                  try {
                    const phoneNumber = String(assignment.reporter_phone).replace(/[^\d+*#]/g, '');
                    await Linking.openURL(`tel:${phoneNumber}`);
                  } catch {
                    Alert.alert('Unable to call', 'Please call the reporter using the number shown in the report.');
                  }
                }}
                style={({ pressed }) => [tw`min-h-10 flex-row items-center gap-1.5 rounded-lg bg-white px-3 py-2`, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Phone size={12} color="#1F7A4D" />
                <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>Call</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {isMaintenance && assignment.inspection_deadline ? (
          <Text style={tw`text-sm font-semibold text-emerald-800`}>
            Inspection due: {formatAssignedTime(assignment.inspection_deadline)}
          </Text>
        ) : null}
      </View>

      {assignment.admin_notes ? (
        <View style={tw`mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-3 py-2`}>
          <Text style={tw`text-xs font-extrabold uppercase tracking-wide text-amber-900`}>Dispatcher notes</Text>
          <Text style={tw`mt-1.5 text-sm leading-5 text-amber-950`}>{assignment.admin_notes}</Text>
        </View>
      ) : null}

      {awaitingReview ? (
        <View style={tw`mt-3 flex-row items-center gap-2 rounded-xl bg-amber-50 p-3`}>
          <Clock3 size={15} color="#B45309" />
          <Text style={tw`flex-1 text-sm font-medium leading-5 text-amber-900`}>
            {assignment.status === 'PENDING'
              ? 'This report is under BDRRMO review. Wait for an update before responding.'
              : 'Your repair proof was submitted. Wait for administrator verification.'}
          </Text>
        </View>
      ) : null}
      {assignment.status === 'ON_SCENE' && !isMaintenance ? (
        <Text style={tw`mt-3 text-sm leading-5 text-slate-600`}>
          You are on scene. Coordinate with the resident and BDRRMO; BDRRMO records final incident closure.
        </Text>
      ) : null}

      {!awaitingReview ? (
        <View style={tw`mt-3 flex-row gap-2`}>
          {isIncoming ? (
            <>
              <Pressable
                onPress={() => onAccept(assignment)}
                disabled={actionsDisabled}
                accessibilityRole="button"
                accessibilityLabel={`Accept ${assignment.incident_title || 'assignment'}`}
                style={({ pressed }) => [tw`flex-1 items-center rounded-xl bg-[#1F7A4D] py-3`, { opacity: pressed || actionsDisabled ? 0.7 : 1 }]}
              >
                <Text style={tw`text-sm font-bold text-white`}>{busy ? 'Saving…' : 'Accept task'}</Text>
              </Pressable>
              <Pressable
                onPress={() => onDecline(assignment)}
                disabled={actionsDisabled}
                accessibilityRole="button"
                accessibilityLabel={`Decline ${assignment.incident_title || 'assignment'}`}
                style={({ pressed }) => [tw`items-center rounded-xl border border-slate-300 bg-white px-4 py-3`, { opacity: pressed || actionsDisabled ? 0.7 : 1 }]}
              >
                <Text style={tw`text-sm font-semibold text-slate-700`}>Decline</Text>
              </Pressable>
            </>
          ) : assignment.status === 'ACCEPTED' && !isMaintenance ? (
            <Pressable
              onPress={() => onStart(assignment)}
              disabled={actionsDisabled}
              accessibilityRole="button"
              accessibilityLabel={`Start response for ${assignment.incident_title || 'assignment'}`}
              style={({ pressed }) => [tw`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3`, { opacity: pressed || actionsDisabled ? 0.7 : 1 }]}
            >
              <Navigation size={15} color="#fff" />
              <Text style={tw`text-sm font-bold text-white`}>{busy ? 'Updating…' : 'Start response'}</Text>
            </Pressable>
          ) : assignment.status === 'EN_ROUTE' && !isMaintenance ? (
            <Pressable
              onPress={() => onArrive(assignment)}
              disabled={actionsDisabled}
              accessibilityRole="button"
              accessibilityLabel={`Mark arrived at ${assignment.incident_title || 'incident'}`}
              style={({ pressed }) => [tw`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3`, { opacity: pressed || actionsDisabled ? 0.7 : 1 }]}
            >
              <CheckCircle2 size={15} color="#fff" />
              <Text style={tw`text-sm font-bold text-white`}>{busy ? 'Updating…' : 'Mark arrived on scene'}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onOpenMap(assignment)}
              disabled={actionsDisabled}
              accessibilityRole="button"
              accessibilityLabel={`Open map for ${assignment.incident_title || 'assignment'}`}
              style={({ pressed }) => [tw`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3`, { opacity: pressed || actionsDisabled ? 0.7 : 1 }]}
            >
              <MapPin size={15} color="#fff" />
              <Text style={tw`text-sm font-bold text-white`}>
                {isMaintenance ? 'Open task map' : assignment.status === 'ON_SCENE' ? 'Open incident map' : 'Continue on map'}
              </Text>
              <ArrowRight size={15} color="#fff" />
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function TanodDashboard() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAllIncoming, setShowAllIncoming] = useState(false);
  const hasLoaded = useRef(false);

  const loadDispatches = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    else if (!hasLoaded.current) setLoading(true);
    setError('');
    try {
      setDispatches(await getResponderDispatches());
    } catch (loadError) {
      setError(loadError.message || 'Unable to load Tanod assignments.');
    } finally {
      hasLoaded.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadDispatches();
  }, [loadDispatches]));

  const incoming = useMemo(
    () => dispatches.filter((item) => item.status === 'DISPATCHED'),
    [dispatches],
  );
  const active = useMemo(
    () => dispatches.filter((item) => ACTIVE_STATUSES.includes(item.status)),
    [dispatches],
  );
  const awaiting = useMemo(
    () => dispatches.filter(isAwaitingReview),
    [dispatches],
  );

  const updateStatus = async (assignment, status, openMap = false) => {
    setBusyId(assignment.id);
    setError('');
    setNotice('');
    try {
      await updateResponderDispatchStatus(assignment.id, status);
      setDispatches((current) => current.map((item) => (
        item.id === assignment.id ? { ...item, status } : item
      )));
      setNotice(status === 'DECLINED'
        ? 'Assignment declined.'
        : `Assignment updated to ${statusLabel(status).toLowerCase()}.`);
      await loadDispatches(true);
      if (openMap) navigation.navigate('MapNavigation', { assignment: { ...assignment, status } });
    } catch (actionError) {
      setError(actionError.message || 'Unable to update this assignment.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = (assignment) => {
    if (busyId) return;
    Alert.alert(
      'Decline this task?',
      'BDRRMO will be notified that you cannot take this assignment.',
      [
        { text: 'Keep assignment', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => void updateStatus(assignment, 'DECLINED') },
      ],
    );
  };

  const openMap = (assignment) => navigation.navigate('MapNavigation', { assignment });

  const greeting = new Date().getHours() < 12
    ? 'Good morning'
    : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={tw`flex-1`}
      contentContainerStyle={tw`px-4 pb-10 pt-5`}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDispatches(true)}
          colors={['#1F7A4D']}
          tintColor="#1F7A4D"
        />
      )}
    >
      <View style={tw`rounded-3xl bg-[#0B2E22] p-6`}>
        <View style={tw`flex-row items-center justify-between gap-3`}>
          <View style={tw`flex-1 flex-row items-center gap-2`}>
            <ShieldCheck size={17} color="#A7F3D0" />
            <Text numberOfLines={1} style={tw`text-[11px] font-bold uppercase tracking-[1px] text-green-200`}>Barangay 167 · Field operations</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh Tanod assignments"
            onPress={() => loadDispatches(true)}
            disabled={refreshing || Boolean(busyId)}
            style={({ pressed }) => [tw`h-9 w-9 items-center justify-center rounded-xl bg-white/10`, { opacity: pressed || refreshing || busyId ? 0.65 : 1 }]}
          >
            {refreshing
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <RefreshCw size={16} color="#FFFFFF" />}
          </Pressable>
        </View>
        <Text style={tw`mt-4 text-[28px] font-extrabold leading-9 text-white`}>Tanod Dashboard</Text>
        <Text style={tw`mt-2 text-base leading-6 text-green-100`}>
          {greeting}, {user?.full_name || 'Tanod'}. Here is your duty overview.
        </Text>
      </View>

      {error ? (
        <View style={tw`mt-3 flex-row items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3`}>
          <Text style={tw`flex-1 text-sm font-medium leading-5 text-red-700`}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => loadDispatches(true)}
            disabled={refreshing}
            style={({ pressed }) => [tw`rounded-lg bg-red-700 px-3 py-2`, { opacity: pressed || refreshing ? 0.7 : 1 }]}
          >
            <Text style={tw`text-xs font-bold text-white`}>{refreshing ? 'Retrying…' : 'Retry'}</Text>
          </Pressable>
        </View>
      ) : null}
      {notice ? (
        <View style={tw`mt-3 rounded-xl border border-green-200 bg-green-50 p-3`}>
          <Text style={tw`text-sm font-medium text-green-800`}>{notice}</Text>
        </View>
      ) : null}

      <View style={tw`mt-5 flex-row gap-2.5`}>
        <MetricCard label="New dispatches" value={incoming.length} icon={AlertTriangle} color="#B45309" />
        <MetricCard label="Active duty" value={active.length} icon={Navigation} color="#1F7A4D" />
        <MetricCard label="For review" value={awaiting.length} icon={Clock3} color="#7C3AED" />
      </View>

      {loading ? (
        <View style={tw`mt-8 items-center`}>
          <ActivityIndicator size="small" color="#1F7A4D" />
          <Text style={tw`mt-2 text-sm text-slate-500`}>Loading your duty board...</Text>
        </View>
      ) : (
        <>
          <View style={tw`mt-8 flex-row items-center justify-between`}>
            <View>
              <Text style={tw`text-xl font-extrabold text-slate-950`}>Active duty</Text>
              <Text style={tw`mt-1 text-sm text-slate-500`}>Continue an accepted incident or maintenance task.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open all active tasks"
              onPress={() => navigation.navigate('Assignments')}
              style={({ pressed }) => [tw`rounded-lg px-2 py-2`, { opacity: pressed ? 0.65 : 1 }]}
            >
              <Text style={tw`text-sm font-bold text-[#1F7A4D]`}>Task list</Text>
            </Pressable>
          </View>
          {active.length ? (
            <View style={tw`mt-4 gap-4`}>
              {active.slice(0, 3).map((item) => (
                <AssignmentCard
                  key={item.id}
                  assignment={item}
                  busy={busyId === item.id}
                  actionsDisabled={Boolean(busyId)}
                  onAccept={(assignment) => void updateStatus(assignment, 'ACCEPTED')}
                  onDecline={handleDecline}
                  onStart={(assignment) => void updateStatus(assignment, 'EN_ROUTE', true)}
                  onArrive={(assignment) => void updateStatus(assignment, 'ON_SCENE', true)}
                  onOpenMap={openMap}
                />
              ))}
            </View>
          ) : (
            <View style={tw`mt-3 flex-row items-center rounded-2xl border border-slate-200 bg-white p-4`}>
              <MapPin size={20} color="#64748B" />
              <View style={tw`ml-3 flex-1`}>
                <Text style={tw`text-base font-bold text-slate-900`}>No active field task</Text>
                <Text style={tw`mt-1 text-sm leading-5 text-slate-500`}>Accept a new dispatch below to begin a response.</Text>
              </View>
            </View>
          )}

          <View style={tw`mt-8 flex-row items-center justify-between`}>
            <View>
              <Text style={tw`text-xl font-extrabold text-slate-950`}>Incoming dispatches</Text>
              <Text style={tw`mt-1 text-sm text-slate-500`}>Review the location and details before accepting.</Text>
            </View>
            {incoming.length > 5 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showAllIncoming ? 'Show fewer incoming dispatches' : `Show all ${incoming.length} incoming dispatches`}
                onPress={() => setShowAllIncoming((value) => !value)}
                style={({ pressed }) => [tw`rounded-full bg-amber-50 px-2.5 py-1.5`, { opacity: pressed ? 0.65 : 1 }]}
              >
                <Text style={tw`text-xs font-extrabold text-amber-800`}>
                  {showAllIncoming ? 'Show fewer' : `View all ${incoming.length}`}
                </Text>
              </Pressable>
            ) : (
              <View style={tw`rounded-full bg-amber-50 px-2.5 py-1`}>
                <Text style={tw`text-xs font-extrabold text-amber-800`}>{incoming.length} NEW</Text>
              </View>
            )}
          </View>
          {incoming.length ? (
            <View style={tw`mt-4 gap-4`}>
              {(showAllIncoming ? incoming : incoming.slice(0, 5)).map((item) => (
                <AssignmentCard
                  key={item.id}
                  assignment={item}
                  busy={busyId === item.id}
                  actionsDisabled={Boolean(busyId)}
                  onAccept={(assignment) => void updateStatus(assignment, 'ACCEPTED')}
                  onDecline={handleDecline}
                  onStart={(assignment) => void updateStatus(assignment, 'EN_ROUTE', true)}
                  onArrive={(assignment) => void updateStatus(assignment, 'ON_SCENE', true)}
                  onOpenMap={openMap}
                />
              ))}
            </View>
          ) : (
            <View style={tw`mt-3 items-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-7`}>
              <CheckCircle2 size={25} color="#1F7A4D" />
              <Text style={tw`mt-3 text-base font-bold text-slate-900`}>No new dispatches</Text>
              <Text style={tw`mt-1.5 text-center text-sm leading-5 text-slate-500`}>
                Pull down to refresh. New incidents and maintenance assignments will appear here.
              </Text>
            </View>
          )}

          {awaiting.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open tasks awaiting review"
              onPress={() => navigation.navigate('Assignments')}
              style={({ pressed }) => [tw`mt-5 flex-row items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4`, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Clock3 size={18} color="#6D28D9" />
              <View style={tw`flex-1`}>
                <Text style={tw`text-sm font-extrabold text-violet-900`}>{awaiting.length} task{awaiting.length === 1 ? '' : 's'} awaiting review</Text>
                <Text style={tw`mt-1 text-sm text-violet-800`}>Open assignments to check their current status.</Text>
              </View>
              <ArrowRight size={16} color="#6D28D9" />
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
