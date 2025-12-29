import type { City, ElectionEntry, FullCity } from "./dtos/city";

export const normalizeText = (text: string): string =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[''`]/g, "-")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/\s+/g, "-")
		.trim();

export const fullCityToCity = (
	city: FullCity,
	electionEntry: ElectionEntry,
): City => {
	const slug = `${city.code_departement}-${city.code_commune}-${city.normalized_name}`;
	
	return {
		id: city.id,
		slug,
		nom_standard: city.nom_standard,
		code_postal: city.code_departement,
		code_departement: city.code_departement,
		libelle_departement: city.libelle_departement,
		code_commune: city.code_commune,
		"Tour 1": electionEntry["Tour 1"],
		...(electionEntry["Tour 2"] && { "Tour 2": electionEntry["Tour 2"] }),
		...(electionEntry.population && { population: electionEntry.population }),
		Analyse: electionEntry.Analyse,
	};
};
