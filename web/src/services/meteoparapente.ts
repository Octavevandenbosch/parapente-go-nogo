import { API } from "../config";
import { localHourToUtc } from "../utils/time";
import type { HourlyWeather, Site } from "../types";

export interface WindAtAlt {
  speed: number;
  direction: number;
  altitude: number;
}

interface StatusEntry {
  run: string;
  day: string;
  private: boolean;
  status: string;
}

let statusCache: { entries: StatusEntry[]; fetchedAt: number } | null = null;

async function fetchStatus(): Promise<StatusEntry[]> {
  if (statusCache && Date.now() - statusCache.fetchedAt < 600_000) {
    return statusCache.entries;
  }

  const resp = await fetch(`${API.MP_STATUS}?init=${Date.now()}`);
  if (!resp.ok) throw new Error(`MP status failed: ${resp.status}`);

  const data = await resp.json();
  const entries: StatusEntry[] = data.france ?? [];
  statusCache = { entries, fetchedAt: Date.now() };
  return entries;
}

function findBestRun(entries: StatusEntry[], targetDate: string): string | null {
  const forDate = entries
    .filter((e) => e.day === targetDate)
    .sort((a, b) => {
      if (a.status === "complete" && b.status !== "complete") return -1;
      if (b.status === "complete" && a.status !== "complete") return 1;
      return b.run.localeCompare(a.run);
    });

  if (forDate.length > 0) return forDate[0].run;

  const any = entries
    .filter((e) => e.status === "complete")
    .sort((a, b) => b.run.localeCompare(a.run));

  return any.length > 0 ? any[0].run : null;
}

/**
 * Fetch windgram from Meteo-Parapente WRF model and extract
 * wind speed / direction at the altitude closest to `siteAltitude`.
 *
 * Returns a Map keyed by UTC hour string "HH:00" → WindAtAlt.
 */
export async function fetchWindgram(
  lat: number,
  lon: number,
  dateYYYYMMDD: string,
  siteAltitude: number,
): Promise<Map<string, WindAtAlt>> {
  const result = new Map<string, WindAtAlt>();

  const entries = await fetchStatus();
  const run = findBestRun(entries, dateYYYYMMDD);
  if (!run) return result;

  const url =
    `${API.MP_DATA}?run=${run}` +
    `&location=${lat},${lon}` +
    `&date=${dateYYYYMMDD}` +
    `&plot=windgram`;

  const resp = await fetch(url);
  if (!resp.ok) return result;

  const json = await resp.json();
  const hourlyData = json.data;
  if (!hourlyData) return result;

  for (const [hourStr, hd] of Object.entries(hourlyData)) {
    const d = hd as Record<string, unknown>;
    const z = d.z as number[] | undefined;
    const umet = d.umet as number[] | undefined;
    const vmet = d.vmet as number[] | undefined;

    if (!z || !umet || !vmet) continue;

    let bestIdx = 0;
    let bestDist = Math.abs(z[0] - siteAltitude);
    for (let i = 1; i < z.length; i++) {
      const dist = Math.abs(z[i] - siteAltitude);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    const u = umet[bestIdx];
    const v = vmet[bestIdx];
    const speed = Math.sqrt(u * u + v * v) * 3.6;
    const direction = (Math.atan2(-u, -v) * (180 / Math.PI) + 360) % 360;

    result.set(hourStr, {
      speed: Math.round(speed * 10) / 10,
      direction: Math.round(direction),
      altitude: Math.round(z[bestIdx]),
    });
  }

  return result;
}

export async function enrichWithWindgram(
  forecasts: HourlyWeather[],
  site: Site,
  utcOffsetSeconds: number,
): Promise<void> {
  if (!site.altitude || site.altitude <= 200) return;

  const dates = new Set<string>();
  for (const f of forecasts) {
    const { utcDate } = localHourToUtc(f.time, utcOffsetSeconds);
    dates.add(utcDate);
  }

  const windgrams = new Map<string, Map<string, { speed: number; direction: number; altitude: number }>>();
  await Promise.all(
    [...dates].map(async (dateStr) => {
      try {
        const wg = await fetchWindgram(site.latitude, site.longitude, dateStr, site.altitude!);
        windgrams.set(dateStr, wg);
      } catch { /* graceful degradation */ }
    }),
  );

  for (const f of forecasts) {
    const { utcDate, utcHour } = localHourToUtc(f.time, utcOffsetSeconds);
    const wg = windgrams.get(utcDate);
    if (!wg) continue;
    const wind = wg.get(utcHour);
    if (!wind) continue;
    f.wind_speed_alt = wind.speed;
    f.wind_direction_alt = wind.direction;
    f.wind_alt_meters = wind.altitude;
  }
}
