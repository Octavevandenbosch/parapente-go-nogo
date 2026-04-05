import { useState, useEffect } from "react";
import { fetchFullWindgram } from "../services/meteoparapente";
import type { FullWindgramData } from "../services/meteoparapente";

const CELL_W = 48;
const CELL_H = 20;
const MARGIN_L = 52;
const MARGIN_B = 22;
const ARROW = "M -6 -3 L 6 0 L -6 3 L -3 0 Z";

function speedColor(s: number): string {
  if (s < 10) return "#22c55e";
  if (s < 18) return "#65a30d";
  if (s < 25) return "#ca8a04";
  if (s < 35) return "#ea580c";
  if (s < 50) return "#dc2626";
  if (s < 65) return "#be123c";
  if (s < 80) return "#9333ea";
  return "#581c87";
}

interface Props {
  lat: number;
  lon: number;
  siteAltitude: number;
  utcOffsetSeconds: number;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

export function Windgram({ lat, lon, siteAltitude, utcOffsetSeconds }: Props) {
  const [date, setDate] = useState(todayStr);
  const [data, setData] = useState<FullWindgramData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFullWindgram(lat, lon, date).then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [lat, lon, date]);

  if (loading) return <div className="wg-status">Chargement du windgram…</div>;
  if (!data) return <div className="wg-status">Windgram indisponible</div>;

  const offsetH = utcOffsetSeconds / 3600;
  const { hours, altitudes, cells, terrain } = data;

  const filtered: { localH: number; idx: number }[] = [];
  hours.forEach((h, i) => {
    const localH = parseInt(h) + offsetH;
    if (localH >= 6 && localH <= 23) filtered.push({ localH, idx: i });
  });

  const nCols = filtered.length;
  const nRows = altitudes.length;
  const W = MARGIN_L + nCols * CELL_W;
  const H = nRows * CELL_H + MARGIN_B;

  const siteRow = altitudes.reduce(
    (best, a, i) => (Math.abs(a - siteAltitude) < Math.abs(altitudes[best] - siteAltitude) ? i : best),
    0,
  );

  const today = todayStr();
  const tomorrow = tomorrowStr();
  const dateLabel = date === today ? "Aujourd'hui" : date === tomorrow ? "Demain" : date;

  return (
    <div className="wg-container">
      <div className="wg-toolbar">
        <span className="wg-title">Windgram — Météo-Parapente (WRF)</span>
        <div className="wg-day-btns">
          <button className={date === today ? "active" : ""} onClick={() => setDate(today)}>
            Auj.
          </button>
          <button className={date === tomorrow ? "active" : ""} onClick={() => setDate(tomorrow)}>
            Demain
          </button>
        </div>
      </div>
      <div className="wg-sub">
        {dateLabel} · terrain {terrain}m · déco ~{siteAltitude}m
      </div>
      <div className="wg-scroll">
        <svg width={W} height={H} className="wg-svg">
          {/* Terrain shading + boundary */}
          {(() => {
            const tIdx = altitudes.findIndex((a) => a >= terrain);
            if (tIdx < 0) return null;
            const terrainY = (nRows - tIdx) * CELL_H;
            return (
              <>
                <rect
                  x={MARGIN_L}
                  y={terrainY}
                  width={nCols * CELL_W}
                  height={H - terrainY}
                  fill="#78716c"
                  opacity={0.15}
                />
                <line
                  x1={MARGIN_L} y1={terrainY} x2={W} y2={terrainY}
                  stroke="#a8a29e" strokeWidth={1} strokeDasharray="3 2"
                />
                <text
                  x={W - 4} y={terrainY + 10}
                  textAnchor="end" fontSize={8} fill="#a8a29e" fontWeight={600}
                >
                  terrain {terrain}m
                </text>
              </>
            );
          })()}

          {/* Horizontal grid lines (above terrain only) */}
          {altitudes.map((alt, ai) => {
            if (alt < terrain) return null;
            const y = (nRows - 1 - ai) * CELL_H + CELL_H;
            return (
              <line
                key={`hg${ai}`}
                x1={MARGIN_L} y1={y} x2={W} y2={y}
                stroke="#334155" strokeWidth={0.3}
              />
            );
          })}

          {/* Vertical grid lines */}
          {filtered.map((_, hi) => {
            const x = MARGIN_L + hi * CELL_W;
            return (
              <line
                key={`vg${hi}`}
                x1={x} y1={0} x2={x} y2={nRows * CELL_H}
                stroke="#334155" strokeWidth={0.3}
              />
            );
          })}

          {/* Altitude labels (above terrain only) */}
          {altitudes.map((alt, ai) => {
            if (alt < terrain) return null;
            if (nRows > 28 && ai % 2 !== 0) return null;
            const y = (nRows - 1 - ai) * CELL_H + CELL_H / 2;
            return (
              <text
                key={`al${ai}`}
                x={MARGIN_L - 4} y={y}
                textAnchor="end" dominantBaseline="middle"
                fontSize={8} fill="#94a3b8"
              >
                {alt}
              </text>
            );
          })}

          {/* Hour labels */}
          {filtered.map((f, hi) => (
            <text
              key={`hl${hi}`}
              x={MARGIN_L + hi * CELL_W + CELL_W / 2}
              y={nRows * CELL_H + 14}
              textAnchor="middle" fontSize={10} fill="#94a3b8" fontWeight={500}
            >
              {f.localH}h
            </text>
          ))}

          {/* Site altitude line */}
          <line
            x1={MARGIN_L}
            y1={(nRows - 1 - siteRow) * CELL_H + CELL_H / 2}
            x2={W}
            y2={(nRows - 1 - siteRow) * CELL_H + CELL_H / 2}
            stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.5}
          />
          <text
            x={MARGIN_L + 4}
            y={(nRows - 1 - siteRow) * CELL_H + CELL_H / 2 - 5}
            fontSize={8} fill="#3b82f6" fontWeight={700}
          >
            déco {siteAltitude}m
          </text>

          {/* Wind cells — arrows point downwind (where the wind blows TO) */}
          {filtered.map((f, hi) =>
            altitudes.map((alt, ai) => {
              if (alt < terrain) return null;
              const cell = cells[f.idx]?.[ai];
              if (!cell) return null;
              const cx = MARGIN_L + hi * CELL_W + CELL_W * 0.33;
              const cy = (nRows - 1 - ai) * CELL_H + CELL_H / 2;
              const color = speedColor(cell.speed);
              const rot = cell.direction + 90;
              return (
                <g key={`c${hi}-${ai}`}>
                  <g transform={`translate(${cx},${cy}) rotate(${rot})`}>
                    <path d={ARROW} fill={color} />
                  </g>
                  <text
                    x={cx + 13} y={cy}
                    dominantBaseline="middle" fontSize={7.5}
                    fill={color} fontWeight={600}
                  >
                    {cell.speed}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
      </div>
      <div className="wg-legend">
        {(
          [
            ["#22c55e", "<10"],
            ["#65a30d", "10-18"],
            ["#ca8a04", "18-25"],
            ["#ea580c", "25-35"],
            ["#dc2626", "35-50"],
            ["#be123c", "50-65"],
            ["#9333ea", ">65"],
          ] as [string, string][]
        ).map(([color, label]) => (
          <span key={label} className="wg-legend-item">
            <span className="wg-legend-dot" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="wg-legend-item">km/h</span>
      </div>
    </div>
  );
}
