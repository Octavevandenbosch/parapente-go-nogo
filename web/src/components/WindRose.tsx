import type { CompassDirection, BaliseWind } from "../types";
import { dirLabel, windDirToCompass } from "../utils/wind";

const DIRECTIONS: { dir: CompassDirection; angle: number }[] = [
  { dir: "N", angle: -90 },
  { dir: "NE", angle: -45 },
  { dir: "E", angle: 0 },
  { dir: "SE", angle: 45 },
  { dir: "S", angle: 90 },
  { dir: "SW", angle: 135 },
  { dir: "W", angle: 180 },
  { dir: "NW", angle: -135 },
];

const DIR_TO_ANGLE: Record<string, number> = {
  N: -90, NE: -45, E: 0, SE: 45,
  S: 90, SW: 135, W: 180, NW: -135,
};

const SECTOR_HALF = 22.5;
const GAP_DEG = 1.5;

interface AltWind {
  direction: number;
  speed: number;
  altitude: number;
}

interface WindRoseProps {
  orientations: Partial<Record<string, number>>;
  size?: number;
  currentWind?: string;
  baliseWind?: BaliseWind | null;
  altWind?: AltWind | null;
}

function sectorPath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg * Math.PI) / 180;
  const x1 = cx + Math.cos(s) * r;
  const y1 = cy + Math.sin(s) * r;
  const x2 = cx + Math.cos(e) * r;
  const y2 = cy + Math.sin(e) * r;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

function Arrow({
  cx, cy, angleDeg, length, color, label,
}: {
  cx: number; cy: number; angleDeg: number; length: number;
  color: string; label: string;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const tipX = cx + Math.cos(rad) * length;
  const tipY = cy + Math.sin(rad) * length;
  const wingLen = 7;
  const wingAngle = 0.5;
  const w1x = tipX - Math.cos(rad - wingAngle) * wingLen;
  const w1y = tipY - Math.sin(rad - wingAngle) * wingLen;
  const w2x = tipX - Math.cos(rad + wingAngle) * wingLen;
  const w2y = tipY - Math.sin(rad + wingAngle) * wingLen;

  const labelR = length + 11;
  const lx = cx + Math.cos(rad) * labelR;
  const ly = cy + Math.sin(rad) * labelR;

  return (
    <g>
      <line
        x1={cx} y1={cy} x2={tipX} y2={tipY}
        stroke={color} strokeWidth={2.5} strokeLinecap="round"
      />
      <polygon
        points={`${tipX},${tipY} ${w1x},${w1y} ${w2x},${w2y}`}
        fill={color}
      />
      <text
        x={lx} y={ly}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={8} fontWeight={700} fill={color}
      >
        {label}
      </text>
    </g>
  );
}

export function WindRose({ orientations, size = 120, currentWind, baliseWind, altWind }: WindRoseProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;

  const forecastDir = altWind ? windDirToCompass(altWind.direction) : currentWind;
  const forecastAngle = altWind ? (altWind.direction - 90) : (currentWind ? DIR_TO_ANGLE[currentWind] : null);
  const forecastAlt = altWind?.altitude ?? null;

  const meteoVal = forecastDir ? (orientations[forecastDir] ?? 0) : 0;
  const meteoMatch = meteoVal === 2 ? "good" : meteoVal === 1 ? "ok" : "bad";

  const baliseCompass = baliseWind ? dirLabel(baliseWind.direction) : null;
  const baliseAngleSvg = baliseWind ? (baliseWind.direction - 90) : null;
  const baliseVal = baliseCompass ? (orientations[baliseCompass] ?? 0) : 0;
  const baliseMatch = baliseVal === 2 ? "good" : baliseVal === 1 ? "ok" : "bad";

  return (
    <div className="windrose-wrapper">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#475569" strokeWidth={0.5} opacity={0.2}
        />

        {/* Colored sectors */}
        {DIRECTIONS.map(({ dir, angle }) => {
          const val = orientations[dir] ?? 0;
          const startDeg = angle - SECTOR_HALF + GAP_DEG;
          const endDeg = angle + SECTOR_HALF - GAP_DEG;

          let fill: string;
          let opacity: number;
          if (val === 2) {
            fill = "#22c55e";
            opacity = 0.55;
          } else if (val === 1) {
            fill = "#f59e0b";
            opacity = 0.3;
          } else {
            fill = "#475569";
            opacity = 0.08;
          }

          const rad = (angle * Math.PI) / 180;
          const labelDist = r + 13;
          const labelX = cx + Math.cos(rad) * labelDist;
          const labelY = cy + Math.sin(rad) * labelDist;

          const isHighlight = forecastDir === dir || baliseCompass === dir;

          return (
            <g key={dir}>
              <path
                d={sectorPath(cx, cy, r, startDeg, endDeg)}
                fill={fill}
                opacity={opacity}
                stroke={val > 0 ? fill : "none"}
                strokeWidth={val > 0 ? 1 : 0}
                strokeOpacity={0.4}
              />
              <text
                x={labelX} y={labelY}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={val > 0 ? 11 : 10}
                fontWeight={isHighlight ? 800 : val === 2 ? 700 : 400}
                fill={
                  forecastDir === dir
                    ? "#60a5fa"
                    : baliseCompass === dir
                      ? "#fb923c"
                      : val === 2
                        ? "#4ade80"
                        : val === 1
                          ? "#fbbf24"
                          : "#64748b"
                }
              >
                {dir}
              </text>
            </g>
          );
        })}

        {/* Cross-hairs for orientation */}
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#475569" strokeWidth={0.3} opacity={0.15} />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#475569" strokeWidth={0.3} opacity={0.15} />

        {/* Balise wind arrow */}
        {baliseAngleSvg != null && (
          <Arrow
            cx={cx} cy={cy}
            angleDeg={baliseAngleSvg}
            length={r * 0.65}
            color="#f97316"
            label={`${baliseWind!.speed}`}
          />
        )}

        {/* Forecast wind arrow */}
        {forecastAngle != null && (
          <Arrow
            cx={cx} cy={cy}
            angleDeg={forecastAngle}
            length={r * 0.85}
            color="#3b82f6"
            label=""
          />
        )}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill="#94a3b8" />
      </svg>

      <div className="windrose-legend">
        <div className="windrose-legend-row">
          <span className="wrl-swatch wrl-swatch-go" />
          <span>Idéal</span>
        </div>
        <div className="windrose-legend-row">
          <span className="wrl-swatch wrl-swatch-marginal" />
          <span>Acceptable</span>
        </div>
        {forecastDir && (
          <div className="windrose-legend-row">
            <span className="wrl-arrow-dot" style={{ background: "#3b82f6" }} />
            <span>
              Prévision {forecastDir}
              {forecastAlt ? ` (${forecastAlt}m)` : " 10m sol"}
              {meteoMatch === "good" ? " ✓" : meteoMatch === "ok" ? " ~" : " ✗"}
            </span>
          </div>
        )}
        {baliseWind && baliseCompass && (
          <div className="windrose-legend-row">
            <span className="wrl-arrow-dot" style={{ background: "#f97316" }} />
            <span>
              Balise {baliseCompass} {baliseWind.speed}km/h
              {baliseMatch === "good" ? " ✓" : baliseMatch === "ok" ? " ~" : " ✗"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
