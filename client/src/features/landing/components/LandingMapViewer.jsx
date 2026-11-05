import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import "leaflet/dist/leaflet.css";
import {
  Flame,
  Ambulance,
  Shield,
  Wrench,
  AlertCircle,
  Maximize2,
  Check,
  Eye,
} from "lucide-react";

const BOUNDARY_URL = "/barangay-167.geojson";
const DEFAULT_CENTER = [14.7347, 121.0118];
const DEFAULT_ZOOM = 15.5;

const BASEMAPS = {
  street: {
    label: "Map",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credit: "&copy; OpenStreetMap contributors",
  },
  satellite: {
    label: "Satellite",
    url:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Tiles &copy; Esri",
  },
};

// Outside mask helper
function makeMask(boundary) {
  const world = [
    [-180, -90],
    [180, -90],
    [180, 90],
    [-180, 90],
    [-180, -90],
  ];
  const features =
    boundary.type === "FeatureCollection" ? boundary.features : [boundary];
  const holes = features.flatMap(({ geometry: g }) =>
    g.type === "Polygon" ? g.coordinates : g.coordinates.flat(),
  );
  return { type: "Polygon", coordinates: [world, ...holes] };
}

function isInside(lat, lng, boundary) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !boundary) return true;
  const features =
    boundary.type === "FeatureCollection" ? boundary.features : [boundary];
  return features.some(
    (f) => f.geometry && booleanPointInPolygon([lng, lat], f),
  );
}

// Custom Marker Icons
const iconCache = {};

