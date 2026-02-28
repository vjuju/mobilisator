# Mobilisator Analyzer

Analyse du jeu de données électoral Mobilisator via notebooks Jupyter et une app interactive Marimo.

## Structure

```
analyzer/
├── app.py                  # App Marimo interactive (dashboard)
├── requirements.txt        # Dépendances Python
├── notebooks/
│   ├── 01_exploration.ipynb    # Vue d'ensemble du dataset
│   ├── 02_abstention.ipynb     # Analyse de l'abstention
│   └── 03_partis.ipynb         # Résultats par nuance politique
├── outputs/                # Graphiques générés (PNG)
└── html/                   # Notebooks convertis en HTML (CI/CD)
```

## Lancer l'app Marimo (dashboard interactif)

```bash
pip install -r analyzer/requirements.txt

# Mode visualisation (téléphone / navigateur)
marimo run analyzer/app.py

# Mode édition (pour modifier l'app)
marimo edit analyzer/app.py
```

L'app sera accessible sur `http://localhost:2718` depuis n'importe quel navigateur,
y compris depuis un téléphone sur le même réseau local.

## Lancer les notebooks Jupyter

```bash
pip install -r analyzer/requirements.txt
jupyter notebook analyzer/notebooks/
```

## Résultats en ligne (GitHub Pages)

Les notebooks sont exécutés automatiquement à chaque push via GitHub Actions
et publiés en HTML sur GitHub Pages :

```
https://<org>.github.io/<repo>/analyzer/
```

## Données analysées

- **9 989 communes** françaises
- Résultats Tour 1 et Tour 2 (municipales)
- Données démographiques par âge et genre
- Indicateurs : abstention, non-votants 18-39, votes décisifs
