import type { ElectionResult as Resultat, TourData } from "./dtos/city";

// ============================================================================
// MESSAGES D'ERREUR ET DE CHARGEMENT
// ============================================================================

export const messages = {
	codeIncorrect: "Code incorrect",
	rechercheEnCours: "Recherche en cours...",
	aucuneVille: "Aucune ville trouvée",
	erreurRecherche: "Erreur lors de la recherche",
	chargement: "Chargement...",
	villeNonTrouvee: "Ville non trouvée",
	erreurChargementVille: "Erreur lors du chargement de la ville",
	analyseNonDisponible: "Données d'analyse non disponibles pour cette ville",
};

// ============================================================================
// LABELS ET TITRES
// ============================================================================

export const labels = {
	// En-têtes du tableau des résultats
	tableHeaders: {
		listeConduitePar: "Liste conduite par",
		voix: "Voix",
		pourcentInscrits: "% inscrits",
		pourcentExprimes: "% exprimés",
		siegesCM: "Sièges CM",
		siegesCC: "Sièges CC",
	},

	// Labels des tours
	tour1: "1er tour",
	tour2: "2nd tour",

	// Titres des modales
	modalTitles: {
		votesDecisifs: "Calcul des votes décisifs",
		nonVotants: "Calcul des non-votants 18-39 ans",
	},

	// Label "Élu" pour les sièges
	elu: "Élu",

	// Boutons CTA
	cta: {
		partager: "PARTAGE À TA COMMU",
		partagerEmoji: "📣",
		rejoindre: "REJOINS LE MOUVEMENT",
		rejoindreEmoji: "✊",
	},

	// Labels des stats
	stats: {
		jeunesNonVotants: "jeunes de 18-39 ans<br>n'ont pas voté,<br>selon nos estimations",
	},

	// Liens
	detailLink: "Détail",
	sourceLabel: "Source :",
};

// ============================================================================
// TAILLE DE CHIFFRE BASÉE SUR LE RATIO nonVotants / votesDecisifs
// ============================================================================

/**
 * Calcule les font-sizes des deux chiffres principaux en fonction du ratio
 * nonVotants1839 / votesDecisifs, sur une échelle log :
 *   - ratio ≤ 1        → sizeRatio = 1 (même taille)
 *   - ratio ≥ 15 (cap) → sizeRatio = 2 (secondary = 2× main)
 *
 * Les deux chiffres divergent symétriquement autour d'un point médian
 * (÷√sizeRatio pour main, ×√sizeRatio pour secondary) afin que
 * secondary_font / main_font = sizeRatio à tout instant.
 */
function scaledNumberFontSizes(
	nonVotants: number,
	votesDecisifs: number,
): { main: string; secondary: string } {
	const CAP = 15; // ~99e percentile sur les données réelles (hors outliers)
	const MID = 14; // cqh de référence commune quand sizeRatio = 1

	let sizeRatio = 1;
	if (votesDecisifs > 0 && nonVotants > 0) {
		const cityRatio = nonVotants / votesDecisifs;
		const t = Math.min(1, Math.log10(Math.max(1, cityRatio)) / Math.log10(CAP));
		sizeRatio = 1 + t; // [1, 2]
	}

	const mainCqh = (MID / Math.sqrt(sizeRatio)).toFixed(1);
	const secondaryCqh = (MID * Math.sqrt(sizeRatio)).toFixed(1);

	return {
		main: `clamp(26px, ${mainCqh}cqh, 100px)`,
		secondary: `clamp(26px, ${secondaryCqh}cqh, 120px)`,
	};
}

// ============================================================================
// CALCUL DES VOTES DÉCISIFS (runtime)
// ============================================================================

/**
 * Calcule les votes décisifs selon les 5 cas possibles et retourne aussi le cas.
 *
 * Cas 1  : Une seule liste au premier tour → V + 1
 * Cas 2  : Second tour (≥ 2 listes) → écart entre 1er et 2e + 1
 * Cas 2b : Second tour avec une seule liste (élue par défaut) → 0
 * Cas 3  : Victoire au premier tour avec majorité absolue → 2×V₁ − Vₜ
 * Cas 3b : Premier tour sans majorité absolue, pas de second tour → V₁ − V₂ + 1
 */