function createCustomPin(type, categoryName = "", isSelected = false) {
  const key = `${type}-${categoryName}-${isSelected ? "sel" : "norm"}`;
  if (iconCache[key]) return iconCache[key];

  let bgGradient = "linear-gradient(135deg, #ef4444, #b91c1c)"; // default red
  let ringColor = "#ef4444";
  let glyphSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z"/></svg>`;

  if (type === "sudden") {
    if (categoryName.toLowerCase().includes("fire")) {
      bgGradient = "linear-gradient(135deg, #ef4444, #b91c1c)";
      ringColor = "#ef4444";
      glyphSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
    } else if (categoryName.toLowerCase().includes("medic")) {
      bgGradient = "linear-gradient(135deg, #ef4444, #991b1b)";
      ringColor = "#ef4444";
      glyphSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
    } else {
      bgGradient = "linear-gradient(135deg, #dc2626, #991b1b)";
      ringColor = "#dc2626";
      glyphSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }
  } else if (type === "maintenance") {
    bgGradient = "linear-gradient(135deg, #f59e0b, #d97706)";
    ringColor = "#d97706";
    glyphSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
  } else if (type === "pending") {
    bgGradient = "linear-gradient(135deg, #64748b, #475569)";
    ringColor = "#64748b";
    glyphSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  } else if (type === "unit") {
    bgGradient = "linear-gradient(135deg, #0284c7, #0369a1)";
    ringColor = "#0284c7";
    glyphSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  }

  const w = isSelected ? 42 : 36;
  const h = isSelected ? 50 : 44;

  iconCache[key] = L.divIcon({
    className: "custom-leaflet-pin",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
    html: `
      <div style="position:relative; width:${w}px; height:${h}px; display:flex; flex-direction:column; align-items:center;">
        ${
          isSelected
            ? `<div style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:32px; height:32px; border-radius:50%; background:${ringColor}; opacity:0.35; animation:ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
            : ""
        }
        <div style="
          width:${w - 6}px; 
          height:${w - 6}px; 
          border-radius:50% 50% 50% 0; 
          transform:rotate(-45deg); 
          background:${bgGradient}; 
          display:flex; 
          align-items:center; 
          justify-content:center; 
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border: 2px solid #ffffff;
        ">
          <div style="transform:rotate(45deg); display:flex; align-items:center; justify-content:center;">
            ${glyphSvg}
          </div>
        </div>
        <div style="width:5px; height:5px; border-radius:50%; background:#1e293b; margin-top:-2px; opacity:0.6;"></div>
      </div>
    `,
  });

  return iconCache[key];
}

// Map bounds controller
function MapAutoBounds({ boundary, selectedLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!boundary) return;
    try {
      const geoLayer = L.geoJSON(boundary);
      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
        map.setMinZoom(14);
      }
    } catch (e) {
      console.error("Bounds error", e);
    }
  }, [boundary, map]);

  useEffect(() => {
    if (selectedLocation) {
      map.flyTo([selectedLocation.lat, selectedLocation.lng], 17.5, {
        duration: 0.8,
      });
    }
  }, [selectedLocation, map]);

  return null;
}

// Click listener to pick report spot
function MapClickListener({ onLocationSelect, boundary }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (onLocationSelect) {
        onLocationSelect({ lat, lng });
      }
    },
  });
  return null;
}

export default function LandingMapViewer({
  reports = [],
  bdrrmoUnits = [],
  selectedReport = null,
  onSelectReport = () => {},
  selectedCoordinates = null,
  onLocationSelect = null,
  isPickingLocation = false,
}) {
  const [boundary, setBoundary] = useState(null);
  const [basemap, setBasemap] = useState("street");
  const [layers, setLayers] = useState({
    all: true,
    sudden: true,
    maintenance: true,
    units: true,
  });
  const mapRef = useRef(null);

  // Load geojson boundary
  useEffect(() => {
    fetch(BOUNDARY_URL)
      .then((res) => res.json())
      .then(setBoundary)
      .catch((err) => console.error("Boundary load error:", err));
  }, []);

  const mask = useMemo(() => boundary && makeMask(boundary), [boundary]);

  // Filtered reports
  const visibleReports = useMemo(() => {
    return reports.filter((rep) => {
      if (!layers.all) return false;
      if (rep.type === "sudden" && !layers.sudden) return false;
      if (rep.type === "maintenance" && !layers.maintenance) return false;
      return true;
    });
  }, [reports, layers]);

  // Reset view button
  const handleResetView = () => {
    if (!boundary || !mapRef.current) return;
    try {
      const bounds = L.geoJSON(boundary).getBounds();
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-md">
      {/* Interactive notification if in location picking mode */}
      {isPickingLocation && (
        <div className="absolute top-3 inset-x-3 z-[1000] mx-auto flex max-w-md items-center justify-between rounded-xl bg-slate-900/90 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Click anywhere inside Barangay 167 to set location pin</span>
          </div>
          <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] uppercase font-bold text-white">
            Active
          </span>
        </div>
      )}

      {/* Map Controls: Top Left (Basemap Switcher) */}
      <div className="pointer-events-none absolute top-3 left-3 z-[1000] flex items-center gap-2">
        <div className="pointer-events-auto flex overflow-hidden rounded-xl bg-white/95 p-1 shadow-md ring-1 ring-slate-900/10 backdrop-blur">
          {Object.entries(BASEMAPS).map(([key, config]) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasemap(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                basemap === key
                  ? "bg-[#2E8B57] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Controls: Top Right (Fit Bounds / Fullscreen) */}
      <div className="pointer-events-none absolute top-3 right-3 z-[1000] flex items-center gap-2">
        <button
          type="button"
          onClick={handleResetView}
          aria-label="Fit Barangay Boundary"
          title="Fit Barangay Boundary"
          className="pointer-events-auto flex h-9.5 w-9.5 items-center justify-center rounded-xl bg-white/95 text-slate-700 shadow-md ring-1 ring-slate-900/10 transition hover:bg-slate-50 hover:text-[#2E8B57] active:scale-95"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Leaflet Map Canvas */}
      <MapContainer
        ref={mapRef}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="h-full w-full min-h-[460px] lg:min-h-[580px]"
      >
        <TileLayer
          url={BASEMAPS[basemap].url}
          attribution={BASEMAPS[basemap].credit}
          maxZoom={20}
        />

        {/* Outer Mask (Darkens regions outside Brgy 167) */}
        {mask && (
          <GeoJSON
            data={mask}
            interactive={false}
            style={{
              weight: 0,
              fillColor: "#0f172a",
              fillOpacity: basemap === "satellite" ? 0.45 : 0.28,
            }}
          />
        )}

        {/* Barangay 167 Boundary Polygon */}
        {boundary && (
          <GeoJSON
            data={boundary}
            interactive={false}
            style={{
              color: "#2E8B57",
              weight: 3.5,
              opacity: 0.95,
              fillColor: "#2E8B57",
              fillOpacity: 0.08,
              dashArray: "6 4",
            }}
          />
        )}

        <MapAutoBounds
          boundary={boundary}
          selectedLocation={
            selectedReport
              ? { lat: selectedReport.lat, lng: selectedReport.lng }
              : selectedCoordinates
          }
        />

        <MapClickListener
          boundary={boundary}
          onLocationSelect={onLocationSelect}
        />

        {/* Temporary selected coordinate pin (when user clicks on map) */}
        {selectedCoordinates && (
          <Marker
            position={[selectedCoordinates.lat, selectedCoordinates.lng]}
            icon={createCustomPin("sudden", "Selected Point", true)}
          >
            <Popup>
              <div className="text-xs p-1">
                <p className="font-bold text-[#2E8B57]">Selected Location</p>
                <p className="text-slate-600 text-[11px]">
                  Lat: {selectedCoordinates.lat.toFixed(5)}, Lng: {selectedCoordinates.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Incident Pins */}
        {visibleReports.map((report) => {
          const isSelected = selectedReport?.id === report.id;
          return (
            <Marker
              key={report.id}
              position={[report.lat, report.lng]}
              icon={createCustomPin(report.type, report.category, isSelected)}
              eventHandlers={{
                click: () => onSelectReport(report),
              }}
            >
              <Popup className="geofix-leaflet-popup">
                <div className="w-60 p-1">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                      Report #{report.reportNumber}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        report.status === "resolved"
                          ? "bg-emerald-100 text-emerald-800"
                          : report.status === "in-progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {report.statusLabel}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 leading-snug">
                    {report.title}
                  </h4>
                  <p className="text-xs font-semibold text-[#2E8B57] mt-0.5">
                    📍 {report.location}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {report.description}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                    <span>Urgency: <strong className="text-slate-700">{report.urgency}</strong></span>
                    <span>{report.reportedAt}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* BDRRMO Units Pins */}
        {layers.units &&
          bdrrmoUnits.map((unit) => (
            <Marker
              key={unit.id}
              position={[unit.lat, unit.lng]}
              icon={createCustomPin("unit", unit.type)}
            >
              <Popup>
                <div className="p-1 text-xs">
                  <div className="flex items-center gap-1.5 text-sky-700 font-bold">
                    <Shield size={14} />
                    <span>{unit.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Status: <strong className="text-emerald-700">{unit.status}</strong>
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Floating Legend: Bottom Left (Matching Screenshot) */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000]">
        <div className="pointer-events-auto rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-900/10 backdrop-blur-md">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Legend
          </p>
          <div className="flex flex-col gap-1.5 text-xs font-medium text-slate-700">
            <div className="flex items-center gap-2">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
              </span>
              <span>Sudden Incidents</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
              </span>
              <span>Maintenance Issues</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-500 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
              </span>
              <span>Pending Verification</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Layers Control: Bottom Right (Matching Screenshot) */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-[1000]">
        <div className="pointer-events-auto rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-900/10 backdrop-blur-md">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Layers
          </p>
          <div className="flex flex-col gap-1.5 text-xs font-medium text-slate-700">
            <label className="flex cursor-pointer items-center gap-2 hover:text-slate-900">
              <input
                type="checkbox"
                checked={layers.all}
                onChange={(e) =>
                  setLayers((prev) => ({ ...prev, all: e.target.checked }))
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-[#2E8B57] focus:ring-[#2E8B57]"
              />
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                All Reports
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 hover:text-slate-900">
              <input
                type="checkbox"
                checked={layers.sudden}
                onChange={(e) =>
                  setLayers((prev) => ({ ...prev, sudden: e.target.checked }))
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-600"></span>
                Sudden Incidents
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 hover:text-slate-900">
              <input
                type="checkbox"
                checked={layers.maintenance}
                onChange={(e) =>
                  setLayers((prev) => ({
                    ...prev,
                    maintenance: e.target.checked,
                  }))
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                Maintenance
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 hover:text-slate-900">
              <input
                type="checkbox"
                checked={layers.units}
                onChange={(e) =>
                  setLayers((prev) => ({ ...prev, units: e.target.checked }))
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-600"></span>
                BDRRMO Units
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

