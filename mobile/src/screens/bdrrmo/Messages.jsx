import { useEffect, useMemo, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Lock,
  MessageCircle,
  Send,
  Shield,
  Siren,
  User,
} from 'lucide-react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';
import {
  getIncidentMessages,
  getResponderMessages,
  sendIncidentMessage,
  sendResponderMessage,
} from '../../services/responderMessageService';

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
      id: 'resident',
      name: 'Resident Reporter',
      subtitle: 'Direct incident chat with reporter',
      Icon: User,
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

const POLICE_QUICK_MESSAGES = [
  'Police are on the way to your location.',
  'Please stay in a safe area while officers respond.',
  'Can you share a nearby landmark to help us locate you?',
];

export default function Messages() {
  const { user } = useAuth();
  const route = useRoute();
  const role = String(user?.role || 'bdrrmo').toLowerCase();
  const isPolice = role === 'police';
  const channels = CHANNELS_BY_ROLE[role] || CHANNELS_BY_ROLE.bdrrmo;
  const [selectedId, setSelectedId] = useState(channels[0].id);
  const [policeDispatches, setPoliceDispatches] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(
    route.params?.assignment?.incident_id || null,
  );
  const [messagesByChannel, setMessagesByChannel] = useState(
    Object.fromEntries(channels.map((channel) => [channel.id, []])),
  );
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPolice) return undefined;

    let active = true;
    getResponderDispatches(undefined, 'police')
      .then((dispatches) => {
        if (!active) return;
        const list = (Array.isArray(dispatches) ? dispatches : []).filter(
          (item) => Boolean(item?.incident_id),
        );
        const uniqueByIncident = [];
        const seen = new Set();
        for (const item of list) {
          if (!seen.has(item.incident_id)) {
            seen.add(item.incident_id);
            uniqueByIncident.push(item);
          }
        }
        setPoliceDispatches(uniqueByIncident);
      })
      .catch(() => { });

    return () => {
      active = false;
    };
  }, [isPolice]);

  const activeIncident = useMemo(() => {
    if (!isPolice || !selectedIncidentId) return null;
    const fromList = policeDispatches.find((item) => item.incident_id === selectedIncidentId);
    if (fromList) return fromList;
    if (route.params?.assignment?.incident_id === selectedIncidentId) {
      return route.params.assignment;
    }
    return null;
  }, [isPolice, policeDispatches, route.params?.assignment, selectedIncidentId]);

  const isIncidentDone = Boolean(
    activeIncident && ['COMPLETED', 'DECLINED'].includes(String(activeIncident.status || '').toUpperCase()),
  );

  const selectedChannel = useMemo(() => {
    const base = channels.find((channel) => channel.id === selectedId) || channels[0];
    if (isPolice && activeIncident) {
      return {
        ...base,
        id: activeIncident.incident_id,
        name: activeIncident.reporter_name || 'Resident Reporter',
        subtitle: activeIncident.incident_title
          ? `${activeIncident.incident_title} • ${activeIncident.incident_location || 'Barangay 167'}`
          : base.subtitle,
      };
    }
    return base;
  }, [activeIncident, channels, isPolice, selectedId]);

  const messages = messagesByChannel[selectedChannel.id] || [];
  const quickMessages = isPolice ? POLICE_QUICK_MESSAGES : QUICK_MESSAGES;

  useEffect(() => {
    if (isPolice && !activeIncident?.incident_id) return undefined;
    let active = true;

    const fetchMessages = () => (
      isPolice
        ? getIncidentMessages(activeIncident.incident_id)
        : getResponderMessages(selectedChannel.id)
    )
      .then((loadedMessages) => {
        if (!active) return;
        setError('');
        setMessagesByChannel((current) => ({
          ...current,
          [selectedChannel.id]: loadedMessages.map((item) => ({
            id: item.id,
            from: item.sender_name || item.sender_role,
            text: item.body,
            mine: item.sender_user_id === user?.id || item.sender_role === role,
          })),
        }));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    fetchMessages();
    const refreshTimer = setInterval(fetchMessages, 4000);

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, [activeIncident?.incident_id, isPolice, role, selectedChannel.id, user?.id]);

  const sendMessage = async (text = message) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (isPolice && !activeIncident?.incident_id) {
      setError('Select an incident reporter to message.');
      return;
    }
    if (isPolice && isIncidentDone) {
      setError('This incident is completed. Messaging is read-only.');
      return;
    }

    try {
      setSending(true);
      setError('');
      const sent = isPolice
        ? await sendIncidentMessage(activeIncident.incident_id, trimmed)
        : await sendResponderMessage(selectedChannel.id, trimmed);
      setMessagesByChannel((current) => ({
        ...current,
        [selectedChannel.id]: [
          ...(current[selectedChannel.id] || []),
          {
            id: sent.id,
            from: user?.full_name || (role === 'fire' ? 'BFP' : role === 'police' ? 'Police' : 'BDRRMO'),
            text: sent.body,
            mine: true,
          },
        ],
      }));
      setMessage('');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  if (isPolice && !activeIncident) {
    return (
      <View style={tw`flex-1 px-5 pt-6`}>
        <Text style={tw`text-3xl font-extrabold text-slate-900`}>Messages</Text>
        <Text style={tw`mt-1 text-sm text-slate-500`}>
          Tap a reporter to view or send incident messages.
        </Text>

        <ScrollView style={tw`mt-5 flex-1`} contentContainerStyle={tw`gap-3 pb-6`}>
          {policeDispatches.length === 0 ? (
            <View style={tw`items-center rounded-2xl bg-white px-6 py-8`}>
              <MessageCircle size={24} color="#64748B" />
              <Text style={tw`mt-3 text-base font-bold text-slate-900`}>No reporters yet</Text>
              <Text style={tw`mt-1 text-center text-xs text-slate-500`}>
                Residents from dispatched incidents will appear here.
              </Text>
            </View>
          ) : policeDispatches.map((item) => {
            const done = ['COMPLETED', 'DECLINED'].includes(String(item.status || '').toUpperCase());

            return (
              <Pressable
                key={item.incident_id}
                onPress={() => {
                  setError('');
                  setSelectedIncidentId(item.incident_id);
                }}
                style={({ pressed }) => [
                  tw`flex-row items-center rounded-2xl border border-slate-200 bg-white p-4`,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={tw`h-11 w-11 items-center justify-center rounded-full bg-green-50`}>
                  <User size={20} color="#1F7A4D" />
                </View>
                <View style={tw`ml-3 flex-1`}>
                  <View style={tw`flex-row items-center justify-between gap-2`}>
                    <Text style={tw`flex-1 text-sm font-extrabold text-slate-900`} numberOfLines={1}>
                      {item.reporter_name || 'Resident Reporter'}
                    </Text>
                    <Text
                      style={tw`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${done ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-[#1F7A4D]'
                        }`}
                    >
                      {done ? 'Done' : 'Active'}
                    </Text>
                  </View>
                  <Text style={tw`mt-0.5 text-xs font-semibold text-slate-700`} numberOfLines={1}>
                    {item.incident_title}
                  </Text>
                  <Text style={tw`mt-0.5 text-[11px] text-slate-500`} numberOfLines={1}>
                    {item.incident_location || 'Barangay 167'}
                  </Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" style={tw`ml-2`} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={tw`flex-1 px-5 pt-6`}>
      {isPolice ? (
        <View style={tw`flex-row items-center gap-2`}>
          <Pressable
            onPress={() => {
              setError('');
              setSelectedIncidentId(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to reporters list"
            style={tw`h-9 w-9 items-center justify-center rounded-full bg-slate-200`}
          >
            <ChevronLeft size={20} color="#0F172A" />
          </Pressable>
          <View style={tw`flex-1`}>
            <Text style={tw`text-2xl font-extrabold text-slate-900`} numberOfLines={1}>
              {selectedChannel.name}
            </Text>
            <Text style={tw`text-xs text-slate-500`} numberOfLines={1}>
              {selectedChannel.subtitle}
            </Text>
          </View>
        </View>
      ) : (
        <>
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
        </>
      )}

      <View style={tw`mt-4 flex-1 rounded-2xl bg-white p-4`}>
        <View style={tw`flex-row items-center border-b border-slate-100 pb-3`}>
          <View style={tw`flex-1`}>
            <Text style={tw`text-sm font-bold text-slate-900`}>{selectedChannel.name}</Text>
            <Text style={tw`mt-0.5 text-xs text-slate-500`} numberOfLines={1}>
              {selectedChannel.subtitle}
            </Text>
          </View>
          <MessageCircle size={18} color={selectedChannel.color} />
        </View>

        <ScrollView style={tw`flex-1 py-3`} contentContainerStyle={tw`gap-2`}>
          {messages.length === 0 ? (
            <Text style={tw`text-sm text-slate-500`}>No messages in this conversation yet.</Text>
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
          {isPolice && isIncidentDone ? (
            <View style={tw`flex-row items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5`}>
              <Lock size={14} color="#64748B" />
              <Text style={tw`flex-1 text-xs font-semibold text-slate-600`}>
                This incident is completed. You can read messages, but sending is disabled.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={tw`flex-row gap-2`}>
                  {quickMessages.map((quickMessage) => (
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
            </>
          )}
        </View>
      </View>
    </View>
  );
}
