import { useState, useCallback, useEffect, useRef } from "react";
import { SearchBar } from "./components/SearchBar";
import { SiteMap } from "./components/SiteMap";
import { SiteList } from "./components/SiteList";
import { SitePanel } from "./components/SitePanel";
import { geocode } from "./services/geocoding";
import { fetchSites } from "./services/sites";
import { fetchForecast, filterFlyableHours } from "./services/weather";
import { evaluate } from "./services/gonogo";
import { fetchSpotairSites, fetchBalises, type Balise } from "./services/spotair";
import type { Site, GeoLocation, HourlyEvaluation, Verdict } from "./types";

function siteKey(s: Site) {
  return `${s.latitude}-${s.longitude}-${s.name}`;
}

function currentHourVerdict(evals: HourlyEvaluation[]): Verdict {
  if (!evals.length) return "NO-GO";

  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split("T")[0];

  const currentEval = evals.find((e) => {
    const [date, time] = e.weather.time.split("T");
    const hour = parseInt(time.split(":")[0], 10);
    return date === todayStr && hour === currentHour;
  });

  if (currentEval) return currentEval.evaluation.verdict;

  const nextEval = evals.find((e) => {
    const [date, time] = e.weather.time.split("T");
    const hour = parseInt(time.split(":")[0], 10);
    return date === todayStr && hour > currentHour;
  });

  if (nextEval) return nextEval.evaluation.verdict;

  if (evals.some((e) => e.evaluation.verdict === "GO")) return "GO";
  if (evals.some((e) => e.evaluation.verdict === "MARGINAL")) return "MARGINAL";
  return "NO-GO";
}

function deduplicateSites(spotair: Site[], pge: Site[]): Site[] {
  const seen = new Set<string>();
  const result: Site[] = [];

  for (const s of spotair) {
    const k = `${s.latitude.toFixed(3)}-${s.longitude.toFixed(3)}`;
    seen.add(k);
    result.push(s);
  }

  for (const s of pge) {
    const k = `${s.latitude.toFixed(3)}-${s.longitude.toFixed(3)}`;
    if (!seen.has(k)) {
      seen.add(k);
      result.push(s);
    }
  }

  return result;
}

