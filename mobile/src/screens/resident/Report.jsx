import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Animated,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as Location from 'expo-location';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Construction,
  Droplets,
  Ellipsis,
  Flame,
  HeartPulse,
  Image as ImageIcon,
  Lightbulb,
  LocateFixed,
  MapPin,
  Pencil,
  Phone,
  Send,
  ShieldAlert,
  Trash2,
  Trees,
  Waves,
  Wrench,
  X,
  Zap,
} from 'lucide-react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import AnimatedSuccessBanner from '../../components/shared/SuccessBanner';
import {
  buildResidentReportPayload,
  submitReport as createReport,
  getReportAttachments,
  uploadReportAttachment,
} from '../../services/residentService';
import { prepareReportPhoto, submitResidentEvidence, pendingEvidenceMessage } from '../../utils/residentSubmission';

const BOUNDARY = require('../../../assets/map/barangay-167.json');

/* -----------------------------------------
   CONSTANTS
------------------------------------------ */

const COLORS = {
  primary: '#2E8B57',
  accent: '#F59E0B',
  surface: '#F8FAFC',
  border: '#E2E8F0',
};

const MAX_DESCRIPTION = 500;
const MAX_PHOTOS = 5;
const MAP_HEIGHT = 280;
const HOTLINE = '668-338-3141';
const NATIONAL_EMERGENCY = '911';

// Emergency reports get an extra Priority step; infrastructure skips it.
const getSteps = (type) => [
  { key: 'type', label: 'Type' },
  ...(type === 'emergency' ? [{ key: 'priority', label: 'Priority' }] : []),
  { key: 'details', label: 'Details' },
  { key: 'location', label: 'Location' },
  { key: 'review', label: 'Review' },
];

const PRIORITIES = [
  {
    id: 1,
    label: 'Priority 1 – Immediate',
    description: 'Life is at risk right now. Needs instant response.',
    main: '#DC2626',
    dark: '#991B1B',
    tint: '#FEF2F2',
  },
  {
    id: 2,
    label: 'Priority 2 – Urgent',
    description: 'Serious situation that needs a fast response.',
    main: '#EA580C',
    dark: '#9A3412',
    tint: '#FFF7ED',
  },
  {
    id: 3,
    label: 'Priority 3 – Normal',
    description: 'Needs attention, but no one is in immediate danger.',
    main: '#CA8A04',
    dark: '#854D0E',
    tint: '#FEFCE8',
  },
  {
    id: 4,
    label: 'Priority 4 – Low',
    description: 'Minor concern that can be handled when available.',
    main: '#2563EB',
    dark: '#1E40AF',
    tint: '#EFF6FF',
  },
];

// Colors follow the report type: green for infrastructure, red for emergency.
const TYPES = {
  emergency: {
    id: 'emergency',
    label: 'Emergency',
    description: 'Something is happening now and people may be in danger.',
    examples: 'Fire, medical, crime, accidents, floods',
    icon: AlertTriangle,
    main: '#DC2626',
    dark: '#991B1B',
    tint: '#FEF2F2',
    border: '#FECACA',
  },
  infrastructure: {
    id: 'infrastructure',
    label: 'Infrastructure',
    description: 'A damaged or broken public facility that needs fixing.',
    examples: 'Roads, lights, drainage, utilities',
    icon: Wrench,
    main: COLORS.primary,
    dark: '#14573A',
    tint: '#ECFDF5',
    border: '#A7F3D0',
  },
};

// Quick-check items shown on the Details step. Residents tick everything that
// applies so the captain can validate the report at a glance. Ids that already
// exist elsewhere in the app are reused; water_leak, fallen_tree and
// electrical_wire are new: map them to your backend's values.
const CHECKLISTS = {
  emergency: [
    { id: 'fire', label: 'Fire', icon: Flame },
    { id: 'medical', label: 'Medical Emergency', icon: HeartPulse },
    { id: 'crime', label: 'Crime or Threat', icon: ShieldAlert },
    { id: 'accident', label: 'Road Accident', icon: Car },
    { id: 'flood', label: 'Flood or Storm', icon: CloudRain },
    { id: 'other', label: 'Other Emergency', icon: Ellipsis },
  ],
  infrastructure: [
    { id: 'road', label: 'Road Damage / Pothole', icon: Construction },
    { id: 'streetlight', label: 'Broken Streetlight', icon: Lightbulb },
    { id: 'drainage', label: 'Clogged Drainage', icon: Waves },
    { id: 'garbage', label: 'Garbage / Waste Problem', icon: Trash2 },
    { id: 'water_leak', label: 'Water Leakage', icon: Droplets },
    { id: 'fallen_tree', label: 'Fallen Tree', icon: Trees },
    { id: 'electrical_wire', label: 'Dangling Electrical Wire', icon: Zap },
    { id: 'other', label: 'Other', icon: Ellipsis },
  ],
};

