import { useState, useCallback } from "react";
import { geocode } from "../services/geocoding";
import { fetchSites } from "../services/sites";
import { fetchSpotairSites, fetchBalises, fetchWebcams } from "../services/spotair";
import { fetchForecast, filterFlyableHours } from "../services/weather";
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
          try {
            const forecast = await fetchForecast(site.latitude, site.longitude);
            const flyable = filterFlyableHours(forecast);
            const hourlyEvals: HourlyEvaluation[] = flyable.map((w) => ({
              weather: w,
              evaluation: evaluate(site, w),
            }));
            newEvals.set(key, hourlyEvals);
            newVerdicts.set(key, currentHourVerdict(hourlyEvals));
          } catch {
            newEvals.set(key, []);
            newVerdicts.set(key, "NO-GO");
          }
        })
      );

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

  const result: SearchResult = {
    ...state,
    balisesData: lastBalisesData,
    webcams: lastWebcams,
    searchParams: lastSearchParams,
  };

  return { ...result, search };
}
