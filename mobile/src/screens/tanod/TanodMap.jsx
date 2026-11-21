import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertTriangle, MapPin, Navigation, RefreshCw, ShieldCheck, Wrench } from 'lucide-react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import { getResponderDispatches } from '../../services/responderDispatchService';

const MAP_STATUSES = ['DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ON_SCENE'];

function formatStatus(item) {
  if (item.status === 'DISPATCHED') return 'New assignment';
  if (item.status === 'ACCEPTED') return 'Accepted';
  if (item.status === 'EN_ROUTE') return 'En route';
  if (item.status === 'ON_SCENE') return 'On scene';
  return String(item.status || 'Assignment').replaceAll('_', ' ');
}

export default function TanodMap() {
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const dispatches = await getResponderDispatches();
      setItems(dispatches.filter((item) => MAP_STATUSES.includes(item.status)));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load task locations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const incidents = useMemo(() => items
    .filter((item) => Number.isFinite(Number(item.incident_latitude)) && Number.isFinite(Number(item.incident_longitude)))
    .map((item) => ({
      id: item.id,
      title: item.incident_title || 'Assigned task',
      category: item.is_maintenance ? 'infrastructure' : item.incident_category || 'incident',
      urgency: item.urgency || 'Standard',
      address: item.incident_location || 'Pinned location',
      description: item.incident_description || '',
      reporter_name: item.reporter_name || '',
      reporter_phone: item.reporter_phone || '',
      lat: Number(item.incident_latitude),
      lng: Number(item.incident_longitude),
      status: item.status,
      assignment: item,
    })), [items]);

  const activeCount = items.filter((item) => ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'].includes(item.status)).length;
  const selectedAssignment = selected?.assignment;
  const openTask = () => {
    if (!selectedAssignment) return;
    if (selectedAssignment.status === 'DISPATCHED') {
      navigation.navigate('Assignments');
      return;
    }
    navigation.navigate('MapNavigation', { assignment: selectedAssignment });
  };

  return (
    <View style={tw`flex-1 bg-slate-950`}>
      {loading ? (
        <View style={tw`flex-1 items-center justify-center bg-slate-50`}>
          <ActivityIndicator color="#17633F" />
          <Text style={tw`mt-3 text-sm text-slate-500`}>Loading field map...</Text>
        </View>
      ) : (
        <MapViewer
          incidents={incidents}
          selectedIncident={selected}
          onIncidentSelect={setSelected}
          disableIncidentSheet
          showBackButton={false}
          showBoundary
          highlightBoundary
          compact={false}
        />
      )}

      <View style={tw`absolute left-4 right-4 top-4 rounded-2xl bg-white p-4 shadow-lg`}>
        <View style={tw`flex-row items-center justify-between gap-3`}>
          <View style={tw`flex-1`}>
            <Text style={tw`text-xs font-extrabold uppercase tracking-wide text-[#17633F]`}>Barangay 167</Text>
            <Text style={tw`mt-1 text-xl font-bold text-slate-950`}>Field Map</Text>
            <Text style={tw`mt-1 text-sm text-slate-500`}>
              {activeCount ? `${activeCount} active field task${activeCount === 1 ? '' : 's'}` : 'Select a pinned assignment'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh field map"
            onPress={() => load(true)}
            disabled={refreshing}
            style={({ pressed }) => [tw`h-11 w-11 items-center justify-center rounded-xl bg-slate-100`, { opacity: pressed || refreshing ? 0.6 : 1 }]}
          >
            {refreshing ? <ActivityIndicator size="small" color="#17633F" /> : <RefreshCw size={18} color="#17633F" />}
          </Pressable>
        </View>
        {error ? <Text style={tw`mt-3 text-sm leading-5 text-red-700`}>{error}</Text> : null}
      </View>

      {selectedAssignment ? (
        <View style={tw`absolute bottom-4 left-4 right-4 rounded-3xl bg-white p-5 shadow-xl`}>
          <View style={tw`flex-row items-start justify-between gap-3`}>
            <View style={tw`flex-1 flex-row items-center gap-2.5`}>
              <View style={tw`h-10 w-10 items-center justify-center rounded-xl ${selectedAssignment.is_maintenance ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {selectedAssignment.is_maintenance ? <Wrench size={18} color="#17633F" /> : <AlertTriangle size={18} color="#B42318" />}
              </View>
              <View style={tw`flex-1`}>
                <Text style={tw`text-xs font-extrabold uppercase tracking-wide text-slate-500`}>{formatStatus(selectedAssignment)}</Text>
                <Text numberOfLines={1} style={tw`mt-1 text-base font-bold text-slate-950`}>{selectedAssignment.incident_title || 'Assigned task'}</Text>
              </View>
            </View>
            <Pressable onPress={() => setSelected(null)} accessibilityRole="button" accessibilityLabel="Close selected assignment">
              <Text style={tw`text-sm font-bold text-slate-500`}>Close</Text>
            </Pressable>
          </View>
          <View style={tw`mt-3 flex-row items-start gap-2`}>
            <MapPin size={15} color="#17633F" style={tw`mt-0.5`} />
            <Text numberOfLines={2} style={tw`flex-1 text-sm leading-5 text-slate-600`}>{selectedAssignment.incident_location || 'Pinned location'}</Text>
          </View>
          <Pressable
            onPress={openTask}
            style={({ pressed }) => [tw`mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#17633F] px-4`, { opacity: pressed ? 0.72 : 1 }]}
          >
            {selectedAssignment.status === 'DISPATCHED' ? <ShieldCheck size={16} color="#fff" /> : <Navigation size={16} color="#fff" />}
            <Text style={tw`text-sm font-bold text-white`}>
              {selectedAssignment.status === 'DISPATCHED' ? 'Review task' : 'Open live navigation'}
            </Text>
          </Pressable>
        </View>
      ) : !loading && !incidents.length ? (
        <View style={tw`absolute bottom-6 left-4 right-4 rounded-3xl bg-white p-5 shadow-xl`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50`}>
              <MapPin size={23} color="#17633F" />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-base font-bold text-slate-950`}>No active locations</Text>
              <Text style={tw`mt-1 text-sm leading-5 text-slate-500`}>Accepted tasks with a pinned location will appear on this map.</Text>
            </View>
          </View>
          <Pressable onPress={() => navigation.navigate('Assignments')} style={tw`mt-4 min-h-12 items-center justify-center rounded-xl bg-[#17633F]`}>
            <Text style={tw`text-sm font-bold text-white`}>Open tasks</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
