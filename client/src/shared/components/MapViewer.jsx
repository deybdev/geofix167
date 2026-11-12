import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { HeatLayer as LeafletHeatLayer } from "leaflet.heat";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import "leaflet/dist/leaflet.css";

const BOUNDARY_URL = "/barangay-167.geojson";
const DEFAULT_ZOOM = 15.5; // opening zoom (higher = closer)
const MAX_ZOOM = 22;

const BASEMAPS = {
  street: {
    label: "Map",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credit: "&copy; OpenStreetMap contributors",
  },
  satellite: {
    label: "Satellite",
    url:
      "https://server.arcgisonline.com/ArcGIS/rest/services" +
      "/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Tiles &copy; Esri",
  },
};

/* Glyphs are 24x24 outline icons, drawn in white on the pin. */
const CATEGORIES = {
  // Fire -> fire truck (ladder on the roof)
  fire: {
    color: "#dc2626",
    label: "Fire",
    glyph:
      '<path d="M14 18V9H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2M9 18h6"/>' +
      '<path d="M14 12h4l3 3.5V17a1 1 0 0 1-1 1h-1M4 5h9M6 5v4M11 5v4"/>' +
      '<circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  },
  // Incident -> ambulance
  incident: {
    color: "#2563eb",
    label: "Incident",
    glyph:
      '<path d="M10 10H6M8 8v4M9 18h6"/>' +
      '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>' +
      '<path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923' +
      "-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14" +
      '"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  },
  // Crime -> police shield with a star
  crime: {
    color: "#7c3aed",
    label: "Crime",
    glyph:
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
      '<path fill="#fff" stroke-width="1" d="M12 7.8l.82 2.07 2.22.14' +
      "-1.71 1.42.55 2.16L12 12.4l-1.88 1.19.55-2.16-1.71-1.42 2.22" +
      '-.14z"/>',
  },
  infrastructure: {
    color: "#d97706",
    label: "Infrastructure",
    glyph:
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77' +
      "-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91" +
      'a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  },
};

const STATUSES = {
  pending: { color: "#f59e0b", label: "Pending" },
  ongoing: { color: "#3b82f6", label: "Ongoing" },
  resolved: { color: "#16a34a", label: "Resolved" },
};

const STATUS_MATCH = [
  ["ongoing", /progress|ongoing|responding|assigned/],
  ["resolved", /resolv|done|complete|closed/],
  ["rejected", /reject|invalid|declin/],
];

// Older data may still say "emergency"; it maps to "incident"
const CATEGORY_ALIASES = { emergency: "incident" };

function getCategory(value) {
  const name = String(value).toLowerCase();
  const alias = CATEGORY_ALIASES[name] ?? name;
  const key = alias in CATEGORIES ? alias : "incident";
  return { key, ...CATEGORIES[key] };
}

function getStatus(value) {
  const text = String(value || "").toLowerCase();
  const match = STATUS_MATCH.find(([, regex]) => regex.test(text));
  const key = match ? match[0] : "pending";
  return { key, ...STATUSES[key] };
}

export { getCategory, getStatus };

/* ------------------------------ Geo helpers ------------------------------ */

const getFeatures = (boundary) =>
  boundary.type === "FeatureCollection" ? boundary.features : [boundary];

// True when the point falls inside the barangay boundary.
// Exported so report flows can enforce the Barangay-167-only rule.
export const isInside = (lat, lng, boundary) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  getFeatures(boundary).some(
    (f) => f.geometry && booleanPointInPolygon([lng, lat], f),
  );

// A world-sized polygon with the barangay cut out, used to dim the outside
function makeMask(boundary) {
  const world = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
  const holes = getFeatures(boundary).flatMap(({ geometry: g }) =>
    g.type === "Polygon" ? g.coordinates : g.coordinates.flat(),
  );
  return { type: "Polygon", coordinates: [world, ...holes] };
}

/* ------------------------------ Marker icons ------------------------------ */

const iconCache = {};

// Push pin = round head in the category color with the glyph on it, a collar,
// and a steel needle whose tip sits exactly on the incident location.
// A status-colored dot sits on the head's corner.
// When `selected`, the pin is larger and gets a glow ring plus a pulse
// at the needle tip so it stands out.
function pinIcon(category, status, selected = false) {
  const id = `${category.key}-${status.key}${selected ? "-sel" : ""}`;

  // SVG viewBox is 44x52; the needle tip is at (22, 50)
  const w = selected ? 52 : 44;
  const h = selected ? 62 : 52;
  const tipY = Math.round((h * 50) / 52);

  iconCache[id] ??= L.divIcon({
    className: "",
    iconSize: [w, h],
    iconAnchor: [w / 2, tipY],
    popupAnchor: [0, -(tipY - 4)],
    html: `
      <span style="width:${w}px;height:${h}px;display:block;position:relative;">
        ${
          selected
            ? `<span class="animate-ping rounded-full"
                     style="position:absolute;left:50%;top:${tipY}px;
                            width:26px;height:12px;margin:-6px 0 0 -13px;
                            background:#10b98166"></span>`
            : ""
        }
        <svg width="${w}" height="${h}" viewBox="0 0 44 52" style="
             position:relative;overflow:visible;
             filter:drop-shadow(0 2px 2px #0005)${
               selected ? " drop-shadow(0 0 8px #10b981aa)" : ""
             }">
          <!-- contact shadow where the needle enters the ground -->
          <ellipse cx="22" cy="50" rx="5" ry="1.8" fill="#0006"/>
          <!-- needle -->
          <path d="M20.6 33 L22 50 L23.4 33z" fill="#94a3b8"
                stroke="#475569" stroke-width="0.8" stroke-linejoin="round"/>
          <!-- collar -->
          <rect x="14" y="28" width="16" height="6" rx="3"
                fill="${category.color}" stroke="${
                  selected ? "#10b981" : "#fff"
                }" stroke-width="2"/>
          <!-- head -->
          <circle cx="22" cy="16" r="14" fill="${category.color}"
                  stroke="${selected ? "#10b981" : "#fff"}" stroke-width="2.5"/>
          <!-- soft highlight for a 3D feel -->
          <path d="M12.5 11a11 11 0 0 1 8-6" fill="none" stroke="#fff"
                stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>
          <svg x="11" y="5" width="22" height="22" viewBox="0 0 24 24"
               fill="none" stroke="#fff" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            ${category.glyph}
          </svg>
          <circle cx="37" cy="6" r="6" fill="${status.color}"
                  stroke="#fff" stroke-width="2"/>
        </svg>
      </span>`,
  });

  return iconCache[id];
}

// Selected spot: a pulsing green dot
const selectedIcon = L.divIcon({
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  html: `
    <span class="relative flex h-10 w-10 items-center justify-center">
      <span class="absolute h-7 w-7 animate-ping rounded-full
                   bg-emerald-500/60"></span>
      <span class="relative h-5 w-5 rounded-full border-[3px] border-white
                   bg-emerald-600 shadow-lg"></span>
    </span>`,
});

/* Moving responder unit: a color-filled circular badge with the agency glyph
   (police/fire/ambulance), a white ring, and a pulse so it reads as an
   active unit in transit rather than a static location. */
const trackerIconCache = {};

function trackerIcon(category) {
  const resolved = typeof category === "string" ? getCategory(category) : category;
  const cacheKey = `trk-${resolved.key}`;
  trackerIconCache[cacheKey] ??= L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `
      <span style="width:34px;height:34px;display:block;position:relative;">
        <span class="animate-ping rounded-full"
              style="position:absolute;inset:0;border-radius:9999px;background:${resolved.color}55"></span>
        <span style="position:absolute;left:2px;top:2px;width:30px;height:30px;
                     border-radius:9999px;background:${resolved.color};
                     border:2.5px solid #fff;box-shadow:0 2px 6px #0005;
                     display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${resolved.glyph}</svg>
        </span>
      </span>`,
  });
  return trackerIconCache[cacheKey];
}

/* Drop-off: a green square-topped pin with a down arrow marking where a
   responding unit delivers its passengers or payload (e.g. the ambulance's
   patient transport destination). */
const DROP_OFF_ICON = L.divIcon({
  className: "",
  iconSize: [26, 34],
  iconAnchor: [13, 33],
  html: `
    <svg width="26" height="34" viewBox="0 0 26 34"
         style="filter:drop-shadow(0 2px 2px #0005)">
      <ellipse cx="13" cy="31.5" rx="4" ry="1.4" fill="#0006"/>
      <path d="M10.8 21.5 L13 31.5 L15.2 21.5 Z" fill="#94a3b8"
            stroke="#475569" stroke-width="0.8" stroke-linejoin="round"/>
      <rect x="1.5" y="1" width="23" height="21.5" rx="7" fill="#10b981"
            stroke="#fff" stroke-width="2"/>
      <path d="M13 5.8v11.4M8.7 12.6l4.3 4.6 4.3-4.6" fill="none" stroke="#fff"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
});

/* ------------------------------ Map behavior ------------------------------ */

// Start zoomed in, stop zooming out at the whole barangay, lock panning
function FitBarangay({ boundary, fitRef }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.geoJSON(boundary).getBounds();
    if (!bounds.isValid()) return;

    let frame;
    let tries = 0;

    // The container can still be 0x0 while the page is laying out (e.g.
    // when the map page is first opened). Wait for a real size so the
    // fit is computed against the actual viewport instead of a default.
    const fit = () => {
      const size = map.getSize();
      if (!size.x || !size.y) {
        if (++tries < 120) frame = requestAnimationFrame(fit);
        return;
      }

      map.invalidateSize();
      const fullZoom = map.getBoundsZoom(bounds, false, L.point(20, 20));
      const zoom = Math.max(DEFAULT_ZOOM, fullZoom);

      map.setMaxBounds(bounds.pad(0.15));
      map.setMinZoom(fullZoom);
      map.setView(bounds.getCenter(), zoom, { animate: false });

      fitRef.current = () => map.flyToBounds(bounds, { padding: [20, 20] });
    };

    fit();
    return () => cancelAnimationFrame(frame);
  }, [boundary, map, fitRef]);

  return null;
}

