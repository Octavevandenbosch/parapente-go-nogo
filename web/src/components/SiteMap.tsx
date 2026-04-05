import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import type { Site, Verdict } from "../types";
import type { Balise } from "../services/spotair";
import { MapLegend } from "./MapLegend";

import "leaflet/dist/leaflet.css";

function createSiteIcon(verdict?: Verdict) {
  const color =
    verdict === "GO"
      ? "#22c55e"
      : verdict === "MARGINAL"
        ? "#f59e0b"
        : verdict === "NO-GO"
          ? "#ef4444"
          : "#6b7280";

  return L.divIcon({
    className: "",
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:700;font-size:11px;
    ">⛰</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function windColor(speed: number): string {
  if (speed <= 15) return "#22c55e";
  if (speed <= 25) return "#f59e0b";
  return "#ef4444";
}

function createBaliseIcon(balise: Balise) {
  const r = balise.releves?.[0];
  if (!r) return L.divIcon({ className: "", html: "", iconSize: [0, 0] });

  const speed = r.vmoy ?? 0;
  const dir = r.direction ?? 0;
  const color = windColor(speed);
  const arrowRotation = dir + 180;

  return L.divIcon({
    className: "",
    html: `<div style="
      position:relative;width:36px;height:36px;
    ">
      <div style="
        width:36px;height:36px;border-radius:50%;
        background:${color}22;border:2px solid ${color};
        display:flex;align-items:center;justify-content:center;
        color:${color};font-weight:700;font-size:11px;
        backdrop-filter:blur(4px);
      ">${speed}</div>
      <div style="
        position:absolute;top:-6px;left:50%;
        transform:translateX(-50%) rotate(${arrowRotation}deg);
        font-size:12px;color:${color};
      ">▲</div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function MapController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function dirLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

interface SiteMapProps {
  center: [number, number];
  zoom: number;
  sites: Site[];
  siteVerdicts: Map<string, Verdict>;
  selectedSite: Site | null;
  onSelectSite: (site: Site) => void;
  balises: Balise[];
}

export function SiteMap({
  center,
  zoom,
  sites,
  siteVerdicts,
  selectedSite,
  onSelectSite,
  balises,
}: SiteMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController center={center} zoom={zoom} />

      {balises.map((b) => {
        const r = b.releves?.[0];
        if (!r) return null;
        return (
          <Marker
            key={`balise-${b.provider_key}-${b.balise_id}`}
            position={[b.latitude, b.longitude]}
            icon={createBaliseIcon(b)}
            opacity={0.9}
          >
            <Popup>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>🌬️ {b.nom}</strong>
                <br />
                Vent moy: <strong>{r.vmoy} km/h</strong> {dirLabel(r.direction)}
                <br />
                Min: {r.vmin} · Max: {r.vmax} km/h
                {r.temperature != null && (
                  <>
                    <br />
                    Temp: {r.temperature}°C
                  </>
                )}
                <br />
                <span style={{ fontSize: 11, color: "#888" }}>
                  {new Date(r.date_releve * 1000).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {b.altitude}m
                </span>
                <br />
                <span style={{
                  fontSize: 10, background: "#3b82f622", color: "#3b82f6",
                  padding: "1px 5px", borderRadius: 4, marginTop: 2, display: "inline-block",
                }}>
                  {b.provider_key.toUpperCase()}
                  {b.description?.includes("pioupiou") ? " / Pioupiou" : ""}
                </span>
              </div>
            </Popup>
          </Marker>
        );
      })}

      <MapLegend />

      {sites.map((site) => {
        const key = `${site.latitude}-${site.longitude}-${site.name}`;
        const verdict = siteVerdicts.get(key);
        const isSelected = selectedSite?.name === site.name;

        return (
          <Marker
            key={key}
            position={[site.latitude, site.longitude]}
            icon={createSiteIcon(verdict)}
            opacity={isSelected ? 1 : 0.85}
            eventHandlers={{ click: () => onSelectSite(site) }}
          >
            <Popup>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>{site.name}</strong>
                {site.altitude && <span> — {site.altitude}m</span>}
                <br />
                <span style={{
                  fontSize: 10,
                  background: site.source === "FFVL / SpotAir" ? "#8b5cf622" : "#f59e0b22",
                  color: site.source === "FFVL / SpotAir" ? "#8b5cf6" : "#f59e0b",
                  padding: "1px 5px", borderRadius: 4, marginTop: 2, display: "inline-block",
                }}>
                  {site.source}
                </span>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
