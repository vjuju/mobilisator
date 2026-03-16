/**
 * Enriches elections.json with 2026 municipal election results (Tour 1).
 * Fetches data from resultats-elections.interieur.gouv.fr using department URLs from ensemble_geographique_2026.csv.
 * Resumable: saves progress to elections_2026_progress.json after each batch.
 */

const CONCURRENCY = 8;
const PROGRESS_FILE = "elections_2026_progress.json";
const ELECTIONS_FILE = "elections.json";
const CSV_FILE = "ensemble_geographique_2026.csv";

// Map Z-codes (2020 format) to numeric department codes used in 2026 URLs
const Z_CODE_MAP: Record<string, string> = {
	ZA: "971",
	ZB: "972",
	ZC: "973",
	ZD: "974",
	ZM: "976",
};

function normalizeDeptCode(code: string): string {
	if (Z_CODE_MAP[code]) return Z_CODE_MAP[code];
	// Single digit: pad to 2
	if (/^\d$/.test(code)) return code.padStart(2, "0");
	return code;
}

function buildInseeCode(deptCode: string, communeCode: string): string {
	const dept = normalizeDeptCode(deptCode);
	const commune = communeCode.padStart(3, "0");
	return dept + commune;
}

/** Parse French-formatted number: "11 001" → 11001, "35,59" → 35.59 */
function parseNum(s: string): number {
	return parseFloat(s.replace(/\s/g, "").replace(",", "."));
}

/** Extract text content from HTML (strips tags) */
function stripTags(html: string): string {
	return html.replace(/<[^>]+>/g, "").trim();
}

/** Extract all <td> text values from a <tr> */
function parseTr(tr: string): string[] {
	return [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
		stripTags(m[1]),
	);
}

interface Tour1Stats {
	Inscrits: number;
	Abstentions: number;
	"% Abs/Ins": number;
	Votants: number;
	"% Vot/Ins": number;
	Blancs: number;
	"% Blancs/Ins": number;
	"% Blancs/Vot": number;
	Nuls: number;
	"% Nuls/Ins": number;
	"% Nuls/Vot": number;
	Exprimés: number;
	"% Exp/Ins": number;
	"% Exp/Vot": number;
	resultats: Resultat[];
}

interface Resultat {
	Liste: string;
	"Conduite par": string;
	Nuance: string;
	Voix: number;
	"% Voix/Ins": number;
	"% Voix/Exp": number;
	"Sièges CM": number;
	"Sièges CC": number;
}

function parseHtml(html: string): { "Tour 1": Tour1Stats } | null {
	// Find the table with "1er tour" caption by locating the <caption> tag first,
	// then finding the enclosing <table>...</table>
	const captionIdx = html.search(/<caption[^>]*>[\s\S]*?1<sup[^>]*>er<\/sup>\s*tour/i);
	if (captionIdx === -1) return null;
	const tableStart = html.lastIndexOf("<table", captionIdx);
	const tableEnd = html.indexOf("</table>", captionIdx);
	if (tableStart === -1 || tableEnd === -1) return null;
	const tableHtml = html.slice(tableStart, tableEnd + "</table>".length);
	const tableMatch = [tableHtml]; // wrap to keep same variable name below

	// --- Parse global stats ---
	// Stats are in rows like: <td>Inscrits</td><td>11 001</td>
	const statsMap: Record<string, number[]> = {};
	const allRows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
	for (const row of allRows) {
		const cells = parseTr(row[0]);
		if (cells.length >= 2 && /^(Inscrits|Abstentions|Votants|Blancs|Nuls|Exprimés)$/.test(cells[0])) {
			statsMap[cells[0]] = cells.slice(1).map(parseNum);
		}
	}

	if (!statsMap["Inscrits"]) return null;

	const stats: Tour1Stats = {
		Inscrits: statsMap["Inscrits"][0],
		Abstentions: statsMap["Abstentions"]?.[0] ?? 0,
		"% Abs/Ins": statsMap["Abstentions"]?.[1] ?? 0,
		Votants: statsMap["Votants"]?.[0] ?? 0,
		"% Vot/Ins": statsMap["Votants"]?.[1] ?? 0,
		Blancs: statsMap["Blancs"]?.[0] ?? 0,
		"% Blancs/Ins": statsMap["Blancs"]?.[1] ?? 0,
		"% Blancs/Vot": statsMap["Blancs"]?.[2] ?? 0,
		Nuls: statsMap["Nuls"]?.[0] ?? 0,
		"% Nuls/Ins": statsMap["Nuls"]?.[1] ?? 0,
		"% Nuls/Vot": statsMap["Nuls"]?.[2] ?? 0,
		Exprimés: statsMap["Exprimés"]?.[0] ?? 0,
		"% Exp/Ins": statsMap["Exprimés"]?.[1] ?? 0,
		"% Exp/Vot": statsMap["Exprimés"]?.[2] ?? 0,
		resultats: [],
	};

	// --- Parse results table ---
	const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
	if (tbodyMatch) {
		const tbodyRows = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
		for (const row of tbodyRows) {
			const cells = parseTr(row[0]);
			if (cells.length >= 6) {
				stats.resultats.push({
					Liste: cells[0],
					"Conduite par": cells[1],
					Nuance: cells[2],
					Voix: parseNum(cells[3]),
					"% Voix/Ins": parseNum(cells[4]),
					"% Voix/Exp": parseNum(cells[5]),
					"Sièges CM": cells[6] ? parseNum(cells[6]) : 0,
					"Sièges CC": cells[7] ? parseNum(cells[7]) : 0,
				});
			}
		}
	}

	return { "Tour 1": stats };
}

