"""Parapente Go/No-Go — CLI entry point."""

import argparse
import sys

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from src.geocoding import geocode
from src.sites import fetch_sites, ORIENTATION_QUALITY
from src.weather import fetch_forecast, filter_flyable_hours
from src.gonogo import evaluate, VERDICT_GO, VERDICT_MARGINAL, VERDICT_NOGO

console = Console()

VERDICT_STYLES = {
    VERDICT_GO: ("bold green", "✓"),
    VERDICT_MARGINAL: ("bold yellow", "⚠"),
    VERDICT_NOGO: ("bold red", "✗"),
}
CHECK_ICONS = {"ok": "[green]✓[/]", "warn": "[yellow]⚠[/]", "fail": "[red]✗[/]"}


def _orientation_bar(orientations: dict) -> str:
    """Build a compact visual of wind orientations for a site."""
    parts = []
    for d in ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]:
        val = orientations.get(d, 0)
        if val == 2:
            parts.append(f"[green]{d}[/]")
        elif val == 1:
            parts.append(f"[yellow]{d}[/]")
    return " ".join(parts) if parts else "[dim]aucune info[/]"


def run(query: str, radius_km: float, days: int):
    console.print()
    console.print(f"[bold]Recherche de sites de parapente près de :[/] {query}")
    console.print()

    with console.status("Géocodage..."):
        location = geocode(query)
    if not location:
        console.print(f"[red]Lieu introuvable : {query}[/]")
        sys.exit(1)

    console.print(
        f"  📍 {location['name']}, {location['country']}  "
        f"({location['latitude']:.4f}, {location['longitude']:.4f})"
    )
    console.print()

    with console.status("Récupération des sites ParaglidingEarth..."):
        sites = fetch_sites(location["latitude"], location["longitude"], radius_km=radius_km)

    if not sites:
        console.print(f"[yellow]Aucun site trouvé dans un rayon de {radius_km} km[/]")
        sys.exit(0)

    console.print(f"  [bold]{len(sites)}[/] site(s) trouvé(s) dans un rayon de {radius_km} km")
    console.print()

    for site in sites:
        site_lat = site["latitude"] or location["latitude"]
        site_lng = site["longitude"] or location["longitude"]
        alt = site.get("altitude")
        alt_str = f"{alt:.0f}m" if alt else "?"

        header = Text()
        header.append(f"{site['name']}", style="bold")
        if alt:
            header.append(f"  {alt_str}", style="dim")

        orient_str = _orientation_bar(site["orientations"])

        landing = site.get("landing")
        if landing and landing.get("name"):
            landing_alt = landing.get("altitude")
            landing_info = landing["name"]
            if landing_alt:
                landing_info += f" ({landing_alt:.0f}m)"
        else:
            landing_info = "non renseigné"

        site_info = (
            f"  Orientations déco : {orient_str}\n"
            f"  Atterrissage : {landing_info}\n"
        )
        if site.get("description"):
            desc = site["description"][:200]
            site_info += f"  Description : [dim]{desc}[/]\n"
        if site.get("flight_rules"):
            rules = site["flight_rules"][:200]
            site_info += f"  Règles : [dim]{rules}[/]\n"

        console.print(Panel(site_info, title=header, border_style="blue"))

        with console.status(f"  Météo pour {site['name']}..."):
            forecasts = fetch_forecast(site_lat, site_lng, days=days)
            flyable = filter_flyable_hours(forecasts)

        if not flyable:
            console.print("  [dim]Aucune prévision disponible[/]")
            console.print()
            continue

        table = Table(show_header=True, header_style="bold", padding=(0, 1))
        table.add_column("Heure", style="cyan", width=18)
        table.add_column("Vent", width=14)
        table.add_column("Rafales", width=10)
        table.add_column("Dir.", width=6)
        table.add_column("Pluie", width=8)
        table.add_column("Nuages", width=8)
        table.add_column("Visi.", width=8)
        table.add_column("Verdict", width=12)

        for hour in flyable:
            result = evaluate(site, hour)
            verdict = result["verdict"]
            style, icon = VERDICT_STYLES[verdict]

            wind_str = f"{hour['wind_speed']:.0f} km/h"
            gust_str = f"{hour['wind_gusts']:.0f} km/h"
            rain_str = f"{hour['rain']:.1f} mm" if hour["rain"] else "—"
            cloud_str = f"{hour['cloud_cover']}%"
            vis_km = (hour["visibility"] or 99999) / 1000
            vis_str = f"{vis_km:.0f} km"

            table.add_row(
                hour["time"].replace("T", " "),
                wind_str,
                gust_str,
                result["wind_compass"],
                rain_str,
                cloud_str,
                vis_str,
                Text(f"{icon} {verdict}", style=style),
            )

        console.print(table)

        best_hours = [
            h for h in flyable
            if evaluate(site, h)["verdict"] == VERDICT_GO
        ]
        if best_hours:
            times = [h["time"].split("T")[1][:5] for h in best_hours[:5]]
            console.print(f"  [green]Meilleurs créneaux :[/] {', '.join(times)}")
        else:
            marginal_hours = [
                h for h in flyable
                if evaluate(site, h)["verdict"] == VERDICT_MARGINAL
            ]
            if marginal_hours:
                times = [h["time"].split("T")[1][:5] for h in marginal_hours[:5]]
                console.print(f"  [yellow]Créneaux marginaux :[/] {', '.join(times)}")
            else:
                console.print("  [red]Aucun créneau favorable[/]")

        console.print()
        if site.get("pge_link"):
            console.print(f"  [dim]→ {site['pge_link']}[/]")
        console.print()

    console.print(Panel(
        "[dim]Données sites : ParaglidingEarth (CC BY-SA 3.0)\n"
        "Données météo : Open-Meteo / Météo-France AROME\n"
        "⚠ Cet outil est une aide à la décision, pas un substitut au jugement du pilote.[/]",
        title="Sources",
        border_style="dim",
    ))


def main():
    parser = argparse.ArgumentParser(
        description="Parapente Go/No-Go — Évalue les conditions de vol sur les sites proches"
    )
    parser.add_argument("region", help="Nom de la région ou ville (ex: Annecy, Millau)")
    parser.add_argument("--radius", type=float, default=25, help="Rayon de recherche en km (défaut: 25)")
    parser.add_argument("--days", type=int, default=2, help="Nombre de jours de prévision (max 4, défaut: 2)")
    args = parser.parse_args()

    run(args.region, args.radius, args.days)


if __name__ == "__main__":
    main()
