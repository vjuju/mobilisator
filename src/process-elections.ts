const inputPath1 = "./elections_1.json";
const inputPath2 = "./elections_2.json";
const inputPathPopulation = "./population.json";
const outputPath = "./elections.json";
const inputFile1 = Bun.file(inputPath1);
const inputFile2 = Bun.file(inputPath2);
const inputFilePopulation = Bun.file(inputPathPopulation);

const startTime = performance.now();

// Clés de base (identifiants de la commune uniquement)
const baseKeys = [
	"__id",
	"Code du département",
	"Libellé du département",
	"Code de la commune",
	"Libellé de la commune",
];

// Clés qui vont dans "Tour 1" (statistiques de l'élection)
const tour1Keys = [
	"Inscrits",
	"Abstentions",
	"% Abs/Ins",
	"Votants",
	"% Vot/Ins",
	"Blancs",
	"% Blancs/Ins",
	"% Blancs/Vot",
	"Nuls",
	"% Nuls/Ins",
	"% Nuls/Vot",
	"Exprimés",
	"% Exp/Ins",
	"% Exp/Vot",
];

// Clés pour chaque résultat de candidat/liste
const resultKeys = [
	"N.Pan.",
	"Code Nuance",
	"Sexe",
	"Nom",
	"Prénom",
	"Liste",
	"Sièges / Elu",
	"Sièges Secteur",
	"Sièges CC",
	"Voix",
	"% Voix/Ins",
	"% Voix/Exp",
];

// Fonction pour créer la clé de correspondance (département + commune sur 3 digits)
const createKey = (row: Record<string, unknown>): string => {
	const dept = String(row["Code du département"]).padStart(2, "0");
	const commune = String(row["Code de la commune"]).padStart(3, "0");
	return dept + commune;
};

// Mapping des codes communes exceptionnels vers plusieurs codes INSEE avec leurs noms
const communeToInseeMapping: Record<string, { codes: number[]; noms: string[] }> = {
	// Marseille - 8 secteurs regroupant 2 arrondissements chacun
	"055SR01": { codes: [13201, 13207], noms: ["Marseille 1er (13)", "Marseille 7e (13)"] },
	"055SR02": { codes: [13202, 13203], noms: ["Marseille 2e (13)", "Marseille 3e (13)"] },
	"055SR03": { codes: [13204, 13205], noms: ["Marseille 4e (13)", "Marseille 5e (13)"] },
	"055SR04": { codes: [13206, 13208], noms: ["Marseille 6e (13)", "Marseille 8e (13)"] },
	"055SR05": { codes: [13209, 13210], noms: ["Marseille 9e (13)", "Marseille 10e (13)"] },
	"055SR06": { codes: [13211, 13212], noms: ["Marseille 11e (13)", "Marseille 12e (13)"] },
	"055SR07": { codes: [13213, 13214], noms: ["Marseille 13e (13)", "Marseille 14e (13)"] },
	"055SR08": { codes: [13215, 13216], noms: ["Marseille 15e (13)", "Marseille 16e (13)"] },
	// Paris - secteur 1 regroupe 4 arrondissements, secteurs 5-20 correspondent à 1 arrondissement chacun
	"056SR01": { codes: [75101, 75102, 75103, 75104], noms: ["Paris 1er (75)", "Paris 2e (75)", "Paris 3e (75)", "Paris 4e (75)"] },
	"056SR05": { codes: [75105], noms: ["Paris 5e (75)"] },
	"056SR06": { codes: [75106], noms: ["Paris 6e (75)"] },
	"056SR07": { codes: [75107], noms: ["Paris 7e (75)"] },
	"056SR08": { codes: [75108], noms: ["Paris 8e (75)"] },
	"056SR09": { codes: [75109], noms: ["Paris 9e (75)"] },
	"056SR10": { codes: [75110], noms: ["Paris 10e (75)"] },
	"056SR11": { codes: [75111], noms: ["Paris 11e (75)"] },
	"056SR12": { codes: [75112], noms: ["Paris 12e (75)"] },
	"056SR13": { codes: [75113], noms: ["Paris 13e (75)"] },
	"056SR14": { codes: [75114], noms: ["Paris 14e (75)"] },
	"056SR15": { codes: [75115], noms: ["Paris 15e (75)"] },
	"056SR16": { codes: [75116], noms: ["Paris 16e (75)"] },
	"056SR17": { codes: [75117], noms: ["Paris 17e (75)"] },
	"056SR18": { codes: [75118], noms: ["Paris 18e (75)"] },
	"056SR19": { codes: [75119], noms: ["Paris 19e (75)"] },
	"056SR20": { codes: [75120], noms: ["Paris 20e (75)"] },
};

