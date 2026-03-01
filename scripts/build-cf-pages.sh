#!/bin/bash
# Build script for Cloudflare Pages.
# Runs the JS build + Jupyter notebook execution + HTML export.
set -e

# ---------------------------------------------------------------------------
# 1. Ensure Bun is available (CF Pages environment doesn't include it natively)
# ---------------------------------------------------------------------------
if ! command -v bun &> /dev/null; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# ---------------------------------------------------------------------------
# 2. Build TypeScript app
# ---------------------------------------------------------------------------
echo "=== Building app.ts ==="
bun run build:app

# ---------------------------------------------------------------------------
# 3. Install Python dependencies
# ---------------------------------------------------------------------------
echo "=== Python environment ==="
python3 --version
python3 -m pip install -r analyzer/requirements.txt --quiet
echo "  jupyter importable: $(python3 -c 'import jupyter; print("yes")' 2>/dev/null || echo 'NO — pip install may have failed')"

# ---------------------------------------------------------------------------
# 4. Execute notebooks
# ---------------------------------------------------------------------------
echo "=== Executing notebooks ==="
mkdir -p /tmp/nb-executed

for nb in analyzer/notebooks/*.ipynb; do
  [ -f "$nb" ] || continue
  name=$(basename "$nb" .ipynb)
  echo "  → executing $name ..."
  if python3 -m jupyter nbconvert \
    --to notebook \
    --execute \
    --ExecutePreprocessor.timeout=300 \
    --output "/tmp/nb-executed/${name}.ipynb" \
    "$nb" 2>&1; then
    echo "    ✓ $name executed"
  else
    echo "    ✗ $name FAILED — skipping HTML conversion"
  fi
done

echo "Executed notebooks:"
ls -la /tmp/nb-executed/ 2>/dev/null || echo "  (none)"

# ---------------------------------------------------------------------------
# 5. Convert executed notebooks to HTML
# ---------------------------------------------------------------------------
echo "=== Converting notebooks to HTML ==="
mkdir -p public/analysis

for nb in /tmp/nb-executed/*.ipynb; do
  [ -f "$nb" ] || continue
  name=$(basename "$nb" .ipynb)
  echo "  → converting $name to HTML ..."
  python3 -m jupyter nbconvert \
    --to html \
    --no-input \
    --output-dir "public/analysis" \
    "$nb" && echo "    ✓ $name.html written" || echo "    ✗ HTML conversion failed for $name"
done

# ---------------------------------------------------------------------------
# 6. Generate analysis index page
# ---------------------------------------------------------------------------
echo "=== Generating analysis/index.html ==="
cat > public/analysis/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mobilisator — Analyses</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; }
    header { background: #1a56db; color: white; padding: 1.5rem 2rem; }
    header h1 { font-size: 1.5rem; font-weight: 700; }
    header p { opacity: 0.85; margin-top: 0.25rem; font-size: 0.9rem; }
    main { max-width: 860px; margin: 2rem auto; padding: 0 1rem; }
    .grid { display: grid; gap: 1rem; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem 1.5rem; text-decoration: none; color: inherit; display: block; transition: box-shadow .15s, border-color .15s; }
    .card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); border-color: #1a56db; }
    .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
    .card-header strong { font-size: 1rem; }
    .badge { font-size: 0.7rem; font-weight: 600; background: #dbeafe; color: #1e40af; padding: 2px 10px; border-radius: 12px; white-space: nowrap; }
    .card p { font-size: 0.875rem; color: #64748b; line-height: 1.5; }
    footer { text-align: center; margin: 3rem 0 2rem; font-size: 0.8rem; color: #94a3b8; }
    footer a { color: #1a56db; text-decoration: none; }
  </style>
</head>
<body>
  <header>
    <h1>Mobilisator — Analyses électorales</h1>
    <p>Notebooks Jupyter exécutés automatiquement sur les données des municipales (9 989 communes)</p>
  </header>
  <main>
    <div class="grid">
      <a class="card" href="01_exploration.html">
        <div class="card-header">
          <strong>01 — Exploration du jeu de données</strong>
          <span class="badge">Exploration</span>
        </div>
        <p>Vue d'ensemble des 9 989 communes : distributions de l'abstention, de la population, du nombre de listes. Statistiques descriptives globales. Classification démographique K-Means (6 clusters) par âge médian et taille de commune.</p>
      </a>
      <a class="card" href="02_abstention.html">
        <div class="card-header">
          <strong>02 — Analyse de l'abstention</strong>
          <span class="badge">Abstention</span>
        </div>
        <p>Abstention moyenne par département, corrélation avec la taille des communes, profil des non-votants 18–39 ans, comparaison Tour 1 / Tour 2.</p>
      </a>
      <a class="card" href="03_partis.html">
        <div class="card-header">
          <strong>03 — Résultats par nuance politique</strong>
          <span class="badge">Partis</span>
        </div>
        <p>Voix totales par nuance politique, nuance dominante par département, scores moyens selon la taille des communes.</p>
      </a>
    </div>
  </main>
  <footer>
    Données : <a href="https://www.data.gouv.fr">data.gouv.fr</a> &mdash;
    Généré automatiquement via GitHub Actions
  </footer>
</body>
</html>
HTMLEOF

echo "=== Build complete ==="
echo "Analysis pages:"
ls -la public/analysis/ || echo "(none generated)"
