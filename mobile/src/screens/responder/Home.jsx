import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertTriangle, CheckCircle2, Clock, MapPin } from 'lucide-react-native';
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

  async function handleAccept(item) {
    setAcceptingId(item.id);
    setError('');
    try {
      if (!item.is_guest_emergency) {
        await updateResponderDispatchStatus(item.id, 'ACCEPTED');
      }
      const acceptedItem = { ...item, status: 'ACCEPTED' };
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      navigation.navigate('Map', { assignment: acceptedItem });
    } catch (err) {
      setError(err.message);
    } finally {
      setAcceptingId(null);
    }
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
                    onPress={() => navigation.navigate('Map', { assignment: item })}
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
    </ScrollView>
  );
}