// Density heatmap of incident locations (leaflet.heat); replaces the pins
function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const layer = new LeafletHeatLayer(points, {
      radius: 26,
      blur: 20,
      maxZoom: 19,
      minOpacity: 0.35,
      gradient: { 0.2: "#fbbf24", 0.45: "#f97316", 0.7: "#dc2626", 1: "#7f1d1d" },
    });
    layer.addTo(map);
    return () => map.removeLayer(layer);
  }, [map, points]);

  return null;
}

// Only accept clicks inside the barangay
function ClickHandler({ boundary, onSelect }) {
  useMapEvents({
    click({ latlng: { lat, lng } }) {
      if (isInside(lat, lng, boundary)) onSelect?.({ lat, lng });
    },
  });

  return null;
}

// Gently center the map on the selected incident pin — only when the incident
// actually sits inside the barangay. Out-of-boundary selections (bad/mock data)
// must not drag the camera away from the highlighted scope.
function FlyToIncident({ incident, boundary }) {
  const map = useMap();

  useEffect(() => {
    if (incident && isInside(incident.lat, incident.lng, boundary)) {
      map.flyTo([incident.lat, incident.lng], Math.max(map.getZoom(), 17), {
        duration: 0.6,
      });
    }
  }, [incident, map]);

  return null;
}

