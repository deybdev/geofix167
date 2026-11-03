import { useEffect, useState } from "react";

/* Reverse geocoding via OpenStreetMap Nominatim (free, no API key).
   Usage policy: max ~1 request/second, so lookups are debounced and cached.
   For heavy production traffic, swap this for your own geocoder. */

const cache = new Map();

const keyOf = (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export async function reverseGeocode(lat, lng, signal) {
  const key = keyOf(lat, lng);
  if (cache.has(key)) return cache.get(key);

  const url =
    "https://nominatim.openstreetmap.org/reverse" +
    `?format=jsonv2&addressdetails=1&zoom=18&accept-language=en` +
    `&lat=${lat}&lon=${lng}`;

  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

  const data = await res.json();
  const a = data.address || {};

  const street = [
    a.house_number,
    a.road || a.pedestrian || a.footway || a.path,
  ]
    .filter(Boolean)
    .join(" ");
  const area = a.neighbourhood || a.suburb || a.quarter || a.village;
  const city =
    a.city || a.town || a.municipality || a.city_district || a.county;

  const parts = [street, area, city].filter(Boolean);
  const text = parts.length ? parts.join(", ") : data.display_name || "";

  cache.set(key, text);
  return text;
}

/* Returns the street-level address for a { lat, lng } position.
   Pass null while there is no position yet. */
export function useAddress(position) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lat = position?.lat;
  const lng = position?.lng;

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setAddress("");
      setError("");
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        const text = await reverseGeocode(lat, lng, controller.signal);
        setAddress(text);
      } catch (err) {
        if (err.name !== "AbortError") {
          setAddress("");
          setError("Couldn't look up the street name.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lng]);

  return { address, loading, error };
}