"""Go/No-Go decision engine for paragliding flights."""

from .sites import ORIENTATION_DEGREES, acceptable_orientations, best_orientations
from .weather import estimate_cloud_base, has_rain, has_thunderstorm


WIND_SPEED_MAX = 30          # km/h absolute no-go
WIND_SPEED_IDEAL_MAX = 25    # km/h upper comfort limit
WIND_SPEED_IDEAL_MIN = 5     # km/h lower limit (too calm = no lift)
GUST_SPREAD_MAX = 15         # km/h max difference gusts - average
VISIBILITY_MIN = 1500        # meters
CLOUD_COVER_MAX = 85         # percent
CLOUD_BASE_MIN = 300         # meters AGL minimum
RAIN_MAX = 0.0               # mm — any rain is no-go

VERDICT_GO = "GO"
VERDICT_MARGINAL = "MARGINAL"
VERDICT_NOGO = "NO-GO"


def _wind_dir_to_compass(degrees: float) -> str:
    """Convert wind direction in degrees to nearest compass label."""
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = round(degrees / 45) % 8
    return directions[idx]


def evaluate(site: dict, weather: dict) -> dict:
    """Evaluate go/no-go for a site given a weather snapshot.

    Returns a dict with:
      - verdict: GO / MARGINAL / NO-GO
      - checks: list of individual check results
      - cloud_base: estimated cloud base in meters AGL
    """
    checks = []
    orientations = site.get("orientations", {})
    takeoff_alt = site.get("altitude") or 0

    wind_speed = weather["wind_speed"]
    wind_dir_deg = weather["wind_direction"]
    wind_gusts = weather["wind_gusts"]
    wind_compass = _wind_dir_to_compass(wind_dir_deg)

    good_dirs = best_orientations(orientations)
    ok_dirs = acceptable_orientations(orientations)

    if wind_compass in good_dirs:
        checks.append(("ok", f"Vent {wind_compass} ({wind_dir_deg}°) — orientation idéale pour ce déco"))
    elif wind_compass in ok_dirs:
        checks.append(("warn", f"Vent {wind_compass} ({wind_dir_deg}°) — orientation acceptable mais pas idéale"))
    else:
        checks.append(("fail", f"Vent {wind_compass} ({wind_dir_deg}°) — orientation incompatible avec le déco"))

    if wind_speed > WIND_SPEED_MAX:
        checks.append(("fail", f"Vent {wind_speed} km/h — trop fort (max {WIND_SPEED_MAX})"))
    elif wind_speed > WIND_SPEED_IDEAL_MAX:
        checks.append(("warn", f"Vent {wind_speed} km/h — fort, prudence (idéal < {WIND_SPEED_IDEAL_MAX})"))
    elif wind_speed < WIND_SPEED_IDEAL_MIN:
        checks.append(("warn", f"Vent {wind_speed} km/h — très faible, peu de portance"))
    else:
        checks.append(("ok", f"Vent {wind_speed} km/h — dans la plage idéale"))

    gust_spread = wind_gusts - wind_speed
    if gust_spread > GUST_SPREAD_MAX:
        checks.append(("fail", f"Rafales {wind_gusts} km/h (écart {gust_spread:.0f}) — trop turbulent"))
    elif gust_spread > 10:
        checks.append(("warn", f"Rafales {wind_gusts} km/h (écart {gust_spread:.0f}) — un peu agité"))
    else:
        checks.append(("ok", f"Rafales {wind_gusts} km/h — modérées"))

    if has_thunderstorm(weather["weather_code"]):
        checks.append(("fail", "Orages prévus — vol interdit"))
    else:
        checks.append(("ok", "Pas d'orage prévu"))

    precip = weather.get("precipitation", 0) or 0
    rain = weather.get("rain", 0) or 0
    if rain > RAIN_MAX or precip > RAIN_MAX:
        checks.append(("fail", f"Précipitations {precip} mm — la voile perd ses performances"))
    else:
        checks.append(("ok", "Temps sec"))

    visibility = weather.get("visibility", 99999) or 99999
    if visibility < VISIBILITY_MIN:
        checks.append(("fail", f"Visibilité {visibility/1000:.1f} km — insuffisante (min {VISIBILITY_MIN/1000:.1f})"))
    else:
        checks.append(("ok", f"Visibilité {visibility/1000:.0f} km"))

    cloud_cover = weather.get("cloud_cover", 0) or 0
    if cloud_cover > CLOUD_COVER_MAX:
        checks.append(("warn", f"Couverture nuageuse {cloud_cover}% — plafond potentiellement bas"))
    else:
        checks.append(("ok", f"Couverture nuageuse {cloud_cover}%"))

    temp = weather.get("temperature", 15) or 15
    dew = weather.get("dew_point", 5) or 5
    cloud_base = estimate_cloud_base(temp, dew)
    if cloud_base < CLOUD_BASE_MIN:
        checks.append(("warn", f"Base nuages estimée ~{cloud_base:.0f}m AGL — vol limité en altitude"))
    else:
        checks.append(("ok", f"Base nuages estimée ~{cloud_base:.0f}m AGL"))

    fails = sum(1 for level, _ in checks if level == "fail")
    warns = sum(1 for level, _ in checks if level == "warn")

    if fails > 0:
        verdict = VERDICT_NOGO
    elif warns >= 3:
        verdict = VERDICT_MARGINAL
    else:
        verdict = VERDICT_GO

    return {
        "verdict": verdict,
        "checks": checks,
        "cloud_base": cloud_base,
        "wind_compass": wind_compass,
    }
