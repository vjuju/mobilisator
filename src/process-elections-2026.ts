/**
 * Fetches 2026 municipal election T1 results from the data.gouv.fr tabular API
 * and produces elections.json — replaces the 2020 process-elections.ts pipeline.
 *
 * Source: https://tabular-api.data.gouv.fr/api/resources/4feeef01-24f7-4d5a-914f-8aa806f31ec2/data/json/
 */

const API_URL =
	"https://tabular-api.data.gouv.fr/api/resources/4feeef01-24f7-4d5a-914f-8aa806f31ec2/data/json/";
const POPULATION_FILE = "./population.json";
const OUTPUT_FILE = "./elections.json";
const LISTES_CSV = "/Users/julienvinckel/Documents/OEP/Sources 2026/listes2026.csv";

const populationKeys = [
	"F0-2", "F3-5", "F6-10", "F11-17", "F18-24", "F25-39", "F40-54", "F55-64", "F65-79", "F80+",
	"H0-2", "H3-5", "H6-10", "H11-17", "H18-24", "H25-39", "H40-54", "H55-64", "H65-79", "H80+",
] as const;

const tranchesMajeurs = [
	"F18-24", "F25-39", "F40-54", "F55-64", "F65-79", "F80+",
	"H18-24", "H25-39", "H40-54", "H55-64", "H65-79", "H80+",
] as const;

/** Parse French number/percentage: "55,08%" → 55.08 | "1 200" → 1200 */
function parseNum(v: unknown): number {
	if (typeof v === "number") return isNaN(v) ? 0 : v;
	if (!v) return 0;
	return parseFloat(String(v).replace(/\s/g, "").replace(",", ".").replace("%", "")) || 0;
}

// ── 0. Load listes2026.csv (têtes de liste) ───────────────────────────────────

/** Parse one semicolon-delimited CSV line with optional double-quote wrapping */
function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let i = 0;
	while (i <= line.length) {
		if (i === line.length) { fields.push(""); break; }
		if (line[i] === '"') {
			const j = line.indexOf('"', i + 1);
			fields.push(j === -1 ? line.slice(i + 1) : line.slice(i + 1, j));
			i = (j === -1 ? line.length : j + 1);
			if (line[i] === ';') i++;
		} else {
			const end = line.indexOf(';', i);
			if (end === -1) { fields.push(line.slice(i)); break; }
			fields.push(line.slice(i, end));
			i = end + 1;
		}
	}
	return fields;
}

console.log("📖 Loading listes2026.csv…");
const listesText = await Bun.file(LISTES_CSV).text();
const listesLines = listesText.split("\n").filter((l) => l.trim());
// index: "codeCirco_panneau" → "Prénom Nom"
const listesIndex = new Map<string, string>();
for (let li = 1; li < listesLines.length; li++) {
	const f = parseCsvLine(listesLines[li]);
	const codeCirco = f[2];  // "Code circonscription" (e.g. "01001")
	const panneau   = f[4];  // "Numéro de panneau"
	const tete      = f[9];  // "Tête de liste" = "OUI"
	const nom       = f[12]; // "Nom sur le bulletin de vote"
	const prenom    = f[13]; // "Prénom sur le bulletin de vote"
	if (tete === "OUI" && codeCirco && panneau) {
		listesIndex.set(`${codeCirco}_${panneau}`, [prenom, nom].filter(Boolean).join(" "));
	}
}
console.log(`✅ ${listesIndex.size} têtes de liste indexed`);

// ── 1. Fetch 2026 election data ───────────────────────────────────────────────

console.log("📥 Fetching 2026 election data from tabular API…");
const res = await fetch(API_URL, {
	headers: { "User-Agent": "mobilisator-data-bot/2.0" },
	signal: AbortSignal.timeout(120_000),
});
if (!res.ok) throw new Error(`HTTP ${res.status} from API`);
const rawData: Record<string, unknown>[] = await res.json();
console.log(`✅ ${rawData.length} communes fetched`);

// ── 2. Load population data ───────────────────────────────────────────────────

console.log("📖 Loading population.json…");
const populationRaw: Record<string, unknown>[] = JSON.parse(
	await Bun.file(POPULATION_FILE).text(),
);
const populationIndex = new Map<number, Record<string, unknown>>();
for (const row of populationRaw) {
	const code = parseInt(String(row.INSEE));
	if (!isNaN(code)) populationIndex.set(code, row);
}
console.log(`✅ ${populationIndex.size} population entries indexed`);

// ── 3. Process each commune ───────────────────────────────────────────────────

const elections: unknown[] = [];

