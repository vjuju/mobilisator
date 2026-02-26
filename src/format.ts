import type { ElectionResult as Resultat } from "./dtos/city";

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
		jeunesNonVotants: "jeunes de 18-39 ans<br>n'ont pas voté",
	},

	// Liens
	detailLink: "Détail",
	sourceLabel: "Source :",
};

// ============================================================================
// TAGLINES PRINCIPALES
// ============================================================================

/**
 * Génère la tagline principale selon si le second tour a eu lieu ou non
 */
export function getMainTagline(hasSecondTour: boolean): string {
	if (hasSecondTour) {
		return "votes suffisaient pour élire un autre maire";
	}
	return "votes suffisaient pour aller au second tour";
}

// ============================================================================
// EXPLICATIONS DES VOTES DÉCISIFS
// ============================================================================

/**
 * Génère l'explication des votes décisifs
 */
export function formatExplanationDecisive(
	cityName: string,
	codeDepartement: string,
	votesDecisifs: number,
	hasSecondTour: boolean,
): string {
	const formattedVotes = votesDecisifs.toLocaleString("fr-FR");

	if (hasSecondTour) {
		return `Lors des municipales de 2020, à ${cityName} (${codeDepartement}), l'écart de voix au second tour entre la 1ère et la 2e liste était de ${formattedVotes} voix.`;
	}
	return `Lors des municipales de 2020, à ${cityName} (${codeDepartement}), la 1ère liste a obtenu ${formattedVotes} voix au-dessus de la majorité au premier tour.`;
}

/**
 * Génère la formule détaillée pour les votes décisifs (second tour)
 */
export function formatFormulaDecisiveSecondTour(
	explanationDecisive: string,
	firstPlaceVoix: number,
	secondPlaceVoix: number,
	votesDecisifs: number,
	tourLabel: string,
	resultsTableHtml: string,
): string {
	return `${explanationDecisive}
<br><br>
<strong>Formule :</strong> Voix de la 1ère liste − Voix de la 2e liste au second tour
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Voix de la 2e liste : ${secondPlaceVoix.toLocaleString("fr-FR")}
<br>• Écart : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${secondPlaceVoix.toLocaleString("fr-FR")} = ${votesDecisifs.toLocaleString("fr-FR")} voix
		<br><br><strong>Résultats du ${tourLabel} :</strong>
		${resultsTableHtml}`;
}

/**
 * Génère la formule détaillée pour les votes décisifs (premier tour)
 */
export function formatFormulaDecisivePremierTour(
	explanationDecisive: string,
	firstPlaceVoix: number,
	exprimes: number,
	votesDecisifs: number,
	tourLabel: string,
	resultsTableHtml: string,
): string {
	const moitieExprimes = Math.round(exprimes / 2);

	return `${explanationDecisive}
<br><br>
<strong>Formule :</strong> Voix de la 1ère liste − (Exprimés ÷ 2) au premier tour
<br><br>
<strong>Détail :</strong>
<br>• Voix de la 1ère liste : ${firstPlaceVoix.toLocaleString("fr-FR")}
<br>• Exprimés : ${exprimes.toLocaleString("fr-FR")}
<br>• Majorité (Exprimés ÷ 2) : ${moitieExprimes.toLocaleString("fr-FR")}
<br>• Marge au-dessus de la majorité : ${firstPlaceVoix.toLocaleString("fr-FR")} − ${moitieExprimes.toLocaleString("fr-FR")} = ${votesDecisifs.toLocaleString("fr-FR")} voix
		<br><br><strong>Résultats du ${tourLabel} :</strong>
		${resultsTableHtml}`;
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
	return `
        <div class="city-detail">
			${aggregationWarning}

			<!-- Main Stat: Decisive Votes -->
			<div class="main-stat">
				<div class="main-number">${votesDecisifs.toLocaleString("fr-FR")}</div>
				<div class="main-label">${mainTagline}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('decisive'); return false;">${labels.detailLink}</a>
			</div>

            <!-- Secondary Stat: Non-Voting Youth -->
            <div class="secondary-stat">
                <div class="secondary-number">${nonVotants1839.toLocaleString("fr-FR")}</div>
                <div class="secondary-label">${labels.stats.jeunesNonVotants}</div>
				<a href="#" class="detail-link" onclick="openDetailModalByKey('nonVoting'); return false;">${labels.detailLink}</a>
            </div>

            <!-- CTA Button -->
            <div class="cta-section">
                <button type="button" class="cta-button" onclick="openMobilisationPanel()">
                    JE ME MOBILISE<span class="emoji">✊</span>
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

