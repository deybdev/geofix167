import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertTriangle, CheckCircle2, Clock, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import {
  getResponderDispatches,
  updateResponderDispatchStatus,
} from '../../services/responderDispatchService';

export default function ResponderHome() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);
  const [permissionPromptItem, setPermissionPromptItem] = useState(null);
  const [requestingLocation, setRequestingLocation] = useState(false);

  const loadDispatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const dispatches = await getResponderDispatches();
      setItems(dispatches.filter((d) => d.status === 'DISPATCHED'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDispatches(false);
    }, [loadDispatches]),
  );

  function isSuddenIncident(item) {
    return item.is_guest_emergency === true || Number(item.is_emergency) === 1
      || item.classification === 'sudden' || item.incident_classification === 'sudden';
  }

  async function acceptAssignment(item, { locationPermissionHandled = false, locationSharingOff = false } = {}) {
    setAcceptingId(item.id);
    setError('');
    try {
      await updateResponderDispatchStatus(item.id, 'ACCEPTED');
      const acceptedItem = { ...item, status: 'ACCEPTED' };
      setItems((prev) => prev.map((entry) => entry.id === item.id ? acceptedItem : entry));
      if (isSuddenIncident(item)) {
        navigation.navigate('Map', {
          assignment: acceptedItem,
          locationPermissionHandled,
          locationSharingOff,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingId(null);
    }
  }

  async function continueWithLocationChoice(item, requestPermission) {
    let granted = false;
    setRequestingLocation(true);
    if (requestPermission) {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        granted = permission.status === 'granted';
      } catch {
        granted = false;
      }
    }
    setPermissionPromptItem(null);
    setRequestingLocation(false);
    await acceptAssignment(item, {
      locationPermissionHandled: true,
      locationSharingOff: !granted,
    });
  }

  async function reopenAssignmentMap(item) {
    let granted = false;
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      granted = permission.status === 'granted';
    } catch {
      granted = false;
    }
    navigation.navigate('Map', {
      assignment: item,
      locationPermissionHandled: true,
      locationSharingOff: !granted,
    });
  }

  function handleAccept(item) {
    if (isSuddenIncident(item)) {
      setPermissionPromptItem(item);
      return;
    }
    void acceptAssignment(item);
  }

  return (
    <ScrollView
      style={tw`flex-1 px-5 pt-6`}
      contentContainerStyle={tw`pb-8`}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDispatches(true)}
          colors={['#1F7A4D']}
          tintColor="#1F7A4D"
        />
      }
    >
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Home</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Welcome, {user?.full_name || 'Responder'}.
      </Text>

      {error ? (
        <View style={tw`mt-4 rounded-xl bg-red-50 p-3`}>
          <Text style={tw`text-xs font-semibold text-red-700`}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={tw`mt-8 items-center`}>
          <ActivityIndicator size="small" color="#1F7A4D" />
          <Text style={tw`mt-2 text-xs text-slate-500`}>Loading emergencies...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={tw`mt-6 flex-row items-center rounded-2xl border border-slate-200 bg-white p-4`}>
          <Clock size={20} color="#64748B" />
          <View style={tw`ml-3 flex-1`}>
            <Text style={tw`text-sm font-semibold text-slate-800`}>No active emergencies</Text>
            <Text style={tw`mt-0.5 text-xs text-slate-500`}>
              Incoming guest emergencies and dispatches will appear here.
            </Text>
          </View>
        </View>
      ) : (
        <View style={tw`mt-5 gap-3`}>
          {items.map((item) => {
            const isAccepted = item.status === 'ACCEPTED' || item.status === 'EN_ROUTE' || item.status === 'ON_SCENE';
            return (
              <View key={item.id} style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
                <View style={tw`flex-row items-center justify-between`}>
                  <View style={tw`flex-row items-center gap-2`}>
                    <AlertTriangle size={16} color="#DC2626" />
                    <Text style={tw`text-xs font-bold uppercase text-red-600`}>
                      {item.urgency || 'High'} • {item.incident_category}
                    </Text>
                  </View>
                  <Text style={tw`rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700`}>
                    {item.status}
                  </Text>
                </View>

                <Text style={tw`mt-2 text-base font-bold text-slate-900`}>
                  {item.incident_title}
                </Text>

                {item.incident_location ? (
                  <View style={tw`mt-1.5 flex-row items-center gap-1`}>
                    <MapPin size={13} color="#64748B" />
                    <Text style={tw`flex-1 text-xs text-slate-500`} numberOfLines={1}>
                      {item.incident_location}
                    </Text>
                  </View>
                ) : null}

                {isAccepted ? (
                  <TouchableOpacity
                    onPress={() => void reopenAssignmentMap(item)}
                    style={tw`mt-3 flex-row items-center justify-center gap-1.5 rounded-xl bg-green-50 px-3 py-2.5`}
                  >
                    <CheckCircle2 size={15} color="#1F7A4D" />
                    <Text style={tw`text-xs font-bold text-green-800`}>Accepted — Tap to Open Map</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleAccept(item)}
                    disabled={acceptingId === item.id}
                    style={tw`mt-3 items-center rounded-xl bg-[#1F7A4D] py-2.5`}
                  >
                    <Text style={tw`text-xs font-bold text-white`}>
                      {acceptingId === item.id ? 'Accepting...' : 'Accept Emergency'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={Boolean(permissionPromptItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setPermissionPromptItem(null)}
      >
        <View style={tw`flex-1 items-center justify-center bg-slate-950/50 px-6`}>
          <View style={tw`w-full max-w-md rounded-3xl bg-white p-5 shadow-xl`}>
            <View style={tw`h-11 w-11 items-center justify-center rounded-2xl bg-green-50`}>
              <MapPin size={21} color="#1F7A4D" />
            </View>
            <Text style={tw`mt-4 text-lg font-extrabold text-slate-900`}>Share your location while responding?</Text>
            <Text style={tw`mt-2 text-sm leading-5 text-slate-600`}>
              GeoFix 167 uses foreground location to show your route and update the incident tracking map. You can still accept and navigate manually if you skip location sharing.
            </Text>
            <Pressable
              onPress={() => void continueWithLocationChoice(permissionPromptItem, true)}
              disabled={requestingLocation || acceptingId === permissionPromptItem?.id}
              style={tw`mt-5 items-center rounded-xl bg-[#1F7A4D] py-3 ${requestingLocation ? 'opacity-60' : ''}`}
            >
              <Text style={tw`text-sm font-bold text-white`}>{requestingLocation ? 'Checking permission...' : 'Continue and share location'}</Text>
            </Pressable>
            <Pressable
              onPress={() => void continueWithLocationChoice(permissionPromptItem, false)}
              disabled={requestingLocation || acceptingId === permissionPromptItem?.id}
              style={tw`mt-2 items-center rounded-xl border border-slate-200 bg-white py-3`}
            >
              <Text style={tw`text-sm font-bold text-slate-700`}>Skip location and open map</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
