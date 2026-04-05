"""Weather forecast module using Open-Meteo API (Météo-France AROME model)."""

from datetime import datetime, timedelta

import requests

FORECAST_URL = "https://api.open-meteo.com/v1/meteofrance"

HOURLY_PARAMS = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "precipitation",
    "rain",
    "weather_code",
    "cloud_cover",
    "visibility",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "pressure_msl",
]

# WMO weather codes that indicate thunderstorms
THUNDERSTORM_CODES = {95, 96, 99}
RAIN_CODES = {51, 53, 55, 61, 63, 65, 80, 81, 82}


def fetch_forecast(lat: float, lng: float, days: int = 2) -> list[dict]:
    """Fetch hourly weather forecast for a location.

    Returns a list of hourly weather dicts for the requested number of days.
    """
    resp = requests.get(FORECAST_URL, params={
        "latitude": lat,
        "longitude": lng,
        "hourly": ",".join(HOURLY_PARAMS),
        "forecast_days": min(days, 4),
        "timezone": "auto",
        "wind_speed_unit": "kmh",
    }, timeout=15)
    resp.raise_for_status()

    data = resp.json()
    hourly = data.get("hourly", {})
    times = hourly.get("time", [])

    forecasts = []
    for i, t in enumerate(times):
        forecasts.append({
            "time": t,
            "temperature": hourly["temperature_2m"][i],
            "humidity": hourly["relative_humidity_2m"][i],
            "dew_point": hourly["dew_point_2m"][i],
            "precipitation": hourly["precipitation"][i],
            "rain": hourly["rain"][i],
            "weather_code": hourly["weather_code"][i],
            "cloud_cover": hourly["cloud_cover"][i],
            "visibility": hourly["visibility"][i],
            "wind_speed": hourly["wind_speed_10m"][i],
            "wind_direction": hourly["wind_direction_10m"][i],
            "wind_gusts": hourly["wind_gusts_10m"][i],
            "pressure": hourly["pressure_msl"][i],
        })
    return forecasts


def filter_flyable_hours(forecasts: list[dict], start_hour: int = 8, end_hour: int = 19) -> list[dict]:
    """Keep only daytime hours (default 8h-19h) which are relevant for flying."""
    filtered = []
    for f in forecasts:
        hour = int(f["time"].split("T")[1].split(":")[0])
        if start_hour <= hour <= end_hour:
            filtered.append(f)
    return filtered


def estimate_cloud_base(temperature: float, dew_point: float, station_altitude: float = 0) -> float:
    """Estimate cloud base height in meters AGL.

    Uses the rule: cloud base ≈ (T - Td) * 125 + station altitude.
    """
    spread = temperature - dew_point
    return spread * 125 + station_altitude


def has_thunderstorm(weather_code: int) -> bool:
    return weather_code in THUNDERSTORM_CODES


def has_rain(weather_code: int) -> bool:
    return weather_code in RAIN_CODES or weather_code in THUNDERSTORM_CODES