// MapViewer falls back to demo incidents when it receives none. A single
// invalid-coordinate entry stops that fallback and is itself never drawn,
// so no fake pins appear on a real report form.
const NO_MAP_INCIDENTS = [{ id: 'none', lat: NaN, lng: NaN }];

const callNumber = (number) => Linking.openURL(`tel:${number.replace(/-/g, '')}`);

/* -----------------------------------------
   BOUNDARY CHECK (uses the existing GeoJSON asset)
------------------------------------------ */

function getPolygons(boundary) {
  if (!boundary) return [];

  const features =
    boundary.type === 'FeatureCollection'
      ? boundary.features
      : boundary.type === 'Feature'
        ? [boundary]
        : [{ geometry: boundary }];

  return features.flatMap(({ geometry }) => {
    if (geometry?.type === 'Polygon') return [geometry.coordinates];
    if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
    return [];
  });
}

const POLYGONS = getPolygons(BOUNDARY);

// GeoJSON rings are [longitude, latitude].
function isInRing(lat, lng, ring) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

function isInsideBarangay(lat, lng) {
  return POLYGONS.some(
    ([outer, ...holes]) =>
      !!outer &&
      isInRing(lat, lng, outer) &&
      !holes.some((hole) => isInRing(lat, lng, hole))
  );
}

/* -----------------------------------------
   SUBMISSION
------------------------------------------ */

/* -----------------------------------------
   SMALL COMPONENTS
------------------------------------------ */

