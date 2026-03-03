import type { City, CitySearchResult } from "./dtos/city";
import { normalizeText } from "./utils";
import {
	messages,
	labels,
	computeVotesDecisifs,
	getMainTagline,
	formatFormulaDecisiveCas1,
	formatFormulaDecisiveCas2,
	formatFormulaDecisiveCas3,
	formatFormulaDecisiveCas3b,
	formatFormulaDecisiveCas2b,
	formatExplanationNonVoting,
	formatFormulaNonVotants,
	formatResultsTable,
	formatAggregationWarning,
	formatCityDetailHtml,
	getElectionSourceUrl,
	nonVotingSourceUrl,
	formatSearchResultItem,
	formatSearchInputValue,
} from "./format";

// Get the base path for assets (handles GitHub Pages subdirectory deployment)
const getBasePath = (): string => {
	const path = window.location.pathname;
	const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
	if (!firstSegment) return "/";

	// Route like /123-456-ville or /ZN-822-ville are city slugs, not deployment subdirectories.
	const looksLikeCitySlug = /^([a-z]{1,3}|\d{1,3})-\d+/i.test(firstSegment);
	// Route like /index.html or /mentions-legales.html should stay on root.
	const looksLikeFile = firstSegment.includes(".");
	if (looksLikeCitySlug || looksLikeFile) return "/";

	// Keep support for subdirectory deployments (e.g. GitHub Pages /Mobilisator/).
	return `/${firstSegment}/`;
};

const getAbsolutePath = (relativePath: string): string => {
	const normalized = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
	return new URL(`${BASE_PATH}${normalized}`, window.location.origin).toString();
};

const BASE_PATH = getBasePath();

// Router and app state
let searchTimeout: number | null = null;

// Cache for loaded data
const searchIndexCache: Record<string, Record<string, CitySearchResult[]>> = {};
let citiesDataCache: Record<number, City> | null = null;
let slugMapCache: Record<string, number> | null = null;

// Current image blob for the influ panel (used by copy button)
let currentInfluBlob: Blob | null = null;

