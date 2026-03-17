// src/utils.ts
var normalizeText = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[''`]/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/\s+/g, "-").replace(/^-+|-+$/g, "").trim();

// src/format.ts
var messages = {
  codeIncorrect: "Code incorrect",
  rechercheEnCours: "Recherche en cours...",
  aucuneVille: "Aucune ville trouvée",
  erreurRecherche: "Erreur lors de la recherche",
  chargement: "Chargement...",
  villeNonTrouvee: "Ville non trouvée",
  erreurChargementVille: "Erreur lors du chargement de la ville",
  analyseNonDisponible: "Données d'analyse non disponibles pour cette ville"
};
var labels = {
  tableHeaders: {
    listeConduitePar: "Liste conduite par",
    voix: "Voix",
    pourcentInscrits: "% inscrits",
    pourcentExprimes: "% exprimés",
    siegesCM: "Sièges CM",
    siegesCC: "Sièges CC"
  },
  tour1: "1er tour",
  tour2: "2nd tour",
  modalTitles: {
    votesDecisifs: "Calcul des votes décisifs",
    nonVotants: "Calcul des non-votants 18-39 ans"
  },
  elu: "Élu",
  cta: {
    partager: "PARTAGE À TA COMMU",
    partagerEmoji: "\uD83D\uDCE3",
    rejoindre: "REJOINS LE MOUVEMENT",
    rejoindreEmoji: "✊"
  },
  stats: {
    jeunesNonVotants: "jeunes de 18-39 ans n'ont pas voté,<br>selon nos estimations",
    jeunesNonVotantsTerminee2026: "jeunes inscrits de 18-39 ans n'ont pas voté,<br>selon nos estimations",
    jeunesNonVotantsEnCours2026: "jeunes n'ont pas voté,<br>selon nos estimations"
  },
  detailLink: "Détail",
  sourceLabel: "Source :"
};
function getMainTagline2026(electionTerminee, votesDecisifs) {
  if (electionTerminee) {
    const verb2 = votesDecisifs === 1 ? "vote aurait pu" : "votes auraient pu";
    return `${verb2} faire la diff'<br>aux municipales en 2026`;
  }
  const verb = votesDecisifs === 1 ? "vote sépare" : "votes séparent";
  return `${verb}<br>les premiers candidats<br>au premier tour 2026`;
}
function formatFormulaDecisive2026Terminee(cityName, codeDepartement, firstPlaceVoix, exprimes, pourcentage, votesDecisifs, resultsTableHtml) {
  return `À ${cityName} (${codeDepartement}), la liste gagnante a remporté l'élection dès le premier tour du 15 mars 2026 avec ${pourcentage.toFixed(1)}% des suffrages exprimés (plus de 50%).
<br><br>
Pour forcer un second tour, il aurait fallu ajouter <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> votes supplémentaires aux autres listes — ce qui aurait ramené la liste de tête à 50% ou moins.
<br><br>
<strong>Formule :</strong> 2 × Voix de la 1ère liste − Total des exprimés
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste (V₁) : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Total des exprimés (Vₜ) : ${exprimes.toLocaleString("fr-FR")}
<br>• 2 × ${firstPlaceVoix.toLocaleString("fr-FR")} − ${exprimes.toLocaleString("fr-FR")} = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour 2026 :</strong>
${resultsTableHtml}`;
}
function formatFormulaDecisive2026Cas1(cityName, codeDepartement, firstPlaceVoix, votesDecisifs, resultsTableHtml) {
  return `À ${cityName} (${codeDepartement}), une seule liste était en lice au premier tour du 15 mars 2026.
<br><br>
Pour qu'une autre liste ait pu l'emporter, il aurait fallu qu'elle obtienne strictement plus de voix que la liste unique — soit au moins <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> nouveaux votes.
<br><br>
<strong>Formule :</strong> Voix de la liste unique + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la liste unique : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Votes nécessaires : ${firstPlaceVoix.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour 2026 :</strong>
${resultsTableHtml}`;
}
function formatFormulaDecisive2026EnCours(cityName, codeDepartement, firstPlaceVoix, secondPlaceVoix, votesDecisifs, resultsTableHtml) {
  const ecart = firstPlaceVoix - secondPlaceVoix;
  return `À ${cityName} (${codeDepartement}), aucune liste n'a obtenu la majorité absolue au premier tour du 15 mars 2026 : un second tour aura lieu le 22 mars.
<br><br>
${ecart.toLocaleString("fr-FR")} voix séparaient la 1ère et la 2e liste au premier tour. Il aurait fallu <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> votes supplémentaires pour la 2e liste pour passer devant.
<br><br>
<strong>Formule :</strong> (Voix de la 1ère liste − Voix de la 2e liste) + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste : ${secondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${secondPlaceVoix.toLocaleString("fr-FR")} = ${ecart.toLocaleString("fr-FR")}
<br>• Votes décisifs : ${ecart.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour 2026 :</strong>
${resultsTableHtml}`;
}
function formatExplanationNonVoting2026(cityName, codeDepartement, pop1839, abstentions2026, pop18Plus) {
  const taux = (abstentions2026 / pop18Plus * 100).toFixed(1);
  return `Au 1er tour des municipales 2026, ${cityName} (${codeDepartement}) comptait ${pop1839.toLocaleString("fr-FR")} jeunes de 18 à 39 ans. Le taux d'abstention officiel était de ${taux}% (${abstentions2026.toLocaleString("fr-FR")} abstentionnistes sur ${pop18Plus.toLocaleString("fr-FR")} majeur·es).`;
}
function formatFormulaNonVotants2026(explanationNonVoting, pop1839, pop18Plus, abstentions2026, nonVotants1839) {
  const part1839 = (pop1839 / pop18Plus * 100).toFixed(1);
  return `${explanationNonVoting}
<br><br>
<strong>Formule :</strong> Abstentions officielles × (Population 18-39 ans ÷ Population 18+ ans)
<br><br>
<strong>Détail :</strong>
<br>• Abstentions au 1er tour 2026 : ${abstentions2026.toLocaleString("fr-FR")}
<br>• Population 18-39 ans : ${pop1839.toLocaleString("fr-FR")}
<br>• Population 18+ ans : ${pop18Plus.toLocaleString("fr-FR")}
<br>• Part des 18-39 parmi les majeur·es : ${part1839}%
<br>• Non-votants 18-39 ans estimés : ${abstentions2026.toLocaleString("fr-FR")} × ${part1839}% = ${nonVotants1839.toLocaleString("fr-FR")}`;
}
function formatResultatRow2026(resultat, showCandidat) {
  return `<tr>
		<td>${resultat.Liste}</td>
		${showCandidat ? `<td>${resultat["Conduite par"]}</td>` : ""}
		<td>${resultat.Voix.toLocaleString("fr-FR")}</td>
		<td>${resultat["% Voix/Ins"].toFixed(2)}%</td>
		<td>${resultat["% Voix/Exp"].toFixed(2)}%</td>
		<td>${resultat["Sièges CM"]}</td>
		<td>${resultat["Sièges CC"]}</td>
	</tr>`;
}
function formatResultsTable2026(resultats) {
  const showCandidat = resultats.some((r) => r["Conduite par"]?.trim());
  const rows = resultats.map((r) => formatResultatRow2026(r, showCandidat)).join("");
  return `
		<div class="table-scroll-container">
			<table class="results-table">
				<thead>
					<tr>
						<th>Liste</th>
						${showCandidat ? "<th>Candidat·e</th>" : ""}
						<th>${labels.tableHeaders.voix}</th>
						<th>${labels.tableHeaders.pourcentInscrits}</th>
						<th>${labels.tableHeaders.pourcentExprimes}</th>
						<th>${labels.tableHeaders.siegesCM}</th>
						<th>${labels.tableHeaders.siegesCC}</th>
					</tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
		</div>
	`;
}
function formatAggregationWarning(communesAgregees) {
  if (!communesAgregees || communesAgregees.length === 0) {
    return "";
  }
  const communesList = communesAgregees.join(", ");
  return `
		<div class="aggregation-warning">
			ℹ️ Ces données regroupent les arrondissements : ${communesList}
		</div>
	`;
}
function formatCityDetailHtml(votesDecisifs, mainTagline, nonVotants1839, aggregationWarning, nonVotantsLabel, showShareButton, casNote) {
  const secondaryLabel = nonVotantsLabel ?? labels.stats.jeunesNonVotants;
  const casNoteHtml = casNote ? `<div class="cas-note">${casNote}</div>` : "";
  return `
        <div class="city-detail">
			${aggregationWarning}
			${casNoteHtml}

			<!-- Main Stat: Decisive Votes -->
			<div class="main-stat">

				<div class="main-number">${votesDecisifs.toLocaleString("fr-FR")}</div>
				<div class="main-label">${mainTagline}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('decisive'); return false;">${labels.detailLink}</a>
			</div>

            <!-- Secondary Stat: Non-Voting Youth -->
            <div class="secondary-stat">

                <div class="secondary-number">${nonVotants1839.toLocaleString("fr-FR")}</div>
                <div class="secondary-label">${secondaryLabel}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('nonVoting'); return false;">${labels.detailLink}</a>
            </div>

            <!-- CTA Buttons -->
            <div class="cta-section">
                ${showShareButton ? `<button type="button" class="cta-button" onclick="openHowPanel()">
                    JE VOTE LE 22 MARS<br>MODE D'EMPLOI<span class="emoji">\uD83D\uDDF3️</span>
                </button>` : ""}
                ${showShareButton ? `<button id="shareBtn" type="button" class="cta-button" onclick="openInfluPanel()">
                    J'INFORME MES POTES<span class="emoji">\uD83D\uDCE3</span>
                </button>` : ""}
                <button type="button" class="cta-button cta-button-green" onclick="openRejoinPanel()">
                    JE ME MOBILISE<br>AVEC ON EST PRÊT<span class="emoji">✊</span>
                </button>
            </div>

            <!-- Footer injected by JS -->
            <div class="city-detail-footer"></div>

        </div>
    `;
}
var nonVotingSourceUrl = "https://explore.data.gouv.fr/fr/datasets/6627b6fd7291f9d8a62d9997/#/resources/b8ad4a63-a4e3-4ef2-af6e-b08ef3b8084d";
var electionSourceUrl2026 = "https://www.resultats-elections.interieur.gouv.fr/municipales2026";
function formatSearchResultItem(id, name, codeDepartement) {
  return `
		<div class="result-item" onclick="navigateToCityById(${id})">
			<h3>${name} (${codeDepartement})</h3>
		</div>
	`;
}
function formatSearchInputValue(nomStandard, codeDepartement) {
  return `${nomStandard} (${codeDepartement})`;
}

