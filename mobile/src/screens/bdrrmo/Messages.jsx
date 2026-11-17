import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, MessageCircle, Send, Shield, Siren } from 'lucide-react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderMessages, sendResponderMessage } from '../../services/responderMessageService';

const CHANNELS_BY_ROLE = {
  bdrrmo: [
    {
      id: 'police',
      name: 'Police',
      subtitle: 'Police support channel',
      Icon: Shield,
      color: '#2563EB',
      background: 'bg-blue-50',
    },
    {
      id: 'fire',
      name: 'BFP',
      subtitle: 'Fire response channel',
      Icon: Siren,
      color: '#DC2626',
      background: 'bg-red-50',
    },
  ],
  police: [
    {
      id: 'bdrrmo',
      name: 'BDRRMO',
      subtitle: 'BDRRMO coordination channel',
      Icon: Shield,
      color: '#1F7A4D',
      background: 'bg-green-50',
    },
  ],
  fire: [
    {
      id: 'bdrrmo',
      name: 'BDRRMO',
      subtitle: 'BDRRMO coordination channel',
      Icon: Shield,
      color: '#1F7A4D',
      background: 'bg-green-50',
    },
  ],
};

const QUICK_MESSAGES = [
  'Support request sent under the incident ID.',
  'Please confirm responder acceptance and ETA.',
  'Share your route and on-scene findings.',
];

export default function Messages() {
  const { user } = useAuth();
  const role = String(user?.role || 'bdrrmo').toLowerCase();
  const channels = CHANNELS_BY_ROLE[role] || CHANNELS_BY_ROLE.bdrrmo;
  const [selectedId, setSelectedId] = useState(channels[0].id);
  const [messagesByChannel, setMessagesByChannel] = useState(
    Object.fromEntries(channels.map((channel) => [channel.id, []])),
  );
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedId) || channels[0],
    [channels, selectedId],
  );
  const messages = messagesByChannel[selectedChannel.id] || [];

  useEffect(() => {
    let active = true;

    const loadMessages = () => getResponderMessages(selectedChannel.id)
      .then((loadedMessages) => {
        if (!active) return;
        setError('');
        setMessagesByChannel((current) => ({
          ...current,
          [selectedChannel.id]: loadedMessages.map((item) => ({
            id: item.id,
            from: item.sender_name || item.sender_role,
            text: item.body,
            mine: item.sender_role === role,
          })),
        }));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    loadMessages();
    const refreshTimer = setInterval(loadMessages, 4000);

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, [role, selectedChannel.id]);

  const sendMessage = async (text = message) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    try {
      setSending(true);
      setError('');
      const sent = await sendResponderMessage(selectedChannel.id, trimmed);
      setMessagesByChannel((current) => ({
        ...current,
        [selectedChannel.id]: [
          ...(current[selectedChannel.id] || []),
          { id: sent.id, from: role === 'fire' ? 'BFP' : role === 'police' ? 'Police' : 'BDRRMO', text: sent.body, mine: true },
        ],
      }));
      setMessage('');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={tw`flex-1 px-5 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Messages</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Coordinate incident response with {role === 'bdrrmo' ? 'Police and BFP' : 'BDRRMO'}.
      </Text>

      <View style={tw`mt-5 flex-row gap-2`}>
        {channels.map(({ id, name, Icon, color, background }) => {
          const selected = id === selectedChannel.id;

          return (
            <Pressable
              key={id}
              onPress={() => setSelectedId(id)}
              style={selected ? tw`flex-1 rounded-2xl bg-white p-3` : tw`flex-1 rounded-2xl bg-slate-100 p-3`}
            >
              <View style={tw`flex-row items-center`}>
                <View style={tw`h-9 w-9 items-center justify-center rounded-xl ${background}`}>
                  <Icon size={18} color={color} />
                </View>
                <Text style={tw`ml-2 text-sm font-bold text-slate-900`}>{name}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={tw`mt-4 flex-1 rounded-2xl bg-white p-4`}>
        <View style={tw`flex-row items-center border-b border-slate-100 pb-3`}>
          <View style={tw`flex-1`}>
            <Text style={tw`text-sm font-bold text-slate-900`}>{selectedChannel.name}</Text>
            <Text style={tw`mt-0.5 text-xs text-slate-500`}>{selectedChannel.subtitle}</Text>
          </View>
          <MessageCircle size={18} color={selectedChannel.color} />
        </View>

        <ScrollView style={tw`flex-1 py-3`} contentContainerStyle={tw`gap-2`}>
          {messages.length === 0 ? (
            <Text style={tw`text-sm text-slate-500`}>No messages in this channel yet.</Text>
          ) : messages.map((item) => (
            <View
              key={item.id}
              style={
                item.mine
                  ? tw`max-w-[85%] self-end rounded-2xl rounded-br-sm bg-[#0B2E22] px-3 py-2`
                  : tw`max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2`
              }
            >
              <Text style={item.mine ? tw`text-[10px] font-bold text-green-200` : tw`text-[10px] font-bold text-slate-500`}>
                {item.from}
              </Text>
              <Text style={item.mine ? tw`mt-1 text-sm text-white` : tw`mt-1 text-sm text-slate-800`}>
                {item.text}
              </Text>
              {item.mine ? <CheckCheck size={13} color="#BBF7D0" style={tw`mt-1 self-end`} /> : null}
            </View>
          ))}
        </ScrollView>

        <View style={tw`border-t border-slate-100 pt-3`}>
          {error ? <Text style={tw`mb-2 text-xs text-red-600`}>{error}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={tw`flex-row gap-2`}>
              {QUICK_MESSAGES.map((quickMessage) => (
                <Pressable
                  key={quickMessage}
                  onPress={() => sendMessage(quickMessage)}
                  style={tw`rounded-full bg-green-50 px-3 py-2`}
                >
                  <Text style={tw`text-[10px] font-semibold text-[#1F7A4D]`}>Quick message</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={tw`mt-3 flex-row items-center rounded-xl border border-slate-200 px-3`}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={`Message ${selectedChannel.name}`}
              placeholderTextColor="#94A3B8"
              style={tw`min-h-10 flex-1 text-sm text-slate-800`}
              multiline
            />
            <Pressable
              onPress={() => sendMessage()}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={`Send message to ${selectedChannel.name}`}
              style={({ pressed }) => [tw`p-2`, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Send size={18} color="#1F7A4D" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