function StepHeader({ step, steps, theme, onBack }) {
  return (
    <View style={tw`px-4 pb-4 pt-3`}>
      <View style={tw`flex-row items-center`}>
        {step > 0 ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Previous step"
            style={tw`mr-2 h-9 w-9 items-center justify-center rounded-full bg-slate-100`}
          >
            <ChevronLeft size={20} color="#334155" />
          </Pressable>
        ) : null}

        <View style={tw`flex-1`}>
          <Text style={tw`text-xl font-extrabold text-slate-900`}>Report an Incident</Text>
          <Text style={tw`mt-0.5 text-xs font-medium text-slate-500`}>
            Step {step + 1} of {steps.length} · {steps[step].label}
          </Text>
        </View>
      </View>

      <View style={tw`mt-4 flex-row`}>
        {steps.map((item, index) => (
          <View
            key={item.key}
            style={[
              tw`h-1.5 flex-1 rounded-full`,
              index > 0 && tw`ml-1.5`,
              { backgroundColor: index <= step ? theme.main : '#E2E8F0' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function StepTitle({ title, subtitle }) {
  return (
    <View style={tw`mb-5`}>
      <Text style={tw`text-2xl font-extrabold text-slate-900`}>{title}</Text>
      {subtitle ? <Text style={tw`mt-1 text-sm leading-5 text-slate-500`}>{subtitle}</Text> : null}
    </View>
  );
}

function FieldError({ message }) {
  if (!message) return null;

  return (
    <View style={tw`mt-3 flex-row items-center`}>
      <AlertCircle size={14} color="#DC2626" />
      <Text style={tw`ml-1.5 flex-1 text-xs font-medium text-red-600`}>{message}</Text>
    </View>
  );
}

function TypeCard({ type, selected, onPress }) {
  const Icon = type.icon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${type.label} report`}
      style={({ pressed }) => [
        tw`mb-3 flex-row items-center rounded-3xl p-4`,
        {
          backgroundColor: selected ? type.tint : '#FFFFFF',
          borderWidth: 2,
          borderColor: selected ? type.main : COLORS.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          tw`h-14 w-14 items-center justify-center rounded-2xl`,
          { backgroundColor: selected ? type.main : type.tint },
        ]}
      >
        <Icon size={26} color={selected ? '#FFFFFF' : type.main} />
      </View>

      <View style={tw`ml-4 flex-1`}>
        <Text style={[tw`text-base font-extrabold`, { color: selected ? type.dark : '#0F172A' }]}>
          {type.label}
        </Text>
        <Text style={tw`mt-0.5 text-xs leading-4 text-slate-600`}>{type.description}</Text>
        <Text style={tw`mt-1 text-[11px] font-medium text-slate-400`}>{type.examples}</Text>
      </View>

      <View
        style={[
          tw`ml-2 h-6 w-6 items-center justify-center rounded-full`,
          {
            backgroundColor: selected ? type.main : '#FFFFFF',
            borderWidth: selected ? 0 : 2,
            borderColor: COLORS.border,
          },
        ]}
      >
        {selected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

function CheckRow({ item, theme, checked, onPress }) {
  const Icon = item.icon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={item.label}
      style={({ pressed }) => [
        tw`mb-2.5 flex-row items-center rounded-2xl px-3.5 py-3`,
        {
          backgroundColor: checked ? theme.tint : '#FFFFFF',
          borderWidth: 2,
          borderColor: checked ? theme.main : COLORS.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          tw`mr-3 h-6 w-6 items-center justify-center rounded-md`,
          {
            backgroundColor: checked ? theme.main : '#FFFFFF',
            borderWidth: checked ? 0 : 2,
            borderColor: COLORS.border,
          },
        ]}
      >
        {checked && <Check size={15} color="#FFFFFF" strokeWidth={3} />}
      </View>

      <View
        style={[
          tw`mr-3 h-9 w-9 items-center justify-center rounded-xl`,
          { backgroundColor: checked ? theme.main : theme.tint },
        ]}
      >
        <Icon size={18} color={checked ? '#FFFFFF' : theme.main} />
      </View>

      <Text
        style={[tw`flex-1 text-sm font-semibold`, { color: checked ? theme.dark : '#334155' }]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function PriorityCard({ priority, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={priority.label}
      style={({ pressed }) => [
        tw`mb-3 flex-row items-center rounded-3xl p-4`,
        {
          backgroundColor: selected ? priority.tint : '#FFFFFF',
          borderWidth: 2,
          borderColor: selected ? priority.main : COLORS.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          tw`h-12 w-12 items-center justify-center rounded-2xl`,
          { backgroundColor: selected ? priority.main : priority.tint },
        ]}
      >
        <Text
          style={[tw`text-xl font-extrabold`, { color: selected ? '#FFFFFF' : priority.main }]}
        >
          {priority.id}
        </Text>
      </View>

      <View style={tw`ml-4 flex-1`}>
        <Text
          style={[tw`text-base font-extrabold`, { color: selected ? priority.dark : '#0F172A' }]}
        >
          {priority.label}
        </Text>
        <Text style={tw`mt-0.5 text-xs leading-4 text-slate-600`}>{priority.description}</Text>
      </View>

      <View
        style={[
          tw`ml-2 h-6 w-6 items-center justify-center rounded-full`,
          {
            backgroundColor: selected ? priority.main : '#FFFFFF',
            borderWidth: selected ? 0 : 2,
            borderColor: COLORS.border,
          },
        ]}
      >
        {selected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

function Chip({ label, selected, theme, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        tw`mb-2 mr-2 flex-row items-center rounded-full px-3.5 py-2`,
        {
          backgroundColor: selected ? theme.main : '#FFFFFF',
          borderWidth: 1.5,
          borderColor: selected ? theme.main : COLORS.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {selected && <Check size={13} color="#FFFFFF" strokeWidth={3} style={tw`mr-1`} />}
      <Text style={[tw`text-xs font-semibold`, { color: selected ? '#FFFFFF' : '#334155' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function OutlineButton({ icon: Icon, label, onPress, loading = false, color = COLORS.primary }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        tw`flex-row items-center justify-center rounded-2xl py-3.5`,
        {
          backgroundColor: '#FFFFFF',
          borderWidth: 1.5,
          borderColor: color,
          opacity: pressed || loading ? 0.6 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Icon size={16} color={color} />
      )}

      <Text style={[tw`ml-2 text-xs font-bold`, { color }]}>{label}</Text>
    </Pressable>
  );
}

function EmergencyNotice() {
  return (
    <View
      style={[
        tw`mb-5 rounded-2xl p-3.5`,
        { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
      ]}
    >
      <View style={tw`flex-row items-start`}>
        <AlertTriangle size={16} color="#DC2626" style={tw`mt-0.5`} />

        <Text style={tw`ml-2 flex-1 text-xs leading-4 text-red-800`}>
          If anyone is in immediate danger, call for help first, then submit this report so the
          barangay can respond.
        </Text>
      </View>

      <View style={tw`mt-3 flex-row`}>
        <Pressable
          onPress={() => callNumber(HOTLINE)}
          accessibilityRole="button"
          accessibilityLabel={`Call Barangay Hall hotline ${HOTLINE}`}
          style={({ pressed }) => [
            tw`mr-2 flex-1 flex-row items-center justify-center rounded-xl py-2.5`,
            { backgroundColor: '#DC2626', opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Phone size={14} color="#FFFFFF" />
          <Text style={tw`ml-1.5 text-xs font-bold text-white`}>Barangay {HOTLINE}</Text>
        </Pressable>

        <Pressable
          onPress={() => callNumber(NATIONAL_EMERGENCY)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${NATIONAL_EMERGENCY}`}
          style={({ pressed }) => [
            tw`flex-row items-center justify-center rounded-xl px-4 py-2.5`,
            {
              backgroundColor: '#FFFFFF',
              borderWidth: 1.5,
              borderColor: '#DC2626',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Phone size={14} color="#DC2626" />
          <Text style={tw`ml-1.5 text-xs font-bold text-red-600`}>{NATIONAL_EMERGENCY}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SummaryCard({ label, onEdit, children }) {
  return (
    <View
      style={[
        tw`mb-3 rounded-2xl p-4`,
        { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
      ]}
    >
      <View style={tw`mb-2 flex-row items-center justify-between`}>
        <Text style={tw`text-[11px] font-bold uppercase tracking-wide text-slate-400`}>
          {label}
        </Text>

        <Pressable
          onPress={onEdit}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label}`}
          style={tw`flex-row items-center`}
        >
          <Pencil size={12} color={COLORS.primary} />
          <Text style={[tw`ml-1 text-xs font-bold`, { color: COLORS.primary }]}>Edit</Text>
        </Pressable>
      </View>

      {children}
    </View>
  );
}

/* -----------------------------------------
   REPORT SCREEN
------------------------------------------ */

export default function Report({ guestMode = false, route }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const submittingRef = useRef(false);
  const submissionRef = useRef({});
  const photoFilesRef = useRef(new Map());
  const [pendingNotice, setPendingNotice] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [photoNotice, setPhotoNotice] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const captureRef = useRef(false);
  const [fade] = useState(() => new Animated.Value(1));

  const [step, setStep] = useState(0);
  const [reportType, setReportType] = useState(
    route?.params?.reportType === 'emergency' ? 'emergency' : null
  ); // 'emergency' | 'infrastructure'
  const [priority, setPriority] = useState(null); // 1-4, emergency only
  const [checks, setChecks] = useState([]); // quick-detail check ids
  const [description, setDescription] = useState('');
  const [guestAlias, setGuestAlias] = useState('');
  const [location, setLocation] = useState(null); // { lat, lng, source }
  const [photos, setPhotos] = useState([]); // up to MAX_PHOTOS image uris

  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const theme = TYPES[reportType] ?? TYPES.infrastructure;
  const isEmergency = reportType === 'emergency';
  const checkList = reportType ? CHECKLISTS[reportType] : [];

  /* ---------- step navigation ---------- */

  const steps = getSteps(reportType);
  const lastStep = steps.length - 1;
  const stepKey = steps[step].key;
  const stepIndex = (key) => steps.findIndex((item) => item.key === key);

  // Only the photo is required for residents. Guests also provide the name
  // associated with their report.
  const photoError =
    photos.length > 0 ? null : guestMode
      ? 'At least one photo is required. Take one or choose from your gallery.'
      : 'At least one photo is required. Take a photo of the problem.';
  const detailsError = guestMode && !guestAlias.trim()
    ? 'Your name is required.'
    : photoError;

  const errors = {
    type: reportType ? null : 'Please choose the type of report.',
    priority: priority ? null : 'Please choose a priority level.',
    details: detailsError,
    location: location ? null : 'Tap the map or use your current location.',
    review: null,
  };

  const currentError = errors[stepKey];
  const showError = attempted ? currentError : null;

  useEffect(() => {
    if (!successNotice) return;
    const timer = setTimeout(() => setSuccessNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [successNotice]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, fade]);

  const goTo = (target) => {
    if (submittingRef.current || submissionRef.current.payload) return;
    setAttempted(false);
    setStep(target);
  };

  const goBack = () => {
    if (submittingRef.current) return;
    if (step > 0) goTo(step - 1);
  };

  const goNext = () => {
    if (currentError) {
      setAttempted(true);
      return;
    }
    goTo(Math.min(step + 1, lastStep));
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!guestMode && (submittingRef.current || submissionRef.current.payload)) return true;
      if (step > 0 && !submittingRef.current) {
        setAttempted(false);
        setStep(step - 1);
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [step, guestMode]);

  /* ---------- selections ---------- */

  // Choosing a type or a priority moves straight on, no Next needed.
  const selectType = (type) => {
    if (type !== reportType) {
      setReportType(type);
      setPriority(null);
      setChecks([]); // check items differ per type
    }
    goTo(1);
  };

  const selectPriority = (id) => {
    setPriority(id);
    goTo(2);
  };

  const toggleCheck = (id) =>
    setChecks((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  /* ---------- location ---------- */

  const handleMapSelect = ({ lat, lng }) => {
    setLocation({ lat, lng, source: 'map' });
    setLocationMessage(null);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationMessage(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationMessage(
          'Location permission was denied. Tap the map to choose the location manually.'
        );
        return;
      }

      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!isInsideBarangay(coords.latitude, coords.longitude)) {
        setLocationMessage(
          'Your current location is outside Barangay 167. Tap the map to choose a spot inside the green boundary.'
        );
        return;
      }

      setLocation({ lat: coords.latitude, lng: coords.longitude, source: 'gps' });
    } catch {
      setLocationMessage('Could not get your location. Tap the map to choose it manually.');
    } finally {
      setLocating(false);
    }
  };

  /* ---------- photo ---------- */

  const pickPhoto = async (source) => {
    if (captureRef.current || submittingRef.current || submissionRef.current.payload) return;
    if (!guestMode) source = 'camera';
    setPhotoNotice('');
    const remaining = MAX_PHOTOS - photos.length;

    if (remaining <= 0) {
      if (guestMode) Alert.alert('Photo limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      else setPhotoNotice(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    captureRef.current = true;
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        if (!guestMode) {
          setPhotoNotice('Allow camera access in Settings to take evidence photos.');
          return;
        }
        Alert.alert(
          'Permission needed',
          source === 'camera'
            ? 'Allow camera access to take a photo, or choose one from your gallery.'
            : 'Allow photo access to choose images, or take a new photo instead.'
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.7,
              allowsMultipleSelection: true,
              selectionLimit: remaining,
            });

      if (!result.canceled && result.assets?.length) {
        const uris = result.assets.map((asset) => asset.uri).filter(Boolean);
        if (!guestMode) {
          for (const asset of result.assets.filter(asset => asset.uri)) {
            if (!photoFilesRef.current.has(asset.uri)) {
              photoFilesRef.current.set(asset.uri, prepareReportPhoto(asset, {
                randomUUID: Crypto.randomUUID,
                fileInfo: uri => new File(uri),
              }));
            }
          }
        }

        setPhotos((current) =>
          [...current, ...uris.filter((uri) => !current.includes(uri))].slice(0, MAX_PHOTOS)
        );
      }
    } catch (error) {
      if (guestMode) Alert.alert('Photo error', 'Could not load the photo. Please try again.');
      else setPhotoNotice(error.message || 'Could not capture the photo. Please try again.');
    } finally {
      captureRef.current = false;
    }
  };

  const removePhoto = (index) =>
    setPhotos((current) => current.filter((_, i) => i !== index));

  const choosePhotoSource = () => {
    if (!guestMode) return pickPhoto('camera');
    return Alert.alert('Photo evidence', 'Add a photo of the problem.', [
      { text: 'Take Photo', onPress: () => pickPhoto('camera') },
      { text: 'Choose from Gallery', onPress: () => pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /* ---------- submit ---------- */

  const resetForm = () => {
    submissionRef.current = {};
    photoFilesRef.current.clear();
    setPendingNotice('');
    setSubmitError('');
    setPhotoNotice('');
    setStep(0);
    setReportType(null);
    setPriority(null);
    setChecks([]);
    setDescription('');
    setGuestAlias('');
    setLocation(null);
    setPhotos([]);
    setLocationMessage(null);
    setAttempted(false);
  };

  const send = async () => {
    if (submittingRef.current) return;

    // Guard against jumping straight here with an incomplete form.
    const firstInvalid = steps.findIndex((item) => errors[item.key]);
    if (firstInvalid !== -1) {
      goTo(firstInvalid);
      setAttempted(true);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');

    try {
      const selectedChecks = checks.length ? `Selected details: ${checks.join(', ')}` : '';
      const residentPayload = buildResidentReportPayload({
        category: checks[0] || 'other',
        urgency: ({ 1: 'CRITICAL', 2: 'HIGH', 3: 'MEDIUM', 4: 'LOW' })[priority] || 'MEDIUM',
        isEmergency: reportType === 'emergency',
        description: [description.trim(), selectedChecks].filter(Boolean).join('\n'),
        position: location,
        address: null,
        landmark: null,
        callbackContact: null,
      });
      if (guestMode) await createReport({
        ...residentPayload,
        reporter_type: 'GUEST',
        guest_alias: guestAlias.trim(),
        title: reportType === 'emergency' ? 'Emergency incident' : 'Infrastructure concern',
        classification: reportType === 'emergency' ? 'sudden' : 'maintenance',
        incident_category: reportType === 'emergency' ? 'Incident / Emergency' : 'Road Damage',
        priority_level: priority === 4 ? 'LOW' : priority === 3 ? 'MEDIUM' : 'HIGH',
      });
      else {
        const session = await submitResidentEvidence(submissionRef.current, {
          payload: residentPayload,
          items: photos.map(uri => photoFilesRef.current.get(uri)),
          create: createReport, list: getReportAttachments, upload: uploadReportAttachment,
          randomUUID: Crypto.randomUUID,
        });
        if (!session) return;
        if (!session.complete) {
          const message = pendingEvidenceMessage(session);
          setPendingNotice(message);
          return;
        }
      }

      if (reportType === 'emergency' && !guestMode) {
        navigation.replace('Track', {
          reportId: submissionRef.current.report.public_id,
          location: { lat: location.lat, lng: location.lng },
          priority,
        });
        return;
      }

      if (guestMode) Alert.alert('Report submitted', 'Thank you. Your report has been sent to the barangay.');
      else {
        const reference = submissionRef.current.report.reference_number;
        setSuccessNotice(`Report submitted${reference ? ` · ${reference}` : ''}`);
      }
      resetForm();
    } catch (error) {
      if (submissionRef.current.report) {
        const message = pendingEvidenceMessage(submissionRef.current);
        setPendingNotice(message);
        return;
      }
      if (!guestMode) {
        setSubmitError(submissionRef.current.payload
          ? 'We could not confirm submission. Retry safely to check or submit this same report. Your details and photos are kept.'
          : error.message || 'Could not submit report. Your details and photos are kept.');
        return;
      }
      Alert.alert(
        'Could not submit report',
        error?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /* ---------- step content ---------- */

  const renderTypeStep = () => (
    <>
      <StepTitle
        title="What are you reporting?"
        subtitle="Pick the option that best matches the situation."
      />

      <TypeCard
        type={TYPES.emergency}
        selected={reportType === 'emergency'}
        onPress={() => selectType('emergency')}
      />
      <TypeCard
        type={TYPES.infrastructure}
        selected={reportType === 'infrastructure'}
        onPress={() => selectType('infrastructure')}
      />
    </>
  );

  const renderPriorityStep = () => (
    <>
      <StepTitle
        title="How urgent is it?"
        subtitle="Choose the priority level that matches the situation."
      />

      <EmergencyNotice />

      {PRIORITIES.map((item) => (
        <PriorityCard
          key={item.id}
          priority={item}
          selected={priority === item.id}
          onPress={() => selectPriority(item.id)}
        />
      ))}

      <FieldError message={showError} />
    </>
  );

  const renderDetailsStep = () => (
    <>
      <StepTitle
        title="Quick details"
        subtitle="Add up to 5 photos so the captain can validate your report, then tick what applies."
      />

      {guestMode ? (
        <View style={tw`mb-5`}>
          <Text style={tw`mb-2 text-sm font-bold text-slate-900`}>Your name</Text>
          <TextInput
            value={guestAlias}
            onChangeText={setGuestAlias}
            placeholder="Enter your name"
            maxLength={100}
            autoCapitalize="words"
            style={tw`rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900`}
          />
          {!guestAlias.trim() && attempted ? <FieldError message="Your name is required." /> : null}
        </View>
      ) : null}

      <View style={tw`mb-2 flex-row items-center justify-between`}>
        <Text style={tw`text-sm font-bold text-slate-900`}>
          Photo evidence ({photos.length}/{MAX_PHOTOS})
        </Text>
        <View style={[tw`rounded-full px-2 py-0.5`, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[tw`text-[10px] font-bold`, { color: '#B45309' }]}>Required</Text>
        </View>
      </View>

      {photos.length === 0 ? (
        <View style={tw`flex-row`}>
          <View style={guestMode ? tw`mr-3 flex-1` : tw`flex-1`}>
            <OutlineButton icon={Camera} label="Take Photo" onPress={() => pickPhoto('camera')} />
          </View>
          {guestMode && <View style={tw`flex-1`}>
            <OutlineButton icon={ImageIcon} label="Gallery" onPress={() => pickPhoto('library')} />
          </View>}
        </View>
      ) : (
        <View style={tw`-mx-1 flex-row flex-wrap`}>
          {photos.map((uri, index) => (
            <View key={`${uri}-${index}`} style={tw`w-1/3 p-1`}>
              <View style={{ aspectRatio: 1 }}>
                <Image
                  source={{ uri }}
                  resizeMode="cover"
                  style={[tw`h-full w-full rounded-2xl`, { backgroundColor: COLORS.surface }]}
                />
                <Pressable
                  onPress={() => removePhoto(index)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  style={[
                    tw`absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full`,
                    { backgroundColor: 'rgba(15,23,42,0.7)' },
                  ]}
                >
                  <X size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          ))}

          {photos.length < MAX_PHOTOS && (
            <View style={tw`w-1/3 p-1`}>
              <Pressable
                onPress={choosePhotoSource}
                accessibilityRole="button"
                accessibilityLabel="Add another photo"
                style={({ pressed }) => [
                  tw`items-center justify-center rounded-2xl`,
                  {
                    aspectRatio: 1,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: COLORS.primary,
                    backgroundColor: '#FFFFFF',
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Camera size={22} color={COLORS.primary} />
                <Text style={[tw`mt-1 text-xs font-bold`, { color: COLORS.primary }]}>Add</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
      <FieldError message={showError} />
      {!guestMode && !!photoNotice && <View accessibilityRole="alert" accessibilityLiveRegion="polite"><FieldError message={photoNotice} /></View>}

      <View style={tw`mb-2 mt-6 flex-row items-center justify-between`}>
        <Text style={tw`text-sm font-bold text-slate-900`}>What do you see?</Text>
        <View style={tw`rounded-full bg-slate-100 px-2 py-0.5`}>
          <Text style={tw`text-[10px] font-bold text-slate-500`}>Tick all that apply</Text>
        </View>
      </View>

      {checkList.map((item) => (
        <CheckRow
          key={item.id}
          item={item}
          theme={theme}
          checked={checks.includes(item.id)}
          onPress={() => toggleCheck(item.id)}
        />
      ))}

      <View style={tw`mb-2 mt-4 flex-row items-center justify-between`}>
        <Text style={tw`text-sm font-bold text-slate-900`}>Additional note</Text>
        <View style={tw`rounded-full bg-slate-100 px-2 py-0.5`}>
          <Text style={tw`text-[10px] font-bold text-slate-500`}>Optional</Text>
        </View>
      </View>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Anything else the captain should know…"
        placeholderTextColor="#94A3B8"
        multiline
        maxLength={MAX_DESCRIPTION}
        textAlignVertical="top"
        style={[
          tw`rounded-2xl px-4 py-3 text-sm text-slate-800`,
          {
            minHeight: 90,
            backgroundColor: COLORS.surface,
            borderWidth: 1.5,
            borderColor: COLORS.border,
          },
        ]}
      />
      <Text
        style={[
          tw`mt-1 text-right text-[11px] font-medium`,
          {
            color:
              description.length >= MAX_DESCRIPTION - 50 ? COLORS.accent : '#94A3B8',
          },
        ]}
      >
        {description.length}/{MAX_DESCRIPTION}
      </Text>
    </>
  );

  const renderLocationStep = () => (
    <>
      <StepTitle
        title="Where is it?"
        subtitle="Tap inside the green dashed boundary, or use your current location."
      />

      <View
        style={[
          tw`overflow-hidden rounded-3xl`,
          { height: MAP_HEIGHT, borderWidth: 1, borderColor: COLORS.border },
        ]}
      >
        <MapViewer
          variant="picker"
          compact
          mapHeight={MAP_HEIGHT}
          incidents={NO_MAP_INCIDENTS}
          selectedLocation={location}
          onLocationSelect={handleMapSelect}
        />
      </View>

      <View style={tw`mt-3`}>
        <OutlineButton
          icon={LocateFixed}
          label="Use My Current Location"
          onPress={useCurrentLocation}
          loading={locating}
        />
      </View>

      {locationMessage && (
        <View
          style={[tw`mt-3 flex-row items-start rounded-2xl p-3`, { backgroundColor: '#FFFBEB' }]}
        >
          <AlertTriangle size={14} color={COLORS.accent} style={tw`mt-0.5`} />
          <Text style={tw`ml-2 flex-1 text-xs leading-4 text-amber-800`}>{locationMessage}</Text>
        </View>
      )}

      {location && (
        <View
          style={[tw`mt-3 flex-row items-center rounded-2xl p-3`, { backgroundColor: '#ECFDF5' }]}
        >
          <MapPin size={18} color={COLORS.primary} />

          <View style={tw`ml-2 flex-1`}>
            <Text style={tw`text-xs font-bold text-emerald-900`}>
              {location.source === 'gps' ? 'Current location' : 'Selected on map'}
              {' · Inside Barangay 167'}
            </Text>
            <Text style={tw`mt-0.5 text-[11px] text-emerald-800`}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </Text>
          </View>

          <Pressable
            onPress={() => setLocation(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear selected location"
          >
            <X size={16} color="#047857" />
          </Pressable>
        </View>
      )}

      <FieldError message={showError} />
    </>
  );

  const renderReviewStep = () => {
    const TypeIcon = theme.icon;
    const priorityInfo = PRIORITIES.find((item) => item.id === priority) ?? null;

    return (
      <>
        <StepTitle title="Review your report" subtitle="Check everything before sending." />

        {isEmergency && <EmergencyNotice />}

        <SummaryCard label="Report" onEdit={() => goTo(0)}>
          {priorityInfo && (
            <Pressable
              onPress={() => goTo(stepIndex('priority'))}
              accessibilityRole="button"
              accessibilityLabel="Edit priority"
              style={[
                tw`mb-3 flex-row items-center self-start rounded-full px-3 py-1.5`,
                { backgroundColor: priorityInfo.tint },
              ]}
            >
              <Text style={[tw`text-xs font-extrabold`, { color: priorityInfo.dark }]}>
                {priorityInfo.label}
              </Text>
            </Pressable>
          )}
          <View style={tw`flex-row items-center`}>
            <View
              style={[
                tw`h-10 w-10 items-center justify-center rounded-xl`,
                { backgroundColor: theme.tint },
              ]}
            >
              <TypeIcon size={20} color={theme.main} />
            </View>
            <Text style={[tw`ml-3 text-sm font-extrabold`, { color: theme.dark }]}>
              {theme.label}
            </Text>
          </View>
        </SummaryCard>

        <SummaryCard label="Details" onEdit={() => goTo(stepIndex('details'))}>
          {photos.length > 0 && (
            <View style={tw`-mx-1 mb-2 flex-row flex-wrap`}>
              {photos.map((uri, index) => (
                <View key={`${uri}-${index}`} style={tw`w-1/3 p-1`}>
                  <Image
                    source={{ uri }}
                    resizeMode="cover"
                    style={[tw`w-full rounded-xl`, { aspectRatio: 1 }]}
                  />
                </View>
              ))}
            </View>
          )}

          {checks.length > 0 ? (
            <View style={tw`flex-row flex-wrap`}>
              {checkList
                .filter((item) => checks.includes(item.id))
                .map((item) => (
                  <View
                    key={item.id}
                    style={[
                      tw`mb-1 mr-1.5 flex-row items-center rounded-full px-2.5 py-1`,
                      { backgroundColor: theme.tint },
                    ]}
                  >
                    <Check size={11} color={theme.dark} strokeWidth={3} />
                    <Text style={[tw`ml-1 text-[11px] font-semibold`, { color: theme.dark }]}>
                      {item.label}
                    </Text>
                  </View>
                ))}
            </View>
          ) : (
            <Text style={tw`text-xs text-slate-400`}>No quick details selected</Text>
          )}

          {description.trim().length > 0 && (
            <Text style={tw`mt-2 text-sm leading-5 text-slate-800`}>{description.trim()}</Text>
          )}
        </SummaryCard>

        <SummaryCard label="Location" onEdit={() => goTo(stepIndex('location'))}>
          <View style={tw`flex-row items-center`}>
            <MapPin size={16} color={COLORS.primary} />
            <View style={tw`ml-2 flex-1`}>
              <Text style={tw`text-xs font-bold text-slate-800`}>
                {location?.source === 'gps' ? 'Current location' : 'Selected on map'}
                {' · Barangay 167'}
              </Text>
              <Text style={tw`mt-0.5 text-[11px] text-slate-500`}>
                {location?.lat.toFixed(5)}, {location?.lng.toFixed(5)}
              </Text>
            </View>
          </View>
        </SummaryCard>
      </>
    );
  };

  const renderStep = () => {
    switch (stepKey) {
      case 'type':
        return renderTypeStep();
      case 'priority':
        return renderPriorityStep();
      case 'details':
        return renderDetailsStep();
      case 'location':
        return renderLocationStep();
      default:
        return renderReviewStep();
    }
  };

  /* ---------- render ---------- */

  const isReview = step === lastStep;
  const nextLabel = isReview
    ? submitting
      ? 'Submitting…'
      : pendingNotice
        ? 'Retry photos'
        : submitError
          ? 'Retry report'
          : isEmergency
            ? 'Submit Emergency Report'
            : 'Submit Report'
    : 'Next';

  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-white`}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StepHeader step={step} steps={steps} theme={theme} onBack={goBack} />

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`px-4 pb-6 pt-1`}
      >
        <Animated.View style={{ opacity: fade }}>{renderStep()}</Animated.View>
      </ScrollView>

      {!guestMode && !!successNotice && <View style={tw`mx-4 mb-3`}><AnimatedSuccessBanner message={successNotice} /></View>}
      {!guestMode && isReview && !!(pendingNotice || submitError) && (
        <ScrollView style={{ maxHeight: 150 }} contentContainerStyle={tw`px-4 pb-3`}>
          <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={tw`flex-row rounded-xl border border-red-100 bg-red-50 px-4 py-3`}>
            <AlertCircle size={18} color="#DC2626" />
            <Text style={tw`ml-3 flex-1 text-sm leading-5 text-red-700`}>{pendingNotice || submitError}</Text>
          </View>
        </ScrollView>
      )}

      {/* FOOTER (hidden on Type and Priority, which advance on tap) */}
      {stepKey !== 'type' && stepKey !== 'priority' && (
      <View
        style={[
          tw`flex-row px-4 pt-3`,
          {
            paddingBottom: Math.max(insets.bottom, 12) + 4,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            backgroundColor: '#FFFFFF',
          },
        ]}
      >
        {step > 0 && (
          <Pressable
            onPress={goBack}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [
              tw`mr-3 h-14 items-center justify-center rounded-2xl px-5`,
              {
                backgroundColor: '#F1F5F9',
                opacity: pressed || submitting ? 0.6 : 1,
              },
            ]}
          >
            <ChevronLeft size={22} color="#334155" />
          </Pressable>
        )}

        <Pressable
          onPress={isReview ? send : goNext}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={({ pressed }) => [
            tw`h-14 flex-1 flex-row items-center justify-center rounded-2xl`,
            {
              backgroundColor: theme.main,
              opacity: pressed || submitting ? 0.7 : 1,
              elevation: 3,
            },
          ]}
        >
          {submitting && <ActivityIndicator size="small" color="#FFFFFF" />}

          <Text style={tw`${submitting ? 'ml-2 ' : ''}text-base font-extrabold text-white`}>
            {nextLabel}
          </Text>

          {!submitting &&
            (isReview ? (
              <Send size={16} color="#FFFFFF" style={tw`ml-2`} />
            ) : (
              <ChevronRight size={18} color="#FFFFFF" style={tw`ml-1`} />
            ))}
        </Pressable>
      </View>
      )}
    </KeyboardAvoidingView>
  );
}
