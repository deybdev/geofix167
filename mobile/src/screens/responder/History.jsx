import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';

export default function History() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getResponderDispatches('COMPLETED')
      .then((dispatches) => {
        if (active) setHistory(dispatches);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={tw`px-5 pb-6 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>History</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Completed incidents for {String(user?.role || 'your team').toUpperCase()}.
      </Text>

      {error ? <Text style={tw`mt-4 text-xs text-red-600`}>{error}</Text> : null}
      {history.length === 0 ? (
        <View style={tw`mt-6 items-center rounded-2xl bg-white px-6 py-8`}>
          <CheckCircle2 size={24} color="#1F7A4D" />
          <Text style={tw`mt-4 text-base font-bold text-slate-900`}>No completed incidents</Text>
          <Text style={tw`mt-2 text-center text-sm text-slate-500`}>
            Completed BDRRMO dispatches will appear here.
          </Text>
        </View>
      ) : (
        <View style={tw`mt-6 gap-3`}>
          {history.map((response) => (
            <View
              key={response.id}
              style={tw`flex-row items-center rounded-2xl bg-white p-4`}
            >
              <View style={tw`h-11 w-11 items-center justify-center rounded-xl bg-green-50`}>
                <CheckCircle2 size={22} color="#1F7A4D" />
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
                  Completed
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
