import type { PagesFunction } from "@cloudflare/workers-types";

// Proxy Matomo tracking calls (matomo.php) under a neutral URL (/a/collect)
// to avoid adblocker blocking on known Matomo endpoint names.
export const onRequest: PagesFunction = async (context) => {
	const { request } = context;
	const incoming = new URL(request.url);
	const upstream = new URL(
		"https://stats.mobilisator.fr/matomo/matomo.php",
	);
	upstream.search = incoming.search;

	// Forward visitor IP so Matomo records the real client address
	const forwardHeaders = new Headers(request.headers);
	const clientIp =
		request.headers.get("CF-Connecting-IP") ??
		request.headers.get("X-Forwarded-For");
	if (clientIp) forwardHeaders.set("X-Forwarded-For", clientIp);

	const resp = await fetch(upstream.toString(), {
		method: request.method,
		headers: forwardHeaders,
		body:
			request.method !== "GET" && request.method !== "HEAD"
				? request.body
				: undefined,
		signal: AbortSignal.timeout(5000),
	});

	return new Response(resp.body, {
		status: resp.status,
		headers: {
			"Cache-Control": "no-store",
			"Access-Control-Allow-Origin": "*",
		},
	});
};