export default function App() {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [balises, setBalises] = useState<Balise[]>([]);
  const [siteEvals, setSiteEvals] = useState<Map<string, HourlyEvaluation[]>>(
    new Map()
  );
  const [siteVerdicts, setSiteVerdicts] = useState<Map<string, Verdict>>(
    new Map()
  );
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.5, 2.5]);
  const [mapZoom, setMapZoom] = useState(6);
  const [balisesLastUpdate, setBalisesLastUpdate] = useState<Date | null>(null);
  const [balisesRefreshing, setBalisesRefreshing] = useState(false);
  const searchParamsRef = useRef<{ lat: number; lng: number; radius: number } | null>(null);
  const baliseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const BALISE_REFRESH_MS = 60_000;

  const refreshBalisesNow = useCallback(async () => {
    const params = searchParamsRef.current;
    if (!params) return;
    setBalisesRefreshing(true);
    try {
      const data = await fetchBalises(params.lat, params.lng, params.radius + 10);
      setBalises(data);
      setBalisesLastUpdate(new Date());
    } catch {
      // silent fail on refresh — keep previous data
    } finally {
      setBalisesRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (baliseIntervalRef.current) clearInterval(baliseIntervalRef.current);
    if (searchParamsRef.current) {
      baliseIntervalRef.current = setInterval(refreshBalisesNow, BALISE_REFRESH_MS);
    }
    return () => {
      if (baliseIntervalRef.current) clearInterval(baliseIntervalRef.current);
    };
  }, [refreshBalisesNow]);

  const handleSearch = useCallback(async (query: string, radius: number) => {
    setIsLoading(true);
    setError(null);
    setSelectedSite(null);
    setSites([]);
    setBalises([]);
    setSiteEvals(new Map());
    setSiteVerdicts(new Map());

    try {
      const loc = await geocode(query);
      if (!loc) {
        setError(`Lieu introuvable : "${query}"`);
        setIsLoading(false);
        return;
      }
      setLocation(loc);
      setMapCenter([loc.latitude, loc.longitude]);
      setMapZoom(11);
      searchParamsRef.current = { lat: loc.latitude, lng: loc.longitude, radius };

      const [spotairSites, pgeSites, balisesData] = await Promise.all([
        fetchSpotairSites(loc.latitude, loc.longitude, radius).catch(() => []),
        fetchSites(loc.latitude, loc.longitude, radius).catch(() => []),
        fetchBalises(loc.latitude, loc.longitude, radius + 10).catch(() => []),
      ]);

      setBalises(balisesData);
      setBalisesLastUpdate(new Date());

      const allSites = deduplicateSites(spotairSites, pgeSites);
      if (!allSites.length) {
        setError(`Aucun site de parapente dans un rayon de ${radius} km`);
        setSites([]);
        setIsLoading(false);
        return;
      }
      setSites(allSites);

      const newEvals = new Map<string, HourlyEvaluation[]>();
      const newVerdicts = new Map<string, Verdict>();

      await Promise.all(
        allSites.map(async (site) => {
          const key = siteKey(site);
          try {
            const forecast = await fetchForecast(
              site.latitude,
              site.longitude,
              2
            );
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

      setSiteEvals(newEvals);
      setSiteVerdicts(newVerdicts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectSite = (site: Site) => {
    setSelectedSite(site);
    setMapCenter([site.latitude, site.longitude]);
    setMapZoom(13);
  };

  const selectedKey = selectedSite ? siteKey(selectedSite) : null;
  const selectedEvals = selectedKey ? siteEvals.get(selectedKey) ?? [] : [];

  const MAX_BALISE_KM = 15;

  function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = (lat2 - lat1) * 111;
    const dLng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  const nearestBaliseInfo = (() => {
    if (!selectedSite) return null;
    let best: Balise | null = null;
    let bestDist = Infinity;
    for (const b of balises) {
      const d = distanceKm(selectedSite.latitude, selectedSite.longitude, b.latitude, b.longitude);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    if (!best || bestDist > MAX_BALISE_KM) return null;
    return { balise: best, distanceKm: bestDist };
  })();

  const nearestBalise = nearestBaliseInfo?.balise ?? null;
  const nearestBaliseDistKm = nearestBaliseInfo?.distanceKm ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🪂</span>
          <h1>Parapente Go/No-Go</h1>
        </div>
        <SearchBar onSearch={handleSearch} isLoading={isLoading} />
      </header>

      <main className="app-main">
        <div className="sidebar">
          {error && <div className="error-msg">{error}</div>}
          {location && sites.length > 0 && (
            <>
              <div className="results-header">
                <span className="results-location">
                  📍 {location.name}, {location.country}
                </span>
                <span className="results-count">
                  {sites.length} sites · {balises.length} balises
                </span>
              </div>
              {balises.length > 0 && (
                <div className="balise-live-bar">
                  <span className={`live-dot ${balisesRefreshing ? "refreshing" : ""}`} />
                  <span className="live-label">
                    Balises temps réel
                    {balisesLastUpdate && (
                      <> · màj {balisesLastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</>
                    )}
                  </span>
                  <button className="refresh-btn" onClick={refreshBalisesNow} disabled={balisesRefreshing}>
                    ↻
                  </button>
                </div>
              )}
              <SiteList
                sites={sites}
                siteVerdicts={siteVerdicts}
                siteEvals={siteEvals}
                selectedSite={selectedSite}
                onSelectSite={handleSelectSite}
              />
            </>
          )}
          {!location && !isLoading && (
            <div className="empty-state">
              <span className="empty-icon">🏔️</span>
              <p>
                Recherchez une ville ou une région pour trouver les sites de
                parapente et les balises météo à proximité.
              </p>
              <div className="empty-hints">
                <span>Annecy</span>
                <span>Millau</span>
                <span>Fumay</span>
                <span>Saint-Hilaire</span>
              </div>
            </div>
          )}
          {isLoading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Analyse des conditions de vol...</p>
            </div>
          )}
        </div>

        <div className="map-container">
          <SiteMap
            center={mapCenter}
            zoom={mapZoom}
            sites={sites}
            siteVerdicts={siteVerdicts}
            selectedSite={selectedSite}
            onSelectSite={handleSelectSite}
            balises={balises}
          />
          {selectedSite && (
            <div className="detail-overlay">
              <SitePanel
                site={selectedSite}
                evaluations={selectedEvals}
                nearestBalise={nearestBalise}
                nearestBaliseDistKm={nearestBaliseDistKm}
                onClose={() => setSelectedSite(null)}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        Sites : FFVL / SpotAir + ParaglidingEarth (CC BY-SA 3.0) · Balises :
        FFVL · Météo : Open-Meteo / Météo-France AROME ·
        <em>
          {" "}
          Aide à la décision uniquement — ne remplace pas le jugement du pilote
        </em>
      </footer>
    </div>
  );
}
