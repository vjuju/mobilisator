import { rm } from "node:fs/promises";

import type { City, ElectionEntry, FullCity } from "./dtos/city";
import { computeVotesDecisifs } from "./format";
import { fullCityToCity, normalizeText } from "./utils";

// Strip leading French articles (Le, La, Les, L') from city names
const stripLeadingArticle = (name: string): string => {
	const articlePattern = /^(le |la |les |l')/i;
	return name.replace(articlePattern, "").trim();
};

const MAX_CITIES_PER_NGRAM = 20;
const MIN_NGRAMS = 2;
const NB_NGRAMS = 45;

// Partition keys: a-z for letters, 0 for numbers, _ for other
const PARTITIONS = "abcdefghijklmnopqrstuvwxyz0".split("");

const outputDirectoryPath = "./public/cities";
const inputPath = "./elections.json";
const inputFile = Bun.file(inputPath);

interface Indexable {
	id: number;
}

export const createSearchIndex = (
	cities: FullCity[],
): Map<string, number[]> => {
	const searchIndex: Map<string, number[]> = new Map();

	const addStringToIndex = (index: Indexable) => (str: string) =>
		tokenizeText(str)
			.map(createNGrams)
			.reduce((acc, ngrams) => {
				ngrams.forEach((ngram) => {
					acc.add(ngram);
				});
				return acc;
			}, new Set())
			.forEach(addToIndex(searchIndex)(index));

	cities.forEach((city: FullCity) => {
		const addStringToFullCityIndex = addStringToIndex(city);

		[
			city.nom_standard,
			city.nom_sans_pronom,
			city.code_departement,
			city.code_commune,
		].forEach(addStringToFullCityIndex);
	});
	return searchIndex;
};

const addToIndex =
	(searchIndex: Map<string, number[]>) =>
	(indexable: Indexable) =>
	(key: string) => {
		if (!searchIndex.has(key)) {
			searchIndex.set(key, []);
		}
		const found =
			searchIndex.get(key)?.find((item) => item === indexable.id) ?? false;

		if (!found) {
			searchIndex.get(key)?.push(indexable.id);
		}
	};

export const tokenizeText = (text: string): string[] => {
	return normalizeText(text)
		.split(" ")
		.filter((token: string) => token.length > 0)
		.map((token: string) => token.toLowerCase());
};

export const createNGrams = (token: string): Set<string> => {
	const nGrams: Set<string> = new Set();
	for (let nx = MIN_NGRAMS; nx <= NB_NGRAMS; nx++) {
		nGrams.add(token.slice(0, nx));
	}
	if (token.length > NB_NGRAMS) {
		nGrams.add(token);
	}
	return nGrams;
};

// Get partition key for an ngram (first character, mapped to a-z or 0)
const getPartitionKey = (ngram: string): string => {
	const firstChar = ngram.charAt(0).toLowerCase();
	if (firstChar >= "a" && firstChar <= "z") {
		return firstChar;
	}
	if (firstChar >= "0" && firstChar <= "9") {
		return "0"; // All numbers go to partition "0"
	}
	return "0"; // Other characters also go to "0"
};

const startTime = performance.now();

const elections: ElectionEntry[] = await inputFile.json();
const cities: FullCity[] = elections
	.filter((entry) => !!entry && !!entry["Libellé de la commune"])
	.map((entry, idx) => {
		const nomSansPronom = entry["Libellé de la commune"];
		return {
			id: entry.__id,
			normalized_name: normalizeText(nomSansPronom),
			nom_standard: nomSansPronom,
			nom_sans_pronom: stripLeadingArticle(nomSansPronom),
			code_postal: entry["Code du département"],
			codes_postaux: [],
			code_departement: entry["Code du département"],
			libelle_departement: entry["Libellé du département"],
			code_commune: entry["Code de la commune"],
		};
	});

const searchIndex: Map<string, number[]> = createSearchIndex(cities);

const citiesById = Object.fromEntries(cities.map((c) => [c.id, c]));
const electionsById = Object.fromEntries(
	elections.map((e) => [e.__id, e]),
);

// Build the search index with limited results per ngram
const citiesIndex = Array.from(searchIndex.entries()).map(([k, v]) => [
	k,
	v
		.sort(
			(a, b) =>
				citiesById[a].nom_standard.length - citiesById[b].nom_standard.length,
		)
		.slice(0, MAX_CITIES_PER_NGRAM)
		.map((i) => [
			i,
			citiesById[i].nom_standard,
			citiesById[i].code_departement,
		]),
]);

// Partition the search index by first character
const partitionedIndex: Record<string, Record<string, unknown>> = {};
for (const partition of PARTITIONS) {
	partitionedIndex[partition] = {};
}

for (const [ngram, results] of citiesIndex) {
	const partition = getPartitionKey(ngram as string);
	partitionedIndex[partition][ngram as string] = results;
}

await rm(outputDirectoryPath, { recursive: true, force: true });

// Write partitioned search index files (27 files: a-z + 0)
for (const partition of PARTITIONS) {
	const fileLocation = `${outputDirectoryPath}/search-${partition}.json`;
	await Bun.write(fileLocation, JSON.stringify(partitionedIndex[partition]));
}

// Build all city data into a single object keyed by ID
const allCitiesData: Record<number, City> = {};
for (const fullCity of cities) {
	const electionEntry = electionsById[fullCity.id];
	if (electionEntry) {
		const city = fullCityToCity(fullCity, electionEntry);
		allCitiesData[city.id] = city;
	}
}

// Write single cities data file
const citiesDataLocation = `${outputDirectoryPath}/cities-data.json`;
await Bun.write(citiesDataLocation, JSON.stringify(allCitiesData));

// Also write a slug-to-id mapping for direct slug lookups
const slugToId: Record<string, number> = {};
for (const city of Object.values(allCitiesData)) {
	slugToId[city.slug] = city.id;
}
const slugMapLocation = `${outputDirectoryPath}/slug-map.json`;
await Bun.write(slugMapLocation, JSON.stringify(slugToId));

// Write share-data.json: slug → { name, votes, thumbUrl, url, author, license }
// Used by the Cloudflare Pages Function that generates share images (og:image + clipboard)
const cityImagesFile = Bun.file("./city-images.json");
const cityImages: Record<number, { thumbUrl?: string; url?: string; author?: string; license?: string }> =
	(await cityImagesFile.exists()) ? await cityImagesFile.json() : {};

const shareData: Record<string, { name: string; votes: number; cas: number | string; thumbUrl: string; url: string; author: string; license: string }> = {};
for (const city of Object.values(allCitiesData)) {
	const img = cityImages[city.id] ?? {};
	const { cas } = computeVotesDecisifs(city["Tour 1"], city["Tour 2"]);
	shareData[city.slug] = {
		name: city.nom_standard,
		votes: city.Analyse["Votes décisifs"],
		cas,
		thumbUrl: img.thumbUrl ?? "",
		url: img.url ?? "",
		author: img.author ?? "",
		license: img.license ?? "",
	};
}
const shareDataLocation = `${outputDirectoryPath}/share-data.json`;
await Bun.write(shareDataLocation, JSON.stringify(shareData));

// Generate sitemap.xml for SEO
const sitemapUrls = Object.values(allCitiesData)
	.map((city) => `\t<url><loc>https://mobilisator.fr/${city.slug}</loc></url>`)
	.join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>`;
await Bun.write("./public/sitemap.xml", sitemap);

const endTime = performance.now();

console.log(`⏺ ${cities.length} cities`);
console.log(`⏺ ${searchIndex.size} index entries`);
console.log(`⏺ ${PARTITIONS.length} search partition files`);
console.log(`⏺ 1 cities-data.json file`);
console.log(`⏺ 1 slug-map.json file`);
console.log(`⏺ 1 share-data.json file`);
console.log(`⏺ 1 sitemap.xml file`);
console.log(`⏺ ${PARTITIONS.length + 4} total files`);
console.log(
	`⏺ ${Number(endTime - startTime).toFixed(1)} ms to process search index`,
);
console.log("\n✔ Done");
