import { useState, useCallback, useEffect, useRef } from "react";
import { SearchBar } from "./components/SearchBar";
import { SiteMap } from "./components/SiteMap";
import { SiteList } from "./components/SiteList";
import { SitePanel } from "./components/SitePanel";
import { JeanIA } from "./components/JeanIA";
import { useSearch } from "./hooks/useSearch";
import { useBaliseRefresh } from "./hooks/useBaliseRefresh";
import { useNearestBalise } from "./hooks/useNearestBalise";
import { siteKey } from "./utils/geo";
import type { Site } from "./types";

export default function App() {
  const {
    location, sites, siteEvals, siteVerdicts,
    isLoading, error, search, balisesData, webcams, searchParams,
    lastForecastUpdate, utcOffsetSeconds,
  } = useSearch();

  const { balises, lastUpdate, isRefreshing, refresh, startPolling, reset } = useBaliseRefresh();

  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([46.5, 2.5]);
  const [mapZoom, setMapZoom] = useState(6);

  const handleSearch = useCallback(async (query: string, radius: number) => {
    setSelectedSite(null);
    reset();
    await search(query, radius);
  }, [search, reset]);

  const pollingStartedRef = useRef(false);
  useEffect(() => {
    if (searchParams && balisesData.length > 0 && !pollingStartedRef.current) {
      pollingStartedRef.current = true;
      startPolling(searchParams, balisesData);
    }
    if (!searchParams) pollingStartedRef.current = false;
  }, [searchParams, balisesData, startPolling]);

  useEffect(() => {
    if (location) {
      setMapCenter([location.latitude, location.longitude]);
      setMapZoom(11);
    }
  }, [location]);

  const handleSelectSite = (site: Site) => {
    setSelectedSite(site);
    setMapCenter([site.latitude, site.longitude]);
    setMapZoom(13);
  };

  const selectedKey = selectedSite ? siteKey(selectedSite) : null;
  const selectedEvals = selectedKey ? siteEvals.get(selectedKey) ?? [] : [];

  const nearestBaliseInfo = useNearestBalise(selectedSite, balises);
  const nearestBalise = nearestBaliseInfo?.balise ?? null;
  const nearestBaliseDistKm = nearestBaliseInfo?.distanceKm ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <button className="logo" onClick={() => window.location.reload()}>
          <span className="logo-icon">🪂</span>
          <h1>Parapente Go/No-Go</h1>
        </button>
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
              {lastForecastUpdate && (
                <div className="balise-live-bar">
                  <span className="live-dot" style={{ background: "var(--accent)" }} />
                  <span className="live-label">
                    Météo AROME · màj {lastForecastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    <span style={{ opacity: 0.6 }}> · auto 1h</span>
                  </span>
                </div>
              )}
              {balises.length > 0 && (
                <div className="balise-live-bar">
                  <span className={`live-dot ${isRefreshing ? "refreshing" : ""}`} />
                  <span className="live-label">
                    Balises temps réel
                    {lastUpdate && (
                      <> · màj {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</>
                    )}
                  </span>
                  <button className="refresh-btn" onClick={refresh} disabled={isRefreshing}>
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
                {["Annecy", "Millau", "Fumay", "Saint-Hilaire"].map((q) => (
                  <button key={q} onClick={() => handleSearch(q, 25)} disabled={isLoading}>
                    {q}
                  </button>
                ))}
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
            webcams={webcams}
          />
          {selectedSite && (
            <div className="detail-overlay">
              <SitePanel
                site={selectedSite}
                evaluations={selectedEvals}
                nearestBalise={nearestBalise}
                nearestBaliseDistKm={nearestBaliseDistKm}
                utcOffsetSeconds={utcOffsetSeconds}
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

      <JeanIA
        location={location}
        sites={sites}
        siteEvals={siteEvals}
        siteVerdicts={siteVerdicts}
        balises={balises}
      />
    </div>
  );
}
