import type { PagesFunction } from "@cloudflare/workers-types";

interface Env {
	ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}

const BOT_UA =
	/facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|googlebot|bingbot|whatsapp|telegram/i;

// Matches French commune slugs: dept(1-3 digits) - commune(1+ chars) - name
const CITY_SLUG = /^\d{1,3}-\d/;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
	const ua = request.headers.get("user-agent") ?? "";
	const path = new URL(request.url).pathname.slice(1);

	if (BOT_UA.test(ua) && CITY_SLUG.test(path)) {
		const slug = path.replace(/\.html$/, "");
		const origin = new URL(request.url).origin;
			const ogImageUrl = `${origin}/api/og/${slug}.png`;

		const indexResp = await env.ASSETS.fetch(new URL("/index.html", request.url).toString());
		const html = await indexResp.text();

		const injected = html.replace(
			"</head>",
			`<meta property="og:title" content="#RIENSANSNOUS - Municipales 2020">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1920">
<meta property="og:url" content="${request.url}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImageUrl}">
</head>`,
		);

		return new Response(injected, {
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
