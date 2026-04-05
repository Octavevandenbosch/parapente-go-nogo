import { THRESHOLDS, THUNDERSTORM_CODES, RAIN_CODES } from "../config";
import { windDirToCompass } from "../utils/wind";
import type { Site, HourlyWeather, Evaluation, Check, Verdict, CompassDirection } from "../types";

function bestOrientations(
  orientations: Partial<Record<string, number>>
): string[] {
  return Object.entries(orientations)
    .filter(([, v]) => v === 2)
    .map(([k]) => k);
}

function acceptableOrientations(
  orientations: Partial<Record<string, number>>
): string[] {
  return Object.entries(orientations)
    .filter(([, v]) => (v ?? 0) >= 1)
    .map(([k]) => k);
}

export function estimateCloudBase(temp: number, dewPoint: number): number {
  return (temp - dewPoint) * 125;
}

export function evaluate(site: Site, weather: HourlyWeather): Evaluation {
  const checks: Check[] = [];
  const orientations = site.orientations;

  const windCompass: CompassDirection = windDirToCompass(weather.wind_direction);
  const goodDirs = bestOrientations(orientations);
  const okDirs = acceptableOrientations(orientations);

  if (goodDirs.includes(windCompass)) {
    checks.push({
      level: "ok",
      message: `Vent ${windCompass} (${weather.wind_direction}°) — orientation idéale`,
    });
  } else if (okDirs.includes(windCompass)) {
    checks.push({
      level: "warn",
      message: `Vent ${windCompass} (${weather.wind_direction}°) — acceptable mais pas idéale`,
    });
  } else {
    checks.push({
      level: "fail",
      message: `Vent ${windCompass} (${weather.wind_direction}°) — incompatible avec le déco`,
    });
  }

  if (weather.wind_speed > THRESHOLDS.WIND_SPEED_MAX) {
    checks.push({ level: "fail", message: `Vent ${weather.wind_speed} km/h — trop fort` });
  } else if (weather.wind_speed > THRESHOLDS.WIND_SPEED_IDEAL_MAX) {
    checks.push({ level: "warn", message: `Vent ${weather.wind_speed} km/h — fort, prudence` });
  } else if (weather.wind_speed < THRESHOLDS.WIND_SPEED_IDEAL_MIN) {
    checks.push({ level: "warn", message: `Vent ${weather.wind_speed} km/h — très faible` });
  } else {
    checks.push({ level: "ok", message: `Vent ${weather.wind_speed} km/h — idéal` });
  }

  const gustSpread = weather.wind_gusts - weather.wind_speed;
  if (gustSpread > THRESHOLDS.GUST_SPREAD_MAX) {
    checks.push({ level: "fail", message: `Rafales ${weather.wind_gusts} km/h — trop turbulent` });
  } else if (gustSpread > 10) {
    checks.push({ level: "warn", message: `Rafales ${weather.wind_gusts} km/h — agité` });
  } else {
    checks.push({ level: "ok", message: `Rafales ${weather.wind_gusts} km/h — modérées` });
  }

  if (THUNDERSTORM_CODES.has(weather.weather_code)) {
    checks.push({ level: "fail", message: "Orages prévus" });
  } else {
    checks.push({ level: "ok", message: "Pas d'orage" });
  }

  const hasRain =
    RAIN_CODES.has(weather.weather_code) || THUNDERSTORM_CODES.has(weather.weather_code);
  if ((weather.rain ?? 0) > 0 || hasRain) {
    checks.push({ level: "fail", message: `Pluie ${weather.precipitation} mm` });
  } else {
    checks.push({ level: "ok", message: "Temps sec" });
  }

  if ((weather.visibility ?? 99999) < THRESHOLDS.VISIBILITY_MIN) {
    checks.push({
      level: "fail",
      message: `Visibilité ${((weather.visibility ?? 0) / 1000).toFixed(1)} km`,
    });
  } else {
    checks.push({
      level: "ok",
      message: `Visibilité ${((weather.visibility ?? 99999) / 1000).toFixed(0)} km`,
    });
  }

  if ((weather.cloud_cover ?? 0) > THRESHOLDS.CLOUD_COVER_MAX) {
    checks.push({ level: "warn", message: `Nuages ${weather.cloud_cover}%` });
  } else {
    checks.push({ level: "ok", message: `Nuages ${weather.cloud_cover}%` });
  }

  const cloudBase = estimateCloudBase(weather.temperature ?? 15, weather.dew_point ?? 5);
  if (cloudBase < THRESHOLDS.CLOUD_BASE_MIN) {
    checks.push({ level: "warn", message: `Base nuages ~${cloudBase.toFixed(0)}m AGL` });
  } else {
    checks.push({ level: "ok", message: `Base nuages ~${cloudBase.toFixed(0)}m AGL` });
  }

  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;

  let verdict: Verdict;
  if (fails > 0) verdict = "NO-GO";
  else if (warns >= 3) verdict = "MARGINAL";
  else verdict = "GO";

  return { verdict, checks, cloud_base: cloudBase, wind_compass: windCompass };
}
