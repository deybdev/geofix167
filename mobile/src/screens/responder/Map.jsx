import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
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
  Camera,
  CheckCircle2,
  Compass,
  Hospital,
  ImagePlus,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  QrCode,
  Route,
  Trash2,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import { useAuth } from '../../context/AuthContext';
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

function getHighwayShields(points) {
  const validPoints = (points || []).filter(hasValidPoint);
  if (validPoints.length < 3) return [];
  return [{ ...validPoints[Math.floor(validPoints.length / 2)], label: '167' }];
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

function buildInitialPatients(assignment) {
  return [
    {
      full_name: assignment?.reporter_name || 'Guest Reporter',
      contact: assignment?.reporter_phone || '',
      age: '',
      sex: '',
      condition: assignment?.incident_title || assignment?.incident_category || '',
      notes: assignment?.incident_description || '',
    },
  ];
}

export default function ResponderMap() {
  const { user } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isAgencyRole = userRole === 'police' || userRole === 'fire';
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

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
    void syncOfflineSubmissions();
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
    if (route.params?.assignment) {
      setCaseClosedOnMap(false);
      setActiveAssignment(route.params.assignment);
      setPatients(buildInitialPatients(route.params.assignment));
      setFurtherInfo('');
      setProofPhoto(null);
      setFormError('');
      setNearestHospital(null);
      setQrResult(null);
      setError('');
    }
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
      .catch(() => {});
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
      setNearestHospital(null);
      return undefined;
    }
    let active = true;
    getNearestHospitals(patientPoint.lat, patientPoint.lng)
      .then((list) => {
        if (active && list.length > 0) {
          setNearestHospital(list[0]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
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
    if (busy) return;
    if (isAgencyRole && nearestHospital) {
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

  const handleArrivedOnScene = async () => {
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

  const handleSubmitPatientForm = async () => {
    if (!activeAssignment || busy) return;
    if (!proofPhoto) {
      setFormError(
        isAgencyRole
          ? 'Please attach a proof of resolution photo for BDRRMO and Admin.'
          : 'Please attach a proof photo showing the patient was transported.',
      );
      return;
    }
    setBusy(true);
    setError('');
    setFormError('');
    try {
      if (isAgencyRole) {
        await completeAgencyDispatch(activeAssignment.id, {
          incident_id: activeAssignment.incident_id,
          summary: furtherInfo.trim(),
          proof_photo_base64: proofPhoto.base64,
          proof_photo_mime: proofPhoto.mimeType,
          persons: patients,
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
        further_info: furtherInfo.trim(),
        proof_photo_base64: proofPhoto.base64,
        proof_photo_mime: proofPhoto.mimeType,
        patients,
      });
      setQrResult(res);
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
          kind: isAgencyRole ? 'agency_resolution' : 'tanod_qr_handover',
          dispatchId: activeAssignment.id,
          payload: isAgencyRole
            ? {
                incident_id: activeAssignment.incident_id,
                summary: furtherInfo.trim(),
                proof_photo_base64: proofPhoto.base64,
                proof_photo_mime: proofPhoto.mimeType,
                persons: patients,
              }
            : {
                incident_id: activeAssignment.incident_id,
                hospital_name: nearestHospital?.name || 'Receiving Hospital',
                further_info: furtherInfo.trim(),
                proof_photo_base64: proofPhoto.base64,
                proof_photo_mime: proofPhoto.mimeType,
                patients,
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
          showBackButton={false}
          showBasemapControl={false}
          hideMapLabel
          showMapInfoButton={false}
          showZoomControls={false}
          showBoundary={!isNavigating}
          highlightBoundary={!isNavigating}
          compact={false}
        />
      </View>

      {selectedPin && activeAssignment ? (
        <View
          style={tw`absolute left-4 right-4 ${isNavigating ? 'top-24' : 'top-16'} z-50 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl`}
        >
          <View style={tw`flex-row items-center justify-between`}>
            <View
              style={tw`rounded-md px-2 py-0.5 ${
                selectedPin.pinType === 'hospital'
                  ? 'bg-blue-100'
                  : selectedPin.pinType === 'maintenance'
                    ? 'bg-green-100'
                    : 'bg-red-100'
              }`}
            >
              <Text
                style={tw`text-[10px] font-extrabold uppercase ${
                  selectedPin.pinType === 'hospital'
                    ? 'text-blue-800'
                    : selectedPin.pinType === 'maintenance'
                      ? 'text-green-800'
                      : 'text-red-800'
                }`}
              >
                {selectedPin.pinType === 'hospital'
                  ? 'Nearest Hospital'
                  : selectedPin.pinType === 'maintenance'
                    ? `Maintenance Site • ${activeAssignment?.incident_category || 'Maintenance'}`
                    : `Patient Pickup • ${selectedPin.category || 'Emergency'}`}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedPin(null)}
              hitSlop={10}
              style={tw`h-6 w-6 items-center justify-center rounded-full bg-slate-100`}
            >
              <X size={14} color="#334155" />
            </Pressable>
          </View>

          <Text style={tw`mt-1.5 text-sm font-extrabold text-slate-900`}>
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
          <View style={tw`absolute left-4 right-4 top-4 rounded-2xl bg-[#087C78] px-4 py-3 shadow-lg`}>
            <View style={tw`flex-row items-center`}>
              <Navigation size={26} color="#fff" />
              <View style={tw`ml-3 flex-1`}>
                <Text style={tw`text-[11px] font-bold uppercase tracking-wide text-green-100`}>
                  {activeAssignment.is_maintenance
                    ? `Maintenance Route → ${activeAssignment.incident_location || 'Pinned Site'}`
                    : isAgencyRole
                      ? `${userRole === 'fire' ? 'BFP' : 'Police'} Scene Route${nearestHospital ? ` → ${nearestHospital.name}` : ''}`
                      : `Patient Pickup → ${nearestHospital ? nearestHospital.name : 'Nearest Hospital'}`}
                </Text>
                <Text numberOfLines={2} style={tw`mt-0.5 text-base font-extrabold text-white`}>
                  {routeInfo?.instruction || 'Follow the highlighted route'}
                </Text>
              </View>
            </View>
          </View>

          <View style={tw`absolute right-4 top-28 gap-2.5`}>
            <Pressable
              onPress={() => setCompassResetKey((k) => k + 1)}
              style={tw`h-12 w-12 items-center justify-center rounded-full bg-black/85`}
            >
              <Compass
                size={22}
                color="#EF4444"
                style={{ transform: [{ rotate: `${getRouteHeading(headingPoints)}deg` }] }}
              />
            </Pressable>
            <Pressable
              onPress={() => setNavigationMuted((m) => !m)}
              style={tw`h-12 w-12 items-center justify-center rounded-full bg-black/85`}
            >
              {navigationMuted ? <VolumeX size={22} color="#fff" /> : <Volume2 size={22} color="#fff" />}
            </Pressable>
            <Pressable
              onPress={() => setRecenterKey((k) => k + 1)}
              style={tw`h-12 w-12 items-center justify-center rounded-full bg-black/85`}
            >
              <Route size={22} color="#fff" />
            </Pressable>
          </View>

          <View style={tw`absolute bottom-36 left-4 right-4 flex-row flex-wrap gap-2`}>
            <Pressable
              onPress={() => setRecenterKey((k) => k + 1)}
              style={tw`flex-row items-center rounded-full bg-black/85 px-3.5 py-2`}
            >
              <Navigation size={15} color="#fff" />
              <Text style={tw`ml-1.5 text-xs font-bold text-white`}>Re-center</Text>
            </Pressable>
            {isAgencyRole && !activeAssignment.is_maintenance ? (
              <Pressable
                onPress={handleLocateNearbyHospital}
                disabled={busy}
                style={tw`flex-row items-center rounded-full ${nearestHospital ? 'bg-amber-600' : 'bg-blue-600'} px-3.5 py-2.5`}
              >
                {nearestHospital ? <X size={15} color="#fff" /> : <Hospital size={15} color="#fff" />}
                <Text style={tw`ml-1.5 text-xs font-bold text-white`}>
                  {nearestHospital ? 'Cancel Hospital Route' : 'Locate Nearby Hospital'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setIsNavigating(false)}
              style={tw`flex-row items-center rounded-full bg-red-600 px-4 py-2.5`}
            >
              <X size={16} color="#fff" />
              <Text style={tw`ml-1 text-xs font-bold text-white`}>Exit Nav</Text>
            </Pressable>
          </View>

          <View style={tw`absolute bottom-0 left-0 right-0 rounded-t-3xl bg-slate-950 px-5 pb-5 pt-3.5`}>
            <View style={tw`flex-row items-center justify-between`}>
              <View>
                <Text style={tw`text-2xl font-extrabold text-green-400`}>
                  {routeInfo ? formatDuration(routeInfo.durationMin) : 'Calculating...'}
                </Text>
                <Text style={tw`text-xs text-slate-300`}>
                  {routeInfo
                    ? `${routeInfo.distanceKm} km • ${routeInfo.trafficLabel || 'Traffic'} • Arrive ${getArrivalTime(routeInfo.durationMin)}`
                    : 'Calculating multi-stop road route'}
                </Text>
              </View>
              <View style={tw`items-end`}>
                {activeAssignment.is_maintenance ? (
                  <Text style={tw`text-[11px] font-bold text-green-300`} numberOfLines={1}>
                    Maintenance Site
                  </Text>
                ) : (
                  <>
                    <Text style={tw`text-[11px] font-bold text-green-300`}>1. Pickup Patient</Text>
                    {nearestHospital ? (
                      <Text style={tw`text-[11px] font-bold text-blue-300`} numberOfLines={1}>
                        2. {nearestHospital.name}
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            </View>

            <View style={tw`mt-3 flex-row gap-2.5`}>
              {activeAssignment.is_maintenance ? (
                <>
                  <Pressable
                    onPress={handleCancelMaintenanceTrack}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5`}
                  >
                    <X size={15} color="#FFFFFF" />
                    <Text style={tw`text-xs font-bold text-white`}>Cancel</Text>
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
                      {activeAssignment.inspection_done ? 'Submit Proof of Repair' : 'Document Inspection'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => navigation.navigate('Messages', { assignment: activeAssignment })}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5`}
                  >
                    <MessageCircle size={15} color="#FFFFFF" />
                    <Text style={tw`text-xs font-bold text-white`}>Message</Text>
                  </Pressable>

                  {activeAssignment.status === 'ON_SCENE' ? (
                    <Pressable
                      onPress={handleOpenCompleteForm}
                      disabled={busy}
                      style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`}
                    >
                      <CheckCircle2 size={15} color="#FFFFFF" />
                      <Text style={tw`text-xs font-bold text-white`}>Mark as Completed</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleArrivedOnScene}
                      disabled={busy}
                      style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5`}
                    >
                      <MapPin size={15} color="#FFFFFF" />
                      <Text style={tw`text-xs font-bold text-white`}>Arrived on Scene</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {activeAssignment && !isNavigating ? (
        <View style={tw`absolute bottom-4 left-4 right-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg`}>
          <View style={tw`flex-row items-center justify-between`}>
            <Text style={tw`text-xs font-bold uppercase text-[#1F7A4D]`}>
              {activeAssignment.incident_category} • {activeAssignment.urgency || 'High'}
            </Text>
            <Text style={tw`rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700`}>
              {activeAssignment.status}
            </Text>
          </View>

          <Text style={tw`mt-1 text-base font-extrabold text-slate-900`} numberOfLines={1}>
            {activeAssignment.incident_title}
          </Text>

          {activeAssignment.incident_location ? (
            <View style={tw`mt-1 flex-row items-center gap-1`}>
              <MapPin size={13} color="#64748B" />
              <Text style={tw`flex-1 text-xs text-slate-500`} numberOfLines={1}>
                {activeAssignment.is_maintenance
                  ? `Site: ${activeAssignment.incident_location}`
                  : `1. Pickup: ${activeAssignment.incident_location}`}
              </Text>
            </View>
          ) : null}

          {!activeAssignment.is_maintenance && nearestHospital ? (
            <View style={tw`mt-1 flex-row items-center gap-1`}>
              <Hospital size={13} color="#1E40AF" />
              <Text style={tw`flex-1 text-xs font-semibold text-blue-800`} numberOfLines={1}>
                2. Nearest Hospital: {nearestHospital.name}
                {nearestHospital.distance_km != null ? ` (${nearestHospital.distance_km} km)` : ''}
              </Text>
            </View>
          ) : null}

          {routeInfo ? (
            <View style={tw`mt-1.5 flex-row items-center gap-1.5`}>
              <Navigation size={13} color="#1F7A4D" />
              <Text style={tw`text-xs font-semibold text-[#1F7A4D]`}>
                Fastest route: {routeInfo.durationMin} min ({routeInfo.distanceKm} km • {routeInfo.trafficLabel || 'Traffic'})
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

          {!activeAssignment.is_maintenance && !isAgencyRole ? (
            <View style={tw`mt-2 flex-row gap-2`}>
              <Pressable
                onPress={handleLocateNearbyHospital}
                disabled={busy}
                style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2`}
              >
                <Hospital size={14} color="#1E40AF" />
                <Text style={tw`text-[11px] font-bold text-blue-900`}>Change Hospital</Text>
              </Pressable>
            </View>
          ) : null}

          {isAgencyRole && !activeAssignment.is_maintenance ? (
            <View style={tw`mt-2 flex-row gap-2`}>
              <Pressable
                onPress={handleLocateNearbyHospital}
                disabled={busy}
                style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border ${
                  nearestHospital ? 'border-amber-300 bg-amber-50' : 'border-blue-200 bg-blue-50'
                } py-2`}
              >
                {nearestHospital ? <X size={14} color="#B45309" /> : <Hospital size={14} color="#1E40AF" />}
                <Text style={tw`text-[11px] font-bold ${nearestHospital ? 'text-amber-900' : 'text-blue-900'}`}>
                  {nearestHospital ? 'Cancel Hospital Route' : 'Locate Nearby Hospital'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleRequestBackup}
                disabled={busy || backupSent}
                style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 py-2`}
              >
                <Text style={tw`text-[11px] font-bold text-amber-900`}>
                  {backupSent ? 'Backup Requested ✓' : 'Request Tanod / Backup'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <Text style={tw`mt-2 text-xs font-semibold text-red-600`}>{error}</Text>
          ) : null}

          <Pressable
            onPress={() => {
              setIsNavigating(true);
              setRecenterKey((k) => k + 1);
            }}
            style={tw`mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5`}
          >
            <Navigation size={15} color="#FFFFFF" />
            <Text style={tw`text-xs font-extrabold text-white`}>
              Start Turn-by-Turn Navigation
            </Text>
          </Pressable>

          <View style={tw`mt-2.5 flex-row gap-2.5`}>
            {activeAssignment.is_maintenance ? (
              <>
                <Pressable
                  onPress={handleCancelMaintenanceTrack}
                  style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5`}
                >
                  <X size={15} color="#0F172A" />
                  <Text style={tw`text-xs font-bold text-slate-900`}>Cancel</Text>
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
                    {activeAssignment.inspection_done ? 'Submit Proof of Repair' : 'Document Inspection'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => navigation.navigate('Messages', { assignment: activeAssignment })}
                  style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5`}
                >
                  <MessageCircle size={15} color="#0F172A" />
                  <Text style={tw`text-xs font-bold text-slate-900`}>Message</Text>
                </Pressable>

                {activeAssignment.status === 'ON_SCENE' || qrResult ? (
                  <Pressable
                    onPress={handleOpenCompleteForm}
                    disabled={busy}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#1F7A4D] py-2.5`}
                  >
                    <CheckCircle2 size={15} color="#FFFFFF" />
                    <Text style={tw`text-xs font-bold text-white`}>
                      {qrResult ? 'View QR / Info' : 'Mark as Completed'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleArrivedOnScene}
                    disabled={busy}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5`}
                  >
                    <MapPin size={15} color="#FFFFFF" />
                    <Text style={tw`text-xs font-bold text-white`}>Arrived on Scene</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      ) : null}

      <Modal
        visible={Boolean(maintenanceModalMode)}
        transparent
        animationType="slide"
        onRequestClose={() => setMaintenanceModalMode(null)}
      >
        <View style={tw`flex-1 justify-end bg-black/45`}>
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
                    <Text style={tw`text-xs font-bold text-white`}>Take Photo</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handlePickMaintenancePhoto(false)}
                    style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5`}
                  >
                    <ImagePlus size={14} color="#0F172A" />
                    <Text style={tw`text-xs font-bold text-slate-800`}>Upload Photo</Text>
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
        </View>
      </Modal>

      <Modal
        visible={showPatientModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPatientModal(false)}
      >
        <View style={tw`flex-1 justify-end bg-black/40`}>
          <View style={tw`max-h-[82%] rounded-t-3xl bg-white px-5 pb-6 pt-5`}>
            <Text style={tw`text-lg font-extrabold text-slate-900`}>
              {userRole === 'police'
                ? 'Criminal / Incident Report Handover'
                : userRole === 'fire'
                  ? 'Fire Scene Resolution Report'
                  : 'Patient / Reporter Information'}
            </Text>
            <Text style={tw`mt-1 text-xs text-slate-500`}>
              {isAgencyRole
                ? 'Auto-filled from the guest report. Add involved persons and submit proof of resolution for BDRRMO & Admin.'
                : 'Auto-filled from the guest incident report. Review or add individuals before generating the hospital QR code.'}
            </Text>

            <ScrollView style={tw`mt-3`} contentContainerStyle={tw`gap-3 pb-4`}>
              {patients.map((person, index) => (
                <View key={index} style={tw`rounded-2xl border border-slate-200 bg-slate-50 p-3`}>
                  <View style={tw`flex-row items-center justify-between`}>
                    <Text style={tw`text-xs font-bold text-slate-800`}>
                      Person #{index + 1} {index === 0 ? '(Auto-filled from Report)' : ''}
                    </Text>
                    {patients.length > 1 ? (
                      <Pressable
                        onPress={() =>
                          setPatients((prev) => prev.filter((_, i) => i !== index))
                        }
                        style={tw`flex-row items-center gap-1 rounded-lg bg-red-50 px-2 py-1`}
                      >
                        <Trash2 size={12} color="#DC2626" />
                        <Text style={tw`text-[10px] font-bold text-red-600`}>Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <TextInput
                    value={person.full_name}
                    onChangeText={(val) =>
                      setPatients((prev) =>
                        prev.map((p, i) => (i === index ? { ...p, full_name: val } : p)),
                      )
                    }
                    placeholder="Full Name"
                    style={tw`mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
                  />
                  <TextInput
                    value={person.contact}
                    onChangeText={(val) =>
                      setPatients((prev) =>
                        prev.map((p, i) => (i === index ? { ...p, contact: val } : p)),
                      )
                    }
                    placeholder="Contact Number"
                    style={tw`mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
                  />
                  <View style={tw`mt-2 flex-row gap-2`}>
                    <TextInput
                      value={person.age}
                      onChangeText={(val) =>
                        setPatients((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, age: val } : p)),
                        )
                      }
                      placeholder="Age"
                      keyboardType="numeric"
                      style={tw`flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
                    />
                    <TextInput
                      value={person.sex}
                      onChangeText={(val) =>
                        setPatients((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, sex: val } : p)),
                        )
                      }
                      placeholder="Sex"
                      style={tw`flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
                    />
                  </View>
                  <TextInput
                    value={person.condition}
                    onChangeText={(val) =>
                      setPatients((prev) =>
                        prev.map((p, i) => (i === index ? { ...p, condition: val } : p)),
                      )
                    }
                    placeholder="Condition / Incident Type"
                    style={tw`mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
                  />
                  <TextInput
                    value={person.notes}
                    onChangeText={(val) =>
                      setPatients((prev) =>
                        prev.map((p, i) => (i === index ? { ...p, notes: val } : p)),
                      )
                    }
                    placeholder="Patient Notes"
                    multiline
                    style={tw`mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
                  />
                </View>
              ))}

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
                <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>Add Person</Text>
              </Pressable>

              <View style={tw`rounded-2xl border border-slate-200 bg-slate-50 p-3`}>
                <Text style={tw`text-xs font-bold text-slate-800`}>
                  Short Description / Further Information
                </Text>
                <TextInput
                  value={furtherInfo}
                  onChangeText={setFurtherInfo}
                  placeholder="Enter summary of patient transport, hospital arrival details, or remarks..."
                  multiline
                  style={tw`mt-2 min-h-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900`}
                />
              </View>

              <View style={tw`rounded-2xl border border-slate-200 bg-slate-50 p-3`}>
                <Text style={tw`text-xs font-bold text-slate-800`}>
                  Proof of Evidence (Successful Transport Photo) *
                </Text>
                <Text style={tw`mt-0.5 text-[11px] text-slate-500`}>
                  Attach a photo showing the patient was successfully transported to the hospital.
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
                      <Text style={tw`text-xs font-bold text-white`}>Take Photo</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handlePickProofPhoto(false)}
                      style={tw`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5`}
                    >
                      <ImagePlus size={14} color="#0F172A" />
                      <Text style={tw`text-xs font-bold text-slate-800`}>Upload Photo</Text>
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
                disabled={busy}
                style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] py-3`}
              >
                <Text style={tw`text-xs font-bold text-white`}>
                  {busy
                    ? 'Submitting...'
                    : isAgencyRole
                      ? 'Submit Resolution Report'
                      : 'Submit & Generate QR'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(qrResult)}
        transparent
        animationType="fade"
        onRequestClose={() => setQrResult(null)}
      >
        <View style={tw`flex-1 items-center justify-center bg-black/50 px-6`}>
          <View style={tw`w-full items-center rounded-3xl bg-white p-6`}>
            <View style={tw`flex-row items-center gap-2`}>
              <QrCode size={20} color="#1F7A4D" />
              <Text style={tw`text-lg font-extrabold text-slate-900`}>
                Hospital Handover QR Code
              </Text>
            </View>
            <Text style={tw`mt-1 text-center text-xs text-slate-500`}>
              Show this QR code to the receiving hospital staff for patient handover.
            </Text>

            {qrResult?.token ? (
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    JSON.stringify({
                      handover_id: qrResult.handover_id,
                      token: qrResult.token,
                      incident_id: activeAssignment?.incident_id,
                      hospital: nearestHospital?.name,
                      patients,
                    }),
                  )}`,
                }}
                style={tw`mt-4 h-52 w-52 rounded-2xl bg-slate-100`}
              />
            ) : null}

            {nearestHospital ? (
              <Text style={tw`mt-3 text-xs font-bold text-blue-900`}>
                Hospital: {nearestHospital.name}
              </Text>
            ) : null}
            <Text style={tw`mt-1 text-[11px] text-slate-600`}>
              Patients: {patients.length} • Proof Photo Attached • Token: {qrResult?.token?.slice(0, 8)}...
            </Text>
            {furtherInfo ? (
              <Text style={tw`mt-1 text-center text-[11px] text-slate-500`} numberOfLines={2}>
                Notes: {furtherInfo}
              </Text>
            ) : null}
            <View style={tw`mt-2 rounded-lg bg-green-50 px-3 py-1.5`}>
              <Text style={tw`text-center text-[10px] font-bold text-[#1F7A4D]`}>
                Sent to Admin → Resolved & Handed Over for final closure
              </Text>
            </View>

            <Pressable
              onPress={() => setQrResult(null)}
              style={tw`mt-5 w-full items-center rounded-xl bg-[#1F7A4D] py-3`}
            >
              <Text style={tw`text-xs font-bold text-white`}>Done</Text>
            </Pressable>
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
                    style={tw`flex-row items-center justify-between rounded-2xl border p-3.5 ${
                      isCurrent ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
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
