import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  ClipboardList,
  Clock,
  FileText,
  MapPin,
  Navigation,
  Truck,
  User,
} from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import tw from 'twrnc';

import { getResponderDispatches } from '../../services/responderDispatchService';
import { getMapLocationPermissionParams } from '../../services/locationPermissionService';
import { useAuth } from '../../context/AuthContext';

function formatTimestamp(value) {
  if (!value) return 'Just now';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Assignments() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [assignments, setAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAssignments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const dispatches = await getResponderDispatches();
      setAssignments(
        dispatches.filter((d) => d.status !== 'COMPLETED' && d.status !== 'DISPATCHED'),
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAssignments(false);
    }, [loadAssignments]),
  );

  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter === 'ASSIGNED') return a.status === 'ACCEPTED';
    if (statusFilter === 'IN_PROGRESS') return ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'PENDING'].includes(a.status);
    return true;
  });

  async function openAssignmentMap(assignment) {
    const locationParams = await getMapLocationPermissionParams();
    navigation.navigate('Map', { assignment, ...locationParams });
  }

  return (
    <ScrollView
      contentContainerStyle={tw`px-5 pb-8 pt-6`}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadAssignments(true)}
          colors={['#1F7A4D']}
          tintColor="#1F7A4D"
        />
      }
    >
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Assignments</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Active dispatches assigned to {String(user?.role || 'your team').toUpperCase()}.
      </Text>

      {error ? (
        <View style={tw`mt-4 rounded-xl bg-red-50 p-3`}>
          <Text style={tw`text-xs font-semibold text-red-700`}>{error}</Text>
        </View>
      ) : null}

      <View style={tw`mt-4 flex-row gap-2`}>
        {[
          { key: 'ALL', label: 'All' },
          { key: 'ASSIGNED', label: 'Assigned' },
          { key: 'IN_PROGRESS', label: 'In Progress' },
        ].map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setStatusFilter(tab.key)}
              style={tw`rounded-full px-4 py-1.5 ${active ? 'bg-[#1F7A4D]' : 'bg-slate-200'}`}
            >
              <Text style={tw`text-xs font-bold ${active ? 'text-white' : 'text-slate-700'}`}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filteredAssignments.length === 0 ? (
        <View style={tw`mt-6 items-center rounded-2xl border border-slate-200 bg-white px-6 py-8`}>
          <View style={tw`h-12 w-12 items-center justify-center rounded-xl bg-green-50`}>
            <ClipboardList size={24} color="#1F7A4D" />
          </View>
          <Text style={tw`mt-4 text-base font-bold text-slate-900`}>
            No active assignments
          </Text>
          <Text style={tw`mt-2 text-center text-sm leading-5 text-slate-500`}>
            Accepted dispatches from Home will appear here.
          </Text>
        </View>
      ) : (
        <View style={tw`mt-5 gap-4`}>
          {filteredAssignments.map((assignment) => (
            <View
              key={assignment.id}
              style={tw`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`}
            >
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1`}>
                  <AlertTriangle size={14} color="#DC2626" />
                  <Text style={tw`text-[11px] font-extrabold uppercase tracking-wide text-red-700`}>
                    {assignment.incident_category || 'Incident'} • {assignment.urgency || 'High'}
                  </Text>
                </View>
                <View
                  style={tw`rounded-full px-3 py-1 ${
                    assignment.status === 'PENDING' ? 'bg-amber-100' : 'bg-green-50'
                  }`}
                >
                  <Text
                    style={tw`text-[11px] font-extrabold uppercase ${
                      assignment.status === 'PENDING' ? 'text-amber-800' : 'text-[#1F7A4D]'
                    }`}
                  >
                    {assignment.status}
                  </Text>
                </View>
              </View>

              <Text style={tw`mt-3 text-lg font-extrabold text-slate-900`}>
                {assignment.incident_title}
              </Text>

              <View style={tw`mt-3 gap-2 rounded-xl bg-slate-50 p-3`}>
                <View style={tw`flex-row items-start gap-2`}>
                  <MapPin size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
                      Location
                    </Text>
                    <Text style={tw`text-xs font-semibold text-slate-700`}>
                      {assignment.incident_location || 'Pinned on map'}
                    </Text>
                  </View>
                </View>

                <View style={tw`flex-row items-start gap-2`}>
                  <Clock size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
                      Reported Time
                    </Text>
                    <Text style={tw`text-xs font-semibold text-slate-700`}>
                      {formatTimestamp(assignment.dispatched_at)}
                    </Text>
                  </View>
                </View>

                {assignment.reporter_name ? (
                  <View style={tw`flex-row items-start gap-2`}>
                    <User size={14} color="#475569" style={tw`mt-0.5`} />
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
                        Reporter
                      </Text>
                      <Text style={tw`text-xs font-semibold text-slate-700`}>
                        {assignment.reporter_name}
                        {assignment.reporter_phone ? ` • ${assignment.reporter_phone}` : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {assignment.vehicle_name ? (
                  <View style={tw`flex-row items-start gap-2`}>
                    <Truck size={14} color="#475569" style={tw`mt-0.5`} />
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
                        Assigned Unit
                      </Text>
                      <Text style={tw`text-xs font-semibold text-slate-700`}>
                        {assignment.vehicle_name}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {assignment.incident_description ? (
                  <View style={tw`flex-row items-start gap-2 border-t border-slate-200 pt-2`}>
                    <FileText size={14} color="#475569" style={tw`mt-0.5`} />
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
                        Description
                      </Text>
                      <Text style={tw`mt-0.5 text-xs leading-4 text-slate-600`}>
                        {assignment.incident_description}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {assignment.status === 'PENDING' ? (
                <View style={tw`mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-amber-50 py-3`}>
                  <Clock size={15} color="#B45309" />
                  <Text style={tw`text-xs font-extrabold text-amber-800`}>
                    Pending Admin Resolution
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => void openAssignmentMap(assignment)}
                  style={({ pressed }) => [
                    tw`mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3`,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Navigation size={15} color="#FFFFFF" />
                  <Text style={tw`text-xs font-extrabold text-white`}>View in map</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
