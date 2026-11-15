import { ClipboardList } from 'lucide-react-native';
import { Text, View } from 'react-native';
import tw from 'twrnc';

export default function Assignments() {
  return (
    <View style={tw`flex-1 px-5 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Assignments</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Review response requests assigned to your team.
      </Text>

      <View style={tw`mt-6 items-center rounded-2xl bg-white px-6 py-8`}>
        <View style={tw`h-12 w-12 items-center justify-center rounded-xl bg-green-50`}>
          <ClipboardList size={24} color="#1F7A4D" />
        </View>
        <Text style={tw`mt-4 text-base font-bold text-slate-900`}>
          No active assignments
        </Text>
        <Text style={tw`mt-2 text-center text-sm leading-5 text-slate-500`}>
          New response tasks will appear here when they are assigned.
        </Text>
      </View>
    </View>
  );
}
