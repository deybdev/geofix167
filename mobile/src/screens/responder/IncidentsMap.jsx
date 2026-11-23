import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';
import {
  ACTIVE_DISPATCH_STATUSES,
  NAVIGABLE_DISPATCH_STATUSES,
  formatTimestamp,
  formatTitleCase,
  getStatusStyle,
} from '../../utils/dispatchStatus';

const GREEN = '#1F7A4D';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'COMPLETED', label: 'Completed' },
];

function toPinStatus(status) {
  if (status === 'COMPLETED') return 'resolved';
  if (status === 'PENDING') return 'pending';
  if (status === 'DECLINED') return 'rejected';
  return 'ongoing';
}

function hasCoords(item) {
  return Number.isFinite(Number(item?.incident_latitude)) && Number.isFinite(Number(item?.incident_longitude));
}

export default function IncidentsMap() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError('');
      getResponderDispatches(undefined, user?.role)
        .then((list) => {
          if (!active) return;
          // One pin per incident (the list comes newest first from the API order).
          const seen = new Set();
          const unique = [];
          for (const item of Array.isArray(list) ? list : []) {
            const key = item.incident_id || item.id;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(item);
          }
          setDispatches(unique);
        })
        .catch((err) => {
          if (active) setError(err.message || 'Unable to load incidents.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user?.role]),
  );

  const counts = useMemo(() => ({
    ALL: dispatches.length,
    ACTIVE: dispatches.filter((d) => ACTIVE_DISPATCH_STATUSES.includes(d.status)).length,
    COMPLETED: dispatches.filter((d) => d.status === 'COMPLETED').length,
  }), [dispatches]);

  const visible = useMemo(() => dispatches.filter((d) => {
    if (filter === 'ACTIVE') return ACTIVE_DISPATCH_STATUSES.includes(d.status);
    if (filter === 'COMPLETED') return d.status === 'COMPLETED';
    return true;
  }), [dispatches, filter]);

  const pins = useMemo(() => visible.filter(hasCoords).map((d) => ({
    id: d.id,
    title: d.incident_title,
    category: d.is_maintenance ? 'infrastructure' : d.incident_category,
    status: toPinStatus(d.status),
    address: d.incident_location,
    lat: Number(d.incident_latitude),
    lng: Number(d.incident_longitude),
  })), [visible]);

  const selected = useMemo(
    () => dispatches.find((d) => d.id === selectedId) || null,
    [dispatches, selectedId],
  );
  const activeNavigation = useMemo(
    () => dispatches.find((d) => NAVIGABLE_DISPATCH_STATUSES.includes(d.status) && !d.is_maintenance) || null,
    [dispatches],
  );

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const openNavigation = (assignment) => navigation.navigate('Navigation', { assignment });

  const renderSelectedCard = () => {
    const status = getStatusStyle(selected);
    const isMaintenance = Boolean(selected.is_maintenance);
    const canNavigate = NAVIGABLE_DISPATCH_STATUSES.includes(selected.status);
    const isCompleted = selected.status === 'COMPLETED';

    return (
      <View style={tw`rounded-3xl bg-white p-4 shadow-lg`}>
        <View style={tw`flex-row items-center justify-between gap-1.5`}>
          <View style={tw`flex-1 flex-row flex-wrap items-center gap-1.5`}>
            <View
              style={tw`flex-shrink flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${isMaintenance ? 'bg-green-50' : 'bg-red-50'}`}
            >
              {isMaintenance ? <Wrench size={13} color={GREEN} /> : <AlertTriangle size={13} color="#DC2626" />}
              <Text
                numberOfLines={1}
                style={tw`flex-shrink pr-0.5 text-[11px] font-bold ${isMaintenance ? 'text-[#1F7A4D]' : 'text-red-700'}`}
              >
                {(isMaintenance ? 'Maintenance' : selected.incident_category || 'Emergency').toUpperCase()}
              </Text>
            </View>
            <View style={tw`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${status.bg}`}>
              <View style={[tw`h-1.5 w-1.5 rounded-full`, { backgroundColor: status.dot }]} />
              <Text style={tw`pr-0.5 text-[10px] font-bold ${status.text}`}>{status.label}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setSelectedId(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close incident details"
            style={tw`h-7 w-7 items-center justify-center rounded-full bg-slate-100`}
          >
            <X size={14} color="#334155" />
          </Pressable>
        </View>

        <Text style={tw`mt-2.5 text-base font-extrabold text-slate-900`} numberOfLines={2}>
          {formatTitleCase(selected.incident_title)}
        </Text>

        <View style={tw`mt-2 gap-1.5`}>
          <View style={tw`flex-row items-center gap-1.5`}>
            <MapPin size={13} color="#64748B" />
            <Text style={tw`flex-1 text-xs text-slate-600`} numberOfLines={1}>
              {selected.incident_location || 'Pinned on map'}
            </Text>
          </View>
          <View style={tw`flex-row items-center gap-1.5`}>
            <Clock size={13} color="#64748B" />
            <Text style={tw`text-xs text-slate-600`}>
              {isCompleted && selected.completed_at
                ? `Completed ${formatTimestamp(selected.completed_at)}`
                : `Dispatched ${formatTimestamp(selected.dispatched_at || selected.created_at)}`}
            </Text>
          </View>
        </View>

        {canNavigate ? (
          <View style={tw`mt-3.5 flex-row gap-2`}>
            <Pressable
              onPress={() => navigation.navigate('Messages', { assignment: selected })}
              style={({ pressed }) => [
                tw`flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3`,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <MessageCircle size={15} color="#334155" />
              <Text style={tw`text-xs font-bold text-slate-700`}>Message</Text>
            </Pressable>
            <Pressable
              onPress={() => openNavigation(selected)}
              style={({ pressed }) => [
                tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-3`,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Navigation size={15} color="#FFFFFF" />
              <Text style={tw`text-xs font-extrabold text-white`}>
                {isMaintenance ? 'Open Task on Map' : 'Start Emergency Navigation'}
              </Text>
            </Pressable>
          </View>
        ) : isCompleted ? (
          <View style={tw`mt-3.5 flex-row items-center justify-center gap-1.5 rounded-xl bg-green-50 py-2.5`}>
            <CheckCircle2 size={14} color={GREEN} />
            <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>Handled by your unit</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={tw`flex-1`}>
      <MapViewer
        variant="viewer"
        incidents={pins}
        onIncidentSelect={(pin) => {
          setFilterMenuOpen(false);
          setSelectedId(pin?.id ?? null);
        }}
        disableIncidentSheet
        showBackButton={false}
        hideMapLabel
        showBasemapControl={false}
        showMapInfoButton={false}
        showZoomControls={false}
        showBoundary
        highlightBoundary
        topInset={0}
        bottomInset={160}
        compact={false}
      />

      {/* Top-left controls: Back button + single Filter button in one row (never overlaps) */}
      <View
        pointerEvents="box-none"
        style={[
          tw`absolute left-3 flex-row items-center`,
          { top: 12, zIndex: 30, gap: 8 },
        ]}
      >
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            tw`h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white`,
            {
              elevation: 4,
              shadowColor: '#0F172A',
              shadowOpacity: 0.1,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <ArrowLeft size={20} color="#374151" />
        </Pressable>

        <Pressable
          onPress={() => setFilterMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filter incidents on map"
          style={({ pressed }) => [
            tw`h-11 flex-row items-center rounded-xl border border-slate-200 bg-white px-3`,
            {
              elevation: 4,
              shadowColor: '#0F172A',
              shadowOpacity: 0.1,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <SlidersHorizontal size={15} color={GREEN} />
          <Text style={tw`ml-1.5 text-xs font-bold text-slate-900`}>
            {FILTERS.find((f) => f.key === filter)?.label || 'All'}
          </Text>
          <View style={tw`ml-1.5 rounded-full bg-green-50 px-1.5 py-0.5`}>
            <Text style={tw`text-[10px] font-extrabold text-[#1F7A4D]`}>
              {counts[filter]}
            </Text>
          </View>
          <ChevronDown size={14} color="#64748B" style={tw`ml-1`} />
        </Pressable>
      </View>

      {/* Filter Menu Modal (tap outside to close, zero overlap with map controls) */}
      <Modal
        visible={filterMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterMenuOpen(false)}
      >
        <Pressable
          onPress={() => setFilterMenuOpen(false)}
          style={tw`flex-1 justify-end bg-black/35`}
        >
          <Pressable
            onPress={() => {}}
            style={tw`rounded-t-3xl bg-white px-5 pb-7 pt-5`}
          >
            <View style={tw`flex-row items-center justify-between`}>
              <Text style={tw`text-base font-extrabold text-slate-900`}>Filter Incidents</Text>
              <Pressable
                onPress={() => setFilterMenuOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close filter menu"
                style={tw`h-8 w-8 items-center justify-center rounded-full bg-slate-100`}
              >
                <X size={16} color="#334155" />
              </Pressable>
            </View>

            <View style={tw`mt-4 gap-2`}>
              {FILTERS.map(({ key, label }) => {
                const active = filter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setFilter(key);
                      setSelectedId(null);
                      setFilterMenuOpen(false);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      tw`flex-row items-center justify-between rounded-2xl border px-4 py-3.5 ${
                        active
                          ? 'border-green-200 bg-green-50'
                          : 'border-slate-200 bg-white'
                      }`,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <View style={tw`flex-row items-center`}>
                      <Text
                        style={tw`text-sm ${
                          active ? 'font-extrabold text-[#1F7A4D]' : 'font-semibold text-slate-800'
                        }`}
                      >
                        {label}
                      </Text>
                      <View
                        style={tw`ml-2 rounded-full px-2 py-0.5 ${
                          active ? 'bg-white' : 'bg-slate-100'
                        }`}
                      >
                        <Text
                          style={tw`text-xs font-extrabold ${
                            active ? 'text-[#1F7A4D]' : 'text-slate-500'
                          }`}
                        >
                          {counts[key]}
                        </Text>
                      </View>
                    </View>
                    {active ? <Check size={18} color={GREEN} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bottom panel: selected incident, or summary + resume navigation */}
      <View pointerEvents="box-none" style={tw`absolute bottom-3 left-3 right-3`}>
        {selected ? renderSelectedCard() : (
          <View style={tw`rounded-3xl bg-white p-4 shadow-lg`}>
            {loading ? (
              <View style={tw`flex-row items-center gap-2`}>
                <ActivityIndicator size="small" color={GREEN} />
                <Text style={tw`text-xs text-slate-500`}>Loading your incidents...</Text>
              </View>
            ) : error ? (
              <Text style={tw`text-xs font-semibold text-red-700`}>{error}</Text>
            ) : (
              <>
                <Text style={tw`text-sm font-extrabold text-slate-900`}>
                  {pins.length} {pins.length === 1 ? 'incident' : 'incidents'} on map
                </Text>
                <Text style={tw`mt-0.5 text-xs text-slate-500`}>
                  {pins.length ? 'Tap a pin to see details.' : 'Incidents assigned to your unit will appear here.'}
                </Text>
                {activeNavigation ? (
                  <Pressable
                    onPress={() => openNavigation(activeNavigation)}
                    style={({ pressed }) => [
                      tw`mt-3 flex-row items-center rounded-xl border border-green-200 bg-green-50 px-3.5 py-3`,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={tw`h-8 w-8 items-center justify-center rounded-lg bg-[#1F7A4D]`}>
                      <Navigation size={15} color="#FFFFFF" />
                    </View>
                    <View style={tw`ml-2.5 flex-1`}>
                      <Text style={tw`text-xs font-extrabold text-[#1F7A4D]`}>Resume emergency navigation</Text>
                      <Text style={tw`text-[11px] font-medium text-slate-600`} numberOfLines={1}>
                        {activeNavigation.incident_title}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
