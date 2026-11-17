import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Compass,
  Navigation,
  Route,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import tw from 'twrnc';

import MapViewer from '../../components/map/MapViewer';
import {
  getResponderDispatches,
  updateResponderDispatchStatus,
} from '../../services/responderDispatchService';
import { useAuth } from '../../context/AuthContext';

function hasCoordinates(assignment) {
  return Number.isFinite(Number(assignment.incident_latitude))
    && Number.isFinite(Number(assignment.incident_longitude));
}

function hasValidPoint(point) {
  return Boolean(point)
    && Number.isFinite(Number(point.lat))
    && Number.isFinite(Number(point.lng));
}

function distanceInKilometers(from, to) {
  const earthRadius = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from.latitude))
    * Math.cos(toRadians(to.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getRoadRoute(from, to) {
  if (!hasValidPoint(from) || !hasValidPoint(to)) {
    throw new Error('Route coordinates are unavailable.');
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Road routing service unavailable.');

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error('No road route was found.');
  }

  const firstStep = route.legs?.[0]?.steps?.[0];
  const maneuver = firstStep?.maneuver;
  const maneuverText = maneuver?.type === 'depart'
    ? 'Head toward'
    : maneuver?.type === 'arrive'
      ? 'Arrive at destination'
      : `${maneuver?.modifier ? `${maneuver.modifier} ` : ''}${maneuver?.type || 'Continue'} onto`;

  return {
    points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distance: route.distance / 1000,
    duration: Math.max(1, Math.round(route.duration / 60)),
    instruction: maneuver?.type === 'arrive'
      ? maneuverText
      : `${maneuverText} ${firstStep?.name || 'the assigned incident location'}`,
  };
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} hr ${remainingMinutes} min`;
}

function getArrivalTime(minutes) {
  const arrival = new Date(Date.now() + minutes * 60 * 1000);
  return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  return [{ ...validPoints[Math.floor(validPoints.length / 2)], label: '302' }];
}

function NavigationButton({ accessibilityLabel, children, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={tw`h-14 w-14 items-center justify-center rounded-full bg-black`}
    >
      {children}
    </Pressable>
  );
}

export default function Assignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [eta, setEta] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [compassResetKey, setCompassResetKey] = useState(0);
  const [navigationMuted, setNavigationMuted] = useState(false);
  const [showRouteSearch, setShowRouteSearch] = useState(false);
  const [routeSearch, setRouteSearch] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getResponderDispatches()
      .then((dispatches) => {
        if (active) setAssignments(dispatches.filter((dispatch) => dispatch.status !== 'COMPLETED'));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedAssignment) return undefined;

    let active = true;
    const calculateEta = async () => {
      if (!hasCoordinates(selectedAssignment)) {
        setEta('ETA unavailable for this assignment location.');
        return;
      }

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (active) setEta('Enable location access to calculate your ETA.');
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (active) {
          const responderLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const destination = {
            lat: Number(selectedAssignment.incident_latitude),
            lng: Number(selectedAssignment.incident_longitude),
          };
          setCurrentLocation(responderLocation);

          try {
            const route = await getRoadRoute(responderLocation, destination);
            if (!active) return;
            setRoutePoints(route.points);
            setRouteInfo({
              duration: route.duration,
              distance: route.distance,
              instruction: route.instruction,
            });
            setEta(`${route.duration} min estimated travel time (${route.distance.toFixed(1)} km by road)`);
            return;
          } catch {
            setRoutePoints([responderLocation, destination]);
          }
        }
        const distance = distanceInKilometers(
          position.coords,
          {
            latitude: Number(selectedAssignment.incident_latitude),
            longitude: Number(selectedAssignment.incident_longitude),
          },
        );
        const minutes = Math.max(2, Math.round((distance / 25) * 60));
        if (active) {
          setRouteInfo({
            duration: minutes,
            distance,
            instruction: 'Continue toward the assigned incident location',
          });
          setEta(`${minutes} min estimated travel time (${distance.toFixed(1)} km)`);
        }
      } catch {
        if (active) setEta('ETA unavailable. Open directions for route details.');
      }
    };

    calculateEta();
    return () => {
      active = false;
    };
  }, [selectedAssignment]);

  const completeAssignment = async () => {
    if (!selectedAssignment || updatingStatus) return;

    try {
      setUpdatingStatus(true);
      await updateResponderDispatchStatus(selectedAssignment.id, 'COMPLETED');
      const completed = { ...selectedAssignment, status: 'COMPLETED' };
      setAssignments((current) => current.filter((item) => item.id !== completed.id));
      setSelectedAssignment(completed);
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={tw`px-5 pb-6 pt-6`}>
      <Text style={tw`text-3xl font-extrabold text-slate-900`}>Assignments</Text>
      <Text style={tw`mt-1 text-sm text-slate-500`}>
        Dispatches assigned to {String(user?.role || 'your team').toUpperCase()}.
      </Text>

      {error ? <Text style={tw`mt-4 text-xs text-red-600`}>{error}</Text> : null}
      {assignments.length === 0 ? <View style={tw`mt-6 items-center rounded-2xl bg-white px-6 py-8`}>
        <View style={tw`h-12 w-12 items-center justify-center rounded-xl bg-green-50`}>
          <ClipboardList size={24} color="#1F7A4D" />
        </View>
        <Text style={tw`mt-4 text-base font-bold text-slate-900`}>
          No active assignments
        </Text>
        <Text style={tw`mt-2 text-center text-sm leading-5 text-slate-500`}>
          New BDRRMO dispatches will appear here when they are assigned.
        </Text>
      </View> : assignments.map((assignment) => (
        <Pressable
          key={assignment.id}
          onPress={() => {
            setEta('');
            setCurrentLocation(null);
            setRoutePoints([]);
            setRouteInfo(null);
            setShowMap(false);
            setFullscreenMap(false);
            setRecenterKey(0);
            setCompassResetKey(0);
            setShowRouteSearch(false);
            setRouteSearch('');
            setAssistantOpen(false);
            setSelectedAssignment(assignment);
          }}
          style={({ pressed }) => [tw`mt-4 rounded-2xl bg-white p-4`, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={tw`flex-row items-start`}>
            <Text style={tw`flex-1 text-base font-bold text-slate-900`}>
              {assignment.incident_title}
            </Text>
            <Text style={tw`text-xs font-bold text-[#1F7A4D]`}>{assignment.status}</Text>
          </View>
          <Text style={tw`mt-1 text-xs capitalize text-slate-500`}>
            {assignment.incident_category} · {assignment.incident_location || 'Location unavailable'}
          </Text>
          <Text style={tw`mt-3 text-xs font-semibold text-slate-700`}>
            Urgency: {assignment.urgency}
          </Text>
          {assignment.vehicle_name ? (
            <Text style={tw`mt-1 text-xs text-slate-600`}>
              BDRRMO vehicle: {assignment.vehicle_name}
            </Text>
          ) : null}
          <Text style={tw`mt-3 text-xs font-bold text-[#1F7A4D]`}>Tap to view route and ETA</Text>
        </Pressable>
      ))}

      <Modal
        visible={Boolean(selectedAssignment)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAssignment(null)}
      >
        <View style={tw`flex-1 justify-end bg-black/40`}>
          <View style={tw`rounded-t-3xl bg-slate-50 px-5 pb-8 pt-5`}>
            <Text style={tw`text-xl font-extrabold text-slate-900`}>
              {selectedAssignment?.incident_title}
            </Text>
            <Text style={tw`mt-1 text-sm text-slate-500`}>
              {selectedAssignment?.incident_location || 'Location unavailable'}
            </Text>
            {showMap && selectedAssignment && hasCoordinates(selectedAssignment) ? (
              <View style={tw`mt-4 h-72 overflow-hidden rounded-2xl`}>
                <MapViewer
                  variant="viewer"
                  incidents={[{
                    id: selectedAssignment.incident_id,
                    title: selectedAssignment.incident_title,
                    category: selectedAssignment.incident_category,
                    address: selectedAssignment.incident_location,
                    lat: Number(selectedAssignment.incident_latitude),
                    lng: Number(selectedAssignment.incident_longitude),
                  }]}
                  selectedLocation={{
                    lat: Number(selectedAssignment.incident_latitude),
                    lng: Number(selectedAssignment.incident_longitude),
                  }}
                  routes={currentLocation ? [{
                    id: `route-${selectedAssignment.id}`,
                  points: routePoints.filter(hasValidPoint).length > 1 ? routePoints.filter(hasValidPoint) : [
                    currentLocation,
                    {
                      lat: Number(selectedAssignment.incident_latitude),
                      lng: Number(selectedAssignment.incident_longitude),
                    },
                  ],
                    color: '#1F7A4D',
                    dashed: false,
                  }] : []}
                  showBackButton={false}
                  showBoundary={false}
                  highlightBoundary={false}
                  compact
                  onExpand={() => setFullscreenMap(true)}
                  fitPoints={currentLocation ? [
                    currentLocation,
                    {
                      lat: Number(selectedAssignment.incident_latitude),
                      lng: Number(selectedAssignment.incident_longitude),
                    },
                  ] : []}
                  navigationUserLocation={currentLocation}
                  highwayShields={getHighwayShields(routePoints)}
                  mapHeight={288}
                />
              </View>
            ) : null}
            <View style={tw`mt-5 rounded-2xl bg-white p-4`}>
              <Text style={tw`text-sm font-bold text-slate-800`}>Estimated arrival</Text>
              <Text style={tw`mt-2 text-base font-semibold text-[#1F7A4D]`}>
                {eta || 'Calculating ETA...'}
              </Text>
              <Text style={tw`mt-2 text-xs leading-5 text-slate-500`}>
                ETA is based on your current location and an average response speed.
                Google Maps can provide live traffic routing.
              </Text>
            </View>
            {!hasCoordinates(selectedAssignment || {}) ? (
              <Text style={tw`mt-3 text-xs text-amber-700`}>
                This assignment has no map coordinates yet.
              </Text>
            ) : null}
            <View style={tw`mt-5 flex-row gap-3`}>
              <Pressable
                onPress={() => setSelectedAssignment(null)}
                style={tw`flex-1 items-center rounded-xl bg-white px-4 py-3`}
              >
                <Text style={tw`text-sm font-bold text-slate-600`}>Close</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowMap((visible) => !visible)}
                disabled={!hasCoordinates(selectedAssignment || {})}
                style={tw`flex-1 items-center rounded-xl bg-[#1F7A4D] px-4 py-3`}
              >
                <Text style={tw`text-sm font-bold text-white`}>
                  {showMap ? 'Hide map' : 'View in-app map'}
                </Text>
              </Pressable>
            </View>
            {selectedAssignment?.status !== 'COMPLETED' ? (
              <Pressable
                onPress={completeAssignment}
                disabled={updatingStatus}
                style={tw`mt-3 items-center rounded-xl bg-amber-100 px-4 py-3`}
              >
                <Text style={tw`text-sm font-bold text-amber-800`}>
                  {updatingStatus ? 'Completing...' : 'Mark incident completed'}
                </Text>
              </Pressable>
            ) : (
              <Text style={tw`mt-3 text-center text-xs font-semibold text-[#1F7A4D]`}>
                This incident is completed and will appear in History.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={fullscreenMap && Boolean(selectedAssignment)}
        animationType="slide"
        onRequestClose={() => setFullscreenMap(false)}
      >
        <View style={tw`flex-1 bg-slate-900`}>
          {selectedAssignment && hasCoordinates(selectedAssignment) ? (
            <>
              <MapViewer
              variant="viewer"
              incidents={[{
                id: selectedAssignment.incident_id,
                title: selectedAssignment.incident_title,
                category: selectedAssignment.incident_category,
                address: selectedAssignment.incident_location,
                lat: Number(selectedAssignment.incident_latitude),
                lng: Number(selectedAssignment.incident_longitude),
              }]}
              selectedLocation={{
                lat: Number(selectedAssignment.incident_latitude),
                lng: Number(selectedAssignment.incident_longitude),
              }}
              routes={currentLocation ? [{
                id: `fullscreen-route-${selectedAssignment.id}`,
                points: routePoints.filter(hasValidPoint).length > 1 ? routePoints.filter(hasValidPoint) : [
                  currentLocation,
                  {
                    lat: Number(selectedAssignment.incident_latitude),
                    lng: Number(selectedAssignment.incident_longitude),
                  },
                ],
                color: '#1F7A4D',
                dashed: false,
              }] : []}
              trackers={currentLocation ? [{
                id: 'current-responder-location',
                ...currentLocation,
              }] : []}
              showBackButton
              onBack={() => setFullscreenMap(false)}
              showBoundary={false}
              highlightBoundary={false}
              navigationMode
              navigationHeading={getRouteHeading(routePoints.filter(hasValidPoint).length > 1 ? routePoints : [currentLocation, {
                lat: Number(selectedAssignment.incident_latitude),
                lng: Number(selectedAssignment.incident_longitude),
              }])}
              recenterSignal={recenterKey}
              compassResetSignal={compassResetKey}
              navigationUserLocation={currentLocation}
              highwayShields={getHighwayShields(routePoints)}
              fitPoints={currentLocation ? [
                currentLocation,
                {
                  lat: Number(selectedAssignment.incident_latitude),
                  lng: Number(selectedAssignment.incident_longitude),
                },
              ] : []}
              />
              <View pointerEvents="box-none" style={tw`absolute inset-0`}>
              <View style={tw`absolute left-4 right-4 top-4 rounded-2xl bg-[#087C78] px-4 py-3 shadow-lg`}>
                <View style={tw`flex-row items-center`}>
                  <Navigation size={27} color="#fff" />
                  <View style={tw`ml-3 flex-1`}>
                    <Text style={tw`text-xs font-semibold uppercase tracking-wide text-green-100`}>
                      Next direction
                    </Text>
                    <Text numberOfLines={2} style={tw`mt-1 text-lg font-extrabold text-white`}>
                      {routeInfo?.instruction || 'Calculating route...'}
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => setFullscreenMap(false)}
                accessibilityRole="button"
                accessibilityLabel="Close full-screen map"
                style={tw`absolute bottom-28 left-5 h-14 w-14 items-center justify-center rounded-full bg-black`}
              >
                <X size={28} color="#fff" />
              </Pressable>
              <View style={tw`absolute right-5 top-32 gap-3`}>
                <NavigationButton
                  accessibilityLabel="Reset compass to north"
                  onPress={() => setCompassResetKey((current) => current + 1)}
                >
                  <Compass
                    size={25}
                    color="#EF4444"
                    style={{ transform: [{ rotate: `${getRouteHeading(routePoints)}deg` }] }}
                  />
                </NavigationButton>
                <NavigationButton
                  accessibilityLabel="Search along route"
                  onPress={() => setShowRouteSearch(true)}
                >
                  <Search size={25} color="#fff" />
                </NavigationButton>
                <NavigationButton
                  accessibilityLabel={navigationMuted ? 'Unmute navigation' : 'Mute navigation'}
                  onPress={() => setNavigationMuted((muted) => !muted)}
                >
                  {navigationMuted ? <VolumeX size={25} color="#fff" /> : <Volume2 size={25} color="#fff" />}
                </NavigationButton>
                <NavigationButton
                  accessibilityLabel="Show route overview"
                  onPress={() => setRecenterKey((current) => current + 1)}
                >
                  <Route size={25} color="#fff" />
                </NavigationButton>
              </View>
              {showRouteSearch ? (
                <View style={tw`absolute left-4 right-4 top-32 rounded-2xl bg-[#1C1C1E] p-4`}>
                  <View style={tw`flex-row items-center`}>
                    <TextInput
                      autoFocus
                      value={routeSearch}
                      onChangeText={setRouteSearch}
                      placeholder="Search along route"
                      placeholderTextColor="#A1A1AA"
                      style={tw`h-11 flex-1 rounded-xl bg-slate-800 px-3 text-sm text-white`}
                    />
                    <Pressable
                      onPress={() => setShowRouteSearch(false)}
                      style={tw`ml-2 h-11 w-11 items-center justify-center rounded-xl bg-slate-700`}
                    >
                      <X size={20} color="#fff" />
                    </Pressable>
                  </View>
                  <Text style={tw`mt-3 text-xs text-slate-300`}>
                    {routeSearch ? `Searching for “${routeSearch}” along this route` : 'Quick stops'}
                  </Text>
                  <View style={tw`mt-3 flex-row gap-2`}>
                    {['Gas station', 'Hospital', 'Police station'].map((stop) => (
                      <Pressable
                        key={stop}
                        onPress={() => setRouteSearch(stop)}
                        style={tw`rounded-full bg-slate-700 px-3 py-2`}
                      >
                        <Text style={tw`text-xs font-semibold text-white`}>{stop}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={tw`absolute bottom-28 left-5`}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Re-center map"
                  onPress={() => setRecenterKey((current) => current + 1)}
                  style={tw`flex-row items-center rounded-full bg-black px-5 py-4`}
                >
                  <Navigation size={22} color="#fff" />
                  <Text style={tw`ml-2 text-base font-bold text-white`}>Re-center</Text>
                </Pressable>
              </View>
              <View style={tw`absolute bottom-0 left-0 right-0 rounded-t-3xl bg-black px-6 pb-7 pt-4`}>
                <View style={tw`items-center`}>
                  <View style={tw`h-1 w-12 rounded-full bg-slate-400`} />
                </View>
                <Text style={tw`mt-3 text-center text-3xl font-extrabold text-green-300`}>
                  {routeInfo ? formatDuration(routeInfo.duration) : 'Calculating...'}
                </Text>
                <Text style={tw`mt-1 text-center text-base text-white`}>
                  {routeInfo
                    ? `${routeInfo.distance.toFixed(1)} km · Arrive ${getArrivalTime(routeInfo.duration)}`
                    : 'Road route is being calculated'}
                </Text>
                <Text numberOfLines={1} style={tw`mt-2 text-center text-xs text-slate-400`}>
                  {selectedAssignment.incident_title}
                </Text>
                {assistantOpen ? (
                  <View style={tw`absolute bottom-20 right-5 w-56 rounded-2xl bg-slate-800 p-3`}>
                    <Text style={tw`text-xs font-semibold text-white`}>
                      Voice assistant is ready to help with this route.
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setAssistantOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel="Open AI voice assistant"
                  style={tw`absolute bottom-5 right-5 h-12 w-12 items-center justify-center rounded-full bg-blue-600`}
                >
                  <Sparkles size={22} color="#fff" />
                </Pressable>
              </View>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}
