import {
  Mountain, MapPin, ExternalLink, ChevronDown, ChevronUp,
  Wind, Droplets, Eye, Cloud, Thermometer, AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { WindRose } from "./WindRose";
import { Windgram } from "./Windgram";
import { API } from "../config";
import { dirLabel, windDirToCompass } from "../utils/wind";
import { formatAge } from "../utils/time";
import type { Site, HourlyEvaluation, Verdict, Balise, BaliseWind } from "../types";

interface SitePanelProps {
  site: Site;
  evaluations: HourlyEvaluation[];
  nearestBalise: Balise | null;
  nearestBaliseDistKm: number | null;
  utcOffsetSeconds: number;
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

function siteSourceUrl(site: Site): string {
  if (site.source === "FFVL / SpotAir" && site.ffvl_id) {
    return API.FFVL_TERRAIN_URL(site.ffvl_id);
  }
  if (site.source === "FFVL / SpotAir") return API.SPOTAIR_BASE_URL;
  return site.pge_link || API.PGE_BASE_URL;
}

function sourceLabel(site: Site): string {
  return site.source === "FFVL / SpotAir" ? "FFVL" : "PGE";
}

export function SitePanel({ site, evaluations, nearestBalise, nearestBaliseDistKm, utcOffsetSeconds, onClose }: SitePanelProps) {
  const [expandedHour, setExpandedHour] = useState<string | null>(null);
  const [showWindgram, setShowWindgram] = useState(false);

  const goCount = evaluations.filter((e) => e.evaluation.verdict === "GO").length;
  const marginalCount = evaluations.filter((e) => e.evaluation.verdict === "MARGINAL").length;

  const dayGroups = new Map<string, HourlyEvaluation[]>();
  for (const ev of evaluations) {
    const day = ev.weather.time.split("T")[0];
    if (!dayGroups.has(day)) dayGroups.set(day, []);
    dayGroups.get(day)!.push(ev);
  }

  const meteoUrl = `https://open-meteo.com/en/docs/meteofrance-api#latitude=${site.latitude}&longitude=${site.longitude}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,rain,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl&wind_speed_unit=kmh&timezone=auto&forecast_days=2`;
  const siteUrl = siteSourceUrl(site);

  const bReleve = nearestBalise?.releves?.[0];
  const baliseWindData: BaliseWind | null = bReleve ? {
    direction: bReleve.direction,
    speed: bReleve.vmoy,
    name: nearestBalise!.nom,
  } : null;

  const bUrl = nearestBalise
    ? API.SPOTAIR_BALISE_URL(nearestBalise.provider_key, nearestBalise.balise_id)
    : "";

  return (
    <div className="site-panel">
      <div className="site-panel-header">
        <div className="site-panel-title">
          <Mountain size={20} />
          <div>
            <h2>{site.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {site.altitude && <span className="site-alt">{site.altitude}m</span>}
              <a href={siteUrl} target="_blank" rel="noopener noreferrer"
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
            altWind={
              evaluations[0]?.weather.wind_speed_alt != null
                ? {
                    direction: evaluations[0].weather.wind_direction_alt!,
                    speed: evaluations[0].weather.wind_speed_alt!,
                    altitude: evaluations[0].weather.wind_alt_meters!,
                  }
                : null
            }
          />
          <div className="site-meta">
            {site.landing && (
              <div className="meta-item">
                <MapPin size={14} />
                <span>Atterro : {site.landing.name || "—"}{site.landing.altitude ? ` (${site.landing.altitude}m)` : ""}</span>
                <SourceLink href={siteUrl} label={sourceLabel(site)} />
              </div>
            )}
            {site.description && (
              <div className="meta-item">
                <AlertTriangle size={14} />
                <span>{site.description.slice(0, 150)}</span>
                <SourceLink href={siteUrl} label={sourceLabel(site)} />
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
            <SourceLink href={siteUrl} label={sourceLabel(site)} />
          </div>
        )}

        <div className="site-summary">
          <span className="summary-go">{goCount} créneaux GO</span>
          <span className="summary-marginal">{marginalCount} marginaux</span>
          <span className="summary-nogo">{evaluations.length - goCount - marginalCount} NO-GO</span>
        </div>

        {site.altitude && site.altitude > 200 && (
          <button
            className={`wg-toggle ${showWindgram ? "active" : ""}`}
            onClick={() => setShowWindgram((v) => !v)}
          >
            {showWindgram ? "▲ Masquer windgram" : "▼ Windgram altitude"}
          </button>
        )}
        {showWindgram && site.altitude && (
          <Windgram
            lat={site.latitude}
            lon={site.longitude}
            siteAltitude={site.altitude}
            utcOffsetSeconds={utcOffsetSeconds}
          />
        )}
      </div>

      {nearestBalise && bReleve && (() => {
        const speedColor = bReleve.vmoy <= 15 ? "var(--go)" : bReleve.vmoy <= 25 ? "var(--marginal)" : "var(--nogo)";
        const { label: ageLabel, isStale } = formatAge(bReleve.date_releve);
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
                <svg width={22} height={22} viewBox="0 0 22 22" className="balise-arrow">
                  <g transform={`translate(11,11) rotate(${bReleve.direction + 90})`}>
                    <path d="M -7 -4 L 7 0 L -7 4 L -4 0 Z" fill={speedColor} />
                  </g>
                </svg>
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
              <SourceLink href={meteoUrl} label="MF AROME · vent 10m sol" />
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
                      <span title="Vent à 10m sol (Météo-France AROME)">
                        <Wind size={13} /> {ev.weather.wind_speed.toFixed(0)}
                      </span>
                      <span title="Rafales à 10m sol (Météo-France AROME)">↑{ev.weather.wind_gusts.toFixed(0)}</span>
                      <span title="Direction à 10m sol (Météo-France AROME)">{ev.evaluation.wind_compass}</span>
                      {ev.weather.wind_speed_alt != null && (
                        <span className="alt-wind-badge" title={`Vent altitude déco ~${ev.weather.wind_alt_meters}m (Météo-Parapente WRF)`}>
                          ▲{ev.weather.wind_speed_alt.toFixed(0)} {windDirToCompass(ev.weather.wind_direction_alt ?? 0)}
                        </span>
                      )}
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
                          <div className="wind-compare-title">Comparaison vent (10m sol)</div>
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
                          {ev.weather.wind_speed_alt != null && (
                            <div className="wind-compare-row">
                              <span className="wc-label" style={{ color: "#8b5cf6" }}>▲ Alt. déco ~{ev.weather.wind_alt_meters}m</span>
                              <span className="wc-value">
                                {ev.weather.wind_speed_alt.toFixed(0)} km/h {windDirToCompass(ev.weather.wind_direction_alt ?? 0)}
                              </span>
                              <SourceLink href={API.MP_BASE_URL} label="Météo-Parapente" />
                            </div>
                          )}
                          {(() => {
                            const warnings: string[] = [];
                            const speedDiff = Math.abs(ev.weather.wind_speed - bReleve.vmoy);
                            const forecastDir = ev.evaluation.wind_compass;
                            const baliseDir = dirLabel(bReleve.direction);
                            const dirMatch = forecastDir === baliseDir;
                            const adjacentDirs: Record<string, string[]> = {
                              N: ["NW", "NE"], NE: ["N", "E"], E: ["NE", "SE"], SE: ["E", "S"],
                              S: ["SE", "SW"], SW: ["S", "W"], W: ["SW", "NW"], NW: ["W", "N"],
                            };
                            const dirClose = dirMatch || (adjacentDirs[forecastDir]?.includes(baliseDir) ?? false);

                            if (!dirClose) {
                              warnings.push(`Direction opposée : prévision ${forecastDir} vs balise ${baliseDir}`);
                            }
                            if (speedDiff > 5) {
                              warnings.push(`Écart vitesse : ${speedDiff.toFixed(0)} km/h entre prévision et balise`);
                            }
                            if (bReleve.vmax > 25) {
                              warnings.push(`Rafales balise ${bReleve.vmax} km/h — prudence !`);
                            }
                            if (bReleve.vmax - bReleve.vmin > 20) {
                              warnings.push(`Vent très irrégulier : min ${bReleve.vmin} / max ${bReleve.vmax} km/h`);
                            }

                            if (warnings.length === 0) return null;
                            const isSevere = !dirClose || bReleve.vmax > 30 || speedDiff > 10;
                            return (
                              <div className={isSevere ? "wc-danger" : "wc-warning"}>
                                {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                              </div>
                            );
                          })()}
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
