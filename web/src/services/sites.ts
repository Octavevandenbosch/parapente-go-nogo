import type { Site, Landing } from "../types";

const PGE_API_URL = "/api/pge/getBoundingBoxSites.php";

const ORIENTATION_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function bboxFromCenter(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    west: lng - lngDelta,
  };
}

function parseFloat_(val: string | null | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function textContent(el: Element | null, tag: string): string {
  return el?.querySelector(tag)?.textContent?.trim() ?? "";
}

function numContent(el: Element | null, tag: string): number | null {
  return parseFloat_(el?.querySelector(tag)?.textContent?.trim());
}

function parseLanding(doc: Document): Landing | null {
  const el = doc.querySelector("landing");
  if (!el) return null;
  return {
    name: textContent(el, "landing_name"),
    latitude: numContent(el, "landing_lat"),
    longitude: numContent(el, "landing_lng"),
    altitude: numContent(el, "landing_altitude"),
    description: textContent(el, "landing_description"),
  };
}

export async function fetchSites(
  lat: number,
  lng: number,
  radiusKm = 25,
  limit = 15
): Promise<Site[]> {
  const bbox = bboxFromCenter(lat, lng, radiusKm);
  const params = new URLSearchParams({
    north: bbox.north.toString(),
    south: bbox.south.toString(),
    east: bbox.east.toString(),
    west: bbox.west.toString(),
    limit: limit.toString(),
    style: "detailled",
  });

  const resp = await fetch(`${PGE_API_URL}?${params}`);
  if (!resp.ok) throw new Error(`ParaglidingEarth API failed: ${resp.status}`);

  const text = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/xml");

  const landing = parseLanding(doc);
  const sites: Site[] = [];

  for (const takeoff of doc.querySelectorAll("takeoff")) {
    const isPg = takeoff.querySelector("paragliding")?.textContent?.trim();
    if (isPg !== "1") continue;

    const orientations: Partial<Record<string, number>> = {};
    const orientEl = takeoff.querySelector("orientations");
    if (orientEl) {
      for (const label of ORIENTATION_LABELS) {
        const val = orientEl.querySelector(label)?.textContent?.trim();
        if (val) orientations[label] = parseInt(val, 10);
      }
    }

    sites.push({
      name: textContent(takeoff, "name"),
      country: textContent(takeoff, "countryCode"),
      latitude: numContent(takeoff, "lat") ?? lat,
      longitude: numContent(takeoff, "lng") ?? lng,
      altitude: numContent(takeoff, "takeoff_altitude"),
      description: textContent(takeoff, "takeoff_description"),
      orientations: orientations as Site["orientations"],
      flight_rules: textContent(takeoff, "flight_rules"),
      comments: textContent(takeoff, "comments"),
      pge_link: textContent(takeoff, "pge_link"),
      landing,
      source: "ParaglidingEarth",
    });
  }

  return sites;
}
