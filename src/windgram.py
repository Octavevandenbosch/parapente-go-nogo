"""Windgram — Profil de vent par altitude via Météo-Parapente (WRF)."""

import json
import math
import sys
import urllib.request

MP_STATUS = "https://data0.meteo-parapente.com/status.php"
MP_DATA = "https://data0.meteo-parapente.com/data.php"

COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def wind_dir_label(deg: float) -> str:
    return COMPASS[round(deg / 45) % 8]


def wind_from_uv(u: float, v: float) -> tuple[float, float]:
    speed = math.sqrt(u * u + v * v) * 3.6  # m/s → km/h
    direction = (math.atan2(-u, -v) * 180 / math.pi + 360) % 360
    return speed, direction


def get_latest_run(date: str) -> str:
    url = f"{MP_STATUS}?init={int(__import__('time').time() * 1000)}"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())

    entries = data.get("france", [])
    for entry in sorted(entries, key=lambda e: e["run"], reverse=True):
        if entry["day"] == date:
            return entry["run"]

    complete = [e for e in entries if e.get("status") == "complete"]
    if complete:
        return sorted(complete, key=lambda e: e["run"], reverse=True)[0]["run"]

    raise RuntimeError(f"Aucun run trouvé pour la date {date}")


def fetch_windgram(lat: float, lon: float, date: str, alt_max: int = 3000):
    run = get_latest_run(date)

    url = f"{MP_DATA}?run={run}&location={lat},{lon}&date={date}&plot=windgram"
    with urllib.request.urlopen(url) as resp:
        raw = json.loads(resp.read())

    data = raw.get("data", {})
    grid = raw.get("gridCoords", {})
    ter = None

    print(f"Windgram Météo-Parapente (WRF) — {lat}, {lon}")
    print(f"Run : {run}")
    print(f"Date : {date[:4]}-{date[4:6]}-{date[6:]}")
    if grid:
        print(f"Grille : domaine {grid.get('domain')}, lat={grid.get('lat')}, lon={grid.get('lon')}")
    print()

    for hour_str in sorted(data.keys()):
        hour_int = int(hour_str.split(":")[0])
        if hour_int < 6 or hour_int > 20:
            continue

        hd = data[hour_str]
        z = hd["z"]
        umet = hd["umet"]
        vmet = hd["vmet"]
        ter = hd.get("ter", ter)
        pblh = hd.get("pblh", 0)

        print(f"{'='*72}")
        print(f"  {hour_str} UTC   (terrain={ter:.0f}m, CLA={pblh:.0f}m AGL)")
        print(f"  {'Altitude':>10}  {'Vent':>10}  {'Direction':>12}")
        print(f"  {'-'*10}  {'-'*10}  {'-'*12}")

        for i, alt in enumerate(z):
            if alt > alt_max:
                break
            spd, d = wind_from_uv(umet[i], vmet[i])
            marker = " ◄ terrain" if ter and abs(alt - ter) < 30 else ""
            print(
                f"  {alt:>8.0f}m  {spd:>7.1f}km/h  "
                f"{d:>5.0f}° {wind_dir_label(d):<4}{marker}"
            )

        print()


def main():
    if len(sys.argv) < 4:
        print("Usage: python3 -m src.windgram <lat> <lon> <date YYYYMMDD> [alt_max]")
        print()
        print("Source : Météo-Parapente (modèle WRF)")
        print()
        print("Exemples:")
        print("  python3 -m src.windgram 45.3062 5.889 20260405")
        print("  python3 -m src.windgram 49.938 4.653 20260406 2000")
        sys.exit(1)

    lat = float(sys.argv[1])
    lon = float(sys.argv[2])
    date = sys.argv[3]
    alt_max = int(sys.argv[4]) if len(sys.argv) > 4 else 3000

    if len(date) != 8 or not date.isdigit():
        print(f"Format de date invalide : {date} (attendu : YYYYMMDD)")
        sys.exit(1)

    fetch_windgram(lat, lon, date, alt_max)


if __name__ == "__main__":
    main()
