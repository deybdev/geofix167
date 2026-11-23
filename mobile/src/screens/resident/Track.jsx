import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageCircle,
  Navigation,
  Phone,
  Radio,
  Send,
  ShieldCheck,
} from 'lucide-react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import { getIncidentMessages, sendIncidentMessage } from '../../services/responderMessageService';
import { subscribeToTracking } from '../../services/residentTracking';

/* -----------------------------------------
   CONSTANTS
------------------------------------------ */

const COLORS = {
  primary: '#2E8B57',
  emergency: '#DC2626',
  emergencyDark: '#991B1B',
  emergencyTint: '#FEF2F2',
  surface: '#F8FAFC',
  border: '#E2E8F0',
  accent: '#F59E0B',
};

const HOTLINE = '668-338-3141';
const NATIONAL_EMERGENCY = '911';
const STALE_MS = 30000; // responder position older than this is flagged
const MAX_MESSAGE = 300;


const STATUS_STEPS = [
  { key: 'received', label: 'Report received', hint: 'The barangay has your report.' },
  { key: 'validated', label: 'Validated by captain', hint: 'Your report was checked.' },
  { key: 'dispatched', label: 'Responder assigned', hint: 'Someone is being sent to you.' },
  { key: 'on_the_way', label: 'Responder on the way', hint: 'Track them live on the map.' },
  { key: 'arrived', label: 'Responder arrived', hint: 'Help is at your location.' },
];

const PRIORITY_STYLE = {
  1: { label: 'Priority 1 · Immediate', bg: '#FEF2F2', fg: '#991B1B' },
  2: { label: 'Priority 2 · Urgent', bg: '#FFF7ED', fg: '#9A3412' },
  3: { label: 'Priority 3 · Normal', bg: '#FEFCE8', fg: '#854D0E' },
  4: { label: 'Priority 4 · Low', bg: '#EFF6FF', fg: '#1E40AF' },
};

// MapViewer falls back to demo incidents when it receives none. A single
// invalid-coordinate entry stops that fallback and is itself never drawn.
const NO_MAP_INCIDENTS = [{ id: 'none', lat: NaN, lng: NaN }];

const callNumber = (number) => Linking.openURL(`tel:${String(number).replace(/[^\d+]/g, '')}`);

/* -----------------------------------------
   HELPERS
------------------------------------------ */

function distanceMeters(a, b) {
  if (!a || !b) return null;

  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

const formatDistance = (meters) =>
  meters == null ? '—' : meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

const formatClock = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

/* -----------------------------------------
   ROAD ROUTING
   ----------------------------------------
   Draws the real road route (not a straight line) from the responder to the
   incident. Uses the public OSRM demo server, which is fine for development and
   testing. For production, point ROUTING_BASE_URL at your own OSRM instance, or
   swap requestRoadRoute() for Google Directions / Mapbox / OpenRouteService.
   Only this function needs to change; the screen just needs
   { points: [{lat,lng}], distance (m), duration (s) }.
------------------------------------------ */

const ROUTING_BASE_URL = 'https://router.project-osrm.org';
const ROUTING_PROFILE = 'driving';
const ROUTE_TIMEOUT_MS = 8000;
const OFF_ROUTE_METERS = 60; // responder this far from the route => re-route
const REROUTE_MIN_MS = 10000; // never re-route more often than this
const ROUTE_RETRY_MS = 15000; // wait this long after a failed route request

const routeCache = new Map();

async function requestRoadRoute(from, to) {
  const url =
    `${ROUTING_BASE_URL}/route/v1/${ROUTING_PROFILE}/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    '?overview=full&geometries=geojson&alternatives=false&steps=false';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Routing failed (${response.status})`);

    const data = await response.json();
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;

    if (data?.code !== 'Ok' || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('No route found');
    }

    return {
      points: coordinates.map(([lng, lat]) => ({ lat, lng })),
      distance: route.distance,
      duration: route.duration,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Resolves to { points, distance, duration }. Identical requests share one
// in-flight/cached promise unless `force` is set (used when re-routing).
function fetchRoadRoute(from, to, { force = false } = {}) {
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;

  if (!force && routeCache.has(key)) return routeCache.get(key);

  const promise = requestRoadRoute(from, to);
  routeCache.set(key, promise);
  promise.catch(() => routeCache.delete(key));

  if (routeCache.size > 20) routeCache.delete(routeCache.keys().next().value);

  return promise;
}

// Closest point on a polyline: { distance (m), index of segment start, point {lat,lng} }.
function projectOnPath(point, points) {
  if (!point || !points?.length) return { distance: Infinity, index: 0, point: null };

  const cosLat = Math.cos((point.lat * Math.PI) / 180);
  const toXY = (p) => ({
    x: (p.lng - point.lng) * cosLat * 111320,
    y: (p.lat - point.lat) * 110540,
  });

  let best = { distance: Infinity, index: 0, point: null };

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = toXY(points[i]);
    const b = toXY(points[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSq));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const distance = Math.hypot(cx, cy);

    if (distance < best.distance) {
      best = {
        distance,
        index: i,
        point: { lat: point.lat + cy / 110540, lng: point.lng + cx / (cosLat * 111320) },
      };
    }
  }

  return best;
}

// Compass bearing (0-360°) from a to b.
function bearingDeg(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function pathLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += distanceMeters(points[i], points[i + 1]) || 0;
  }
  return total;
}