// Fonction pour créer le(s) code(s) INSEE pour correspondance avec population.json
// Retourne un objet avec les codes INSEE et les noms des communes agrégées (si applicable)
const createInseeCodes = (
	row: Record<string, unknown>,
): { codes: number[]; communesAgregees?: string[] } => {
	let dept = String(row["Code du département"]);
	const commune = String(row["Code de la commune"]);

	// Vérifier si le code commune a un mapping spécial
	if (communeToInseeMapping[commune]) {
		const mapping = communeToInseeMapping[commune];
		return {
			codes: mapping.codes,
			// N'inclure communesAgregees que s'il y a plusieurs communes (vraie agrégation)
			...(mapping.codes.length > 1 && { communesAgregees: mapping.noms }),
		};
	}

	// Exceptions pour les codes départementaux
	const deptExceptions = ["ZA", "ZB", "ZC", "ZD", "ZM", "ZN", "ZP", "ZS"];
	if (deptExceptions.includes(dept)) {
		dept = "97";
	}

	// Exceptions pour les codes communes (anciennes règles)
	let processedCommune = commune;
	if (commune.startsWith("123SR0")) {
		processedCommune = commune.replace("123SR0", "38");
	}

	// Normaliser et combiner
	dept = dept.padStart(2, "0");
	processedCommune = processedCommune.padStart(3, "0");
	return { codes: [parseInt(dept + processedCommune)] };
};

// Clés démographiques à extraire de population.json
const populationKeys = [
	"F0-2",
	"F3-5",
	"F6-10",
	"F11-17",
	"F18-24",
	"F25-39",
	"F40-54",
	"F55-64",
	"F65-79",
	"F80+",
	"H0-2",
	"H3-5",
	"H6-10",
	"H11-17",
	"H18-24",
	"H25-39",
	"H40-54",
	"H55-64",
	"H65-79",
	"H80+",
];

// Fonction pour extraire les données d'un tour (statistiques + résultats)
const extractTourData = (row: Record<string, unknown>): Record<string, unknown> => {
	const tourData: Record<string, unknown> = {};
	
	// Ajouter les statistiques
	for (const key of tour1Keys) {
		if (key in row) {
			tourData[key] = row[key];
		}
	}

	// Extraire tous les résultats
	const resultats: Record<string, unknown>[] = [];

	// 1. Extraire le premier résultat (colonnes nommées)
	const firstResult: Record<string, unknown> = {};
	let hasFirstResult = false;
	for (const key of resultKeys) {
		if (key in row) {
			firstResult[key] = row[key];
			hasFirstResult = true;
		}
	}
	if (hasFirstResult) {
		resultats.push(firstResult);
	}

	// 2. Extraire les résultats suivants (colonnes Unnamed)
	const unnamedKeys = Object.keys(row)
		.filter((k) => k.startsWith("Unnamed: "))
		.sort(
			(a, b) =>
				parseInt(a.split(":")[1].trim()) - parseInt(b.split(":")[1].trim()),
		);

	// Grouper les colonnes Unnamed par blocs de 12
	for (let i = 0; i < unnamedKeys.length; i += resultKeys.length) {
		const result: Record<string, unknown> = {};
		let hasData = false;

		for (let j = 0; j < resultKeys.length; j++) {
			const unnamedKey = unnamedKeys[i + j];
			if (unnamedKey && row[unnamedKey] !== undefined && row[unnamedKey] !== null) {
				result[resultKeys[j]] = row[unnamedKey];
				hasData = true;
			}
		}

		if (hasData) {
			resultats.push(result);
		}
	}

	tourData.resultats = resultats;
	return tourData;
};

// Fonction pour calculer les votes décisifs
const calculateVotesDecisifs = (
	tour1Data: Record<string, unknown>,
	tour2Data?: Record<string, unknown>,
): number => {
	if (tour2Data && tour2Data.resultats) {
		// Cas où il y a un second tour : différence entre le 1er et 2ème candidat
		const resultats = tour2Data.resultats as Array<{
			Voix: number;
		}>;
		if (resultats.length >= 2) {
			// Trier par nombre de voix décroissant
			const sorted = [...resultats].sort((a, b) => b.Voix - a.Voix);
			return sorted[0].Voix - sorted[1].Voix;
		}
		// Si un seul candidat au second tour, retourner 0
		return 0;
	} else {
		// Cas où il n'y a pas de second tour
		// Calculer la différence entre les voix du gagnant et la moitié des exprimés
		const resultats = tour1Data.resultats as Array<{
			Voix: number;
		}>;
		if (resultats.length === 0) {
			return 0;
		}

		// Trier par nombre de voix décroissant pour trouver le gagnant
		const sorted = [...resultats].sort((a, b) => b.Voix - a.Voix);
		const gagnantVoix = sorted[0].Voix;
		const exprimés = tour1Data.Exprimés as number;

		// Différence entre les voix du gagnant et la moitié des exprimés
		const voixAuDessusMajorite = gagnantVoix - exprimés / 2;
		return Math.max(0, Math.round(voixAuDessusMajorite));
	}
};

