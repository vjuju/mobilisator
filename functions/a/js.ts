import type { PagesFunction } from "@cloudflare/workers-types";

// Proxy the Matomo JS tracker script under a neutral URL (/a/js)
// to avoid adblocker blocking on known Matomo filenames.
export const onRequest: PagesFunction = async () => {
	const resp = await fetch(
		"https://stats.mobilisator.fr/matomo/matomo.js",
		{
			headers: { "User-Agent": "Mobilisator/1.0" },
			signal: AbortSignal.timeout(5000),
		},
	);
	if (!resp.ok) {
		return new Response("// analytics unavailable", {
			status: 200,
			headers: { "Content-Type": "application/javascript; charset=utf-8" },
		});
	}
	const body = await resp.arrayBuffer();
	return new Response(body, {
		headers: {
			"Content-Type": "application/javascript; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
};
