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
    jeunesNonVotants: "jeunes de 18-39 ans<br>n'ont pas voté,<br>selon nos estimations"
  },
  detailLink: "Détail",
  sourceLabel: "Source :"
};
function scaledNumberFontSizes(nonVotants, votesDecisifs) {
  const CAP = 15;
  const MID = 14;
  let sizeRatio = 1;
  if (votesDecisifs > 0 && nonVotants > 0) {
    const cityRatio = nonVotants / votesDecisifs;
    const t = Math.min(1, Math.log10(Math.max(1, cityRatio)) / Math.log10(CAP));
    sizeRatio = 1 + t;
  }
  const mainCqh = (MID / Math.sqrt(sizeRatio)).toFixed(1);
  const secondaryCqh = (MID * Math.sqrt(sizeRatio)).toFixed(1);
  return {
    main: `clamp(26px, ${mainCqh}cqh, 100px)`,
    secondary: `clamp(26px, ${secondaryCqh}cqh, 120px)`
  };
}
function computeVotesDecisifs(tour1, tour2) {
  if (tour2) {
    const sorted2 = [...tour2.resultats].filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix)).sort((a, b) => b.Voix - a.Voix);
    if (sorted2.length >= 2) {
      return { votesDecisifs: sorted2[0].Voix - sorted2[1].Voix + 1, cas: 2 };
    }
    const sorted1 = [...tour1.resultats].filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix)).sort((a, b) => b.Voix - a.Voix);
    if (sorted1.length >= 2) {
      return { votesDecisifs: sorted1[0].Voix - sorted1[1].Voix + 1, cas: "2b" };
    }
    return { votesDecisifs: 0, cas: "2b" };
  }
  const sorted = [...tour1.resultats].filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix)).sort((a, b) => b.Voix - a.Voix);
  if (sorted.length === 0)
    return { votesDecisifs: 0, cas: 3 };
  const gagnantVoix = sorted[0].Voix;
  if (sorted.length === 1) {
    return { votesDecisifs: gagnantVoix + 1, cas: 1 };
  }
  const exprim_s = tour1.Exprimés;
  const majority = 2 * gagnantVoix - exprim_s;
  if (majority > 0) {
    return { votesDecisifs: majority, cas: 3 };
  }
  return { votesDecisifs: sorted[0].Voix - sorted[1].Voix + 1, cas: "3b" };
}
function getMainTagline(cas, votesDecisifs) {
  const verb = votesDecisifs === 1 ? "vote aurait pu" : "votes auraient pu";
  if (cas === 1 || cas === 2 || cas === "2b") {
    return `${verb}<br>faire élire un·e autre maire<br>en 2020`;
  }
  return `${verb}<br>faire la diff' aux municipales<br>en 2020`;
}
function formatFormulaDecisiveCas1(cityName, codeDepartement, firstPlaceVoix, votesDecisifs, resultsTableHtml) {
  return `À ${cityName} (${codeDepartement}) en 2020, une seule liste était en lice au premier tour.
<br><br>
Pour qu'une autre liste ait pu l'emporter, il aurait fallu qu'elle obtienne strictement plus de voix que la liste unique — soit au moins <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> nouveaux votes.
<br><br>
<strong>Formule :</strong> Voix de la liste unique + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la liste unique : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Votes nécessaires : ${firstPlaceVoix.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour :</strong>
${resultsTableHtml}`;
}
function formatFormulaDecisiveCas2(cityName, codeDepartement, firstPlaceVoix, secondPlaceVoix, votesDecisifs, tourLabel, resultsTableHtml) {
  const ecart = firstPlaceVoix - secondPlaceVoix;
  return `À ${cityName} (${codeDepartement}) en 2020, la liste arrivée en tête au second tour l'a emporté avec ${ecart.toLocaleString("fr-FR")} voix d'avance.
<br><br>
Pour que la 2e liste passe devant, il aurait suffi d'ajouter <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> nouveaux votes à son score.
<br><br>
<strong>Formule :</strong> (Voix de la 1ère liste − Voix de la 2e liste) + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste : ${secondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${secondPlaceVoix.toLocaleString("fr-FR")} = ${ecart.toLocaleString("fr-FR")}
<br>• Votes décisifs : ${ecart.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du ${tourLabel} :</strong>
${resultsTableHtml}`;
}
function formatFormulaDecisiveCas3(cityName, codeDepartement, firstPlaceVoix, exprimes, votesDecisifs, tourLabel, resultsTableHtml) {
  const pourcentage = (firstPlaceVoix / exprimes * 100).toFixed(1);
  return `À ${cityName} (${codeDepartement}) en 2020, la liste gagnante a remporté l'élection dès le premier tour avec ${pourcentage}% des suffrages exprimés (plus de 50%).
<br><br>
Pour forcer un second tour, il aurait fallu ajouter <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> votes supplémentaires aux autres listes — ce qui aurait ramené la liste de tête à 50% ou moins.
<br><br>
<strong>Formule :</strong> 2 × Voix de la 1ère liste − Total des exprimés
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste (V₁) : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Total des exprimés (Vₜ) : ${exprimes.toLocaleString("fr-FR")}
<br>• 2 × ${firstPlaceVoix.toLocaleString("fr-FR")} − ${exprimes.toLocaleString("fr-FR")} = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du ${tourLabel} :</strong>
${resultsTableHtml}`;
}
function formatFormulaDecisiveCas3b(cityName, codeDepartement, firstPlaceVoix, secondPlaceVoix, votesDecisifs, resultsTableHtml) {
  const ecart = firstPlaceVoix - secondPlaceVoix;
  return `À ${cityName} (${codeDepartement}) en 2020, les élections municipales ne se sont pas tenues en deux tours bien qu'aucune liste n'ait obtenu la majorité absolue au premier tour.
<br><br>
Par analogie avec les communes ayant eu un second tour, on calcule l'écart entre la première et la deuxième liste pour estimer le nombre de votes qui auraient pu inverser l'ordre d'arrivée.
<br><br>
<strong>Formule :</strong> (Voix de la 1ère liste − Voix de la 2e liste) + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste : ${secondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${secondPlaceVoix.toLocaleString("fr-FR")} = ${ecart.toLocaleString("fr-FR")}
<br>• Votes décisifs : ${ecart.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour :</strong>
${resultsTableHtml}`;
}
function formatFormulaDecisiveCas2b(cityName, codeDepartement, tour1FirstPlaceVoix, tour1SecondPlaceVoix, votesDecisifs, tour1ResultsTableHtml) {
  const ecart = tour1FirstPlaceVoix - tour1SecondPlaceVoix;
  return `À ${cityName} (${codeDepartement}) en 2020, une seule liste était en lice au second tour : toutes les autres listes s'étaient retirées ou fusionnées avant le second tour.
<br><br>
En l'absence d'adversaire au second tour, on remonte au premier tour pour estimer les votes décisifs : l'écart entre la première et la deuxième liste au 1er tour indique combien de votes auraient pu modifier l'ordre d'arrivée avant les désistements.
<br><br>
<strong>Formule :</strong> (Voix de la 1ère liste − Voix de la 2e liste au 1er tour) + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste (1er tour) : ${tour1FirstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste (1er tour) : ${tour1SecondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${tour1FirstPlaceVoix.toLocaleString("fr-FR")} − ${tour1SecondPlaceVoix.toLocaleString("fr-FR")} = ${ecart.toLocaleString("fr-FR")}
<br>• Votes décisifs : ${ecart.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour :</strong>
${tour1ResultsTableHtml}`;
}
function formatExplanationNonVoting(cityName, codeDepartement, pop1839, partNeVotantPas, nonVotants, pop18Plus) {
  return `Lors des municipales de 2020, ${cityName} (${codeDepartement}) compte ${pop1839.toLocaleString("fr-FR")} jeunes de 18 à 39 ans et en moyenne ${(partNeVotantPas * 100).toFixed(1)}% de la population majeure n'a pas voté à ${cityName} (${nonVotants.toLocaleString("fr-FR")} non votants / ${pop18Plus.toLocaleString("fr-FR")} majeur·es).`;
}
function formatFormulaNonVotants(explanationNonVoting, pop1839, pop18Plus, votants, partNeVotantPas, nonVotants1839) {
  return `${explanationNonVoting}
<br><br>
<strong>Formule :</strong> Population 18-39 ans × Taux d'abstention
<br><br>
<strong>Détail :</strong>
<br>• Population 18-39 ans : ${pop1839.toLocaleString("fr-FR")}
<br>• Population 18+ ans : ${pop18Plus.toLocaleString("fr-FR")}
<br>• Votants : ${votants.toLocaleString("fr-FR")}
<br>• Taux d'abstention : ${(partNeVotantPas * 100).toFixed(1)}% = (${pop18Plus.toLocaleString("fr-FR")} − ${votants.toLocaleString("fr-FR")}) ÷ ${pop18Plus.toLocaleString("fr-FR")}
<br>• Non-votants 18-39 ans estimés : ${pop1839.toLocaleString("fr-FR")} × ${(partNeVotantPas * 100).toFixed(1)}% = ${nonVotants1839.toLocaleString("fr-FR")}`;
}
function formatResultatRow(resultat) {
  const titre = resultat.Sexe === "F" ? "Mme" : "M.";
  const sieges = typeof resultat["Sièges / Elu"] === "number" ? resultat["Sièges / Elu"] : resultat["Sièges / Elu"] === "Oui" ? labels.elu : resultat["Sièges / Elu"];
  return `<tr>
		<td>${titre} ${resultat.Prénom} ${resultat.Nom}</td>
		<td>${resultat.Voix.toLocaleString("fr-FR")}</td>
		<td>${resultat["% Voix/Ins"].toFixed(2)}%</td>
		<td>${resultat["% Voix/Exp"].toFixed(2)}%</td>
		<td>${sieges}</td>
		<td>${resultat["Sièges CC"]}</td>
	</tr>`;
}
function formatResultsTable(resultats) {
  const rows = resultats.map(formatResultatRow).join("");
  return `
		<div class="table-scroll-container">
			<table class="results-table">
				<thead>
					<tr>
						<th>${labels.tableHeaders.listeConduitePar}</th>
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
			⚠️ Les chiffres présentés sont les agrégations des communes suivantes : ${communesList}
		</div>
	`;
}
function formatCityDetailHtml(votesDecisifs, mainTagline, nonVotants1839, aggregationWarning) {
  const fontSizes = scaledNumberFontSizes(nonVotants1839, votesDecisifs);
  return `
        <div class="city-detail">
			${aggregationWarning}

			<!-- Main Stat: Decisive Votes -->
			<div class="main-stat">

				<div class="main-number" style="font-size:${fontSizes.main}">${votesDecisifs.toLocaleString("fr-FR")}</div>
				<div class="main-label">${mainTagline}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('decisive'); return false;">${labels.detailLink}</a>
			</div>

            <!-- Secondary Stat: Non-Voting Youth -->
            <div class="secondary-stat">

                <div class="secondary-number" style="font-size:${fontSizes.secondary}">${nonVotants1839.toLocaleString("fr-FR")}</div>
                <div class="secondary-label">${labels.stats.jeunesNonVotants}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('nonVoting'); return false;">${labels.detailLink}</a>
            </div>

            <!-- CTA Buttons -->
            <div class="cta-section">
                <button type="button" class="cta-button" onclick="openHowPanel()">
                    JE VOTE LES 15 ET 22 MARS<br>MODE D'EMPLOI<span class="emoji">\uD83D\uDDF3️</span>
                </button>
                <button id="shareBtn" type="button" class="cta-button" onclick="openInfluPanel()">
                    J'INFORME MES POTES<span class="emoji">\uD83D\uDCE3</span>
                </button>
                <button type="button" class="cta-button" onclick="openRejoinPanel()">
                    JE ME MOBILISE<br>AVEC ON EST PRÊT<span class="emoji">✊</span>
                </button>
            </div>

        </div>
    `;
}
function getElectionSourceUrl(codeDepartement, codeCommune) {
  const deptCode = codeDepartement.padStart(3, "0");
  return `https://www.archives-resultats-elections.interieur.gouv.fr/resultats/municipales-2020/${deptCode}/${deptCode}${codeCommune}.php`;
}
var nonVotingSourceUrl = "https://explore.data.gouv.fr/fr/datasets/6627b6fd7291f9d8a62d9997/#/resources/b8ad4a63-a4e3-4ef2-af6e-b08ef3b8084d";
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
var ACCESS_CODE = "ONBASCULE";
var ACCESS_STORAGE_KEY = "mobilisator_access_granted";
function hasAccess() {
  return localStorage.getItem(ACCESS_STORAGE_KEY) === "true";
}
function grantAccess() {
  localStorage.setItem(ACCESS_STORAGE_KEY, "true");
  hideAccessGate();
}
function showAccessGate() {
  const gate = document.getElementById("accessGate");
  const mainContent = document.getElementById("mainContent");
  if (gate)
    gate.classList.add("show");
  if (mainContent)
    mainContent.classList.add("hidden");
}
function hideAccessGate() {
  const gate = document.getElementById("accessGate");
  const mainContent = document.getElementById("mainContent");
  if (gate)
    gate.classList.remove("show");
  if (mainContent)
    mainContent.classList.remove("hidden");
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
function validateAccessCode() {
  const input = document.getElementById("accessCodeInput");
  const error = document.getElementById("accessError");
  if (!input)
    return;
  const code = input.value.trim().toUpperCase();
  if (code === ACCESS_CODE) {
    grantAccess();
  } else {
    if (error) {
      error.textContent = messages.codeIncorrect;
      error.style.display = "block";
    }
    input.value = "";
    input.focus();
  }
}
function initAccessGate() {
  const input = document.getElementById("accessCodeInput");
  const button = document.getElementById("accessCodeSubmit");
  if (input) {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        validateAccessCode();
      }
    });
  }
  if (button) {
    button.addEventListener("click", validateAccessCode);
  }
}
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
  initAccessGate();
  const navBrand = document.getElementById("navBrand");
  if (navBrand) {
    navBrand.addEventListener("click", (e) => {
      e.preventDefault();
      window.history.pushState({}, "", BASE_PATH);
      handleRoute();
    });
  }
  if (!hasAccess()) {
    showAccessGate();
    return;
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
    document.title = "#RIENSANSNOUS - Municipales 2020";
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
      container.innerHTML = INFLU_LOADING_HTML;
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
var INFLU_LOADING_HTML = `<div class="influ-loading">Image en cours de création<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;
async function openInfluPanel() {
  matomoTrack("CTA", "informer_potes");
  const container = document.getElementById("influImageContainer");
  if (container)
    container.innerHTML = INFLU_LOADING_HTML;
  const url = new URL(window.location.href);
  url.searchParams.set("jememobilise", "true");
  url.searchParams.set("influ", "true");
  window.history.pushState({}, "", url.toString());
  updatePanelVisibility();
  await shareCity();
}
var qomonFormInitialized = false;
function openRejoinPanel() {
  matomoTrack("CTA", "se_mobiliser");
  const url = new URL(window.location.href);
  url.searchParams.set("jememobilise", "true");
  url.searchParams.set("jerejoins", "true");
  window.history.pushState({}, "", url.toString());
  updatePanelVisibility();
  if (!qomonFormInitialized) {
    const qomonForm = document.querySelector("#rejoinPanel .qomon-form");
    if (qomonForm) {
      const clone = qomonForm.cloneNode(true);
      qomonForm.parentNode?.replaceChild(clone, qomonForm);
    }
    qomonFormInitialized = true;
  }
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
  const hasSecondTour = !!city["Tour 2"];
  const { votesDecisifs, cas } = computeVotesDecisifs(city["Tour 1"], city["Tour 2"]);
  const electionSource = getElectionSourceUrl(city.code_departement, city.code_commune);
  const pop1839 = city.Analyse["Pop 18-39"];
  const pop18Plus = city.Analyse["Pop 18+"];
  const nonVotants = city.Analyse["Non votants"];
  const partNeVotantPas = city.Analyse["Part ne votant pas"];
  const explanationNonVoting = formatExplanationNonVoting(city.nom_standard, city.code_departement, pop1839, partNeVotantPas, nonVotants, pop18Plus);
  const mainTagline = getMainTagline(cas, votesDecisifs);
  const nonVotants1839 = Math.round(city.Analyse["Non votants de 18-39"]);
  document.title = `${city.nom_standard} — ${votesDecisifs.toLocaleString("fr-FR")} jeunes auraient fait la diff' | #RIENSANSNOUS`;
  document.getElementById("canonicalTag")?.setAttribute("href", `https://mobilisator.fr/${city.slug}`);
  currentCityData = {
    citySlug: city.slug,
    cityName: city.nom_standard,
    codeDepartement: city.code_departement,
    votesDecisifs,
    nonVotants1839,
    hasSecondTour
  };
  const paq = window._paq ?? [];
  paq.push(["setCustomDimension", 1, city.nom_standard]);
  const tourDecisif = hasSecondTour ? city["Tour 2"] : city["Tour 1"];
  const tourLabel = hasSecondTour ? labels.tour2 : labels.tour1;
  const resultats = [...tourDecisif.resultats].sort((a, b) => b.Voix - a.Voix);
  const resultsTable = formatResultsTable(resultats);
  const firstPlace = resultats[0];
  const secondPlace = resultats[1];
  const exprimes = tourDecisif.Exprimés;
  let formulaDecisive = "";
  if (cas === 1) {
    formulaDecisive = formatFormulaDecisiveCas1(city.nom_standard, city.code_departement, firstPlace.Voix, votesDecisifs, resultsTable);
  } else if (cas === 2 && secondPlace) {
    formulaDecisive = formatFormulaDecisiveCas2(city.nom_standard, city.code_departement, firstPlace.Voix, secondPlace.Voix, votesDecisifs, tourLabel, resultsTable);
  } else if (cas === "3b" && secondPlace) {
    formulaDecisive = formatFormulaDecisiveCas3b(city.nom_standard, city.code_departement, firstPlace.Voix, secondPlace.Voix, votesDecisifs, resultsTable);
  } else if (cas === "2b") {
    const tour1Resultats = [...city["Tour 1"].resultats].filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix)).sort((a, b) => b.Voix - a.Voix);
    const tour1Table = formatResultsTable(tour1Resultats);
    const tour1First = tour1Resultats[0];
    const tour1Second = tour1Resultats[1];
    if (tour1First && tour1Second) {
      formulaDecisive = formatFormulaDecisiveCas2b(city.nom_standard, city.code_departement, tour1First.Voix, tour1Second.Voix, votesDecisifs, tour1Table);
    }
  } else {
    formulaDecisive = formatFormulaDecisiveCas3(city.nom_standard, city.code_departement, firstPlace.Voix, exprimes, votesDecisifs, tourLabel, resultsTable);
  }
  const votants = tourDecisif.Votants;
  const formulaNonVotants = formatFormulaNonVotants(explanationNonVoting, pop1839, pop18Plus, votants, partNeVotantPas, nonVotants1839);
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
  const aggregationWarning = formatAggregationWarning(city.communesAgregees || []);
  const html = formatCityDetailHtml(votesDecisifs, mainTagline, nonVotants1839, aggregationWarning);
  cityDetailDiv.innerHTML = html;
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
	<button type="button" class="cta-button" onclick="openRejoinPanel()">
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
function showShareModal(imageUrl) {
  const container = document.getElementById("influImageContainer");
  if (container) {
    container.innerHTML = `
			<div class="influ-copy-text">IMAGE COPIÉE ! </div>
			<div class="influ-copy-text" style="color:#5ECBA1">TU PEUX LA COLLER EN STORY</div>
			<img class="influ-image" src="${imageUrl}" alt="Image à partager">
		`;
    appendRejoinButtonWhenImageReady(container);
  }
}
function closeShareModal() {}
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
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = "700 38px Arial, sans-serif";
  ctx.fillText("ON EST PRÊT ESTIME QUE", canvas.width / 2, 700);
  ctx.fillStyle = "#5ECBA1";
  ctx.font = '900 220px "Arial Black", Arial, sans-serif';
  ctx.fillText(votesDecisifs.toLocaleString("fr-FR"), canvas.width / 2, 880);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '700 66px "Arial Black", Arial, sans-serif';
  ctx.fillText("JEUNES DE 18-39 ANS", canvas.width / 2, 1050);
  ctx.fillText("AURAIENT FAIT LA DIFF'", canvas.width / 2, 1140);
  ctx.fillText(`A ${cityUpper} EN 2020`, canvas.width / 2, 1230);
  ctx.fillStyle = "#5ECBA1";
  ctx.font = '700 74px "Arial Black", Arial, sans-serif';
  ctx.fillText("JE VOTE EN 2026.", canvas.width / 2, 1400);
  ctx.fillText("ET TOI ?", canvas.width / 2, 1490);
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
    const imageUrl = URL.createObjectURL(imageBlob);
    const clipboardSupportsPng = navigator.clipboard && typeof ClipboardItem !== "undefined" && (typeof ClipboardItem.supports !== "function" || ClipboardItem.supports("image/png"));
    if (clipboardSupportsPng) {
      try {
        const pngBlob = await normalizeImageForClipboard(imageBlob);
        const clipboardItem = new ClipboardItem({ "image/png": Promise.resolve(pngBlob) });
        await navigator.clipboard.write([clipboardItem]);
        showShareModal(imageUrl);
      } catch (clipboardError) {
        console.error("Clipboard error:", clipboardError);
        showShareModalWithDownload(imageUrl, cityName);
      }
    } else {
      showShareModalWithDownload(imageUrl, cityName);
    }
  } catch (error) {
    const container = document.getElementById("influImageContainer");
    if (container) {
      container.innerHTML = `<p class="error">Erreur lors de la génération de l'image. Réessaie.</p>${getRejoinButtonHtml()}`;
    }
    alert(`Erreur lors du partage. Réessaie !
${String(error)}`);
  }
}
function showShareModalWithDownload(imageUrl, cityName) {
  const container = document.getElementById("influImageContainer");
  if (container) {
    container.innerHTML = `
			<div class="influ-title">Ton image est prête !</div>
			<div class="influ-subtitle">Télécharge-la et partage-la en story</div>
			<img class="influ-image" src="${imageUrl}" alt="Image à partager">
			<a href="${imageUrl}" download="mobilisator-${cityName}.png" class="cta-button" style="text-decoration: none; margin-top: 8px;">
				TÉLÉCHARGER<span class="emoji">\uD83D\uDCE5</span>
			</a>
		`;
    appendRejoinButtonWhenImageReady(container);
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
