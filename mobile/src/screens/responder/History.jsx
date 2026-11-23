import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  RefreshCw,
  Truck,
  User,
  Wrench,
  X,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';
import { formatTimestamp, formatTitleCase, getStatusStyle } from '../../utils/dispatchStatus';

const GREEN = '#1F7A4D';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'EMERGENCY', label: 'Emergencies' },
  { key: 'MAINTENANCE', label: 'Maintenance' },
];

function parseDate(value) {
  if (!value) return null;
  const str = String(value);
  const date = new Date(str.includes('T') ? str : `${str.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRecordTimestamp(item) {
  return item?.completed_at || item?.updated_at || item?.dispatched_at || item?.created_at || null;
}

function getDateGroupLabel(value) {
  const date = parseDate(value);
  if (!date) return 'Earlier';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfItem = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfItem) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTimeOnly(value) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function History() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const role = String(user?.role || '').toLowerCase();
  const isPolice = role === 'police' || role === 'fire';
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState(null);

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const dispatches = await getResponderDispatches(undefined, user?.role);
      // Include all dispatches this responder has personally responded to (accepted, on scene, completed, etc.)
      const list = (Array.isArray(dispatches) ? dispatches : []).filter(
        (item) => item && item.status !== 'DISPATCHED',
      );
      list.sort((a, b) => {
        const aTime = parseDate(getRecordTimestamp(a))?.getTime() || 0;
        const bTime = parseDate(getRecordTimestamp(b))?.getTime() || 0;
        return bTime - aTime;
      });
      setHistory(list);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHistory(false);
    }, [loadHistory]),
  );

  const counts = useMemo(() => {
    const maintenance = history.filter((item) => Boolean(item.is_maintenance)).length;
    const emergency = history.length - maintenance;
    const completed = history.filter((item) => item.status === 'COMPLETED').length;
    const today = history.filter((item) => getDateGroupLabel(getRecordTimestamp(item)) === 'Today').length;
    return {
      ALL: history.length,
      EMERGENCY: emergency,
      MAINTENANCE: maintenance,
      COMPLETED: completed,
      TODAY: today,
    };
  }, [history]);

  const filteredHistory = useMemo(() => {
    if (isPolice) return history.filter((item) => !item.is_maintenance);
    if (filter === 'EMERGENCY') return history.filter((item) => !item.is_maintenance);
    if (filter === 'MAINTENANCE') return history.filter((item) => Boolean(item.is_maintenance));
    return history;
  }, [history, filter, isPolice]);

  const groupedHistory = useMemo(() => {
    const groups = [];
    const byLabel = new Map();

    for (const item of filteredHistory) {
      const label = getDateGroupLabel(getRecordTimestamp(item));
      if (!byLabel.has(label)) {
        const group = { label, items: [] };
        byLabel.set(label, group);
        groups.push(group);
      }
      byLabel.get(label).items.push(item);
    }

    return groups;
  }, [filteredHistory]);

  return (
    <>
      <ScrollView
        style={tw`flex-1 bg-slate-50`}
        contentContainerStyle={tw`px-4 pb-6 pt-3`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHistory(true)}
            colors={[GREEN]}
            tintColor={GREEN}
          />
        }
      >
        <Text style={tw`mb-3 text-2xl font-extrabold text-slate-900`}>History</Text>

        {/* Compact Summary Strip */}
        {isPolice ? (
          <View style={tw`flex-row items-center rounded-2xl border border-slate-200 bg-white py-3.5`}>
            <View style={tw`flex-1 items-center`}>
              <Text style={tw`text-xl font-extrabold text-slate-900`}>
                {loading ? '-' : counts.EMERGENCY}
              </Text>
              <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>
                Total Responded
              </Text>
            </View>
            <View style={tw`h-8 w-px bg-slate-200`} />
            <View style={tw`flex-1 items-center`}>
              <Text style={tw`text-xl font-extrabold text-[#1F7A4D]`}>
                {loading ? '-' : counts.COMPLETED}
              </Text>
              <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>Completed</Text>
            </View>
            <View style={tw`h-8 w-px bg-slate-200`} />
            <View style={tw`flex-1 items-center`}>
              <Text style={tw`text-xl font-extrabold text-slate-700`}>
                {loading ? '-' : counts.TODAY}
              </Text>
              <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>Today</Text>
            </View>
          </View>
        ) : (
          <View style={tw`flex-row items-center rounded-2xl border border-slate-200 bg-white py-3.5`}>
            <View style={tw`flex-1 items-center`}>
              <Text style={tw`text-xl font-extrabold text-slate-900`}>
                {loading ? '-' : counts.ALL}
              </Text>
              <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>Total Done</Text>
            </View>
            <View style={tw`h-8 w-px bg-slate-200`} />
            <View style={tw`flex-1 items-center`}>
              <Text style={tw`text-xl font-extrabold text-red-600`}>
                {loading ? '-' : counts.EMERGENCY}
              </Text>
              <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>Emergencies</Text>
            </View>
            <View style={tw`h-8 w-px bg-slate-200`} />
            <View style={tw`flex-1 items-center`}>
              <Text style={tw`text-xl font-extrabold text-[#1F7A4D]`}>
                {loading ? '-' : counts.MAINTENANCE}
              </Text>
              <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>Maintenance</Text>
            </View>
          </View>
        )}

        {/* Segmented Filter */}
        {!isPolice ? (
          <View style={tw`mt-4 flex-row rounded-2xl bg-slate-200/75 p-1`}>
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={tw`flex-1 flex-row items-center justify-center gap-1 rounded-xl py-2 ${active ? 'bg-[#0B2E22]' : ''
                    }`}
                >
                  <Text
                    style={tw`text-xs font-bold ${active ? 'text-white' : 'text-slate-600'
                      }`}
                  >
                    {label}
                  </Text>
                  <Text
                    style={tw`text-[10px] font-extrabold ${active ? 'text-green-300' : 'text-slate-400'
                      }`}
                  >
                    {counts[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Error Banner */}
        {error ? (
          <View style={tw`mt-4 flex-row items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3`}>
            <Text style={tw`mr-3 flex-1 text-xs font-semibold text-red-700`}>{error}</Text>
            <Pressable
              onPress={() => loadHistory(true)}
              style={({ pressed }) => [
                tw`flex-row items-center gap-1 rounded-lg bg-white px-2.5 py-1.5`,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <RefreshCw size={12} color="#B91C1C" />
              <Text style={tw`text-[11px] font-bold text-red-700`}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Content */}
        {loading ? (
          <View style={tw`mt-12 items-center`}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={tw`mt-2 text-xs text-slate-500`}>Loading completed records...</Text>
          </View>
        ) : groupedHistory.length === 0 ? (
          <View style={tw`mt-6 items-center rounded-2xl border border-slate-200 bg-white px-6 py-10`}>
            <View style={tw`h-12 w-12 items-center justify-center rounded-full bg-green-50`}>
              <CheckCircle2 size={22} color={GREEN} />
            </View>
            <Text style={tw`mt-3 text-base font-bold text-slate-900`}>
              {isPolice
                ? 'No completed emergencies yet'
                : filter === 'ALL'
                  ? 'No completed tasks yet'
                  : filter === 'EMERGENCY'
                    ? 'No completed emergencies'
                    : 'No completed maintenance'}
            </Text>
            <Text style={tw`mt-1 text-center text-xs leading-5 text-slate-500`}>
              {isPolice
                ? 'Resolved emergency responses will appear here.'
                : 'Resolved incidents and verified maintenance repairs will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={tw`mt-5 gap-2`}>
            {groupedHistory.map((group) => (
              <View key={group.label}>
                <View style={tw`mb-2.5 flex-row items-center justify-between px-1`}>
                  <Text style={tw`flex-1 pr-2 text-xs font-bold text-slate-400`}>
                    {group.label.toUpperCase()}
                  </Text>
                  <Text style={tw`text-[11px] font-semibold text-slate-400`}>
                    {group.items.length} {group.items.length === 1 ? 'record' : 'records'}
                  </Text>
                </View>

                <View style={tw`gap-3`}>
                  {group.items.map((item) => {
                    const isMaintenance = Boolean(item.is_maintenance);
                    const timeLabel = formatTimeOnly(getRecordTimestamp(item));
                    const statusStyle = getStatusStyle(item);

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => navigation.navigate('HistoryDetails', { item })}
                        accessibilityRole="button"
                        accessibilityLabel={`View details for ${item.incident_title || 'responded task'}`}
                        style={({ pressed }) => [
                          tw`rounded-2xl border border-slate-200 bg-white p-4`,
                          { opacity: pressed ? 0.8 : 1 },
                        ]}
                      >
                        <View style={tw`flex-row flex-wrap items-center justify-between gap-1.5`}>
                          <View
                            style={tw`flex-shrink flex-row items-center gap-1.5 rounded-lg px-2 py-1 ${
                              isMaintenance ? 'bg-green-50' : 'bg-red-50'
                            }`}
                          >
                            {isMaintenance ? (
                              <Wrench size={12} color={GREEN} />
                            ) : (
                              <AlertTriangle size={12} color="#DC2626" />
                            )}
                            <Text
                              numberOfLines={1}
                              style={tw`flex-shrink pr-0.5 text-[10px] font-bold ${
                                isMaintenance ? 'text-[#1F7A4D]' : 'text-red-700'
                              }`}
                            >
                              {(isMaintenance
                                ? 'Maintenance'
                                : item.incident_category || 'Emergency'
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
                            <Text style={tw`pr-0.5 text-[10px] font-bold ${statusStyle.text}`}>
                              {statusStyle.label}
                            </Text>
                          </View>
                        </View>

                        <View style={tw`mt-2.5 flex-row items-center`}>
                          <View style={tw`flex-1 pr-2`}>
                            <Text
                              numberOfLines={2}
                              style={tw`text-sm font-extrabold leading-5 text-slate-900`}
                            >
                              {formatTitleCase(item.incident_title)}
                            </Text>

                            <View style={tw`mt-2 flex-row items-center gap-3`}>
                              <View style={tw`flex-1 flex-row items-center gap-1`}>
                                <MapPin size={12} color="#64748B" />
                                <Text numberOfLines={1} style={tw`flex-1 text-xs text-slate-500`}>
                                  {item.incident_location || 'Barangay 167'}
                                </Text>
                              </View>
                              {timeLabel ? (
                                <View style={tw`flex-shrink-0 flex-row items-center gap-1`}>
                                  <Clock size={12} color="#94A3B8" />
                                  <Text style={tw`text-[11px] font-medium text-slate-400`}>
                                    {timeLabel}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <ChevronRight size={17} color="#CBD5E1" />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Bottom Sheet */}
      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={tw`flex-1 justify-end bg-black/45`}>
          <View style={tw`max-h-[82%] rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
            <View style={tw`flex-row items-start justify-between gap-3`}>
              <View style={tw`flex-1`}>
                <View style={tw`flex-row items-center gap-2`}>
                  {(() => {
                    const modalStatus = getStatusStyle(selectedItem);
                    return (
                      <View
                        style={tw`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${modalStatus.bg}`}
                      >
                        <View
                          style={[
                            tw`h-1.5 w-1.5 rounded-full`,
                            { backgroundColor: modalStatus.dot },
                          ]}
                        />
                        <Text style={tw`text-[10px] font-extrabold ${modalStatus.text}`}>
                          {modalStatus.label}
                        </Text>
                      </View>
                    );
                  })()}
                  {selectedItem?.incident_category ? (
                    <Text style={tw`text-[11px] font-bold text-slate-400`} numberOfLines={1}>
                      {selectedItem.incident_category}
                    </Text>
                  ) : null}
                </View>
                <Text style={tw`mt-2 text-lg font-extrabold text-slate-900`}>
                  {formatTitleCase(selectedItem?.incident_title, 'Completed Record')}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedItem(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close record details"
                style={tw`h-8 w-8 items-center justify-center rounded-full bg-slate-100`}
              >
                <X size={16} color="#334155" />
              </Pressable>
            </View>

            <ScrollView style={tw`mt-4`} contentContainerStyle={tw`gap-3 pb-2`}>
              <View style={tw`gap-2.5 rounded-2xl bg-slate-50 p-3.5`}>
                <View style={tw`flex-row items-start gap-2.5`}>
                  <MapPin size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>Location</Text>
                    <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                      {selectedItem?.incident_location || 'Location unavailable'}
                    </Text>
                  </View>
                </View>

                <View style={tw`flex-row items-start gap-2.5`}>
                  <Clock size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>Completed</Text>
                    <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                      {formatTimestamp(getRecordTimestamp(selectedItem))}
                    </Text>
                  </View>
                </View>

                {selectedItem?.dispatched_at ? (
                  <View style={tw`flex-row items-start gap-2.5`}>
                    <Clock size={14} color="#94A3B8" style={tw`mt-0.5`} />
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>Dispatched</Text>
                      <Text style={tw`mt-0.5 text-xs font-semibold text-slate-700`}>
                        {formatTimestamp(selectedItem.dispatched_at)}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {selectedItem?.reporter_name ? (
                  <View style={tw`flex-row items-start gap-2.5`}>
                    <User size={14} color="#475569" style={tw`mt-0.5`} />
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>Reporter</Text>
                      <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                        {selectedItem.reporter_name}
                        {selectedItem.reporter_phone ? ` • ${selectedItem.reporter_phone}` : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {selectedItem?.vehicle_name ? (
                  <View style={tw`flex-row items-start gap-2.5`}>
                    <Truck size={14} color="#475569" style={tw`mt-0.5`} />
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>Unit / Vehicle</Text>
                      <Text style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                        {selectedItem.vehicle_name}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {selectedItem?.incident_description ? (
                <View style={tw`rounded-2xl border border-slate-200 bg-white p-3.5`}>
                  <View style={tw`flex-row items-center gap-1.5`}>
                    <FileText size={13} color="#475569" />
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Incident Details
                    </Text>
                  </View>
                  <Text style={tw`mt-1.5 text-xs leading-5 text-slate-700`}>
                    {selectedItem.incident_description}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <Pressable
              onPress={() => setSelectedItem(null)}
              style={({ pressed }) => [
                tw`mt-4 items-center rounded-xl bg-[#0B2E22] py-3`,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={tw`text-xs font-extrabold text-white`}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
