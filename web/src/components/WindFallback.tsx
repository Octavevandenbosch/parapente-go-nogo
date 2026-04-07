import { useState, useEffect } from "react";
import { fetchWindgram } from "../services/meteoparapente";
import type { WindAtAlt } from "../services/meteoparapente";
import { windDirToCompass } from "../utils/wind";
import { THRESHOLDS } from "../config";
import type { Site, CompassDirection } from "../types";

interface Props {
  site: Site;
  utcOffsetSeconds: number;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function orientationCheck(
  dir: CompassDirection,
  orientations: Partial<Record<string, number>>,
): "ok" | "warn" | "fail" {
  const val = orientations[dir] ?? 0;
  if (val === 2) return "ok";
  if (val === 1) return "warn";
  return "fail";
}

function speedCheck(speed: number): "ok" | "warn" | "fail" {
  if (speed > THRESHOLDS.WIND_SPEED_MAX) return "fail";
  if (speed > THRESHOLDS.WIND_SPEED_IDEAL_MAX) return "warn";
  if (speed < THRESHOLDS.WIND_SPEED_IDEAL_MIN) return "warn";
  return "ok";
}

interface HourEntry {
  localHour: number;
  dateLabel: string;
  wind: WindAtAlt;
  compass: CompassDirection;
  orientCheck: "ok" | "warn" | "fail";
  speedChk: "ok" | "warn" | "fail";
}

export function WindFallback({ site, utcOffsetSeconds }: Props) {
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!site.altitude || site.altitude <= 200) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const offsetH = utcOffsetSeconds / 3600;
    const today = todayStr();
    const tomorrow = tomorrowStr();

    Promise.all([
      fetchWindgram(site.latitude, site.longitude, today, site.altitude).catch(() => new Map()),
      fetchWindgram(site.latitude, site.longitude, tomorrow, site.altitude).catch(() => new Map()),
    ]).then(([todayData, tomorrowData]) => {
      if (cancelled) return;

      const result: HourEntry[] = [];

      for (const [dateStr, data, label] of [
        [today, todayData, "Aujourd'hui"],
        [tomorrow, tomorrowData, "Demain"],
      ] as [string, Map<string, WindAtAlt>, string][]) {
        for (const [utcHour, wind] of data.entries()) {
          const utcH = parseInt(utcHour);
          const localH = utcH + offsetH;
          if (localH < 8 || localH > 19) continue;

          const compass = windDirToCompass(wind.direction);
          result.push({
            localHour: localH,
            dateLabel: label,
            wind,
            compass,
            orientCheck: orientationCheck(compass, site.orientations),
            speedChk: speedCheck(wind.speed),
          });
        }
      }

      result.sort((a, b) => {
        if (a.dateLabel !== b.dateLabel) return a.dateLabel === "Aujourd'hui" ? -1 : 1;
        return a.localHour - b.localHour;
      });

      setEntries(result);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [site, utcOffsetSeconds]);

  if (loading) return <div className="wf-status">Chargement vent altitude…</div>;
  if (!entries.length) return null;

  const grouped = new Map<string, HourEntry[]>();
  for (const e of entries) {
    if (!grouped.has(e.dateLabel)) grouped.set(e.dateLabel, []);
    grouped.get(e.dateLabel)!.push(e);
  }

  return (
    <div className="wf-container">
      <div className="wf-header">
        <span className="wf-title">Vent au déco ~{site.altitude}m</span>
        <span className="wf-source">Météo-Parapente (WRF)</span>
      </div>
      {[...grouped.entries()].map(([day, hours]) => (
        <div key={day} className="wf-day">
          <div className="wf-day-label">{day}</div>
          {hours.map((e) => {
            const worst =
              e.orientCheck === "fail" || e.speedChk === "fail"
                ? "fail"
                : e.orientCheck === "warn" || e.speedChk === "warn"
                  ? "warn"
                  : "ok";

            return (
              <div key={`${day}-${e.localHour}`} className={`wf-row wf-${worst}`}>
                <span className="wf-hour">{e.localHour}h</span>
                <span className="wf-speed">{e.wind.speed.toFixed(0)} km/h</span>
                <span className="wf-dir">{e.compass} ({e.wind.direction}°)</span>
                <span className="wf-alt">{e.wind.altitude}m</span>
                <span className={`wf-check wf-check-${e.orientCheck}`}>
                  {e.orientCheck === "ok" ? "✓" : e.orientCheck === "warn" ? "⚠" : "✗"} orient.
                </span>
                <span className={`wf-check wf-check-${e.speedChk}`}>
                  {e.speedChk === "ok" ? "✓" : e.speedChk === "warn" ? "⚠" : "✗"} vitesse
                </span>
              </div>
            );
          })}
        </div>
      ))}
      <div className="wf-notice">
        Données vent uniquement (Météo-Parapente WRF) — pas de pluie, nuages ou visibilité.
      </div>
    </div>
  );
}
