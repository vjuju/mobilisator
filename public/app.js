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
    jeunesNonVotants: "jeunes de 18-39 ans<br>n'ont pas voté"
  },
  detailLink: "Détail",
  sourceLabel: "Source :"
};
function getMainTagline(hasSecondTour) {
  if (hasSecondTour) {
    return "votes suffisaient pour élire un autre maire";
  }
  return "votes suffisaient pour aller au second tour";
}
function formatExplanationDecisive(cityName, codeDepartement, votesDecisifs, hasSecondTour) {
  const formattedVotes = votesDecisifs.toLocaleString("fr-FR");
  if (hasSecondTour) {
    return `Lors des municipales de 2020, à ${cityName} (${codeDepartement}), l'écart de voix au second tour entre la 1ère et la 2e liste était de ${formattedVotes} voix.`;
  }
  return `Lors des municipales de 2020, à ${cityName} (${codeDepartement}), la 1ère liste a obtenu ${formattedVotes} voix au-dessus de la majorité au premier tour.`;
}
function formatFormulaDecisiveSecondTour(explanationDecisive, firstPlaceVoix, secondPlaceVoix, votesDecisifs, tourLabel, resultsTableHtml) {
  return `${explanationDecisive}
<br><br>
<strong>Formule :</strong> Voix de la 1ère liste − Voix de la 2e liste au second tour
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste : ${secondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${secondPlaceVoix.toLocaleString("fr-FR")} = ${votesDecisifs.toLocaleString("fr-FR")} voix
		<br><br><strong>Résultats du ${tourLabel} :</strong>
		${resultsTableHtml}`;
}
function formatFormulaDecisivePremierTour(explanationDecisive, firstPlaceVoix, exprimes, votesDecisifs, tourLabel, resultsTableHtml) {
  const moitieExprimes = Math.round(exprimes / 2);
  return `${explanationDecisive}
<br><br>
<strong>Formule :</strong> Voix de la 1ère liste − (Exprimés ÷ 2) au premier tour
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Exprimés : ${exprimes.toLocaleString("fr-FR")}
<br>• Majorité (Exprimés ÷ 2) : ${moitieExprimes.toLocaleString("fr-FR")}
<br>• Marge au-dessus de la majorité : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${moitieExprimes.toLocaleString("fr-FR")} = ${votesDecisifs.toLocaleString("fr-FR")} voix
		<br><br><strong>Résultats du ${tourLabel} :</strong>
		${resultsTableHtml}`;
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
  return `
        <div class="city-detail">
			${aggregationWarning}

			<!-- Main Stat: Decisive Votes -->
			<div class="main-stat">
				<div class="main-number">${votesDecisifs.toLocaleString("fr-FR")}</div>
				<div class="main-label">${mainTagline}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('decisive'); return false;">${labels.detailLink}</a>
			</div>

            <!-- Secondary Stat: Non-Voting Youth -->
            <div class="secondary-stat">
                <div class="secondary-number">${nonVotants1839.toLocaleString("fr-FR")}</div>
                <div class="secondary-label">${labels.stats.jeunesNonVotants}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('nonVoting'); return false;">${labels.detailLink}</a>
            </div>

            <!-- CTA Buttons -->
            <div class="cta-section">
                <button type="button" class="cta-button" onclick="shareCity()">
                    ${labels.cta.partager}<span class="emoji">${labels.cta.partagerEmoji}</span>
                </button>
            </div>
            <div class="cta-section">
                <button type="button" class="cta-button" onclick="openQomonModal()">
                    ${labels.cta.rejoindre}<span class="emoji">${labels.cta.rejoindreEmoji}</span>
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
async function handleRoute() {
  const path = window.location.pathname;
  const relativePath = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) : path.substring(1);
  if (relativePath === "" || relativePath === "index.html") {
    const cityDetailDiv = document.getElementById("cityDetail");
    if (cityDetailDiv)
      cityDetailDiv.innerHTML = "";
  } else {
    const slug = relativePath.replace(".html", "");
    await loadCityBySlug(slug);
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
    displayCityDetail(city);
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
  const searchInput = document.getElementById("searchInput");
  if (searchInput)
    searchInput.value = formatSearchInputValue(city.nom_standard, city.code_departement);
  if (!city.Analyse) {
    cityDetailDiv.innerHTML = `<p class="error">${messages.analyseNonDisponible}</p>`;
    return;
  }
  const votesDecisifs = city.Analyse["Votes décisifs"];
  const hasSecondTour = !!city["Tour 2"];
  const explanationDecisive = formatExplanationDecisive(city.nom_standard, city.code_departement, votesDecisifs, hasSecondTour);
  const electionSource = getElectionSourceUrl(city.code_departement, city.code_commune);
  const pop1839 = city.Analyse["Pop 18-39"];
  const pop18Plus = city.Analyse["Pop 18+"];
  const nonVotants = city.Analyse["Non votants"];
  const partNeVotantPas = city.Analyse["Part ne votant pas"];
  const explanationNonVoting = formatExplanationNonVoting(city.nom_standard, city.code_departement, pop1839, partNeVotantPas, nonVotants, pop18Plus);
  const mainTagline = getMainTagline(hasSecondTour);
  const nonVotants1839 = Math.round(city.Analyse["Non votants de 18-39"]);
  currentCityData = {
    citySlug: city.slug,
    cityName: city.nom_standard,
    codeDepartement: city.code_departement,
    votesDecisifs,
    nonVotants1839,
    hasSecondTour
  };
  const tourDecisif = hasSecondTour ? city["Tour 2"] : city["Tour 1"];
  const tourLabel = hasSecondTour ? labels.tour2 : labels.tour1;
  const resultats = [...tourDecisif.resultats].sort((a, b) => b.Voix - a.Voix);
  const resultsTable = formatResultsTable(resultats);
  const firstPlace = resultats[0];
  const secondPlace = resultats[1];
  const exprimes = tourDecisif.Exprimés;
  let formulaDecisive = "";
  if (hasSecondTour && secondPlace) {
    formulaDecisive = formatFormulaDecisiveSecondTour(explanationDecisive, firstPlace.Voix, secondPlace.Voix, votesDecisifs, tourLabel, resultsTable);
  } else {
    formulaDecisive = formatFormulaDecisivePremierTour(explanationDecisive, firstPlace.Voix, exprimes, votesDecisifs, tourLabel, resultsTable);
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
  let modal = document.getElementById("qomonModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "qomonModal";
    modal.className = "modal";
    modal.innerHTML = `
			<div class="modal-content">
				<button type="button" class="modal-close" onclick="closeQomonModal()">&times;</button>
				<div class="qomon-form" data-base_id="103323d7-738d-4ff2-813b-c397d6980e38"></div>
			</div>
		`;
    document.body.appendChild(modal);
    const qomonForm = modal.querySelector(".qomon-form");
    if (qomonForm) {
      const clone = qomonForm.cloneNode(true);
      qomonForm.parentNode?.replaceChild(clone, qomonForm);
    }
  }
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeQomonModal() {
  const modal = document.getElementById("qomonModal");
  if (modal) {
    modal.classList.remove("show");
    document.body.style.overflow = "";
  }
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
function showShareModal(imageUrl) {
  let modal = document.getElementById("shareModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "shareModal";
    modal.className = "modal";
    modal.innerHTML = `
			<div class="modal-content share-modal-content">
				<button type="button" class="modal-close" onclick="closeShareModal()">&times;</button>
				<h3 class="share-modal-title">Image copiée !</h3>
				<p class="share-modal-subtitle">Tu peux la coller en story</p>
				<div class="share-modal-image-container">
					<img class="share-modal-image" src="" alt="Image à partager">
				</div>
			</div>
		`;
    document.body.appendChild(modal);
  }
  const img = modal.querySelector(".share-modal-image");
  if (img)
    img.src = imageUrl;
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeShareModal() {
  const modal = document.getElementById("shareModal");
  if (modal) {
    modal.classList.remove("show");
    document.body.style.overflow = "";
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
var buildOgCandidateUrls = (citySlug) => {
  const encodedSlug = encodeURIComponent(citySlug);
  const cb = Date.now();
  return Array.from(new Set([
    new URL(`/og/${encodedSlug}.png?cb=${cb}`, window.location.origin).toString(),
    getAbsolutePath(`og/${encodedSlug}.png?cb=${cb}`),
    new URL(`/api/og/${encodedSlug}.png?cb=${cb}`, window.location.origin).toString(),
    getAbsolutePath(`api/og/${encodedSlug}.png?cb=${cb}`)
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
      response = await fetch(url, { cache: "no-store", redirect: "follow" });
    } catch (error) {
      attempts.push({
        url,
        finalUrl: "",
        status: 0,
        ok: false,
        contentType: "",
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
    if (imageBlob.size === 0) {
      debug.bodyPreview = "empty image blob";
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
  const { citySlug, cityName } = currentCityData;
  try {
    const { imageBlob, attempts, usedUrl } = await fetchOgImageWithDebug(citySlug);
    console.info("OG_DEBUG success", { citySlug, usedUrl, attempts });
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
    const attempts = error instanceof OgFetchError ? error.attempts : [
      {
        url: "(unknown)",
        finalUrl: "",
        status: 0,
        ok: false,
        contentType: "",
        xOgImageMode: "",
        xOgSlug: citySlug,
        xOgError: String(error),
        bodyPreview: ""
      }
    ];
    console.error("Error sharing [OG_DEBUG]:", {
      citySlug,
      pageUrl: window.location.href,
      basePath: BASE_PATH,
      error,
      attempts
    });
    alert("Erreur lors du partage. Réessaie !");
  }
}
function showShareModalWithDownload(imageUrl, cityName) {
  let modal = document.getElementById("shareModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "shareModal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
		<div class="modal-content share-modal-content">
			<button type="button" class="modal-close" onclick="closeShareModal()">&times;</button>
			<h3 class="share-modal-title">Ton image est prête !</h3>
			<p class="share-modal-subtitle">Télécharge-la et partage-la en story</p>
			<div class="share-modal-image-container">
				<img class="share-modal-image" src="${imageUrl}" alt="Image à partager">
			</div>
			<a href="${imageUrl}" download="mobilisator-${cityName}.png" class="cta-button share-download-button">
				TÉLÉCHARGER<span class="emoji">\uD83D\uDCE5</span>
			</a>
		</div>
	`;
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}
window.navigateToCityById = navigateToCityById;
window.openQomonModal = openQomonModal;
window.closeQomonModal = closeQomonModal;
window.openDetailModal = openDetailModal;
window.openDetailModalByKey = openDetailModalByKey;
window.closeDetailModal = closeDetailModal;
window.shareCity = shareCity;
window.closeShareModal = closeShareModal;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