export function computeVotesDecisifs(
	tour1: TourData,
	tour2?: TourData,
): { votesDecisifs: number; cas: 1 | 2 | "2b" | 3 | "3b" } {
	if (tour2) {
		// Cas 2 / 2b : second tour
		const sorted = [...tour2.resultats]
			.filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix))
			.sort((a, b) => b.Voix - a.Voix);
		if (sorted.length >= 2) {
			return { votesDecisifs: sorted[0].Voix - sorted[1].Voix + 1, cas: 2 };
		}
		// Cas 2b : une seule liste au second tour (élue par défaut)
		// → on se rabat sur le Tour 1 pour estimer l'écart décisif
		const sorted1 = [...tour1.resultats]
			.filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix))
			.sort((a, b) => b.Voix - a.Voix);
		if (sorted1.length >= 2) {
			return { votesDecisifs: sorted1[0].Voix - sorted1[1].Voix + 1, cas: "2b" };
		}
		return { votesDecisifs: 0, cas: "2b" };
	}

	const sorted = [...tour1.resultats]
		.filter((r) => typeof r.Voix === "number" && !Number.isNaN(r.Voix))
		.sort((a, b) => b.Voix - a.Voix);
	if (sorted.length === 0) return { votesDecisifs: 0, cas: 3 };

	const gagnantVoix = sorted[0].Voix;

	if (sorted.length === 1) {
		// Cas 1 : une seule liste au premier tour
		return { votesDecisifs: gagnantVoix + 1, cas: 1 };
	}

	// Plusieurs listes au premier tour
	const exprimés = tour1.Exprimés;
	const majority = 2 * gagnantVoix - exprimés;

	if (majority > 0) {
		// Cas 3 : transformer une victoire au premier tour en élection à deux tours
		return { votesDecisifs: majority, cas: 3 };
	}

	// Cas 3b : pas de majorité absolue mais pas de second tour (anomalie données)
	return { votesDecisifs: sorted[0].Voix - sorted[1].Voix + 1, cas: "3b" };
}

// ============================================================================
// TAGLINES PRINCIPALES
// ============================================================================

/**
 * Tagline universelle sous le nombre de votes décisifs
 */
export function getMainTagline(_hasSecondTour: boolean, cityName: string): string {
	return `votes auraient pu<br>faire la diff'<br>en 2020 à ${cityName}`;
}

// ============================================================================
// FORMULES DÉTAILLÉES DES VOTES DÉCISIFS (3 cas)
// ============================================================================

/**
 * Cas 1 : Une seule liste au premier tour — V + 1
 */
export function formatFormulaDecisiveCas1(
	cityName: string,
	codeDepartement: string,
	firstPlaceVoix: number,
	votesDecisifs: number,
	resultsTableHtml: string,
): string {
	return `À ${cityName} (${codeDepartement}) en 2020, une seule liste était en lice au premier tour.
<br><br>
Pour qu'une autre liste ait pu l'emporter, il aurait fallu qu'elle obtienne strictement plus de voix que la liste unique — soit au moins <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> nouveaux votes.
<br><br>
<strong>Formule :</strong> Voix de la liste unique + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la liste unique : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Votes nécessaires : ${firstPlaceVoix.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour :</strong>
${resultsTableHtml}`;
}

/**
 * Cas 2 : Second tour — changer la liste majoritaire (écart + 1)
 */
export function formatFormulaDecisiveCas2(
	cityName: string,
	codeDepartement: string,
	firstPlaceVoix: number,
	secondPlaceVoix: number,
	votesDecisifs: number,
	tourLabel: string,
	resultsTableHtml: string,
): string {
	const ecart = firstPlaceVoix - secondPlaceVoix;
	return `À ${cityName} (${codeDepartement}) en 2020, la liste arrivée en tête au second tour l'a emporté avec ${ecart.toLocaleString("fr-FR")} voix d'avance.
<br><br>
Pour que la 2e liste passe devant, il aurait suffi d'ajouter <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> nouveaux votes à son score.
<br><br>
<strong>Formule :</strong> (Voix de la 1ère liste − Voix de la 2e liste) + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste : ${secondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${secondPlaceVoix.toLocaleString("fr-FR")} = ${ecart.toLocaleString("fr-FR")}
<br>• Votes décisifs : ${ecart.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du ${tourLabel} :</strong>
${resultsTableHtml}`;
}

