import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Plus, Send, ShieldAlert, Truck } from 'lucide-react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { buildSampleIncidents } from '../../utils/map/sampleIncidents';

const BOUNDARY = require('../../../assets/map/barangay-167.json');

function getDispatchTargets(category) {
  if (category === 'fire') return ['BFP', 'Police'];
  if (category === 'crime') return ['Police'];
  if (category === 'incident') return ['Police', 'BDRRMO'];
  return ['BDRRMO'];
}

export default function BdrrmoHome() {
  const { user } = useAuth();
  const reports = useMemo(() => buildSampleIncidents(BOUNDARY), []);
  const [reviewed, setReviewed] = useState({});
  const [dispatched, setDispatched] = useState({});
  const [vehicles, setVehicles] = useState(['Vehicle 01', 'Vehicle 02']);
  const [vehicleName, setVehicleName] = useState('');

  const addVehicle = () => {
    const name = vehicleName.trim();
    if (!name) return;

    setVehicles((current) => [...current, name]);
    setVehicleName('');
  };

  return (
    <ScrollView contentContainerStyle={tw`px-4 pb-6 pt-3`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Home</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Welcome, {user?.full_name || 'BDRRMO'}. Review resident reports and coordinate response.
      </Text>

      <View style={tw`mt-5 flex-row gap-3`}>
        <View style={tw`flex-1 rounded-2xl bg-amber-50 p-4`}>
          <ShieldAlert size={20} color="#B45309" />
          <Text style={tw`mt-2 text-2xl font-extrabold text-amber-900`}>{reports.length}</Text>
          <Text style={tw`text-xs font-medium text-amber-800`}>Resident reports</Text>
        </View>
        <View style={tw`flex-1 rounded-2xl bg-green-50 p-4`}>
          <ClipboardCheck size={20} color="#1F7A4D" />
          <Text style={tw`mt-2 text-2xl font-extrabold text-green-900`}>
            {Object.keys(reviewed).length}
          </Text>
          <Text style={tw`text-xs font-medium text-green-800`}>Reviewed</Text>
        </View>
      </View>

      <View style={tw`mt-3 rounded-2xl bg-white p-4`}>
        <View style={tw`flex-row items-center`}>
          <View style={tw`h-10 w-10 items-center justify-center rounded-xl bg-blue-50`}>
            <Truck size={20} color="#2563EB" />
          </View>
          <View style={tw`ml-3 flex-1`}>
            <Text style={tw`text-xs font-medium text-slate-500`}>Available vehicles</Text>
            <Text style={tw`text-2xl font-extrabold text-slate-900`}>{vehicles.length}</Text>
          </View>
        </View>
        <View style={tw`mt-3 flex-row items-center rounded-xl border border-slate-200 px-3`}>
          <TextInput
            value={vehicleName}
            onChangeText={setVehicleName}
            placeholder="Vehicle name or number"
            placeholderTextColor="#94A3B8"
            style={tw`min-h-10 flex-1 text-sm text-slate-800`}
          />
          <Pressable
            onPress={addVehicle}
            accessibilityRole="button"
            accessibilityLabel="Add vehicle"
            style={({ pressed }) => [tw`p-2`, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Plus size={19} color="#2563EB" />
          </Pressable>
        </View>
        <Text style={tw`mt-2 text-xs text-slate-500`}>
          {vehicles.join(' · ')}
        </Text>
      </View>

      <Text style={tw`mt-6 text-lg font-bold text-slate-900`}>Resident reports</Text>
      <View style={tw`mt-3 gap-3`}>
        {reports.map((report) => {
          const targets = getDispatchTargets(report.category);
          const isReviewed = Boolean(reviewed[report.id]);
          const isDispatched = Boolean(dispatched[report.id]);

          return (
            <View key={report.id} style={tw`rounded-2xl bg-white p-4`}>
              <View style={tw`flex-row items-start`}>
                <View style={tw`flex-1`}>
                  <Text style={tw`text-sm font-bold text-slate-900`}>{report.title}</Text>
                  <Text style={tw`mt-1 text-xs text-slate-500`}>
                    {report.address} · {report.status}
                  </Text>
                </View>
                {isReviewed ? <CheckCircle2 size={19} color="#1F7A4D" /> : null}
              </View>
              <Text style={tw`mt-3 text-xs leading-5 text-slate-600`}>
                {report.description}
              </Text>
              <Text style={tw`mt-3 text-xs font-semibold text-slate-700`}>
                Automatic dispatch: {targets.join(' + ')}
              </Text>
              <View style={tw`mt-3 flex-row gap-2`}>
                <Pressable
                  onPress={() => setReviewed((current) => ({ ...current, [report.id]: true }))}
                  style={tw`flex-1 items-center rounded-xl bg-amber-100 px-3 py-2.5`}
                >
                  <Text style={tw`text-xs font-bold text-amber-800`}>
                    {isReviewed ? 'Reviewed' : 'Review report'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDispatched((current) => ({ ...current, [report.id]: true }))}
                  style={tw`flex-1 flex-row items-center justify-center rounded-xl bg-green-100 px-3 py-2.5`}
                >
                  <Send size={14} color="#1F7A4D" />
                  <Text style={tw`ml-1.5 text-xs font-bold text-[#1F7A4D]`}>
                    {isDispatched ? 'Dispatched' : 'Dispatch'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

    </ScrollView>
  );
}
