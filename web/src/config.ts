export const API = {
  SPOTAIR_SPOTS: "/api/spotair/spots/spots-get.php",
  SPOTAIR_BALISES: "/api/spotair/balises/releves-get.php",
  SPOTAIR_KEY_SPOTS: import.meta.env.VITE_SPOTAIR_KEY_SPOTS ?? "",
  SPOTAIR_KEY_BALISES: import.meta.env.VITE_SPOTAIR_KEY_BALISES ?? "",
  SPOTAIR_WEBCAMS: "/api/spotair/webcams/webcams-get.php",
  SPOTAIR_KEY_WEBCAMS: import.meta.env.VITE_SPOTAIR_KEY_WEBCAMS ?? "",

  PGE_SITES: "/api/pge/getBoundingBoxSites.php",
  FORECAST: "/api/meteo/v1/meteofrance",
  GEOCODING: "/api/geocode/v1/search",

  FFVL_TERRAIN_URL: (id: number) => `https://federation.ffvl.fr/terrain/${id}`,
  SPOTAIR_BALISE_URL: (provider: string, id: string) =>
    `https://www.spotair.mobi/wind/${provider}/${id}`,
  PGE_BASE_URL: "https://paraglidingearth.com",
  SPOTAIR_BASE_URL: "https://www.spotair.mobi",

  MP_STATUS: "/api/mp/status.php",
  MP_DATA: "/api/mp/data.php",
  MP_BASE_URL: "https://meteo-parapente.com",
} as const;

export const THRESHOLDS = {
  WIND_SPEED_MAX: 30,
  WIND_SPEED_IDEAL_MAX: 25,
  WIND_SPEED_IDEAL_MIN: 5,
  GUST_SPREAD_MAX: 15,
  VISIBILITY_MIN: 1500,
  CLOUD_COVER_MAX: 85,
  CLOUD_BASE_MIN: 300,
  MAX_BALISE_DISTANCE_KM: 15,
  BALISE_STALE_MINUTES: 30,
} as const;

export const TIMING = {
  BALISE_REFRESH_MS: 60_000,
  FLYABLE_START_HOUR: 8,
  FLYABLE_END_HOUR: 19,
  FORECAST_DAYS: 2,
} as const;

export const THUNDERSTORM_CODES = new Set([95, 96, 99]);
export const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82]);
