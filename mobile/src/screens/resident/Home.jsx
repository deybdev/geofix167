import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  FileText,
  ChevronRight,
  Megaphone,
  Calendar,
  Plus,
  AlertCircle,
  Maximize2,
  Phone,
} from 'lucide-react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import {
  getPublicMapFeed,
  getReports,
  summarizeReports,
  getAnnouncements,
} from '../../services/residentService';

/* -----------------------------------------
   CONSTANTS
------------------------------------------ */

const ROUTES = {
  map: 'Map',
  myReports: 'MyReports',
  report: 'Report',
};

const HOTLINE = '668-338-3141';
const MAP_PREVIEW_HEIGHT = 210;
const READ_MORE_THRESHOLD = 120;

const STAT_CARDS = [
  { key: 'total', label: 'Total Reports', status: undefined, primary: true },
  { key: 'submitted', label: 'Submitted', status: 'submitted' },
  { key: 'in_progress', label: 'In Progress', status: 'in_progress' },
  { key: 'resolved', label: 'Resolved', status: 'resolved' },
];

const STATUS_META = {
  submitted: {
    label: 'Submitted',
    background: '#f1f5f9',
    color: '#334155',
    dot: '#94a3b8',
  },
  under_review: {
    label: 'Under Review',
    background: '#dbeafe',
    color: '#1d4ed8',
    dot: '#3b82f6',
  },
  assigned: {
    label: 'Assigned',
    background: '#f3e8ff',
    color: '#7e22ce',
    dot: '#a855f7',
  },
  in_progress: {
    label: 'In Progress',
    background: '#fef3c7',
    color: '#b45309',
    dot: '#f59e0b',
  },
  resolved: {
    label: 'Resolved',
    background: '#dcfce7',
    color: '#15803d',
    dot: '#22c55e',
  },
};

const CATEGORY_LABELS = {
  fire: 'Fire',
  medical: 'Medical',
  crime: 'Crime or Threat',
  accident: 'Road Accident',
  flood: 'Flood or Storm',
  road: 'Road Damage',
  streetlight: 'Streetlight',
  drainage: 'Drainage',
  garbage: 'Garbage',
  utilities: 'Water / Electricity',
  other: 'Other',
};

const ANN_CATEGORY_COLORS = {
  'Clean & Green': { background: '#d1fae5', color: '#065f46' },
  'BDRRMO Advisory': { background: '#fef3c7', color: '#92400e' },
  'Health & Safety': { background: '#dbeafe', color: '#1e40af' },
  General: { background: '#f1f5f9', color: '#334155' },
};

/* -----------------------------------------
   HELPERS
------------------------------------------ */

function formatDate(date) {
  if (!date) return '—';

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getReportTitle(report) {
  return (
    report.title ||
    CATEGORY_LABELS[report.category] ||
    report.category ||
    'Incident Report'
  );
}

/* -----------------------------------------
   SHARED UI
------------------------------------------ */

function SectionHeader({ title, icon: Icon, action, onAction, children }) {
  return (
    <View style={tw`mb-3 flex-row items-center justify-between`}>
      <View style={tw`flex-row items-center`}>
        {Icon && (
          <View
            style={tw`mr-2 h-8 w-8 items-center justify-center rounded-lg bg-emerald-50`}
          >
            <Icon size={16} color="#2E8B57" />
          </View>
        )}

        <Text style={tw`text-base font-bold text-slate-900`}>{title}</Text>
      </View>

      {action ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          style={tw`flex-row items-center`}
        >
          <Text style={tw`text-xs font-semibold text-green-700`}>{action}</Text>
          <ChevronRight size={15} color="#2E8B57" />
        </Pressable>
      ) : (
        children
      )}
    </View>
  );
}

function LoadingState({ label }) {
  return (
    <View style={tw`items-center py-6`}>
      <ActivityIndicator size="small" color="#2E8B57" />
      <Text style={tw`mt-2 text-xs text-slate-400`}>{label}</Text>
    </View>
  );
}

/* -----------------------------------------
   STAT CARD
------------------------------------------ */

