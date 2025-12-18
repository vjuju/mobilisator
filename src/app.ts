import type { City, CitySearchResult } from "./dtos/city";
import { normalizeText } from "./utils";

// Router and app state
let searchTimeout: number | null = null;

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
function init(): void {
	// Handle initial route
	handleRoute();

	// Listen for browser back/forward
	window.addEventListener("popstate", handleRoute);

	// Real-time search as user types
	const searchInput = document.getElementById(
		"searchInput",
	) as HTMLInputElement;
	if (searchInput) {
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

	if (path === "/" || path === "/index.html") {
		showSearchView();
	} else {
		// Extract slug from path (e.g., /76100-rouen -> 76100-rouen)
		const slug = path.substring(1).replace(".html", "");
		await loadCityBySlug(slug);
	}
}

// Show search view
function showSearchView(): void {
	const searchView = document.getElementById("searchView");
	const cityView = document.getElementById("cityView");
	const results = document.getElementById("results");

	if (searchView) searchView.classList.remove("hidden");
	if (cityView) cityView.classList.add("hidden");
	if (results) results.innerHTML = "";
}

// Show city view
function showCityView(): void {
	const searchView = document.getElementById("searchView");
	const cityView = document.getElementById("cityView");

	if (searchView) searchView.classList.add("hidden");
	if (cityView) cityView.classList.remove("hidden");
}

// Go back to search
function goBack(): void {
	window.history.pushState({}, "", "/");
	showSearchView();
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
		const response = await fetch(`cities/search/${normalized}.json`);

		if (!response.ok) {
			resultsDiv.innerHTML = '<p class="error">Aucune ville trouvée</p>';
			return;
		}

		const citiesData: CitySearchResult[] = await response.json();

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
		const response = await fetch(`cities/${id}.json`);
		if (!response.ok) return null;
		return await response.json();
	} catch (error) {
		console.error(`Error fetching city ${id}:`, error);
		return null;
	}
}

// Fetch city by slug
async function fetchCityBySlug(slug: string): Promise<City | null> {
	try {
		const response = await fetch(`cities/${slug}.json`);
		if (!response.ok) return null;
		return await response.json();
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

	// cities is now an array of [id, name, postal_code]
	const html = cities
		.map((city) => {
			const [id, name, postalCode] = city;
			return `
            <div class="result-item" onclick="navigateToCityById(${id})">
                <h3>${name}</h3>
                <p>Code postal: ${postalCode}</p>
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
		window.history.pushState({}, "", `/${city.slug}`);
		displayCityDetail(city);
		showCityView();
	}
}

// Load and display city by slug
async function loadCityBySlug(slug: string): Promise<void> {
	const cityDetailDiv = document.getElementById("cityDetail");

	if (!cityDetailDiv) return;

	cityDetailDiv.innerHTML = '<p class="loading">Chargement...</p>';
	showCityView();

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

	const html = `
        <div class="city-detail">
            <h2>${city.nom_standard}</h2>
            <div class="city-info">
                <div class="info-item">
                    <div class="info-label">Code postal</div>
                    <div class="info-value">${city.code_postal}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Superficie</div>
                    <div class="info-value">${city.superficie_km2} km²</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Identifiant</div>
                    <div class="info-value">${city.id}</div>
                </div>
            </div>
        </div>
    `;

	cityDetailDiv.innerHTML = html;
}

// Make navigateToCityById available globally for onclick handlers
declare global {
	interface Window {
		navigateToCityById: (id: number) => Promise<void>;
		goBack: () => void;
	}
}

window.navigateToCityById = navigateToCityById;
window.goBack = goBack;

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