// src/app.ts
var getBasePath = () => {
  const path = window.location.pathname;
  const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
  if (!firstSegment)
    return "/";
  const looksLikeCitySlug = /^([a-z]{1,3}|\d{1,3})-\d+/i.test(firstSegment);
  const looksLikeFile = firstSegment.includes(".");
  if (looksLikeCitySlug || looksLikeFile)
    return "/";
  return `/${firstSegment}/`;
};
var getAbsolutePath = (relativePath) => {
  const normalized = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return new URL(`${BASE_PATH}${normalized}`, window.location.origin).toString();
};
var BASE_PATH = getBasePath();
var searchTimeout = null;
var searchIndexCache = {};
var citiesDataCache = null;
var slugMapCache = null;
var currentInfluBlob = null;
var currentCityData = null;
function getPartitionKey(query) {
  const firstChar = query.charAt(0).toLowerCase();
  if (firstChar >= "a" && firstChar <= "z") {
    return firstChar;
  }
  return "0";
}
async function loadSearchPartition(partition) {
  if (searchIndexCache[partition]) {
    return searchIndexCache[partition];
  }
  const response = await fetch(`${BASE_PATH}cities/search-${partition}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load search partition ${partition}`);
  }
  const data = await response.json();
  searchIndexCache[partition] = data;
  return data;
}
async function loadCitiesData() {
  if (citiesDataCache) {
    return citiesDataCache;
  }
  const response = await fetch(`${BASE_PATH}cities/cities-data.json`);
  if (!response.ok) {
    throw new Error("Failed to load cities data");
  }
  citiesDataCache = await response.json();
  return citiesDataCache;
}
async function loadSlugMap() {
  if (slugMapCache) {
    return slugMapCache;
  }
  const response = await fetch(`${BASE_PATH}cities/slug-map.json`);
  if (!response.ok) {
    throw new Error("Failed to load slug map");
  }
  slugMapCache = await response.json();
  return slugMapCache;
}
function debounce(func, delay) {
  return () => {
    if (searchTimeout !== null) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = window.setTimeout(() => func(), delay);
  };
}
function initApp() {
  const navBrand = document.getElementById("navBrand");
  if (navBrand) {
    navBrand.addEventListener("click", (e) => {
      e.preventDefault();
      window.history.pushState({}, "", BASE_PATH);
      handleRoute();
    });
  }
  handleRoute();
  window.addEventListener("popstate", handleRoute);
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("focus", () => {
      searchInput.value = "";
      clearResults();
    });
    searchInput.addEventListener("input", debounce(() => {
      searchCities();
    }, 80));
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        if (searchTimeout !== null) {
          clearTimeout(searchTimeout);
        }
        searchCities();
      }
    });
  }
}
function updatePanelVisibility() {
  const params = new URLSearchParams(window.location.search);
  const jememobilise = params.get("jememobilise") === "true";
  const how = params.get("how") === "true";
  const agenda = params.get("agenda") === "true";
  const influ = params.get("influ") === "true";
  const jerejoins = params.get("jerejoins") === "true";
  const setHidden = (id, hide) => {
    const el = document.getElementById(id);
    if (el)
      el.classList.toggle("hidden", hide);
  };
  setHidden("howPanel", !(jememobilise && how && !agenda));
  setHidden("agendaPanel", !(jememobilise && how && agenda));
  setHidden("influPanel", !(jememobilise && influ && !jerejoins));
  setHidden("rejoinPanel", !(jememobilise && jerejoins));
  const anyPanelOpen = jememobilise && (how || influ || jerejoins);
  setHidden("navBrand", anyPanelOpen);
  setHidden("navBack", !anyPanelOpen);
}
async function handleRoute() {
  const path = window.location.pathname;
  const relativePath = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) : path.substring(1);
  updatePanelVisibility();
  if (relativePath === "" || relativePath === "index.html") {
    const cityDetailDiv = document.getElementById("cityDetail");
    if (cityDetailDiv)
      cityDetailDiv.innerHTML = "";
    const landingText = document.getElementById("landingText");
    if (landingText)
      landingText.classList.remove("hidden");
    const searchInput = document.getElementById("searchInput");
    document.title = "#RIENSANSNOUS - Municipales 2026";
    document.getElementById("canonicalTag")?.setAttribute("href", "https://mobilisator.fr/");
    const qParam = new URLSearchParams(window.location.search).get("q");
    if (qParam && searchInput) {
      searchInput.value = qParam;
      await searchCities();
    } else {
      if (searchInput)
        searchInput.value = "";
      clearResults();
    }
  } else {
    const landingText = document.getElementById("landingText");
    if (landingText)
      landingText.classList.add("hidden");
    const slug = relativePath.replace(".html", "");
    await loadCityBySlug(slug);
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("jememobilise") === "true" && params.get("influ") === "true" && params.get("jerejoins") !== "true") {
    const container = document.getElementById("influImageContainer");
    if (container && container.innerHTML === "") {
      container.innerHTML = getInfluLoadingHtml();
      shareCity();
    }
  }
}
function matomoTrack(category, action) {
  const paq = window._paq ?? [];
  if (currentCityData?.cityName) {
    paq.push(["setCustomDimension", 1, currentCityData.cityName]);
  }
  paq.push(["trackEvent", category, action, currentCityData?.cityName ?? ""]);
}
function openHowPanel() {
  matomoTrack("CTA", "comment_voter");
  const url = new URL(window.location.href);
  url.searchParams.set("jememobilise", "true");
  url.searchParams.set("how", "true");
  window.history.pushState({}, "", url.toString());
  updatePanelVisibility();
}
function openAgendaPanel() {
  matomoTrack("Comment voter", "agenda");
  const url = new URL(window.location.href);
  url.searchParams.set("jememobilise", "true");
  url.searchParams.set("how", "true");
  url.searchParams.set("agenda", "true");
  window.history.pushState({}, "", url.toString());
  updatePanelVisibility();
}
var getInfluLoadingHtml = () => `<div class="influ-loading">Image en cours de création<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;
async function openInfluPanel() {
  matomoTrack("CTA", "informer_potes");
  const container = document.getElementById("influImageContainer");
  if (container)
    container.innerHTML = getInfluLoadingHtml();
  const url = new URL(window.location.href);
  url.searchParams.set("jememobilise", "true");
  url.searchParams.set("influ", "true");
  window.history.pushState({}, "", url.toString());
  updatePanelVisibility();
  await shareCity();
}
function openRejoinPanel() {
  matomoTrack("CTA", "se_mobiliser");
  const url = new URL(window.location.href);
  url.searchParams.set("jememobilise", "true");
  url.searchParams.set("jerejoins", "true");
  window.history.pushState({}, "", url.toString());
  updatePanelVisibility();
}
function clearResults() {
  const results = document.getElementById("results");
  if (results)
    results.innerHTML = "";
}
async function searchCities() {
  const searchInput = document.getElementById("searchInput");
  const resultsDiv = document.getElementById("results");
  if (!searchInput || !resultsDiv)
    return;
  const query = searchInput.value;
  if (!query || query.trim().length < 2) {
    resultsDiv.innerHTML = "";
    return;
  }
  resultsDiv.innerHTML = `<p class="loading">${messages.rechercheEnCours}</p>`;
  try {
    const normalized = normalizeText(query);
    const partition = getPartitionKey(normalized);
    const searchIndex = await loadSearchPartition(partition);
    const citiesData = searchIndex[normalized];
    if (!citiesData || citiesData.length === 0) {
      resultsDiv.innerHTML = `<p class="error">${messages.aucuneVille}</p>`;
      return;
    }
    displaySearchResults(citiesData.slice(0, 50));
  } catch (error) {
    console.error("Search error:", error);
    resultsDiv.innerHTML = `<p class="error">${messages.erreurRecherche}</p>`;
  }
}
async function fetchCityById(id) {
  try {
    const citiesData = await loadCitiesData();
    return citiesData[id] || null;
  } catch (error) {
    console.error(`Error fetching city ${id}:`, error);
    return null;
  }
}
async function fetchCityBySlug(slug) {
  try {
    const slugMap = await loadSlugMap();
    const id = slugMap[slug];
    if (id === undefined)
      return null;
    return fetchCityById(id);
  } catch (error) {
    console.error(`Error fetching city ${slug}:`, error);
    return null;
  }
}
function displaySearchResults(cities) {
  const resultsDiv = document.getElementById("results");
  if (!resultsDiv)
    return;
  if (cities.length === 0) {
    resultsDiv.innerHTML = `<p class="error">${messages.aucuneVille}</p>`;
    return;
  }
  const html = cities.map((city) => {
    const [id, name, codeDepartement] = city;
    return formatSearchResultItem(id, name, codeDepartement);
  }).join("");
  resultsDiv.innerHTML = html;
}
async function navigateToCityById(id) {
  const city = await fetchCityById(id);
  if (city?.slug) {
    window.history.pushState({}, "", `${BASE_PATH}${city.slug}`);
    const paq = window._paq ?? [];
    paq.push(["setCustomUrl", window.location.href]);
    paq.push(["setDocumentTitle", city.nom_standard]);
    paq.push(["trackPageView"]);
    displayCityDetail(city);
    matomoTrack("Search", "ville_selectionnee");
    clearResults();
    const searchInput = document.getElementById("searchInput");
    if (searchInput)
      searchInput.value = formatSearchInputValue(city.nom_standard, city.code_departement);
  }
}
async function loadCityBySlug(slug) {
  const cityDetailDiv = document.getElementById("cityDetail");
  if (!cityDetailDiv)
    return;
  cityDetailDiv.innerHTML = `<p class="loading">${messages.chargement}</p>`;
  try {
    const city = await fetchCityBySlug(slug);
    if (!city) {
      cityDetailDiv.innerHTML = `<p class="error">${messages.villeNonTrouvee}</p>`;
      return;
    }
    displayCityDetail(city);
  } catch (error) {
    console.error("Error loading city:", error);
    cityDetailDiv.innerHTML = `<p class="error">${messages.erreurChargementVille}</p>`;
  }
}
function displayCityDetail(city) {
  const cityDetailDiv = document.getElementById("cityDetail");
  if (!cityDetailDiv)
    return;
  if (city.slug === "76-108-bois-guillaume") {
    const landingText2 = document.getElementById("landingText");
    if (landingText2)
      landingText2.classList.add("hidden");
    cityDetailDiv.innerHTML = `
			<div class="city-detail" style="text-align:center;padding:40px 20px;">
				<div class="main-number" style="font-size:clamp(1.2rem,4vw,2rem);line-height:1.3;margin-bottom:40px;">
					UN GRAND BRAVO À THÉO<br>ET L'ÉQUIPE D'IMAGINONS BOIS-GUILLAUME
				</div>
				<div style="display:flex;gap:16px;justify-content:center;align-items:center;flex-wrap:wrap;">
					<img src="${BASE_PATH}assets/chien.jpeg" alt="Chien" style="width:48%;max-width:320px;border-radius:12px;object-fit:cover;">
					<img src="${BASE_PATH}assets/copains.jpeg" alt="Copains" style="width:48%;max-width:320px;border-radius:12px;object-fit:cover;">
				</div>
			</div>`;
    document.title = "Bravo Théo ! | #RIENSANSNOUS";
    return;
  }
  const landingText = document.getElementById("landingText");
  if (landingText)
    landingText.classList.add("hidden");
  const searchInput = document.getElementById("searchInput");
  if (searchInput)
    searchInput.value = formatSearchInputValue(city.nom_standard, city.code_departement);
  if (!city.Analyse) {
    cityDetailDiv.innerHTML = `<p class="error">${messages.analyseNonDisponible}</p>`;
    return;
  }
  const tour1_2026 = city["2026"]?.["Tour 1"];
  const has2026 = !!tour1_2026;
  const paq = window._paq ?? [];
  paq.push(["setCustomDimension", 1, city.nom_standard]);
  const pop1839 = city.Analyse["Pop 18-39"];
  const pop18Plus = city.Analyse["Pop 18+"];
  const aggregationWarning = formatAggregationWarning(city.communesAgregees || []);
  let votesDecisifs = 0;
  let mainTagline = "";
  let nonVotants1839 = 0;
  let nonVotantsLabel = labels.stats.jeunesNonVotantsTerminee2026;
  let formulaDecisive = "";
  let formulaNonVotants = "";
  let electionSource = electionSourceUrl2026;
  if (has2026 && city.Analyse["Votes décisifs 2026"] !== undefined && city.Analyse["Non votants de 18-39 2026"] !== undefined) {
    const electionTerminee = city.Analyse["election terminee 2026"] ?? false;
    votesDecisifs = city.Analyse["Votes décisifs 2026"];
    nonVotants1839 = Math.round(city.Analyse["Non votants de 18-39 2026"]);
    mainTagline = getMainTagline2026(electionTerminee, votesDecisifs);
    nonVotantsLabel = electionTerminee ? labels.stats.jeunesNonVotantsTerminee2026 : labels.stats.jeunesNonVotantsEnCours2026;
    electionSource = electionSourceUrl2026;
    const resultats2026 = [...tour1_2026.resultats].sort((a, b) => b.Voix - a.Voix);
    const resultsTable2026 = formatResultsTable2026(resultats2026);
    const first = resultats2026[0];
    const second = resultats2026[1];
    if (!second) {
      formulaDecisive = formatFormulaDecisive2026Cas1(city.nom_standard, city.code_departement, first.Voix, votesDecisifs, resultsTable2026);
    } else if (electionTerminee) {
      const pourcentage = first["% Voix/Exp"];
      formulaDecisive = formatFormulaDecisive2026Terminee(city.nom_standard, city.code_departement, first.Voix, tour1_2026.Exprimés, pourcentage, votesDecisifs, resultsTable2026);
    } else {
      formulaDecisive = formatFormulaDecisive2026EnCours(city.nom_standard, city.code_departement, first.Voix, second.Voix, votesDecisifs, resultsTable2026);
    }
    const explanationNonVoting2026 = formatExplanationNonVoting2026(city.nom_standard, city.code_departement, pop1839, tour1_2026.Abstentions, pop18Plus);
    formulaNonVotants = formatFormulaNonVotants2026(explanationNonVoting2026, pop1839, pop18Plus, tour1_2026.Abstentions, nonVotants1839);
    currentCityData = {
      citySlug: city.slug,
      cityName: city.nom_standard,
      codeDepartement: city.code_departement,
      votesDecisifs,
      nonVotants1839,
      hasSecondTour: !electionTerminee
    };
  }
  document.title = `${city.nom_standard} — ${votesDecisifs.toLocaleString("fr-FR")} jeunes peuvent faire la diff' | #RIENSANSNOUS`;
  document.getElementById("canonicalTag")?.setAttribute("href", `https://mobilisator.fr/${city.slug}`);
  window.detailData = {
    decisive: {
      title: labels.modalTitles.votesDecisifs,
      formula: formulaDecisive,
      source: electionSource
    },
    nonVoting: {
      title: labels.modalTitles.nonVotants,
      formula: formulaNonVotants,
      source: nonVotingSourceUrl
    }
  };
  const electionTerminee2026 = city.Analyse["election terminee 2026"] ?? true;
  let casNote;
  if (has2026) {
    const resultats2026 = [...tour1_2026?.resultats ?? []].sort((a, b) => b.Voix - a.Voix);
    if (resultats2026.length <= 1) {
      const seul = resultats2026[0]?.["Conduite par"]?.trim() || resultats2026[0]?.Liste || "";
      casNote = seul ? `LA LISTE DE ${seul.toUpperCase()} ÉTAIT SEUL·E EN LICE` : "UNE SEULE LISTE ÉTAIT EN LICE AU 1ER TOUR.";
    } else if (electionTerminee2026) {
      const gagnant = resultats2026[0]["Conduite par"]?.trim() || resultats2026[0].Liste || "";
      casNote = `LA LISTE DE ${gagnant.toUpperCase()} A REMPORTÉ L'ÉLECTION`;
    } else {
      casNote = "LE SECOND TOUR A LIEU LE 22 MARS !";
    }
  }
  const html = formatCityDetailHtml(votesDecisifs, mainTagline, nonVotants1839, aggregationWarning, nonVotantsLabel, !electionTerminee2026, casNote);
  cityDetailDiv.innerHTML = html;
  const mainFooter = document.querySelector("footer.footer");
  const footerPlaceholder = cityDetailDiv.querySelector(".city-detail-footer");
  if (mainFooter && footerPlaceholder) {
    footerPlaceholder.appendChild(mainFooter.cloneNode(true));
  }
}
function openQomonModal() {
  openRejoinPanel();
}
function closeQomonModal() {
  window.history.back();
}
function openDetailModal(title, formula, sourceUrl) {
  let modal = document.getElementById("detailModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "detailModal";
    modal.className = "modal";
    modal.innerHTML = `
			<div class="modal-content detail-modal-content">
				<button type="button" class="modal-close" onclick="closeDetailModal()">&times;</button>
				<h3 class="detail-modal-title"></h3>
				<div class="detail-modal-formula"></div>
				<div class="detail-modal-source">
					<strong>Source :</strong><br>
					<a href="" target="_blank" class="source-link"></a>
				</div>
			</div>
		`;
    document.body.appendChild(modal);
  }
  const titleEl = modal.querySelector(".detail-modal-title");
  const formulaEl = modal.querySelector(".detail-modal-formula");
  const sourceLink = modal.querySelector(".detail-modal-source a");
  if (titleEl)
    titleEl.textContent = title;
  if (formulaEl)
    formulaEl.innerHTML = formula;
  if (sourceLink) {
    sourceLink.href = sourceUrl;
    sourceLink.textContent = sourceUrl;
  }
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeDetailModal() {
  const modal = document.getElementById("detailModal");
  if (modal) {
    modal.classList.remove("show");
    document.body.style.overflow = "";
  }
}
function openDetailModalByKey(key) {
  const data = window.detailData?.[key];
  if (data) {
    openDetailModal(data.title, data.formula, data.source);
  }
}
var getRejoinButtonHtml = () => `
	<button type="button" class="cta-button cta-button-green" onclick="openRejoinPanel()">
		JE ME MOBILISE<br>AVEC ON EST PRÊT<span class="emoji">✊</span>
	</button>
`;
var appendRejoinButtonWhenImageReady = (container, imageSelector = ".influ-image") => {
  const maybeAppend = () => {
    if (!container.querySelector(".influ-image"))
      return;
    if (container.querySelector("[data-rejoin-btn='true']"))
      return;
    container.insertAdjacentHTML("beforeend", `<div data-rejoin-btn="true">${getRejoinButtonHtml()}</div>`);
  };
  const img = container.querySelector(imageSelector);
  if (!img) {
    maybeAppend();
    return;
  }
  if (img.complete && img.naturalWidth > 0) {
    maybeAppend();
    return;
  }
  img.addEventListener("load", maybeAppend, { once: true });
  img.addEventListener("error", maybeAppend, { once: true });
};
function showShareModal(imageUrl, cityName) {
  const container = document.getElementById("influImageContainer");
  if (container) {
    container.innerHTML = `
			<div class="influ-title">Image générée \uD83C\uDF89</div>
			<img class="influ-image" src="${imageUrl}" alt="Image à partager">
			<div class="influ-actions">
				<button type="button" class="cta-button influ-copy-btn" onclick="copyInfluImage()">COPIER<span class="emoji">\uD83D\uDCCB</span></button>
				<a href="${imageUrl}" download="mobilisator-${cityName}.png" class="cta-button" style="text-decoration:none;">TÉLÉCHARGER<span class="emoji">\uD83D\uDCE5</span></a>
			</div>
		`;
    appendRejoinButtonWhenImageReady(container);
  }
}
function closeShareModal() {}
async function copyInfluImage() {
  if (!currentInfluBlob)
    return;
  const clipboardSupportsPng = navigator.clipboard && typeof ClipboardItem !== "undefined" && (typeof ClipboardItem.supports !== "function" || ClipboardItem.supports("image/png"));
  if (!clipboardSupportsPng)
    return;
  try {
    const pngBlob = await normalizeImageForClipboard(currentInfluBlob);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": Promise.resolve(pngBlob) })]);
    const btn = document.querySelector(".influ-copy-btn");
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = 'COPIÉ !<span class="emoji">✓</span>';
      setTimeout(() => {
        btn.innerHTML = orig;
      }, 2000);
    }
  } catch (e) {
    console.error("Clipboard error:", e);
  }
}
var normalizeImageForClipboard = async (blob) => {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blob.type === "image/png" ? blob : new Blob([await blob.arrayBuffer()], { type: "image/png" });
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const reencoded = await new Promise((resolve) => canvas.toBlob((pngBlob) => resolve(pngBlob), "image/png"));
    if (reencoded)
      return reencoded;
    return blob.type === "image/png" ? blob : new Blob([await blob.arrayBuffer()], { type: "image/png" });
  } catch {
    return blob.type === "image/png" ? blob : new Blob([await blob.arrayBuffer()], { type: "image/png" });
  }
};