function StatCard({ label, value, primary = false, loading = false, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 0}`}
      style={({ pressed }) => [
        tw`rounded-2xl p-4`,
        {
          minHeight: 95,
          backgroundColor: primary ? '#2E8B57' : '#ffffff',
          borderWidth: primary ? 0 : 1,
          borderColor: '#f1f5f9',
          elevation: primary ? 4 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <View
          style={[
            tw`h-7 w-10 rounded-md`,
            { backgroundColor: primary ? '#65a982' : '#e2e8f0' },
          ]}
        />
      ) : (
        <Text
          style={[
            tw`text-2xl font-extrabold`,
            { color: primary ? '#ffffff' : '#0f172a' },
          ]}
        >
          {value ?? 0}
        </Text>
      )}

      <Text
        style={[
          tw`mt-1 text-xs font-medium`,
          { color: primary ? '#dcfce7' : '#64748b' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* -----------------------------------------
   REPORT CARD
------------------------------------------ */

function ReportCard({ report }) {
  const status = STATUS_META[report.status] || STATUS_META.submitted;

  const reportId = report.public_id
    ? `#${String(report.public_id).slice(-8).toUpperCase()}`
    : '#REPORT';

  return (
    <View
      style={[
        tw`flex-row items-start rounded-xl border border-slate-100 bg-white p-3`,
        { elevation: 1 },
      ]}
    >
      {report.photo_url ? (
        <Image
          source={{ uri: report.photo_url }}
          resizeMode="cover"
          style={tw`h-14 w-14 rounded-lg`}
        />
      ) : (
        <View
          style={tw`h-14 w-14 items-center justify-center rounded-lg bg-slate-100`}
        >
          <FileText size={23} color="#94a3b8" />
        </View>
      )}

      <View style={tw`ml-3 flex-1`}>
        <View style={tw`flex-row items-center justify-between`}>
          <Text style={tw`text-[10px] font-semibold text-slate-400`}>
            {reportId}
          </Text>

          <View
            style={[
              tw`flex-row items-center rounded-full px-2 py-1`,
              { backgroundColor: status.background },
            ]}
          >
            <View
              style={[
                tw`mr-1 h-1.5 w-1.5 rounded-full`,
                { backgroundColor: status.dot },
              ]}
            />
            <Text style={[tw`text-[10px] font-bold`, { color: status.color }]}>
              {report.status_label || status.label}
            </Text>
          </View>
        </View>

        <Text
          numberOfLines={1}
          style={tw`mt-1 text-sm font-semibold text-slate-800`}
        >
          {getReportTitle(report)}
        </Text>

        <Text
          numberOfLines={2}
          style={tw`mt-0.5 text-xs leading-4 text-slate-500`}
        >
          {report.description || 'No description provided.'}
        </Text>

        <Text numberOfLines={1} style={tw`mt-1 text-[10px] text-slate-400`}>
          {report.address || '—'} · {formatDate(report.created_at)}
        </Text>
      </View>
    </View>
  );
}

/* -----------------------------------------
   ANNOUNCEMENT CARD
------------------------------------------ */

