import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import { dirLabel } from "../utils/wind";
import { MapLegend } from "./MapLegend";
import type { Site, Verdict, Balise, Webcam } from "../types";

import "leaflet/dist/leaflet.css";

const DIR_ANGLES: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

function createSiteIcon(verdict?: Verdict, orientations?: Partial<Record<string, number>>) {
  const color =
    verdict === "GO"
      ? "#22c55e"
      : verdict === "MARGINAL"
        ? "#f59e0b"
        : verdict === "NO-GO"
          ? "#ef4444"
          : "#6b7280";

  const s = 52;
  const cx = s / 2;
  const cy = s / 2;
  const dotR = 12;
  const arcR = s / 2 - 3;

  let sectors = "";
  if (orientations) {
    for (const [dir, val] of Object.entries(orientations)) {
      if ((val ?? 0) < 1) continue;
      const angle = DIR_ANGLES[dir];
      if (angle == null) continue;
      const opacity = val === 2 ? 0.3 : 0.15;
      const halfSector = (22.5 * Math.PI) / 180;
      const rad = ((angle - 90) * Math.PI) / 180;
      const x1 = cx + Math.cos(rad - halfSector) * arcR;
      const y1 = cy + Math.sin(rad - halfSector) * arcR;
      const x2 = cx + Math.cos(rad + halfSector) * arcR;
      const y2 = cy + Math.sin(rad + halfSector) * arcR;
      sectors += `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${arcR} ${arcR} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z"
        fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-width="0.5" stroke-opacity="0.5"/>`;
    }
  }

  return L.divIcon({
    className: "",
    html: `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      ${sectors}
      <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${color}" stroke="white" stroke-width="2.5"/>
      <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central"
        font-size="11" fill="white">⛰</text>
    </svg>`,
    iconSize: [s, s],
    iconAnchor: [cx, cy],
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

  const s = 48;
  const cx = s / 2;
  const cy = s / 2;
  const dotR = 14;
  const coneLen = s / 2 - 2;

  const goesRad = ((dir + 90) * Math.PI) / 180;
  const half = (25 * Math.PI) / 180;
  const x1 = cx + Math.cos(goesRad - half) * coneLen;
  const y1 = cy + Math.sin(goesRad - half) * coneLen;
  const x2 = cx + Math.cos(goesRad + half) * coneLen;
  const y2 = cy + Math.sin(goesRad + half) * coneLen;

  return L.divIcon({
    className: "",
    html: `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${coneLen} ${coneLen} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z"
        fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
      <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${color}18" stroke="${color}" stroke-width="2"/>
      <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central"
        font-size="11" font-weight="700" fill="${color}">${speed}</text>
    </svg>`,
    iconSize: [s, s],
    iconAnchor: [cx, cy],
  });
}

function createWebcamIcon(direction: number | null, fov: number | null) {
  const s = 60;
  const cx = s / 2;
  const cy = s / 2;
  const dotR = 8;

  let cone = "";
  if (direction != null) {
    const half = ((fov ?? 60) / 2) * Math.PI / 180;
    const coneLen = s / 2 - 2;
    const dirRad = (direction - 90) * Math.PI / 180;
    const x1 = cx + Math.cos(dirRad - half) * coneLen;
    const y1 = cy + Math.sin(dirRad - half) * coneLen;
    const x2 = cx + Math.cos(dirRad + half) * coneLen;
    const y2 = cy + Math.sin(dirRad + half) * coneLen;
    const largeArc = (fov ?? 60) > 180 ? 1 : 0;
    cone = `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${coneLen} ${coneLen} 0 ${largeArc} 1 ${x2} ${y2} Z"
      fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" stroke-width="1" stroke-opacity="0.5"/>`;
  }

  return L.divIcon({
    className: "",
    html: `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      ${cone}
      <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="#8b5cf6" stroke="white" stroke-width="2"/>
      <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central"
        font-size="9" fill="white">📷</text>
    </svg>`,
    iconSize: [s, s],
    iconAnchor: [cx, cy],
  });
}

const landingIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:22px;height:22px;border-radius:4px;
    background:#3b82f6;border:2px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,.3);
    display:flex;align-items:center;justify-content:center;
    color:white;font-weight:700;font-size:11px;
  ">P</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

interface SiteMapProps {
  center: [number, number];
  zoom: number;
  sites: Site[];
  siteVerdicts: Map<string, Verdict>;
  selectedSite: Site | null;
  onSelectSite: (site: Site) => void;
  balises: Balise[];
  webcams: Webcam[];
}

export function SiteMap({
  center, zoom, sites, siteVerdicts, selectedSite, onSelectSite, balises, webcams,
}: SiteMapProps) {
  return (
    <MapContainer
      center={center} zoom={zoom}
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
                    hour: "2-digit", minute: "2-digit",
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
            icon={createSiteIcon(verdict, site.orientations)}
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

      {sites
        .filter((s) => s.landing?.latitude != null && s.landing?.longitude != null)
        .reduce<{ key: string; landing: NonNullable<Site["landing"]>; siteName: string; ffvlId?: number }[]>(
          (acc, site) => {
            const lk = `${site.landing!.latitude!.toFixed(4)}-${site.landing!.longitude!.toFixed(4)}`;
            if (!acc.some((a) => a.key === lk)) {
              acc.push({ key: lk, landing: site.landing!, siteName: site.name, ffvlId: site.ffvl_id });
            }
            return acc;
          }, []
        )
        .map(({ key, landing, siteName, ffvlId }) => (
          <Marker
            key={`landing-${key}`}
            position={[landing.latitude!, landing.longitude!]}
            icon={landingIcon}
            opacity={0.85}
          >
            <Popup>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>🅿️ {landing.name || "Atterrissage"}</strong>
                {landing.altitude && <span> — {landing.altitude}m</span>}
                <br />
                <span style={{ fontSize: 11, color: "#666" }}>
                  Atterro de {siteName}
                </span>
                {landing.description && (
                  <>
                    <br />
                    <span style={{ fontSize: 11, color: "#888" }}>
                      {landing.description.slice(0, 120)}
                    </span>
                  </>
                )}
                {ffvlId && (
                  <>
                    <br />
                    <a
                      href={`https://federation.ffvl.fr/terrain/${ffvlId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "#8b5cf6" }}
                    >
                      Fiche FFVL ↗
                    </a>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ))
      }

      {webcams.map((w) => (
        <Marker
          key={`webcam-${w.id}`}
          position={[w.latitude, w.longitude]}
          icon={createWebcamIcon(w.direction, w.champ)}
          opacity={0.9}
        >
          <Popup maxWidth={340} minWidth={280}>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <strong>📷 {w.nom}</strong>
              {w.altitude > 0 && <span> — {w.altitude}m</span>}
              {w.direction != null && (
                <span style={{ fontSize: 11, color: "#888" }}>
                  {" "}· pointe {dirLabel(w.direction)} ({w.direction}°)
                </span>
              )}
              {w.description && (
                <>
                  <br />
                  <span style={{ fontSize: 11, color: "#666" }}>{w.description}</span>
                </>
              )}
              <br />
              <img
                src={w.url_image}
                alt={w.nom}
                style={{
                  width: "100%", maxWidth: 300, borderRadius: 6,
                  marginTop: 6, border: "1px solid #ddd",
                }}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {w.url_page && (
                <>
                  <br />
                  <a
                    href={w.url_page}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: "#8b5cf6" }}
                  >
                    Page webcam ↗
                  </a>
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
