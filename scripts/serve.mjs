/** Tiny static server for previewing dist/ locally:  npm run serve  */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, normalize } from "node:path";

const DIST = resolve(new URL("../dist", import.meta.url).pathname);
const PORT = Number(process.env.PORT || 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  // Normalise first so "../" cannot escape dist/.
  let file = join(DIST, normalize(url).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end("Forbidden"); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    const notFound = join(DIST, "404.html");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(existsSync(notFound) ? readFileSync(notFound) : "Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`serving dist/ at http://localhost:${PORT}`));
