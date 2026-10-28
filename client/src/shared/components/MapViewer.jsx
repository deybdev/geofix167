
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet marker icons in Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const BOUNDARY_URL = "/barangay-167.geojson";

// Automatically focus the map on Barangay 167
function FitBarangay({ boundary }) {
  const map = useMap();

  useEffect(() => {
    if (!boundary) return;

    const boundaryLayer = L.geoJSON(boundary);
    const bounds = boundaryLayer.getBounds();

    if (!bounds.isValid()) return;

    map.fitBounds(bounds, {
      padding: [15, 15],
      maxZoom: 17,
    });

    // Keep the map around the barangay
    map.setMaxBounds(bounds.pad(0.05));
    map.setMinZoom(map.getBoundsZoom(bounds));

    map.setMaxZoom(19);
  }, [boundary, map]);

  return null;
}

// Only accept map clicks inside the barangay polygon
function BarangayClickHandler({ boundary, onLocationSelect }) {
  useMapEvents({
    click(event) {
      if (!boundary || !onLocationSelect) return;

      const point = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [
            event.latlng.lng,
            event.latlng.lat,
          ],
        },
      };

      const features =
        boundary.type === "FeatureCollection"
          ? boundary.features
          : [boundary];

      const inside = features.some((feature) => {
        if (!feature.geometry) return false;

        return booleanPointInPolygon(point, feature);
      });

      if (inside) {
        onLocationSelect({
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        });
      } else {
        alert("Please select a location inside Barangay 167.");
      }
    },
  });

  return null;
}

export default function MapViewer({
  incidents = [],
  onLocationSelect,
  selectedLocation = null,
}) {
  const [boundary, setBoundary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBoundary() {
      try {
        const response = await fetch(BOUNDARY_URL);

        if (!response.ok) {
          throw new Error(
            "Cannot load barangay-167.geojson."
          );
        }

        const data = await response.json();

        const features =
          data.type === "FeatureCollection"
            ? data.features
            : [data];

        const validBoundary = features.some(
          (feature) =>
            feature.geometry &&
            ["Polygon", "MultiPolygon"].includes(
              feature.geometry.type
            )
        );

        if (!validBoundary) {
          throw new Error(
            "GeoJSON must contain a Polygon or MultiPolygon."
          );
        }

        if (!cancelled) {
          setBoundary(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBoundary();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl bg-gray-100">
        Loading Barangay 167 map...
      </div>
    );
  }

  if (error || !boundary) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">
          Unable to load Barangay 167 boundary
        </p>
        <p className="mt-1 text-sm">
          {error || "Boundary data is unavailable."}
        </p>
        <p className="mt-2 text-sm">
          Check public/barangay-167.geojson and run
          the application using npm run dev.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-300">
      <div className="flex items-center justify-between bg-white px-4 py-3">
        <div>
          <h2 className="font-semibold text-gray-800">
            Barangay 167
          </h2>
          <p className="text-xs text-gray-500">
            Caloocan City · Incident and maintenance map
          </p>
        </div>

        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
          Barangay scope
        </span>
      </div>

      <MapContainer
        center={[14.75, 121.02]}
        zoom={15}
        minZoom={13}
        maxZoom={19}
        scrollWheelZoom={true}
        maxBoundsViscosity={1}
        className="h-125 w-full"
        style={{ background: "#f3f4f6" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <GeoJSON
          key={"mask-" + JSON.stringify(boundary)}
          data={{
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
                ...(boundary.type === "FeatureCollection"
                  ? boundary.features.map((f) => f.geometry.coordinates[0])
                  : [boundary.features?.[0]?.geometry?.coordinates[0] ?? boundary.geometry?.coordinates[0]]),
              ],
            },
          }}
          style={{
            color: "transparent",
            weight: 0,
            fillColor: "#1f2937",
            fillOpacity: 0.7,
          }}
        />

        <GeoJSON
          key={JSON.stringify(boundary)}
          data={boundary}
          style={{
            color: "#15803d",
            weight: 3,
            opacity: 1,
            fillColor: "#22c55e",
            fillOpacity: 0.15,
          }}
        />

        <FitBarangay boundary={boundary} />

        <BarangayClickHandler
          boundary={boundary}
          onLocationSelect={onLocationSelect}
        />

        {incidents.map((incident) => {
          if (
            typeof incident.lat !== "number" ||
            typeof incident.lng !== "number"
          ) {
            return null;
          }

          const point = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: [incident.lng, incident.lat],
            },
          };

          const features =
            boundary.type === "FeatureCollection"
              ? boundary.features
              : [boundary];

          const inside = features.some(
            (feature) =>
              feature.geometry &&
              booleanPointInPolygon(point, feature)
          );

          if (!inside) return null;

          return (
            <Marker
              key={incident.id}
              position={[incident.lat, incident.lng]}
            >
              <Popup>
                <strong>
                  {incident.title || "Reported incident"}
                </strong>
                <br />
                Status: {incident.status || "Pending"}
              </Popup>
            </Marker>
          );
        })}


      </MapContainer>

      <div className="bg-white px-4 py-2 text-xs text-gray-500">
        Click inside the green boundary to select an
        incident location. Locations outside the
        boundary are rejected.
      </div>
    </div>
  );
}
