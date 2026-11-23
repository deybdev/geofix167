import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Compass,
  Hospital,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  QrCode,
  Route,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import { useAuth } from '../../context/AuthContext';
import { formatTitleCase, getStatusStyle } from '../../utils/dispatchStatus';
import {
  completeAgencyDispatch,
  generateHospitalQrHandover,
  getNearestHospitals,
  getResponderDispatches,
  markArrivedOnScene,
  postResponderLocation,
  requestFieldBackup,
  submitMaintenanceInspection,
  submitMaintenanceRepair,
} from '../../services/responderDispatchService';
import {
  enqueueOfflineSubmission,
  flushOfflineQueue,
  getOfflineQueue,
  isNetworkError,
} from '../../services/offlineResolutionQueue';

function hasCoordinates(item) {
  return Boolean(item)
    && Number.isFinite(Number(item.incident_latitude ?? item.latitude))
    && Number.isFinite(Number(item.incident_longitude ?? item.longitude));
}

function hasValidPoint(point) {
  return Boolean(point)
    && Number.isFinite(Number(point.lat))
    && Number.isFinite(Number(point.lng));
}

function getRouteHeading(points) {
  const validPoints = (points || []).filter(hasValidPoint);
  if (validPoints.length < 2) return 0;
  const [from, to] = validPoints;
  const longitude = (to.lng - from.lng) * (Math.PI / 180);
  const heading = Math.atan2(
    Math.sin(longitude) * Math.cos(to.lat * (Math.PI / 180)),
    Math.cos(from.lat * (Math.PI / 180)) * Math.sin(to.lat * (Math.PI / 180))
    - Math.sin(from.lat * (Math.PI / 180))
    * Math.cos(to.lat * (Math.PI / 180))
    * Math.cos(longitude),
  ) * (180 / Math.PI);

  return (heading + 360) % 360;
}

function formatDuration(minutes) {
  if (!minutes || minutes < 60) return `${minutes || 1} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours} hr ${rem} min`;
}

function getArrivalTime(minutes) {
  const arrival = new Date(Date.now() + (minutes || 1) * 60 * 1000);
  return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getCaloocanTrafficProfile() {
  const hour = new Date().getHours();
  if ((hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 20)) {
    return { multiplier: 1.65, avgSpeedKmh: 15, turnPenaltySec: 20, label: 'Heavy traffic' };
  }
  if (hour > 9 && hour < 16) {
    return { multiplier: 1.35, avgSpeedKmh: 21, turnPenaltySec: 14, label: 'Moderate traffic' };
  }
  return { multiplier: 1.1, avgSpeedKmh: 30, turnPenaltySec: 8, label: 'Light traffic' };
}

async function getMultiStopRoadRoute(waypoints) {
  const valid = (waypoints || []).filter(hasValidPoint);
  if (valid.length < 2) return null;

  const tomtomKey = process.env.EXPO_PUBLIC_TOMTOM_API_KEY;
  if (tomtomKey) {
    try {
      const locs = valid.map((p) => `${p.lat},${p.lng}`).join(':');
      const ttUrl = `https://api.tomtom.com/routing/1/calculateRoute/${locs}/json?key=${tomtomKey}&traffic=true&travelMode=car&instructionsType=text`;
      const ttRes = await fetch(ttUrl);
      if (ttRes.ok) {
        const ttData = await ttRes.json();
        const ttRoute = ttData.routes?.[0];
        const pts = (ttRoute?.legs || []).flatMap((leg) =>
          (leg.points || []).map((pt) => ({ lat: pt.latitude, lng: pt.longitude })),
        );
        if (pts.length > 1) {
          const summary = ttRoute.summary || {};
          const firstInstruction = ttRoute.guidance?.instructions?.[0]?.message;
          return {
            points: pts,
            distanceKm: Number(((summary.lengthInMeters || 0) / 1000).toFixed(1)),
            durationMin: Math.max(1, Math.round((summary.travelTimeInSeconds || 60) / 60)),
            trafficDelayMin: Math.round((summary.trafficDelayInSeconds || 0) / 60),
            trafficLabel: (summary.trafficDelayInSeconds || 0) > 120 ? 'Heavy traffic' : 'Live traffic',
            instruction: firstInstruction || 'Follow live traffic route to patient & hospital',
          };
        }
      }
    } catch {
      // Fall back to calibrated OSRM routing
    }
  }

  const coords = valid.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates?.length) return null;

  const firstStep = route.legs?.[0]?.steps?.[0];
  const maneuver = firstStep?.maneuver;
  const maneuverText = maneuver?.type === 'depart'
    ? 'Head toward'
    : maneuver?.type === 'arrive'
      ? 'Arrive at destination'
      : `${maneuver?.modifier ? `${maneuver.modifier} ` : ''}${maneuver?.type || 'Continue'} onto`;

  const instruction = maneuver?.type === 'arrive'
    ? maneuverText
    : `${maneuverText} ${firstStep?.name || 'patient pickup & nearest hospital route'}`;

  const distanceKm = route.distance / 1000;
  const totalSteps = (route.legs || []).reduce(
    (sum, leg) => sum + ((leg.steps || []).length || 0),
    0,
  );
  const profile = getCaloocanTrafficProfile();
  const osrmTrafficSec = route.duration * profile.multiplier + totalSteps * profile.turnPenaltySec;
  const urbanSpeedSec = (distanceKm / profile.avgSpeedKmh) * 3600 + totalSteps * profile.turnPenaltySec;
  const realisticSec = Math.max(osrmTrafficSec, urbanSpeedSec);

  return {
    points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceKm: Number(distanceKm.toFixed(1)),
    durationMin: Math.max(1, Math.round(realisticSec / 60)),
    trafficLabel: profile.label,
    instruction,
  };
}

const API_ORIGIN = String(process.env.EXPO_PUBLIC_API_URL || '')
  .replace(/\/api\/?$/, '')
  .replace(/\/$/, '');

const sanitizePersonName = (val) => String(val || '').replace(/[^a-zA-Z\s.-]/g, '').slice(0, 80);
const sanitizeContactNumber = (val) => String(val || '').replace(/\D/g, '').slice(0, 11);
const sanitizeAge = (val) => String(val || '').replace(/\D/g, '').slice(0, 3);

function validatePersonEntry(p) {
  const errors = {};
  const name = sanitizePersonName(p.full_name).trim();
  const contact = sanitizeContactNumber(p.contact).trim();
  const age = sanitizeAge(p.age).trim();
  const condition = String(p.condition || '').trim();
  const notes = String(p.notes || '').trim();

  if (name.length < 2 || !/^[a-zA-Z\s.-]+$/.test(name)) {
    errors.full_name = 'Letters, spaces, periods, and hyphens only (min 2 chars).';
  }
  if (contact && !/^09\d{9}$/.test(contact)) {
    errors.contact = 'Use 11-digit PH mobile format (09XXXXXXXXX).';
  }
  if (age) {
    const n = Number(age);
    if (!/^\d{1,3}$/.test(age) || n < 0 || n > 120) {
      errors.age = 'Whole number 0–120 only.';
    }
  }
  if (p.sex !== 'Male' && p.sex !== 'Female') {
    errors.sex = 'Select Male or Female.';
  }
  if (!condition || condition.length > 120) {
    errors.condition = 'Required (max 120 characters).';
  }
  if (notes.length > 500) {
    errors.notes = 'Max 500 characters.';
  }
  return errors;
}

function buildInitialPatients(assignment) {
  return [
    {
      full_name: sanitizePersonName(assignment?.reporter_name || ''),
      contact: sanitizeContactNumber(assignment?.reporter_phone || ''),
      age: '',
      sex: '',
      condition: String(assignment?.incident_title || assignment?.incident_category || '').slice(0, 120),
      notes: '',
    },
  ];
}

