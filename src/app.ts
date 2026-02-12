import type { City, CitySearchResult } from "./dtos/city";
import { normalizeText } from "./utils";
import {
	messages,
	labels,
	getMainTagline,
	formatExplanationDecisive,
	formatFormulaDecisiveSecondTour,
	formatFormulaDecisivePremierTour,
	formatExplanationNonVoting,
	formatFormulaNonVotants,
	formatResultsTable,
	formatAggregationWarning,
	formatCityDetailHtml,
	getElectionSourceUrl,
	nonVotingSourceUrl,
	formatSearchResultItem,
	formatSearchInputValue,
	generateShareImage,
} from "./format";

// Access code configuration
const ACCESS_CODE = "ONBASCULE";
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
			error.textContent = messages.codeIncorrect;
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

// Current city data for sharing
let currentCityData: {
	cityName: string;
	codeDepartement: string;
	votesDecisifs: number;
	nonVotants1839: number;
	hasSecondTour: boolean;
} | null = null;

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

	resultsDiv.innerHTML = `<p class="loading">${messages.rechercheEnCours}</p>`;

	try {
		const normalized = normalizeText(query);
		const partition = getPartitionKey(normalized);
		const searchIndex = await loadSearchPartition(partition);

		const citiesData: CitySearchResult[] = searchIndex[normalized];

		if (!citiesData || citiesData.length === 0) {
			resultsDiv.innerHTML = `<p class="error">${messages.aucuneVille}</p>`;
			return;
		}

		// Display results directly from search data (no need to fetch each city)
		displaySearchResults(citiesData.slice(0, 50));
	} catch (error) {
		console.error("Search error:", error);
		resultsDiv.innerHTML = `<p class="error">${messages.erreurRecherche}</p>`;
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
		resultsDiv.innerHTML = `<p class="error">${messages.aucuneVille}</p>`;
		return;
	}

	// cities is now an array of [id, name, code_departement]
	const html = cities
		.map((city) => {
			const [id, name, codeDepartement] = city;
			return formatSearchResultItem(id, name, codeDepartement);
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
		if (searchInput) searchInput.value = formatSearchInputValue(city.nom_standard, city.code_departement);
	}
}

// Load and display city by slug
async function loadCityBySlug(slug: string): Promise<void> {
	const cityDetailDiv = document.getElementById("cityDetail");

	if (!cityDetailDiv) return;

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
		cityDetailDiv.innerHTML =
			`<p class="error">${messages.erreurChargementVille}</p>`;
	}
}

