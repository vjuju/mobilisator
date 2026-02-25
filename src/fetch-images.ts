/**
 * Fetches P18 (image) data + author/license from Wikidata/Commons for each French commune.
 * Outputs ./city-images.json mapping city __id -> { url, author, license }.
 *
 * Usage: bun run src/fetch-images.ts [--dry-run] [--limit N]
 *   --dry-run  Only query the first SPARQL batch (useful for testing)
 *   --limit N  Only process the first N cities
 */

const inputPath = "./elections_1.json";
const outputPath = "./city-images.json";
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const BATCH_SIZE = 200;       // Wikidata SPARQL batch size
const META_BATCH_SIZE = 50;   // Commons API supports up to 50 titles per request
const DELAY_MS = 1200;
const USER_AGENT = "Mobilisator/1.0 (https://github.com/mobilisator; contact@mobilisator.fr) Bun/fetch";

// --- Replicated from process-elections.ts (not exported there) ---

const communeToInseeMapping: Record<string, number[]> = {
	// Marseille - 8 secteurs, 2 arrondissements chacun
	"055SR01": [13201, 13207],
	"055SR02": [13202, 13203],
	"055SR03": [13204, 13205],
	"055SR04": [13206, 13208],
	"055SR05": [13209, 13210],
	"055SR06": [13211, 13212],
	"055SR07": [13213, 13214],
	"055SR08": [13215, 13216],
	// Paris - secteurs
	"056SR01": [75101, 75102, 75103, 75104],
	"056SR05": [75105],
	"056SR06": [75106],
	"056SR07": [75107],
	"056SR08": [75108],
	"056SR09": [75109],
	"056SR10": [75110],
	"056SR11": [75111],
	"056SR12": [75112],
	"056SR13": [75113],
	"056SR14": [75114],
	"056SR15": [75115],
	"056SR16": [75116],
	"056SR17": [75117],
	"056SR18": [75118],
	"056SR19": [75119],
	"056SR20": [75120],
};

const deptExceptions = ["ZA", "ZB", "ZC", "ZD", "ZM", "ZN", "ZP", "ZS"];

const createInseeCodes = (row: Record<string, unknown>): number[] => {
	let dept = String(row["Code du département"]);
	const commune = String(row["Code de la commune"]);

	if (communeToInseeMapping[commune]) {
		return communeToInseeMapping[commune];
	}

	if (deptExceptions.includes(dept)) {
		dept = "97";
	}

	let processedCommune = commune;
	if (commune.startsWith("123SR0")) {
		processedCommune = commune.replace("123SR0", "38");
	}

	dept = dept.padStart(2, "0");
	processedCommune = processedCommune.padStart(3, "0");
	return [parseInt(dept + processedCommune)];
};

// --- Helpers ---

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Extract the bare filename from a Wikimedia Commons Special:FilePath URL */
const extractFilename = (url: string): string => {
	const decoded = decodeURIComponent(url);
	const parts = decoded.split("/");
	return parts[parts.length - 1];
};

/** Strip HTML tags from Commons Artist field (often contains <span>, <a>…) */
const stripHtml = (html: string): string =>
	html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

// --- Wikidata SPARQL ---

/**
 * Query Wikidata for P18 images given a list of INSEE codes (5-digit strings).
 * Returns a map: inseeCode -> Wikimedia Commons HTTPS image URL
 */
