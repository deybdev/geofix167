type CachedAddress = { address: string | null; expiresAt: number };

const addressCache = new Map<string, CachedAddress>();
let nominatimQueue: Promise<void> = Promise.resolve();
let lastNominatimRequestAt = 0;

function queueNominatim<T>(operation: () => Promise<T>): Promise<T> {
  const request = nominatimQueue.then(async () => {
    const waitMs = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastNominatimRequestAt = Date.now();
    return operation();
  });
  nominatimQueue = request.then(() => undefined, () => undefined);
  return request;
}

function formatAddress(data: { address?: Record<string, string>; display_name?: string }): string | null {
  const parts = data.address ?? {};
  const street = [parts.house_number, parts.road || parts.pedestrian || parts.footway || parts.path]
    .filter(Boolean)
    .join(" ");
  const area = parts.neighbourhood || parts.suburb || parts.quarter || parts.village;
  const city = parts.city || parts.town || parts.municipality || parts.city_district || parts.county;
  const address = [street, area, city].filter(Boolean).join(", ") || data.display_name || "";
  return address.trim() || null;
}

export async function reverseGeocodeCoordinates(latitude: number, longitude: number): Promise<string | null> {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = addressCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.address;

  const address = await queueNominatim(async () => {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");
    url.searchParams.set("accept-language", "en");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "GeoFix167/1.0 (Barangay 167 public incident reporting)",
      },
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
    return formatAddress(await response.json() as { address?: Record<string, string>; display_name?: string });
  });

  if (addressCache.size >= 1000) {
    const oldestKey = addressCache.keys().next().value;
    if (oldestKey) addressCache.delete(oldestKey);
  }
  addressCache.set(key, { address, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return address;
}