// Pan the map to keep the freshly chosen spot visible, but only
// when it is NOT already on screen (so taping near the edge centers
// it, while taps in the middle don't feel like a rubber band).
// With a bottom sheet covering the map (bottomInset > 0), the pin is
// centered in the visible strip above the sheet instead of the screen
// middle it would hide behind.
function FlyToSelected({ selectedLocation, bottomInset = 0 }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedLocation) return;
    const { lat, lng } = selectedLocation;

    if (bottomInset > 0) {
      const zoom = Math.max(map.getZoom(), 17);
      const size = map.getSize();
      const shift = Math.min(bottomInset, size.y * 0.6) / 2;
      const target = map.project([lat, lng], zoom).add([0, shift]);
      map.flyTo(map.unproject(target, zoom), zoom, { duration: 0.6 });
      return;
    }

    if (map.getBounds().pad(-0.15).contains([lat, lng])) return;

    map.flyTo([lat, lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
  }, [selectedLocation, map, bottomInset]);

  return null;
}

// Frame every pin in play (e.g. the user's pin + the responder's station)
// inside the visible strip above the bottom sheet, biased toward the top,
// so nothing ends up hidden behind it. Used when the caller opts out of
// the barangay highlight (fitPoints is provided).
function FitOverlay({ points, bottomInset = 0 }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map(({ lat, lng }) => [lat, lng]));
    if (!bounds.isValid()) return;

    map.fitBounds(bounds, {
      paddingTopLeft: [48, 48],
      paddingBottomRight: [48, bottomInset + 32],
      maxZoom: 17,
    });
  }, [map, points, bottomInset]);

  return null;
}