function AnnouncementCard({ ann }) {
  const [expanded, setExpanded] = useState(false);

  const categoryStyle =
    ANN_CATEGORY_COLORS[ann.category] || ANN_CATEGORY_COLORS.General;

  const isLong = (ann.content?.length ?? 0) > READ_MORE_THRESHOLD;

  return (
    <View
      style={[
        tw`rounded-xl border border-slate-100 bg-white p-4`,
        { elevation: 1 },
      ]}
    >
      <View style={tw`mb-2 flex-row items-center justify-between`}>
        <View
          style={[
            tw`rounded px-2 py-1`,
            { backgroundColor: categoryStyle.background },
          ]}
        >
          <Text style={[tw`text-[10px] font-bold`, { color: categoryStyle.color }]}>
            {ann.category || 'General'}
          </Text>
        </View>

        <View style={tw`flex-row items-center`}>
          <Calendar size={11} color="#94a3b8" />
          <Text style={tw`ml-1 text-[10px] font-medium text-slate-400`}>
            {formatDate(ann.published_at)}
          </Text>
        </View>
      </View>

      <Text style={tw`text-sm font-bold leading-5 text-slate-900`}>
        {ann.title}
      </Text>

      <Text
        numberOfLines={expanded ? undefined : 3}
        style={tw`mt-1 text-xs leading-5 text-slate-600`}
      >
        {ann.content}
      </Text>

      {isLong && (
        <Pressable
          onPress={() => setExpanded((previous) => !previous)}
          hitSlop={8}
          accessibilityRole="button"
          style={tw`mt-2 self-start`}
        >
          <Text style={tw`text-[11px] font-semibold text-green-700`}>
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/* -----------------------------------------
   HOME SCREEN
------------------------------------------ */

export default function Home() {
  const navigation = useNavigation();
  const mounted = useRef(true);

  const [stats, setStats] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [activeEmergencyReport, setActiveEmergencyReport] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [mapError, setMapError] = useState(false);
  const mapRequest = useRef(null);

  const loadMap = useCallback(async () => {
    mapRequest.current?.abort();
    const request = new AbortController();
    mapRequest.current = request;
    try {
      const pins = await getPublicMapFeed({ signal: request.signal });
      if (request.signal.aborted) return;
      setIncidents(pins);
      setMapError(false);
    } catch {
      if (!request.signal.aborted) setMapError(true);
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  /* -----------------------------------------
     LOAD DASHBOARD DATA
  ------------------------------------------ */

  const loadDashboard = useCallback(async () => {
    const [reportsResult, announcementsResult] =
      await Promise.allSettled([
        getReports(),
        getAnnouncements(),
      ]);

    if (!mounted.current) return;

    if (reportsResult.status === 'fulfilled') {
      const reports = reportsResult.value.data?.reports ?? [];
      setStats(summarizeReports(reports));
      setRecentReports(reports.slice(0, 3));
      setActiveEmergencyReport(
        reports.find((report) => report.report_type === 'emergency' && !report.is_terminal) || null
      );
      setError(null);
    } else {
      setError('Could not load reports.');
    }

    if (announcementsResult.status === 'fulfilled') {
      setAnnouncements(announcementsResult.value.data?.announcements ?? []);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      void loadMap();
      loadDashboard();

      return () => {
        mounted.current = false;
        mapRequest.current?.abort();
      };
    }, [loadDashboard, loadMap])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadMap()]);
    if (mounted.current) setRefreshing(false);
  };

  /* -----------------------------------------
     NAVIGATION
  ------------------------------------------ */

  const openReports = (status) =>
    navigation.navigate(ROUTES.myReports, status ? { status } : undefined);

  const openMap = () => navigation.navigate(ROUTES.map);
  const openEmergencyTrack = () => {
    if (!activeEmergencyReport) return;

    const priority = {
      Critical: 1,
      High: 2,
      Moderate: 3,
      Low: 4,
    }[activeEmergencyReport.urgency] ?? null;
    const location =
      Number.isFinite(activeEmergencyReport.latitude) &&
      Number.isFinite(activeEmergencyReport.longitude)
        ? {
            lat: activeEmergencyReport.latitude,
            lng: activeEmergencyReport.longitude,
          }
        : null;

    navigation.navigate('Track', {
      reportId: activeEmergencyReport.public_id,
      location,
      priority,
    });
  };

  return (
    <ScrollView
      style={tw`flex-1 bg-slate-50`}
      contentContainerStyle={tw`mx-auto w-full max-w-lg px-4 pt-4 pb-30`}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#2E8B57"
          colors={['#2E8B57']}
        />
      }
    >
      {activeEmergencyReport && (
        <Pressable
          onPress={openEmergencyTrack}
          accessibilityRole="button"
          accessibilityLabel="Continue tracking your ongoing emergency report"
          style={({ pressed }) => [
            tw`mb-4 rounded-2xl border border-red-200 bg-red-50 p-4`,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={tw`flex-row items-center`}>
            <View style={tw`mr-3 h-11 w-11 items-center justify-center rounded-xl bg-red-100`}>
              <AlertCircle size={22} color="#DC2626" />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-xs font-extrabold uppercase text-red-700`}>
                Ongoing emergency
              </Text>
              <Text numberOfLines={1} style={tw`mt-0.5 text-sm font-bold text-slate-900`}>
                {getReportTitle(activeEmergencyReport)}
              </Text>
              <Text numberOfLines={1} style={tw`mt-0.5 text-xs text-red-700`}>
                {activeEmergencyReport.status_label || 'Report received'} · Tap to track
              </Text>
            </View>
            <ChevronRight size={20} color="#B91C1C" />
          </View>
        </Pressable>
      )}

      {/* MAP PREVIEW — non-interactive; tapping anywhere opens the full map */}
      <View
        style={[
          tw`mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white`,
          { height: MAP_PREVIEW_HEIGHT, elevation: 2 },
        ]}
      >
        <View pointerEvents="none">
          <MapViewer
            variant="picker"
            incidents={incidents}
            mapHeight={MAP_PREVIEW_HEIGHT}
            compact
          />
        </View>

        {/* Keep the touch target above the native map, including the label. */}
        <Pressable
          onPress={openMap}
          accessibilityRole="button"
          accessibilityLabel="Open full map"
          style={tw`absolute inset-0`}
        >
          <View
            pointerEvents="none"
            style={[
              tw`absolute right-3 top-3 flex-row items-center rounded-xl bg-white px-3 py-2`,
              { elevation: 4 },
            ]}
          >
            <Maximize2 size={14} color="#334155" />
            <Text style={tw`ml-1.5 text-xs font-semibold text-slate-700`}>
              Open map
            </Text>
          </View>
        </Pressable>
        {mapError && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading map pins"
            onPress={loadMap}
            style={tw`absolute bottom-2 left-2 rounded-lg bg-white px-3 py-2`}
          >
            <Text style={tw`text-xs text-slate-700`}>Couldn’t load map pins. Retry</Text>
          </Pressable>
        )}
      </View>

      {/* REPORT OVERVIEW */}
      <View style={tw`mb-6`}>
        <SectionHeader title="My Report Overview" />

        {error && (
          <View style={tw`mb-3 flex-row items-center rounded-xl bg-red-50 p-3`}>
            <AlertCircle size={15} color="#dc2626" />
            <Text style={tw`ml-2 flex-1 text-xs text-red-600`}>{error}</Text>
          </View>
        )}

        <View style={tw`-mx-1.5 flex-row flex-wrap`}>
          {STAT_CARDS.map(({ key, label, status, primary }) => (
            <View key={key} style={tw`w-1/2 p-1.5`}>
              <StatCard
                label={label}
                value={stats?.[key]}
                primary={primary}
                loading={loading}
                onPress={() => openReports(status)}
              />
            </View>
          ))}
        </View>
      </View>

      {/* RECENT REPORTS */}
      <View style={tw`mb-6`}>
        <SectionHeader
          title="Recent Reports"
          action="View All"
          onAction={() => openReports()}
        />

        {loading && <LoadingState label="Loading reports..." />}

        {!loading && recentReports.length === 0 && (
          <View
            style={tw`items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8`}
          >
            <View
              style={tw`mb-3 h-12 w-12 items-center justify-center rounded-full bg-slate-100`}
            >
              <FileText size={24} color="#94a3b8" />
            </View>

            <Text style={tw`text-sm font-semibold text-slate-700`}>
              No reports yet
            </Text>
            <Text style={tw`mt-1 text-xs text-slate-500`}>
              Submit your first report to get started.
            </Text>

            <Pressable
              onPress={() => navigation.navigate(ROUTES.report)}
              accessibilityRole="button"
              style={tw`mt-4 flex-row items-center rounded-lg bg-green-700 px-4 py-2.5`}
            >
              <Plus size={14} color="#ffffff" />
              <Text style={tw`ml-1 text-xs font-semibold text-white`}>
                Submit a Report
              </Text>
            </Pressable>
          </View>
        )}

        {!loading && recentReports.length > 0 && (
          <View style={tw`gap-3`}>
            {recentReports.map((report) => (
              <ReportCard key={report.public_id} report={report} />
            ))}
          </View>
        )}
      </View>

      {/* ANNOUNCEMENTS */}
      <View style={tw`mb-5`}>
        <SectionHeader title="Announcements" icon={Megaphone}>
          <View
            style={tw`flex-row items-center rounded-full bg-emerald-50 px-2 py-1`}
          >
            <View style={tw`mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500`} />
            <Text style={tw`text-[10px] font-semibold text-emerald-700`}>
              Live Feed
            </Text>
          </View>
        </SectionHeader>

        {loading && <LoadingState label="Loading announcements..." />}

        {!loading && announcements.length === 0 && (
          <View style={tw`rounded-xl bg-white px-4 py-6`}>
            <Text style={tw`text-center text-sm text-slate-500`}>
              No announcements at this time.
            </Text>
          </View>
        )}

        {!loading && announcements.length > 0 && (
          <View style={tw`gap-3`}>
            {announcements.map((ann) => (
              <AnnouncementCard key={ann.public_id} ann={ann} />
            ))}
          </View>
        )}
      </View>

      {/* HOTLINE */}
      <Pressable
        onPress={() => Linking.openURL(`tel:${HOTLINE.replace(/-/g, '')}`)}
        accessibilityRole="button"
        accessibilityLabel={`Call Barangay Hall hotline ${HOTLINE}`}
        style={tw`flex-row items-center justify-center self-center py-2`}
      >
        <Phone size={12} color="#94a3b8" />
        <Text style={tw`ml-1.5 text-[11px] text-slate-400`}>
          Barangay Hall Hotline: {HOTLINE}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
