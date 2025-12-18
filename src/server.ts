import { join } from "node:path";
import { file } from "bun";

const PUBLIC_DIR = join(import.meta.dir, "..", "public");
const PORT = process.env.PORT || 3000;

const server = Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const pathname = url.pathname;

		// Build the file path
		const filePath = join(PUBLIC_DIR, pathname);

		// Try to serve the file
		const fileToServe = file(filePath);
		const exists = await fileToServe.exists();

		if (exists) {
			// If it's a directory, try to serve index.html from it
			const stat = await Bun.file(filePath).stat();
			if (stat.isDirectory()) {
				const indexPath = join(filePath, "index.html");
				const indexFile = file(indexPath);
				if (await indexFile.exists()) {
					return new Response(indexFile);
				}
				// If directory doesn't have index.html, fall back to root index.html
				return new Response(file(join(PUBLIC_DIR, "index.html")));
			}

			// Serve the file with cache headers for JSON files
			const headers = new Headers();
			if (pathname.endsWith(".json")) {
				headers.set("Cache-Control", "public, max-age=3600");
			}

			return new Response(fileToServe, { headers });
		}

		// File doesn't exist, serve index.html for SPA routing
		return new Response(file(join(PUBLIC_DIR, "index.html")));
	},
});

console.log(`Server running at http://localhost:${server.port}`);
