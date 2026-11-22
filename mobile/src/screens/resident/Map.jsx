import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AlertTriangle, CheckCircle2, MapPin, Wrench, X } from 'lucide-react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import { getPublicMapFeed } from '../../services/residentService';

export default function MapScreen() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'emergency' | 'maintenance'
  const [selectedPin, setSelectedPin] = useState(null);

  const loadFeed = useCallback(async () => {
    try {
      const feed = await getPublicMapFeed();
      setItems(feed);
    } catch {
      // Keep existing pins if offline
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFeed();
    }, [loadFeed]),
  );

  const counts = useMemo(() => {
    const emergency = items.filter((i) => i.report_type === 'emergency').length;
    const maintenance = items.filter((i) => i.report_type === 'maintenance').length;
    return { all: items.length, emergency, maintenance };
  }, [items]);

  const filteredIncidents = useMemo(() => {
    return items
      .filter((item) => {
        if (filter === 'emergency') return item.report_type === 'emergency';
        if (filter === 'maintenance') return item.report_type === 'maintenance';
        return true;
      })
      .map((item) => ({
        ...item,
        pinType: item.report_type === 'maintenance' ? 'maintenance' : 'incident',
        category:
          item.report_type === 'maintenance'
            ? 'infrastructure'
            : item.category || 'emergency',
      }));
  }, [items, filter]);

  return (
    <View style={tw`flex-1`}>
      <MapViewer
        variant="viewer"
        incidents={filteredIncidents}
        disableIncidentSheet
        onIncidentSelect={(pin) => setSelectedPin(pin)}
        selectedLocation={null}
        onLocationSelect={() => {}}
        routes={[]}
        trackers={[]}
        dropOffs={[]}
        highlightBoundary
        showBackButton={false}
        hideMapLabel
        compact={false}
      />

      {/* TOP FILTER CHIPS: All | Emergencies | Maintenance */}
      <View style={tw`absolute left-4 right-4 top-4 z-30 flex-row gap-2`}>
        {[
          { key: 'all', label: `All (${counts.all})` },
          { key: 'emergency', label: `Emergencies (${counts.emergency})` },
          { key: 'maintenance', label: `Maintenance (${counts.maintenance})` },
        ].map((tab) => {
          const active = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setFilter(tab.key);
                setSelectedPin(null);
              }}
              style={tw`flex-1 items-center rounded-full border py-2 shadow-sm ${
                active
                  ? 'border-[#1F7A4D] bg-[#1F7A4D]'
                  : 'border-slate-200 bg-white/95'
              }`}
            >
              <Text
                style={tw`text-xs font-extrabold ${
                  active ? 'text-white' : 'text-slate-700'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* PIN DETAIL CARD */}
      {selectedPin ? (
        <View
          style={tw`absolute bottom-24 left-4 right-4 z-40 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl`}
        >
          <View style={tw`flex-row items-center justify-between`}>
            <View
              style={tw`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${
                selectedPin.report_type === 'maintenance' ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              {selectedPin.report_type === 'maintenance' ? (
                <Wrench size={13} color="#1F7A4D" />
              ) : (
                <AlertTriangle size={13} color="#DC2626" />
              )}
              <Text
                style={tw`text-[10px] font-extrabold uppercase ${
                  selectedPin.report_type === 'maintenance' ? 'text-[#1F7A4D]' : 'text-red-700'
                }`}
              >
                {selectedPin.report_type === 'maintenance'
                  ? `Maintenance • ${selectedPin.reference_number || ''}`
                  : `Emergency • ${selectedPin.reference_number || ''}`}
              </Text>
            </View>

            <View style={tw`flex-row items-center gap-2`}>
              <View style={tw`rounded-full bg-slate-100 px-2.5 py-0.5`}>
                <Text style={tw`text-[10px] font-bold text-slate-700`}>
                  {selectedPin.status || 'In Progress'}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedPin(null)} hitSlop={10}>
                <X size={18} color="#64748B" />
              </Pressable>
            </View>
          </View>

          <Text style={tw`mt-2 text-base font-extrabold text-slate-900`}>
            {selectedPin.title}
          </Text>

          <View style={tw`mt-1.5 flex-row items-center gap-1.5`}>
            <MapPin size={13} color="#1F7A4D" />
            <Text style={tw`flex-1 text-xs font-semibold text-slate-600`} numberOfLines={1}>
              {selectedPin.location || 'Barangay 167'}
            </Text>
          </View>

          {selectedPin.description ? (
            <Text style={tw`mt-1.5 text-xs leading-4 text-slate-600`} numberOfLines={3}>
              {selectedPin.description}
            </Text>
          ) : null}

          {selectedPin.report_type === 'maintenance' ? (
            <View style={tw`mt-3 flex-row items-center justify-between rounded-xl bg-green-50 px-3 py-2`}>
              <View style={tw`flex-row items-center gap-1.5`}>
                <CheckCircle2 size={14} color="#1F7A4D" />
                <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>
                  Stage: {selectedPin.status}
                </Text>
              </View>
              {selectedPin.assigned_team ? (
                <Text style={tw`text-[11px] font-semibold text-slate-700`}>
                  {selectedPin.assigned_team}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
