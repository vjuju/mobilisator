import type { City, CitySearchResult, TourData } from "./dtos/city";
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

	// cities is now an array of [id, name, code_departement]
	const html = cities
		.map((city) => {
			const [id, name, codeDepartement] = city;
			return `
            <div class="result-item" onclick="navigateToCityById(${id})">
                <h3>${name}</h3>
                <p>Département: ${codeDepartement}</p>
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

	let toursHtml = "";

	// Tour 1
	if (city["Tour 1"]) {
		toursHtml += generateTourHtml("Tour 1", city["Tour 1"]);
	}

	// Tour 2
	if (city["Tour 2"]) {
		toursHtml += generateTourHtml("Tour 2", city["Tour 2"]);
	}

	const html = `
        <div class="city-detail">
            <h2>${city.nom_standard}</h2>
            <div class="city-info">
                <div class="info-item">
                    <div class="info-label">Département</div>
                    <div class="info-value">${city.code_departement} - ${city.libelle_departement}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Code commune</div>
                    <div class="info-value">${city.code_commune}</div>
                </div>
            </div>
            ${toursHtml}
        </div>
    `;

	cityDetailDiv.innerHTML = html;
}

// Generate HTML for a tour
function generateTourHtml(tourName: string, tourData: TourData): string {
	const stats = `
        <div class="tour-stats">
            <h4>Statistiques</h4>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Inscrits</span>
                    <span class="stat-value">${tourData.Inscrits.toLocaleString()}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Votants</span>
                    <span class="stat-value">${tourData.Votants.toLocaleString()} (${tourData["% Vot/Ins"].toFixed(2)}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Abstentions</span>
                    <span class="stat-value">${tourData.Abstentions.toLocaleString()} (${tourData["% Abs/Ins"].toFixed(2)}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Exprimés</span>
                    <span class="stat-value">${tourData.Exprimés.toLocaleString()} (${tourData["% Exp/Ins"].toFixed(2)}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Blancs</span>
                    <span class="stat-value">${tourData.Blancs.toLocaleString()} (${tourData["% Blancs/Vot"].toFixed(2)}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Nuls</span>
                    <span class="stat-value">${tourData.Nuls.toLocaleString()} (${tourData["% Nuls/Vot"].toFixed(2)}%)</span>
                </div>
            </div>
        </div>
    `;

	const results = `
        <div class="tour-results">
            <h4>Résultats</h4>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Liste</th>
                        <th>Tête de liste</th>
                        <th>Nuance</th>
                        <th>Voix</th>
                        <th>% Voix/Exp</th>
                        <th>% Voix/Ins</th>
                        <th>Sièges</th>
                    </tr>
                </thead>
                <tbody>
                    ${tourData.resultats
						.map(
							(result) => `
                        <tr>
                            <td>${result.Liste}</td>
                            <td>${result.Prénom} ${result.Nom}</td>
                            <td>${result["Code Nuance"]}</td>
                            <td>${result.Voix.toLocaleString()}</td>
                            <td>${result["% Voix/Exp"].toFixed(2)}%</td>
                            <td>${result["% Voix/Ins"].toFixed(2)}%</td>
                            <td>${result["Sièges / Elu"]}</td>
                        </tr>
                    `,
						)
						.join("")}
                </tbody>
            </table>
        </div>
    `;

	return `
        <div class="tour-section">
            <h3>${tourName}</h3>
            ${stats}
            ${results}
        </div>
    `;
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
