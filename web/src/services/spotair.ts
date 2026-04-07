import { API } from "../config";
import { bboxFromCenter, bboxToSpotairParams, distanceKm } from "../utils/geo";
import { decodeOrientations } from "../utils/wind";
import type { Site, Landing, Balise, Webcam } from "../types";

interface SpotairSpot {
  id: number;
  pratique: number;
  type: number;
  orientations: number;
  orientations_defavo: number | null;
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

function getInfoValue(
  infos: Array<{ code: string; langue: string; valeur: string }>,
  code: string
): string {
  const entry = infos?.find((i) => i.code === code && i.langue !== "default");
  return entry?.valeur ?? "";
}

export async function fetchSpotairSites(
  lat: number,
  lng: number,
  radiusKm = 25
): Promise<Site[]> {
  const box = bboxToSpotairParams(bboxFromCenter(lat, lng, radiusKm));
  const body = new URLSearchParams({ ...box, pratique: "1" });

  const resp = await fetch(API.SPOTAIR_SPOTS, {
    method: "POST",
    headers: { "X-Spotair-Apikey": API.SPOTAIR_KEY_SPOTS },
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
      spot.noms?.fr ?? spot.noms?.[spot.noms.primary] ?? spot.noms?.en ?? spot.nom ?? "Sans nom";

    if (spot.type === 2) {
      const desc =
        spot.descriptions?.fr ?? spot.descriptions?.[spot.descriptions?.primary] ?? "";
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
      spot.orientations_defavo
    );

    const desc =
      spot.descriptions?.fr ?? spot.descriptions?.[spot.descriptions?.primary] ?? "";

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
  const box = bboxToSpotairParams(bboxFromCenter(lat, lng, radiusKm));
  const body = new URLSearchParams(box);

  const resp = await fetch(API.SPOTAIR_BALISES, {
    method: "POST",
    headers: { "X-Spotair-Apikey": API.SPOTAIR_KEY_BALISES },
    body,
  });
  if (!resp.ok) throw new Error(`SpotAir balises failed: ${resp.status}`);

  const json = await resp.json();
  if (json.code !== 0) throw new Error(json.msg);

  return (json.data ?? []).filter(
    (b: Balise) => b.active === 1 && b.releves?.length > 0
  );
}

let webcamCache: Webcam[] | null = null;

export async function fetchWebcams(
  lat: number,
  lng: number,
  radiusKm = 30,
): Promise<Webcam[]> {
  if (!webcamCache) {
    const body = new URLSearchParams({ sortie: "json" });
    const resp = await fetch(API.SPOTAIR_WEBCAMS, {
      method: "POST",
      headers: { "X-Spotair-Apikey": API.SPOTAIR_KEY_WEBCAMS },
      body,
    });
    if (!resp.ok) throw new Error(`SpotAir webcams failed: ${resp.status}`);
    const json = await resp.json();
    if (json.code !== 0) throw new Error(json.msg);
    webcamCache = (json.data ?? []) as Webcam[];
  }

  return webcamCache.filter((w) =>
    (w.pratiques & 1) === 1 &&
    w.statut_enligne === "E" &&
    w.url_image &&
    distanceKm(lat, lng, w.latitude, w.longitude) <= radiusKm
  );
}
