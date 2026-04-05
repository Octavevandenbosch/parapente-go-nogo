import { useMemo } from "react";
import { distanceKm } from "../utils/geo";
import { THRESHOLDS } from "../config";
import type { Site, Balise } from "../types";

interface NearestBaliseResult {
  balise: Balise;
  distanceKm: number;
}

export function useNearestBalise(
  site: Site | null,
  balises: Balise[]
): NearestBaliseResult | null {
  return useMemo(() => {
    if (!site) return null;

    let best: Balise | null = null;
    let bestDist = Infinity;

    for (const b of balises) {
      const d = distanceKm(site.latitude, site.longitude, b.latitude, b.longitude);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }

    if (!best || bestDist > THRESHOLDS.MAX_BALISE_DISTANCE_KM) return null;
    return { balise: best, distanceKm: bestDist };
  }, [site, balises]);
}
