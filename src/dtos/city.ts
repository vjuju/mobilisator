export interface ElectionResult {
	"N.Pan.": number | null;
	"Code Nuance": string;
	"Sexe": string;
	"Nom": string;
	"Prénom": string;
	"Liste": string;
	"Sièges / Elu": string | number;
	"Sièges Secteur": number;
	"Sièges CC": number;
	"Voix": number;
	"% Voix/Ins": number;
	"% Voix/Exp": number;
}

export interface ElectionResult2026 {
	Liste: string;
	"Conduite par": string;
	Nuance: string;
	Voix: number;
	"% Voix/Ins": number;
	"% Voix/Exp": number;
	"Sièges CM": number;
	"Sièges CC": number;
}

export interface TourData2026 {
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
	resultats: ElectionResult2026[];
}

export interface TourData {
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
	resultats: ElectionResult[];
}

export interface PopulationData {
	"F0-2": number;
	"F3-5": number;
	"F6-10": number;
	"F11-17": number;
	"F18-24": number;
	"F25-39": number;
	"F40-54": number;
	"F55-64": number;
	"F65-79": number;
	"F80+": number;
	"H0-2": number;
	"H3-5": number;
	"H6-10": number;
	"H11-17": number;
	"H18-24": number;
	"H25-39": number;
	"H40-54": number;
	"H55-64": number;
	"H65-79": number;
	"H80+": number;
}

export interface AnalyseData {
	"Votes décisifs": number;
	"tour décisif": number;
	majeurs: number;
	"Non votants de 18-39": number;
}

export interface ElectionEntry {
	__id: number;
	"Code du département": string;
	"Libellé du département": string;
	"Code de la commune": string;
	"Libellé de la commune": string;
	"Tour 1": TourData;
	"Tour 2"?: TourData;
	"2026"?: { "Tour 1": TourData2026 };
	population?: PopulationData;
	Analyse: AnalyseData;
	communesAgregees?: string[];
}

export interface FullCity {
	id: number;
	normalized_name: string;
	nom_standard: string;
	nom_sans_pronom: string;
	code_postal: string;
	codes_postaux: string[];
	code_departement: string;
	libelle_departement: string;
	code_commune: string;
	communesAgregees?: string[];
}

export interface AnalyseData {
	"Votes décisifs": number;
	"tour décisif": number;
	majeurs: number;
	"Non votants de 18-39": number;
	"Pop 18-39": number;
	"Pop 18+": number;
	"Non votants": number;
	"Part ne votant pas": number;
	// Champs 2026 (présents uniquement quand les données 2026 sont disponibles)
	"Votes décisifs 2026"?: number;
	"election terminee 2026"?: boolean;
	"Non votants de 18-39 2026"?: number;
}

export interface City {
	id: number;
	slug: string;
	nom_standard: string;
	code_postal: string;
	code_departement: string;
	code_insee: string;
	libelle_departement: string;
	code_commune: string;
	"Tour 1": TourData;
	"Tour 2"?: TourData;
	"2026"?: { "Tour 1": TourData2026 };
	population?: PopulationData;
	Analyse: AnalyseData;
	communesAgregees?: string[];
}

// Search result format: [id, name, code_departement]
export type CitySearchResult = [number, string, string];