export default function ResponderMap() {
  const { user } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isAgencyRole = userRole === 'police' || userRole === 'fire';
  const navigation = useNavigation();
  const route = useRoute();

  const [activeAssignment, setActiveAssignment] = useState(route.params?.assignment || null);
  const [backupSent, setBackupSent] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const currentLocationRef = useRef(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [locationSharingOff, setLocationSharingOff] = useState(Boolean(route.params?.locationSharingOff));
  const [nearestHospital, setNearestHospital] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationMuted, setNavigationMuted] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [compassResetKey, setCompassResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patients, setPatients] = useState(() => buildInitialPatients(route.params?.assignment));
  const [furtherInfo, setFurtherInfo] = useState('');
  const [proofPhoto, setProofPhoto] = useState(null);
  const [formError, setFormError] = useState('');
  const [qrResult, setQrResult] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [caseClosedOnMap, setCaseClosedOnMap] = useState(false);
  const [maintenanceModalMode, setMaintenanceModalMode] = useState(null);
  const [maintenanceNote, setMaintenanceNote] = useState('');
  const [maintenancePhoto, setMaintenancePhoto] = useState(null);
  const [maintenanceError, setMaintenanceError] = useState('');
  const [hospitalOptions, setHospitalOptions] = useState([]);
  const [showHospitalPicker, setShowHospitalPicker] = useState(false);
  const [dismissedRejectionNote, setDismissedRejectionNote] = useState('');
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const syncOfflineSubmissions = useCallback(async () => {
    setSyncingOffline(true);
    try {
      const result = await flushOfflineQueue({
        agency_resolution: (item) => completeAgencyDispatch(item.dispatchId, item.payload),
        tanod_qr_handover: (item) => generateHospitalQrHandover(item.dispatchId, item.payload),
      });
      setOfflineQueueCount(result.remaining);
    } catch {
      const q = await getOfflineQueue();
      setOfflineQueueCount(q.length);
    } finally {
      setSyncingOffline(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void syncOfflineSubmissions();
    }, 0);
    return () => clearTimeout(timer);
  }, [syncOfflineSubmissions]);

  const tryEnableLocationSharing = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationPermissionGranted(false);
        setLocationSharingOff(true);
        return;
      }
      setLocationPermissionGranted(true);
      setLocationSharingOff(false);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const location = { lat: position.coords.latitude, lng: position.coords.longitude };
      currentLocationRef.current = location;
      setCurrentLocation(location);
    } catch {
      setLocationSharingOff(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const permissionHandled = route.params?.locationPermissionHandled === true;
    const skipLocation = route.params?.locationSharingOff === true;
    if (skipLocation) {
      const timer = setTimeout(() => {
        if (active) {
          setLocationPermissionGranted(false);
          setLocationSharingOff(true);
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
    (async () => {
      try {
        const perm = permissionHandled
          ? await Location.getForegroundPermissionsAsync()
          : await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          if (active) {
            setLocationPermissionGranted(false);
            setLocationSharingOff(true);
          }
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (active) {
          const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          currentLocationRef.current = location;
          setCurrentLocation(location);
          setLocationPermissionGranted(true);
          setLocationSharingOff(false);
        }
      } catch {
        if (active) setLocationSharingOff(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [route.params?.locationPermissionHandled, route.params?.locationSharingOff]);

  useEffect(() => {
    const activeStatuses = ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'];
    const assignmentId = activeAssignment?.id;
    const assignmentStatus = activeAssignment?.status;
    if (!assignmentId || !activeStatuses.includes(assignmentStatus) || !locationPermissionGranted) return undefined;
    let active = true;
    let watcher = null;
    let lastPostAt = 0;

    const publishLocation = async (position) => {
      if (!active) return;
      const coords = position.coords;
      const location = { lat: coords.latitude, lng: coords.longitude };
      currentLocationRef.current = location;
      setCurrentLocation(location);
      if (Date.now() - lastPostAt < 8000) return;
      lastPostAt = Date.now();
      try { await postResponderLocation(assignmentId, coords); }
      catch { /* Location sharing failures do not interrupt responder navigation. */ }
    };

    (async () => {
      try {
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await publishLocation(first);
        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
          (position) => { void publishLocation(position); },
        );
      } catch {
        // Permission or GPS failures leave the existing map flow usable.
      }
    })();

    return () => {
      active = false;
      watcher?.remove();
    };
  }, [activeAssignment?.id, activeAssignment?.status, locationPermissionGranted]);

  useEffect(() => {
    const incoming = route.params?.assignment;
    if (!incoming) return undefined;
    const timer = setTimeout(() => {
      setCaseClosedOnMap(false);
      setActiveAssignment(incoming);
      setPatients(buildInitialPatients(incoming));
      setFurtherInfo('');
      setProofPhoto(null);
      setFormError('');
      setNearestHospital(null);
      setQrResult(null);
      setError('');
    }, 0);
    return () => clearTimeout(timer);
  }, [route.params?.assignment]);

  useEffect(() => {
    if (activeAssignment || caseClosedOnMap) return undefined;
    let mounted = true;
    getResponderDispatches(undefined, user?.role)
      .then((list) => {
        if (!mounted) return;
        const found = list.find((d) =>
          ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'].includes(d.status),
        );
        if (found) {
          setActiveAssignment(found);
          setPatients(buildInitialPatients(found));
        }
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, [activeAssignment, caseClosedOnMap, user]);

  const patientPoint = useMemo(() => {
    if (activeAssignment && hasCoordinates(activeAssignment)) {
      return {
        lat: Number(activeAssignment.incident_latitude),
        lng: Number(activeAssignment.incident_longitude),
      };
    }
    return null;
  }, [activeAssignment]);

  useEffect(() => {
    if (!patientPoint || activeAssignment?.is_maintenance || isAgencyRole) {
      Promise.resolve().then(() => {
        setNearestHospital(null);
      });
    }
  }, [patientPoint, activeAssignment?.is_maintenance, isAgencyRole]);

  const hospitalPoint = useMemo(() => {
    if (activeAssignment?.is_maintenance) return null;
    if (nearestHospital && hasCoordinates(nearestHospital)) {
      return {
        lat: Number(nearestHospital.latitude),
        lng: Number(nearestHospital.longitude),
      };
    }
    return null;
  }, [activeAssignment?.is_maintenance, nearestHospital]);

  useEffect(() => {
    if (!patientPoint) return undefined;
    let active = true;

    (async () => {
      let origin = currentLocationRef.current;
      if (locationPermissionGranted) {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (active) {
            currentLocationRef.current = origin;
            setCurrentLocation(origin);
          }
        } catch {
          // Keep the incident map usable if the device cannot provide a fix.
        }
      }

      if (!active) return;
      const stops = activeAssignment?.is_maintenance
        ? [origin, patientPoint].filter(hasValidPoint)
        : [origin, patientPoint, hospitalPoint].filter(hasValidPoint);
      if (stops.length < 2) return;

      try {
        const road = await getMultiStopRoadRoute(stops);
        if (!active) return;
        if (road) {
          setRoutePoints(road.points);
          setRouteInfo({
            distanceKm: road.distanceKm,
            durationMin: road.durationMin,
            trafficLabel: road.trafficLabel,
            instruction: road.instruction,
          });
        } else {
          setRoutePoints(stops);
          setRouteInfo(null);
        }
      } catch {
        if (active) setRoutePoints(stops);
      }
    })();

    return () => {
      active = false;
    };
  }, [patientPoint, hospitalPoint, isNavigating, locationPermissionGranted, activeAssignment?.is_maintenance]);

  const incidents = useMemo(() => {
    if (activeAssignment && patientPoint) {
      return [
        {
          id: activeAssignment.incident_id || activeAssignment.id,
          title: activeAssignment.incident_title,
          category: activeAssignment.is_maintenance ? 'infrastructure' : activeAssignment.incident_category,
          urgency: activeAssignment.urgency || 'Standard',
          address: activeAssignment.incident_location,
          reporter_name: activeAssignment.reporter_name,
          reporter_phone: activeAssignment.reporter_phone,
          description: activeAssignment.incident_description,
          lat: patientPoint.lat,
          lng: patientPoint.lng,
          pinType: activeAssignment.is_maintenance ? 'maintenance' : 'patient',
        },
      ];
    }

    return [];
  }, [activeAssignment, patientPoint]);

  const hospitalDropOffs = useMemo(() => {
    if (activeAssignment?.is_maintenance) return [];
    if (activeAssignment && nearestHospital && hospitalPoint) {
      return [
        {
          id: `hospital-${nearestHospital.id}`,
          title: nearestHospital.name,
          address: nearestHospital.address,
          distance_km: nearestHospital.distance_km,
          lat: hospitalPoint.lat,
          lng: hospitalPoint.lng,
          pinType: 'hospital',
        },
      ];
    }
    return [];
  }, [activeAssignment, nearestHospital, hospitalPoint]);

  const fitPoints = useMemo(
    () => (activeAssignment ? [currentLocation, patientPoint, hospitalPoint].filter(hasValidPoint) : null),
    [activeAssignment, currentLocation, patientPoint, hospitalPoint],
  );

  const handleOpenCompleteForm = () => {
    if (!activeAssignment) return;
    setPatients((prev) =>
      prev.length > 0 && prev[0].full_name ? prev : buildInitialPatients(activeAssignment),
    );
    const cleanedDesc = String(activeAssignment.incident_description || '')
      .replace(/\r?\n?\s*Selected\s+details\s*:[^\r\n]*/gi, '')
      .trim();
    setFurtherInfo((prev) => (prev.trim() ? prev : cleanedDesc));
    setFormError('');
    setShowPatientModal(true);
  };

  const handlePickProofPhoto = async (useCamera = true) => {
    setFormError('');
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        setFormError('Camera / photo permission is required to attach transport proof.');
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.4,
          base64: true,
        })
        : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.4,
          base64: true,
        });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setProofPhoto({
          uri: asset.uri,
          base64: asset.base64 || '',
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch {
      setFormError('Unable to capture photo. Please try again.');
    }
  };

  const handleLocateNearbyHospital = async () => {
    if (busy || isAgencyRole) return;
    if (nearestHospital) {
      setNearestHospital(null);
      setSelectedPin((prev) => (prev?.pinType === 'hospital' ? null : prev));
      return;
    }
    const refPoint = patientPoint || currentLocation;
    if (!refPoint) return;
    setBusy(true);
    setError('');
    try {
      const list = await getNearestHospitals(refPoint.lat, refPoint.lng);
      if (list.length > 0) {
        setHospitalOptions(list.slice(0, 3));
        setShowHospitalPicker(true);
      } else {
        setError('No nearby hospital found.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmArrivedOnScene = async () => {
    if (!activeAssignment || busy || activeAssignment.status === 'ON_SCENE') return;
    setBusy(true);
    setError('');
    try {
      await markArrivedOnScene(activeAssignment.id, {
        incident_id: activeAssignment.incident_id,
      });
      setActiveAssignment((prev) => (prev ? { ...prev, status: 'ON_SCENE' } : prev));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleArrivedOnScene = () => {
    if (!activeAssignment || busy || activeAssignment.status === 'ON_SCENE') return;
    Alert.alert(
      'Confirm Arrival on Scene',
      'Have you arrived at the incident scene? Confirming will notify BDRRMO and the reporting resident.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Arrived',
          onPress: () => {
            void confirmArrivedOnScene();
          },
        },
      ],
    );
  };

  const handleRequestBackup = async () => {
    if (!activeAssignment || busy || backupSent) return;
    setBusy(true);
    setError('');
    try {
      await requestFieldBackup(activeAssignment.id, {
        incident_id: activeAssignment.incident_id,
        requested_support: 'Tanod Emergency Transport / Backup',
        reason: `${userRole.toUpperCase()} requested field backup on scene`,
      });
      setBackupSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const isHospitalHandover = !isAgencyRole && Boolean(nearestHospital);

  const personValidationErrors = useMemo(
    () => (isHospitalHandover ? patients.map((p) => validatePersonEntry(p)) : []),
    [isHospitalHandover, patients],
  );
  const furtherInfoTrimmed = furtherInfo.trim();
  const furtherInfoError =
    furtherInfoTrimmed.length < 10
      ? 'Minimum 10 characters required.'
      : furtherInfoTrimmed.length > 2000
        ? 'Maximum 2000 characters allowed.'
        : '';
  const isHandoverFormValid =
    Boolean(proofPhoto) &&
    !furtherInfoError &&
    (!isHospitalHandover || personValidationErrors.every((errs) => Object.keys(errs).length === 0));

  const handleSubmitPatientForm = async () => {
    if (!activeAssignment || busy) return;

    const normalizedPatients = isHospitalHandover
      ? patients.map((p) => ({
        full_name: sanitizePersonName(p.full_name).trim(),
        contact: sanitizeContactNumber(p.contact).trim(),
        age: sanitizeAge(p.age).trim(),
        sex: p.sex === 'Male' || p.sex === 'Female' ? p.sex : '',
        condition: String(p.condition || '').trim(),
        notes: String(p.notes || '').trim(),
      }))
      : [];

    if (isHospitalHandover) {
      for (let i = 0; i < normalizedPatients.length; i += 1) {
        const errs = validatePersonEntry(normalizedPatients[i]);
        const firstErr = Object.values(errs)[0];
        if (firstErr) {
          const label = i === 0 ? "Reporter's Information" : `Additional Person #${i}`;
          setFormError(`${label}: ${firstErr}`);
          return;
        }
      }
    }

    const trimmedInfo = furtherInfo.trim();
    if (trimmedInfo.length < 10) {
      setFormError('Short Description / Further Information is required (minimum 10 characters).');
      return;
    }
    if (trimmedInfo.length > 2000) {
      setFormError('Short Description / Further Information must be 2000 characters or fewer.');
      return;
    }

    if (!proofPhoto) {
      setFormError(
        isHospitalHandover
          ? 'Please attach a proof photo showing the patient was transported.'
          : 'Please attach a proof of completion photo for BDRRMO and Admin.',
      );
      return;
    }
    setBusy(true);
    setError('');
    setFormError('');
    try {
      if (!isHospitalHandover) {
        await completeAgencyDispatch(activeAssignment.id, {
          incident_id: activeAssignment.incident_id,
          summary: trimmedInfo,
          proof_photo_base64: proofPhoto.base64,
          proof_photo_mime: proofPhoto.mimeType,
          persons: [],
        });
        setIsNavigating(false);
        setCaseClosedOnMap(true);
        setActiveAssignment(null);
        setRoutePoints([]);
        setRouteInfo(null);
        setNearestHospital(null);
        setSelectedPin(null);
        setShowPatientModal(false);
        navigation.navigate('History');
        return;
      }

      const res = await generateHospitalQrHandover(activeAssignment.id, {
        incident_id: activeAssignment.incident_id,
        hospital_name: nearestHospital?.name || 'Receiving Hospital',
        further_info: trimmedInfo,
        proof_photo_base64: proofPhoto.base64,
        proof_photo_mime: proofPhoto.mimeType,
        patients: normalizedPatients,
      });
      setQrResult({
        ...res,
        incident_id: activeAssignment.incident_id,
        agency_role: 'tanod',
      });
      setIsNavigating(false);
      setCaseClosedOnMap(true);
      setActiveAssignment(null);
      setRoutePoints([]);
      setRouteInfo(null);
      setNearestHospital(null);
      setSelectedPin(null);
      setShowPatientModal(false);
    } catch (err) {
      if (isNetworkError(err)) {
        const queuedCount = await enqueueOfflineSubmission({
          kind: !isHospitalHandover ? 'agency_resolution' : 'tanod_qr_handover',
          dispatchId: activeAssignment.id,
          payload: !isHospitalHandover
            ? {
              incident_id: activeAssignment.incident_id,
              summary: trimmedInfo,
              proof_photo_base64: proofPhoto.base64,
              proof_photo_mime: proofPhoto.mimeType,
              persons: [],
            }
            : {
              incident_id: activeAssignment.incident_id,
              hospital_name: nearestHospital?.name || 'Receiving Hospital',
              further_info: trimmedInfo,
              proof_photo_base64: proofPhoto.base64,
              proof_photo_mime: proofPhoto.mimeType,
              patients: normalizedPatients,
            },
        });
        setOfflineQueueCount(queuedCount);
        setShowPatientModal(false);
        setError('No signal — report & photo saved offline and will auto-sync when online.');
      } else {
        setFormError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCancelMaintenanceTrack = () => {
    setIsNavigating(false);
    setCaseClosedOnMap(true);
    setActiveAssignment(null);
    setRoutePoints([]);
    setRouteInfo(null);
    setNearestHospital(null);
    setSelectedPin(null);
    navigation.navigate('Assignments');
  };

  const handleOpenMaintenanceModal = (mode) => {
    setMaintenanceModalMode(mode);
    setMaintenanceNote('');
    setMaintenancePhoto(null);
    setMaintenanceError('');
  };

  const handlePickMaintenancePhoto = async (useCamera = true) => {
    setMaintenanceError('');
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        setMaintenanceError('Camera / gallery permission is required.');
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.4, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.4, base64: true });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setMaintenancePhoto({
          uri: asset.uri,
          base64: asset.base64 || '',
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch {
      setMaintenanceError('Unable to select photo. Please try again.');
    }
  };

  const handleSubmitMaintenanceProof = async () => {
    if (!activeAssignment || busy) return;
    if (!maintenancePhoto || !maintenanceNote.trim()) {
      setMaintenanceError('Please provide both a photo and a note for the Admin.');
      return;
    }
    setBusy(true);
    setMaintenanceError('');
    try {
      if (maintenanceModalMode === 'inspection') {
        await submitMaintenanceInspection(activeAssignment.id, {
          incident_id: activeAssignment.incident_id,
          note: maintenanceNote.trim(),
          photo_base64: maintenancePhoto.base64,
          photo_mime: maintenancePhoto.mimeType,
        });
        setActiveAssignment((prev) =>
          prev ? { ...prev, inspection_done: true, status: 'EN_ROUTE' } : prev,
        );
        setMaintenanceModalMode(null);
      } else {
        await submitMaintenanceRepair(activeAssignment.id, {
          incident_id: activeAssignment.incident_id,
          note: maintenanceNote.trim(),
          photo_base64: maintenancePhoto.base64,
          photo_mime: maintenancePhoto.mimeType,
        });
        setMaintenanceModalMode(null);
        setIsNavigating(false);
        setCaseClosedOnMap(true);
        setActiveAssignment(null);
        setRoutePoints([]);
        setRouteInfo(null);
        setNearestHospital(null);
        setSelectedPin(null);
        navigation.navigate('History');
      }
    } catch (err) {
      setMaintenanceError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const headingPoints = useMemo(() => {
    const valid = routePoints.filter(hasValidPoint);
    if (valid.length > 1) return valid;
    return [currentLocation, patientPoint, hospitalPoint].filter(hasValidPoint);
  }, [routePoints, currentLocation, patientPoint, hospitalPoint]);

  return (
    <View style={tw`flex-1`}>
      {offlineQueueCount > 0 ? (
        <View style={tw`z-30 flex-row items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-2`}>
          <Text style={tw`mr-2 flex-1 text-[11px] font-bold text-blue-900`}>
            {offlineQueueCount} resolution report(s) queued offline
          </Text>
          <Pressable
            onPress={() => void syncOfflineSubmissions()}
            disabled={syncingOffline}
            style={tw`rounded-lg bg-blue-700 px-3 py-1.5`}
          >
            <Text style={tw`text-[10px] font-bold text-white`}>
              {syncingOffline ? 'Syncing...' : 'Retry Sync'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {locationSharingOff ? (
        <View style={tw`z-20 flex-row items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2.5`}>
          <View style={tw`mr-3 flex-1 flex-row items-start gap-2`}>
            <MapPin size={16} color="#B45309" style={tw`mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={tw`text-xs font-extrabold text-amber-900`}>Location sharing is off</Text>
              <Text style={tw`mt-0.5 text-[11px] leading-4 text-amber-800`}>You can still use this map manually. Turn on location to share your position.</Text>
            </View>
          </View>
          <Pressable
            onPress={() => void tryEnableLocationSharing()}
            style={({ pressed }) => [tw`rounded-lg bg-white px-3 py-2`, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={tw`text-[11px] font-bold text-green-800`}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={tw`flex-1`}>
        <MapViewer
          variant="viewer"
          incidents={incidents}
          dropOffs={hospitalDropOffs}
          disableIncidentSheet={Boolean(activeAssignment)}
          onIncidentSelect={(pin) => setSelectedPin(pin)}
          selectedLocation={null}
          routes={
            activeAssignment && routePoints.filter(hasValidPoint).length > 1
              ? [
                {
                  id: `route-${activeAssignment?.id || 'active'}`,
                  points: routePoints.filter(hasValidPoint),
                  color: '#1F7A4D',
                  dashed: false,
                },
              ]
              : []
          }
          trackers={
            activeAssignment && currentLocation
              ? [{ id: 'responder-current', ...currentLocation }]
              : []
          }
          fitPoints={fitPoints}
          navigationMode={isNavigating}
          navigationHeading={getRouteHeading(headingPoints)}
          recenterSignal={recenterKey}
          compassResetSignal={compassResetKey}
          navigationUserLocation={currentLocation}
          showBackButton
          onBack={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('Home');
          }}
          topInset={0}
          bottomInset={activeAssignment ? 260 : 0}
          showBasemapControl={false}
          hideMapLabel
          showMapInfoButton={false}
          showZoomControls={false}
          showBoundary={false}
          highlightBoundary={false}
          compact={false}
        />
      </View>

      {selectedPin && activeAssignment ? (
        <View
          style={tw`absolute left-3 right-3 ${isNavigating ? 'top-24' : 'top-16'} z-50 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl`}
        >
          <View style={tw`flex-row items-center justify-between gap-2`}>
            <View
              style={tw`flex-shrink rounded-lg px-2.5 py-1 ${
                selectedPin.pinType === 'hospital'
                  ? 'bg-blue-50'
                  : selectedPin.pinType === 'maintenance'
                    ? 'bg-green-50'
                    : 'bg-red-50'
              }`}
            >
              <Text
                numberOfLines={1}
                style={tw`text-[10px] font-extrabold uppercase ${
                  selectedPin.pinType === 'hospital'
                    ? 'text-blue-700'
                    : selectedPin.pinType === 'maintenance'
                      ? 'text-[#1F7A4D]'
                      : 'text-red-700'
                }`}
              >
                {selectedPin.pinType === 'hospital'
                  ? 'Nearest Hospital'
                  : selectedPin.pinType === 'maintenance'
                    ? `Maintenance Site • ${activeAssignment?.incident_category || 'Maintenance'}`
                    : `${isAgencyRole ? 'Incident Scene' : 'Patient Pickup'} • ${selectedPin.category || 'Emergency'}`}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedPin(null)}
              hitSlop={10}
              style={tw`h-7 w-7 items-center justify-center rounded-full bg-slate-100`}
            >
              <X size={14} color="#334155" />
            </Pressable>
          </View>

          <Text style={tw`mt-2 text-sm font-extrabold text-slate-900`}>
            {selectedPin.title}
          </Text>

          {selectedPin.address ? (
            <Text style={tw`mt-0.5 text-xs text-slate-600`}>
              {selectedPin.address}
              {selectedPin.distance_km != null ? ` • ${selectedPin.distance_km} km away` : ''}
            </Text>
          ) : null}

          {selectedPin.pinType !== 'hospital' && selectedPin.reporter_name ? (
            <Text style={tw`mt-1 text-xs font-semibold text-slate-700`}>
              Reporter: {selectedPin.reporter_name}
              {selectedPin.reporter_phone ? ` (${selectedPin.reporter_phone})` : ''}
            </Text>
          ) : null}

          {selectedPin.pinType !== 'hospital' && selectedPin.description ? (
            <Text style={tw`mt-1 text-xs text-slate-500`} numberOfLines={2}>
              {selectedPin.description}
            </Text>
          ) : null}
        </View>
      ) : null}

      {activeAssignment && isNavigating ? (
        <View pointerEvents="box-none" style={tw`absolute inset-0`}>
          {/* Turn-by-turn top direction banner */}
          <View style={tw`absolute left-3 right-3 top-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-xl`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`h-11 w-11 items-center justify-center rounded-xl bg-[#1F7A4D]`}>
                <Navigation size={22} color="#FFFFFF" />
              </View>
              <View style={tw`ml-3 flex-1`}>
                <Text numberOfLines={2} style={tw`text-sm font-extrabold text-slate-900`}>
                  {routeInfo?.instruction || 'Follow the highlighted route'}
                </Text>
                <Text numberOfLines={1} style={tw`mt-0.5 text-xs font-medium text-slate-500`}>
                  {activeAssignment.is_maintenance
                    ? `To ${activeAssignment.incident_location || 'Maintenance Site'}`
                    : isAgencyRole
                      ? `${activeAssignment.incident_location || 'Incident Scene'}${nearestHospital ? ` → ${nearestHospital.name}` : ''}`
                      : `Patient Pickup → ${nearestHospital ? nearestHospital.name : 'Nearest Hospital'}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={tw`absolute right-3 top-24 gap-2`}>
            <Pressable
              onPress={() => setCompassResetKey((k) => k + 1)}
              style={tw`h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md`}
            >
              <Compass
                size={19}
                color="#DC2626"
                style={{ transform: [{ rotate: `${getRouteHeading(headingPoints)}deg` }] }}
              />
            </Pressable>
            <Pressable
              onPress={() => setNavigationMuted((m) => !m)}
              style={tw`h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md`}
            >
              {navigationMuted ? <VolumeX size={19} color="#64748B" /> : <Volume2 size={19} color="#0F172A" />}
            </Pressable>
            <Pressable
              onPress={() => setRecenterKey((k) => k + 1)}
              style={tw`h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md`}
            >
              <Route size={19} color="#1F7A4D" />
            </Pressable>
          </View>

          <View style={tw`absolute bottom-36 left-3 right-3 flex-row flex-wrap items-center justify-between gap-2`}>
            <Pressable
              onPress={() => {
                if (!locationPermissionGranted || !currentLocationRef.current) {
                  void tryEnableLocationSharing();
                }
                setRecenterKey((k) => k + 1);
              }}
              style={tw`flex-row items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 shadow-md`}
            >
              <Navigation size={14} color="#1F7A4D" />
              <Text style={tw`ml-1.5 text-xs font-extrabold text-[#1F7A4D]`}>Re-center</Text>
            </Pressable>
            {!isAgencyRole && !activeAssignment.is_maintenance ? (
              <Pressable
                onPress={handleLocateNearbyHospital}
                disabled={busy}
                style={tw`flex-row items-center rounded-full ${nearestHospital ? 'bg-amber-600' : 'bg-[#1F7A4D]'} px-3.5 py-2 shadow-md`}
              >
                {nearestHospital ? <X size={14} color="#fff" /> : <Hospital size={14} color="#fff" />}
                <Text style={tw`ml-1.5 text-xs font-bold text-white`}>
                  {nearestHospital ? 'Clear Hospital' : 'Nearest Hospital'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Bottom ETA & action bar */}
          <View style={tw`absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-slate-200 bg-white px-4 pb-4 pt-3.5 shadow-2xl`}>
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-1 pr-3`}>
                <View style={tw`flex-row items-baseline gap-2`}>
                  <Text style={tw`text-2xl font-extrabold text-[#1F7A4D]`}>
                    {routeInfo ? formatDuration(routeInfo.durationMin) : 'Calculating...'}
                  </Text>
                  {routeInfo ? (
                    <Text style={tw`text-xs font-bold text-slate-500`}>
                      ({routeInfo.distanceKm} km)
                    </Text>
                  ) : null}
                </View>
                <Text style={tw`mt-0.5 text-xs font-medium text-slate-500`}>
                  {routeInfo
                    ? `${routeInfo.trafficLabel || 'Live traffic'} • Arrive ${getArrivalTime(routeInfo.durationMin)}`
                    : currentLocation
                      ? 'Calculating fastest road route...'
                      : 'Acquiring GPS location for route...'}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsNavigating(false)}
                style={tw`flex-row items-center rounded-full bg-slate-100 px-3.5 py-2`}
              >
                <X size={14} color="#0F172A" />
                <Text style={tw`ml-1 text-xs font-extrabold text-slate-800`}>Exit</Text>
              </Pressable>
            </View>

            <View style={tw`mt-3 flex-row gap-2`}>
              {activeAssignment.is_maintenance ? (
                <>
                  <Pressable
                    onPress={handleCancelMaintenanceTrack}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5`}
                  >
                    <X size={15} color="#0F172A" />
                    <Text style={tw`text-xs font-bold text-slate-800`}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handleOpenMaintenanceModal(
                        activeAssignment.inspection_done ? 'repair' : 'inspection',
                      )
                    }
                    disabled={busy}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`}
                  >
                    <CheckCircle2 size={15} color="#FFFFFF" />
                    <Text style={tw`text-xs font-bold text-white`}>
                      {activeAssignment.inspection_done ? 'Submit Repair' : 'Inspect'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => navigation.navigate('Messages', { assignment: activeAssignment })}
                    style={tw`flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5`}
                  >
                    <MessageCircle size={15} color="#0F172A" />
                    <Text style={tw`text-xs font-bold text-slate-800`}>Message</Text>
                  </Pressable>

                  {activeAssignment.status === 'ON_SCENE' ? (
                    <Pressable
                      onPress={handleOpenCompleteForm}
                      disabled={busy}
                      style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`}
                    >
                      <CheckCircle2 size={15} color="#FFFFFF" />
                      <Text style={tw`text-xs font-extrabold text-white`}>Mark as Completed</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleArrivedOnScene}
                      disabled={busy}
                      style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5`}
                    >
                      <MapPin size={15} color="#FFFFFF" />
                      <Text style={tw`text-xs font-extrabold text-white`}>Arrived on Scene</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {activeAssignment && !isNavigating ? (() => {
        const statusStyle = getStatusStyle(activeAssignment);
        const isMaint = Boolean(activeAssignment.is_maintenance);

        return (
          <View style={tw`absolute bottom-3 left-3 right-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl`}>
            {/* Top badges row: non-overlapping Category + Color-coded Status */}
            <View style={tw`flex-row flex-wrap items-center justify-between gap-1.5`}>
              <View
                style={tw`flex-shrink flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${
                  isMaint ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {isMaint ? (
                  <Wrench size={13} color="#1F7A4D" />
                ) : (
                  <AlertTriangle size={13} color="#DC2626" />
                )}
                <Text
                  numberOfLines={1}
                  style={tw`flex-shrink pr-0.5 text-[11px] font-bold ${
                    isMaint ? 'text-[#1F7A4D]' : 'text-red-700'
                  }`}
                >
                  {(isMaint
                    ? `Maintenance • ${activeAssignment.urgency || 'Standard'}`
                    : `${activeAssignment.incident_category || 'Emergency'} • ${activeAssignment.urgency || 'Urgent'}`
                  ).toUpperCase()}
                </Text>
              </View>

              <View
                style={tw`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${statusStyle.bg}`}
              >
                <View style={[tw`h-1.5 w-1.5 rounded-full`, { backgroundColor: statusStyle.dot }]} />
                <Text style={tw`pr-0.5 text-[10px] font-bold ${statusStyle.text}`}>
                  {statusStyle.label}
                </Text>
              </View>
            </View>

            {/* Title & Location */}
            <Text style={tw`mt-2 text-base font-extrabold text-slate-900`} numberOfLines={1}>
              {formatTitleCase(activeAssignment.incident_title)}
            </Text>

            {activeAssignment.incident_location ? (
              <View style={tw`mt-1 flex-row items-center gap-1.5`}>
                <MapPin size={13} color="#64748B" />
                <Text style={tw`flex-1 text-xs font-medium text-slate-600`} numberOfLines={1}>
                  {isMaint || isAgencyRole
                    ? activeAssignment.incident_location
                    : `Pickup: ${activeAssignment.incident_location}`}
                </Text>
              </View>
            ) : null}

            {!isMaint && nearestHospital ? (
              <View style={tw`mt-1 flex-row items-center gap-1.5`}>
                <Hospital size={13} color="#2563EB" />
                <Text style={tw`flex-1 text-xs font-semibold text-blue-700`} numberOfLines={1}>
                  Hospital: {nearestHospital.name}
                  {nearestHospital.distance_km != null ? ` (${nearestHospital.distance_km} km)` : ''}
                </Text>
              </View>
            ) : null}

            {/* Route summary pill */}
            {routeInfo ? (
              <View style={tw`mt-2.5 flex-row items-center justify-between rounded-xl border border-green-200 bg-green-50/70 px-3 py-2`}>
                <View style={tw`flex-row items-center gap-1.5`}>
                  <Navigation size={13} color="#1F7A4D" />
                  <Text style={tw`text-xs font-extrabold text-[#1F7A4D]`}>
                    {formatDuration(routeInfo.durationMin)}
                  </Text>
                  <Text style={tw`text-xs font-semibold text-slate-600`}>
                    • {routeInfo.distanceKm} km
                  </Text>
                </View>
                <Text style={tw`text-[11px] font-semibold text-slate-500`}>
                  {routeInfo.trafficLabel || 'Live traffic'} • ETA {getArrivalTime(routeInfo.durationMin)}
                </Text>
              </View>
            ) : null}

            {activeAssignment.tactical_note ? (
              <View style={tw`mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2`}>
                <Text style={tw`text-[10px] font-extrabold uppercase text-amber-800`}>
                  BDRRMO Tactical Note
                </Text>
                <Text style={tw`mt-0.5 text-xs text-amber-950`}>
                  {String(activeAssignment.tactical_note).replace('[BDRRMO NOTE] ', '')}
                </Text>
              </View>
            ) : null}

            {/* Secondary quick chips (Hospital for Tanod only / Backup for Police & BFP) */}
            {!isMaint && !isAgencyRole ? (
              <View style={tw`mt-2.5 flex-row gap-2`}>
                <Pressable
                  onPress={handleLocateNearbyHospital}
                  disabled={busy}
                  style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border ${
                    nearestHospital ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                  } py-2`}
                >
                  {nearestHospital ? <X size={13} color="#B45309" /> : <Hospital size={13} color="#1F7A4D" />}
                  <Text
                    style={tw`text-[11px] font-bold ${nearestHospital ? 'text-amber-900' : 'text-slate-700'}`}
                  >
                    {nearestHospital ? 'Clear Hospital' : 'Nearby Hospital'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {isAgencyRole && !isMaint ? (
              <View style={tw`mt-2.5 flex-row gap-2`}>
                <Pressable
                  onPress={handleRequestBackup}
                  disabled={busy || backupSent}
                  style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border ${
                    backupSent ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'
                  } py-2`}
                >
                  <ShieldAlert size={13} color={backupSent ? '#1F7A4D' : '#475569'} />
                  <Text
                    numberOfLines={1}
                    style={tw`text-[11px] font-bold ${backupSent ? 'text-[#1F7A4D]' : 'text-slate-700'}`}
                  >
                    {backupSent ? 'Backup Sent ✓' : 'Request Backup'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {error ? (
              <Text style={tw`mt-2 text-xs font-semibold text-red-600`}>{error}</Text>
            ) : null}

            {/* Primary Turn-by-Turn Navigation CTA */}
            <Pressable
              onPress={() => {
                if (!locationPermissionGranted || !currentLocationRef.current) {
                  void tryEnableLocationSharing();
                }
                setIsNavigating(true);
                setRecenterKey((k) => k + 1);
              }}
              style={({ pressed }) => [
                tw`mt-2.5 flex-row items-center justify-center gap-2 rounded-xl bg-[#1F7A4D] py-3`,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Navigation size={15} color="#FFFFFF" />
              <Text style={tw`text-xs font-extrabold text-white`}>
                Start Turn-by-Turn Navigation
              </Text>
            </Pressable>

            {/* Bottom actions: Message + Status progression */}
            <View style={tw`mt-2 flex-row gap-2`}>
              {isMaint ? (
                <>
                  <Pressable
                    onPress={handleCancelMaintenanceTrack}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5`}
                  >
                    <X size={15} color="#0F172A" />
                    <Text style={tw`text-xs font-bold text-slate-800`}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      handleOpenMaintenanceModal(
                        activeAssignment.inspection_done ? 'repair' : 'inspection',
                      )
                    }
                    disabled={busy}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`}
                  >
                    <Wrench size={14} color="#FFFFFF" />
                    <Text style={tw`text-xs font-bold text-white`}>
                      {activeAssignment.inspection_done ? 'Submit Repair' : 'Document Inspection'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => navigation.navigate('Messages', { assignment: activeAssignment })}
                    style={({ pressed }) => [
                      tw`flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5`,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <MessageCircle size={15} color="#0F172A" />
                    <Text style={tw`text-xs font-bold text-slate-800`}>Message</Text>
                  </Pressable>

                  {activeAssignment.status === 'ON_SCENE' || qrResult ? (
                    <Pressable
                      onPress={handleOpenCompleteForm}
                      disabled={busy}
                      style={({ pressed }) => [
                        tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <CheckCircle2 size={15} color="#FFFFFF" />
                      <Text style={tw`text-xs font-extrabold text-white`}>
                        {qrResult ? 'View QR / Info' : 'Mark as Completed'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleArrivedOnScene}
                      disabled={busy}
                      style={({ pressed }) => [
                        tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5`,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <MapPin size={15} color="#FFFFFF" />
                      <Text style={tw`text-xs font-extrabold text-white`}>Arrived on Scene</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </View>
        );
      })() : null}

      <Modal
        visible={Boolean(maintenanceModalMode)}
        transparent
        animationType="slide"
        onRequestClose={() => setMaintenanceModalMode(null)}
      >
        <Pressable onPress={Keyboard.dismiss} style={tw`flex-1 justify-end bg-black/45`}>
          <View style={tw`rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
            <Text style={tw`text-lg font-extrabold text-slate-900`}>
              {maintenanceModalMode === 'repair'
                ? 'Submit Proof of Repair'
                : 'Document On-Site Inspection'}
            </Text>
            <Text style={tw`mt-1 text-xs text-slate-500`}>
              {maintenanceModalMode === 'repair'
                ? 'Upload a photo of the completed repair and add a completion note for the Admin.'
                : 'Upload a photo proving you inspected the maintenance area and add a note for the Admin.'}
            </Text>

            <View style={tw`mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3`}>
              <Text style={tw`text-xs font-bold text-slate-800`}>
                {maintenanceModalMode === 'repair' ? 'Repair Completion Photo *' : 'Inspection Arrival Photo *'}
              </Text>
              {maintenancePhoto ? (
                <View style={tw`mt-2`}>
                  <Image
                    source={{ uri: maintenancePhoto.uri }}
                    style={tw`h-40 w-full rounded-xl bg-slate-200`}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => setMaintenancePhoto(null)}
                    style={tw`mt-2 flex-row items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2`}
                  >
                    <Trash2 size={13} color="#DC2626" />
                    <Text style={tw`text-xs font-bold text-red-600`}>Remove Photo</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={tw`mt-2.5 flex-row gap-2`}>
                  <Pressable
                    onPress={() => handlePickMaintenancePhoto(true)}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`}
                  >
                    <Camera size={14} color="#FFFFFF" />
                    <Text style={tw`text-xs font-bold text-white`}>Capture Photo (Camera Only)</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={tw`mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3`}>
              <Text style={tw`text-xs font-bold text-slate-800`}>Note for Admin *</Text>
              <TextInput
                value={maintenanceNote}
                onChangeText={setMaintenanceNote}
                placeholder={
                  maintenanceModalMode === 'repair'
                    ? 'Describe the completed repair work...'
                    : 'Describe site conditions, materials or budget needed...'
                }
                multiline
                style={tw`mt-2 min-h-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
              />
            </View>

            {maintenanceError ? (
              <Text style={tw`mt-2 text-xs font-semibold text-red-600`}>{maintenanceError}</Text>
            ) : null}

            <View style={tw`mt-4 flex-row gap-2.5`}>
              <Pressable
                onPress={() => setMaintenanceModalMode(null)}
                style={tw`flex-1 items-center rounded-xl bg-slate-100 py-3`}
              >
                <Text style={tw`text-xs font-bold text-slate-700`}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitMaintenanceProof}
                disabled={busy}
                style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] py-3`}
              >
                <Text style={tw`text-xs font-bold text-white`}>
                  {busy
                    ? 'Submitting...'
                    : maintenanceModalMode === 'repair'
                      ? 'Submit Repair Proof'
                      : 'Submit Inspection'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showPatientModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPatientModal(false)}
      >
        <Pressable onPress={Keyboard.dismiss} style={tw`flex-1 justify-end bg-black/40`}>
          <View style={tw`max-h-[82%] rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
            <Text style={tw`text-lg font-extrabold text-slate-900`}>
              {isHospitalHandover
                ? 'Hospital Handover & Patient Information'
                : userRole === 'police'
                  ? 'Police Scene Completion Report'
                  : userRole === 'fire'
                    ? 'Fire Scene Completion Report'
                    : 'Scene Completion Report'}
            </Text>
            <Text style={tw`mt-1 text-xs text-slate-500`}>
              {isHospitalHandover
                ? 'Auto-filled from the emergency report. Review or add individuals before generating the hospital handover QR code.'
                : 'Provide additional information and capture a real-time proof of completion photo for BDRRMO.'}
            </Text>

            <ScrollView
              style={tw`mt-3`}
              contentContainerStyle={tw`gap-3 pb-4`}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {isHospitalHandover ? (
                <>
                  {patients.map((person, index) => {
                const errs = personValidationErrors[index] || {};
                return (
                  <View key={index} style={tw`rounded-2xl border border-slate-200 bg-slate-50 p-3`}>
                    <View style={tw`flex-row items-center justify-between`}>
                      <Text style={tw`text-xs font-bold text-slate-800`}>
                        {index === 0 ? "Reporter's Information" : `Additional Person #${index}`}
                      </Text>
                      {index > 0 ? (
                        <Pressable
                          onPress={() =>
                            setPatients((prev) => prev.filter((_, i) => i !== index))
                          }
                          style={tw`flex-row items-center gap-1 rounded-lg bg-red-50 px-2 py-1`}
                        >
                          <Trash2 size={12} color="#DC2626" />
                          <Text style={tw`text-[10px] font-bold text-red-600`}>Delete</Text>
                        </Pressable>
                      ) : (
                        <Text style={tw`text-[10px] font-semibold text-[#1F7A4D]`}>
                          Auto-filled
                        </Text>
                      )}
                    </View>
                    <TextInput
                      value={person.full_name}
                      onChangeText={(val) =>
                        setPatients((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, full_name: sanitizePersonName(val) } : p)),
                        )
                      }
                      maxLength={80}
                      placeholder="Full Name * (letters, spaces, . and - only)"
                      style={tw`mt-2 rounded-xl border ${errs.full_name ? 'border-red-300' : 'border-slate-200'} bg-white px-3 py-2 text-xs text-slate-900`}
                    />
                    {errs.full_name ? (
                      <Text style={tw`mt-1 text-[10px] font-semibold text-red-600`}>{errs.full_name}</Text>
                    ) : null}

                    <TextInput
                      value={person.contact}
                      onChangeText={(val) =>
                        setPatients((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, contact: sanitizeContactNumber(val) } : p)),
                        )
                      }
                      keyboardType="numeric"
                      maxLength={11}
                      placeholder="Contact Number (09XXXXXXXXX, digits only)"
                      style={tw`mt-2 rounded-xl border ${errs.contact ? 'border-red-300' : 'border-slate-200'} bg-white px-3 py-2 text-xs text-slate-900`}
                    />
                    {errs.contact ? (
                      <Text style={tw`mt-1 text-[10px] font-semibold text-red-600`}>{errs.contact}</Text>
                    ) : null}

                    <View style={tw`mt-2 flex-row items-center gap-2`}>
                      <TextInput
                        value={person.age}
                        onChangeText={(val) =>
                          setPatients((prev) =>
                            prev.map((p, i) => (i === index ? { ...p, age: sanitizeAge(val) } : p)),
                          )
                        }
                        placeholder="Age (0–120)"
                        keyboardType="numeric"
                        maxLength={3}
                        style={tw`w-24 rounded-xl border ${errs.age ? 'border-red-300' : 'border-slate-200'} bg-white px-3 py-2 text-xs text-slate-900`}
                      />
                      <View style={tw`flex-1 flex-row gap-1.5`}>
                        {['Male', 'Female'].map((sexOpt) => {
                          const selected = person.sex === sexOpt;
                          return (
                            <Pressable
                              key={sexOpt}
                              onPress={() =>
                                setPatients((prev) =>
                                  prev.map((p, i) => (i === index ? { ...p, sex: sexOpt } : p)),
                                )
                              }
                              style={tw`flex-1 items-center rounded-xl border py-2 ${
                                selected
                                  ? 'border-[#1F7A4D] bg-green-50'
                                  : errs.sex
                                    ? 'border-red-300 bg-white'
                                    : 'border-slate-200 bg-white'
                              }`}
                            >
                              <Text
                                style={tw`text-xs font-bold ${
                                  selected ? 'text-[#1F7A4D]' : 'text-slate-600'
                                }`}
                              >
                                {sexOpt}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    {errs.age || errs.sex ? (
                      <Text style={tw`mt-1 text-[10px] font-semibold text-red-600`}>
                        {[errs.age, errs.sex].filter(Boolean).join(' • ')}
                      </Text>
                    ) : null}

                    <TextInput
                      value={person.condition}
                      onChangeText={(val) =>
                        setPatients((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, condition: val.slice(0, 120) } : p)),
                        )
                      }
                      maxLength={120}
                      placeholder="Condition / Incident Type *"
                      style={tw`mt-2 rounded-xl border ${errs.condition ? 'border-red-300' : 'border-slate-200'} bg-white px-3 py-2 text-xs text-slate-900`}
                    />
                    {errs.condition ? (
                      <Text style={tw`mt-1 text-[10px] font-semibold text-red-600`}>{errs.condition}</Text>
                    ) : null}

                    <TextInput
                      value={person.notes}
                      onChangeText={(val) =>
                        setPatients((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, notes: val.slice(0, 500) } : p)),
                        )
                      }
                      maxLength={500}
                      placeholder="Patient / Person Notes (optional, max 500 chars)"
                      multiline
                      style={tw`mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
                    />
                    <Text style={tw`mt-0.5 text-right text-[10px] text-slate-400`}>
                      {String(person.notes || '').length}/500
                    </Text>
                  </View>
                );
              })}

              <Pressable
                onPress={() =>
                  setPatients((prev) => [
                    ...prev,
                    { full_name: '', contact: '', age: '', sex: '', condition: '', notes: '' },
                  ])
                }
                style={tw`flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5`}
              >
                <Plus size={14} color="#1F7A4D" />
                <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>+ Add Additional Person</Text>
              </Pressable>
                </>
              ) : null}

              <View style={tw`rounded-2xl border border-slate-200 bg-slate-50 p-3`}>
                <View style={tw`flex-row items-center justify-between`}>
                  <Text style={tw`text-xs font-bold text-slate-800`}>
                    {userRole === 'fire'
                      ? 'Additional Information / Fire Scene Summary *'
                      : 'Short Description / Further Information *'}
                  </Text>
                  <Text style={tw`text-[10px] text-slate-400`}>{furtherInfo.length}/2000</Text>
                </View>
                <TextInput
                  value={furtherInfo}
                  onChangeText={(val) => setFurtherInfo(val.slice(0, 2000))}
                  maxLength={2000}
                  placeholder={
                    isAgencyRole
                      ? 'Auto-filled from emergency report additional note. Add scene resolution summary...'
                      : 'Auto-filled from emergency report additional note. Add transport or handover remarks...'
                  }
                  multiline
                  style={tw`mt-2 min-h-16 rounded-xl border ${furtherInfoError ? 'border-red-300' : 'border-slate-200'} bg-white px-3 py-2 text-xs text-slate-900`}
                />
                {furtherInfoError ? (
                  <Text style={tw`mt-1 text-[10px] font-semibold text-red-600`}>{furtherInfoError}</Text>
                ) : null}
              </View>

              <View style={tw`rounded-2xl border border-slate-200 bg-slate-50 p-3`}>
                <Text style={tw`text-xs font-bold text-slate-800`}>
                  {isAgencyRole
                    ? 'Proof of Completion Photo *'
                    : 'Proof of Evidence (Successful Transport Photo) *'}
                </Text>
                <Text style={tw`mt-0.5 text-[11px] text-slate-500`}>
                  {isAgencyRole
                    ? 'Attach a photo showing the completed emergency scene resolution for BDRRMO & Admin.'
                    : 'Attach a photo showing the patient was successfully transported to the hospital.'}
                </Text>

                {proofPhoto ? (
                  <View style={tw`mt-2.5`}>
                    <Image
                      source={{ uri: proofPhoto.uri }}
                      style={tw`h-40 w-full rounded-xl bg-slate-200`}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => setProofPhoto(null)}
                      style={tw`mt-2 flex-row items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2`}
                    >
                      <Trash2 size={13} color="#DC2626" />
                      <Text style={tw`text-xs font-bold text-red-600`}>Remove Photo</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={tw`mt-2.5 flex-row gap-2`}>
                    <Pressable
                      onPress={() => handlePickProofPhoto(true)}
                      style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`}
                    >
                      <Camera size={14} color="#FFFFFF" />
                      <Text style={tw`text-xs font-bold text-white`}>Capture Photo (Camera Only)</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {formError ? (
                <Text style={tw`text-xs font-semibold text-red-600`}>{formError}</Text>
              ) : null}
            </ScrollView>

            <View style={tw`mt-3 flex-row gap-2.5`}>
              <Pressable
                onPress={() => setShowPatientModal(false)}
                style={tw`flex-1 items-center rounded-xl bg-slate-100 py-3`}
              >
                <Text style={tw`text-xs font-bold text-slate-700`}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitPatientForm}
                disabled={busy || !isHandoverFormValid}
                style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] py-3 ${busy || !isHandoverFormValid ? 'opacity-45' : ''}`}
              >
                <Text style={tw`text-xs font-bold text-white`}>
                  {busy
                    ? 'Submitting...'
                    : isHospitalHandover
                      ? 'Submit & Generate QR'
                      : 'Submit Completion Report'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(qrResult)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setQrResult(null);
          if (isAgencyRole) navigation.navigate('History');
        }}
      >
        <View style={tw`flex-1 items-center justify-center bg-black/50 px-6`}>
          <View style={tw`w-full items-center rounded-3xl bg-white p-6`}>
            <View style={tw`flex-row items-center gap-2`}>
              <QrCode size={20} color="#1F7A4D" />
              <Text style={tw`text-lg font-extrabold text-slate-900`}>
                {qrResult?.agency_role === 'police'
                  ? 'Police Incident Summary QR'
                  : qrResult?.agency_role === 'fire'
                    ? 'BFP Incident Summary QR'
                    : 'Hospital Handover Summary QR'}
              </Text>
            </View>
            <Text style={tw`mt-1 text-center text-xs text-slate-500`}>
              Scan this QR code to view or print the complete Incident Summary PDF (details, persons &amp; attached photos).
            </Text>

            {qrResult?.summary_pdf_url || qrResult?.token ? (
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    qrResult.summary_pdf_url
                      ? `${API_ORIGIN}${qrResult.summary_pdf_url}`
                      : `${API_ORIGIN}/api/reports/${encodeURIComponent(qrResult.incident_id || '')}/handover-summary`,
                  )}`,
                }}
                style={tw`mt-4 h-52 w-52 bg-slate-100`}
              />
            ) : null}

            {nearestHospital && qrResult?.agency_role === 'tanod' ? (
              <Text style={tw`mt-3 text-xs font-bold text-blue-900`}>
                Hospital: {nearestHospital.name}
              </Text>
            ) : null}
            <Text style={tw`mt-1 text-[11px] text-slate-600`}>
              Persons: {patients.length} • Proof Photo Attached • Token: {qrResult?.token?.slice(0, 8)}...
            </Text>
            {furtherInfo ? (
              <Text style={tw`mt-1 text-center text-[11px] text-slate-500`} numberOfLines={2}>
                Notes: {furtherInfo}
              </Text>
            ) : null}
            <View style={tw`mt-2 rounded-lg bg-green-50 px-3 py-1.5`}>
              <Text style={tw`text-center text-[10px] font-bold text-[#1F7A4D]`}>
                Completion report sent to BDRRMO for closure authorization
              </Text>
            </View>

            <Pressable
              onPress={() => {
                const pdfUrl = qrResult?.summary_pdf_url
                  ? `${API_ORIGIN}${qrResult.summary_pdf_url}`
                  : `${API_ORIGIN}/api/reports/${encodeURIComponent(qrResult?.incident_id || '')}/handover-summary`;
                void Linking.openURL(pdfUrl);
              }}
              style={tw`mt-3 w-full items-center rounded-xl border border-[#1F7A4D] bg-green-50 py-2.5`}
            >
              <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>
                Open / Print Incident Summary PDF
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setQrResult(null);
                if (isAgencyRole) navigation.navigate('History');
              }}
              style={tw`mt-2.5 w-full items-center rounded-xl bg-[#1F7A4D] py-3`}
            >
              <Text style={tw`text-xs font-bold text-white`}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(
          activeAssignment?.completion_rejected_note &&
          activeAssignment.completion_rejected_note !== dismissedRejectionNote &&
          !showPatientModal,
        )}
        transparent
        animationType="fade"
        onRequestClose={() => setDismissedRejectionNote(activeAssignment?.completion_rejected_note || '')}
      >
        <View style={tw`flex-1 items-center justify-center bg-black/55 px-6`}>
          <View style={tw`w-full rounded-3xl bg-white p-6`}>
            <View style={tw`flex-row items-center gap-2`}>
              <AlertTriangle size={22} color="#DC2626" />
              <Text style={tw`text-base font-extrabold text-red-700`}>
                Proof of Completion Rejected
              </Text>
            </View>
            <Text style={tw`mt-2 text-xs leading-5 text-slate-700`}>
              Your proof of completion has been rejected by BDRRMO. Please review the reason below and refill the completion form.
            </Text>
            <View style={tw`mt-3 rounded-xl border border-red-200 bg-red-50 p-3`}>
              <Text style={tw`text-xs font-semibold text-red-900`}>
                {String(activeAssignment?.completion_rejected_note || '').replace(/^\[COMPLETION REJECTED\]\s*/i, '')}
              </Text>
            </View>
            <View style={tw`mt-5 flex-row gap-2.5`}>
              <Pressable
                onPress={() => setDismissedRejectionNote(activeAssignment?.completion_rejected_note || '')}
                style={tw`flex-1 items-center rounded-xl bg-slate-100 py-3`}
              >
                <Text style={tw`text-xs font-bold text-slate-700`}>Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setDismissedRejectionNote(activeAssignment?.completion_rejected_note || '');
                  handleOpenCompleteForm();
                }}
                style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] py-3`}
              >
                <Text style={tw`text-xs font-bold text-white`}>Refill Completion Form</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showHospitalPicker} transparent animationType="slide">
        <View style={tw`flex-1 justify-end bg-black/50`}>
          <View style={tw`rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
            <View style={tw`flex-row items-center justify-between`}>
              <View>
                <Text style={tw`text-base font-extrabold text-slate-900`}>Select Nearest Hospital</Text>
                <Text style={tw`text-[11px] text-slate-500`}>Top 3 closest emergency rooms</Text>
              </View>
              <Pressable onPress={() => setShowHospitalPicker(false)} hitSlop={10}>
                <X size={20} color="#64748B" />
              </Pressable>
            </View>
            <View style={tw`mt-4 gap-2.5`}>
              {hospitalOptions.map((hosp, idx) => {
                const isCurrent = nearestHospital?.name === hosp.name;
                return (
                  <Pressable
                    key={`${hosp.name}-${idx}`}
                    onPress={() => {
                      setNearestHospital(hosp);
                      setShowHospitalPicker(false);
                    }}
                    style={tw`flex-row items-center justify-between rounded-2xl border p-3.5 ${isCurrent ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                      }`}
                  >
                    <View style={tw`mr-3 flex-1`}>
                      <Text style={tw`text-xs font-extrabold text-slate-900`}>{hosp.name}</Text>
                      <Text style={tw`mt-0.5 text-[11px] text-slate-500`} numberOfLines={1}>
                        {hosp.address || 'Emergency Room'}
                      </Text>
                    </View>
                    <View style={tw`items-end`}>
                      {hosp.distance_km != null ? (
                        <Text style={tw`text-xs font-extrabold text-blue-700`}>
                          {Number(hosp.distance_km).toFixed(1)} km
                        </Text>
                      ) : null}
                      <Text style={tw`text-[10px] font-bold text-slate-400`}>#{idx + 1} Nearest</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
