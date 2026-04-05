# Parapente Go/No-Go

Outil CLI pour évaluer si les conditions de vol en parapente sont réunies sur les sites proches d'une région donnée.

## Sources de données

- **ParaglidingEarth API** — Sites de vol (décollages, atterrissages, orientations)
- **Open-Meteo API** (modèle Météo-France AROME) — Prévisions météo horaires
- **FFVL API** *(optionnel, clé requise)* — Sites français + balises météo temps réel

## Installation

```bash
pip install -r requirements.txt
```

## Utilisation

```bash
python main.py "Annecy"
python main.py "Millau" --radius 30
python main.py "Chamonix" --days 2
```

## Critères Go/No-Go évalués

| Critère | Go | No-Go |
|---|---|---|
| Vent | 5–25 km/h | > 30 km/h |
| Direction vent | Face au déco | Vent arrière / travers |
| Rafales | < vent moyen + 10 km/h | Rafales fortes |
| Pluie | 0 mm | Pluie |
| Orages | Aucun < 30 km | Orage proche |
| Visibilité | > 1.5 km | Brouillard |
| Couverture nuageuse | < 80% | Plafond bas |
