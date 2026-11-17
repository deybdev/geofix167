import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import tw from 'twrnc';

import { sendResponderMessage } from '../../services/responderMessageService';

const RECIPIENTS = {
  bdrrmo: ['Police', 'BFP'],
  police: ['BDRRMO'],
  fire: ['BDRRMO'],
};

const RECIPIENT_ROLES = {
  Police: 'police',
  BFP: 'fire',
  BDRRMO: 'bdrrmo',
};

export default function ResponderMessageBar({ role }) {
  const recipients = RECIPIENTS[role] || ['BDRRMO'];
  const [recipient, setRecipient] = useState(recipients[0]);
  const [message, setMessage] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    try {
      setSending(true);
      setError('');
      await sendResponderMessage(RECIPIENT_ROLES[recipient], trimmed);
      setSentMessage(`To ${recipient}: ${trimmed}`);
      setMessage('');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={tw`mt-4 rounded-2xl bg-white p-4`}>
      <View style={tw`flex-row items-center`}>
        <MessageCircle size={18} color="#1F7A4D" />
        <Text style={tw`ml-2 text-sm font-bold text-slate-900`}>Incident message</Text>
      </View>

      <View style={tw`mt-3 flex-row gap-2`}>
        {recipients.map((item) => (
          <Pressable
            key={item}
            onPress={() => setRecipient(item)}
            style={
              recipient === item
                ? tw`rounded-full bg-green-100 px-3 py-1.5`
                : tw`rounded-full bg-slate-100 px-3 py-1.5`
            }
          >
            <Text
              style={
                recipient === item
                  ? tw`text-xs font-bold text-[#1F7A4D]`
                  : tw`text-xs font-medium text-slate-500`
              }
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={tw`mt-3 flex-row items-center rounded-xl border border-slate-200 px-3`}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={`Message ${recipient}`}
          placeholderTextColor="#94A3B8"
          style={tw`min-h-10 flex-1 text-sm text-slate-800`}
          multiline
        />
        <Pressable
          onPress={sendMessage}
          accessibilityRole="button"
          accessibilityLabel={`Send message to ${recipient}`}
          style={({ pressed }) => [tw`p-2`, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Send size={18} color="#1F7A4D" />
        </Pressable>
      </View>

      {sentMessage ? (
        <Text style={tw`mt-2 text-xs text-slate-500`}>{sentMessage}</Text>
      ) : null}
      {error ? <Text style={tw`mt-2 text-xs text-red-600`}>{error}</Text> : null}
    </View>
  );
}
