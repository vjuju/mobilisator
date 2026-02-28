"""
Mobilisator Analyzer — Application Marimo
==========================================
Lance avec : marimo run analyzer/app.py
Édite avec  : marimo edit analyzer/app.py
"""

import marimo as mo

app = mo.App(title="Mobilisator — Analyse électorale", width="full")


@app.cell
def _():
    import json
    import pandas as pd
    import numpy as np
    import plotly.express as px
    from pathlib import Path

    DATA_FILE = Path(__file__).parent.parent / "public" / "cities" / "cities-data.json"
    with open(DATA_FILE) as f:
        raw = json.load(f)

    rows = []
    result_rows = []

    for c in raw.values():
        t1 = c.get("Tour 1", {})
        t2 = c.get("Tour 2")
        analyse = c.get("Analyse", {})
        pop = c.get("population", {})

        rows.append({
            "nom": c["nom_standard"],
            "slug": c["slug"],
            "code_dept": c["code_departement"],
            "dept": c["libelle_departement"],
            "t1_inscrits": t1.get("Inscrits"),
            "t1_pct_abs": t1.get("% Abs/Ins"),
            "t1_votants": t1.get("Votants"),
            "t1_exprimes": t1.get("Exprimés"),
            "t1_nb_listes": len(t1.get("resultats", [])),
            "a_tour2": t2 is not None,
            "t2_pct_abs": t2.get("% Abs/Ins") if t2 else None,
            "non_votants_1839": analyse.get("Non votants de 18-39"),
            "pop_1839": analyse.get("Pop 18-39"),
            "part_ne_votant_pas": analyse.get("Part ne votant pas"),
            "pop_totale": sum(pop.values()) if pop else None,
        })

        inscrits = t1.get("Inscrits", 0) or 1
        for r in t1.get("resultats", []):
            result_rows.append({
                "commune": c["nom_standard"],
                "dept": c["libelle_departement"],
                "nuance": r.get("Code Nuance", "?"),
                "voix": r.get("Voix", 0),
                "pct_exprimes": r.get("% Voix/Exp", 0),
                "inscrits": inscrits,
            })

    df = pd.DataFrame(rows)
    df_results = pd.DataFrame(result_rows)
    return df, df_results, px


@app.cell
def _(mo):
    mo.md("# Mobilisator — Analyse électorale des municipales")


@app.cell
def _(df, mo):
    moy_abs = df["t1_pct_abs"].mean()
    communes_t2 = int(df["a_tour2"].sum())
    total_nv = int(df["non_votants_1839"].sum())

    mo.hstack([
        mo.stat(f"{len(df):,}", label="Communes"),
        mo.stat(f"{df['t1_inscrits'].sum():,.0f}", label="Inscrits"),
        mo.stat(f"{moy_abs:.1f}%", label="Abstention moy. T1"),
        mo.stat(f"{communes_t2:,}", label="Communes avec T2"),
        mo.stat(f"{total_nv:,.0f}", label="Non-votants 18-39"),
    ])


@app.cell
def _(df, mo):
    depts = sorted(df["dept"].dropna().unique())
    dept_selector = mo.ui.multiselect(
        options=depts,
        label="Filtrer par département (vide = tous)",
        value=[],
    )
    dept_selector


@app.cell
def _(df, dept_selector):
    if dept_selector.value:
        df_sel = df[df["dept"].isin(dept_selector.value)].copy()
    else:
        df_sel = df.copy()
    df_sel


@app.cell
def _(df_sel, mo, px):
    mo.md("## Abstention par département")
    dept_abs = (
        df_sel.groupby("dept")["t1_pct_abs"]
        .mean()
        .reset_index()
        .sort_values("t1_pct_abs", ascending=True)
    )
    fig_abs = px.bar(
        dept_abs,
        x="t1_pct_abs",
        y="dept",
        orientation="h",
        color="t1_pct_abs",
        color_continuous_scale="RdYlGn_r",
        labels={"t1_pct_abs": "% Abstention", "dept": "Département"},
        title="Abstention moyenne (Tour 1) par département",
        height=max(400, len(dept_abs) * 22),
    )
    fig_abs.update_layout(coloraxis_showscale=False)
    mo.ui.plotly(fig_abs)


