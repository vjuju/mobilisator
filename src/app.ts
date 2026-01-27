import type { City, CitySearchResult } from "./dtos/city";
import { normalizeText } from "./utils";

// Access code configuration
const ACCESS_CODE = "OEP";
const ACCESS_STORAGE_KEY = "mobilisator_access_granted";

// Check if access has been granted
function hasAccess(): boolean {
	return localStorage.getItem(ACCESS_STORAGE_KEY) === "true";
}

// Grant access and hide the gate
function grantAccess(): void {
	localStorage.setItem(ACCESS_STORAGE_KEY, "true");
	hideAccessGate();
}

// Show the access gate overlay
function showAccessGate(): void {
	const gate = document.getElementById("accessGate");
	const mainContent = document.getElementById("mainContent");
	if (gate) gate.classList.add("show");
	if (mainContent) mainContent.classList.add("hidden");
}

// Hide the access gate and show main content
function hideAccessGate(): void {
	const gate = document.getElementById("accessGate");
	const mainContent = document.getElementById("mainContent");
	if (gate) gate.classList.remove("show");
	if (mainContent) mainContent.classList.remove("hidden");

	// Initialize the rest of the app after access is granted
	handleRoute();
	window.addEventListener("popstate", handleRoute);

	// Set up search input handlers
	const searchInput = document.getElementById("searchInput") as HTMLInputElement;
	if (searchInput) {
		searchInput.addEventListener("focus", () => {
			searchInput.value = "";
			clearResults();
		});

		searchInput.addEventListener(
			"input",
			debounce(() => {
				searchCities();
			}, 80),
		);

		searchInput.addEventListener("keypress", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				if (searchTimeout !== null) {
					clearTimeout(searchTimeout);
				}
				searchCities();
			}
		});
	}
}

// Validate the access code
function validateAccessCode(): void {
	const input = document.getElementById("accessCodeInput") as HTMLInputElement;
	const error = document.getElementById("accessError");
	if (!input) return;

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

// Initialize access gate
function initAccessGate(): void {
	const input = document.getElementById("accessCodeInput") as HTMLInputElement;
	const button = document.getElementById("accessCodeSubmit");

	if (input) {
		input.addEventListener("keypress", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				validateAccessCode();
			}
		});
	}

	if (button) {
		button.addEventListener("click", validateAccessCode);
	}
}

// Get the base path for assets (handles GitHub Pages subdirectory deployment)
const getBasePath = (): string => {
	const path = window.location.pathname;
	// If we're at /Mobilisator/ or /Mobilisator/something, base is /Mobilisator/
	// If we're at / or /something, base is /
	const match = path.match(/^(\/[^/]+\/)/);
	if (match && match[1] !== "/") {
		return match[1];
	}
	return "/";
};

const BASE_PATH = getBasePath();

// Router and app state
let searchTimeout: number | null = null;

// Cache for loaded data
const searchIndexCache: Record<string, Record<string, CitySearchResult[]>> = {};
let citiesDataCache: Record<number, City> | null = null;
let slugMapCache: Record<string, number> | null = null;

// Get partition key for a query (first character)
function getPartitionKey(query: string): string {
	const firstChar = query.charAt(0).toLowerCase();
	if (firstChar >= "a" && firstChar <= "z") {
		return firstChar;
	}
	return "0"; // Numbers and other characters
}

