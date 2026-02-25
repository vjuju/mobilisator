import { ImageResponse } from "@cf-wasm/og/workerd";
import type { PagesFunction } from "@cloudflare/workers-types";

interface ShareData {
	name: string;
	votes: number;
	thumbUrl: string;
	url: string;
	author: string;
	license: string;
}

interface Env {
	ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}

// Minimal VNode helper — satori accepts React-compatible element objects
// without requiring React itself. We cast to `any` at the ImageResponse boundary.
function el(
	type: string,
	props: Record<string, unknown> | null,
	...children: unknown[]
): unknown {
	const filteredChildren = children.filter((c) => c !== null && c !== false && c !== undefined);
	return {
		type,
		key: null,
		ref: null,
		props: {
			...(props ?? {}),
			children: filteredChildren.length === 0
				? undefined
				: filteredChildren.length === 1
				? filteredChildren[0]
				: filteredChildren,
		},
		_owner: null,
		_store: {},
	};
}

// Module-level cache (per worker instance)
let fontCache: ArrayBuffer | null = null;
let shareDataCache: Record<string, ShareData> | null = null;
const inlineImageCache = new Map<string, string>();

const OG_IMAGE_UA = "Mobilisator-OG/1.0 (+https://mobilisator.fr)";

const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = "";
	const CHUNK_SIZE = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
	}
	return btoa(binary);
};

const fetchInlineImage = async (url: string): Promise<string | null> => {
	if (inlineImageCache.has(url)) {
		return inlineImageCache.get(url) ?? null;
	}

	try {
		const resp = await fetch(url, {
			headers: {
				Accept: "image/*,*/*;q=0.8",
				"User-Agent": OG_IMAGE_UA,
			},
		});
		if (!resp.ok) return null;

		const contentType = (resp.headers.get("content-type") ?? "").split(";")[0].trim();
		if (!contentType.startsWith("image/")) return null;

		const buffer = await resp.arrayBuffer();
		if (buffer.byteLength === 0) return null;

		const inlineSrc = `data:${contentType};base64,${bytesToBase64(new Uint8Array(buffer))}`;
		inlineImageCache.set(url, inlineSrc);
		return inlineSrc;
	} catch {
		return null;
	}
};

const resolveImageSrc = async (
	city: ShareData,
): Promise<{ src: string | null; mode: "inline" | "external" | "none" }> => {
	const candidates = [city.thumbUrl, city.url].filter((u): u is string => Boolean(u));
	if (candidates.length === 0) return { src: null, mode: "none" };

	let fallbackExternal: string | null = null;
	for (const url of candidates) {
		if (!fallbackExternal) fallbackExternal = url;
		const inline = await fetchInlineImage(url);
		if (inline) return { src: inline, mode: "inline" };
	}
	if (fallbackExternal) return { src: fallbackExternal, mode: "external" };
	return { src: null, mode: "none" };
};

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env, params } = context;
	const slug = (params.slug as string).replace(/\.png$/, "");

	try {
		// Load share-data.json (cached after first load)
		if (!shareDataCache) {
			const r = await env.ASSETS.fetch(new URL("/cities/share-data.json", request.url).toString());
			if (!r.ok) return new Response("share-data.json not found", { status: 503 });
			shareDataCache = await r.json();
		}

		const city = shareDataCache![slug];
		if (!city) return new Response("City not found", { status: 404 });

		// Load Anton font (cached after first load)
		if (!fontCache) {
			const r = await env.ASSETS.fetch(new URL("/fonts/Anton-Regular.ttf", request.url).toString());
			if (!r.ok) return new Response("Font not found", { status: 503 });
			fontCache = await r.arrayBuffer();
		}

		const imageResult = await resolveImageSrc(city);
		const imageSrc = imageResult.src;

		const creditParts: string[] = [];
		if (city.author) creditParts.push(`Photo : ${city.author}`);
		if (city.license) creditParts.push(city.license);
		creditParts.push("via Wikimedia Commons");
		creditParts.push("Modifiée");
		const credit = creditParts.join(" – ");
		const showCredit = imageSrc && city.author;

		const root = el(
		"div",
		{
			style: {
				display: "flex",
				flexDirection: "column",
				width: "1080px",
				height: "1920px",
				backgroundColor: "#000000",
				position: "relative",
				overflow: "hidden",
			},
		},
		// Background photo
		imageSrc && el("img", {
			src: imageSrc,
			style: {
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				objectFit: "cover",
			},
		}),
		// Dark overlay
		el("div", {
			style: {
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				backgroundColor: "rgba(0, 0, 0, 0.68)",
			},
		}),
		// Text content
		el(
			"div",
			{
				style: {
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "flex-start",
					padding: "180px 60px 80px",
					color: "#ffffff",
					textAlign: "center",
				},
			},
			// "Aux municipales de 2020,"
			el("div", {
				style: { fontSize: 36, color: "#cccccc", fontFamily: "Arial, sans-serif" },
			}, "Aux municipales de 2020,"),
			// "à [VILLE],"
			el("div", {
				style: { fontSize: 56, color: "#ffffff", fontFamily: "Arial, sans-serif", marginTop: 40 },
			}, `à ${city.name},`),
			// Big number
			el("div", {
				style: {
					fontSize: 280,
					color: "#5ECBA1",
					fontFamily: "Anton",
					fontWeight: 400,
					lineHeight: 1,
					marginTop: 100,
				},
			}, city.votes.toLocaleString("fr-FR")),
			// "jeunes auraient fait la diff'"
			el("div", {
				style: { fontSize: 72, color: "#5ECBA1", fontFamily: "Anton", fontWeight: 400, marginTop: 40 },
			}, "jeunes auraient fait la diff'"),
			// "Et toi tu votes en 2026 ?"
			el("div", {
				style: { fontSize: 72, color: "#ffffff", fontFamily: "Anton", fontWeight: 400, marginTop: 120 },
			}, "Et toi tu votes en 2026 ?"),
			// CTA line 1
			el("div", {
				style: { fontSize: 32, color: "#cccccc", fontFamily: "Arial, sans-serif", marginTop: 150, textAlign: "center" },
			}, "Pour plier le game, embarque le plus de monde autour de toi"),
			// CTA line 2
			el("div", {
				style: { fontSize: 32, color: "#cccccc", fontFamily: "Arial, sans-serif", marginTop: 22 },
			}, 'et commente "Je vote #RIENSANSNOUS"'),
		),
		// Photo credit pill (bottom-right)
		showCredit && el("div", {
			style: {
				position: "absolute",
				bottom: 60,
				right: 20,
				fontSize: 18,
				color: "rgba(255, 255, 255, 0.85)",
				backgroundColor: "rgba(0, 0, 0, 0.45)",
				padding: "10px 16px",
				borderRadius: 6,
				display: "flex",
			},
		}, credit),
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const response = new ImageResponse(root as any, {
			width: 1080,
			height: 1920,
			fonts: [
				{
					name: "Anton",
					data: fontCache!,
					weight: 400,
					style: "normal",
				},
			],
		});

		const headers = new Headers(response.headers);
		headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
		headers.set("X-OG-Image-Mode", imageResult.mode);
		headers.set("X-OG-Slug", slug);
		const pngBuffer = await response.arrayBuffer();
		headers.set("X-OG-Bytes", String(pngBuffer.byteLength));
		return new Response(pngBuffer, { status: response.status, headers });
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
};
