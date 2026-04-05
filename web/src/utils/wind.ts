import type { CompassDirection } from "../types";

export const COMPASS_DIRS: CompassDirection[] = [
  "N", "NE", "E", "SE", "S", "SW", "W", "NW",
];

export function windDirToCompass(degrees: number): CompassDirection {
  const idx = Math.round(degrees / 45) % 8;
  return COMPASS_DIRS[idx];
}

export function dirLabel(deg: number): string {
  return COMPASS_DIRS[Math.round(deg / 45) % 8];
}

const ORIENTATION_BITS: { bit: number; dir: CompassDirection }[] = [
  { bit: 1, dir: "N" },
  { bit: 2, dir: "NE" },
  { bit: 4, dir: "E" },
  { bit: 8, dir: "SE" },
  { bit: 16, dir: "S" },
  { bit: 32, dir: "SW" },
  { bit: 64, dir: "W" },
  { bit: 128, dir: "NW" },
];

export function decodeOrientations(
  favo: number,
  defavo: number | null
): Partial<Record<string, number>> {
  const hasDefavo = defavo != null && defavo > 0;
  const result: Partial<Record<string, number>> = {};
  for (const { bit, dir } of ORIENTATION_BITS) {
    if (favo & bit) result[dir] = 2;
    else if (hasDefavo && !(defavo! & bit)) result[dir] = 1;
    else result[dir] = 0;
  }
  return result;
}
