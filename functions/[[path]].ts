import type { PagesFunction } from "@cloudflare/workers-types";

interface ShareData {
	name: string;
	votes: number;
}

interface Env {
	ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}

const BOT_UA =
	/facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|googlebot|bingbot|whatsapp|telegram/i;

// Matches French commune slugs: dept(1-3 digits) - commune(1+ chars) - name
const CITY_SLUG = /^\d{1,3}-\d/;

// Module-level cache (per worker instance)
let shareDataCache: Record<string, ShareData> | null = null;

function escapeAttr(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
	const ua = request.headers.get("user-agent") ?? "";
	const requestUrl = new URL(request.url);
	const path = requestUrl.pathname.slice(1);

	// Prefer /og/* for generated images in this deployment.
	// Keep /api/og/* metadata-compatible by pointing to /og/*.
	if (path.startsWith("api/og/")) {
		requestUrl.pathname = `/${path.replace(/^api\/og\//, "og/")}`;
		return Response.redirect(requestUrl.toString(), 307);
	}

	if (BOT_UA.test(ua) && CITY_SLUG.test(path)) {
		const slug = path.replace(/\.html$/, "");
		const origin = requestUrl.origin;
		const ogImageUrl = `${origin}/og/${slug}.png`;

		// Load share-data.json (cached after first load)
		if (!shareDataCache) {
			const r = await env.ASSETS.fetch(new URL("/cities/share-data.json", request.url).toString());
			if (r.ok) shareDataCache = await r.json();
		}

		const city = shareDataCache?.[slug];

		const title = city
			? `${city.name} — ${city.votes.toLocaleString("fr-FR")} jeunes auraient fait la diff' | #RIENSANSNOUS`
			: "#RIENSANSNOUS - Municipales 2020";
		const description = city
			? `${city.votes.toLocaleString("fr-FR")} jeunes de 18-39 ans auraient pu changer le résultat des municipales 2020 à ${city.name}. Et toi, tu votes en 2026 ?`
			: "Découvre combien de jeunes auraient pu faire la diff' aux municipales 2020 dans ta ville.";

		const indexResp = await env.ASSETS.fetch(new URL("/index.html", request.url).toString());
		let html = await indexResp.text();

		// Replace static og:title and og:description already present in index.html
		html = html
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
			);

		// Inject og:image and remaining tags before </head>
		html = html.replace(
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
		);

		return new Response(html, {
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	}

	// Serve static assets; fall back to index.html for SPA routing (404 → SPA)
	const assetResponse = await env.ASSETS.fetch(request as unknown as Request);
	if (assetResponse.status === 404) {
		return env.ASSETS.fetch(new URL("/index.html", request.url).toString());
	}
	return assetResponse;
};
