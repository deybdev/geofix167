import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAddress } from "../hooks/useAddress";

const STORAGE_KEY = "geofix167:shared-location";

const readStored = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lng) ? parsed : null;
  } catch {
    return null;
  }
};

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const stored = readStored();
  const [position, setPosition] = useState(stored ? { lat: stored.lat, lng: stored.lng } : null);
  const [shared, setShared] = useState(!!stored);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const geo = useAddress(position);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY && !event.newValue) {
        setShared(false);
        setPosition(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const detect = useCallback((errorMessage) => {
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ lat: coords.latitude, lng: coords.longitude });
        setShared(true);
        setLocating(false);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ lat: coords.latitude, lng: coords.longitude, at: new Date().toISOString() }),
          );
        } catch {
          // storage unavailable — consent stays in memory for this session
        }
      },
      () => {
        setLocating(false);
        setLocationError(errorMessage ?? "Allow location access, or type the address.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  return (
    <LocationContext.Provider
      value={{ position, setPosition, locating, locationError, detect, geo, shared }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useGeoLocation() {
  return useContext(LocationContext);
}