@app.cell
def _(df_sel, mo, px):
    mo.md("## Abstention vs taille de commune")
    df_sc = df_sel.dropna(subset=["t1_inscrits", "t1_pct_abs"])
    fig_sc = px.scatter(
        df_sc,
        x="t1_inscrits",
        y="t1_pct_abs",
        hover_name="nom",
        hover_data={"dept": True},
        color="t1_pct_abs",
        color_continuous_scale="RdYlGn_r",
        log_x=True,
        opacity=0.5,
        labels={"t1_inscrits": "Inscrits (log)", "t1_pct_abs": "% Abstention"},
        title="Abstention selon la taille de la commune",
        height=430,
    )
    fig_sc.update_traces(marker_size=4)
    fig_sc.update_layout(coloraxis_showscale=False)
    mo.ui.plotly(fig_sc)


@app.cell
def _(df_results, df_sel, mo, px):
    mo.md("## Voix par nuance politique")
    communes_sel = set(df_sel["nom"])
    df_res = df_results[df_results["commune"].isin(communes_sel)]
    nuances = (
        df_res.groupby("nuance")["voix"]
        .sum()
        .reset_index()
        .sort_values("voix", ascending=False)
    )
    nuances["pct"] = (nuances["voix"] / nuances["voix"].sum() * 100).round(1)
    fig_n = px.bar(
        nuances,
        x="nuance",
        y="voix",
        text=nuances["pct"].astype(str) + "%",
        color="voix",
        color_continuous_scale="Blues",
        labels={"nuance": "Nuance", "voix": "Total voix"},
        title="Voix totales par nuance politique (Tour 1)",
        height=400,
    )
    fig_n.update_traces(textposition="outside")
    fig_n.update_layout(coloraxis_showscale=False)
    mo.ui.plotly(fig_n)


@app.cell
def _(df_sel, mo, px):
    mo.md("## Non-votants 18–39 ans")
    df_j = df_sel.dropna(subset=["non_votants_1839", "pop_1839"]).copy()
    df_j = df_j[df_j["pop_1839"] > 0]
    df_j["pct_nv"] = df_j["non_votants_1839"] / df_j["pop_1839"] * 100
    dept_j = (
        df_j.groupby("dept")["pct_nv"]
        .mean()
        .reset_index()
        .sort_values("pct_nv", ascending=False)
    )
    fig_j = px.bar(
        dept_j,
        x="dept",
        y="pct_nv",
        color="pct_nv",
        color_continuous_scale="Reds",
        labels={"dept": "Département", "pct_nv": "% Non-votants 18-39"},
        title="% Non-votants 18–39 ans par département",
        height=420,
    )
    fig_j.update_layout(xaxis_tickangle=45, coloraxis_showscale=False)
    mo.ui.plotly(fig_j)


@app.cell
def _(df_sel, mo):
    mo.md("## Tableau détaillé")
    display_df = df_sel[[
        "nom", "dept", "t1_inscrits", "t1_pct_abs",
        "t2_pct_abs", "t1_nb_listes", "part_ne_votant_pas"
    ]].rename(columns={
        "nom": "Commune",
        "dept": "Département",
        "t1_inscrits": "Inscrits",
        "t1_pct_abs": "Abs T1 (%)",
        "t2_pct_abs": "Abs T2 (%)",
        "t1_nb_listes": "Listes T1",
        "part_ne_votant_pas": "Ne vote pas (%)",
    }).sort_values("Abs T1 (%)", ascending=False)
    mo.ui.table(display_df, pagination=True, selection=None)


if __name__ == "__main__":
    app.run()
