import type { Site } from "../types";

export function siteKey(s: Site): string {
  return `${s.latitude}-${s.longitude}-${s.name}`;
}

export function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLat = (lat2 - lat1) * 111;
  const dLng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function bboxFromCenter(lat: number, lng: number, radiusKm: number): BBox {
  const latD = radiusKm / 111;
  const lngD = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + latD,
    south: lat - latD,
    east: lng + lngD,
    west: lng - lngD,
  };
}

export function bboxToSpotairParams(bbox: BBox): Record<string, string> {
  return {
    nord: bbox.north.toString(),
    sud: bbox.south.toString(),
    est: bbox.east.toString(),
    ouest: bbox.west.toString(),
  };
}

export function deduplicateSites(spotair: Site[], pge: Site[]): Site[] {
  const seen = new Set<string>();
  const result: Site[] = [];

  for (const s of spotair) {
    const k = `${s.latitude.toFixed(3)}-${s.longitude.toFixed(3)}`;
    seen.add(k);
    result.push(s);
  }

  for (const s of pge) {
    const k = `${s.latitude.toFixed(3)}-${s.longitude.toFixed(3)}`;
    if (!seen.has(k)) {
      seen.add(k);
      result.push(s);
    }
  }

  return result;
}