async function fetchCity(url: string): Promise<{ "Tour 1": Tour1Stats } | null> {
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; electoral-data-bot/1.0)" },
			signal: AbortSignal.timeout(15000),
		});
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const html = await res.text();
		return parseHtml(html);
	} catch (e) {
		return null;
	}
}

// --- Main ---

// 1. Parse CSV → dept code → base URL
const csvText = await Bun.file(CSV_FILE).text();
const deptBaseUrls = new Map<string, string>();
for (const line of csvText.trim().split("\n").slice(1)) {
	const m = line.match(/ensemble_geographique\/\d+\/([^/]+)\/index\.html/);
	if (m) deptBaseUrls.set(m[1], line.replace("index.html", ""));
}

// 2. Load elections.json
const elections: any[] = JSON.parse(await Bun.file(ELECTIONS_FILE).text());

// 3. Load progress (id → 2026 data or false if not found)
let progress: Record<number, any> = {};
const progressFile = Bun.file(PROGRESS_FILE);
if (await progressFile.exists()) {
	progress = JSON.parse(await progressFile.text());
	console.log(`Resuming from progress file (${Object.keys(progress).length} cities already processed)`);
}

// 4. Build work list
type WorkItem = { city: any; url: string };
const work: WorkItem[] = [];

for (const city of elections) {
	if (progress[city.__id] !== undefined) continue; // already done

	const rawDept = city["Code du département"] as string;
	if (Z_CODE_MAP[rawDept] === undefined && rawDept.startsWith("Z")) {
		// Overseas collectivity not in CSV (Nouvelle-Calédonie, etc.)
		progress[city.__id] = false;
		continue;
	}

	const normalizedDept = normalizeDeptCode(rawDept);
	const baseUrl = deptBaseUrls.get(normalizedDept);
	if (!baseUrl) {
		progress[city.__id] = false;
		continue;
	}

	const insee = buildInseeCode(rawDept, city["Code de la commune"] as string);
	const url = `${baseUrl}${insee}/`;
	work.push({ city, url });
}

console.log(`${work.length} cities to fetch (${Object.keys(progress).length} already in progress)`);

// 5. Fetch with concurrency limit
let done = 0;
for (let i = 0; i < work.length; i += CONCURRENCY) {
	const batch = work.slice(i, i + CONCURRENCY);
	const results = await Promise.all(
		batch.map(({ city, url }) =>
			fetchCity(url).then((data) => ({ id: city.__id, data })),
		),
	);
	for (const { id, data } of results) {
		progress[id] = data ?? false;
	}
	done += batch.length;

	// Save progress every batch
	await Bun.write(PROGRESS_FILE, JSON.stringify(progress));

	const pct = ((done / work.length) * 100).toFixed(1);
	const found = results.filter((r) => r.data !== null).length;
	process.stdout.write(`\r${done}/${work.length} (${pct}%) — last batch: ${found}/${batch.length} found`);
}

console.log("\nFetching complete. Merging into elections.json...");

// 6. Merge 2026 data into elections.json
let enriched = 0;
for (const city of elections) {
	const data = progress[city.__id];
	if (data) {
		city["2026"] = data;
		enriched++;
	}
}

await Bun.write(ELECTIONS_FILE, JSON.stringify(elections, null, 2));
console.log(`Done. ${enriched} cities enriched with 2026 data.`);
