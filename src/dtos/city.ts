export interface RawCity {
	nom_standard: string;
	nom_sans_pronom: string;
	code_postal: string | null;
	codes_postaux: string | null;
	superficie_km2: number;
}

export interface FullCity {
	id: number;
	normalized_name: string;
	nom_standard: string;
	nom_sans_pronom: string;
	code_postal: string;
	codes_postaux: string[];
	superficie_km2: number;
}

export interface City {
	id: number;
	slug: string;
	nom_standard: string;
	code_postal: string;
	superficie_km2: number;
}

// Search result format: [id, name, postal_code]
export type CitySearchResult = [number, string, string];