// Load a search partition if not already cached
async function loadSearchPartition(
	partition: string,
): Promise<Record<string, CitySearchResult[]>> {
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

// Load cities data if not already cached
async function loadCitiesData(): Promise<Record<number, City>> {
	if (citiesDataCache) {
		return citiesDataCache;
	}
	const response = await fetch(`${BASE_PATH}cities/cities-data.json`);
	if (!response.ok) {
		throw new Error("Failed to load cities data");
	}
	citiesDataCache = await response.json();
	return citiesDataCache!;
}

// Load slug map if not already cached
async function loadSlugMap(): Promise<Record<string, number>> {
	if (slugMapCache) {
		return slugMapCache;
	}
	const response = await fetch(`${BASE_PATH}cities/slug-map.json`);
	if (!response.ok) {
		throw new Error("Failed to load slug map");
	}
	slugMapCache = await response.json();
	return slugMapCache!;
}

// Debounce function
function debounce(func: () => void, delay: number): () => void {
	return () => {
		if (searchTimeout !== null) {
			clearTimeout(searchTimeout);
		}
		searchTimeout = window.setTimeout(() => func(), delay);
	};
}

// Initialize the app
function initApp(): void {
	// Initialize access gate handlers
	initAccessGate();

	// Check if access is granted
	if (!hasAccess()) {
		showAccessGate();
		return;
	}

	// Handle initial route
	handleRoute();

	// Listen for browser back/forward
	window.addEventListener("popstate", handleRoute);

	// Real-time search as user types
	const searchInput = document.getElementById(
		"searchInput",
	) as HTMLInputElement;
	if (searchInput) {
		// Clear input on focus
		searchInput.addEventListener("focus", () => {
			searchInput.value = "";
			clearResults();
		});

		searchInput.addEventListener(
			"input",
			debounce(() => {
				searchCities();
			}, 80),
		);

		// Also handle Enter key
		searchInput.addEventListener("keypress", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				if (searchTimeout !== null) {
					clearTimeout(searchTimeout);
				}
				searchCities();
			}
		});
	}
}

// Handle routing based on current URL
async function handleRoute(): Promise<void> {
	const path = window.location.pathname;
	// Remove base path to get the relative path
	const relativePath = path.startsWith(BASE_PATH)
		? path.slice(BASE_PATH.length)
		: path.substring(1);

	if (relativePath === "" || relativePath === "index.html") {
		// Home page - clear city detail
		const cityDetailDiv = document.getElementById("cityDetail");
		if (cityDetailDiv) cityDetailDiv.innerHTML = "";
	} else {
		// Extract slug from path (e.g., 76100-rouen)
		const slug = relativePath.replace(".html", "");
		await loadCityBySlug(slug);
	}
}

// Clear search results
function clearResults(): void {
	const results = document.getElementById("results");
	if (results) results.innerHTML = "";
}

// Search cities by name or postal code
async function searchCities(): Promise<void> {
	const searchInput = document.getElementById(
		"searchInput",
	) as HTMLInputElement;
	const resultsDiv = document.getElementById("results");

	if (!searchInput || !resultsDiv) return;

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

		const citiesData: CitySearchResult[] = searchIndex[normalized];

		if (!citiesData || citiesData.length === 0) {
			resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
			return;
		}

		// Display results directly from search data (no need to fetch each city)
		displaySearchResults(citiesData.slice(0, 50));
	} catch (error) {
		console.error("Search error:", error);
		resultsDiv.innerHTML = '<p class="error">Erreur lors de la recherche</p>';
	}
}

// Fetch city by ID
async function fetchCityById(id: number): Promise<City | null> {
	try {
		const citiesData = await loadCitiesData();
		return citiesData[id] || null;
	} catch (error) {
		console.error(`Error fetching city ${id}:`, error);
		return null;
	}
}

// Fetch city by slug
async function fetchCityBySlug(slug: string): Promise<City | null> {
	try {
		const slugMap = await loadSlugMap();
		const id = slugMap[slug];
		if (id === undefined) return null;
		return fetchCityById(id);
	} catch (error) {
		console.error(`Error fetching city ${slug}:`, error);
		return null;
	}
}

// Display search results
function displaySearchResults(cities: CitySearchResult[]): void {
	const resultsDiv = document.getElementById("results");

	if (!resultsDiv) return;

	if (cities.length === 0) {
		resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
		return;
	}

	// cities is now an array of [id, name, code_departement]
	const html = cities
		.map((city) => {
			const [id, name, codeDepartement] = city;
			return `
            <div class="result-item" onclick="navigateToCityById(${id})">
                <h3>${name} (${codeDepartement})</h3>
            </div>
        `;
		})
		.join("");

	resultsDiv.innerHTML = html;
}

