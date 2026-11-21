import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, Clock3, FileText, MapPin, ShieldCheck, Wrench, X } from 'lucide-react-native';
import tw from 'twrnc';

import { getResponderDispatches } from '../../services/responderDispatchService';

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const raw = String(value);
  const date = new Date(Number(value) || (raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`));
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isCompleted(item) {
  return item.status === 'COMPLETED' && !(item.is_maintenance && item.repair_done && !item.admin_check_approved);
}

function HistoryDetails({ item, onClose }) {
  if (!item) return null;
  const maintenance = Boolean(item.is_maintenance);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 justify-end bg-black/45`}>
        <View style={tw`max-h-[82%] rounded-t-3xl bg-white px-5 pb-7 pt-5`}>
          <View style={tw`flex-row items-start justify-between gap-3`}>
            <View style={tw`flex-1`}>
              <Text style={tw`text-xs font-extrabold uppercase tracking-wide text-[#17633F]`}>
                {maintenance ? 'Maintenance record' : 'Incident record'}
              </Text>
              <Text style={tw`mt-1 text-xl font-bold leading-7 text-slate-950`}>{item.incident_title || 'Completed task'}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close record details" style={tw`h-10 w-10 items-center justify-center rounded-full bg-slate-100`}>
              <X size={18} color="#334155" />
            </Pressable>
          </View>
          <ScrollView style={tw`mt-5`} contentContainerStyle={tw`gap-4 pb-2`}>
            <View style={tw`rounded-2xl bg-emerald-50 p-4`}>
              <View style={tw`flex-row items-center gap-2`}>
                <CheckCircle2 size={18} color="#17633F" />
                <Text style={tw`text-base font-bold text-emerald-950`}>Completed</Text>
              </View>
              <Text style={tw`mt-2 text-sm leading-5 text-emerald-900`}>
                {maintenance ? 'The completed maintenance task is recorded in your field history.' : 'The incident response has been closed by the response team.'}
              </Text>
            </View>
            <View style={tw`rounded-2xl bg-slate-50 p-4`}>
              <View style={tw`flex-row items-start gap-2`}>
                <MapPin size={16} color="#17633F" style={tw`mt-0.5`} />
                <View style={tw`flex-1`}>
                  <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Location</Text>
                  <Text style={tw`mt-1 text-sm leading-5 text-slate-800`}>{item.incident_location || 'Location unavailable'}</Text>
                </View>
              </View>
              <View style={tw`mt-4 flex-row items-start gap-2`}>
                <Clock3 size={16} color="#17633F" style={tw`mt-0.5`} />
                <View style={tw`flex-1`}>
                  <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Assigned</Text>
                  <Text style={tw`mt-1 text-sm text-slate-800`}>{formatDate(item.dispatched_at)}</Text>
                </View>
              </View>
            </View>
            {item.incident_description ? (
              <View>
                <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Original report</Text>
                <Text style={tw`mt-2 text-sm leading-6 text-slate-700`}>{item.incident_description}</Text>
              </View>
            ) : null}
            {maintenance && item.repair_note ? (
              <View style={tw`rounded-2xl border border-slate-200 p-4`}>
                <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-500`}>Repair note</Text>
                <Text style={tw`mt-2 text-sm leading-6 text-slate-700`}>{item.repair_note}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function TanodHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const all = await getResponderDispatches();
      setRecords(all.filter(isCompleted));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load task history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const maintenanceCount = useMemo(() => records.filter((item) => item.is_maintenance).length, [records]);

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      <ScrollView
        contentContainerStyle={tw`px-4 pb-10 pt-6`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={['#17633F']} tintColor="#17633F" />}
      >
        <Text style={tw`text-[28px] font-extrabold leading-9 text-slate-950`}>History</Text>
        <Text style={tw`mt-2 text-base leading-6 text-slate-600`}>Closed incidents and completed maintenance work assigned to you.</Text>

        <View style={tw`mt-5 flex-row gap-3`}>
          <View style={tw`flex-1 rounded-2xl bg-[#0B2E22] p-4`}>
            <Text style={tw`text-xs font-semibold text-green-200`}>Completed records</Text>
            <Text style={tw`mt-2 text-3xl font-extrabold text-white`}>{records.length}</Text>
          </View>
          <View style={tw`flex-1 rounded-2xl border border-slate-200 bg-white p-4`}>
            <Text style={tw`text-xs font-semibold text-slate-500`}>Maintenance work</Text>
            <Text style={tw`mt-2 text-3xl font-extrabold text-slate-950`}>{maintenanceCount}</Text>
          </View>
        </View>

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
            <Text style={tw`mt-3 text-sm text-slate-500`}>Loading history...</Text>
          </View>
        ) : records.length ? (
          <View style={tw`mt-6 gap-3`}>
            {records.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Open completed record ${item.incident_title || ''}`}
                onPress={() => setSelected(item)}
                style={({ pressed }) => [tw`flex-row items-center rounded-2xl border border-slate-200 bg-white p-4`, { opacity: pressed ? 0.72 : 1 }]}
              >
                <View style={tw`h-12 w-12 items-center justify-center rounded-xl bg-emerald-50`}>
                  {item.is_maintenance ? <Wrench size={21} color="#17633F" /> : <CheckCircle2 size={22} color="#17633F" />}
                </View>
                <View style={tw`ml-3 flex-1`}>
                  <Text numberOfLines={1} style={tw`text-base font-bold text-slate-950`}>{item.incident_title || 'Completed task'}</Text>
                  <Text numberOfLines={1} style={tw`mt-1 text-sm text-slate-500`}>
                    {item.incident_category || 'Task'} · {item.incident_location || 'Location unavailable'}
                  </Text>
                  <Text style={tw`mt-1.5 text-xs font-bold text-[#17633F]`}>
                    {item.is_maintenance ? 'Maintenance completed' : 'Incident closed'}
                  </Text>
                </View>
                <FileText size={18} color="#64748B" />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={tw`mt-8 items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10`}>
            <ShieldCheck size={28} color="#17633F" />
            <Text style={tw`mt-4 text-base font-bold text-slate-900`}>No completed records yet</Text>
            <Text style={tw`mt-2 text-center text-sm leading-5 text-slate-500`}>Closed tasks will appear here after the required review is complete.</Text>
          </View>
        )}
      </ScrollView>
      <HistoryDetails item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}
