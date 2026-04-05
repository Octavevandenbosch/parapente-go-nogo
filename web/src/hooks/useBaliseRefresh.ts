import { useState, useCallback, useEffect, useRef } from "react";
import { fetchBalises } from "../services/spotair";
import { TIMING } from "../config";
import type { Balise } from "../types";

interface SearchParams {
  lat: number;
  lng: number;
  radius: number;
}

export function useBaliseRefresh() {
  const [balises, setBalises] = useState<Balise[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const paramsRef = useRef<SearchParams | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const params = paramsRef.current;
    if (!params) return;
    setIsRefreshing(true);
    try {
      const data = await fetchBalises(params.lat, params.lng, params.radius + 10);
      setBalises(data);
      setLastUpdate(new Date());
    } catch {
      // keep previous data on failure
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const startPolling = useCallback(
    (params: SearchParams, initialData: Balise[]) => {
      paramsRef.current = params;
      setBalises(initialData);
      setLastUpdate(new Date());

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(refresh, TIMING.BALISE_REFRESH_MS);
    },
    [refresh]
  );

  const reset = useCallback(() => {
    paramsRef.current = null;
    setBalises([]);
    setLastUpdate(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { balises, lastUpdate, isRefreshing, refresh, startPolling, reset };
}