// Navigate to city page by ID
async function navigateToCityById(id: number): Promise<void> {
	// First load the city to get its slug
	const city = await fetchCityById(id);
	if (city?.slug) {
		window.history.pushState({}, "", `${BASE_PATH}${city.slug}`);
		displayCityDetail(city);
		clearResults();
		// Update search input with city name
		const searchInput = document.getElementById("searchInput") as HTMLInputElement;
		if (searchInput) searchInput.value = `${city.nom_standard} (${city.code_departement})`;
	}
}

// Load and display city by slug
async function loadCityBySlug(slug: string): Promise<void> {
	const cityDetailDiv = document.getElementById("cityDetail");

	if (!cityDetailDiv) return;

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
		cityDetailDiv.innerHTML =
			'<p class="error">Erreur lors du chargement de la ville</p>';
	}
}

// Display city detail
function displayCityDetail(city: City): void {
	const cityDetailDiv = document.getElementById("cityDetail");

	if (!cityDetailDiv) return;

	// Update search input with city name
	const searchInput = document.getElementById("searchInput") as HTMLInputElement;
	if (searchInput) searchInput.value = `${city.nom_standard} (${city.code_departement})`;

	if (!city.Analyse) {
		cityDetailDiv.innerHTML = '<p class="error">Données d\'analyse non disponibles pour cette ville</p>';
		return;
	}

	const votesDecisifs = city.Analyse["Votes décisifs"];
	const hasSecondTour = !!city["Tour 2"];

	// Build explanation for decisive votes
	let explanationDecisive = "";
	if (hasSecondTour) {
		// Second round - show gap between first and second place
		explanationDecisive = `Lors des municipales de 2020, à ${city.nom_standard} (${city.code_departement}), l'écart de voix au second tour entre la 1ère et la 2e liste était de ${votesDecisifs.toLocaleString("fr-FR")} voix.`;
	} else {
		// First round win - show margin above majority
		explanationDecisive = `Lors des municipales de 2020, à ${city.nom_standard} (${city.code_departement}), la 1ère liste a obtenu ${votesDecisifs.toLocaleString("fr-FR")} voix au-dessus de la majorité au premier tour.`;
	}

	// Build election source URL
	const deptCode = city.code_departement.padStart(3, "0");
	const electionSource = `https://www.archives-resultats-elections.interieur.gouv.fr/resultats/municipales-2020/${deptCode}/${deptCode}${city.code_commune}.php`;

	// Build explanation for non-voting
	const pop1839 = city.Analyse["Pop 18-39"];
	const pop18Plus = city.Analyse["Pop 18+"];
	const nonVotants = city.Analyse["Non votants"];
	const partNeVotantPas = city.Analyse["Part ne votant pas"];
	const explanationNonVoting = `Lors des municipales de 2020, ${city.nom_standard} (${city.code_departement}) compte ${pop1839.toLocaleString("fr-FR")} jeunes de 18 à 39 ans et en moyenne ${(partNeVotantPas * 100).toFixed(1)}% de la population majeure n'a pas voté à ${city.nom_standard} (${nonVotants.toLocaleString("fr-FR")} non votants / ${pop18Plus.toLocaleString("fr-FR")} majeur·es).`;

	const nonVotingSource = "https://explore.data.gouv.fr/fr/datasets/6627b6fd7291f9d8a62d9997/#/resources/b8ad4a63-a4e3-4ef2-af6e-b08ef3b8084d";

	// Determine tagline based on whether there was a second round
	const mainTagline = hasSecondTour
		? "votes suffisaient pour élire un autre maire"
		: "votes suffisaient à l'opposition pour aller au second tour";

	const nonVotants1839 = Math.round(city.Analyse["Non votants de 18-39"]);

	// Build results table for the decisive tour
	const tourDecisif = hasSecondTour ? city["Tour 2"]! : city["Tour 1"];
	const tourLabel = hasSecondTour ? "2nd tour" : "1er tour";
	const resultats = [...tourDecisif.resultats].sort((a, b) => b.Voix - a.Voix);

	let resultsTableRows = resultats
		.map((r) => {
			const titre = r.Sexe === "F" ? "Mme" : "M.";
			const sieges = typeof r["Sièges / Elu"] === "number" ? r["Sièges / Elu"] : (r["Sièges / Elu"] === "Oui" ? "Élu" : r["Sièges / Elu"]);
			return `<tr>
				<td>${titre} ${r.Prénom} ${r.Nom}</td>
				<td>${r.Voix.toLocaleString("fr-FR")}</td>
				<td>${r["% Voix/Ins"].toFixed(2)}%</td>
				<td>${r["% Voix/Exp"].toFixed(2)}%</td>
				<td>${sieges}</td>
				<td>${r["Sièges CC"]}</td>
			</tr>`;
		})
		.join("");

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

	// Build formula explanations for the detail dialogs
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

	// Store detail data in global object for modal access
	window.detailData = {
		decisive: {
			title: "Calcul des votes décisifs",
			formula: formulaDecisive,
			source: electionSource,
		},
		nonVoting: {
			title: "Calcul des non-votants 18-39 ans",
			formula: formulaNonVotants,
			source: nonVotingSource,
		},
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
                    POUR 2026,<br>INSCRIS TOI EN 1 MINUTE<span class="emoji">🔥</span>
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

// Open the Qomon modal
function openQomonModal(): void {
	// Create modal if it doesn't exist
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

		// Trigger Qomon form initialization
		const qomonForm = modal.querySelector(".qomon-form");
		if (qomonForm) {
			const clone = qomonForm.cloneNode(true);
			qomonForm.parentNode?.replaceChild(clone, qomonForm);
		}
	}

	modal.classList.add("show");
	document.body.style.overflow = "hidden";
}

// Close the Qomon modal
function closeQomonModal(): void {
	const modal = document.getElementById("qomonModal");
	if (modal) {
		modal.classList.remove("show");
		document.body.style.overflow = "";
	}
}

// Open the detail modal
function openDetailModal(title: string, formula: string, sourceUrl: string): void {
	// Create modal if it doesn't exist
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

	// Update content
	const titleEl = modal.querySelector(".detail-modal-title");
	const formulaEl = modal.querySelector(".detail-modal-formula");
	const sourceLink = modal.querySelector(".detail-modal-source a") as HTMLAnchorElement;

	if (titleEl) titleEl.textContent = title;
	if (formulaEl) formulaEl.innerHTML = formula;
	if (sourceLink) {
		sourceLink.href = sourceUrl;
		sourceLink.textContent = sourceUrl;
	}

	modal.classList.add("show");
	document.body.style.overflow = "hidden";
}

// Close the detail modal
function closeDetailModal(): void {
	const modal = document.getElementById("detailModal");
	if (modal) {
		modal.classList.remove("show");
		document.body.style.overflow = "";
	}
}

// Open detail modal by key (reads from window.detailData)
function openDetailModalByKey(key: string): void {
	const data = window.detailData?.[key];
	if (data) {
		openDetailModal(data.title, data.formula, data.source);
	}
}

// Type for detail data
interface DetailDataItem {
	title: string;
	formula: string;
	source: string;
}

// Make functions available globally for onclick handlers
declare global {
	interface Window {
		navigateToCityById: (id: number) => Promise<void>;
		openQomonModal: () => void;
		closeQomonModal: () => void;
		openDetailModal: (title: string, formula: string, sourceUrl: string) => void;
		openDetailModalByKey: (key: string) => void;
		closeDetailModal: () => void;
		detailData?: Record<string, DetailDataItem>;
		init?: () => void; // Qomon setup.js global init function
	}
}

window.navigateToCityById = navigateToCityById;
window.openQomonModal = openQomonModal;
window.closeQomonModal = closeQomonModal;
window.openDetailModal = openDetailModal;
window.openDetailModalByKey = openDetailModalByKey;
window.closeDetailModal = closeDetailModal;

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initApp);
} else {
	initApp();
}
