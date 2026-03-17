/**
 * Cloudflare Worker entry point — dev.mobilisator.fr
 *
 * Handles:
 *  - bot UA on city slugs   → inject dynamic Open Graph meta tags
 *  - everything else        → serve from ASSETS with SPA fallback
 *
 * OG image generation (/og/:slug.png) is handled by the Cloudflare Pages
 * Function at functions/og/[slug].ts, which runs on the production site.
 */

interface Env {
	ASSETS: Fetcher;
}

// ─── Module-level cache (persists within a Worker isolate) ─────────
let shareDataCache: Record<string, { name: string; votes: number }> | null = null;

// ─── Bot detection + dynamic meta tags ───────────────────────────
const BOT_UA =
	/facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|googlebot|bingbot|whatsapp|telegram/i;
const CITY_SLUG = /^(\d{1,3}|Z[A-Z])-\d/;

function escapeAttr(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

async function handleBotCityRequest(
	request: Request,
	env: Env,
	slug: string,
): Promise<Response> {
	const origin = new URL(request.url).origin;
	const ogImageUrl = `${origin}/og/${slug}.png`;

	if (!shareDataCache) {
		const r = await env.ASSETS.fetch(
			new URL("/cities/share-data.json", request.url).toString(),
		);
		if (r.ok) shareDataCache = await r.json();
	}

	const city = shareDataCache?.[slug];
	const title = city
		? `${city.name} — ${city.votes.toLocaleString("fr-FR")} jeunes auraient fait la diff' | #RIENSANSNOUS`
		: "#RIENSANSNOUS - Municipales 2026";
	const description = city
		? `${city.votes.toLocaleString("fr-FR")} jeunes de 18-39 ans auraient pu changer le résultat des municipales 2026 à ${city.name}. Et toi, tu votes ?`
		: "Découvre combien de jeunes auraient pu faire la diff' aux municipales 2026 dans ta ville.";

	const indexResp = await env.ASSETS.fetch(
		new URL("/index.html", request.url).toString(),
	);
	let html = await indexResp.text();

	const votesFormatted = city ? city.votes.toLocaleString("fr-FR") : null;

	html = html
		.replace(
			/<title>[^<]*<\/title>/,
			`<title>${escapeAttr(title)}</title>`,
		)
		.replace(
			/<meta property="og:title"[^>]*>/,
			`<meta property="og:title" content="${escapeAttr(title)}">`,
		)
		.replace(
			/<meta property="og:description"[^>]*>/,
			`<meta property="og:description" content="${escapeAttr(description)}">`,
		)
		.replace(
			/<meta name="description"[^>]*>/,
			`<meta name="description" content="${escapeAttr(description)}">`,
		)
		.replace(
			"</head>",
			`<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1920">
<meta property="og:url" content="${request.url}">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(description)}">
<meta name="twitter:image" content="${ogImageUrl}">
<link rel="canonical" href="${request.url}">
</head>`,
		)
		.replace(
			'<div id="cityDetail"></div>',
			city && votesFormatted
				? `<div id="cityDetail"><article style="color:#fff;font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto"><h1 style="font-size:2em;margin-bottom:0.5em">${escapeAttr(city.name)}</h1><p style="font-size:1.2em;margin-bottom:1em"><strong>${votesFormatted} jeunes de 18-39 ans</strong> qui n'ont pas voté auraient pu changer le résultat des élections municipales de 2026 à ${escapeAttr(city.name)}.</p><p>Rien ne doit se décider sans la jeunesse. Découvre l'impact de l'abstention des jeunes dans toutes les communes de France.</p></article></div>`
				: '<div id="cityDetail"></div>',
		);

	return new Response(html, {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

// ─── Main Worker export ───────────────────────────────────────────
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Bot UA on city slug → inject dynamic meta tags
		const ua = request.headers.get("user-agent") ?? "";
		const slugPath = path.slice(1);
		if (BOT_UA.test(ua) && CITY_SLUG.test(slugPath)) {
			return handleBotCityRequest(request, env, slugPath.replace(/\.html$/, ""));
		}

		// Static assets with SPA fallback
		const assetResponse = await (env.ASSETS as Fetcher).fetch(request);
		if (assetResponse.status === 404) {
			return (env.ASSETS as Fetcher).fetch(
				new URL("/index.html", request.url).toString(),
			);
		}
		return assetResponse;
	},
} satisfies ExportedHandler<Env>;
