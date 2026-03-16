import type { City, ElectionEntry, FullCity, TourData2026 } from "./dtos/city";

export const normalizeText = (text: string): string =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[''`]/g, "-")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/\s+/g, "-")
		.replace(/^-+|-+$/g, "")
		.trim();

export const fullCityToCity = (
	city: FullCity,
	electionEntry: ElectionEntry,
): City => {
	const slug = `${city.code_departement}-${city.code_commune}-${city.normalized_name}`;

	// Calculate population stats
	const pop = electionEntry.population;
	const pop1839 = pop
		? (pop["F18-24"] || 0) + (pop["H18-24"] || 0) + (pop["F25-39"] || 0) + (pop["H25-39"] || 0)
		: 0;
	const pop18Plus = pop
		? (pop["F18-24"] || 0) + (pop["F25-39"] || 0) + (pop["F40-54"] || 0) + (pop["F55-64"] || 0) + (pop["F65-79"] || 0) + (pop["F80+"] || 0) +
		  (pop["H18-24"] || 0) + (pop["H25-39"] || 0) + (pop["H40-54"] || 0) + (pop["H55-64"] || 0) + (pop["H65-79"] || 0) + (pop["H80+"] || 0)
		: 0;

	// Get total voters from the decisive tour (2020)
	const tourDecisif = electionEntry["Tour 2"] || electionEntry["Tour 1"];
	const votants = tourDecisif?.Votants || 0;
	const nonVotants = Math.round(pop18Plus - votants);
	const partNeVotantPas = pop18Plus > 0 ? (pop18Plus - votants) / pop18Plus : 0;

	// Compute 2026 analysis when data is available
	const tour1_2026: TourData2026 | undefined = electionEntry["2026"]?.["Tour 1"];
	let votesDecisifs2026: number | undefined;
	let electionTerminee2026: boolean | undefined;
	let nonVotants18392026: number | undefined;

	if (tour1_2026 && pop18Plus > 0) {
		const sorted = [...tour1_2026.resultats]
			.filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix))
			.sort((a, b) => b.Voix - a.Voix);

		if (sorted.length > 0) {
			const gagnant = sorted[0];
			const terminee = gagnant["% Voix/Exp"] > 50;
			electionTerminee2026 = terminee;

			if (terminee) {
				// Cas terminée : votes pour forcer un second tour → 2×V₁ − Exprimés
				votesDecisifs2026 = 2 * gagnant.Voix - tour1_2026.Exprimés;
			} else if (sorted.length >= 2) {
				// Cas second tour : écart entre 1er et 2e au T1 → V₁ − V₂ + 1
				votesDecisifs2026 = gagnant.Voix - sorted[1].Voix + 1;
			}

			// abstentionnistes_18_39 = Abstentions_T1_2026 × (pop_18_39 / pop_18_plus)
			if (pop1839 > 0) {
				nonVotants18392026 = Math.round(tour1_2026.Abstentions * (pop1839 / pop18Plus));
			}
		}
	}

	// Build code INSEE (department code padded to 2 or 3 chars + commune code padded to 3 chars)
	const deptCode = city.code_departement.padStart(city.code_departement.length >= 3 ? 3 : 2, "0");
	const communeCode = city.code_commune.padStart(3, "0");
	const codeInsee = `${deptCode}${communeCode}`;

	return {
		id: city.id,
		slug,
		nom_standard: city.nom_standard,
		code_postal: city.code_departement,
		code_departement: city.code_departement,
		code_insee: codeInsee,
		libelle_departement: city.libelle_departement,
		code_commune: city.code_commune,
		"Tour 1": electionEntry["Tour 1"],
		...(electionEntry["Tour 2"] && { "Tour 2": electionEntry["Tour 2"] }),
		...(electionEntry["2026"] && { "2026": electionEntry["2026"] }),
		...(electionEntry.population && { population: electionEntry.population }),
		...(electionEntry.communesAgregees && { communesAgregees: electionEntry.communesAgregees }),
		Analyse: {
			...electionEntry.Analyse,
			"Pop 18-39": Math.round(pop1839),
			"Pop 18+": Math.round(pop18Plus),
			"Non votants": nonVotants,
			"Part ne votant pas": partNeVotantPas,
			...(votesDecisifs2026 !== undefined && { "Votes décisifs 2026": votesDecisifs2026 }),
			...(electionTerminee2026 !== undefined && { "election terminee 2026": electionTerminee2026 }),
			...(nonVotants18392026 !== undefined && { "Non votants de 18-39 2026": nonVotants18392026 }),
		},
	};
};