/**
 * Cas 3 : Victoire au premier tour — forcer un second tour (2×V₁ − Vₜ)
 */
export function formatFormulaDecisiveCas3(
	cityName: string,
	codeDepartement: string,
	firstPlaceVoix: number,
	exprimes: number,
	votesDecisifs: number,
	tourLabel: string,
	resultsTableHtml: string,
): string {
	const pourcentage = ((firstPlaceVoix / exprimes) * 100).toFixed(1);
	return `À ${cityName} (${codeDepartement}) en 2020, la liste gagnante a remporté l'élection dès le premier tour avec ${pourcentage}% des suffrages exprimés (plus de 50%).
<br><br>
Pour forcer un second tour, il aurait fallu ajouter <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong> votes supplémentaires aux autres listes — ce qui aurait ramené la liste de tête à 50% ou moins.
<br><br>
<strong>Formule :</strong> 2 × Voix de la 1ère liste − Total des exprimés
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste (V₁) : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Total des exprimés (Vₜ) : ${exprimes.toLocaleString("fr-FR")}
<br>• 2 × ${firstPlaceVoix.toLocaleString("fr-FR")} − ${exprimes.toLocaleString("fr-FR")} = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du ${tourLabel} :</strong>
${resultsTableHtml}`;
}

/**
 * Cas 3b : Premier tour sans majorité absolue, pas de second tour — V₁ − V₂ + 1
 */
export function formatFormulaDecisiveCas3b(
	cityName: string,
	codeDepartement: string,
	firstPlaceVoix: number,
	secondPlaceVoix: number,
	votesDecisifs: number,
	resultsTableHtml: string,
): string {
	const ecart = firstPlaceVoix - secondPlaceVoix;
	return `À ${cityName} (${codeDepartement}) en 2020, les élections municipales ne se sont pas tenues en deux tours bien qu'aucune liste n'ait obtenu la majorité absolue au premier tour.
<br><br>
Par analogie avec les communes ayant eu un second tour, on calcule l'écart entre la première et la deuxième liste pour estimer le nombre de votes qui auraient pu inverser l'ordre d'arrivée.
<br><br>
<strong>Formule :</strong> (Voix de la 1ère liste − Voix de la 2e liste) + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste : ${secondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${secondPlaceVoix.toLocaleString("fr-FR")} = ${ecart.toLocaleString("fr-FR")}
<br>• Votes décisifs : ${ecart.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour :</strong>
${resultsTableHtml}`;
}

/**
 * Cas 2b : Second tour avec une seule liste (élue par défaut)
 * On utilise l'écart V₁ − V₂ + 1 du premier tour pour estimer les votes décisifs.
 */
export function formatFormulaDecisiveCas2b(
	cityName: string,
	codeDepartement: string,
	tour1FirstPlaceVoix: number,
	tour1SecondPlaceVoix: number,
	votesDecisifs: number,
	tour1ResultsTableHtml: string,
): string {
	const ecart = tour1FirstPlaceVoix - tour1SecondPlaceVoix;
	return `À ${cityName} (${codeDepartement}) en 2020, une seule liste était en lice au second tour : toutes les autres listes s'étaient retirées ou fusionnées avant le second tour.
<br><br>
En l'absence d'adversaire au second tour, on remonte au premier tour pour estimer les votes décisifs : l'écart entre la première et la deuxième liste au 1er tour indique combien de votes auraient pu modifier l'ordre d'arrivée avant les désistements.
<br><br>
<strong>Formule :</strong> (Voix de la 1ère liste − Voix de la 2e liste au 1er tour) + 1
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste (1er tour) : ${tour1FirstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste (1er tour) : ${tour1SecondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${tour1FirstPlaceVoix.toLocaleString("fr-FR")} − ${tour1SecondPlaceVoix.toLocaleString("fr-FR")} = ${ecart.toLocaleString("fr-FR")}
<br>• Votes décisifs : ${ecart.toLocaleString("fr-FR")} + 1 = <strong>${votesDecisifs.toLocaleString("fr-FR")}</strong>
<br><br><strong>Résultats du 1er tour :</strong>
${tour1ResultsTableHtml}`;
}

