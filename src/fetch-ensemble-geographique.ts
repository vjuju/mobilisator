/**
 * Fetches the #departements element from the 2026 municipal elections page
 * and generates a CSV with ensemble_geographique URLs from onclick attributes.
 */

const PAGE_URL = "https://www.resultats-elections.interieur.gouv.fr/municipales2026/index.html";
const BASE_URL = "https://www.resultats-elections.interieur.gouv.fr/municipales2026/ensemble_geographique/";
const OUTPUT_FILE = "ensemble_geographique_2026.csv";

const response = await fetch(PAGE_URL);
if (!response.ok) {
	throw new Error(`HTTP ${response.status}: ${response.url}`);
}
const html = await response.text();

// Extract the #departements element content
const departementsMatch = html.match(/<[^>]+id=["']departements["'][^>]*>([\s\S]*?)<\/[^>]+>/);
if (!departementsMatch) {
	throw new Error('Element with id="departements" not found');
}
const departementsHtml = departementsMatch[0];

// Extract paths from onclick like: parent.document.location.href='./ensemble_geographique/28/76/index.html'
// The onclick is wrapped in double quotes, and the path is in single quotes inside
const onclickMatches = [...departementsHtml.matchAll(/onclick="[^"]*'(\.\/ensemble_geographique\/[^']+)'[^"]*"/g)];
if (onclickMatches.length === 0) {
	throw new Error("No onclick attributes with ensemble_geographique paths found in #departements");
}

const lines: string[] = ["url"];

for (const match of onclickMatches) {
	// match[1] is e.g. "./ensemble_geographique/28/76/index.html"
	// Replace "./" with the base of the site to get the full URL
	const url = match[1].replace("./ensemble_geographique/", BASE_URL);
	lines.push(url);
}

await Bun.write(OUTPUT_FILE, lines.join("\n") + "\n");
console.log(`Wrote ${lines.length - 1} URLs to ${OUTPUT_FILE}`);