// Display city detail
function displayCityDetail(city: City): void {
	const cityDetailDiv = document.getElementById("cityDetail");

	if (!cityDetailDiv) return;

	// Update search input with city name
	const searchInput = document.getElementById("searchInput") as HTMLInputElement;
	if (searchInput) searchInput.value = formatSearchInputValue(city.nom_standard, city.code_departement);

	if (!city.Analyse) {
		cityDetailDiv.innerHTML = `<p class="error">${messages.analyseNonDisponible}</p>`;
		return;
	}

	const votesDecisifs = city.Analyse["Votes décisifs"];
	const hasSecondTour = !!city["Tour 2"];

	// Build explanation for decisive votes
	const explanationDecisive = formatExplanationDecisive(
		city.nom_standard,
		city.code_departement,
		votesDecisifs,
		hasSecondTour,
	);

	// Build election source URL
	const electionSource = getElectionSourceUrl(city.code_departement, city.code_commune);

	// Build explanation for non-voting
	const pop1839 = city.Analyse["Pop 18-39"];
	const pop18Plus = city.Analyse["Pop 18+"];
	const nonVotants = city.Analyse["Non votants"];
	const partNeVotantPas = city.Analyse["Part ne votant pas"];
	const explanationNonVoting = formatExplanationNonVoting(
		city.nom_standard,
		city.code_departement,
		pop1839,
		partNeVotantPas,
		nonVotants,
		pop18Plus,
	);

	// Determine tagline based on whether there was a second round
	const mainTagline = getMainTagline(hasSecondTour);

	const nonVotants1839 = Math.round(city.Analyse["Non votants de 18-39"]);

	// Store current city data for sharing
	currentCityData = {
		cityName: city.nom_standard,
		codeDepartement: city.code_departement,
		votesDecisifs,
		nonVotants1839,
		hasSecondTour,
	};

	// Build results table for the decisive tour
	const tourDecisif = hasSecondTour ? city["Tour 2"]! : city["Tour 1"];
	const tourLabel = hasSecondTour ? labels.tour2 : labels.tour1;
	const resultats = [...tourDecisif.resultats].sort((a, b) => b.Voix - a.Voix);

	const resultsTable = formatResultsTable(resultats);

	// Build formula explanations for the detail dialogs
	const firstPlace = resultats[0];
	const secondPlace = resultats[1];
	const exprimes = tourDecisif.Exprimés;

	let formulaDecisive = "";
	if (hasSecondTour && secondPlace) {
		formulaDecisive = formatFormulaDecisiveSecondTour(
			explanationDecisive,
			firstPlace.Voix,
			secondPlace.Voix,
			votesDecisifs,
			tourLabel,
			resultsTable,
		);
	} else {
		formulaDecisive = formatFormulaDecisivePremierTour(
			explanationDecisive,
			firstPlace.Voix,
			exprimes,
			votesDecisifs,
			tourLabel,
			resultsTable,
		);
	}

	const votants = tourDecisif.Votants;
	const formulaNonVotants = formatFormulaNonVotants(
		explanationNonVoting,
		pop1839,
		pop18Plus,
		votants,
		partNeVotantPas,
		nonVotants1839,
	);

	// Store detail data in global object for modal access
	window.detailData = {
		decisive: {
			title: labels.modalTitles.votesDecisifs,
			formula: formulaDecisive,
			source: electionSource,
		},
		nonVoting: {
			title: labels.modalTitles.nonVotants,
			formula: formulaNonVotants,
			source: nonVotingSourceUrl,
		},
	};

	// Build aggregation warning if applicable
	const aggregationWarning = formatAggregationWarning(city.communesAgregees || []);

	const html = formatCityDetailHtml(
		votesDecisifs,
		mainTagline,
		nonVotants1839,
		aggregationWarning,
	);

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

// Show the share success modal with the image
function showShareModal(imageUrl: string): void {
	// Create modal if it doesn't exist
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

	// Update image
	const img = modal.querySelector(".share-modal-image") as HTMLImageElement;
	if (img) img.src = imageUrl;

	modal.classList.add("show");
	document.body.style.overflow = "hidden";
}

// Close the share modal
function closeShareModal(): void {
	const modal = document.getElementById("shareModal");
	if (modal) {
		modal.classList.remove("show");
		document.body.style.overflow = "";
	}
}

// Share city data via clipboard with generated image
async function shareCity(): Promise<void> {
	if (!currentCityData) {
		console.error("No city data available for sharing");
		return;
	}

	const { cityName, votesDecisifs } = currentCityData;

	try {
		// Generate the share image
		const imageBlob = await generateShareImage(
			cityName,
			votesDecisifs,
		);

		// Create image URL for display
		const imageUrl = URL.createObjectURL(imageBlob);

		// Try to copy to clipboard
		if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
			try {
				// Copy image to clipboard
				const clipboardItem = new ClipboardItem({
					"image/png": imageBlob,
				});
				await navigator.clipboard.write([clipboardItem]);

				// Show success modal with image
				showShareModal(imageUrl);
			} catch (clipboardError) {
				console.error("Clipboard error:", clipboardError);
				// Fallback: show modal with download option
				showShareModalWithDownload(imageUrl, cityName);
			}
		} else {
			// Clipboard API not supported: show modal with download option
			showShareModalWithDownload(imageUrl, cityName);
		}
	} catch (error) {
		console.error("Error sharing:", error);
		alert("Erreur lors du partage. Réessaie !");
	}
}

// Show share modal with download button (fallback)
function showShareModalWithDownload(imageUrl: string, cityName: string): void {
	// Create modal if it doesn't exist
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
				TÉLÉCHARGER<span class="emoji">📥</span>
			</a>
		</div>
	`;

	modal.classList.add("show");
	document.body.style.overflow = "hidden";
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
		shareCity: () => Promise<void>;
		closeShareModal: () => void;
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
window.shareCity = shareCity;
window.closeShareModal = closeShareModal;

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initApp);
} else {
	initApp();
}