// ============================================================================
// EXPLICATIONS DES NON-VOTANTS
// ============================================================================

/**
 * Génère l'explication des non-votants
 */
export function formatExplanationNonVoting(
	cityName: string,
	codeDepartement: string,
	pop1839: number,
	partNeVotantPas: number,
	nonVotants: number,
	pop18Plus: number,
): string {
	return `Lors des municipales de 2020, ${cityName} (${codeDepartement}) compte ${pop1839.toLocaleString("fr-FR")} jeunes de 18 à 39 ans et en moyenne ${(partNeVotantPas * 100).toFixed(1)}% de la population majeure n'a pas voté à ${cityName} (${nonVotants.toLocaleString("fr-FR")} non votants / ${pop18Plus.toLocaleString("fr-FR")} majeur·es).`;
}

/**
 * Génère la formule détaillée pour les non-votants
 */
export function formatFormulaNonVotants(
	explanationNonVoting: string,
	pop1839: number,
	pop18Plus: number,
	votants: number,
	partNeVotantPas: number,
	nonVotants1839: number,
): string {
	return `${explanationNonVoting}
<br><br>
<strong>Formule :</strong> Population 18-39 ans × Taux d'abstention
<br><br>
<strong>Détail :</strong>
<br>• Population 18-39 ans : ${pop1839.toLocaleString("fr-FR")}
<br>• Population 18+ ans : ${pop18Plus.toLocaleString("fr-FR")}
<br>• Votants : ${votants.toLocaleString("fr-FR")}
<br>• Taux d'abstention : ${(partNeVotantPas * 100).toFixed(1)}% = (${pop18Plus.toLocaleString("fr-FR")} − ${votants.toLocaleString("fr-FR")}) ÷ ${pop18Plus.toLocaleString("fr-FR")}
<br>• Non-votants 18-39 ans estimés : ${pop1839.toLocaleString("fr-FR")} × ${(partNeVotantPas * 100).toFixed(1)}% = ${nonVotants1839.toLocaleString("fr-FR")}`;
}

// ============================================================================
// GÉNÉRATION DU TABLEAU DES RÉSULTATS
// ============================================================================

/**
 * Génère une ligne du tableau des résultats
 */
export function formatResultatRow(resultat: Resultat): string {
	const titre = resultat.Sexe === "F" ? "Mme" : "M.";
	const sieges =
		typeof resultat["Sièges / Elu"] === "number"
			? resultat["Sièges / Elu"]
			: resultat["Sièges / Elu"] === "Oui"
				? labels.elu
				: resultat["Sièges / Elu"];

	return `<tr>
		<td>${titre} ${resultat.Prénom} ${resultat.Nom}</td>
		<td>${resultat.Voix.toLocaleString("fr-FR")}</td>
		<td>${resultat["% Voix/Ins"].toFixed(2)}%</td>
		<td>${resultat["% Voix/Exp"].toFixed(2)}%</td>
		<td>${sieges}</td>
		<td>${resultat["Sièges CC"]}</td>
	</tr>`;
}

/**
 * Génère le tableau complet des résultats
 */
export function formatResultsTable(resultats: Resultat[]): string {
	const rows = resultats.map(formatResultatRow).join("");

	return `
		<div class="table-scroll-container">
			<table class="results-table">
				<thead>
					<tr>
						<th>${labels.tableHeaders.listeConduitePar}</th>
						<th>${labels.tableHeaders.voix}</th>
						<th>${labels.tableHeaders.pourcentInscrits}</th>
						<th>${labels.tableHeaders.pourcentExprimes}</th>
						<th>${labels.tableHeaders.siegesCM}</th>
						<th>${labels.tableHeaders.siegesCC}</th>
					</tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
		</div>
	`;
}

