import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import {
  ArrowLeft,
  Info,
  Layers,
  Maximize2,
  LocateFixed,
  Plus,
  Minus,
  X,
  Flame,
  ShieldAlert,
  Wrench,
  AlertTriangle,
  Ambulance,
  MapPin,
  Navigation,
} from 'lucide-react-native';
import tw from 'twrnc';

import IncidentSheet from './IncidentSheet';
import { getCategory, getStatus, STATUSES } from '../../utils/map/mapUtils';
import { buildSampleIncidents } from '../../utils/map/sampleIncidents';

const BOUNDARY = require('../../../assets/map/barangay-167.json');

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_ZOOM = 15.5;
const MIN_ZOOM = 10;
const MAX_ZOOM = 22;
const FOCUS_DELTA = 0.006;
const FALLBACK_CENTER = { latitude: 14.75, longitude: 121.02 };
const BASEMAPS = ['street', 'satellite'];
const NAVIGATION_MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

// Single source of truth for category icon + fallback color.
const CATEGORY_META = {
  fire: { Icon: Flame, color: '#DC2626' },
  incident: { Icon: Ambulance, color: '#2563EB' },
  crime: { Icon: ShieldAlert, color: '#7C3AED' },
  infrastructure: { Icon: Wrench, color: '#D97706' },
  emergency: { Icon: AlertTriangle, color: '#EA580C' },
};

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                           */
/* -------------------------------------------------------------------------- */

const toLatLng = (point) => ({
  latitude: Number(point.lat),
  longitude: Number(point.lng),
});

const hasValidCoords = (point) =>
  !!point &&
  Number.isFinite(Number(point.lat)) &&
  Number.isFinite(Number(point.lng));

// GeoJSON [lng, lat] -> { latitude, longitude }
const ringToLatLng = (ring = []) =>
  ring.map(([longitude, latitude]) => ({ latitude, longitude }));

function isPointInRing(latitude, longitude, ring) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];

    const intersects =
      a.longitude > longitude !== b.longitude > longitude &&
      latitude <
        ((b.latitude - a.latitude) * (longitude - a.longitude)) /
          (b.longitude - a.longitude) +
          a.latitude;

    if (intersects) inside = !inside;
  }

  return inside;
}