const fetchImagesForBatch = async (inseeCodes: string[]): Promise<Map<string, string>> => {
	const values = inseeCodes.map((c) => `"${c}"`).join(" ");
	const query = `
SELECT ?inseeCode (MIN(STR(?image)) AS ?imageUrl) WHERE {
  VALUES ?inseeCode { ${values} }
  ?commune wdt:P374 ?inseeCode ;
           wdt:P18 ?image .
}
GROUP BY ?inseeCode
`;

	const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`;
	const response = await fetch(url, {
		headers: {
			"User-Agent": USER_AGENT,
			Accept: "application/sparql-results+json",
		},
	});

	if (!response.ok) {
		throw new Error(`Wikidata SPARQL error: ${response.status} ${await response.text()}`);
	}

	const data = await response.json();
	const result = new Map<string, string>();

	for (const binding of data.results.bindings) {
		const code = binding.inseeCode?.value;
		let imageUrl = binding.imageUrl?.value;
		if (code && imageUrl) {
			// Ensure HTTPS
			imageUrl = imageUrl.replace("http://", "https://");
			result.set(code, imageUrl);
		}
	}

	return result;
};

// --- Wikimedia Commons API ---

interface FileMetadata {
	author: string;
	license: string;
	/** Direct upload.wikimedia.org thumbnail URL (1080px wide, no redirects, CORS-safe) */
	thumbUrl: string;
}

/**
 * Query the Commons API for file metadata (author, license, thumbnail URL) for up to 50 filenames.
 * Uses iiprop=extmetadata|url with iiurlwidth=1080 to get a direct thumbnail URL with no redirects.
 * Returns a map: filename -> { author, license, thumbUrl }
 */
const fetchCommonsMetadata = async (filenames: string[]): Promise<Map<string, FileMetadata>> => {
	const titles = filenames.map((f) => `File:${f}`).join("|");
	const params = new URLSearchParams({
		action: "query",
		titles,
		prop: "imageinfo",
		iiprop: "extmetadata|url",
		iiurlwidth: "1080",
		format: "json",
		origin: "*",
	});

	const response = await fetch(`${COMMONS_API}?${params}`, {
		headers: { "User-Agent": USER_AGENT },
	});

	if (!response.ok) {
		throw new Error(`Commons API error: ${response.status}`);
	}

	const data = await response.json();
	const result = new Map<string, FileMetadata>();

	const pages = (data.query?.pages || {}) as Record<string, unknown>;
	for (const page of Object.values(pages)) {
		const p = page as {
			title?: string;
			imageinfo?: Array<{
				thumburl?: string;
				extmetadata?: {
					Artist?: { value: string };
					Credit?: { value: string };
					LicenseShortName?: { value: string };
				};
			}>;
		};

		const title = p.title?.replace(/^File:/, "");
		const info = p.imageinfo?.[0];
		const meta = info?.extmetadata;
		if (!title || !info) continue;

		const rawAuthor = meta?.Artist?.value ?? meta?.Credit?.value ?? "";
		const author = stripHtml(rawAuthor).slice(0, 80);
		const license = meta?.LicenseShortName?.value ?? "";
		const thumbUrl = info.thumburl ?? "";

		result.set(title, { author, license, thumbUrl });
	}

	return result;
};

// --- Main ---

export interface CityImageData {
	/** Original Wikidata P18 URL (Special:FilePath) — kept for reference */
	url: string;
	/** Direct upload.wikimedia.org thumbnail URL (1080px, CORS-safe, no redirect) */
	thumbUrl: string;
	author: string;
	license: string;
}

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) : null;

const startTime = performance.now();
console.log("📖 Reading elections_1.json...");
const data: Record<string, unknown>[] = await Bun.file(inputPath).json();

// Build list of entries with their INSEE codes
interface CityEntry {
	id: number;
	nom: string;
	inseeCodes: string[];
}

const entries: CityEntry[] = data
	.slice(0, limit ?? data.length)
	.map((row) => {
		const codes = createInseeCodes(row);
		return {
			id: row.__id as number,
			nom: String(row["Libellé de la commune"]),
			inseeCodes: codes.map((c) => String(c).padStart(5, "0")),
		};
	});

// Collect all unique INSEE codes to query
const allInseeCodes = [...new Set(entries.flatMap((e) => e.inseeCodes))];
console.log(`📊 ${entries.length} cities → ${allInseeCodes.length} unique INSEE codes to query`);

// Batch the codes
const batches: string[][] = [];
for (let i = 0; i < allInseeCodes.length; i += BATCH_SIZE) {
	batches.push(allInseeCodes.slice(i, i + BATCH_SIZE));
}
console.log(`🔢 ${batches.length} SPARQL batches of up to ${BATCH_SIZE} codes`);

if (isDryRun) {
	console.log("🧪 Dry-run mode: only querying the first SPARQL batch");
}

// ── Step 1: Query Wikidata for image URLs ──────────────────────────────────

const imagesByInsee = new Map<string, string>();
const batchesToRun = isDryRun ? batches.slice(0, 1) : batches;

for (let i = 0; i < batchesToRun.length; i++) {
	const batch = batchesToRun[i];
	process.stdout.write(`\r⏳ SPARQL batch ${i + 1}/${batchesToRun.length} (${imagesByInsee.size} images found)...`);

	let attempts = 0;
	while (attempts < 3) {
		try {
			const batchResult = await fetchImagesForBatch(batch);
			for (const [code, url] of batchResult) {
				imagesByInsee.set(code, url);
			}
			break;
		} catch (err) {
			attempts++;
			if (attempts >= 3) {
				console.error(`\n⚠️  SPARQL batch ${i + 1} failed after 3 attempts:`, err);
			} else {
				await sleep(DELAY_MS * 2);
			}
		}
	}

	if (i < batchesToRun.length - 1) {
		await sleep(DELAY_MS);
	}
}
process.stdout.write("\n");

// ── Step 2: Query Commons API for author + license ─────────────────────────

const uniqueFilenames = [...new Set([...imagesByInsee.values()].map(extractFilename))];
console.log(`\n🖼️  Fetching metadata for ${uniqueFilenames.length} unique images from Commons API...`);

const metaBatches: string[][] = [];
for (let i = 0; i < uniqueFilenames.length; i += META_BATCH_SIZE) {
	metaBatches.push(uniqueFilenames.slice(i, i + META_BATCH_SIZE));
}
console.log(`🔢 ${metaBatches.length} Commons API batches of up to ${META_BATCH_SIZE} files`);

const metadataByFilename = new Map<string, FileMetadata>();
const metaBatchesToRun = isDryRun ? metaBatches.slice(0, 1) : metaBatches;

for (let i = 0; i < metaBatchesToRun.length; i++) {
	process.stdout.write(`\r⏳ Commons batch ${i + 1}/${metaBatchesToRun.length} (${metadataByFilename.size} metadata fetched)...`);

	let attempts = 0;
	while (attempts < 3) {
		try {
			const batchResult = await fetchCommonsMetadata(metaBatchesToRun[i]);
			for (const [filename, meta] of batchResult) {
				metadataByFilename.set(filename, meta);
			}
			break;
		} catch (err) {
			attempts++;
			if (attempts >= 3) {
				console.error(`\n⚠️  Commons batch ${i + 1} failed after 3 attempts:`, err);
			} else {
				await sleep(DELAY_MS * 2);
			}
		}
	}

	if (i < metaBatchesToRun.length - 1) {
		await sleep(DELAY_MS);
	}
}
process.stdout.write("\n");

// ── Step 3: Assemble output ─────────────────────────────────────────────────

const cityImages: Record<number, CityImageData> = {};
let covered = 0;
let withMeta = 0;
let missing = 0;

for (const entry of entries) {
	const imageUrl = entry.inseeCodes.map((c) => imagesByInsee.get(c)).find(Boolean);
	if (imageUrl) {
		const filename = extractFilename(imageUrl);
		const meta = metadataByFilename.get(filename);
		cityImages[entry.id] = {
			url: imageUrl,
			thumbUrl: meta?.thumbUrl ?? "",
			author: meta?.author ?? "",
			license: meta?.license ?? "",
		};
		covered++;
		if (meta?.author || meta?.license) withMeta++;
	} else {
		missing++;
	}
}

// ── Coverage report ─────────────────────────────────────────────────────────

const total = entries.length;
console.log(`\n📈 Coverage: ${covered}/${total} cities (${((covered / total) * 100).toFixed(1)}%)`);
console.log(`   ✅ With image: ${covered}`);
console.log(`   📝 With author/license metadata: ${withMeta}`);
console.log(`   ❌ Without image: ${missing}`);

if (!isDryRun) {
	console.log(`\n💾 Writing ${outputPath}...`);
	await Bun.write(outputPath, JSON.stringify(cityImages, null, 2));
	console.log("✅ Done!");
} else {
	console.log("\n🧪 Dry-run: not writing output file");
	console.log("Sample results:");
	let count = 0;
	for (const [id, data] of Object.entries(cityImages)) {
		console.log(`  id=${id} → ${data.url}`);
		console.log(`           author: "${data.author}" | license: "${data.license}"`);
		if (++count >= 3) break;
	}
}

const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
console.log(`⏱  Total time: ${elapsed}s`);

export {};
