
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';

import {
  X,
  Flame,
  ShieldAlert,
  Wrench,
  Ambulance,
  MapPin,
  ChevronDown,
  ChevronUp,
  Calendar,
  UserRound,
  Clock,
} from 'lucide-react-native';

import tw from 'twrnc';
import {
  getCategory,
  getStatus,
} from '../../utils/map/mapUtils';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const COLLAPSED_HEIGHT = 230;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.85;

const CATEGORY_ICONS = {
  fire: Flame,
  incident: Ambulance,
  crime: ShieldAlert,
  infrastructure: Wrench,
  emergency: Ambulance,
};

const TIMELINE_COLORS = {
  submitted: '#94A3B8',
  'under review': '#3B82F6',
  dispatched: '#8B5CF6',
  assigned: '#8B5CF6',
  'in progress': '#F59E0B',
  responding: '#F97316',
  resolved: '#16A34A',
  rejected: '#EF4444',
};

function formatTime(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* Animated skeleton placeholder */
function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: '#D1D5DB',
          opacity,
        },
        style,
      ]}
    />
  );
}

/* Skeleton content */
function IncidentSheetSkeleton() {
  return (
    <View style={tw`px-4 pt-2 pb-8`}>
      {/* Description */}
      <View style={tw`mb-5 gap-2`}>
        <Skeleton width="35%" height={13} />
        <Skeleton height={12} />
        <Skeleton width="85%" height={12} />
      </View>

      {/* Photo placeholder */}
      <Skeleton
        width="100%"
        height={150}
        radius={14}
        style={tw`mb-5`}
      />

      {/* Incident information */}
      <View style={tw`mb-6 gap-3`}>
        <Skeleton width="40%" height={16} />

        <View style={tw`flex-row items-center gap-3`}>
          <Skeleton width={36} height={36} radius={10} />
          <View style={tw`flex-1 gap-2`}>
            <Skeleton width="30%" height={11} />
            <Skeleton width="65%" height={13} />
          </View>
        </View>

        <View style={tw`flex-row items-center gap-3`}>
          <Skeleton width={36} height={36} radius={10} />
          <View style={tw`flex-1 gap-2`}>
            <Skeleton width="30%" height={11} />
            <Skeleton width="55%" height={13} />
          </View>
        </View>
      </View>

      {/* Timeline placeholder */}
      <View style={tw`mb-3`}>
        <Skeleton width="40%" height={16} />
      </View>

      {[1, 2, 3].map(item => (
        <View key={item} style={tw`mb-5 flex-row gap-3`}>
          <Skeleton width={12} height={12} radius={10} />
          <View style={tw`flex-1 gap-2`}>
            <Skeleton width="45%" height={12} />
            <Skeleton width="75%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

function TimelineItem({ entry, isLast }) {
  const [photoOpen, setPhotoOpen] = useState(false);

  const statusKey = String(entry.status || '').toLowerCase();
  const color = TIMELINE_COLORS[statusKey] || '#94A3B8';
  const photo = entry.photo || entry.photo_url;

  return (
    <View style={tw`flex-row`}>
      <View style={tw`mr-3 items-center`}>
        <View
          style={[
            tw`mt-1 h-3 w-3 rounded-full`,
            { backgroundColor: color },
          ]}
        />

        {!isLast && (
          <View style={tw`mt-1 min-h-12 w-px flex-1 bg-slate-200`} />
        )}
      </View>

      <View style={tw`mb-5 flex-1`}>
        <View style={tw`flex-row flex-wrap items-center`}>
          <Text style={[tw`text-xs font-bold`, { color }]}>
            {entry.status || 'Update'}
          </Text>

          {entry.time && (
            <Text style={tw`ml-2 text-[10px] text-slate-400`}>
              {formatTime(entry.time)}
            </Text>
          )}
        </View>

        {entry.note ? (
          <Text style={tw`mt-1 text-xs leading-5 text-slate-600`}>
            {entry.note}
          </Text>
        ) : null}

        {photo ? (
          <>
            <Pressable
              onPress={() => setPhotoOpen(value => !value)}
              style={tw`mt-2 flex-row items-center`}
            >
              {photoOpen ? (
                <ChevronUp size={14} color="#64748B" />
              ) : (
                <ChevronDown size={14} color="#64748B" />
              )}

              <Text style={tw`ml-1 text-[11px] font-semibold text-slate-500`}>
                {photoOpen ? 'Hide photo' : 'View photo'}
              </Text>
            </Pressable>

            {photoOpen && (
              <Image
                source={{ uri: photo }}
                resizeMode="cover"
                style={tw`mt-2 h-36 w-full max-w-[260px] rounded-xl`}
              />
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}

function DetailCard({ label, value, icon: Icon }) {
  return (
    <View style={tw`flex-1 rounded-xl bg-slate-50 p-3`}>
      <View style={tw`flex-row items-center`}>
        <Icon size={13} color="#94A3B8" />
        <Text style={tw`ml-1 text-[10px] font-medium uppercase text-slate-400`}>
          {label}
        </Text>
      </View>

      <Text
        numberOfLines={3}
        style={tw`mt-2 text-xs font-semibold leading-5 text-slate-800`}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

export default function IncidentSheet({
  incident,
  onClose,
  isLoading = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);

  const height = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const heightRef = useRef(COLLAPSED_HEIGHT);
  const expandedRef = useRef(false);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;
  expandedRef.current = expanded;

  const category = useMemo(
    () => getCategory(incident?.category),
    [incident?.category],
  );

  const status = useMemo(
    () => getStatus(incident?.status),
    [incident?.status],
  );

  const Icon = CATEGORY_ICONS[category?.key] || MapPin;

  const title = incident?.title || category?.label || 'Incident Report';

  const photo = incident?.photo || incident?.photo_url;

  const timeline = Array.isArray(incident?.timeline)
    ? incident.timeline
    : [];

  useEffect(() => {
    if (!incident) return;

    setExpanded(false);
    setClosing(false);
    heightRef.current = COLLAPSED_HEIGHT;
    height.setValue(COLLAPSED_HEIGHT);
  }, [incident?.id, height]);

  const animateHeight = toValue => {
    heightRef.current = toValue;

    Animated.spring(height, {
      toValue,
      useNativeDriver: false,
      damping: 24,
      stiffness: 180,
      mass: 0.8,
    }).start();
  };

  const expand = () => {
    setExpanded(true);
    animateHeight(EXPANDED_HEIGHT);
  };

  const collapse = () => {
    setExpanded(false);
    animateHeight(COLLAPSED_HEIGHT);
  };

  const close = () => {
    if (closing) return;

    setClosing(true);

    Animated.timing(height, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onCloseRef.current?.();
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 6,

      onPanResponderGrant: () => {
        setDragging(true);
      },

      onPanResponderMove: (_, gesture) => {
        const nextHeight = Math.max(
          COLLAPSED_HEIGHT,
          Math.min(
            EXPANDED_HEIGHT,
            heightRef.current - gesture.dy,
          ),
        );

        height.setValue(nextHeight);
      },

      onPanResponderRelease: (_, gesture) => {
        setDragging(false);

        const currentHeight = Math.max(
          COLLAPSED_HEIGHT,
          Math.min(
            EXPANDED_HEIGHT,
            heightRef.current - gesture.dy,
          ),
        );

        const movingUp = gesture.dy < -55 || gesture.vy < -0.5;
        const movingDown = gesture.dy > 55 || gesture.vy > 0.5;

        if (movingUp) {
          setExpanded(true);
          animateHeight(EXPANDED_HEIGHT);
          return;
        }

        if (movingDown) {
          if (expandedRef.current) {
            collapse();
          } else {
            close();
          }
          return;
        }

        const midpoint =
          COLLAPSED_HEIGHT +
          (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) / 2;

        if (currentHeight > midpoint) {
          setExpanded(true);
          animateHeight(EXPANDED_HEIGHT);
        } else {
          collapse();
        }
      },

      onPanResponderTerminate: () => {
        setDragging(false);
        animateHeight(
          expandedRef.current ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
        );
      },

      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  if (!incident) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        tw`absolute inset-x-0 bottom-0`,
        { zIndex: 1000 },
      ]}
    >
      <Animated.View
        style={[
          tw`overflow-hidden rounded-t-3xl bg-white`,
          {
            height,
            elevation: 20,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: -5 },
          },
        ]}
      >
        {/* Draggable header */}
        <View
          {...panResponder.panHandlers}
          style={tw`shrink-0 px-4 pb-3 pt-3`}
        >
          <View style={tw`mb-3 h-1.5 w-10 self-center rounded-full bg-slate-200`} />

          <View style={tw`flex-row items-center`}>
            {isLoading ? (
              <>
                <Skeleton width={36} height={36} radius={20} />

                <View style={tw`ml-3 flex-1 gap-2`}>
                  <Skeleton width="35%" height={10} />
                  <Skeleton width="55%" height={12} />
                </View>
              </>
            ) : (
              <>
                <View
                  style={[
                    tw`h-9 w-9 items-center justify-center rounded-full`,
                    { backgroundColor: category?.color || '#2563EB' },
                  ]}
                >
                  <Icon size={19} color="#FFFFFF" />
                </View>

                <View style={tw`ml-2 flex-1`}>
                  <Text style={tw`text-[10px] font-bold uppercase tracking-wide text-slate-500`}>
                    {category?.label || 'Incident'}
                  </Text>

                  <Text style={tw`mt-0.5 text-xs font-semibold text-slate-700`}>
                    {status?.label || 'Unknown'}
                  </Text>
                </View>
              </>
            )}

            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close incident details"
              hitSlop={10}
              style={tw`h-9 w-9 items-center justify-center rounded-full bg-slate-100`}
            >
              <X size={18} color="#64748B" />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={tw`mt-3 gap-2`}>
              <Skeleton width="75%" height={17} />
              {!expanded && <Skeleton width="90%" height={12} />}
              {!expanded && <Skeleton width="65%" height={12} />}
            </View>
          ) : (
            <>
              <Text
                numberOfLines={2}
                style={tw`mt-3 text-base font-bold text-slate-900`}
              >
                {title}
              </Text>

              {!expanded && (
                <>
                  <Text
                    numberOfLines={2}
                    style={tw`mt-1 text-xs leading-5 text-slate-500`}
                  >
                    {incident.description || 'No description provided.'}
                  </Text>

                  <Pressable
                    onPress={expand}
                    style={tw`mt-2 flex-row items-center`}
                  >
                    <Text style={tw`text-[11px] font-bold text-emerald-700`}>
                      Swipe up for full details
                    </Text>
                    <ChevronUp size={15} color="#047857" />
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>

        {/* Expanded details or loading skeleton */}
        {expanded && (
          <ScrollView
            style={tw`flex-1`}
            contentContainerStyle={tw`px-4 pb-8`}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={tw`mb-4 h-px bg-slate-100`} />

            {isLoading ? (
              <IncidentSheetSkeleton />
            ) : (
              <>
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    resizeMode="cover"
                    style={tw`mb-4 h-44 w-full rounded-2xl`}
                  />
                ) : null}

                <Text style={tw`mb-5 text-sm leading-6 text-slate-700`}>
                  {incident.description || 'No description provided.'}
                </Text>

                <View style={tw`mb-5 flex-row gap-2`}>
                  <DetailCard
                    label="Location"
                    value={incident.address || incident.landmark}
                    icon={MapPin}
                  />

                  <DetailCard
                    label="Reported by"
                    value={incident.reporter || incident.reported_by || 'Anonymous'}
                    icon={UserRound}
                  />
                </View>

                <View style={tw`mb-5 flex-row items-center`}>
                  <Calendar size={14} color="#94A3B8" />
                  <Text style={tw`ml-2 text-xs text-slate-500`}>
                    Reported: {formatTime(incident.created_at || incident.reported_at) || '—'}
                  </Text>
                </View>

                <View style={tw`mb-3 flex-row items-center justify-between`}>
                  <Text style={tw`text-xs font-bold uppercase tracking-wide text-slate-400`}>
                    Incident Timeline
                  </Text>
                  <Clock size={14} color="#94A3B8" />
                </View>

                {timeline.length === 0 ? (
                  <Text style={tw`py-3 text-xs text-slate-400`}>
                    No timeline available.
                  </Text>
                ) : (
                  <View>
                    {timeline.map((entry, index) => (
                      <TimelineItem
                        key={`${entry.status}-${entry.time}-${index}`}
                        entry={entry}
                        isLast={index === timeline.length - 1}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}
