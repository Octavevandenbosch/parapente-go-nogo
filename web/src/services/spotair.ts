import type { Site, Landing, CompassDirection } from "../types";

const SPOTS_URL = "/api/spotair/spots/spots-get.php";
const BALISES_URL = "/api/spotair/balises/releves-get.php";

const SPOTS_KEY = "nyBtvIV/HEFiDMzZDwgbUA==";
const BALISES_KEY = "dMK0l++8QOSZtBKr4zpq6w==";

const ORIENTATION_BITS: { bit: number; dir: CompassDirection }[] = [
  { bit: 1, dir: "N" },
  { bit: 2, dir: "NE" },
  { bit: 4, dir: "E" },
  { bit: 8, dir: "SE" },
  { bit: 16, dir: "S" },
  { bit: 32, dir: "SW" },
  { bit: 64, dir: "W" },
  { bit: 128, dir: "NW" },
];

function decodeOrientations(
  favo: number,
  defavo: number | null
): Partial<Record<string, number>> {
  const hasDefavo = defavo != null && defavo > 0;
  const result: Partial<Record<string, number>> = {};
  for (const { bit, dir } of ORIENTATION_BITS) {
    if (favo & bit) result[dir] = 2;
    else if (hasDefavo && !(defavo! & bit)) result[dir] = 1;
    else result[dir] = 0;
  }
  return result;
}

function getInfoValue(
  infos: Array<{ code: string; langue: string; valeur: string }>,
  code: string
): string {
  const entry = infos?.find((i) => i.code === code && i.langue !== "default");
  return entry?.valeur ?? "";
}

interface SpotairSpot {
  id: number;
  pratique: number;
  type: number; // 1=takeoff, 2=landing, 3=training, 4=winch
  orientations: number;
  orientations_defavo: number;
  niveau: number;
  nom: string | null;
  latitude: number;
  longitude: number;
  altitude: number;
  noms?: { primary: string; [key: string]: string };
  descriptions?: { primary: string; [key: string]: string };
  infos?: Array<{ code: string; langue: string; valeur: string }>;
  children?: SpotairSpot[];
  etat: string;
  ville?: string;
  code_postal?: string;
  handi?: number;
  url?: string;
  provider?: string;
  provider_id?: string;
}

export interface Balise {
  provider_key: string;
  balise_id: string;
  nom: string;
  latitude: number;
  longitude: number;
  altitude: number;
  description: string | null;
  active: number;
  releves: Array<{
    date_releve: number;
    direction: number;
    direction_instantanee: number;
    vmin: number;
    vmoy: number;
    vmax: number;
    tvmin: number;
    tvmoy: number;
    tvmax: number;
    temperature: number | null;
    point_rosee: number | null;
    pluie: number | null;
    humidite: number | null;
  }>;
}

function bbox(lat: number, lng: number, radiusKm: number) {
  const latD = radiusKm / 111;
  const lngD = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    nord: (lat + latD).toString(),
    sud: (lat - latD).toString(),
    est: (lng + lngD).toString(),
    ouest: (lng - lngD).toString(),
  };
}

export async function fetchSpotairSites(
  lat: number,
  lng: number,
  radiusKm = 25
): Promise<Site[]> {
  const box = bbox(lat, lng, radiusKm);
  const body = new URLSearchParams({ ...box, pratique: "1" });

  const resp = await fetch(SPOTS_URL, {
    method: "POST",
    headers: { "X-Spotair-Apikey": SPOTS_KEY },
    body,
  });
  if (!resp.ok) throw new Error(`SpotAir spots failed: ${resp.status}`);

  const json = await resp.json();
  if (json.code !== 0) throw new Error(json.msg);

  const spots: SpotairSpot[] = json.data ?? [];
  const takeoffs: Site[] = [];
  const landingsByArea = new Map<string, Landing>();

  for (const spot of spots) {
    const name =
      spot.noms?.fr ?? spot.noms?.[spot.noms.primary] ?? spot.nom ?? "Sans nom";

    if (spot.type === 2) {
      const desc =
        spot.descriptions?.fr ??
        spot.descriptions?.[spot.descriptions?.primary] ??
        "";
      landingsByArea.set(`${spot.latitude.toFixed(2)}-${spot.longitude.toFixed(2)}`, {
        name,
        latitude: spot.latitude,
        longitude: spot.longitude,
        altitude: spot.altitude,
        description: desc,
      });
    }

    if (spot.type !== 1) continue;

    const orientations = decodeOrientations(
      spot.orientations ?? 0,
      spot.orientations_defavo ?? 0
    );

    const desc =
      spot.descriptions?.fr ??
      spot.descriptions?.[spot.descriptions?.primary] ??
      "";

    const infos = spot.infos ?? spot.children?.[0]?.infos ?? [];
    const access = getInfoValue(infos, "acces");
    const rules = getInfoValue(infos, "reglement");
    const dangers = getInfoValue(infos, "dangers");

    const ffvlChild = spot.children?.find((c) => c.provider === "ffvl");
    const ffvlTerrainId = ffvlChild
      ? parseInt(ffvlChild.provider_id as unknown as string, 10)
      : undefined;

    const areaKey = `${spot.latitude.toFixed(2)}-${spot.longitude.toFixed(2)}`;
    const nearbyLanding = landingsByArea.get(areaKey) ?? null;

    takeoffs.push({
      name,
      country: spot.ville ?? ffvlChild?.ville ?? "FR",
      latitude: spot.latitude,
      longitude: spot.longitude,
      altitude: spot.altitude,
      description: [desc, dangers].filter(Boolean).join(" | "),
      orientations,
      flight_rules: [rules, access].filter(Boolean).join(" · "),
      comments: "",
      pge_link: spot.url ?? "",
      landing: nearbyLanding,
      source: "FFVL / SpotAir",
      ffvl_id: ffvlTerrainId,
    });
  }

  // Second pass: match landings to takeoffs that don't have one yet
  if (landingsByArea.size > 0 && takeoffs.some((t) => !t.landing)) {
    const landings = [...landingsByArea.values()];
    for (const t of takeoffs) {
      if (t.landing) continue;
      let best: Landing | null = null;
      let bestDist = Infinity;
      for (const l of landings) {
        if (!l.latitude || !l.longitude) continue;
        const d = Math.hypot(t.latitude - l.latitude, t.longitude - l.longitude);
        if (d < bestDist) {
          bestDist = d;
          best = l;
        }
      }
      if (best && bestDist < 0.15) t.landing = best;
    }
  }

  return takeoffs;
}

export async function fetchBalises(
  lat: number,
  lng: number,
  radiusKm = 30
): Promise<Balise[]> {
  const box = bbox(lat, lng, radiusKm);
  const body = new URLSearchParams(box);

  const resp = await fetch(BALISES_URL, {
    method: "POST",
    headers: { "X-Spotair-Apikey": BALISES_KEY },
    body,
  });
  if (!resp.ok) throw new Error(`SpotAir balises failed: ${resp.status}`);

  const json = await resp.json();
  if (json.code !== 0) throw new Error(json.msg);

  return (json.data ?? []).filter(
    (b: Balise) => b.active === 1 && b.releves?.length > 0
  );
}
