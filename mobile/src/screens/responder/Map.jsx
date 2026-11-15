import { Map } from 'lucide-react-native';
import { Text, View } from 'react-native';
import tw from 'twrnc';

export default function ResponderMap() {
  return (
    <View style={tw`flex-1 px-5 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Map</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        View locations related to your response tasks.
      </Text>

      <View style={tw`mt-6 min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6`}>
        <View style={tw`h-12 w-12 items-center justify-center rounded-xl bg-green-50`}>
          <Map size={24} color="#1F7A4D" />
        </View>
        <Text style={tw`mt-4 text-base font-bold text-slate-900`}>
          Responder map
        </Text>
        <Text style={tw`mt-2 text-center text-sm leading-5 text-slate-500`}>
          Your location and assigned incident locations will appear here when available.
        </Text>
      </View>
    </View>
  );
}
