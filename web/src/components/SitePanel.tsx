import {
  Mountain,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Wind,
  Droplets,
  Eye,
  Cloud,
  Thermometer,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { WindRose } from "./WindRose";
import type { Site, HourlyEvaluation, Verdict } from "../types";
import type { Balise } from "../services/spotair";

interface SitePanelProps {
  site: Site;
  evaluations: HourlyEvaluation[];
  nearestBalise: Balise | null;
  nearestBaliseDistKm: number | null;
  onClose: () => void;
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="source-inline-link" title={`Source : ${label}`}>
      ({label} ↗)
    </a>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const cls = verdict === "GO" ? "badge-go" : verdict === "MARGINAL" ? "badge-marginal" : "badge-nogo";
  const label = verdict === "GO" ? "✓ GO" : verdict === "MARGINAL" ? "⚠ MARGINAL" : "✗ NO-GO";
  return <span className={`verdict-badge ${cls}`}>{label}</span>;
}

function CheckIcon({ level }: { level: string }) {
  if (level === "ok") return <span className="check-ok">✓</span>;
  if (level === "warn") return <span className="check-warn">⚠</span>;
  return <span className="check-fail">✗</span>;
}

function dirLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function meteoSourceUrl(lat: number, lng: number): string {
  return `https://open-meteo.com/en/docs/meteofrance-api#latitude=${lat}&longitude=${lng}`;
}

function baliseSourceUrl(b: Balise): string {
  return `https://www.spotair.mobi/wind/${b.provider_key}/${b.balise_id}`;
}

function siteSourceUrl(site: Site): string {
  if (site.source === "FFVL / SpotAir" && site.ffvl_id) {
    return `https://federation.ffvl.fr/terrain/${site.ffvl_id}`;
  }
  if (site.source === "FFVL / SpotAir") return "https://www.spotair.mobi";
  return site.pge_link || "https://paraglidingearth.com";
}

export function SitePanel({ site, evaluations, nearestBalise, nearestBaliseDistKm, onClose }: SitePanelProps) {
  const [expandedHour, setExpandedHour] = useState<string | null>(null);

  const goCount = evaluations.filter((e) => e.evaluation.verdict === "GO").length;
  const marginalCount = evaluations.filter((e) => e.evaluation.verdict === "MARGINAL").length;

  const dayGroups = new Map<string, HourlyEvaluation[]>();
  for (const ev of evaluations) {
    const day = ev.weather.time.split("T")[0];
    if (!dayGroups.has(day)) dayGroups.set(day, []);
    dayGroups.get(day)!.push(ev);
  }

  const meteoUrl = meteoSourceUrl(site.latitude, site.longitude);

  const bReleve = nearestBalise?.releves?.[0];
  const baliseWindData = bReleve ? {
    direction: bReleve.direction,
    speed: bReleve.vmoy,
    name: nearestBalise!.nom,
  } : null;

  const bUrl = nearestBalise ? baliseSourceUrl(nearestBalise) : "";

  return (
    <div className="site-panel">
      <div className="site-panel-header">
        <div className="site-panel-title">
          <Mountain size={20} />
          <div>
            <h2>{site.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {site.altitude && <span className="site-alt">{site.altitude}m</span>}
              <a href={siteSourceUrl(site)} target="_blank" rel="noopener noreferrer"
                className={`source-pill ${site.source === "FFVL / SpotAir" ? "source-ffvl" : "source-pge"}`}
                style={{ textDecoration: "none" }}>
                {site.source === "FFVL / SpotAir" ? "FFVL" : "ParaglidingEarth"} ↗
              </a>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="site-panel-info">
        <div className="site-info-row">
          <WindRose
            orientations={site.orientations}
            size={100}
            currentWind={evaluations[0]?.evaluation.wind_compass}
            baliseWind={baliseWindData}
          />
          <div className="site-meta">
            {site.landing && (
              <div className="meta-item">
                <MapPin size={14} />
                <span>Atterro : {site.landing.name || "—"}{site.landing.altitude ? ` (${site.landing.altitude}m)` : ""}</span>
                <SourceLink href={siteSourceUrl(site)} label={site.source === "FFVL / SpotAir" ? "FFVL" : "PGE"} />
              </div>
            )}
            {site.description && (
              <div className="meta-item">
                <AlertTriangle size={14} />
                <span>{site.description.slice(0, 150)}</span>
                <SourceLink href={siteSourceUrl(site)} label={site.source === "FFVL / SpotAir" ? "FFVL" : "PGE"} />
              </div>
            )}
            {site.pge_link && (
              <a href={site.pge_link} target="_blank" rel="noopener noreferrer" className="meta-link">
                <ExternalLink size={14} /> ParaglidingEarth
              </a>
            )}
          </div>
        </div>

        {site.flight_rules && (
          <div className="flight-rules">
            <strong>Règles :</strong> {site.flight_rules.slice(0, 200)}{" "}
            <SourceLink href={siteSourceUrl(site)} label={site.source === "FFVL / SpotAir" ? "FFVL" : "PGE"} />
          </div>
        )}

        <div className="site-summary">
          <span className="summary-go">{goCount} créneaux GO</span>
          <span className="summary-marginal">{marginalCount} marginaux</span>
          <span className="summary-nogo">{evaluations.length - goCount - marginalCount} NO-GO</span>
        </div>
      </div>

      {nearestBalise && bReleve && (() => {
        const speedColor = bReleve.vmoy <= 15 ? "var(--go)" : bReleve.vmoy <= 25 ? "var(--marginal)" : "var(--nogo)";
        const ageSeconds = Math.floor(Date.now() / 1000 - bReleve.date_releve);
        const ageMin = Math.floor(ageSeconds / 60);
        const ageLabel = ageMin < 1 ? "< 1 min" : ageMin < 60 ? `${ageMin} min` : `${Math.floor(ageMin / 60)}h${ageMin % 60}`;
        const isStale = ageMin > 30;
        return (
          <div className="balise-panel">
            <div className="balise-header">
              <Wind size={14} />
              <strong>Balise temps réel</strong>
              <a href={bUrl} target="_blank" rel="noopener noreferrer" className="balise-name-link">
                {nearestBalise.nom} ↗
              </a>
            </div>
            <div className="balise-data">
              <div className="balise-wind" style={{ color: speedColor }}>
                <span className="balise-speed">{bReleve.vmoy}</span>
                <span className="balise-unit">km/h</span>
                <span className="balise-dir">{dirLabel(bReleve.direction)}</span>
              </div>
              <div className="balise-details">
                <span>Min {bReleve.vmin} · Max {bReleve.vmax} km/h <SourceLink href={bUrl} label="FFVL" /></span>
                {bReleve.temperature != null && <span>🌡 {bReleve.temperature}°C <SourceLink href={bUrl} label="FFVL" /></span>}
                <span className="balise-time">
                  <span className={`live-dot-inline ${isStale ? "stale" : ""}`} />
                  il y a {ageLabel}
                  {" · "}
                  {nearestBalise.altitude}m
                  {nearestBaliseDistKm != null && ` · ${nearestBaliseDistKm.toFixed(1)} km`}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="hourly-list">
        {[...dayGroups.entries()].map(([day, hours]) => (
          <div key={day} className="day-group">
            <div className="day-header">
              {new Date(day + "T00:00").toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long",
              })}
              <SourceLink href={meteoUrl} label="Météo-France AROME" />
            </div>
            {hours.map((ev) => {
              const hour = ev.weather.time.split("T")[1].slice(0, 5);
              const isExpanded = expandedHour === ev.weather.time;

              return (
                <div key={ev.weather.time} className="hour-row-wrapper">
                  <button
                    className={`hour-row ${ev.evaluation.verdict.toLowerCase().replace("-", "")}`}
                    onClick={() => setExpandedHour(isExpanded ? null : ev.weather.time)}
                  >
                    <span className="hour-time">{hour}</span>
                    <div className="hour-metrics">
                      <span title="Vent (Météo-France AROME)">
                        <Wind size={13} /> {ev.weather.wind_speed.toFixed(0)}
                      </span>
                      <span title="Rafales (Météo-France AROME)">↑{ev.weather.wind_gusts.toFixed(0)}</span>
                      <span title="Direction (Météo-France AROME)">{ev.evaluation.wind_compass}</span>
                      <span title="Pluie (Météo-France AROME)">
                        <Droplets size={13} /> {ev.weather.rain > 0 ? `${ev.weather.rain.toFixed(1)}` : "—"}
                      </span>
                      <span title="Nuages (Météo-France AROME)">
                        <Cloud size={13} /> {ev.weather.cloud_cover}%
                      </span>
                      <span title="Température (Météo-France AROME)">
                        <Thermometer size={13} /> {ev.weather.temperature.toFixed(0)}°
                      </span>
                      <span title="Visibilité (Météo-France AROME)">
                        <Eye size={13} /> {((ev.weather.visibility ?? 99999) / 1000).toFixed(0)}km
                      </span>
                    </div>
                    <VerdictBadge verdict={ev.evaluation.verdict} />
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {isExpanded && (
                    <div className="hour-details">
                      {bReleve && (
                        <div className="wind-comparison">
                          <div className="wind-compare-title">Comparaison vent</div>
                          <div className="wind-compare-row">
                            <span className="wc-label" style={{ color: "#3b82f6" }}>Prévision MF</span>
                            <span className="wc-value">
                              {ev.weather.wind_speed.toFixed(0)} km/h {ev.evaluation.wind_compass}
                              <span className="wc-gusts"> (raf. {ev.weather.wind_gusts.toFixed(0)})</span>
                            </span>
                            <SourceLink href={meteoUrl} label="MF AROME" />
                          </div>
                          <div className="wind-compare-row">
                            <span className="wc-label" style={{ color: "#f97316" }}>Balise réelle</span>
                            <span className="wc-value">
                              {bReleve.vmoy} km/h {dirLabel(bReleve.direction)}
                              <span className="wc-gusts"> (min {bReleve.vmin} / max {bReleve.vmax})</span>
                            </span>
                            <SourceLink href={bUrl} label="FFVL" />
                          </div>
                          {Math.abs(ev.weather.wind_speed - bReleve.vmoy) > 8 && (
                            <div className="wc-warning">
                              ⚠ Écart important entre prévision et mesure réelle
                            </div>
                          )}
                        </div>
                      )}
                      {ev.evaluation.checks.map((check, i) => (
                        <div key={i} className="check-line">
                          <CheckIcon level={check.level} />
                          <span>{check.message}</span>
                          {check.message.includes("Base nuages") ? (
                            <SourceLink href={meteoUrl} label="calculé" />
                          ) : (
                            <SourceLink href={meteoUrl} label="MF AROME" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
