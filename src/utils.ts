import type { City, FullCity } from "./dtos/city";

export const normalizeText = (text: string): string =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/['’`]/g, "-")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/\s+/g, "-")
		.trim();

export const fullCityToCity = (city: FullCity): City => ({
	id: city.id,
	slug: `${city.code_postal}-${city.normalized_name.replaceAll(" ", "-")}`,
	nom_standard: city.nom_standard,
	code_postal: city.code_postal,
	superficie_km2: city.superficie_km2,
});