// ============================================================================
// AVERTISSEMENT D'AGRÉGATION
// ============================================================================

/**
 * Génère l'avertissement d'agrégation pour les communes composites
 */
export function formatAggregationWarning(communesAgregees: string[]): string {
	if (!communesAgregees || communesAgregees.length === 0) {
		return "";
	}

	const communesList = communesAgregees.join(", ");
	return `
		<div class="aggregation-warning">
			⚠️ Les chiffres présentés sont les agrégations des communes suivantes : ${communesList}
		</div>
	`;
}

// ============================================================================
// GÉNÉRATION DU HTML DE DÉTAIL DE LA VILLE
// ============================================================================

/**
 * Génère le HTML complet pour l'affichage du détail d'une ville
 */
export function formatCityDetailHtml(
	votesDecisifs: number,
	mainTagline: string,
	nonVotants1839: number,
	aggregationWarning: string,
): string {
	const fontSizes = scaledNumberFontSizes(nonVotants1839, votesDecisifs);
	return `
        <div class="city-detail">
			${aggregationWarning}

			<!-- Main Stat: Decisive Votes -->
			<div class="main-stat">

				<div class="main-number" style="font-size:${fontSizes.main}">${votesDecisifs.toLocaleString("fr-FR")}</div>
				<div class="main-label">${mainTagline}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('decisive'); return false;">${labels.detailLink}</a>
			</div>

            <!-- Secondary Stat: Non-Voting Youth -->
            <div class="secondary-stat">

                <div class="secondary-number" style="font-size:${fontSizes.secondary}">${nonVotants1839.toLocaleString("fr-FR")}</div>
                <div class="secondary-label">${labels.stats.jeunesNonVotants}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('nonVoting'); return false;">${labels.detailLink}</a>
            </div>

            <!-- CTA Buttons -->
            <div class="cta-section">
                <button type="button" class="cta-button" onclick="openHowPanel()">
                    JE VOTE LES 15 ET 22 MARS<br>MODE D'EMPLOI<span class="emoji">🗳️</span>
                </button>
                <button id="shareBtn" type="button" class="cta-button" onclick="openInfluPanel()">
                    J'INFORME MES POTES<span class="emoji">📣</span>
                </button>
                <button type="button" class="cta-button" onclick="openRejoinPanel()">
                    JE ME MOBILISE<br>AVEC ON EST PRÊT<span class="emoji">✊</span>
                </button>
            </div>

        </div>
    `;
}

// ============================================================================
// URLS DES SOURCES
// ============================================================================

/**
 * Génère l'URL de la source électorale pour une commune
 */
export function getElectionSourceUrl(
	codeDepartement: string,
	codeCommune: string,
): string {
	const deptCode = codeDepartement.padStart(3, "0");
	return `https://www.archives-resultats-elections.interieur.gouv.fr/resultats/municipales-2020/${deptCode}/${deptCode}${codeCommune}.php`;
}

/**
 * URL de la source des données de non-votants
 */
export const nonVotingSourceUrl =
	"https://explore.data.gouv.fr/fr/datasets/6627b6fd7291f9d8a62d9997/#/resources/b8ad4a63-a4e3-4ef2-af6e-b08ef3b8084d";

// ============================================================================
// FORMATAGE DES RÉSULTATS DE RECHERCHE
// ============================================================================

/**
 * Génère le HTML pour un résultat de recherche
 */
export function formatSearchResultItem(
	id: number,
	name: string,
	codeDepartement: string,
): string {
	return `
		<div class="result-item" onclick="navigateToCityById(${id})">
			<h3>${name} (${codeDepartement})</h3>
		</div>
	`;
}

/**
 * Génère le texte affiché dans l'input de recherche après sélection d'une ville
 */
export function formatSearchInputValue(
	nomStandard: string,
	codeDepartement: string,
): string {
	return `${nomStandard} (${codeDepartement})`;
}