class OgFetchError extends Error {
  attempts;
  constructor(message, attempts) {
    super(message);
    this.name = "OgFetchError";
    this.attempts = attempts;
  }
}
var safeResponsePreview = async (response) => {
  try {
    const text = await response.clone().text();
    return text.slice(0, 240).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
};
var canDecodeImageBlob = async (blob) => {
  try {
    const bitmap = await createImageBitmap(blob);
    bitmap.close();
    return true;
  } catch {
    return false;
  }
};
var createClientFallbackImageBlob = async (cityName, votesDecisifs) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0f1f19");
  gradient.addColorStop(1, "#000000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#5ECBA1";
  ctx.font = '700 54px "Arial Black", Arial, sans-serif';
  ctx.fillText("#RIENSANSNOUS", canvas.width / 2, 170);
  let cityFontSize = 96;
  ctx.font = `900 ${cityFontSize}px "Arial Black", Arial, sans-serif`;
  const cityUpper = cityName.toUpperCase();
  while (ctx.measureText(cityUpper).width > 900 && cityFontSize > 56) {
    cityFontSize -= 4;
    ctx.font = `900 ${cityFontSize}px "Arial Black", Arial, sans-serif`;
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(cityUpper, canvas.width / 2, 390);
  ctx.fillStyle = "#5ECBA1";
  ctx.font = '900 240px "Arial Black", Arial, sans-serif';
  ctx.fillText(votesDecisifs.toLocaleString("fr-FR"), canvas.width / 2, 860);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '700 48px "Arial Black", Arial, sans-serif';
  ctx.fillText("VOTES SÉPARENT LES FINALISTES", canvas.width / 2, 1010);
  {
    const y = 1080;
    const fontSize = 48;
    const supFontSize = 30;
    ctx.font = `700 ${fontSize}px "Arial Black", Arial, sans-serif`;
    const before = "DU 1";
    const sup = "ER";
    const after = " TOUR DES MUNICIPALES 2026";
    const wBefore = ctx.measureText(before).width;
    ctx.font = `700 ${supFontSize}px "Arial Black", Arial, sans-serif`;
    const wSup = ctx.measureText(sup).width;
    ctx.font = `700 ${fontSize}px "Arial Black", Arial, sans-serif`;
    const wAfter = ctx.measureText(after).width;
    const totalW = wBefore + wSup + wAfter;
    const startX = canvas.width / 2 - totalW / 2;
    ctx.textAlign = "left";
    ctx.fillText(before, startX, y);
    ctx.font = `700 ${supFontSize}px "Arial Black", Arial, sans-serif`;
    ctx.fillText(sup, startX + wBefore, y - 18);
    ctx.font = `700 ${fontSize}px "Arial Black", Arial, sans-serif`;
    ctx.fillText(after, startX + wBefore + wSup, y);
    ctx.textAlign = "center";
  }
  ctx.fillStyle = "#5ECBA1";
  ctx.font = '700 88px "Arial Black", Arial, sans-serif';
  ctx.fillText("JE VOTE", canvas.width / 2, 1330);
  ctx.fillText("LE 22 MARS.", canvas.width / 2, 1440);
  ctx.fillText("ET TOI ?", canvas.width / 2, 1540);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '700 46px "Arial Black", Arial, sans-serif';
  ctx.fillText("MOBILISATOR.FR", canvas.width / 2, 1690);
  const blob = await new Promise((resolve) => canvas.toBlob((pngBlob) => resolve(pngBlob), "image/png"));
  if (!blob) {
    throw new Error("Client fallback image generation failed");
  }
  return blob;
};
var buildOgCandidateUrls = (citySlug) => {
  const encodedSlug = encodeURIComponent(citySlug);
  return Array.from(new Set([
    new URL(`/og/${encodedSlug}.png`, window.location.origin).toString(),
    getAbsolutePath(`og/${encodedSlug}.png`),
    new URL(`/api/og/${encodedSlug}.png`, window.location.origin).toString(),
    getAbsolutePath(`api/og/${encodedSlug}.png`)
  ]));
};
var fetchOgImageWithDebug = async (citySlug) => {
  const attempts = [];
  let candidates = [];
  try {
    candidates = buildOgCandidateUrls(citySlug);
  } catch (error) {
    attempts.push({
      url: "(candidate-build)",
      finalUrl: "",
      status: 0,
      ok: false,
      contentType: "",
      contentLength: "",
      redirected: false,
      blobSize: 0,
      xOgImageMode: "",
      xOgSlug: citySlug,
      xOgError: `candidate build error: ${String(error)}`,
      bodyPreview: ""
    });
    throw new OgFetchError(`OG candidate URL build failed for slug "${citySlug}"`, attempts);
  }
  if (candidates.length === 0) {
    attempts.push({
      url: "(candidate-build)",
      finalUrl: "",
      status: 0,
      ok: false,
      contentType: "",
      contentLength: "",
      redirected: false,
      blobSize: 0,
      xOgImageMode: "",
      xOgSlug: citySlug,
      xOgError: "no OG candidate URL generated",
      bodyPreview: ""
    });
    throw new OgFetchError(`No OG candidate URL for slug "${citySlug}"`, attempts);
  }
  for (const url of candidates) {
    let response;
    try {
      response = await fetch(url, { redirect: "follow" });
    } catch (error) {
      attempts.push({
        url,
        finalUrl: "",
        status: 0,
        ok: false,
        contentType: "",
        contentLength: "",
        redirected: false,
        blobSize: 0,
        xOgImageMode: "",
        xOgSlug: "",
        xOgError: String(error),
        bodyPreview: ""
      });
      continue;
    }
    const contentType = response.headers.get("content-type") ?? "";
    const debug = {
      url,
      finalUrl: response.url,
      status: response.status,
      ok: response.ok,
      contentType,
      contentLength: response.headers.get("content-length") ?? "",
      redirected: response.redirected,
      blobSize: 0,
      xOgImageMode: response.headers.get("x-og-image-mode") ?? "",
      xOgSlug: response.headers.get("x-og-slug") ?? "",
      xOgError: response.headers.get("x-og-error") ?? "",
      bodyPreview: ""
    };
    if (!response.ok || !contentType.startsWith("image/")) {
      debug.bodyPreview = await safeResponsePreview(response);
      attempts.push(debug);
      continue;
    }
    const imageBlob = await response.blob();
    debug.blobSize = imageBlob.size;
    if (imageBlob.size === 0) {
      debug.bodyPreview = "empty image blob";
      attempts.push(debug);
      continue;
    }
    const decodable = await canDecodeImageBlob(imageBlob);
    if (!decodable) {
      debug.bodyPreview = "image blob decode failed";
      attempts.push(debug);
      continue;
    }
    attempts.push(debug);
    return { imageBlob, attempts, usedUrl: url };
  }
  throw new OgFetchError(`OG image fetch failed for slug "${citySlug}"`, attempts);
};
async function shareCity() {
  if (!currentCityData) {
    console.error("No city data available for sharing");
    return;
  }
  const { citySlug, cityName, votesDecisifs } = currentCityData;
  matomoTrack("Share", "partager");
  await new Promise((r) => setTimeout(r, 0));
  try {
    let imageBlob;
    let attempts = [];
    try {
      const fetched = await fetchOgImageWithDebug(citySlug);
      imageBlob = fetched.imageBlob;
      attempts = fetched.attempts;
      console.info("OG_DEBUG success", { citySlug, usedUrl: fetched.usedUrl, attempts });
    } catch (error) {
      attempts = error instanceof OgFetchError ? error.attempts : [
        {
          url: "(unknown)",
          finalUrl: "",
          status: 0,
          ok: false,
          contentType: "",
          contentLength: "",
          redirected: false,
          blobSize: 0,
          xOgImageMode: "",
          xOgSlug: citySlug,
          xOgError: String(error),
          bodyPreview: ""
        }
      ];
      const attemptsSummary = attempts.map((a) => ({
        url: a.url,
        finalUrl: a.finalUrl,
        status: a.status,
        contentType: a.contentType,
        contentLength: a.contentLength,
        redirected: a.redirected,
        blobSize: a.blobSize,
        xOgError: a.xOgError,
        xOgImageMode: a.xOgImageMode,
        bodyPreview: a.bodyPreview
      }));
      console.error("Error sharing [OG_DEBUG]:", {
        citySlug,
        pageUrl: window.location.href,
        basePath: BASE_PATH,
        error,
        attempts
      });
      console.table(attemptsSummary);
      imageBlob = await createClientFallbackImageBlob(cityName, votesDecisifs);
      console.warn("Using client-side fallback image", { citySlug });
    }
    currentInfluBlob = imageBlob;
    const imageUrl = URL.createObjectURL(imageBlob);
    showShareModal(imageUrl, cityName);
  } catch (error) {
    const container = document.getElementById("influImageContainer");
    if (container) {
      container.innerHTML = `<p class="error">Erreur lors de la génération de l'image. Réessaie.</p>${getRejoinButtonHtml()}`;
    }
    alert(`Erreur lors du partage. Réessaie !
${String(error)}`);
  }
}
window.navigateToCityById = navigateToCityById;
window.openQomonModal = openQomonModal;
window.closeQomonModal = closeQomonModal;
window.openDetailModal = openDetailModal;
window.openDetailModalByKey = openDetailModalByKey;
window.closeDetailModal = closeDetailModal;
window.shareCity = shareCity;
window.closeShareModal = closeShareModal;
window.copyInfluImage = copyInfluImage;
window.openHowPanel = openHowPanel;
window.openAgendaPanel = openAgendaPanel;
window.openInfluPanel = openInfluPanel;
window.openRejoinPanel = openRejoinPanel;
window.trackMatomoEvent = matomoTrack;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
