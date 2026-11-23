import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  CheckCheck,
  ChevronLeft,
  Lock,
  MessageCircle,
  Phone,
  Search,
  Send,
  Shield,
  Siren,
  Video,
  X,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';
import {
  getIncidentMessages,
  getResponderMessages,
  sendIncidentMessage,
  sendResponderMessage,
} from '../../services/responderMessageService';

const COLORS = {
  brand: '#1F7A4D',
  muted: '#94A3B8',
  disabled: '#CBD5E1',
};

const CHANNELS_BY_ROLE = {
  bdrrmo: [
    {
      id: 'police',
      name: 'Police',
      subtitle: 'Police support channel',
      Icon: Shield,
      color: '#2563EB',
    },
    {
      id: 'fire',
      name: 'BFP',
      subtitle: 'Fire response channel',
      Icon: Siren,
      color: '#DC2626',
    },
  ],
  police: [
    {
      id: 'bdrrmo',
      name: 'BDRRMO',
      subtitle: 'BDRRMO coordination channel',
      Icon: Shield,
      color: '#1F7A4D',
    },
  ],
  fire: [
    {
      id: 'bdrrmo',
      name: 'BDRRMO',
      subtitle: 'BDRRMO coordination channel',
      Icon: Shield,
      color: '#1F7A4D',
    },
  ],
  tanod: [
    {
      id: 'bdrrmo',
      name: 'BDRRMO',
      subtitle: 'BDRRMO coordination channel',
      Icon: Shield,
      color: '#1F7A4D',
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

function parseDate(value) {
  if (!value) return null;
  const str = String(value);
  const date = new Date(str.includes('T') ? str : `${str.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortTime(value) {
  const date = parseDate(value);
  if (!date) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'R';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Avatar({ name, size = 'md', muted = false }) {
  const sizes = {
    sm: { box: 'h-7 w-7', text: 'text-[10px]' },
    md: { box: 'h-10 w-10', text: 'text-xs' },
    lg: { box: 'h-13 w-13', text: 'text-sm' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <View
      style={tw`${s.box} items-center justify-center rounded-full ${muted ? 'bg-slate-100' : 'bg-green-100'
        }`}
    >
      <Text
        style={tw`${s.text} font-extrabold ${muted ? 'text-slate-500' : 'text-[#1F7A4D]'
          }`}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const role = String(user?.role || 'bdrrmo').toLowerCase();
  const isPolice = role === 'police';
  const channels = CHANNELS_BY_ROLE[role] || CHANNELS_BY_ROLE.bdrrmo;

  const [selectedId, setSelectedId] = useState(channels[0].id);
  const [policeDispatches, setPoliceDispatches] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(isPolice);
  const [latestByIncident, setLatestByIncident] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState(
    route.params?.assignment?.incident_id || null,
  );
  const [messagesByChannel, setMessagesByChannel] = useState(
    Object.fromEntries(channels.map((channel) => [channel.id, []])),
  );
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  useEffect(() => {
    if (!isPolice) return undefined;

    let active = true;

    const loadPoliceInbox = async () => {
      try {
        const dispatches = await getResponderDispatches(undefined, role);
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

        const results = await Promise.allSettled(
          uniqueByIncident.map(async (item) => {
            const msgs = await getIncidentMessages(item.incident_id);
            const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            return {
              incidentId: item.incident_id,
              count: msgs.length,
              last: last
                ? {
                  body: last.body,
                  createdAt: last.created_at || last.sent_at || null,
                  mine: last.sender_user_id === user?.id || last.sender_role === role,
                  senderName: last.sender_name || last.sender_role || '',
                }
                : null,
            };
          }),
        );

        if (!active) return;
        const nextLatest = {};
        for (const res of results) {
          if (res.status === 'fulfilled') {
            nextLatest[res.value.incidentId] = res.value;
          }
        }
        setLatestByIncident(nextLatest);
      } catch {
        // Keep existing inbox items on transient fetch errors
      } finally {
        if (active) setLoadingInbox(false);
      }
    };

    loadPoliceInbox();
    const timer = setInterval(loadPoliceInbox, 6000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isPolice, role, user?.id]);

  const sortedPoliceThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? policeDispatches.filter((item) =>
        [item.reporter_name, item.incident_title, item.incident_location]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q)),
      )
      : policeDispatches;

    return [...list].sort((a, b) => {
      const aMeta = latestByIncident[a.incident_id];
      const bMeta = latestByIncident[b.incident_id];
      const aHasMsg = Boolean(aMeta?.last);
      const bHasMsg = Boolean(bMeta?.last);

      if (aHasMsg !== bHasMsg) return aHasMsg ? -1 : 1;

      const aTime =
        parseDate(aMeta?.last?.createdAt)?.getTime() ||
        parseDate(a.dispatched_at || a.updated_at || a.created_at)?.getTime() ||
        0;
      const bTime =
        parseDate(bMeta?.last?.createdAt)?.getTime() ||
        parseDate(b.dispatched_at || b.updated_at || b.created_at)?.getTime() ||
        0;
      return bTime - aTime;
    });
  }, [policeDispatches, latestByIncident, searchQuery]);

  const activeIncident = useMemo(() => {
    if (!isPolice || !selectedIncidentId) return null;
    const fromList = policeDispatches.find((item) => item.incident_id === selectedIncidentId);
    if (fromList) return fromList;
    if (route.params?.assignment?.incident_id === selectedIncidentId) {
      return route.params.assignment;
    }
    return null;
  }, [isPolice, policeDispatches, route.params, selectedIncidentId]);

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
  const canSend = Boolean(message.trim()) && !sending;

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
            createdAt: item.created_at || item.sent_at || null,
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
      const sentTime = sent.created_at || new Date().toISOString();
      setMessagesByChannel((current) => ({
        ...current,
        [selectedChannel.id]: [
          ...(current[selectedChannel.id] || []),
          {
            id: sent.id,
            from: user?.full_name || (role === 'fire' ? 'BFP' : role === 'police' ? 'Police' : 'BDRRMO'),
            text: sent.body,
            mine: true,
            createdAt: sentTime,
          },
        ],
      }));
      if (isPolice && activeIncident?.incident_id) {
        setLatestByIncident((current) => ({
          ...current,
          [activeIncident.incident_id]: {
            incidentId: activeIncident.incident_id,
            count: (current[activeIncident.incident_id]?.count || 0) + 1,
            last: {
              body: sent.body,
              createdAt: sentTime,
              mine: true,
              senderName: user?.full_name || 'Police',
            },
          },
        }));
      }
      setMessage('');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Messenger-style Inbox (Police -> Reporters list)                         */
  /* ------------------------------------------------------------------------ */
  if (isPolice && !activeIncident) {
    return (
      <View style={tw`flex-1 bg-white`}>
        {/* Top bar */}
        <View style={tw`flex-row items-center px-4 pb-2 pt-3`}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => [
              tw`mr-3 h-9 w-9 items-center justify-center rounded-full bg-slate-100`,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ChevronLeft size={20} color="#0F172A" />
          </Pressable>
          <Text style={tw`flex-1 text-2xl font-extrabold text-slate-900`}>Messages</Text>
        </View>

        {/* Messenger search pill */}
        <View style={tw`px-4 pb-3 pt-1`}>
          <View style={tw`h-10 flex-row items-center rounded-full bg-slate-100 px-3.5`}>
            <Search size={16} color="#64748B" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search reporters or incidents"
              placeholderTextColor="#94A3B8"
              style={tw`ml-2 flex-1 text-sm text-slate-800`}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <X size={15} color="#64748B" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView style={tw`flex-1`} keyboardShouldPersistTaps="handled">
          {/* Conversation list */}
          {loadingInbox ? (
            <View style={tw`mt-12 items-center`}>
              <ActivityIndicator size="small" color={COLORS.brand} />
              <Text style={tw`mt-2 text-xs text-slate-400`}>Loading chats...</Text>
            </View>
          ) : sortedPoliceThreads.length === 0 ? (
            <View style={tw`mt-12 items-center px-8`}>
              <View style={tw`h-14 w-14 items-center justify-center rounded-full bg-green-50`}>
                <MessageCircle size={24} color={COLORS.brand} />
              </View>
              <Text style={tw`mt-3 text-base font-bold text-slate-900`}>
                {searchQuery ? 'No matching chats' : 'No reporter chats yet'}
              </Text>
              <Text style={tw`mt-1 text-center text-xs leading-5 text-slate-500`}>
                {searchQuery
                  ? 'Try searching another reporter name or incident.'
                  : 'Reporters from your dispatched emergencies will appear here.'}
              </Text>
            </View>
          ) : (
            <View style={tw`pb-6`}>
              {sortedPoliceThreads.map((item) => {
                const done = ['COMPLETED', 'DECLINED'].includes(String(item.status || '').toUpperCase());
                const meta = latestByIncident[item.incident_id];
                const lastMsg = meta?.last || null;
                const incomingLatest = Boolean(lastMsg && !lastMsg.mine && !done);
                const timeLabel = formatShortTime(
                  lastMsg?.createdAt || item.dispatched_at || item.created_at,
                );
                const reporterName = item.reporter_name || 'Resident Reporter';

                return (
                  <Pressable
                    key={item.incident_id}
                    onPress={() => {
                      setError('');
                      setSelectedIncidentId(item.incident_id);
                    }}
                    style={({ pressed }) => [
                      tw`flex-row items-center px-4 py-2.5 ${pressed ? 'bg-slate-50' : 'bg-white'}`,
                    ]}
                  >
                    <Avatar name={reporterName} size="lg" muted={done} />

                    <View style={tw`ml-3.5 flex-1`}>
                      <View style={tw`flex-row items-center justify-between gap-2`}>
                        <Text
                          numberOfLines={1}
                          style={tw`flex-1 text-[15px] ${incomingLatest ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-900'
                            }`}
                        >
                          {reporterName}
                        </Text>
                        {timeLabel ? (
                          <Text
                            style={tw`text-xs ${incomingLatest ? 'font-bold text-[#1F7A4D]' : 'text-slate-400'
                              }`}
                          >
                            {timeLabel}
                          </Text>
                        ) : null}
                      </View>

                      <View style={tw`mt-0.5 flex-row items-center gap-1.5`}>
                        <Text
                          numberOfLines={1}
                          style={tw`flex-1 text-[13px] ${incomingLatest ? 'font-bold text-slate-800' : 'text-slate-500'
                            }`}
                        >
                          {lastMsg
                            ? `${lastMsg.mine ? 'You: ' : ''}${lastMsg.body}`
                            : `No messages yet`}
                        </Text>
                        {incomingLatest ? (
                          <View style={tw`h-2.5 w-2.5 rounded-full bg-[#1F7A4D]`} />
                        ) : null}
                      </View>

                      <Text numberOfLines={1} style={tw`mt-0.5 text-[11px] text-slate-400`}>
                        {item.incident_title || 'Emergency Report'}
                        {done ? ' • Completed' : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Messenger-style Chat Thread                                              */
  /* ------------------------------------------------------------------------ */
  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-white`}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Chat Header */}
      <View style={tw`border-b border-slate-100 bg-white px-3 pb-3 pt-2.5`}>
        <View style={tw`flex-row items-center`}>
          <Pressable
            onPress={() => {
              setError('');
              if (isPolice) setSelectedIncidentId(null);
              else goBack();
            }}
            accessibilityRole="button"
            accessibilityLabel={isPolice ? 'Back to chats' : 'Go back'}
            hitSlop={8}
            style={({ pressed }) => [
              tw`mr-1.5 h-9 w-9 items-center justify-center rounded-full`,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <ChevronLeft size={24} color={COLORS.brand} />
          </Pressable>

          <Avatar
            name={selectedChannel.name}
            size="md"
            muted={isIncidentDone}
          />

          <View style={tw`ml-2.5 flex-1`}>
            <Text style={tw`text-[15px] font-bold text-slate-900`} numberOfLines={1}>
              {selectedChannel.name}
            </Text>
            <Text style={tw`text-[11px] text-slate-500`} numberOfLines={1}>
              {isPolice && isIncidentDone
                ? 'Incident completed'
                : selectedChannel.subtitle}
            </Text>
          </View>

          {isPolice ? (
            <View style={tw`ml-2 flex-row items-center gap-1`}>
              <Pressable
                onPress={() =>
                  navigation.navigate('Call', {
                    mode: 'voice',
                    recipientName: selectedChannel.name,
                    subtitle: selectedChannel.subtitle,
                    assignment: activeIncident,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Call reporter"
                hitSlop={6}
                style={({ pressed }) => [
                  tw`h-9 w-9 items-center justify-center rounded-full`,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Phone size={20} color={COLORS.brand} />
              </Pressable>
              <Pressable
                onPress={() =>
                  navigation.navigate('Call', {
                    mode: 'video',
                    recipientName: selectedChannel.name,
                    subtitle: selectedChannel.subtitle,
                    assignment: activeIncident,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Video call reporter"
                hitSlop={6}
                style={({ pressed }) => [
                  tw`h-9 w-9 items-center justify-center rounded-full`,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Video size={22} color={COLORS.brand} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {!isPolice && channels.length > 1 ? (
          <View style={tw`mt-3 flex-row rounded-full bg-slate-100 p-1`}>
            {channels.map(({ id, name, Icon, color }) => {
              const selected = id === selectedChannel.id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    setError('');
                    setSelectedId(id);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={tw`flex-1 flex-row items-center justify-center rounded-full py-1.5 ${selected ? 'bg-white shadow-sm' : ''
                    }`}
                >
                  <Icon size={14} color={selected ? color : '#64748B'} />
                  <Text
                    style={tw`ml-1.5 text-xs font-bold ${selected ? 'text-slate-900' : 'text-slate-500'
                      }`}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Messages Canvas */}
      <ScrollView
        ref={scrollRef}
        style={tw`flex-1 bg-white`}
        contentContainerStyle={tw`flex-grow px-3.5 py-4`}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={tw`flex-1 items-center justify-center px-8`}>
            <Avatar name={selectedChannel.name} size="lg" muted={isIncidentDone} />
            <Text style={tw`mt-3 text-base font-bold text-slate-900`}>
              {selectedChannel.name}
            </Text>
            <Text style={tw`mt-1 text-center text-xs leading-5 text-slate-500`}>
              {selectedChannel.subtitle}
            </Text>
            <Text style={tw`mt-3 text-center text-xs text-slate-400`}>
              Send a message or tap a quick reply below to start the conversation.
            </Text>
          </View>
        ) : messages.map((item, index) => {
          const prev = messages[index - 1];
          const next = messages[index + 1];
          const startsGroup = !prev || prev.mine !== item.mine || prev.from !== item.from;
          const endsGroup = !next || next.mine !== item.mine || next.from !== item.from;
          const isLastMessage = index === messages.length - 1;

          // Messenger-style grouped bubble corner radii
          const bubbleRadius = item.mine
            ? [
              tw`rounded-3xl`,
              !startsGroup ? tw`rounded-tr-md` : null,
              !endsGroup ? tw`rounded-br-md` : null,
            ]
            : [
              tw`rounded-3xl`,
              !startsGroup ? tw`rounded-tl-md` : null,
              !endsGroup ? tw`rounded-bl-md` : null,
            ];

          return (
            <View
              key={item.id ?? index}
              style={[
                index === 0 ? null : startsGroup ? tw`mt-3` : tw`mt-0.5`,
              ]}
            >
              {startsGroup && !item.mine ? (
                <Text style={tw`mb-1 ml-10 text-[11px] font-medium text-slate-400`}>
                  {item.from}
                </Text>
              ) : null}

              <View style={tw`flex-row items-end ${item.mine ? 'justify-end' : 'justify-start'}`}>
                {!item.mine ? (
                  <View style={tw`mr-2 w-7`}>
                    {endsGroup ? <Avatar name={item.from} size="sm" /> : null}
                  </View>
                ) : null}

                <View
                  style={[
                    tw`max-w-[76%] px-3.5 py-2.5`,
                    ...bubbleRadius,
                    item.mine ? tw`bg-[#1F7A4D]` : tw`bg-slate-100`,
                  ]}
                >
                  <Text
                    style={
                      item.mine
                        ? tw`text-[14px] leading-5 text-white`
                        : tw`text-[14px] leading-5 text-slate-900`
                    }
                  >
                    {item.text}
                  </Text>
                </View>
              </View>

              {item.mine && isLastMessage ? (
                <View style={tw`mr-1 mt-1 flex-row items-center justify-end`}>
                  <CheckCheck size={12} color={COLORS.brand} />
                  <Text style={tw`ml-1 text-[10px] font-medium text-slate-400`}>Sent</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Messenger Composer */}
      <View style={tw`border-t border-slate-100 bg-white px-3 pb-3 pt-2`}>
        {error ? (
          <View style={tw`mb-2 rounded-xl bg-red-50 px-3 py-2`}>
            <Text style={tw`text-xs font-medium text-red-700`}>{error}</Text>
          </View>
        ) : null}

        {isPolice && isIncidentDone ? (
          <View style={tw`flex-row items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-2.5`}>
            <Lock size={14} color="#64748B" />
            <Text style={tw`flex-1 text-xs font-medium text-slate-600`}>
              This incident is completed. Messaging is read-only.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={tw`gap-2 pb-2`}
            >
              {quickMessages.map((quickMessage) => (
                <Pressable
                  key={quickMessage}
                  onPress={() => sendMessage(quickMessage)}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel={`Send quick message: ${quickMessage}`}
                  style={({ pressed }) => [
                    tw`max-w-[230px] rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5`,
                    { opacity: pressed || sending ? 0.6 : 1 },
                  ]}
                >
                  <Text numberOfLines={1} style={tw`text-xs font-medium text-slate-700`}>
                    {quickMessage}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={tw`flex-row items-end gap-2`}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Aa"
                placeholderTextColor={COLORS.muted}
                style={tw`max-h-28 min-h-10 flex-1 rounded-full bg-slate-100 px-4 py-2 text-[14px] text-slate-900`}
                textAlignVertical="center"
                multiline
              />
              <Pressable
                onPress={() => sendMessage()}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={`Send message to ${selectedChannel.name}`}
                style={({ pressed }) => [
                  tw`h-10 w-10 items-center justify-center rounded-full`,
                  {
                    backgroundColor: canSend || sending ? COLORS.brand : COLORS.disabled,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={17} color="#fff" />
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
