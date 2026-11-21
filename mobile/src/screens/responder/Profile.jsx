import { ShieldCheck, UserRound } from 'lucide-react-native';
import { Text, View } from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';

export default function ResponderProfile() {
  const { user } = useAuth();

  return (
    <View style={tw`flex-1 px-5 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Profile</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Your responder account information.
      </Text>

      <View style={tw`mt-6 items-center rounded-2xl bg-white p-6`}>
        <View style={tw`h-16 w-16 items-center justify-center rounded-full bg-green-50`}>
          <UserRound size={30} color="#1F7A4D" />
        </View>
        <Text style={tw`mt-4 text-lg font-bold text-slate-900`}>
          {user?.full_name || 'Responder'}
        </Text>
        <View style={tw`mt-2 flex-row items-center rounded-full bg-green-50 px-3 py-1`}>
          <ShieldCheck size={14} color="#1F7A4D" />
          <Text style={tw`ml-1.5 text-xs font-semibold text-[#1F7A4D]`}>
            Responder
          </Text>
        </View>
      </View>
    </View>
  );
}
