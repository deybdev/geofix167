import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  MapPin,
  MessageSquare,
  Navigation,
  Truck,
  User,
  Wrench,
  X,
} from 'lucide-react-native';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import tw from 'twrnc';

import api from '../../services/api';
import { getResponderDispatches } from '../../services/responderDispatchService';
import { useAuth } from '../../context/AuthContext';

function formatTimestamp(value) {
  if (!value) return 'Just now';
  const str = String(value);
  const date = new Date(str.includes('T') ? str : `${str.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDeadline(value) {
  if (!value) return 'Standard schedule';
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Assignments() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [assignments, setAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reviewItem, setReviewItem] = useState(null);

  const apiBase = String(api.defaults.baseURL || '').replace(/\/$/, '');

  const loadAssignments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const dispatches = await getResponderDispatches(undefined, user?.role);
      setAssignments(
        dispatches.filter((d) => d.status !== 'COMPLETED' && d.status !== 'DISPATCHED'),
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadAssignments(false);
    }, [loadAssignments]),
  );

  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter === 'ASSIGNED') return a.status === 'ACCEPTED' && !a.inspection_done;
    if (statusFilter === 'IN_PROGRESS') {
      return ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'PENDING'].includes(a.status);
    }
    return true;
  });

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
          {filteredAssignments.map((assignment) => {
            const isMaintenance = Boolean(assignment.is_maintenance);
            const displayStatus = isMaintenance && assignment.inspection_done
              ? 'IN PROGRESS'
              : assignment.status === 'ACCEPTED'
                ? 'ASSIGNED'
                : assignment.status;

            return (
              <View
                key={assignment.id}
                style={tw`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`}
              >
                <View style={tw`flex-row items-center justify-between`}>
                  <View
                    style={tw`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${
                      isMaintenance ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    {isMaintenance ? (
                      <Wrench size={14} color="#1F7A4D" />
                    ) : (
                      <AlertTriangle size={14} color="#DC2626" />
                    )}
                    <Text
                      style={tw`text-[11px] font-extrabold uppercase tracking-wide ${
                        isMaintenance ? 'text-[#1F7A4D]' : 'text-red-700'
                      }`}
                    >
                      {assignment.incident_category || 'Task'} • {assignment.urgency || 'Standard'}
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
                      {displayStatus}
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

                  {isMaintenance ? (
                    <View style={tw`flex-row items-start gap-2`}>
                      <Calendar size={14} color="#475569" style={tw`mt-0.5`} />
                      <View style={tw`flex-1`}>
                        <Text style={tw`text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
                          Inspection Deadline
                        </Text>
                        <Text style={tw`text-xs font-semibold text-slate-700`}>
                          {formatDeadline(assignment.inspection_deadline)}
                        </Text>
                      </View>
                    </View>
                  ) : (
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
                  )}

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
                </View>

                {assignment.status === 'PENDING' ? (
                  <View style={tw`mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-amber-50 py-3`}>
                    <Clock size={15} color="#B45309" />
                    <Text style={tw`text-xs font-extrabold text-amber-800`}>
                      Pending Admin Resolution
                    </Text>
                  </View>
                ) : isMaintenance ? (
                  <Pressable
                    onPress={() => setReviewItem(assignment)}
                    style={({ pressed }) => [
                      tw`mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3`,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Eye size={15} color="#FFFFFF" />
                    <Text style={tw`text-xs font-extrabold text-white`}>Review</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => navigation.navigate('Map', { assignment })}
                    style={({ pressed }) => [
                      tw`mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3`,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Navigation size={15} color="#FFFFFF" />
                    <Text style={tw`text-xs font-extrabold text-white`}>View in Maps</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={Boolean(reviewItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewItem(null)}
      >
        <View style={tw`flex-1 justify-end bg-black/45`}>
          <View style={tw`max-h-[85%] rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
            <View style={tw`flex-row items-start justify-between`}>
              <View style={tw`flex-1 pr-3`}>
                <Text style={tw`text-xs font-extrabold uppercase text-[#1F7A4D]`}>
                  Maintenance Review • {reviewItem?.incident_category}
                </Text>
                <Text style={tw`mt-1 text-lg font-extrabold text-slate-900`}>
                  {reviewItem?.incident_title}
                </Text>
              </View>
              <Pressable
                onPress={() => setReviewItem(null)}
                style={tw`h-8 w-8 items-center justify-center rounded-full bg-slate-100`}
              >
                <X size={16} color="#334155" />
              </Pressable>
            </View>

            <ScrollView style={tw`mt-3`} contentContainerStyle={tw`gap-3 pb-4`}>
              <View style={tw`flex-row gap-2`}>
                <View style={tw`flex-1 rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Urgency Level
                  </Text>
                  <Text style={tw`mt-1 text-xs font-extrabold text-slate-900`}>
                    {reviewItem?.urgency || 'Standard'}
                  </Text>
                </View>
                <View style={tw`flex-1 rounded-xl bg-slate-50 p-3`}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                    Inspection Deadline
                  </Text>
                  <Text style={tw`mt-1 text-xs font-extrabold text-[#1F7A4D]`}>
                    {formatDeadline(reviewItem?.inspection_deadline)}
                  </Text>
                </View>
              </View>

              <View style={tw`gap-2 rounded-xl bg-slate-50 p-3`}>
                <View style={tw`flex-row items-start gap-2`}>
                  <User size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Reported By
                    </Text>
                    <Text style={tw`text-xs font-semibold text-slate-800`}>
                      {reviewItem?.reporter_name || 'Reporter'}
                      {reviewItem?.reporter_phone ? ` • ${reviewItem.reporter_phone}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={tw`flex-row items-start gap-2`}>
                  <MapPin size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Location
                    </Text>
                    <Text style={tw`text-xs font-semibold text-slate-800`}>
                      {reviewItem?.incident_location || 'Pinned on map'}
                    </Text>
                  </View>
                </View>

                <View style={tw`flex-row items-start gap-2 border-t border-slate-200 pt-2`}>
                  <FileText size={14} color="#475569" style={tw`mt-0.5`} />
                  <View style={tw`flex-1`}>
                    <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                      Report Description
                    </Text>
                    <Text style={tw`mt-0.5 text-xs leading-4 text-slate-700`}>
                      {reviewItem?.incident_description || 'No additional description provided.'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={tw`rounded-xl border border-green-200 bg-green-50 p-3`}>
                <View style={tw`flex-row items-center gap-1.5`}>
                  <MessageSquare size={14} color="#1F7A4D" />
                  <Text style={tw`text-[11px] font-extrabold uppercase text-[#1F7A4D]`}>
                    Admin Notes (Synced)
                  </Text>
                </View>
                <Text style={tw`mt-1 text-xs leading-4 text-slate-800`}>
                  {reviewItem?.admin_notes || 'Inspect the reported maintenance site and document arrival photos.'}
                </Text>
              </View>

              <View style={tw`rounded-xl bg-slate-50 p-3`}>
                <Text style={tw`text-[10px] font-bold uppercase text-slate-400`}>
                  Reporter Maintenance Photo(s)
                </Text>
                {reviewItem?.reporter_photo_ids?.length > 0 ? (
                  <ScrollView horizontal style={tw`mt-2`} contentContainerStyle={tw`gap-2`}>
                    {reviewItem.reporter_photo_ids.map((photoId) => (
                      <Image
                        key={photoId}
                        source={{
                          uri: `${apiBase}/reports/${encodeURIComponent(reviewItem.incident_id)}/photos/${encodeURIComponent(photoId)}`,
                        }}
                        style={tw`h-36 w-48 rounded-xl bg-slate-200`}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={tw`mt-1.5 text-xs text-slate-500`}>
                    No initial photo attached by the reporter.
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={tw`mt-2 flex-row gap-2.5`}>
              <Pressable
                onPress={() => setReviewItem(null)}
                style={tw`flex-1 items-center rounded-xl bg-slate-100 py-3`}
              >
                <Text style={tw`text-xs font-bold text-slate-700`}>Close</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const target = reviewItem;
                  setReviewItem(null);
                  navigation.navigate('Map', { assignment: target });
                }}
                style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-3`}
              >
                <Navigation size={15} color="#FFFFFF" />
                <Text style={tw`text-xs font-extrabold text-white`}>View in Maps</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