console.log("📖 Reading elections_1.json...");
const data1 = await inputFile1.json();

console.log("📖 Reading elections_2.json...");
const data2 = await inputFile2.json();

console.log("📖 Reading population.json...");
const populationData = await inputFilePopulation.json();

// Créer un index des données de elections_2 pour accès rapide
console.log("🔑 Creating index for elections_2...");
const elections2Index = new Map<string, Record<string, unknown>>();
for (const row of data2) {
	const key = createKey(row);
	elections2Index.set(key, row);
}

// Créer un index des données de population pour accès rapide
console.log("🔑 Creating index for population...");
const populationIndex = new Map<number, Record<string, unknown>>();
for (const row of populationData) {
	const inseeCode = parseInt(row.INSEE);
	if (!isNaN(inseeCode)) {
		populationIndex.set(inseeCode, row);
	}
}

console.log(`📊 Processing ${data1.length} entries...`);

const cleanedData = data1.map((row: Record<string, unknown>) => {
	// Créer l'objet de base avec les identifiants de la commune uniquement
	const baseData: Record<string, unknown> = {};
	for (const key of baseKeys) {
		if (key in row) {
			baseData[key] = row[key];
		}
	}

	// Créer l'objet "Tour 1" avec les données de elections_1
	const tour1Data = extractTourData(row);
	baseData["Tour 1"] = tour1Data;

	// Chercher les données correspondantes dans elections_2
	const key = createKey(row);
	const tour2Row = elections2Index.get(key);
	if (tour2Row) {
		const tour2Data = extractTourData(tour2Row);
		baseData["Tour 2"] = tour2Data;
	}

	// Chercher les données de population correspondantes
	const inseeResult = createInseeCodes(row);
	const populationRows = inseeResult.codes
		.map((code: number) => populationIndex.get(code))
		.filter((row): row is Record<string, unknown> => row !== undefined);

	if (populationRows.length > 0) {
		const populationData: Record<string, unknown> = {};

		// Sommer les valeurs pour toutes les clés démographiques
		for (const popKey of populationKeys) {
			let sum = 0;
			for (const popRow of populationRows) {
				if (popKey in popRow && typeof popRow[popKey] === "number") {
					sum += popRow[popKey] as number;
				}
			}
			if (sum > 0) {
				populationData[popKey] = sum;
			}
		}

		if (Object.keys(populationData).length > 0) {
			baseData.population = populationData;
		}
	}

	// Stocker les communes agrégées si applicable
	if (inseeResult.communesAgregees) {
		baseData.communesAgregees = inseeResult.communesAgregees;
	}

	// Calculer l'analyse
	const tour2Data = baseData["Tour 2"] as Record<string, unknown> | undefined;
	const populationData = baseData.population as Record<string, unknown> | undefined;
	
	const votesDecisifs = calculateVotesDecisifs(tour1Data, tour2Data);
	const tourDecisif = tour2Data ? 2 : 1;
	
	// Calculer les majeurs (somme des tranches d'âge 18+)
	let majeurs = 0;
	if (populationData) {
		const tranchesMajeurs = [
			"F18-24", "F25-39", "F40-54", "F55-64", "F65-79", "F80+",
			"H18-24", "H25-39", "H40-54", "H55-64", "H65-79", "H80+",
		];
		for (const tranche of tranchesMajeurs) {
			if (tranche in populationData && typeof populationData[tranche] === "number") {
				majeurs += populationData[tranche] as number;
			}
		}
	}
	
	// Calculer les non-votants de 18-39
	let nonVotants1839 = 0;
	if (populationData && majeurs > 0) {
		const f1824 = (populationData["F18-24"] as number) || 0;
		const h1824 = (populationData["H18-24"] as number) || 0;
		const f2539 = (populationData["F25-39"] as number) || 0;
		const h2539 = (populationData["H25-39"] as number) || 0;
		const jeunes1839 = f1824 + h1824 + f2539 + h2539;

		// Récupérer le nombre de votants au tour décisif
		const tourDecisifData = tourDecisif === 2 ? tour2Data : tour1Data;
		const votantsAuTourDecisif = (tourDecisifData?.Votants as number) || 0;

		nonVotants1839 = jeunes1839 * (1 - votantsAuTourDecisif / majeurs);
	}

	baseData.Analyse = {
		"Votes décisifs": votesDecisifs,
		"tour décisif": tourDecisif,
		majeurs,
		"Non votants de 18-39": nonVotants1839,
	};

	return baseData;
});

console.log("💾 Writing cleaned data to elections.json...");
await Bun.write(outputPath, JSON.stringify(cleanedData, null, 2));

const endTime = performance.now();

console.log(`✅ Done! Processed ${cleanedData.length} entries`);
console.log(`⏺ ${Number(endTime - startTime).toFixed(1)} ms to process`);

export {};
