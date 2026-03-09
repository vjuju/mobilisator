#!/usr/bin/env python3
"""
Export cities data to CSV with decisive round details.

Columns:
- slug, nom_standard, code_departement, libelle_departement
- tour_decisif
- 1ere/2eme liste: nom, nuance, bloc, libelle_nuance, tête de liste (nom + prénom), voix, % voix/exp
- population (majeurs arrondis), votes_decisifs, non_votants_18_39
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_FILE = ROOT / "public" / "cities" / "cities-data.json"
NUANCES_FILE = ROOT / "public" / "assets" / "nuances_politiques_2020.csv"
OUTPUT_FILE = ROOT / "utils" / "cities_export.csv"

FIELDNAMES = [
    "slug",
    "nom_standard",
    "code_departement",
    "libelle_departement",
    "tour_decisif",
    "1ere_liste_nom",
    "1ere_liste_nuance",
    "1ere_liste_bloc",
    "1ere_liste_libelle_nuance",
    "1ere_liste_tete_nom",
    "1ere_liste_tete_prenom",
    "1ere_liste_voix",
    "1ere_liste_pct_voix_exp",
    "2eme_liste_nom",
    "2eme_liste_nuance",
    "2eme_liste_bloc",
    "2eme_liste_libelle_nuance",
    "2eme_liste_tete_nom",
    "2eme_liste_tete_prenom",
    "2eme_liste_voix",
    "2eme_liste_pct_voix_exp",
    "population_majeurs",
    "votes_decisifs",
    "non_votants_18_39",
]

# Nuances absentes du fichier officiel
EXTRA_NUANCES = {
    "LNC": {"bloc": "AUT", "libelle": "Listes de non-candidats nationaux"},
}


def load_nuances(filepath):
    nuances = {}
    with open(filepath, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            nuances[row["nuance"]] = {"bloc": row["bloc"], "libelle": row["libelle"]}
    nuances.update(EXTRA_NUANCES)
    return nuances


def get_tour_data(city: dict, tour_num: int):
    key = f"Tour {tour_num}"
    return city.get(key)


def sorted_results(resultats: list) -> list:
    """Sort results by votes descending."""
    return sorted(resultats, key=lambda r: r.get("Voix", 0), reverse=True)


def build_row(city: dict, nuances: dict) -> dict:
    analyse = city.get("Analyse", {})
    tour_num = analyse.get("tour décisif", 1)
    tour_data = get_tour_data(city, tour_num)

    row = {
        "slug": city.get("slug", ""),
        "nom_standard": city.get("nom_standard", ""),
        "code_departement": city.get("code_departement", ""),
        "libelle_departement": city.get("libelle_departement", ""),
        "tour_decisif": tour_num,
        "population_majeurs": round(analyse.get("majeurs", 0)),
        "votes_decisifs": analyse.get("Votes décisifs", ""),
        "non_votants_18_39": round(analyse.get("Non votants de 18-39", 0)),
    }

    if tour_data:
        resultats = sorted_results(tour_data.get("resultats", []))
        for i, prefix in enumerate(["1ere", "2eme"]):
            if i < len(resultats):
                r = resultats[i]
                code_nuance = r.get("Code Nuance", "")
                nuance_info = nuances.get(code_nuance, {"bloc": "", "libelle": ""})
                row[f"{prefix}_liste_nom"] = r.get("Liste", "")
                row[f"{prefix}_liste_nuance"] = code_nuance
                row[f"{prefix}_liste_bloc"] = nuance_info["bloc"]
                row[f"{prefix}_liste_libelle_nuance"] = nuance_info["libelle"]
                row[f"{prefix}_liste_tete_nom"] = r.get("Nom", "")
                row[f"{prefix}_liste_tete_prenom"] = r.get("Prénom", "")
                row[f"{prefix}_liste_voix"] = r.get("Voix", "")
                row[f"{prefix}_liste_pct_voix_exp"] = r.get("% Voix/Exp", "")
            else:
                for field in ["nom", "nuance", "bloc", "libelle_nuance", "tete_nom", "tete_prenom", "voix", "pct_voix_exp"]:
                    row[f"{prefix}_liste_{field}"] = ""
    else:
        for prefix in ["1ere", "2eme"]:
            for field in ["nom", "nuance", "bloc", "libelle_nuance", "tete_nom", "tete_prenom", "voix", "pct_voix_exp"]:
                row[f"{prefix}_liste_{field}"] = ""

    return row


def main():
    print(f"Lecture de {NUANCES_FILE}...")
    nuances = load_nuances(NUANCES_FILE)

    print(f"Lecture de {DATA_FILE}...")
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    rows = []
    for city in data.values():
        rows.append(build_row(city, nuances))

    rows.sort(key=lambda r: (r["code_departement"], r["nom_standard"]))

    print(f"Export de {len(rows)} villes vers {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Done. {len(rows)} lignes exportées.")


if __name__ == "__main__":
    main()