/* -------------------------------- Component -------------------------------- */

const BTN =
  "pointer-events-auto flex h-11 w-11 items-center justify-center " +
  "rounded-xl shadow-lg ring-1 ring-black/5";
const CARD = "rounded-xl bg-white/95 shadow-lg ring-1 ring-black/5";

const Dot = ({ color }) => (
  <span className="h-3 w-3 rounded-full" style={{ background: color }} />
);

// Small round badge with the category icon, used in the legend
const Badge = ({ color, glyph }) => (
  <span
    className="flex h-6 w-6 items-center justify-center rounded-full"
    style={{ background: color }}
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: glyph }}
    />
  </span>
);

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
  variant = "viewer",
  backPath = "/resident",
   heatmap = false,
   expandPath = null,
   bottomInset = 0,
   highlightBoundary = true,
   fitPoints = null,
 }) {
  const navigate = useNavigate();
  const [boundary, setBoundary] = useState(null);
  const [basemap, setBasemap] = useState("street");
  const [legendOpen, setLegendOpen] = useState(false);
  const [map, setMap] = useState(null);
  const fitRef = useRef(null);

  useEffect(() => {
    fetch(BOUNDARY_URL)
      .then((res) => res.json())
      .then(setBoundary)
      .catch((err) => console.error("Barangay boundary error:", err));
  }, []);

  const mask = useMemo(() => boundary && makeMask(boundary), [boundary]);

  // Open already centered on the zone instead of the hardcoded default,
  // so there is no jump while FitBarangay settles the exact view
  const homeCenter = useMemo(() => {
    if (!boundary) return null;
    const bounds = L.geoJSON(boundary).getBounds();
    return bounds.isValid() ? [bounds.getCenter().lat, bounds.getCenter().lng] : null;
  }, [boundary]);

  // Without the barangay highlight (e.g. responder tracking), pins show
  // wherever they are — stations can sit outside the boundary.
  const visible = useMemo(
    () =>
      !highlightBoundary
        ? incidents
        : boundary
          ? incidents.filter((i) => isInside(i.lat, i.lng, boundary))
          : [],
    [incidents, boundary, highlightBoundary],
  );

  const heatPoints = useMemo(
    () => visible.map((i) => [i.lat, i.lng, 1]),
    [visible],
  );

  if (!boundary) return null;

  const base = BASEMAPS[basemap];
  const showSelected = highlightBoundary
    ? selectedLocation &&
      isInside(selectedLocation.lat, selectedLocation.lng, boundary)
    : Boolean(selectedLocation);
  const useFitOverlay = Array.isArray(fitPoints) && fitPoints.length > 0;

  return (
    <div className="relative z-0 isolate h-full w-full overflow-hidden">
      <MapContainer
        ref={setMap}
        center={homeCenter ?? [14.75, 121.02]}
        zoom={DEFAULT_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomSnap={0.5}
        zoomControl={false}
        maxBoundsViscosity={1}
        className={`${compact ? "h-[300px] sm:h-[340px]" : "h-full"} w-full`}
        style={{ background: "#e5e7eb" }}
      >
        <TileLayer
          key={basemap}
          url={base.url}
          attribution={base.credit}
          maxNativeZoom={19}
          maxZoom={MAX_ZOOM}
        />

        {highlightBoundary && (
          <GeoJSON
            data={mask}
            interactive={false}
            style={{ weight: 0, fillColor: "#0f172a", fillOpacity: 0.5 }}
          />
        )}

        {highlightBoundary && (
          <GeoJSON
            key={JSON.stringify(boundary)}
            data={boundary}
            interactive={false}
            style={{
              color: basemap === "satellite" ? "#86efac" : "#15803d",
              weight: 3,
              fillColor: "#22c55e",
              fillOpacity: 0.08,
              dashArray: "8 6",
            }}
          />
        )}

        {highlightBoundary && <FitBarangay boundary={boundary} fitRef={fitRef} />}
        <ClickHandler boundary={boundary} onSelect={onLocationSelect} />
        <FlyToIncident incident={selectedIncident} boundary={boundary} />
        {useFitOverlay ? (
          <FitOverlay points={fitPoints} bottomInset={bottomInset} />
        ) : (
          <FlyToSelected
            selectedLocation={selectedLocation}
            bottomInset={bottomInset}
          />
        )}

        {showSelected && (
          <Marker
            position={[selectedLocation.lat, selectedLocation.lng]}
            icon={selectedIcon}
            zIndexOffset={2000}
            interactive={false}
          />
        )}

        {heatmap ? (
          <HeatLayer points={heatPoints} />
        ) : (
          visible.map((incident) => {
            const category = getCategory(incident.category);
            const status = getStatus(incident.status);
            const isPinned = incident.id === selectedIncident?.id;

            return (
              <Marker
                key={incident.id}
                position={[incident.lat, incident.lng]}
                icon={pinIcon(category, status, isPinned)}
                eventHandlers={{
                  click: () => onIncidentSelect?.(incident),
                }}
                zIndexOffset={isPinned ? 1500 : 0}
              />
            );
          })
        )}

        {/* Route lines (e.g. responder travel routes) — dashed by default,
            callers can override color or pass dashed:false for a solid line */}
        {routes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.points.map(({ lat, lng }) => [lat, lng])}
            pathOptions={{
              color: route.color || "#10b981",
              weight: 4,
              dashArray: route.dashed === false ? undefined : "8 7",
              lineCap: "round",
              lineJoin: "round",
            }}
            interactive={false}
          />
        ))}

        {/* Moving responder units traveling along their route: a glyphed
            agency badge when a category is given, plain dot otherwise */}
        {trackers.map((tracker) => (
          tracker.category ? (
            <Marker
              key={tracker.id}
              position={[tracker.lat, tracker.lng]}
              icon={trackerIcon(tracker.category)}
              interactive={false}
              zIndexOffset={2000}
            />
          ) : (
            <CircleMarker
              key={tracker.id}
              center={[tracker.lat, tracker.lng]}
              radius={7}
              pathOptions={{
                color: "#fff",
                weight: 2.5,
                fillColor: tracker.color || "#ec4899",
                fillOpacity: 1,
              }}
              interactive={false}
            />
          )
        ))}

        {/* Drop-off destinations the responding units deliver to */}
        {dropOffs.map((drop) => (
          <Marker
            key={drop.id}
            position={[drop.lat, drop.lng]}
            icon={DROP_OFF_ICON}
            title={`Drop-off${drop.title ? `: ${drop.title}` : " point"}`}
            interactive={false}
            zIndexOffset={1500}
          />
        ))}
      </MapContainer>

      {/* Top left: title + legend button */}
      {variant === "viewer" && (
        <div
          className="pointer-events-none absolute left-3 top-3 z-[1000]
                     flex flex-col items-start gap-2"
        >
        <div className="flex gap-2">
          {!compact && (
            <button
              type="button"
              aria-label="Back to resident home"
              onClick={() => navigate(backPath)}
              className={`${BTN} bg-white/95 text-gray-700`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          )}
          <div className={`${CARD} px-3 py-2`}>
            <p className="text-sm font-bold leading-tight">Barangay 167</p>
            <p className="text-[11px] text-gray-500">
              {visible.length} report{visible.length === 1 ? "" : "s"}
            </p>
          </div>

          {!compact && (
            <button
              type="button"
              aria-label="Show legend"
              onClick={() => setLegendOpen(!legendOpen)}
              className={`${BTN} h-auto ${
                legendOpen
                  ? "bg-emerald-600 text-white"
                  : "bg-white/95 text-gray-700"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          )}
        </div>

        {legendOpen && (
          <div className={`${CARD} pointer-events-auto space-y-2 p-3`}>
            {[
              ["Type", CATEGORIES],
              ["Status badge", STATUSES],
            ].map(([title, items]) => (
              <div key={title} className="space-y-1">
                <p className="text-[10px] font-semibold uppercase text-gray-400">
                  {title}
                </p>
                {Object.values(items).map(({ label, color, glyph }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-xs text-gray-700"
                  >
                    {glyph ? (
                      <Badge color={color} glyph={glyph} />
                    ) : (
                      <Dot color={color} />
                    )}
                    {label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Top right: basemap switch + show whole barangay */}
      {variant === "viewer" && (
        <div
          className="pointer-events-none absolute right-3 top-3 z-[1000]
                     flex flex-col items-end gap-2"
        >
        <div
          className="pointer-events-auto flex rounded-xl bg-white p-1
                     text-xs font-semibold shadow-lg ring-1 ring-black/5"
        >
          {Object.entries(BASEMAPS).map(([key, { label }]) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasemap(key)}
              className={`rounded-lg px-3 py-2 ${
                basemap === key ? "bg-emerald-600 text-white" : "text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Expand: opens this map as a whole page (with its incidents) */}
        {compact && expandPath && (
          <button
            type="button"
            aria-label="Expand map to full page"
            onClick={() =>
              navigate(expandPath, {
                state: {
                  incidents: visible,
                  heatmap,
                  routes,
                  trackers,
                  dropOffs,
                  selectedIncident,
                },
              })
            }
            className={`${BTN} bg-white text-gray-700`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        )}

        {!compact && highlightBoundary && (
          <button
            type="button"
            aria-label="Show entire barangay"
            onClick={() => fitRef.current?.()}
            className={`${BTN} bg-white text-gray-700`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        )}

        {!compact && (
          <div
            className="pointer-events-auto flex flex-col overflow-hidden
                       rounded-xl bg-white text-xl text-gray-700 shadow-lg
                       ring-1 ring-black/5"
          >
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => map?.zoomIn()}
              className="flex h-11 w-11 items-center justify-center"
            >
              +
            </button>
            <div className="h-px bg-gray-200" />
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => map?.zoomOut()}
              className="flex h-11 w-11 items-center justify-center"
            >
              &minus;
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}