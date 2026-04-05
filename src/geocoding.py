"""Geocoding module using Open-Meteo Geocoding API."""

import requests

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"


def geocode(query: str) -> dict | None:
    """Convert a place name to GPS coordinates.

    Returns dict with keys: name, latitude, longitude, country, elevation
    or None if not found.
    """
    resp = requests.get(GEOCODING_URL, params={
        "name": query,
        "count": 1,
        "language": "fr",
        "format": "json",
    }, timeout=10)
    resp.raise_for_status()

    data = resp.json()
    results = data.get("results")
    if not results:
        return None

    r = results[0]
    return {
        "name": r.get("name", query),
        "latitude": r["latitude"],
        "longitude": r["longitude"],
        "country": r.get("country", ""),
        "elevation": r.get("elevation"),
    }