function getPolygonGeometries(boundary) {
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

// Convert the boundary ONCE (not on every tap / every incident / every render).
function buildBoundaryShapes(boundary) {
  return getPolygonGeometries(boundary)
    .map(([outerRing, ...holeRings]) => {
      const outer = ringToLatLng(outerRing);
      if (outer.length < 3) return null;

      const lats = outer.map((p) => p.latitude);
      const lngs = outer.map((p) => p.longitude);

      return {
        outer,
        holes: holeRings.map(ringToLatLng),
        bbox: {
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
          minLng: Math.min(...lngs),
          maxLng: Math.max(...lngs),
        },
      };
    })
    .filter(Boolean);
}

const BOUNDARY_SHAPES = buildBoundaryShapes(BOUNDARY);
const BOUNDARY_RINGS = BOUNDARY_SHAPES.map((shape) => shape.outer);
const BOUNDARY_POINTS = BOUNDARY_RINGS.flat();

const BOUNDARY_CENTER = BOUNDARY_SHAPES.length
  ? {
      latitude:
        (Math.min(...BOUNDARY_SHAPES.map((s) => s.bbox.minLat)) +
          Math.max(...BOUNDARY_SHAPES.map((s) => s.bbox.maxLat))) /
        2,
      longitude:
        (Math.min(...BOUNDARY_SHAPES.map((s) => s.bbox.minLng)) +
          Math.max(...BOUNDARY_SHAPES.map((s) => s.bbox.maxLng))) /
        2,
    }
  : FALLBACK_CENTER;

function isInsideBoundary(latitude, longitude) {
  return BOUNDARY_SHAPES.some(({ outer, holes, bbox }) => {
    // Cheap bounding-box reject before the ray-casting test.
    if (
      latitude < bbox.minLat ||
      latitude > bbox.maxLat ||
      longitude < bbox.minLng ||
      longitude > bbox.maxLng
    ) {
      return false;
    }

    return (
      isPointInRing(latitude, longitude, outer) &&
      !holes.some((hole) => isPointInRing(latitude, longitude, hole))
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Resolvers                                                                  */
/* -------------------------------------------------------------------------- */

function resolveCategory(category) {
  const resolved = getCategory(category);
  const key = CATEGORY_META[resolved?.key] ? resolved.key : 'incident';
  const meta = CATEGORY_META[key];

  return {
    key,
    label: resolved?.label || 'Incident',
    color: resolved?.color || meta.color,
    Icon: meta.Icon,
  };
}

function resolveStatus(status) {
  const resolved = getStatus(status);

  return {
    label: resolved?.label || 'Unknown',
    color: resolved?.color || '#64748B',
  };
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

// Custom marker views are bitmap-cached when tracksViewChanges is false, which
// makes style changes (e.g. "selected") invisible. Track briefly after each
// change, then turn tracking off again for performance.
function useTemporaryViewTracking(dependency) {
  const [tracking, setTracking] = useState(true);

  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 350);
    return () => clearTimeout(timer);
  }, [dependency]);

  return tracking;
}

/* -------------------------------------------------------------------------- */
/* Small components                                                           */
/* -------------------------------------------------------------------------- */

function MapActionButton({ icon: Icon, onPress, label, active = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        tw`h-11 w-11 items-center justify-center rounded-xl`,
        {
          elevation: 4,
          opacity: pressed ? 0.7 : 1,
          backgroundColor: active ? '#2E8B57' : '#FFFFFF',
        },
      ]}
    >
      <Icon size={20} color={active ? '#FFFFFF' : '#374151'} />
    </Pressable>
  );
}

const IncidentMarker = memo(function IncidentMarker({
  incident,
  selected,
  onPress,
}) {
  const category = resolveCategory(incident.category);
  const status = resolveStatus(incident.status);
  const { Icon } = category;
  const tracking = useTemporaryViewTracking(
    `${selected}-${category.color}-${status.color}`
  );

  const borderColor = selected ? '#10B981' : '#FFFFFF';

  return (
    <Marker
      coordinate={toLatLng(incident)}
      onPress={() => onPress(incident)}
      tracksViewChanges={tracking}
      zIndex={selected ? 100 : 1}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View collapsable={false} style={{ width: 48, height: 58, alignItems: 'center', justifyContent: 'flex-start' }}>
        <View
          style={[
            tw`h-11 w-11 items-center justify-center rounded-full`,
            {
              backgroundColor: category.color,
              borderWidth: selected ? 3 : 2,
              borderColor,
              elevation: selected ? 10 : 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3,
            },
          ]}
        >
          <Icon size={20} color="#FFFFFF" />

          <View
            style={[
              tw`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white`,
              { backgroundColor: status.color },
            ]}
          />
        </View>

        {/* Pin tail */}
        <View
          style={{
            width: 0,
            height: 0,
            marginTop: -1,
            borderLeftWidth: 6,
            borderRightWidth: 6,
            borderTopWidth: 10,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: category.color,
          }}
        />
      </View>
    </Marker>
  );
});

function ResponderMarker({ tracker }) {
  const category = tracker.category ? resolveCategory(tracker.category) : null;
  const Icon = category?.Icon || Navigation;
  const color = category?.color || tracker.color || '#EC4899';

  return (
    <Marker coordinate={toLatLng(tracker)} tracksViewChanges={false} zIndex={200}>
      <View
        style={[
          tw`h-10 w-10 items-center justify-center rounded-full border-[3px] border-white`,
          { backgroundColor: color, elevation: 6 },
        ]}
      >
        <Icon size={19} color="#FFFFFF" />
      </View>
    </Marker>
  );
}

function DropOffMarker({ drop, onPress }) {
  return (
    <Marker
      coordinate={toLatLng(drop)}
      onPress={() => onPress?.(drop)}
      tracksViewChanges={false}
      zIndex={150}
    >
      <View
        style={tw`h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-blue-600 shadow`}
      >
        <Text style={tw`text-sm font-black text-white`}>H</Text>
      </View>
    </Marker>
  );
}

function MapLegend({ onClose }) {
  return (
    <View style={[tw`mt-2 w-52 rounded-xl bg-white p-3`, { elevation: 6 }]}>
      <View style={tw`mb-2 flex-row items-center justify-between`}>
        <Text style={tw`text-xs font-bold text-gray-800`}>Map Legend</Text>

        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close legend"
        >
          <X size={16} color="#6B7280" />
        </Pressable>
      </View>

      <Text style={tw`mb-2 text-[10px] font-bold uppercase text-gray-400`}>
        Incident categories
      </Text>

      {Object.entries(CATEGORY_META).map(([key, { Icon, color }]) => (
        <View key={key} style={tw`mb-2 flex-row items-center`}>
          <View
            style={[
              tw`mr-2 h-7 w-7 items-center justify-center rounded-full`,
              { backgroundColor: color },
            ]}
          >
            <Icon size={15} color="#FFFFFF" />
          </View>

          <Text style={tw`text-xs capitalize text-gray-700`}>{key}</Text>
        </View>
      ))}

      <View style={tw`my-2 h-px bg-gray-100`} />

      <Text style={tw`mb-2 text-[10px] font-bold uppercase text-gray-400`}>
        Incident status
      </Text>

      {Object.values(STATUSES).map((status) => (
        <View
          key={status.key || status.label}
          style={tw`mb-2 flex-row items-center`}
        >
          <View
            style={[
              tw`mr-2 h-3 w-3 rounded-full`,
              { backgroundColor: status.color },
            ]}
          />
          <Text style={tw`text-xs text-gray-700`}>{status.label}</Text>
        </View>
      ))}
    </View>
  );
}

function BasemapPicker({ value, onChange }) {
  return (
    <View
      style={[
        tw`mt-2 w-32 overflow-hidden rounded-xl bg-white p-1`,
        { elevation: 6 },
      ]}
    >
      {BASEMAPS.map((type) => {
        const selected = value === type;

        return (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={tw`rounded-lg px-3 py-3 ${
              selected ? 'bg-emerald-600' : 'bg-white'
            }`}
          >
            <Text
              style={[
                tw`text-xs font-semibold capitalize`,
                { color: selected ? '#FFFFFF' : '#374151' },
              ]}
            >
              {type}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function MapViewer({
  incidents = [],
  onLocationSelect,
  selectedLocation = null,
  compact = false,
  onIncidentSelect,
  selectedIncident = null,
  routes = [],
  trackers = [],
  dropOffs = [],
  showBackButton = true,
  showBasemapControl = true,
  showMapInfoButton = true,
  showZoomControls = true,
  showBoundary = true,
  highlightBoundary = true,
  fitPoints = null,
  topInset = null,
  bottomInset = 0,
  variant = 'viewer',
  onBack,
  onExpand,
  mapHeight,
  hideMapLabel = false,
  incidentLoading = false,
  navigationMode = false,
  navigationHeading = 0,
  recenterSignal = 0,
  navigationUserLocation = null,
  traveledRoute = [],
  highwayShields = [],
  compassResetSignal = 0,
  disableIncidentSheet = false,
}) {
  const insets = useSafeAreaInsets();
  const resolvedTopInset = topInset ?? insets.top;
  const mapRef = useRef(null);

  const [basemap, setBasemap] = useState('street');
  const [panel, setPanel] = useState(null); // null | 'legend' | 'layers'
  const [mapReady, setMapReady] = useState(false);
  const [activeIncident, setActiveIncident] = useState(selectedIncident);
  const [isFollowingNavigation, setIsFollowingNavigation] = useState(true);

  const isViewer = variant === 'viewer';
  const togglePanel = (name) =>
    setPanel((current) => (current === name ? null : name));

  // Keep local selection in sync with the parent.
  useEffect(() => {
    setActiveIncident(selectedIncident);
  }, [selectedIncident]);

  const displayIncidents = incidents;

  // Drop invalid coordinates and (optionally) anything outside Barangay 167.
  const visibleIncidents = useMemo(
    () =>
      displayIncidents.filter(
        (incident) =>
          hasValidCoords(incident) &&
          (!highlightBoundary ||
            isInsideBoundary(Number(incident.lat), Number(incident.lng)))
      ),
    [displayIncidents, highlightBoundary]
  );

  /* ------------------------------ Camera helpers ------------------------------ */

  const fitToCoordinates = useCallback(
    (coordinates) => {
      if (!coordinates.length) return;

      // The compact preview (e.g. on Home) is a small box, not full screen:
      // use tight padding so the barangay fills it instead of floating small.
      const edgePadding = compact
        ? { top: 8, right: 8, bottom: 8, left: 8 }
        : {
            top: insets.top + 80,
            right: 50,
            bottom: bottomInset + 80,
            left: 50,
          };

      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding,
        animated: true,
      });
    },
    [compact, insets.top, bottomInset]
  );

  const focusOn = useCallback((point) => {
    if (!hasValidCoords(point)) return;

    mapRef.current?.animateToRegion(
      {
        ...toLatLng(point),
        latitudeDelta: FOCUS_DELTA,
        longitudeDelta: FOCUS_DELTA,
      },
      600
    );
  }, []);

  const fitBarangay = useCallback(
    () => fitToCoordinates(BOUNDARY_POINTS),
    [fitToCoordinates]
  );

  const hasFitPoints = !!fitPoints?.length;

  // Fit the barangay once the map is ready (unless custom fit points exist).
  useEffect(() => {
    if (!mapReady || !highlightBoundary || hasFitPoints) return;

    const timer = setTimeout(fitBarangay, 300);
    return () => clearTimeout(timer);
  }, [mapReady, highlightBoundary, hasFitPoints, fitBarangay]);

  // Fit responder / destination points. Keyed by value so a new array with the
  // same points from the parent doesn't re-trigger the camera.
  const fitKey = hasFitPoints
    ? fitPoints.map((point) => `${point.lat},${point.lng}`).join('|')
    : '';

  useEffect(() => {
    if (!mapReady || !fitKey) return;

    setIsFollowingNavigation(true);
    if (navigationMode && hasValidCoords(navigationUserLocation)) {
      mapRef.current?.animateCamera(
        {
          center: toLatLng(navigationUserLocation),
          pitch: 55,
          heading: navigationHeading,
          zoom: 17.5,
        },
        { duration: 650 },
      );
      return;
    }
    fitToCoordinates(fitPoints.filter(hasValidCoords).map(toLatLng));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, fitKey, fitToCoordinates, navigationMode, navigationHeading, recenterSignal, navigationUserLocation?.lat, navigationUserLocation?.lng]);

  useEffect(() => {
    if (!mapReady || !navigationMode || !compassResetSignal) return;
    mapRef.current?.animateCamera(
      { pitch: 55, heading: 0 },
      { duration: 450 },
    );
  }, [mapReady, navigationMode, compassResetSignal]);

  useEffect(() => {
    if (mapReady && activeIncident) focusOn(activeIncident);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeIncident?.id, focusOn]);

  useEffect(() => {
    if (mapReady && selectedLocation) focusOn(selectedLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, selectedLocation?.lat, selectedLocation?.lng, focusOn]);

  /* -------------------------------- Handlers -------------------------------- */

  const handleIncidentPress = useCallback(
    (incident) => {
      setActiveIncident(incident);
      onIncidentSelect?.(incident);
    },
    [onIncidentSelect]
  );

  const handleIncidentClose = useCallback(() => {
    setActiveIncident(null);
    onIncidentSelect?.(null);
  }, [onIncidentSelect]);

  const handleMapPress = (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    // Tapping empty map space dismisses an open incident sheet.
    if (activeIncident) handleIncidentClose();
    if (panel) setPanel(null);

    if (highlightBoundary && !isInsideBoundary(latitude, longitude)) return;

    onLocationSelect?.({ lat: latitude, lng: longitude });
  };

  const handleNavigationPan = () => {
    if (navigationMode) setIsFollowingNavigation(false);
  };

  const zoomBy = async (delta) => {
    try {
      const camera = await mapRef.current?.getCamera();
      if (!camera) return;

      const zoom = Math.min(
        Math.max((camera.zoom || DEFAULT_ZOOM) + delta, MIN_ZOOM),
        MAX_ZOOM
      );

      mapRef.current?.animateCamera({ zoom }, { duration: 250 });
    } catch (error) {
      console.warn('Unable to change zoom:', error);
    }
  };

  const resetMap = () => {
    if (highlightBoundary) {
      fitBarangay();
    } else {
      mapRef.current?.animateToRegion(
        { ...BOUNDARY_CENTER, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        500
      );
    }
  };

  const handleBasemapChange = (value) => {
    setBasemap(value);
    setPanel(null);
  };

  /* --------------------------------- Render --------------------------------- */

  const reportCount = visibleIncidents.length;

  return (
    <View
      style={[
        tw`relative w-full overflow-hidden bg-gray-200`,
        compact ? tw`h-80` : tw`flex-1`,
        mapHeight ? { height: mapHeight } : null,
      ]}
    >
      <MapView
        ref={mapRef}
        style={tw`flex-1`}
        initialRegion={{
          ...BOUNDARY_CENTER,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
        mapType={basemap === 'satellite' ? 'satellite' : 'standard'}
        userInterfaceStyle="light"
        customMapStyle={navigationMode ? NAVIGATION_MAP_STYLE : undefined}
        pitchEnabled={navigationMode}
        rotateEnabled={navigationMode}
        showsBuildings={navigationMode}
        showsCompass
        showsScale
        showsTraffic={false}
        onMapReady={() => setMapReady(true)}
        onPress={handleMapPress}
        onPanDrag={handleNavigationPan}
        minZoomLevel={MIN_ZOOM}
        maxZoomLevel={MAX_ZOOM}
      >
        {showBoundary &&
          BOUNDARY_RINGS.map((coordinates, index) => (
            <Polygon
              key={`boundary-${index}`}
              coordinates={coordinates}
              strokeColor="#15803D"
              strokeWidth={3}
              fillColor="rgba(34, 197, 94, 0.08)"
              lineDashPattern={[8, 6]}
            />
          ))}

        {hasValidCoords(selectedLocation) && (
          <Marker
            coordinate={toLatLng(selectedLocation)}
            tracksViewChanges={false}
            zIndex={300}
          >
            <View
              style={tw`h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-emerald-600`}
            >
              <View style={tw`h-3 w-3 rounded-full bg-white`} />
            </View>
          </Marker>
        )}

        {visibleIncidents.map((incident) => (
          <IncidentMarker
            key={incident.id}
            incident={incident}
            selected={activeIncident?.id === incident.id}
            onPress={handleIncidentPress}
          />
        ))}

        {navigationMode && traveledRoute.length > 1 ? (
          <Polyline
            coordinates={traveledRoute.filter(hasValidCoords).map(toLatLng)}
            strokeColor="#6E859E"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {routes.map((route) => {
          const coordinates = (route.points || [])
            .filter(hasValidCoords)
            .map(toLatLng);

          if (coordinates.length < 2) return null;

          return (
            <Polyline
              key={route.id}
              coordinates={coordinates}
              strokeColor={navigationMode ? '#15803D' : route.color || '#1F7A4D'}
              strokeWidth={navigationMode ? 10 : 6}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={route.dashed === false ? undefined : [8, 7]}
            />
          );
        })}

        {navigationMode && hasValidCoords(navigationUserLocation) ? (
          <Marker
            coordinate={toLatLng(navigationUserLocation)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={300}
          >
            <View collapsable={false} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <View style={isFollowingNavigation ? tw`h-12 w-12 items-center justify-center rounded-full bg-blue-500/25` : tw`h-12 w-12 items-center justify-center rounded-full bg-slate-400/25`}>
                <View style={tw`h-7 w-7 items-center justify-center rounded-full border-2 border-blue-700 bg-blue-500`}>
                  <View style={tw`h-2.5 w-2.5 rounded-full bg-white`} />
                </View>
              </View>
            </View>
          </Marker>
        ) : null}

        {trackers.filter(hasValidCoords).map((tracker) => (
          <ResponderMarker key={tracker.id} tracker={tracker} />
        ))}

        {dropOffs.filter(hasValidCoords).map((drop) => (
          <DropOffMarker key={drop.id} drop={drop} onPress={handleIncidentPress} />
        ))}
      </MapView>

      {!mapReady && (
        <View
          style={tw`absolute inset-0 items-center justify-center bg-gray-100`}
        >
          <ActivityIndicator size="large" color="#2E8B57" />
          <Text style={tw`mt-2 text-xs text-gray-500`}>
            Loading Barangay 167 map...
          </Text>
        </View>
      )}

      {/* Top-left: back, label, legend */}
      {isViewer && !navigationMode && (
        <View
          style={[tw`absolute left-3 right-16`, { top: resolvedTopInset + 12 }]}
          pointerEvents="box-none"
        >
          <View style={tw`flex-row items-start gap-2`}>
            {showBackButton && !compact && (
              <MapActionButton icon={ArrowLeft} label="Go back" onPress={onBack} />
            )}

            {!hideMapLabel && (
              <View
                style={[tw`rounded-xl ml-14.5 bg-white px-3 py-2`, { elevation: 4 }]}
              >
                <Text style={tw`text-sm font-bold text-gray-900`}>
                  Barangay 167
                </Text>
                <Text style={tw`text-[11px] text-gray-500`}>
                  {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                </Text>
              </View>
            )}

            {!compact && showMapInfoButton && (
              <MapActionButton
                icon={Info}
                label="Toggle map legend"
                active={panel === 'legend'}
                onPress={() => togglePanel('legend')}
              />
            )}
          </View>

          {panel === 'legend' && <MapLegend onClose={() => setPanel(null)} />}
        </View>
      )}

      {/* Top-right: layers, expand, locate, zoom */}
      {isViewer && !navigationMode && (
        <View
          style={[
            tw`absolute right-3 items-end gap-2`,
            { top: resolvedTopInset + 12 },
          ]}
        >
          {showBasemapControl ? (
            <View style={tw`items-end`}>
              <MapActionButton
                icon={Layers}
                label="Change map layer"
                active={panel === 'layers'}
                onPress={() => togglePanel('layers')}
              />

              {panel === 'layers' && (
                <BasemapPicker value={basemap} onChange={handleBasemapChange} />
              )}
            </View>
          ) : null}

          {compact && onExpand && (
            <MapActionButton
              icon={Maximize2}
              label="Expand map"
              onPress={onExpand}
            />
          )}

          {!compact && (
            <>
              <MapActionButton
                icon={LocateFixed}
                label="Reset map view"
                onPress={resetMap}
              />

              {showZoomControls ? (
                <View
                  style={[
                    tw`overflow-hidden rounded-xl bg-white`,
                    { elevation: 4 },
                  ]}
                >
                  <Pressable
                    onPress={() => zoomBy(1)}
                    accessibilityRole="button"
                    accessibilityLabel="Zoom in"
                    style={tw`h-11 w-11 items-center justify-center`}
                  >
                    <Plus size={21} color="#374151" />
                  </Pressable>

                  <View style={tw`h-px bg-gray-200`} />

                  <Pressable
                    onPress={() => zoomBy(-1)}
                    accessibilityRole="button"
                    accessibilityLabel="Zoom out"
                    style={tw`h-11 w-11 items-center justify-center`}
                  >
                    <Minus size={21} color="#374151" />
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      )}

      {isViewer && activeIncident && !disableIncidentSheet && (
        <IncidentSheet
          incident={activeIncident}
          onClose={handleIncidentClose}
          isLoading={incidentLoading}
        />
      )}
    </View>
  );
}