// Current city data for sharing
let currentCityData: {
	citySlug: string;
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
	// Nav brand click → navigate home (SPA)
	const navBrand = document.getElementById("navBrand");
	if (navBrand) {
		navBrand.addEventListener("click", (e) => {
			e.preventDefault();
			window.history.pushState({}, "", BASE_PATH);
			handleRoute();
		});
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

// Update visibility of all panels based on current URL querystring
function updatePanelVisibility(): void {
	const params = new URLSearchParams(window.location.search);
	const jememobilise = params.get("jememobilise") === "true";
	const how = params.get("how") === "true";
	const agenda = params.get("agenda") === "true";
	const influ = params.get("influ") === "true";
	const jerejoins = params.get("jerejoins") === "true";

	const setHidden = (id: string, hide: boolean) => {
		const el = document.getElementById(id);
		if (el) el.classList.toggle("hidden", hide);
	};

	setHidden("howPanel", !(jememobilise && how && !agenda));
	setHidden("agendaPanel", !(jememobilise && how && agenda));
	setHidden("influPanel", !(jememobilise && influ && !jerejoins));
	setHidden("rejoinPanel", !(jememobilise && jerejoins));

	// Toggle navbar: show back button when any panel is open
	const anyPanelOpen = jememobilise && (how || influ || jerejoins);
	setHidden("navBrand", anyPanelOpen);
	setHidden("navBack", !anyPanelOpen);
}

// Handle routing based on current URL
async function handleRoute(): Promise<void> {
	const path = window.location.pathname;
	// Remove base path to get the relative path
	const relativePath = path.startsWith(BASE_PATH)
		? path.slice(BASE_PATH.length)
		: path.substring(1);

	// Update all panel visibility
	updatePanelVisibility();

	if (relativePath === "" || relativePath === "index.html") {
		// Home page - clear city detail, show landing text
		const cityDetailDiv = document.getElementById("cityDetail");
		if (cityDetailDiv) cityDetailDiv.innerHTML = "";
		const landingText = document.getElementById("landingText");
		if (landingText) landingText.classList.remove("hidden");
		const searchInput = document.getElementById("searchInput") as HTMLInputElement;
		document.title = "#RIENSANSNOUS - Municipales 2020";
		(document.getElementById("canonicalTag") as HTMLLinkElement | null)?.setAttribute("href", "https://mobilisator.fr/");
		// Handle ?q= parameter (from Google Sitelinks Search Box)
		const qParam = new URLSearchParams(window.location.search).get("q");
		if (qParam && searchInput) {
			searchInput.value = qParam;
			await searchCities();
		} else {
			if (searchInput) searchInput.value = "";
			clearResults();
		}
	} else {
		// Extract slug from path (e.g., 76100-rouen)
		const landingText = document.getElementById("landingText");
		if (landingText) landingText.classList.add("hidden");
		const slug = relativePath.replace(".html", "");
		await loadCityBySlug(slug);
	}

	// Trigger share flow when influ panel is shown and container is empty
	// (browser back/forward or direct deep link).
	const params = new URLSearchParams(window.location.search);
	if (
		params.get("jememobilise") === "true" &&
		params.get("influ") === "true" &&
		params.get("jerejoins") !== "true"
	) {
		const container = document.getElementById("influImageContainer");
		if (container && container.innerHTML === "") {
			container.innerHTML = getInfluLoadingHtml();
			void shareCity();
		}
	}
}

// Matomo event tracking helper — sets custom dimension 1 (Ville) then sends the event
function matomoTrack(category: string, action: string): void {
	const paq: unknown[][] = (window as unknown as { _paq: unknown[][] })._paq ?? [];
	if (currentCityData?.cityName) {
		paq.push(["setCustomDimension", 1, currentCityData.cityName]);
	}
	paq.push(["trackEvent", category, action, currentCityData?.cityName ?? ""]);
}

// Open how-to-vote panel
function openHowPanel(): void {
	matomoTrack("CTA", "comment_voter");
	const url = new URL(window.location.href);
	url.searchParams.set("jememobilise", "true");
	url.searchParams.set("how", "true");
	window.history.pushState({}, "", url.toString());
	updatePanelVisibility();
}

// Open agenda panel (calendar options)
function openAgendaPanel(): void {
	matomoTrack("Comment voter", "agenda");
	const url = new URL(window.location.href);
	url.searchParams.set("jememobilise", "true");
	url.searchParams.set("how", "true");
	url.searchParams.set("agenda", "true");
	window.history.pushState({}, "", url.toString());
	updatePanelVisibility();
}

const getInfluLoadingHtml = (): string =>
	`<div class="influ-loading">Image en cours de création<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;

// Open influ/share panel and trigger share flow
async function openInfluPanel(): Promise<void> {
	matomoTrack("CTA", "informer_potes");
	const container = document.getElementById("influImageContainer");
	if (container) container.innerHTML = getInfluLoadingHtml();

	const url = new URL(window.location.href);
	url.searchParams.set("jememobilise", "true");
	url.searchParams.set("influ", "true");
	window.history.pushState({}, "", url.toString());
	updatePanelVisibility();

	await shareCity();
}

// Open Qomon rejoins panel
function openRejoinPanel(): void {
	matomoTrack("CTA", "se_mobiliser");
	const url = new URL(window.location.href);
	url.searchParams.set("jememobilise", "true");
	url.searchParams.set("jerejoins", "true");
	window.history.pushState({}, "", url.toString());
	updatePanelVisibility();
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
		// Track SPA navigation in Matomo
		const paq: unknown[][] = (window as unknown as { _paq: unknown[][] })._paq ?? [];
		paq.push(["setCustomUrl", window.location.href]);
		paq.push(["setDocumentTitle", city.nom_standard]);
		paq.push(["trackPageView"]);
		displayCityDetail(city);
		matomoTrack("Search", "ville_selectionnee");
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

	// Hide landing text when city is shown
	const landingText = document.getElementById("landingText");
	if (landingText) landingText.classList.add("hidden");

	// Update search input with city name
	const searchInput = document.getElementById("searchInput") as HTMLInputElement;
	if (searchInput) searchInput.value = formatSearchInputValue(city.nom_standard, city.code_departement);

	if (!city.Analyse) {
		cityDetailDiv.innerHTML = `<p class="error">${messages.analyseNonDisponible}</p>`;
		return;
	}

	const hasSecondTour = !!city["Tour 2"];

	// Compute votes décisifs at runtime using the new 3-case formula
	const { votesDecisifs, cas } = computeVotesDecisifs(city["Tour 1"], city["Tour 2"]);

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

	// Determine tagline
	const mainTagline = getMainTagline(cas, votesDecisifs);

	const nonVotants1839 = Math.round(city.Analyse["Non votants de 18-39"]);

	// Update page title and canonical for SEO
	document.title = `${city.nom_standard} — ${votesDecisifs.toLocaleString("fr-FR")} jeunes auraient fait la diff' | #RIENSANSNOUS`;
	(document.getElementById("canonicalTag") as HTMLLinkElement | null)?.setAttribute("href", `https://mobilisator.fr/${city.slug}`);

	// Store current city data for sharing
	currentCityData = {
		citySlug: city.slug,
		cityName: city.nom_standard,
		codeDepartement: city.code_departement,
		votesDecisifs,
		nonVotants1839,
		hasSecondTour,
	};

	// Set Matomo custom dimension 1 = Ville
	const paq: unknown[][] = (window as unknown as { _paq: unknown[][] })._paq ?? [];
	paq.push(["setCustomDimension", 1, city.nom_standard]);

	// Build results table for the decisive tour
	const tourDecisif = hasSecondTour ? city["Tour 2"]! : city["Tour 1"];
	const tourLabel = hasSecondTour ? labels.tour2 : labels.tour1;
	const resultats = [...tourDecisif.resultats].sort((a, b) => b.Voix - a.Voix);

	const resultsTable = formatResultsTable(resultats);

	// Build formula explanations for the detail dialogs (3 cases)
	const firstPlace = resultats[0];
	const secondPlace = resultats[1];
	const exprimes = tourDecisif.Exprimés;

	let formulaDecisive = "";
	if (cas === 1) {
		formulaDecisive = formatFormulaDecisiveCas1(
			city.nom_standard,
			city.code_departement,
			firstPlace.Voix,
			votesDecisifs,
			resultsTable,
		);
	} else if (cas === 2 && secondPlace) {
		formulaDecisive = formatFormulaDecisiveCas2(
			city.nom_standard,
			city.code_departement,
			firstPlace.Voix,
			secondPlace.Voix,
			votesDecisifs,
			tourLabel,
			resultsTable,
		);
	} else if (cas === "3b" && secondPlace) {
		formulaDecisive = formatFormulaDecisiveCas3b(
			city.nom_standard,
			city.code_departement,
			firstPlace.Voix,
			secondPlace.Voix,
			votesDecisifs,
			resultsTable,
		);
	} else if (cas === "2b") {
		// For Cas 2b, the formula uses Tour 1 data (Tour 2 had a single list)
		const tour1Resultats = [...city["Tour 1"].resultats]
			.filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix))
			.sort((a, b) => b.Voix - a.Voix);
		const tour1Table = formatResultsTable(tour1Resultats);
		const tour1First = tour1Resultats[0];
		const tour1Second = tour1Resultats[1];
		if (tour1First && tour1Second) {
			formulaDecisive = formatFormulaDecisiveCas2b(
				city.nom_standard,
				city.code_departement,
				tour1First.Voix,
				tour1Second.Voix,
				votesDecisifs,
				tour1Table,
			);
		}
	} else {
		formulaDecisive = formatFormulaDecisiveCas3(
			city.nom_standard,
			city.code_departement,
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

// Open Qomon modal / rejoins panel
function openQomonModal(): void {
	openRejoinPanel();
}

// Close the Qomon modal / rejoins panel
function closeQomonModal(): void {
	window.history.back();
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

const getRejoinButtonHtml = (): string => `
	<button type="button" class="cta-button" onclick="openRejoinPanel()">
		JE ME MOBILISE<br>AVEC ON EST PRÊT<span class="emoji">✊</span>
	</button>
`;

const appendRejoinButtonWhenImageReady = (
	container: HTMLElement,
	imageSelector = ".influ-image",
): void => {
	const maybeAppend = () => {
		if (!container.querySelector(".influ-image")) return;
		if (container.querySelector("[data-rejoin-btn='true']")) return;
		container.insertAdjacentHTML(
			"beforeend",
			`<div data-rejoin-btn="true">${getRejoinButtonHtml()}</div>`,
		);
	};

	const img = container.querySelector(imageSelector) as HTMLImageElement | null;
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

// Show the generated image in the influ panel with copy + download buttons
function showShareModal(imageUrl: string, cityName: string): void {
	const container = document.getElementById("influImageContainer");
	if (container) {
		container.innerHTML = `
			<div class="influ-title">Image générée 🎉</div>
			<img class="influ-image" src="${imageUrl}" alt="Image à partager">
			<div class="influ-actions">
				<button type="button" class="cta-button influ-copy-btn" onclick="copyInfluImage()">COPIER<span class="emoji">📋</span></button>
				<a href="${imageUrl}" download="mobilisator-${cityName}.png" class="cta-button" style="text-decoration:none;">TÉLÉCHARGER<span class="emoji">📥</span></a>
			</div>
		`;
		appendRejoinButtonWhenImageReady(container);
	}
}

// No-op: share is now handled by the influ panel
function closeShareModal(): void {}

// Copy the current influ image to clipboard
async function copyInfluImage(): Promise<void> {
	if (!currentInfluBlob) return;
	const clipboardSupportsPng =
		navigator.clipboard &&
		typeof ClipboardItem !== "undefined" &&
		(typeof ClipboardItem.supports !== "function" ||
			ClipboardItem.supports("image/png"));
	if (!clipboardSupportsPng) return;
	try {
		const pngBlob = await normalizeImageForClipboard(currentInfluBlob);
		await navigator.clipboard.write([new ClipboardItem({ "image/png": Promise.resolve(pngBlob) })]);
		const btn = document.querySelector<HTMLButtonElement>(".influ-copy-btn");
		if (btn) {
			const orig = btn.innerHTML;
			btn.innerHTML = "COPIÉ !<span class=\"emoji\">✓</span>";
			setTimeout(() => { btn.innerHTML = orig; }, 2000);
		}
	} catch (e) {
		console.error("Clipboard error:", e);
	}
}

const normalizeImageForClipboard = async (blob: Blob): Promise<Blob> => {
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

		const reencoded = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob((pngBlob) => resolve(pngBlob), "image/png"),
		);
		if (reencoded) return reencoded;
		return blob.type === "image/png" ? blob : new Blob([await blob.arrayBuffer()], { type: "image/png" });
	} catch {
		return blob.type === "image/png" ? blob : new Blob([await blob.arrayBuffer()], { type: "image/png" });
	}
};

interface OgAttemptDebug {
	url: string;
	finalUrl: string;
	status: number;
	ok: boolean;
	contentType: string;
	contentLength: string;
	redirected: boolean;
	blobSize: number;
	xOgImageMode: string;
	xOgSlug: string;
	xOgError: string;
	bodyPreview: string;
}

class OgFetchError extends Error {
	attempts: OgAttemptDebug[];

	constructor(message: string, attempts: OgAttemptDebug[]) {
		super(message);
		this.name = "OgFetchError";
		this.attempts = attempts;
	}
}

const safeResponsePreview = async (response: Response): Promise<string> => {
	try {
		const text = await response.clone().text();
		return text.slice(0, 240).replace(/\s+/g, " ").trim();
	} catch {
		return "";
	}
};

const canDecodeImageBlob = async (blob: Blob): Promise<boolean> => {
	try {
		const bitmap = await createImageBitmap(blob);
		bitmap.close();
		return true;
	} catch {
		return false;
	}
};

const createClientFallbackImageBlob = async (
	cityName: string,
	votesDecisifs: number,
): Promise<Blob> => {
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
	ctx.font = '700 38px Arial, sans-serif';
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

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob((pngBlob) => resolve(pngBlob), "image/png"),
	);
	if (!blob) {
		throw new Error("Client fallback image generation failed");
	}
	return blob;
};

const buildOgCandidateUrls = (citySlug: string): string[] => {
	const encodedSlug = encodeURIComponent(citySlug);
	return Array.from(
		new Set([
			new URL(`/og/${encodedSlug}.png`, window.location.origin).toString(),
			getAbsolutePath(`og/${encodedSlug}.png`),
			new URL(`/api/og/${encodedSlug}.png`, window.location.origin).toString(),
			getAbsolutePath(`api/og/${encodedSlug}.png`),
		]),
	);
};

const fetchOgImageWithDebug = async (
	citySlug: string,
): Promise<{ imageBlob: Blob; attempts: OgAttemptDebug[]; usedUrl: string }> => {
	const attempts: OgAttemptDebug[] = [];
	let candidates: string[] = [];

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
				bodyPreview: "",
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
			bodyPreview: "",
		});
		throw new OgFetchError(`No OG candidate URL for slug "${citySlug}"`, attempts);
	}

	for (const url of candidates) {
		let response: Response;
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
					bodyPreview: "",
				});
			continue;
		}

		const contentType = response.headers.get("content-type") ?? "";
		const debug: OgAttemptDebug = {
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
			bodyPreview: "",
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

// Share city data via clipboard with generated image (server-side via Cloudflare Pages Function)
async function shareCity(): Promise<void> {
	if (!currentCityData) {
		console.error("No city data available for sharing");
		return;
	}

	const { citySlug, cityName, votesDecisifs } = currentCityData;

	// Track share button click in Matomo
	matomoTrack("Share", "partager");
	// Yield to the browser to repaint before starting the fetch
	await new Promise<void>((r) => setTimeout(r, 0));

	try {
		let imageBlob: Blob;
		let attempts: OgAttemptDebug[] = [];
		try {
			const fetched = await fetchOgImageWithDebug(citySlug);
			imageBlob = fetched.imageBlob;
			attempts = fetched.attempts;
			console.info("OG_DEBUG success", { citySlug, usedUrl: fetched.usedUrl, attempts });
		} catch (error) {
			attempts =
				error instanceof OgFetchError
					? error.attempts
					: [
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
								bodyPreview: "",
							} satisfies OgAttemptDebug,
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
				bodyPreview: a.bodyPreview,
			}));
			console.error("Error sharing [OG_DEBUG]:", {
				citySlug,
				pageUrl: window.location.href,
				basePath: BASE_PATH,
				error,
				attempts,
			});
			console.table(attemptsSummary);
			imageBlob = await createClientFallbackImageBlob(cityName, votesDecisifs);
			console.warn("Using client-side fallback image", { citySlug });
		}

		// Create image URL for display
		currentInfluBlob = imageBlob;
		const imageUrl = URL.createObjectURL(imageBlob);

		// Try to copy to clipboard silently (supported browsers / secure contexts only)
		const clipboardSupportsPng =
			navigator.clipboard &&
			typeof ClipboardItem !== "undefined" &&
			(typeof ClipboardItem.supports !== "function" ||
				ClipboardItem.supports("image/png"));

		if (clipboardSupportsPng) {
			try {
				const pngBlob = await normalizeImageForClipboard(imageBlob);
				const clipboardItem = new ClipboardItem({ "image/png": Promise.resolve(pngBlob) });
				await navigator.clipboard.write([clipboardItem]);
			} catch (clipboardError) {
				console.error("Clipboard error:", clipboardError);
			}
		}
		showShareModal(imageUrl, cityName);
	} catch (error) {
		const container = document.getElementById("influImageContainer");
		if (container) {
			container.innerHTML =
				`<p class="error">Erreur lors de la génération de l'image. Réessaie.</p>${getRejoinButtonHtml()}`;
		}
		alert(`Erreur lors du partage. Réessaie !\n${String(error)}`);
	}
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
		copyInfluImage: () => Promise<void>;
		openHowPanel: () => void;
		openAgendaPanel: () => void;
		openInfluPanel: () => Promise<void>;
		openRejoinPanel: () => void;
		trackMatomoEvent: (category: string, action: string) => void;
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
window.copyInfluImage = copyInfluImage;
window.openHowPanel = openHowPanel;
window.openAgendaPanel = openAgendaPanel;
window.openInfluPanel = openInfluPanel;
window.openRejoinPanel = openRejoinPanel;
window.trackMatomoEvent = matomoTrack;

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initApp);
} else {
	initApp();
}
