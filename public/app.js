// src/utils.ts
var normalizeText = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[''`]/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/\s+/g, "-").replace(/^-+|-+$/g, "").trim();

// src/app.ts
var ACCESS_CODE = "OEP";
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
      error.textContent = "Code incorrect";
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
  const match = path.match(/^(\/[^/]+\/)/);
  if (match && match[1] !== "/") {
    return match[1];
  }
  return "/";
};
var BASE_PATH = getBasePath();
var searchTimeout = null;
var searchIndexCache = {};
var citiesDataCache = null;
var slugMapCache = null;
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
  resultsDiv.innerHTML = '<p class="loading">Recherche en cours...</p>';
  try {
    const normalized = normalizeText(query);
    const partition = getPartitionKey(normalized);
    const searchIndex = await loadSearchPartition(partition);
    const citiesData = searchIndex[normalized];
    if (!citiesData || citiesData.length === 0) {
      resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
      return;
    }
    displaySearchResults(citiesData.slice(0, 50));
  } catch (error) {
    console.error("Search error:", error);
    resultsDiv.innerHTML = '<p class="error">Erreur lors de la recherche</p>';
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
    resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
    return;
  }
  const html = cities.map((city) => {
    const [id, name, codeDepartement] = city;
    return `
            <div class="result-item" onclick="navigateToCityById(${id})">
                <h3>${name} (${codeDepartement})</h3>
            </div>
        `;
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
      searchInput.value = `${city.nom_standard} (${city.code_departement})`;
  }
}
async function loadCityBySlug(slug) {
  const cityDetailDiv = document.getElementById("cityDetail");
  if (!cityDetailDiv)
    return;
  cityDetailDiv.innerHTML = '<p class="loading">Chargement...</p>';
  try {
    const city = await fetchCityBySlug(slug);
    if (!city) {
      cityDetailDiv.innerHTML = '<p class="error">Ville non trouvée</p>';
      return;
    }
    displayCityDetail(city);
  } catch (error) {
    console.error("Error loading city:", error);
    cityDetailDiv.innerHTML = '<p class="error">Erreur lors du chargement de la ville</p>';
  }
}
function displayCityDetail(city) {
  const cityDetailDiv = document.getElementById("cityDetail");
  if (!cityDetailDiv)
    return;
  const searchInput = document.getElementById("searchInput");
  if (searchInput)
    searchInput.value = `${city.nom_standard} (${city.code_departement})`;
  if (!city.Analyse) {
    cityDetailDiv.innerHTML = `<p class="error">Données d'analyse non disponibles pour cette ville</p>`;
    return;
  }
  const votesDecisifs = city.Analyse["Votes décisifs"];
  const hasSecondTour = !!city["Tour 2"];
  let explanationDecisive = "";
  if (hasSecondTour) {
    explanationDecisive = `Lors des municipales de 2020, à ${city.nom_standard} (${city.code_departement}), l'écart de voix au second tour entre la 1ère et la 2e liste était de ${votesDecisifs.toLocaleString("fr-FR")} voix.`;
  } else {
    explanationDecisive = `Lors des municipales de 2020, à ${city.nom_standard} (${city.code_departement}), la 1ère liste a obtenu ${votesDecisifs.toLocaleString("fr-FR")} voix au-dessus de la majorité au premier tour.`;
  }
  const deptCode = city.code_departement.padStart(3, "0");
  const electionSource = `https://www.archives-resultats-elections.interieur.gouv.fr/resultats/municipales-2020/${deptCode}/${deptCode}${city.code_commune}.php`;
  const pop1839 = city.Analyse["Pop 18-39"];
  const pop18Plus = city.Analyse["Pop 18+"];
  const nonVotants = city.Analyse["Non votants"];
  const partNeVotantPas = city.Analyse["Part ne votant pas"];
  const explanationNonVoting = `Lors des municipales de 2020, ${city.nom_standard} (${city.code_departement}) compte ${pop1839.toLocaleString("fr-FR")} jeunes de 18 à 39 ans et en moyenne ${(partNeVotantPas * 100).toFixed(1)}% de la population majeure n'a pas voté à ${city.nom_standard} (${nonVotants.toLocaleString("fr-FR")} non votants / ${pop18Plus.toLocaleString("fr-FR")} majeur·es).`;
  const nonVotingSource = "https://explore.data.gouv.fr/fr/datasets/6627b6fd7291f9d8a62d9997/#/resources/b8ad4a63-a4e3-4ef2-af6e-b08ef3b8084d";
  const mainTagline = hasSecondTour ? "votes suffisaient pour élire un autre maire" : "votes suffisaient à l'opposition pour aller au second tour";
  const nonVotants1839 = Math.round(city.Analyse["Non votants de 18-39"]);
  const tourDecisif = hasSecondTour ? city["Tour 2"] : city["Tour 1"];
  const tourLabel = hasSecondTour ? "2nd tour" : "1er tour";
  const resultats = [...tourDecisif.resultats].sort((a, b) => b.Voix - a.Voix);
  let resultsTableRows = resultats.map((r) => {
    const titre = r.Sexe === "F" ? "Mme" : "M.";
    const sieges = typeof r["Sièges / Elu"] === "number" ? r["Sièges / Elu"] : r["Sièges / Elu"] === "Oui" ? "Élu" : r["Sièges / Elu"];
    return `<tr>
				<td>${titre} ${r.Prénom} ${r.Nom}</td>
				<td>${r.Voix.toLocaleString("fr-FR")}</td>
				<td>${r["% Voix/Ins"].toFixed(2)}%</td>
				<td>${r["% Voix/Exp"].toFixed(2)}%</td>
				<td>${sieges}</td>
				<td>${r["Sièges CC"]}</td>
			</tr>`;
  }).join("");
  const resultsTable = `
		<div class="table-scroll-container">
			<table class="results-table">
				<thead>
					<tr>
						<th>Liste conduite par</th>
						<th>Voix</th>
						<th>% inscrits</th>
						<th>% exprimés</th>
						<th>Sièges CM</th>
						<th>Sièges CC</th>
					</tr>
				</thead>
				<tbody>
					${resultsTableRows}
				</tbody>
			</table>
		</div>
	`;
  const firstPlace = resultats[0];
  const secondPlace = resultats[1];
  const exprimes = tourDecisif.Exprimés;
  let formulaDecisive = "";
  if (hasSecondTour) {
    formulaDecisive = `${explanationDecisive}
<br><br>
<strong>Formule :</strong> Voix de la 1ère liste − Voix de la 2e liste au second tour
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlace.Voix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste : ${secondPlace.Voix.toLocaleString("fr-FR")}
<br>• Écart : ${firstPlace.Voix.toLocaleString("fr-FR")} − ${secondPlace.Voix.toLocaleString("fr-FR")} = ${votesDecisifs.toLocaleString("fr-FR")} voix
		<br><br><strong>Résultats du ${tourLabel} :</strong>
		${resultsTable}`;
  } else {
    const moitieExprimes = Math.round(exprimes / 2);
    formulaDecisive = `${explanationDecisive}
<br><br>
<strong>Formule :</strong> Voix de la 1ère liste − (Exprimés ÷ 2) au premier tour
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlace.Voix.toLocaleString("fr-FR")}
<br>• Exprimés : ${exprimes.toLocaleString("fr-FR")}
<br>• Majorité (Exprimés ÷ 2) : ${moitieExprimes.toLocaleString("fr-FR")}
<br>• Marge au-dessus de la majorité : ${firstPlace.Voix.toLocaleString("fr-FR")} − ${moitieExprimes.toLocaleString("fr-FR")} = ${votesDecisifs.toLocaleString("fr-FR")} voix
		<br><br><strong>Résultats du ${tourLabel} :</strong>
		${resultsTable}`;
  }
  const votants = tourDecisif.Votants;
  const formulaNonVotants = `${explanationNonVoting}
<br><br>
<strong>Formule :</strong> Population 18-39 ans × Taux d'abstention
<br><br>
<strong>Détail :</strong>
<br>• Population 18-39 ans : ${pop1839.toLocaleString("fr-FR")}
<br>• Population 18+ ans : ${pop18Plus.toLocaleString("fr-FR")}
<br>• Votants : ${votants.toLocaleString("fr-FR")}
<br>• Taux d'abstention : ${(partNeVotantPas * 100).toFixed(1)}% = (${pop18Plus.toLocaleString("fr-FR")} − ${votants.toLocaleString("fr-FR")}) ÷ ${pop18Plus.toLocaleString("fr-FR")}
<br>• Non-votants 18-39 ans estimés : ${pop1839.toLocaleString("fr-FR")} × ${(partNeVotantPas * 100).toFixed(1)}% = ${nonVotants1839.toLocaleString("fr-FR")}`;
  window.detailData = {
    decisive: {
      title: "Calcul des votes décisifs",
      formula: formulaDecisive,
      source: electionSource
    },
    nonVoting: {
      title: "Calcul des non-votants 18-39 ans",
      formula: formulaNonVotants,
      source: nonVotingSource
    }
  };
  const html = `
        <div class="city-detail">

			<!-- Main Stat: Decisive Votes -->
			<div class="main-stat">
				<div class="main-number">${votesDecisifs.toLocaleString("fr-FR")}</div>
				<div class="main-label">${mainTagline}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('decisive'); return false;">Détail</a>
			</div>

            <!-- Secondary Stat: Non-Voting Youth -->
            <div class="secondary-stat">
                <div class="secondary-number">${nonVotants1839.toLocaleString("fr-FR")}</div>
                <div class="secondary-label">jeunes de 18-39 ans<br>n'ont pas voté</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('nonVoting'); return false;">Détail</a>
            </div>

            <!-- CTA Buttons -->
            <div class="cta-section">
                <a href="https://www.service-public.fr/particuliers/vosdroits/R16396" target="_blank" class="cta-button">
                    POUR 2026,<br>INSCRIS TOI EN 1 MINUTE<span class="emoji">\uD83D\uDD25</span>
                </a>
            </div>
            <div class="cta-section">
                <button type="button" class="cta-button" onclick="openQomonModal()">
                    REJOINS LE MOUVEMENT<span class="emoji">✊</span>
                </button>
            </div>

        </div>
    `;
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
window.navigateToCityById = navigateToCityById;
window.openQomonModal = openQomonModal;
window.closeQomonModal = closeQomonModal;
window.openDetailModal = openDetailModal;
window.openDetailModalByKey = openDetailModalByKey;
window.closeDetailModal = closeDetailModal;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
