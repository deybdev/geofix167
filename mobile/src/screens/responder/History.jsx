import { CheckCircle2, Clock3 } from 'lucide-react-native';
import { Text, View } from 'react-native';
import tw from 'twrnc';

const SAMPLE_RESPONSES = [
  { id: 'sample-1', title: 'Community assistance', status: 'Completed' },
  { id: 'sample-2', title: 'Safety check', status: 'Completed' },
];

export default function History() {
  return (
    <View style={tw`flex-1 px-5 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>History</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        A sample list of your recent response activity.
      </Text>

      <View style={tw`mt-6 gap-3`}>
        {SAMPLE_RESPONSES.map((response) => (
          <View
            key={response.id}
            style={tw`flex-row items-center rounded-2xl bg-white p-4`}
          >
            <View style={tw`h-11 w-11 items-center justify-center rounded-xl bg-green-50`}>
              <CheckCircle2 size={22} color="#1F7A4D" />
            </View>
            <View style={tw`ml-3 flex-1`}>
              <Text style={tw`text-sm font-bold text-slate-900`}>
                {response.title}
              </Text>
              <View style={tw`mt-1 flex-row items-center`}>
                <Clock3 size={13} color="#64748B" />
                <Text style={tw`ml-1 text-xs text-slate-500`}>
                  Sample activity · {response.status}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
