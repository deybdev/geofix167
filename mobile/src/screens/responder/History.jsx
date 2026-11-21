import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, Clock3, Wrench } from 'lucide-react-native';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';

export default function History() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

<<<<<<< HEAD
  useEffect(() => {
    let active = true;
    getResponderDispatches('COMPLETED', user?.role)
      .then((dispatches) => {
        if (active) setHistory(dispatches);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
    };
  }, [user]);
=======
  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const dispatches = await getResponderDispatches('COMPLETED');
      setHistory(dispatches);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setRefreshing(false);
    }
  }, []);
>>>>>>> e2d4c4e999643b6cbd32365d4046bb49a07a023e

  useFocusEffect(
    useCallback(() => {
      loadHistory(false);
    }, [loadHistory]),
  );

  return (
    <ScrollView
      contentContainerStyle={tw`px-5 pb-6 pt-6`}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadHistory(true)}
          colors={['#1F7A4D']}
          tintColor="#1F7A4D"
        />
      }
    >
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>History</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Completed incidents and maintenance tasks for {String(user?.role || 'your team').toUpperCase()}.
      </Text>

      {error ? <Text style={tw`mt-4 text-xs text-red-600`}>{error}</Text> : null}
      {history.length === 0 ? (
        <View style={tw`mt-6 items-center rounded-2xl bg-white px-6 py-8`}>
          <CheckCircle2 size={24} color="#1F7A4D" />
          <Text style={tw`mt-4 text-base font-bold text-slate-900`}>No completed tasks</Text>
          <Text style={tw`mt-2 text-center text-sm text-slate-500`}>
            Completed emergencies and maintenance repairs will appear here.
          </Text>
        </View>
      ) : (
        <View style={tw`mt-6 gap-3`}>
          {history.map((response) => (
            <View
              key={response.id}
              style={tw`flex-row items-center rounded-2xl border border-slate-200 bg-white p-4`}
            >
              <View style={tw`h-11 w-11 items-center justify-center rounded-xl bg-green-50`}>
                {response.is_maintenance ? (
                  <Wrench size={20} color="#1F7A4D" />
                ) : (
                  <CheckCircle2 size={22} color="#1F7A4D" />
                )}
              </View>
              <View style={tw`ml-3 flex-1`}>
                <Text style={tw`text-sm font-bold text-slate-900`}>
                  {response.incident_title}
                </Text>
                <View style={tw`mt-1 flex-row items-center`}>
                  <Clock3 size={13} color="#64748B" />
                  <Text style={tw`ml-1 text-xs text-slate-500`}>
                    {response.incident_category} · {response.incident_location || 'Location unavailable'}
                  </Text>
                </View>
                <Text style={tw`mt-1 text-xs font-semibold text-[#1F7A4D]`}>
                  {response.is_maintenance ? 'Maintenance Repair Submitted' : 'Completed'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