for (const row of rawData) {
	const dept = String(row["Code département"] ?? "");
	const fullCode = String(row["Code commune"] ?? "");
	// Commune code = full INSEE minus dept prefix, padded to 3 digits
	const communeCode = fullCode.slice(dept.length).padStart(3, "0");

	// Parse per-list results (up to 15 lists)
	const resultats2026: {
		Liste: string;
		"Conduite par": string;
		Nuance: string;
		Voix: number;
		"% Voix/Ins": number;
		"% Voix/Exp": number;
		"Sièges CM": number;
		"Sièges CC": number;
	}[] = [];

	for (let i = 1; i <= 15; i++) {
		const voix = row[`Voix ${i}`];
		if (voix === null || voix === undefined) break;
		const csvKey = `${fullCode}_${i}`;
		const conductePar = listesIndex.get(csvKey) ?? (
			[String(row[`Prénom candidat ${i}`] ?? "").trim(), String(row[`Nom candidat ${i}`] ?? "").trim()]
				.filter(Boolean).join(" ")
		);
		resultats2026.push({
			Liste: String(row[`Libellé abrégé de liste ${i}`] || row[`Libellé de liste ${i}`] || ""),
			"Conduite par": conductePar,
			Nuance: String(row[`Nuance liste ${i}`] ?? ""),
			Voix: parseNum(voix),
			"% Voix/Ins": parseNum(row[`% Voix/inscrits ${i}`]),
			"% Voix/Exp": parseNum(row[`% Voix/exprimés ${i}`]),
			"Sièges CM": parseNum(row[`Sièges au CM ${i}`]),
			"Sièges CC": parseNum(row[`Sièges au CC ${i}`]),
		});
	}

	// TourData2026 structure (stored under "2026"."Tour 1")
	const tour1_2026 = {
		Inscrits: parseNum(row.Inscrits),
		Abstentions: parseNum(row.Abstentions),
		"% Abs/Ins": parseNum(row["% Abstentions"]),
		Votants: parseNum(row.Votants),
		"% Vot/Ins": parseNum(row["% Votants"]),
		Blancs: parseNum(row.Blancs),
		"% Blancs/Ins": parseNum(row["% Blancs/inscrits"]),
		"% Blancs/Vot": parseNum(row["% Blancs/votants"]),
		Nuls: parseNum(row.Nuls),
		"% Nuls/Ins": parseNum(row["% Nuls/inscrits"]),
		"% Nuls/Vot": parseNum(row["% Nuls/votants"]),
		Exprimés: parseNum(row.Exprimés),
		"% Exp/Ins": parseNum(row["% Exprimés/inscrits"]),
		"% Exp/Vot": parseNum(row["% Exprimés/votants"]),
		resultats: resultats2026,
	};

	// TourData-compatible "Tour 1" (for backward-compat with index.ts / computeVotesDecisifs)
	// Only Voix and Exprimés matter for the computation — other 2020-specific fields are null.
	const tour1_compat = {
		...tour1_2026,
		resultats: resultats2026.map((r) => ({
			"N.Pan.": null,
			"Code Nuance": r.Nuance,
			"Sexe": null,
			"Nom": null,
			"Prénom": null,
			"Liste": r.Liste,
			"Sièges / Elu": r["Sièges CM"],
			"Sièges Secteur": 0,
			"Sièges CC": r["Sièges CC"],
			"Voix": r.Voix,
			"% Voix/Ins": r["% Voix/Ins"],
			"% Voix/Exp": r["% Voix/Exp"],
		})),
	};

	// ── Population matching ────────────────────────────────────────────────────
	// INSEE = parseInt("01001") = 1001, parseInt("75056") = 75056, etc.
	const inseeCode = parseInt(fullCode);
	const popRow = populationIndex.get(inseeCode);
	let population: Record<string, number> | undefined;

	if (popRow) {
		const p: Record<string, number> = {};
		for (const key of populationKeys) {
			const val = typeof popRow[key] === "number" ? (popRow[key] as number) : parseFloat(String(popRow[key] ?? 0));
			if (val > 0) p[key] = val;
		}
		if (Object.keys(p).length > 0) population = p;
	}

	// ── Compute Analyse ────────────────────────────────────────────────────────
	const sorted = [...resultats2026]
		.filter((r) => r.Voix > 0)
		.sort((a, b) => b.Voix - a.Voix);

	let votesDecisifs = 0;
	let electionTerminee = false;

	if (sorted.length === 1) {
		// Cas 1 : une seule liste au premier tour → V + 1
		electionTerminee = true;
		votesDecisifs = sorted[0].Voix + 1;
	} else if (sorted.length > 0) {
		const winner = sorted[0];
		const terminee = winner["% Voix/Exp"] > 50;
		electionTerminee = terminee;
		if (terminee) {
			// Cas terminée : votes pour forcer un 2nd tour → 2×V₁ − Exprimés
			votesDecisifs = Math.max(0, 2 * winner.Voix - tour1_2026.Exprimés);
		} else {
			// Cas 2nd tour en cours : écart entre 1er et 2e + 1
			votesDecisifs = sorted[0].Voix - sorted[1].Voix + 1;
		}
	}

	let pop1839 = 0;
	let pop18Plus = 0;
	if (population) {
		pop1839 =
			(population["F18-24"] ?? 0) + (population["H18-24"] ?? 0) +
			(population["F25-39"] ?? 0) + (population["H25-39"] ?? 0);
		for (const t of tranchesMajeurs) pop18Plus += population[t] ?? 0;
	}

	// abstentionnistes_18_39 = Abstentions_T1 × (pop_18_39 / pop_18_plus)
	const nonVotants1839 =
		pop18Plus > 0 && pop1839 > 0
			? Math.round(tour1_2026.Abstentions * (pop1839 / pop18Plus))
			: 0;

	elections.push({
		__id: row.__id,
		"Code du département": dept,
		"Libellé du département": String(row["Libellé département"] ?? ""),
		"Code de la commune": communeCode,
		"Libellé de la commune": String(row["Libellé commune"] ?? ""),
		"Tour 1": tour1_compat,
		"2026": { "Tour 1": tour1_2026 },
		...(population && { population }),
		Analyse: {
			"Votes décisifs": votesDecisifs,
			"tour décisif": 1,
			majeurs: pop18Plus,
			"Non votants de 18-39": nonVotants1839,
			// Champs 2026 (utilisés par app.ts)
			"Votes décisifs 2026": votesDecisifs,
			"election terminee 2026": electionTerminee,
			"Non votants de 18-39 2026": nonVotants1839,
		},
	});
}

// ── 4. Write output ───────────────────────────────────────────────────────────

console.log(`💾 Writing ${elections.length} entries to ${OUTPUT_FILE}…`);
await Bun.write(OUTPUT_FILE, JSON.stringify(elections, null, 2));
console.log("✅ Done!");

export {};
