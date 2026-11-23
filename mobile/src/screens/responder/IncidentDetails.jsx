import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  AlertTriangle,
  ChevronLeft,
  Clock,
  FileText,
  MapPin,
  MessageCircle,
  MessageSquare,
  Navigation,
  Phone,
  Truck,
  User,
  Wrench,
  X,
} from 'lucide-react-native';
import tw from 'twrnc';

import api from '../../services/api';
import { updateResponderDispatchStatus } from '../../services/responderDispatchService';
import { formatTimestamp, formatTitleCase, getStatusStyle } from '../../utils/dispatchStatus';

const GREEN = '#1F7A4D';

function formatDeadline(value) {
  if (!value) return 'No deadline set';
  const date = new Date(Number(value) || value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function IncidentDetails() {
  const navigation = useNavigation();
  const route = useRoute();

  const routeAssignment = route.params?.assignment || {};
  const blockedByOngoing = Boolean(route.params?.blockedByOngoing);

  const [acceptedOverrideId, setAcceptedOverrideId] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [zoomPhotoUri, setZoomPhotoUri] = useState(null);
  const [failedPhotos, setFailedPhotos] = useState({});

  const assignment =
    acceptedOverrideId && routeAssignment?.id === acceptedOverrideId
      ? { ...routeAssignment, status: 'ACCEPTED' }
      : routeAssignment;

  const apiBase = String(api.defaults.baseURL || '').replace(/\/$/, '');
  const isMaintenance = Boolean(assignment?.is_maintenance);
  const isFresh = assignment?.status === 'DISPATCHED';
  const statusStyle = getStatusStyle(assignment);
  const photoIds = Array.isArray(assignment?.reporter_photo_ids)
    ? assignment.reporter_photo_ids
    : [];

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const handleAccept = async () => {
    if (!assignment?.id || accepting || blockedByOngoing) return;
    setAccepting(true);
    let acceptedItem = { ...assignment, status: 'ACCEPTED' };
    try {
      await updateResponderDispatchStatus(assignment.id, 'ACCEPTED');
      setAcceptedOverrideId(assignment.id);
    } catch {
      acceptedItem = assignment;
    } finally {
      setAccepting(false);
    }
    if (!isMaintenance) {
      navigation.navigate('Navigation', { assignment: acceptedItem });
    }
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Top Header */}
      <View style={tw`flex-row items-center justify-between border-b border-slate-200 bg-white px-4 pb-3 pt-3`}>
        <View style={tw`flex-1 flex-row items-center`}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => [
              tw`mr-3 h-9 w-9 items-center justify-center rounded-full bg-slate-100`,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ChevronLeft size={20} color="#0F172A" />
          </Pressable>
          <Text numberOfLines={1} style={tw`flex-1 text-lg font-bold text-slate-900`}>
            Incident Details
          </Text>
        </View>

        <View
          style={tw`ml-2 flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${statusStyle.bg}`}
        >
          <View style={[tw`h-1.5 w-1.5 rounded-full`, { backgroundColor: statusStyle.dot }]} />
          <Text style={tw`text-[10px] font-extrabold ${statusStyle.text}`}>
            {statusStyle.label}
          </Text>
        </View>
      </View>

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={tw`gap-3.5 px-4 pb-8 pt-4`}
      >
        {/* Overview Card */}
        <View style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
          <View style={tw`flex-row flex-wrap items-center justify-between gap-1.5`}>
            <View
              style={tw`flex-shrink flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${isMaintenance ? 'bg-green-50' : 'bg-red-50'
                }`}
            >
              {isMaintenance ? (
                <Wrench size={13} color={GREEN} />
              ) : (
                <AlertTriangle size={13} color="#DC2626" />
              )}
              <Text
                numberOfLines={1}
                style={tw`flex-shrink pr-0.5 text-[11px] font-bold ${isMaintenance ? 'text-[#1F7A4D]' : 'text-red-700'
                  }`}
              >
                {(isMaintenance
                  ? `Maintenance • ${assignment?.incident_category || 'Repair'}`
                  : `Emergency • ${assignment?.incident_category || 'Urgent'}`
                ).toUpperCase()}
              </Text>
            </View>

            <View
              style={tw`rounded-full px-2.5 py-1 ${isMaintenance ? 'bg-slate-100' : 'bg-red-50'
                }`}
            >
              <Text
                style={tw`pr-0.5 text-[10px] font-bold ${isMaintenance ? 'text-slate-700' : 'text-red-700'
                  }`}
              >
                {`${assignment?.urgency || (isMaintenance ? 'Standard' : 'High')} Urgency`.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={tw`mt-3 text-lg font-bold leading-6 text-slate-900`}>
            {formatTitleCase(assignment?.incident_title, 'Untitled Incident Report')}
          </Text>

          <View style={tw`mt-2 flex-row items-center gap-1.5`}>
            <Clock size={13} color="#64748B" />
            <Text style={tw`text-xs font-medium text-slate-500`}>
              {isMaintenance
                ? `Inspection Deadline: ${formatDeadline(assignment?.inspection_deadline)}`
                : `Dispatched ${formatTimestamp(assignment?.dispatched_at || assignment?.created_at)}`}
            </Text>
          </View>
        </View>

        {/* Reporter Captured Photos Section */}
        <View style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
          <View style={tw`flex-row items-center justify-between`}>
            <Text style={tw`text-xs font-bold uppercase text-slate-500`}>
              Captured by Reporter ({photoIds.length})
            </Text>
            {photoIds.length > 0 ? (
              <Text style={tw`text-[11px] font-semibold text-[#1F7A4D]`}>
                Tap photo to enlarge
              </Text>
            ) : null}
          </View>

          {photoIds.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={tw`mt-3`}
              contentContainerStyle={tw`gap-3`}
            >
              {photoIds.map((photoId) => {
                const uri = `${apiBase}/reports/${encodeURIComponent(assignment.incident_id)}/photos/${encodeURIComponent(photoId)}`;
                const failed = Boolean(failedPhotos[photoId]);
                return (
                  <Pressable
                    key={photoId}
                    onPress={() => {
                      if (!failed) setZoomPhotoUri(uri);
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                  >
                    {failed ? (
                      <View style={tw`h-52 w-72 items-center justify-center rounded-xl bg-slate-100 px-4`}>
                        <Text style={tw`text-center text-xs font-medium text-slate-500`}>
                          Photo unavailable
                        </Text>
                      </View>
                    ) : (
                      <Image
                        source={{ uri }}
                        onError={() =>
                          setFailedPhotos((prev) => ({ ...prev, [photoId]: true }))
                        }
                        style={tw`h-52 w-72 rounded-xl bg-slate-200`}
                        resizeMode="cover"
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={tw`mt-3 items-center rounded-xl bg-slate-50 py-6`}>
              <Text style={tw`text-xs font-medium text-slate-500`}>
                No photos were attached by the reporter.
              </Text>
            </View>
          )}
        </View>

        {/* Dedicated Incident & Reporter Info */}
        <View style={tw`gap-3 rounded-2xl border border-slate-200 bg-white p-4`}>
          <Text style={tw`text-xs font-bold uppercase text-slate-500`}>
            Report Information
          </Text>

          <View style={tw`flex-row items-start gap-2.5`}>
            <View style={tw`mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-green-50`}>
              <User size={15} color={GREEN} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-[11px] font-bold uppercase text-slate-400`}>
                Reported By
              </Text>
              <Text style={tw`mt-0.5 text-sm font-bold text-slate-900`}>
                {assignment?.reporter_name || 'Resident Reporter'}
              </Text>
              {assignment?.reporter_phone ? (
                <View style={tw`mt-1 flex-row items-center gap-1`}>
                  <Phone size={12} color="#64748B" />
                  <Text style={tw`text-xs font-medium text-slate-600`}>
                    {assignment.reporter_phone}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={tw`flex-row items-start gap-2.5 border-t border-slate-100 pt-3`}>
            <View style={tw`mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-green-50`}>
              <MapPin size={15} color={GREEN} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-[11px] font-bold uppercase text-slate-400`}>
                Incident Location
              </Text>
              <Text style={tw`mt-0.5 text-sm font-semibold text-slate-800`}>
                {assignment?.incident_location || 'Pinned on map'}
              </Text>
              {assignment?.incident_latitude != null &&
                assignment?.incident_longitude != null ? (
                <Text style={tw`mt-0.5 text-xs text-slate-500`}>
                  GPS: {Number(assignment.incident_latitude).toFixed(5)},{' '}
                  {Number(assignment.incident_longitude).toFixed(5)}
                </Text>
              ) : null}
            </View>
          </View>

          {assignment?.vehicle_name ? (
            <View style={tw`flex-row items-start gap-2.5 border-t border-slate-100 pt-3`}>
              <View style={tw`mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-green-50`}>
                <Truck size={15} color={GREEN} />
              </View>
              <View style={tw`flex-1`}>
                <Text style={tw`text-[11px] font-bold uppercase text-slate-400`}>
                  Assigned Unit / Vehicle
                </Text>
                <Text style={tw`mt-0.5 text-sm font-semibold text-slate-800`}>
                  {assignment.vehicle_name}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={tw`flex-row items-start gap-2.5 border-t border-slate-100 pt-3`}>
            <View style={tw`mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-green-50`}>
              <FileText size={15} color={GREEN} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-[11px] font-bold uppercase text-slate-400`}>
                Reporter Description
              </Text>
              <Text style={tw`mt-1 text-xs leading-5 text-slate-700`}>
                {assignment?.incident_description ||
                  'No additional description provided by the reporter.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tactical / Admin Notes */}
        {assignment?.tactical_note || assignment?.admin_notes ? (
          <View style={tw`rounded-2xl border border-green-200 bg-green-50 p-4`}>
            <View style={tw`flex-row items-center gap-1.5`}>
              <MessageSquare size={15} color={GREEN} />
              <Text style={tw`text-xs font-extrabold uppercase text-[#1F7A4D]`}>
                {isMaintenance ? 'Admin Notes' : 'BDRRMO Tactical Note'}
              </Text>
            </View>
            <Text style={tw`mt-1.5 text-xs leading-5 text-slate-800`}>
              {String(assignment.tactical_note || assignment.admin_notes).replace(
                '[BDRRMO NOTE] ',
                '',
              )}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={tw`border-t border-slate-200 bg-white px-4 pb-4 pt-3`}>
        {isFresh ? (
          <Pressable
            onPress={() => void handleAccept()}
            disabled={accepting || blockedByOngoing}
            style={({ pressed }) => [
              tw`flex-row items-center justify-center gap-2 rounded-xl ${blockedByOngoing
                ? 'bg-slate-200'
                : isMaintenance
                  ? 'bg-[#1F7A4D]'
                  : 'bg-red-600'
                } py-3.5`,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Navigation size={15} color={blockedByOngoing ? '#64748B' : '#FFFFFF'} />
            )}
            <Text
              style={tw`px-1 text-xs font-bold ${blockedByOngoing ? 'text-slate-500' : 'text-white'
                }`}
            >
              {accepting
                ? 'Accepting...'
                : blockedByOngoing
                  ? 'Finish ongoing task first'
                  : isMaintenance
                    ? 'Accept Maintenance Task'
                    : 'Accept Assignment & Navigate'}
            </Text>
          </Pressable>
        ) : (
          <View style={tw`flex-row gap-2.5`}>
            <Pressable
              onPress={() => navigation.navigate('Messages', { assignment })}
              style={({ pressed }) => [
                tw`flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5`,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <MessageCircle size={15} color="#0F172A" />
              <Text style={tw`px-0.5 text-xs font-bold text-slate-800`}>Message</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('Navigation', { assignment })}
              style={({ pressed }) => [
                tw`flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3.5`,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Navigation size={15} color="#FFFFFF" />
              <Text style={tw`px-1 text-xs font-bold text-white`}>
                Open Emergency Navigation
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Full-Screen Photo Zoom Modal */}
      <Modal
        visible={Boolean(zoomPhotoUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomPhotoUri(null)}
      >
        <View style={tw`flex-1 justify-center bg-black/90 px-4`}>
          <Pressable
            onPress={() => setZoomPhotoUri(null)}
            style={tw`absolute right-5 top-12 z-20 h-10 w-10 items-center justify-center rounded-full bg-white/20`}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
          {zoomPhotoUri ? (
            <Image
              source={{ uri: zoomPhotoUri }}
              style={tw`h-[78%] w-full`}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