// Two opposite corners of the route's bounding box (used to frame the route).
function boundsCorners(points) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  return [
    { lat: Math.min(...lats), lng: Math.min(...lngs) },
    { lat: Math.max(...lats), lng: Math.max(...lngs) },
  ];
}

/* -----------------------------------------
   SMALL COMPONENTS
------------------------------------------ */

const SHEET_SHADOW = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.18,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: -6 },
  elevation: 18,
};

function PulseDot({ color, size = 10 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View
      style={{ width: size * 2.4, height: size * 2.4, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

function getHeadline(report, responder, arrived, etaMinutes) {
  if (report.status === 'loading') return { title: 'Loading tracking...', sub: 'Checking the latest report status.', tone: 'wait' };
  if (report.status === 'unavailable') return { title: 'Tracking unavailable', sub: 'This report is missing, unavailable, or you do not have access.', tone: 'wait' };
  if (report.status === 'closure_review') return { title: 'Awaiting closure review', sub: 'The report is still active pending final review.', tone: 'wait' };
  if (report.status === 'inactive') return { title: report.status_label || 'Report closed', sub: 'Active emergency tracking has ended.', tone: 'wait' };
  if (report.status === 'resolved') {
    return { title: 'Emergency resolved', sub: 'Thank you for reporting.', tone: 'good' };
  }
  if (arrived) {
    return { title: 'Responder arrived', sub: 'Help is at your location.', tone: 'good' };
  }
  if (report.status === 'on_the_way') {
    return {
      title: etaMinutes
        ? `Responder on the way · ${etaMinutes} min`
        : 'Responder on the way',
      sub: 'Following their location live on the map.',
      tone: 'live',
    };
  }
  if (report.status === 'dispatched') {
    return {
      title: 'Responder assigned',
      sub: responder ? `${responder.name} is getting ready to head out.` : 'A responder has been assigned.',
      tone: 'live',
    };
  }
  if (report.status === 'validated') {
    return { title: 'Report validated', sub: 'The barangay is assigning a responder.', tone: 'wait' };
  }
  return { title: 'Report received', sub: 'Waiting for the captain to validate it.', tone: 'wait' };
}

function Stat({ icon: Icon, label, value }) {
  return (
    <View style={[tw`mr-2 flex-1 rounded-2xl px-3 py-2.5`, { backgroundColor: COLORS.surface }]}>
      <View style={tw`flex-row items-center`}>
        <Icon size={12} color="#64748B" />
        <Text style={tw`ml-1 text-[10px] font-bold uppercase text-slate-400`}>{label}</Text>
      </View>
      <Text style={tw`mt-0.5 text-base font-extrabold text-slate-900`}>{value}</Text>
    </View>
  );
}

function Segmented({ value, onChange, tabs }) {
  return (
    <View style={[tw`flex-row rounded-2xl p-1`, { backgroundColor: '#F1F5F9' }]}>
      {tabs.map((tab) => {
        const active = tab.key === value;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              tw`flex-1 flex-row items-center justify-center rounded-xl py-2.5`,
              active && {
                backgroundColor: '#FFFFFF',
                shadowColor: '#0F172A',
                shadowOpacity: 0.08,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                tw`text-xs font-bold`,
                { color: active ? '#0F172A' : '#64748B' },
              ]}
            >
              {tab.label}
            </Text>

            {tab.badge > 0 && (
              <View
                style={[
                  tw`ml-1.5 h-4 min-w-4 items-center justify-center rounded-full px-1`,
                  { backgroundColor: COLORS.emergency },
                ]}
              >
                <Text style={tw`text-[10px] font-extrabold text-white`}>{tab.badge}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function ProgressList({ currentIndex }) {
  return (
    <View style={tw`pt-1`}>
      {STATUS_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const last = index === STATUS_STEPS.length - 1;

        return (
          <View key={step.key} style={tw`flex-row`}>
            <View style={tw`mr-3 items-center`}>
              <View
                style={[
                  tw`h-6 w-6 items-center justify-center rounded-full`,
                  {
                    backgroundColor: done ? COLORS.primary : current ? COLORS.emergency : '#FFFFFF',
                    borderWidth: done || current ? 0 : 2,
                    borderColor: COLORS.border,
                  },
                ]}
              >
                {done ? (
                  <Check size={13} color="#FFFFFF" strokeWidth={3} />
                ) : current ? (
                  <View style={tw`h-2 w-2 rounded-full bg-white`} />
                ) : null}
              </View>

              {!last && (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 16,
                    backgroundColor: done ? COLORS.primary : COLORS.border,
                  }}
                />
              )}
            </View>

            <View style={tw`flex-1 pb-3`}>
              <Text
                style={[
                  tw`text-sm`,
                  {
                    fontWeight: current ? '800' : '600',
                    color: done || current ? '#0F172A' : '#94A3B8',
                  },
                ]}
              >
                {step.label}
              </Text>
              {current && <Text style={tw`mt-0.5 text-xs text-slate-500`}>{step.hint}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function EmergencyCallRow() {
  return (
    <View style={tw`mt-3 flex-row`}>
      <Pressable
        onPress={() => callNumber(HOTLINE)}
        accessibilityRole="button"
        accessibilityLabel={`Call Barangay Hall hotline ${HOTLINE}`}
        style={({ pressed }) => [
          tw`mr-2 h-12 flex-1 flex-row items-center justify-center rounded-2xl`,
          { backgroundColor: COLORS.emergency, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Phone size={15} color="#FFFFFF" />
        <Text style={tw`ml-2 text-xs font-extrabold text-white`}>Barangay {HOTLINE}</Text>
      </Pressable>

      <Pressable
        onPress={() => callNumber(NATIONAL_EMERGENCY)}
        accessibilityRole="button"
        accessibilityLabel={`Call ${NATIONAL_EMERGENCY}`}
        style={({ pressed }) => [
          tw`h-12 flex-row items-center justify-center rounded-2xl px-6`,
          {
            backgroundColor: '#FFFFFF',
            borderWidth: 1.5,
            borderColor: COLORS.emergency,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Phone size={15} color={COLORS.emergency} />
        <Text style={[tw`ml-2 text-xs font-extrabold`, { color: COLORS.emergency }]}>
          {NATIONAL_EMERGENCY}
        </Text>
      </Pressable>
    </View>
  );
}

function MessageBubble({ message, onRetry }) {
  const mine = message.from === 'resident';

  if (message.from === 'system') {
    return <Text style={tw`my-1 text-center text-[11px] text-slate-400`}>{message.text}</Text>;
  }

  return (
    <View style={[tw`mb-2 max-w-[82%]`, mine ? tw`self-end` : tw`self-start`]}>
      {!mine && message.senderLabel ? (
        <Text style={tw`mb-0.5 ml-1 text-[10px] font-bold text-slate-500`}>
          {message.senderLabel}
        </Text>
      ) : null}
      <View
        style={[
          tw`rounded-2xl px-3.5 py-2.5`,
          mine
            ? { backgroundColor: COLORS.primary, borderBottomRightRadius: 6 }
            : { backgroundColor: '#F1F5F9', borderBottomLeftRadius: 6 },
        ]}
      >
        <Text style={[tw`text-sm leading-5`, { color: mine ? '#FFFFFF' : '#0F172A' }]}>
          {message.text}
        </Text>
      </View>

      {message.state === 'failed' ? (
        <Pressable onPress={() => onRetry(message)} hitSlop={8}>
          <Text style={tw`mt-0.5 self-end text-[10px] font-bold text-red-600`}>
            Not sent · Tap to retry
          </Text>
        </Pressable>
      ) : (
        <Text
          style={[tw`mt-0.5 text-[10px] text-slate-400`, mine ? tw`self-end` : tw`self-start`]}
        >
          {message.state === 'sending' ? 'Sending…' : formatClock(message.at)}
        </Text>
      )}
    </View>
  );
}

/* -----------------------------------------
   EMERGENCY TRACKING SCREEN
   ----------------------------------------
   Takes `reportId` as a prop, or `route.params.reportId` (React Navigation).
   With expo-router, read it with useLocalSearchParams() and pass it in.
------------------------------------------ */

export default function Track({ reportId: reportIdProp, route }) {
  const value = reportIdProp ?? route?.params?.reportId;
  const reportId = typeof value === 'string' ? value.trim() : '';
  return <TrackingSession key={reportId} reportId={reportId} />;
}

function TrackingSession({ reportId }) {

  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const chatScrollRef = useRef(null);
  const inputRef = useRef(null);
  const pagerRef = useRef(null);
  const [pagerWidth, setPagerWidth] = useState(0);

  const [report, setReport] = useState({
    id: reportId,
    status: 'loading',
    priority: null,
    location: null,
  });
  const [responder, setResponder] = useState(null);
  const [dispatchedUnits, setDispatchedUnits] = useState([]);
  const [roadRoute, setRoadRoute] = useState([]); // route pushed by the backend (optional)
  const [routeInfo, setRouteInfo] = useState(null); // route we fetched: { points, distance, duration }
  const [fitPoints, setFitPoints] = useState(null); // camera framing, set only a couple of times

  const routeInfoRef = useRef(null);
  const routeFetchingRef = useRef(false);
  const lastRouteFetchRef = useRef(0);
  const routeSessionRef = useRef(0);
  const fitStageRef = useRef(0); // 0 = not framed, 1 = framed on both points, 2 = framed on route
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState('progress'); // 'progress' | 'messages'
  const [seenCount, setSeenCount] = useState(0);

  /* ---------- realtime subscription ---------- */

  useEffect(() => {
    let cancelled = false;
    let hasReport = false;
    const unsubscribe = subscribeToTracking(
      reportId,
      {
        onReport: (patch) => {
          hasReport = true;
          setError(null);
          setReport((current) => ({ ...current, ...patch }));
        },
        onUnavailable: () => {
          hasReport = false;
          setReport({ id: reportId, status: 'unavailable', location: null, priority: null });
          setResponder(null);
          setDispatchedUnits([]);
          setMessages([]);
          setRouteInfo(null);
          setRoadRoute([]);
          setFitPoints(null);
          routeSessionRef.current += 1;
        },
        onResponder: (next) => setResponder(next),
        onResponders: (list) => setDispatchedUnits(Array.isArray(list) ? list : []),
        onRoute: (points) => {
          if (!Array.isArray(points)) return;
          setRoadRoute(
            points.filter(
              (point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
            )
          );
        },
        onMessage: (message) =>
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message]
          ),
        onError: (err) => setError(err?.message || 'Could not connect to live tracking.'),
      }
    );

    const pollMessages = () => {
      if (cancelled || !hasReport) return;
      getIncidentMessages(reportId)
        .then((loaded) => {
          if (cancelled || !hasReport) return;
          setMessages(
            loaded.map((item) => {
              const role = String(item.sender_role || '').toLowerCase();
              const roleBadge =
                role === 'bdrrmo'
                  ? 'BDRRMO Dispatcher'
                  : role === 'admin'
                    ? 'Barangay Dispatcher'
                    : role === 'fire'
                      ? 'BFP Fire Unit'
                      : role === 'police'
                        ? 'PNP Police Unit'
                        : role === 'tanod'
                          ? 'Barangay Tanod'
                          : 'Responder';
              return {
                id: item.id,
                from: role === 'resident' ? 'resident' : 'responder',
                senderLabel: item.sender_name ? `${item.sender_name} • ${roleBadge}` : roleBadge,
                text: item.body,
                at: Date.parse(item.sent_at) || Date.now(),
                state: 'sent',
              };
            }),
          );
        })
        .catch(() => {});
    };

    pollMessages();
    const messageTimer = setInterval(pollMessages, 4000);

    return () => {
      cancelled = true;
      routeSessionRef.current += 1;
      clearInterval(messageTimer);
      unsubscribe();
    };
  }, [reportId]);

  // Re-render periodically so "updated Xs ago" and the stale warning stay true.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  /* ---------- derived state ---------- */

  const resolved = report.status === 'resolved';
  const stepIndex = resolved || report.status === 'closure_review'
    ? STATUS_STEPS.length
    : Math.max(
        STATUS_STEPS.findIndex((step) => step.key === report.status),
        -1
      );
  const arrived = report.status === 'arrived';

  const distance = useMemo(
    () => distanceMeters(responder?.location, report.location),
    [responder?.location, report.location]
  );

  const secondsAgo = responder?.location?.updatedAt
    ? Math.max(0, Math.round((now - responder.location.updatedAt) / 1000))
    : 0;
  const stale = !!responder && !arrived && secondsAgo * 1000 > STALE_MS;

  const mapIncidents = useMemo(() => {
    if (!report.location) return NO_MAP_INCIDENTS;
    return [
      {
        id: 'incident',
        category: 'emergency',
        title: 'Your report',
        status: report.status,
        lat: report.location.lat,
        lng: report.location.lng,
      },
    ];
  }, [report.location, report.status]);

  const routeFromBackend = roadRoute.length > 1;
  const responderLat = responder?.location?.lat;
  const responderLng = responder?.location?.lng;
  const hasResponderPoint = Number.isFinite(responderLat) && Number.isFinite(responderLng);

  useEffect(() => {
    routeInfoRef.current = routeInfo;
  }, [routeInfo]);

  // Fetch the real road route once the responder has a position, and again only
  // if they drift well off it. GPS ticks alone never trigger a request.
  useEffect(() => {
    if (routeFromBackend || report.status !== 'on_the_way' || !report.location || !hasResponderPoint) return;
    if (routeFetchingRef.current) return;

    const here = { lat: responderLat, lng: responderLng };
    const current = routeInfoRef.current;
    const since = Date.now() - lastRouteFetchRef.current;

    if (current) {
      if (since < REROUTE_MIN_MS) return;
      if (projectOnPath(here, current.points).distance <= OFF_ROUTE_METERS) return;
    } else if (since < ROUTE_RETRY_MS) {
      return;
    }

    const session = routeSessionRef.current;
    routeFetchingRef.current = true;
    lastRouteFetchRef.current = Date.now();

    fetchRoadRoute(here, report.location, { force: !!current })
      .then((info) => {
        if (routeSessionRef.current === session) setRouteInfo(info);
      })
      .catch(() => {})
      .finally(() => {
        if (routeSessionRef.current === session) routeFetchingRef.current = false;
      });
  }, [routeFromBackend, report.status, report.location, hasResponderPoint, responderLat, responderLng]);

  const baseRoute = routeFromBackend ? roadRoute : routeInfo?.points;

  // Responder position snapped onto the road (only when close to it), so the
  // marker never floats beside the route line.
  const snapped = useMemo(() => {
    if (!hasResponderPoint) return null;

    const here = { lat: responderLat, lng: responderLng };
    if (arrived || !baseRoute || baseRoute.length < 2) return { position: here, rest: [] };

    const { index, distance: offRoad, point } = projectOnPath(here, baseRoute);
    const position = point && offRoad <= OFF_ROUTE_METERS ? point : here;

    return { position, rest: baseRoute.slice(index + 1) };
  }, [arrived, baseRoute, hasResponderPoint, responderLat, responderLng]);

  // The line drawn on the map: from the responder's current position to the incident.
  const displayRoute = useMemo(() => {
    if (report.status !== 'on_the_way') return [];
    if (!baseRoute || baseRoute.length < 2) return [];
    if (!snapped) return baseRoute;
    return snapped.rest.length ? [snapped.position, ...snapped.rest] : [];
  }, [report.status, baseRoute, snapped]);

  // Heading follows the road ahead (ignoring tiny segments so it doesn't jitter).
  const heading = useMemo(() => {
    if (displayRoute.length < 2) return null;
    const next = displayRoute.slice(1).find((p) => distanceMeters(displayRoute[0], p) > 8);
    return next ? Math.round(bearingDeg(displayRoute[0], next)) : null;
  }, [displayRoute]);

  const trackerLat = snapped?.position?.lat;
  const trackerLng = snapped?.position?.lng;
  const trackerValid = Number.isFinite(trackerLat) && Number.isFinite(trackerLng);
  const responderId = responder?.id || 'responder';
  const responderName = responder?.name;

  // Plot ALL dispatched responders with live GPS (supports 2+ multi-responder units simultaneously)
  const responderTrackers = useMemo(() => {
    const extraTrackers = dispatchedUnits
      .filter((u) => u.id !== responderId && u.location && Number.isFinite(u.location.lat) && Number.isFinite(u.location.lng))
      .map((u) => ({
        id: u.id,
        lat: u.location.lat,
        lng: u.location.lng,
        color: u.roleCode === 'fire' ? '#DC2626' : u.roleCode === 'police' ? '#1D4ED8' : COLORS.primary,
        heading: u.location.heading,
        rotation: u.location.heading,
        label: u.name,
        type: 'responder',
        stale: false,
      }));

    const leadTracker = trackerValid
      ? [
          {
            id: responderId,
            lat: trackerLat,
            lng: trackerLng,
            color: stale ? COLORS.accent : COLORS.primary,
            heading,
            rotation: heading,
            label: responderName,
            type: 'responder',
            stale,
          },
        ]
      : [];

    return [...leadTracker, ...extraTrackers];
  }, [trackerValid, trackerLat, trackerLng, heading, stale, responderId, responderName, dispatchedUnits]);

  const trackingRoutes = useMemo(
    () =>
      displayRoute.length > 1
        ? [{ id: 'responder-route', points: displayRoute, color: COLORS.primary, dashed: false }]
        : [],
    [displayRoute]
  );

  // Remaining distance along the road, and an ETA derived from it when the
  // backend doesn't send one.
  const roadDistance = displayRoute.length > 1 ? pathLength(displayRoute) : null;
  const etaMinutes =
    responder?.etaMinutes ??
    (routeInfo && !routeFromBackend && roadDistance != null && routeInfo.distance > 0
      ? Math.max(1, Math.round((routeInfo.duration * (roadDistance / routeInfo.distance)) / 60))
      : null);

  // Frame the map at most twice: once when the responder first appears, and once
  // when their route arrives. After that the camera is never moved for GPS
  // updates, so it can't keep zooming back while the responder drives.
  useEffect(() => {
    if (fitStageRef.current !== 0 || !report.location || !hasResponderPoint) return;

    fitStageRef.current = 1;
    setFitPoints([report.location, { lat: responderLat, lng: responderLng }]);
  }, [report.location, hasResponderPoint, responderLat, responderLng]);

  useEffect(() => {
    if (fitStageRef.current !== 1 || !routeInfo?.points?.length) return;

    fitStageRef.current = 2;
    setFitPoints(boundsCorners(routeInfo.points));
  }, [routeInfo]);

  const priority = PRIORITY_STYLE[report.priority];
  const headline = getHeadline(report, responder, arrived, etaMinutes);
  const headlineColor =
    headline.tone === 'good' ? COLORS.primary : stale ? COLORS.accent : COLORS.emergency;

  const unread = messages.slice(seenCount).filter((m) => m.from !== 'resident').length;
  const contentMax = Math.min(340, windowHeight * 0.38);

  /* ---------- messaging ---------- */

  const deliver = useCallback(
    async (id, text) => {
      try {
        const saved = await sendIncidentMessage(reportId, text);
        setMessages((current) =>
          current.map((m) => (m.id === id ? { ...m, id: saved.id, state: 'sent' } : m)),
        );
      } catch {
        setMessages((current) => current.map((m) => (m.id === id ? { ...m, state: 'failed' } : m)));
      }
    },
    [reportId]
  );

  const send = () => {
    const text = draft.trim();
    if (!text || !chatAvailable) return;

    const id = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id, from: 'resident', text, at: Date.now(), state: 'sending' },
    ]);
    setDraft('');
    deliver(id, text);
  };

  const retry = (message) => {
    setMessages((current) =>
      current.map((m) => (m.id === message.id ? { ...m, state: 'sending' } : m))
    );
    deliver(message.id, message.text);
  };

  const openChat = () => {
    setExpanded(true);
    setTab('messages');
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  // Residents can always message the BDRRMO Dispatcher or assigned responders during an emergency.
  const chatAvailable = !['loading', 'unavailable'].includes(report.status);
  const activeTab = tab;

  // Keep the pager on the selected tab (tap on the tab bar, or openChat()).
  useEffect(() => {
    if (!expanded || !chatAvailable || !pagerWidth) return;
    pagerRef.current?.scrollTo({ x: tab === 'messages' ? pagerWidth : 0, animated: true });
  }, [expanded, chatAvailable, pagerWidth, tab]);

  const onPagerEnd = (event) => {
    if (!pagerWidth) return;
    const page = Math.round(event.nativeEvent.contentOffset.x / pagerWidth);
    setTab(page === 1 ? 'messages' : 'progress');
    if (page === 0) Keyboard.dismiss();
  };

  // Mark messages as seen while the chat is on screen, and keep it scrolled down.
  useEffect(() => {
    if (expanded && tab === 'messages') {
      setSeenCount(messages.length);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [expanded, tab, messages.length]);

  /* ---------- render ---------- */

  return (
    <View style={tw`flex-1 bg-slate-100`}>
      <MapViewer
        incidents={mapIncidents}
        routes={trackingRoutes}
        trackers={responderTrackers}
        fitPoints={fitPoints}
        bottomInset={220}
        showBackButton={false}
        showBoundary={false}
        hideMapLabel
      />

      {/* FLOATING TITLE CARD */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: insets.top + 10, left: 72, right: 72 }}
      >
        <View
          style={[
            tw`flex-row items-center rounded-2xl px-3.5 py-2.5`,
            {
              backgroundColor: 'rgba(255,255,255,0.96)',
              shadowColor: '#0F172A',
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 6,
            },
          ]}
        >
          <View style={tw`flex-1`}>
            <Text numberOfLines={1} style={tw`text-sm font-extrabold text-slate-900`}>
              Emergency Tracking
            </Text>
            <Text numberOfLines={1} style={tw`mt-0.5 text-[11px] text-slate-500`}>
              {reportId ? `Report #${reportId.slice(-6).toUpperCase()}` : 'No report selected'}
            </Text>
          </View>

          {priority && (
            <View style={[tw`ml-2 rounded-full px-2.5 py-1`, { backgroundColor: priority.bg }]}>
              <Text style={[tw`text-[10px] font-extrabold`, { color: priority.fg }]}>
                {priority.label.split(' · ')[0]}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* BOTTOM SHEET */}
      <KeyboardAvoidingView
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          justifyContent: 'flex-end',
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            {
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: insets.bottom + 12,
            },
            SHEET_SHADOW,
          ]}
        >
          {/* handle */}
          <Pressable
            onPress={() => setExpanded((value) => !value)}
            hitSlop={{ top: 8, bottom: 8, left: 40, right: 40 }}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse details' : 'Expand details'}
            style={tw`items-center pb-1 pt-2.5`}
          >
            <View style={tw`h-1 w-10 rounded-full bg-slate-300`} />
          </Pressable>

          {/* SUMMARY (always visible) */}
          <View style={tw`px-4 pt-2`}>
            <View style={tw`flex-row items-center`}>
              <PulseDot color={headlineColor} />
              <View style={tw`ml-2 flex-1`}>
                <Text style={tw`text-base font-extrabold text-slate-900`}>{headline.title}</Text>
                <Text style={tw`mt-0.5 text-xs leading-4 text-slate-500`}>{headline.sub}</Text>
              </View>
            </View>

            {error && (
              <View style={tw`mt-3 rounded-xl bg-red-50 p-3`}>
                <Text accessibilityRole="alert" style={tw`text-xs text-red-700`}>{error}</Text>
              </View>
            )}

            {/* no responder yet */}
            {!responder && !resolved && (
              <View style={[tw`mt-3 rounded-2xl p-3.5`, { backgroundColor: COLORS.emergencyTint }]}>
                <Text style={[tw`text-xs font-bold`, { color: COLORS.emergencyDark }]}>
                  In immediate danger? Don’t wait, call now.
                </Text>
                <EmergencyCallRow />

                <Pressable
                  disabled={!chatAvailable}
                  onPress={openChat}
                  accessibilityRole="button"
                  accessibilityLabel="Message BDRRMO Dispatcher"
                  style={({ pressed }) => [
                    tw`mt-2.5 h-11 flex-row items-center justify-center rounded-2xl bg-white`,
                    {
                      borderWidth: 1.5,
                      borderColor: COLORS.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <MessageCircle size={16} color={COLORS.primary} />
                  <Text style={[tw`ml-2 text-xs font-extrabold`, { color: COLORS.primary }]}>
                    Message BDRRMO / Dispatcher
                  </Text>
                  {unread > 0 && (
                    <View
                      style={[
                        tw`ml-2 h-5 min-w-5 items-center justify-center rounded-full px-1`,
                        { backgroundColor: COLORS.emergency },
                      ]}
                    >
                      <Text style={tw`text-[11px] font-extrabold text-white`}>{unread}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            )}

            {resolved && (
              <View
                style={[tw`mt-3 flex-row items-center rounded-2xl p-3.5`, { backgroundColor: '#ECFDF5' }]}
              >
                <ShieldCheck size={20} color={COLORS.primary} />
                <Text style={tw`ml-3 flex-1 text-xs font-bold leading-4 text-emerald-900`}>
                  The barangay marked this report as resolved.
                </Text>
              </View>
            )}

            {/* responder assigned */}
            {responder && (
              <View style={tw`mt-3`}>
                <View style={tw`flex-row items-center`}>
                  <View
                    style={[
                      tw`h-12 w-12 items-center justify-center rounded-full`,
                      { backgroundColor: COLORS.emergencyTint },
                    ]}
                  >
                    <Text style={[tw`text-base font-extrabold`, { color: COLORS.emergencyDark }]}>
                      {initials(responder.name)}
                    </Text>
                  </View>

                  <View style={tw`ml-3 flex-1`}>
                    <Text numberOfLines={1} style={tw`text-sm font-extrabold text-slate-900`}>
                      {responder.name}
                    </Text>
                    <Text numberOfLines={1} style={tw`mt-0.5 text-xs text-slate-500`}>
                      {responder.role}
                    </Text>
                  </View>

                  {!arrived && (
                    <View
                      style={[
                        tw`flex-row items-center rounded-full px-2.5 py-1`,
                        { backgroundColor: stale ? '#FFFBEB' : '#ECFDF5' },
                      ]}
                    >
                      <PulseDot color={stale ? COLORS.accent : COLORS.primary} size={6} />
                      <Text
                        style={[
                          tw`ml-1 text-[11px] font-bold`,
                          { color: stale ? '#B45309' : '#047857' },
                        ]}
                      >
                        {!responder.location ? 'No GPS' : stale ? 'Not updating' : 'Live'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={tw`mt-3 flex-row`}>
                  <Stat
                    icon={Clock}
                    label="ETA"
                    value={responder.status === 'ON_SCENE' ? 'Arrived' : report.status === 'on_the_way' && etaMinutes ? `${etaMinutes} min` : '—'}
                  />
                  <Stat
                    icon={Navigation}
                    label="Distance"
                    value={formatDistance(roadDistance ?? distance)}
                  />
                  <View style={[tw`flex-1 rounded-2xl px-3 py-2.5`, { backgroundColor: COLORS.surface }]}>
                    <View style={tw`flex-row items-center`}>
                      <Radio size={12} color="#64748B" />
                      <Text style={tw`ml-1 text-[10px] font-bold uppercase text-slate-400`}>
                        Updated
                      </Text>
                    </View>
                    <Text
                      style={[
                        tw`mt-0.5 text-base font-extrabold`,
                        { color: stale ? '#B45309' : '#0F172A' },
                      ]}
                    >
                      {!responder.location?.updatedAt ? '—' : secondsAgo < 5 ? 'Now' : `${secondsAgo}s`}
                    </Text>
                  </View>
                </View>

                {dispatchedUnits.length > 1 && (
                  <View style={tw`mt-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-2.5`}>
                    <Text style={tw`text-[10px] font-extrabold uppercase text-slate-500`}>
                      Dispatched Responders ({dispatchedUnits.length} Units)
                    </Text>
                    <View style={tw`mt-1.5 gap-1.5`}>
                      {dispatchedUnits.map((unit) => (
                        <View key={unit.id} style={tw`flex-row items-center justify-between`}>
                          <Text style={tw`text-xs font-bold text-slate-800`}>{unit.name}</Text>
                          <Text style={tw`text-[10px] font-extrabold text-[#1F7A4D]`}>
                            {unit.status} {unit.location ? '• Live GPS' : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {stale && (
                  <View
                    style={[tw`mt-3 flex-row items-start rounded-xl p-3`, { backgroundColor: '#FFFBEB' }]}
                  >
                    <AlertTriangle size={14} color={COLORS.accent} style={tw`mt-0.5`} />
                    <Text style={tw`ml-2 flex-1 text-xs leading-4 text-amber-800`}>
                      Location hasn’t updated in a while. Try calling the responder.
                    </Text>
                  </View>
                )}

                <View style={tw`mt-3 flex-row`}>
                  <Pressable
                    onPress={() => callNumber(responder.phone)}
                    disabled={!responder.phone}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${responder.name}`}
                    style={({ pressed }) => [
                      tw`mr-3 h-12 flex-1 flex-row items-center justify-center rounded-2xl`,
                      {
                        backgroundColor: COLORS.primary,
                        opacity: !responder.phone ? 0.4 : pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Phone size={17} color="#FFFFFF" />
                    <Text style={tw`ml-2 text-sm font-extrabold text-white`}>Call</Text>
                  </Pressable>

                  <Pressable
                    onPress={openChat}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${responder.name}`}
                    style={({ pressed }) => [
                      tw`h-12 flex-1 flex-row items-center justify-center rounded-2xl`,
                      {
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: COLORS.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <MessageCircle size={17} color={COLORS.primary} />
                    <Text style={[tw`ml-2 text-sm font-extrabold`, { color: COLORS.primary }]}>
                      Message
                    </Text>
                    {unread > 0 && (
                      <View
                        style={[
                          tw`ml-2 h-5 min-w-5 items-center justify-center rounded-full px-1`,
                          { backgroundColor: COLORS.emergency },
                        ]}
                      >
                        <Text style={tw`text-[11px] font-extrabold text-white`}>{unread}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* expand / collapse */}
            <Pressable
              onPress={() => setExpanded((value) => !value)}
              accessibilityRole="button"
              style={tw`mt-3 flex-row items-center justify-center py-1.5`}
            >
              <Text style={tw`text-xs font-bold text-slate-500`}>
                {expanded ? 'Hide details' : chatAvailable ? 'Progress & messages' : 'Report progress'}
              </Text>
              {expanded ? (
                <ChevronDown size={15} color="#64748B" style={tw`ml-1`} />
              ) : (
                <ChevronUp size={15} color="#64748B" style={tw`ml-1`} />
              )}
            </Pressable>
          </View>

          {/* EXPANDED DETAILS */}
          {expanded && (
            <View style={tw`px-4 pt-1`}>
              {chatAvailable && (
                <View style={tw`mb-3`}>
                  <Segmented
                    value={activeTab}
                    onChange={setTab}
                    tabs={[
                      { key: 'progress', label: 'Progress', badge: 0 },
                      { key: 'messages', label: 'Messages', badge: unread },
                    ]}
                  />
                </View>
              )}

              <View
                onLayout={(e) => setPagerWidth(Math.round(e.nativeEvent.layout.width))}
                style={{ height: contentMax }}
              >
                {!chatAvailable ? (
                  <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    <ProgressList currentIndex={stepIndex} />
                  </ScrollView>
                ) : (
                  pagerWidth > 0 && (
                    <ScrollView
                      ref={pagerRef}
                      horizontal
                      pagingEnabled
                      bounces={false}
                      nestedScrollEnabled
                      directionalLockEnabled
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      scrollEventThrottle={16}
                      onMomentumScrollEnd={onPagerEnd}
                      contentOffset={{ x: tab === 'messages' ? pagerWidth : 0, y: 0 }}
                    >
                      {/* Page 1: progress */}
                      <View style={{ width: pagerWidth, height: contentMax }}>
                        <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                          <ProgressList currentIndex={stepIndex} />
                        </ScrollView>
                      </View>

                      {/* Page 2: messages */}
                      <View style={{ width: pagerWidth, height: contentMax }}>
                        <ScrollView
                          ref={chatScrollRef}
                          style={{ flex: 1 }}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={false}
                          nestedScrollEnabled
                        >
                          {messages.length === 0 ? (
                            <Text style={tw`py-6 text-center text-xs leading-4 text-slate-400`}>
                              No messages yet. Message the BDRRMO Dispatcher or assigned responder directly here.
                            </Text>
                          ) : (
                            messages.map((message) => (
                              <MessageBubble key={message.id} message={message} onRetry={retry} />
                            ))
                          )}
                        </ScrollView>

                        <View style={tw`mt-2 flex-row items-end`}>
                          <TextInput
                            ref={inputRef}
                            value={draft}
                            onChangeText={setDraft}
                            placeholder="Type a message…"
                            placeholderTextColor="#94A3B8"
                            multiline
                            maxLength={MAX_MESSAGE}
                            style={[
                              tw`mr-2 flex-1 rounded-2xl px-4 py-3 text-sm text-slate-800`,
                              {
                                maxHeight: 96,
                                backgroundColor: COLORS.surface,
                                borderWidth: 1.5,
                                borderColor: COLORS.border,
                              },
                            ]}
                          />

                          <Pressable
                            onPress={send}
                            disabled={!draft.trim()}
                            accessibilityRole="button"
                            accessibilityLabel="Send message"
                            style={({ pressed }) => [
                              tw`h-12 w-12 items-center justify-center rounded-2xl`,
                              {
                                backgroundColor: COLORS.primary,
                                opacity: !draft.trim() ? 0.4 : pressed ? 0.8 : 1,
                              },
                            ]}
                          >
                            <Send size={18} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      </View>
                    </ScrollView>
                  )
                )}
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
