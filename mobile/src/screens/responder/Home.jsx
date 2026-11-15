import { View, Text } from 'react-native';
import { Clock, ShieldCheck } from 'lucide-react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';

export default function ResponderHome() {
  const { user } = useAuth();

  return (
    <View style={tw`flex-1 px-5 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Home</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Welcome, {user?.full_name || 'Responder'}.
      </Text>

      <View style={tw`mt-6 rounded-2xl bg-white p-5`}>
        <View style={tw`h-12 w-12 items-center justify-center rounded-xl bg-green-50`}>
          <ShieldCheck size={24} color="#1F7A4D" />
        </View>
        <Text style={tw`mt-4 text-lg font-bold text-slate-900`}>
          Responder home
        </Text>
        <Text style={tw`mt-1 text-sm leading-5 text-slate-500`}>
          This is your starting screen. Active assignments and response tools can be added here later.
        </Text>
      </View>

      <View style={tw`mt-4 flex-row items-center rounded-2xl border border-slate-200 bg-white p-4`}>
        <Clock size={20} color="#64748B" />
        <View style={tw`ml-3 flex-1`}>
          <Text style={tw`text-sm font-semibold text-slate-800`}>No active assignments</Text>
          <Text style={tw`mt-0.5 text-xs text-slate-500`}>
            New response tasks will appear here.
          </Text>
        </View>
      </View>
    </View>
  );
}
