import { useState, useCallback, useEffect, useRef } from "react";
import { geocode } from "../services/geocoding";
import { fetchSites } from "../services/sites";
import { fetchSpotairSites, fetchBalises, fetchWebcams } from "../services/spotair";
import { fetchForecast, filterFlyableHours, generatePlaceholderForecast } from "../services/weather";
import { enrichWithWindgram } from "../services/meteoparapente";
import { evaluate } from "../services/gonogo";
import { siteKey, deduplicateSites } from "../utils/geo";
import { currentHourVerdict } from "../utils/time";
import type { Site, GeoLocation, HourlyEvaluation, Verdict, Balise, Webcam } from "../types";

interface SearchState {
  location: GeoLocation | null;
  sites: Site[];
  siteEvals: Map<string, HourlyEvaluation[]>;
  siteVerdicts: Map<string, Verdict>;
  isLoading: boolean;
  error: string | null;
}

interface SearchResult extends SearchState {
  balisesData: Balise[];
  webcams: Webcam[];
  searchParams: { lat: number; lng: number; radius: number } | null;
  lastForecastUpdate: Date | null;
  utcOffsetSeconds: number;
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    location: null,
    sites: [],
    siteEvals: new Map(),
    siteVerdicts: new Map(),
    isLoading: false,
    error: null,
  });

  const [lastSearchParams, setLastSearchParams] = useState<{
    lat: number;
    lng: number;
    radius: number;
  } | null>(null);
  const [lastBalisesData, setLastBalisesData] = useState<Balise[]>([]);
  const [lastWebcams, setLastWebcams] = useState<Webcam[]>([]);
  const [lastForecastUpdate, setLastForecastUpdate] = useState<Date | null>(null);
  const [utcOffset, setUtcOffset] = useState(7200);
  const sitesRef = useRef<Site[]>([]);
  const forecastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const search = useCallback(async (query: string, radius: number) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      sites: [],
      siteEvals: new Map(),
      siteVerdicts: new Map(),
    }));

    try {
      const loc = await geocode(query);
      if (!loc) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: `Lieu introuvable : "${query}"`,
          location: null,
        }));
        return;
      }

      setState((prev) => ({ ...prev, location: loc }));
      const params = { lat: loc.latitude, lng: loc.longitude, radius };
      setLastSearchParams(params);

      const [spotairSites, pgeSites, balisesData, webcamsData] = await Promise.all([
        fetchSpotairSites(loc.latitude, loc.longitude, radius).catch(() => []),
        fetchSites(loc.latitude, loc.longitude, radius).catch(() => []),
        fetchBalises(loc.latitude, loc.longitude, radius + 10).catch(() => []),
        fetchWebcams(loc.latitude, loc.longitude, radius + 10).catch(() => []),
      ]);

      setLastBalisesData(balisesData);
      setLastWebcams(webcamsData);

      const allSites = deduplicateSites(spotairSites, pgeSites);
      if (!allSites.length) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: `Aucun site de parapente dans un rayon de ${radius} km`,
          sites: [],
        }));
        return;
      }

      const newEvals = new Map<string, HourlyEvaluation[]>();
      const newVerdicts = new Map<string, Verdict>();

      await Promise.all(
        allSites.map(async (site) => {
          const key = siteKey(site);
          let flyable: import("../types").HourlyWeather[];
          let offsetSeconds = 7200;

          try {
            const { hourly: forecast, utcOffsetSeconds } = await fetchForecast(site.latitude, site.longitude);
            offsetSeconds = utcOffsetSeconds;
            setUtcOffset(utcOffsetSeconds);
            flyable = filterFlyableHours(forecast);
          } catch {
            flyable = generatePlaceholderForecast();
          }

          if (site.altitude && site.altitude > 200) {
            try {
              await enrichWithWindgram(flyable, site, offsetSeconds);
            } catch { /* windgram is best-effort */ }
          }

          const hourlyEvals: HourlyEvaluation[] = flyable.map((w) => ({
            weather: w,
            evaluation: w.forecastAvailable !== false
              ? evaluate(site, w)
              : { verdict: "NO-GO" as const, checks: [], cloud_base: 0, wind_compass: "--" },
          }));
          newEvals.set(key, hourlyEvals);
          newVerdicts.set(key, currentHourVerdict(hourlyEvals));
        })
      );

      sitesRef.current = allSites;
      setLastForecastUpdate(new Date());

      setState({
        location: loc,
        sites: allSites,
        siteEvals: newEvals,
        siteVerdicts: newVerdicts,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      }));
    }
  }, []);

  const refreshForecasts = useCallback(async () => {
    const sites = sitesRef.current;
    if (!sites.length) return;

    const newEvals = new Map<string, HourlyEvaluation[]>();
    const newVerdicts = new Map<string, Verdict>();

    await Promise.all(
      sites.map(async (site) => {
        const key = siteKey(site);
        let flyable: import("../types").HourlyWeather[];
        let offsetSeconds = 7200;

        try {
          const { hourly: forecast, utcOffsetSeconds } = await fetchForecast(site.latitude, site.longitude);
          offsetSeconds = utcOffsetSeconds;
          flyable = filterFlyableHours(forecast);
        } catch {
          flyable = generatePlaceholderForecast();
        }

        if (site.altitude && site.altitude > 200) {
          try {
            await enrichWithWindgram(flyable, site, offsetSeconds);
          } catch { /* windgram is best-effort */ }
        }

        const hourlyEvals: HourlyEvaluation[] = flyable.map((w) => ({
          weather: w,
          evaluation: w.forecastAvailable !== false
            ? evaluate(site, w)
            : { verdict: "NO-GO" as const, checks: [], cloud_base: 0, wind_compass: "--" },
        }));
        newEvals.set(key, hourlyEvals);
        newVerdicts.set(key, currentHourVerdict(hourlyEvals));
      })
    );

    setLastForecastUpdate(new Date());
    setState((prev) => ({
      ...prev,
      siteEvals: newEvals,
      siteVerdicts: newVerdicts,
    }));
  }, []);

  useEffect(() => {
    if (forecastIntervalRef.current) {
      clearInterval(forecastIntervalRef.current);
      forecastIntervalRef.current = null;
    }
    if (sitesRef.current.length > 0) {
      forecastIntervalRef.current = setInterval(refreshForecasts, 3_600_000);
    }
    return () => {
      if (forecastIntervalRef.current) clearInterval(forecastIntervalRef.current);
    };
  }, [state.sites, refreshForecasts]);

  const result: SearchResult = {
    ...state,
    balisesData: lastBalisesData,
    webcams: lastWebcams,
    searchParams: lastSearchParams,
    lastForecastUpdate,
    utcOffsetSeconds: utcOffset,
  };

  return { ...result, search };
}
