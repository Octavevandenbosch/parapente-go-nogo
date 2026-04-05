"""Paragliding sites module using ParaglidingEarth API."""

import xml.etree.ElementTree as ET
from math import radians, cos

import requests

PGE_API_URL = "https://www.paragliding.earth/api/getBoundingBoxSites.php"

ORIENTATION_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
ORIENTATION_QUALITY = {0: "non adapté", 1: "possible", 2: "bon"}
ORIENTATION_DEGREES = {
    "N": 0, "NE": 45, "E": 90, "SE": 135,
    "S": 180, "SW": 225, "W": 270, "NW": 315,
}


def _bbox_from_center(lat: float, lng: float, radius_km: float) -> dict:
    """Compute a bounding box around a center point."""
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * cos(radians(lat)))
    return {
        "north": lat + lat_delta,
        "south": lat - lat_delta,
        "east": lng + lng_delta,
        "west": lng - lng_delta,
    }


def _parse_orientations(takeoff_el: ET.Element) -> dict:
    """Parse wind orientation ratings from a takeoff XML element."""
    orientations = {}
    orient_el = takeoff_el.find("orientations")
    if orient_el is None:
        return orientations
    for label in ORIENTATION_LABELS:
        val = orient_el.findtext(label)
        if val is not None:
            orientations[label] = int(val)
    return orientations


def _parse_landing(landing_el: ET.Element) -> dict | None:
    """Parse landing info from XML."""
    if landing_el is None:
        return None
    return {
        "name": landing_el.findtext("landing_name", ""),
        "latitude": _float(landing_el.findtext("landing_lat")),
        "longitude": _float(landing_el.findtext("landing_lng")),
        "altitude": _float(landing_el.findtext("landing_altitude")),
        "description": landing_el.findtext("landing_description", ""),
    }


def _float(val: str | None) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def fetch_sites(lat: float, lng: float, radius_km: float = 25, limit: int = 15) -> list[dict]:
    """Fetch paragliding sites near a GPS point.

    Returns a list of site dicts with takeoff info, orientations, and landing.
    """
    bbox = _bbox_from_center(lat, lng, radius_km)
    resp = requests.get(PGE_API_URL, params={
        **bbox,
        "limit": limit,
        "style": "detailled",
    }, timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    sites = []

    for takeoff in root.findall("takeoff"):
        is_pg = takeoff.findtext("paragliding", "0")
        if is_pg != "1":
            continue

        orientations = _parse_orientations(takeoff)
        landing = _parse_landing(root.find("landing"))

        site = {
            "name": takeoff.findtext("name", "Unknown"),
            "country": takeoff.findtext("countryCode", ""),
            "latitude": _float(takeoff.findtext("lat")),
            "longitude": _float(takeoff.findtext("lng")),
            "altitude": _float(takeoff.findtext("takeoff_altitude")),
            "description": takeoff.findtext("takeoff_description", ""),
            "orientations": orientations,
            "flight_rules": takeoff.findtext("flight_rules", ""),
            "comments": takeoff.findtext("comments", ""),
            "pge_link": takeoff.findtext("pge_link", ""),
            "landing": landing,
        }
        sites.append(site)

    return sites


def best_orientations(orientations: dict) -> list[str]:
    """Return the list of 'good' (rating=2) wind directions for a site."""
    return [d for d, v in orientations.items() if v == 2]


def acceptable_orientations(orientations: dict) -> list[str]:
    """Return directions rated 'possible' (1) or 'good' (2)."""
    return [d for d, v in orientations.items() if v >= 1]
