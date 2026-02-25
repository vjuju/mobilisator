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
let logoCache: string | null = null;

const OG_IMAGE_UA = "Mobilisator-OG/1.0 (+https://mobilisator.fr)";

/**
 * Return a Wikimedia thumbnail at the requested width.
 * Handles both already-thumbed URLs (replace width) and direct upload URLs (insert thumb/).
 */
function toWikimediaThumb(url: string, width = 600): string {
	// Already a thumbnail URL: .../thumb/{hash}/{hash}/File.jpg/1280px-File.jpg
	const thumbed = url.match(/^(.+\/thumb\/.+\/)(\d+px-)(.+)$/);
	if (thumbed) return `${thumbed[1]}${width}px-${thumbed[3]}`;
	// Direct upload URL: .../commons/{h}/{hh}/File.jpg
	const direct = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/)([a-f0-9]\/[a-f0-9]{2}\/)(.+)$/);
	if (direct) return `${direct[1]}thumb/${direct[2]}${direct[3]}/${width}px-${direct[3]}`;
	return url;
}

const fetchInlineImage = async (url: string): Promise<string | null> => {
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

		const bytes = new Uint8Array(buffer);
		let binary = "";
		const CHUNK = 0x8000;
		for (let i = 0; i < bytes.length; i += CHUNK) {
			binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
		}
		return `data:${contentType};base64,${btoa(binary)}`;
	} catch {
		return null;
	}
};

const resolveImageSrc = async (city: ShareData): Promise<string | null> => {
	const raw = city.thumbUrl || city.url;
	if (!raw) return null;
	// Request a 600px thumbnail to keep memory usage low
	const thumbUrl = toWikimediaThumb(raw, 600);
	return fetchInlineImage(thumbUrl);
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

		// Load Folsom font (cached after first load)
		if (!fontCache) {
			const r = await env.ASSETS.fetch(new URL("/fonts/Folsom-Black.otf", request.url).toString());
			if (!r.ok) return new Response("Font not found", { status: 503 });
			fontCache = await r.arrayBuffer();
		}

		// Load OEP logo (cached after first load)
		if (!logoCache) {
			const r = await env.ASSETS.fetch(new URL("/assets/LogoOEP.png", request.url).toString());
			if (r.ok) {
				const buf = await r.arrayBuffer();
				const bytes = new Uint8Array(buf);
				let bin = "";
				const CHUNK = 0x8000;
				for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
				logoCache = `data:image/png;base64,${btoa(bin)}`;
			}
		}

		const imageSrc = await resolveImageSrc(city);

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
					padding: "100px 60px 80px",
					color: "#ffffff",
					textAlign: "center",
				},
			},
			// OEP logo
			logoCache && el("img", {
				src: logoCache,
				style: { width: 75, height: 75, borderRadius: 10, marginBottom: 40 },
			}),
			// City name pill — rotated, solid offset shadow
			el("div", {
				style: {
					display: "flex",
					transform: "rotate(-4deg)",
					alignSelf: "center",
					position: "relative",
					paddingBottom: 12,
					paddingRight: 12,
					marginTop: 10,
					marginBottom: 50,
				},
			},
				// Black shadow (same size as green pill, offset by 12px)
				el("div", {
					style: {
						position: "absolute",
						top: 12,
						left: 12,
						bottom: 0,
						right: 0,
						backgroundColor: "#000000",
						borderRadius: 100,
					},
				}),
				// Green foreground pill
				el("div", {
					style: {
						position: "relative",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "#5ECBA1",
						borderRadius: 100,
						border: "3px solid #000000",
						paddingTop: 20,
						paddingBottom: 20,
						paddingLeft: 80,
						paddingRight: 80,
					},
				},
					el("div", {
						style: {
							fontSize: 100,
							color: "#000000",
							fontFamily: "Folsom",
							fontWeight: 400,
							lineHeight: 1,
							WebkitTextStroke: "3px #000000",
						},
					}, city.name.toUpperCase()),
				),
			),
			// Big number
			el("div", {
				style: {
					fontSize: 260,
					color: "#ffffff",
					fontFamily: "Folsom",
					fontWeight: 400,
					lineHeight: 1,
					marginTop: 140,
				},
			}, city.votes.toLocaleString("fr-FR")),
			// Tagline — 3 lines in Folsom
			el("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					marginTop: 30,
					gap: 4,
				},
			},
				// Line 1: "JEUNES DE " + "18-39 ANS" in green
				el("div", {
					style: { display: "flex", flexDirection: "row", alignItems: "baseline" },
				},
					el("div", {
						style: { fontSize: 60, color: "#ffffff", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 },
					}, "JEUNES DE\u00A0"),
					el("div", {
						style: { fontSize: 60, color: "#5ECBA1", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 },
					}, "18-39 ANS"),
				),
				// Line 2
				el("div", {
					style: { fontSize: 60, color: "#ffffff", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 },
				}, "AURAIENT FAIT LA DIFF'"),
				// Line 3: dynamic city name
				el("div", {
					style: { fontSize: 60, color: "#ffffff", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 },
				}, `À ${city.name.toUpperCase()} EN 2020`),
			),
				// "JE VOTE EN 2026. / ET TOI ?"
			el("div", {
				style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 130, gap: 0 },
			},
				el("div", {
					style: { fontSize: 72, color: "#5ECBA1", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 },
				}, "JE VOTE EN 2026."),
				el("div", {
					style: { fontSize: 72, color: "#5ECBA1", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 },
				}, "ET TOI ?"),
			),
		),
		// #RIENSANSNOUS — bottom-right
		el("div", {
			style: {
				position: "absolute",
				bottom: 275,
				right: 60,
				fontSize: 64,
				color: "#ffffff",
				fontFamily: "Folsom",
				fontWeight: 400,
				lineHeight: 1,
				display: "flex",
			},
		}, "#RIENSANSNOUS"),
		// MOBILISATOR.FR pill — bottom-right
		el("div", {
			style: {
				position: "absolute",
				bottom: 160,
				right: 60,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "#5ECBA1",
				borderRadius: 16,
				paddingTop: 20,
				paddingBottom: 20,
				paddingLeft: 30,
				paddingRight: 30,
			},
		},
			el("div", {
				style: { fontSize: 60, color: "#000000", fontFamily: "Folsom", fontWeight: 400, lineHeight: 1 },
			}, "MOBILISATOR.FR"),
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
					name: "Folsom",
					data: fontCache!,
					weight: 400,
					style: "normal",
				},
			],
		});

		const headers = new Headers(response.headers);
		headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
		return new Response(response.body, { status: response.status, headers });
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
