import { API, TIMING } from "../config";
import type { HourlyWeather } from "../types";

const HOURLY_PARAMS = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation",
  "rain",
  "weather_code",
  "cloud_cover",
  "visibility",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "pressure_msl",
];

export interface ForecastResult {
  hourly: HourlyWeather[];
  utcOffsetSeconds: number;
}

export async function fetchForecast(
  lat: number,
  lng: number,
  days = TIMING.FORECAST_DAYS,
): Promise<ForecastResult> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    hourly: HOURLY_PARAMS.join(","),
    forecast_days: Math.min(days, 4).toString(),
    timezone: "auto",
    wind_speed_unit: "kmh",
  });

  const resp = await fetch(`${API.FORECAST}?${params}`);
  if (!resp.ok) throw new Error(`Open-Meteo failed: ${resp.status}`);

  const data = await resp.json();
  const hourly = data.hourly;
  const times: string[] = hourly.time;
  const utcOffsetSeconds: number = data.utc_offset_seconds ?? 0;

  const hours: HourlyWeather[] = times.map((t, i) => ({
    time: t,
    temperature: hourly.temperature_2m[i],
    humidity: hourly.relative_humidity_2m[i],
    dew_point: hourly.dew_point_2m[i],
    precipitation: hourly.precipitation[i],
    rain: hourly.rain[i],
    weather_code: hourly.weather_code[i],
    cloud_cover: hourly.cloud_cover[i],
    visibility: hourly.visibility[i],
    wind_speed: hourly.wind_speed_10m[i],
    wind_direction: hourly.wind_direction_10m[i],
    wind_gusts: hourly.wind_gusts_10m[i],
    pressure: hourly.pressure_msl[i],
    forecastAvailable: true,
  }));

  return { hourly: hours, utcOffsetSeconds };
}

export function generatePlaceholderForecast(
  days = TIMING.FORECAST_DAYS,
  startHour = TIMING.FLYABLE_START_HOUR,
  endHour = TIMING.FLYABLE_END_HOUR,
): HourlyWeather[] {
  const hours: HourlyWeather[] = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    for (let h = startHour; h <= endHour; h++) {
      hours.push({
        time: `${dateStr}T${String(h).padStart(2, "0")}:00`,
        temperature: 0,
        humidity: 0,
        dew_point: 0,
        precipitation: 0,
        rain: 0,
        weather_code: 0,
        cloud_cover: 0,
        visibility: 0,
        wind_speed: 0,
        wind_direction: 0,
        wind_gusts: 0,
        pressure: 0,
        forecastAvailable: false,
      });
    }
  }

  return hours;
}

export function filterFlyableHours(
  forecasts: HourlyWeather[],
  startHour = TIMING.FLYABLE_START_HOUR,
  endHour = TIMING.FLYABLE_END_HOUR
): HourlyWeather[] {
  return forecasts.filter((f) => {
    const hour = parseInt(f.time.split("T")[1].split(":")[0], 10);
    return hour >= startHour && hour <= endHour;
  });
}
