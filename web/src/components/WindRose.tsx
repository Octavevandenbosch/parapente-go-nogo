import type { CompassDirection } from "../types";

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

const COLORS: Record<number, string> = {
  0: "#334155",
  1: "#f59e0b",
  2: "#22c55e",
};

function degToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export interface BaliseWind {
  direction: number;
  speed: number;
  name: string;
}

interface WindRoseProps {
  orientations: Partial<Record<string, number>>;
  size?: number;
  currentWind?: string;
  baliseWind?: BaliseWind | null;
}

function Arrow({
  cx, cy, angleDeg, length, color, strokeW = 2, wingLen = 6,
}: {
  cx: number; cy: number; angleDeg: number; length: number;
  color: string; strokeW?: number; wingLen?: number;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const tipX = cx + Math.cos(rad) * length;
  const tipY = cy + Math.sin(rad) * length;
  const wingAngle = 0.45;
  const w1x = tipX - Math.cos(rad - wingAngle) * wingLen;
  const w1y = tipY - Math.sin(rad - wingAngle) * wingLen;
  const w2x = tipX - Math.cos(rad + wingAngle) * wingLen;
  const w2y = tipY - Math.sin(rad + wingAngle) * wingLen;

  return (
    <g>
      <line
        x1={cx} y1={cy} x2={tipX} y2={tipY}
        stroke={color} strokeWidth={strokeW} strokeLinecap="round" opacity={0.9}
      />
      <polygon points={`${tipX},${tipY} ${w1x},${w1y} ${w2x},${w2y}`} fill={color} />
    </g>
  );
}

export function WindRose({ orientations, size = 100, currentWind, baliseWind }: WindRoseProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;
  const meteoAngle = currentWind ? DIR_TO_ANGLE[currentWind] : null;

  const meteoVal = currentWind ? (orientations[currentWind] ?? 0) : 0;
  const meteoMatch = meteoVal === 2 ? "good" : meteoVal === 1 ? "ok" : "bad";

  const baliseCompass = baliseWind ? degToCompass(baliseWind.direction) : null;
  const baliseAngleSvg = baliseWind ? (baliseWind.direction - 90) : null;
  const baliseVal = baliseCompass ? (orientations[baliseCompass] ?? 0) : 0;
  const baliseMatch = baliseVal === 2 ? "good" : baliseVal === 1 ? "ok" : "bad";

  return (
    <div className="windrose-wrapper">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#475569" strokeWidth={1} opacity={0.15} />
        <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="#475569" strokeWidth={0.5} opacity={0.1} />

        {DIRECTIONS.map(({ dir, angle }) => {
          const val = orientations[dir] ?? 0;
          const color = COLORS[val] ?? COLORS[0];
          const rad = (angle * Math.PI) / 180;
          const len = val === 2 ? r : val === 1 ? r * 0.65 : r * 0.25;
          const x = cx + Math.cos(rad) * len;
          const y = cy + Math.sin(rad) * len;
          const labelDist = r + 11;
          const labelX = cx + Math.cos(rad) * labelDist;
          const labelY = cy + Math.sin(rad) * labelDist;
          const isMeteo = currentWind === dir;
          const isBalise = baliseCompass === dir;

          return (
            <g key={dir}>
              <line
                x1={cx} y1={cy} x2={x} y2={y}
                stroke={color}
                strokeWidth={(isMeteo || isBalise) ? 3.5 : 2}
                strokeLinecap="round"
                opacity={val === 0 ? 0.15 : 0.85}
              />
              <text
                x={labelX} y={labelY}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={8}
                fontWeight={(isMeteo || isBalise) ? 700 : 400}
                fill={isMeteo ? "#3b82f6" : isBalise ? "#f97316" : val > 0 ? color : "#64748b"}
              >
                {dir}
              </text>
            </g>
          );
        })}

        {/* Balise arrow (orange, slightly shorter) */}
        {baliseAngleSvg != null && (
          <Arrow cx={cx} cy={cy} angleDeg={baliseAngleSvg} length={r * 0.7} color="#f97316" strokeW={2} wingLen={5} />
        )}

        {/* Météo arrow (blue, full length) */}
        {meteoAngle != null && (
          <Arrow cx={cx} cy={cy} angleDeg={meteoAngle} length={r * 0.85} color="#3b82f6" strokeW={2} wingLen={6} />
        )}

        <circle cx={cx} cy={cy} r={3} fill="#94a3b8" />
      </svg>
      <div className="windrose-legend">
        <div className="windrose-legend-row">
          <span className="wrl-bar" style={{ background: "#22c55e" }} />
          <span>Idéal</span>
        </div>
        <div className="windrose-legend-row">
          <span className="wrl-bar" style={{ background: "#f59e0b" }} />
          <span>Possible</span>
        </div>
        <div className="windrose-legend-row">
          <span className="wrl-bar" style={{ background: "#334155" }} />
          <span>Non adapté</span>
        </div>
        {currentWind && (
          <div className="windrose-legend-row">
            <span className="wrl-arrow" style={{ color: "#3b82f6" }}>→</span>
            <span>
              Prévision ({currentWind})
              {meteoMatch === "good" ? " ✓" : meteoMatch === "ok" ? " ⚠" : " ✗"}
            </span>
          </div>
        )}
        {baliseWind && baliseCompass && (
          <div className="windrose-legend-row">
            <span className="wrl-arrow" style={{ color: "#f97316" }}>→</span>
            <span>
              Balise ({baliseCompass} {baliseWind.speed}km/h)
              {baliseMatch === "good" ? " ✓" : baliseMatch === "ok" ? " ⚠" : " ✗"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
