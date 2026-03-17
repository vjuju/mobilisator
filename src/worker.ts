/**
 * Unified Cloudflare Worker entry point.
 *
 * Handles:
 *  - /og/:slug.png          → generate OG share image
 *  - /api/og/:slug[.png]    → redirect to /og/:slug.png
 *  - bot UA on city slugs   → inject dynamic Open Graph meta tags
 *  - everything else        → serve from ASSETS with SPA fallback
 */

import { ImageResponse } from "@cf-wasm/og/workerd";

interface Env {
	ASSETS: Fetcher;
}

interface ShareData {
	name: string;
	votes: number;
	thumbUrl: string;
	url: string;
	author: string;
	license: string;
}

// ─── Module-level caches (persist within a Worker isolate) ─────────
let fontCache: ArrayBuffer | null = null;
let logoCache: string | null = null;
let shareDataCacheOg: Record<string, ShareData> | null = null;
let shareDataCacheMeta: Record<string, { name: string; votes: number }> | null = null;

// ─── VNode helper (React-compatible objects for satori) ────────────
function el(
	type: string,
	props: Record<string, unknown> | null,
	...children: unknown[]
): unknown {
	const filtered = children.filter((c) => c !== null && c !== false && c !== undefined);
	return {
		type,
		key: null,
		ref: null,
		props: {
			...(props ?? {}),
			children:
				filtered.length === 0
					? undefined
					: filtered.length === 1
						? filtered[0]
						: filtered,
		},
		_owner: null,
		_store: {},
	};
}

// ─── Wikimedia thumbnail URL builder ──────────────────────────────
function toWikimediaThumb(url: string, width = 600): string {
	const thumbed = url.match(/^(.+\/thumb\/.+\/)(\d+px-)(.+)$/);
	if (thumbed) return `${thumbed[1]}${width}px-${thumbed[3]}`;
	const direct = url.match(
		/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/)([a-f0-9]\/[a-f0-9]{2}\/)(.+)$/,
	);
	if (direct)
		return `${direct[1]}thumb/${direct[2]}${direct[3]}/${width}px-${direct[3]}`;
	return url;
}

// ─── Fetch and base64-encode an image ─────────────────────────────
const OG_UA = "Mobilisator-OG/1.0 (+https://mobilisator.fr)";

async function fetchInlineImage(url: string): Promise<string | null> {
	try {
		const resp = await fetch(url, {
			headers: { Accept: "image/*,*/*;q=0.8", "User-Agent": OG_UA },
		});
		if (!resp.ok) return null;
		const ct = (resp.headers.get("content-type") ?? "").split(";")[0].trim();
		if (!ct.startsWith("image/")) return null;
		const buffer = await resp.arrayBuffer();
		if (buffer.byteLength === 0) return null;
		const bytes = new Uint8Array(buffer);
		let binary = "";
		const CHUNK = 0x8000;
		for (let i = 0; i < bytes.length; i += CHUNK)
			binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
		return `data:${ct};base64,${btoa(binary)}`;
	} catch {
		return null;
	}
}

