import { API } from "../config";
import type { GeoLocation } from "../types";

export async function geocode(query: string): Promise<GeoLocation | null> {
  const params = new URLSearchParams({
    name: query,
    count: "1",
    language: "fr",
    format: "json",
  });

  const resp = await fetch(`${API.GEOCODING}?${params}`);
  if (!resp.ok) throw new Error(`Geocoding failed: ${resp.status}`);

  const data = await resp.json();
  const results = data.results;
  if (!results?.length) return null;

  const r = results[0];
  return {
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country ?? "",
    elevation: r.elevation,
  };
}
