import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

// Menyajikan hasil build client (client/dist) dari server yang sama, supaya produksi cukup satu container & satu domain.
// File di /assets/ bernama hash dari Vite → boleh di-cache selamanya; index.html selalu dicek ulang.

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

const isFile = (p: string) => existsSync(p) && statSync(p).isFile();

/** Buat handler file statis; null bila folder build tidak ada (mode dev: client dilayani Vite). */
export function staticHandler(dir: string) {
  const root = resolve(dir);
  const index = resolve(root, "index.html");
  if (!isFile(index)) return null;

  return (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "GET" && req.method !== "HEAD") return void res.writeHead(405).end();
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    } catch {
      return void res.writeHead(400).end();
    }
    const target = resolve(root, "." + pathname);
    const inside = target === root || target.startsWith(root + sep);
    // Rute yang tidak dikenal (mis. /?guest=…) jatuh ke index.html; file di luar folder build tidak pernah dilayani.
    const file = inside && isFile(target) ? target : index;
    const hashed = file !== index && pathname.startsWith("/assets/");
    res.writeHead(200, {
      "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": statSync(file).size,
      "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    if (req.method === "HEAD") return void res.end();
    createReadStream(file).pipe(res);
  };
}