// ─── OG image generation ──────────────────────────────────────────
async function handleOgImage(
	request: Request,
	env: Env,
	slug: string,
): Promise<Response> {
	try {
		if (!shareDataCacheOg) {
			const r = await env.ASSETS.fetch(
				new URL("/cities/share-data.json", request.url).toString(),
			);
			if (!r.ok) return new Response("share-data.json not found", { status: 503 });
			shareDataCacheOg = await r.json();
		}

		const city = shareDataCacheOg![slug];
		if (!city) return new Response("City not found", { status: 404 });

		if (!fontCache) {
			const r = await env.ASSETS.fetch(
				new URL("/fonts/Folsom-Black.otf", request.url).toString(),
			);
			if (!r.ok) return new Response("Font not found", { status: 503 });
			fontCache = await r.arrayBuffer();
		}

		if (!logoCache) {
			const r = await env.ASSETS.fetch(
				new URL("/assets/LogoOEP.png", request.url).toString(),
			);
			if (r.ok) {
				const buf = await r.arrayBuffer();
				const bytes = new Uint8Array(buf);
				let bin = "";
				const CHUNK = 0x8000;
				for (let i = 0; i < bytes.length; i += CHUNK)
					bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
				logoCache = `data:image/png;base64,${btoa(bin)}`;
			}
		}

		const raw = city.thumbUrl || city.url;
		const imageSrc = raw ? await fetchInlineImage(toWikimediaThumb(raw, 600)) : null;

		const creditParts: string[] = [];
		if (city.author) creditParts.push(`Photo : ${city.author}`);
		if (city.license) creditParts.push(city.license);
		creditParts.push("via Wikimedia Commons");
		creditParts.push("Modifiée");
		const credit = creditParts.join(" – ");
		const showCredit = imageSrc && city.author;

		// biome-ignore format: tree structure is clearer on one line per node
		const root = el("div", { style: { display: "flex", flexDirection: "column", width: "1080px", height: "1920px", backgroundColor: "#000000", position: "relative", overflow: "hidden" } },
			imageSrc && el("img", { src: imageSrc, style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" } }),
			el("div", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.68)" } }),
			el("div", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "100px 60px 80px", color: "#ffffff", textAlign: "center" } },
				logoCache && el("img", { src: logoCache, style: { width: 75, height: 75, borderRadius: 10, marginBottom: 40 } }),
				el("div", { style: { display: "flex", transform: "rotate(-4deg)", alignSelf: "center", position: "relative", paddingBottom: 12, paddingRight: 12, marginTop: 10, marginBottom: 50 } },
					el("div", { style: { position: "absolute", top: 12, left: 12, bottom: 0, right: 0, backgroundColor: "#000000", borderRadius: 100 } }),
					el("div", { style: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#5ECBA1", borderRadius: 100, border: "3px solid #000000", paddingTop: 20, paddingBottom: 20, paddingLeft: 80, paddingRight: 80 } },
						el("div", { style: { fontSize: 100, color: "#000000", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1, WebkitTextStroke: "3px #000000" } }, city.name.toUpperCase()),
					),
				),
				el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 140 } },
					el("div", { style: { fontSize: 280, color: "#5ECBA1", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 } }, city.votes.toLocaleString("fr-FR")),
				),
				el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 20, gap: 2 } },
					el("div", { style: { fontSize: 44, color: "#ffffff", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 } }, "VOTES SÉPARENT LES FINALISTES"),
					el("div", { style: { fontSize: 44, color: "#ffffff", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 } }, "DU 1ER TOUR DES MUNICIPALES 2026"),
				),
				el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 120, gap: 0 } },
					el("div", { style: { fontSize: 90, color: "#5ECBA1", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 } }, "JE VOTE"),
					el("div", { style: { fontSize: 90, color: "#5ECBA1", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 } }, "LE 22 MARS."),
					el("div", { style: { fontSize: 90, color: "#5ECBA1", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 } }, "ET TOI ?"),
				),
			),
			el("div", { style: { position: "absolute", bottom: 275, right: 60, fontSize: 64, color: "#ffffff", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1, display: "flex" } }, "#RIENSANSNOUS"),
			el("div", { style: { position: "absolute", bottom: 160, right: 60, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#5ECBA1", borderRadius: 16, paddingTop: 20, paddingBottom: 20, paddingLeft: 30, paddingRight: 30 } },
				el("div", { style: { fontSize: 60, color: "#000000", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 } }, "MOBILISATOR.FR"),
			),
			showCredit && el("div", { style: { position: "absolute", bottom: 60, right: 20, fontSize: 18, color: "rgba(255,255,255,0.85)", backgroundColor: "rgba(0,0,0,0.45)", padding: "10px 16px", borderRadius: 6, display: "flex" } }, credit),
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const img = new ImageResponse(root as any, {
			width: 1080,
			height: 1920,
			fonts: [{ name: "Folsom", data: fontCache!, weight: 400, style: "normal" }],
		});

		const headers = new Headers(img.headers);
		headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
		return new Response(img.body, { status: img.status, headers });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return new Response(`OG generation error: ${message}`, {
			status: 500,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "no-store",
				"X-OG-Error": message.slice(0, 180),
				"X-OG-Slug": slug,
			},
		});
	}
}

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

	if (!shareDataCacheMeta) {
		const r = await env.ASSETS.fetch(
			new URL("/cities/share-data.json", request.url).toString(),
		);
		if (r.ok) shareDataCacheMeta = await r.json();
	}

	const city = shareDataCacheMeta?.[slug];
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

		// /api/og/* → redirect to /og/*
		if (path.startsWith("/api/og/")) {
			const newUrl = new URL(request.url);
			newUrl.pathname = path.replace(/^\/api\/og\//, "/og/");
			return Response.redirect(newUrl.toString(), 307);
		}

		// /og/:slug.png → generate OG image
		const ogMatch = path.match(/^\/og\/([^/]+)\.png$/);
		if (ogMatch) {
			return handleOgImage(request, env, ogMatch[1]);
		}

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
