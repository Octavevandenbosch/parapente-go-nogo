export interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  elevation?: number;
}

export interface SiteOrientations {
  N: number;
  NE: number;
  E: number;
  SE: number;
  S: number;
  SW: number;
  W: number;
  NW: number;
}

export interface Landing {
  name: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  description: string;
}

export type SiteSource = "FFVL / SpotAir" | "ParaglidingEarth";

export interface Site {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  description: string;
  orientations: Partial<SiteOrientations>;
  flight_rules: string;
  comments: string;
  pge_link: string;
  landing: Landing | null;
  source: SiteSource;
  ffvl_id?: number;
}

export interface HourlyWeather {
  time: string;
  temperature: number;
  humidity: number;
  dew_point: number;
  precipitation: number;
  rain: number;
  weather_code: number;
  cloud_cover: number;
  visibility: number;
  wind_speed: number;
  wind_direction: number;
  wind_gusts: number;
  pressure: number;
}

export type CheckLevel = "ok" | "warn" | "fail";
export type Verdict = "GO" | "MARGINAL" | "NO-GO";

export interface Check {
  level: CheckLevel;
  message: string;
}

export interface Evaluation {
  verdict: Verdict;
  checks: Check[];
  cloud_base: number;
  wind_compass: string;
}

export interface HourlyEvaluation {
  weather: HourlyWeather;
  evaluation: Evaluation;
}

export interface SiteAnalysis {
  site: Site;
  hourlyEvaluations: HourlyEvaluation[];
}

export type CompassDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
